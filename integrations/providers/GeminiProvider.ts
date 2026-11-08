import "server-only"
import {
    ApiError,
    type Content,
    FunctionCallingConfigMode,
    type GenerateContentConfig,
    type GenerateContentResponse,
    GoogleGenAI,
    ThinkingLevel,
} from "@google/genai"
import { isUnavailableStatus, LlmProvider } from "../LlmProvider"
import type {
    AgentMessage,
    ChatRequest,
    ChatResponse,
    CompleteRequest,
    CompleteResponse,
    LlmUsage,
    ToolCall,
} from "../types"

const TEMPERATURE = 0.1 // near-deterministic replies
const THINKING_CONFIG = { thinkingLevel: ThinkingLevel.MINIMAL } // minimal to reduce latency

// The SDK keeps its own client, so the client is made once per provider and the provider once per app
export class GeminiProvider extends LlmProvider {
    protected readonly name = "Gemini"
    private readonly client: GoogleGenAI

    constructor(
        apiKey: string,
        private readonly model: string,
    ) {
        super()
        this.client = new GoogleGenAI({ apiKey })
    }

    async complete(
        request: CompleteRequest,
        opts: { signal: AbortSignal },
    ): Promise<CompleteResponse> {
        const reply = await this.generate(
            [{ role: "user", parts: [{ text: request.user }] }],
            {
                systemInstruction: request.system,
                temperature: TEMPERATURE,
                maxOutputTokens: request.maxOutputTokens,
                ...(request.responseSchema && {
                    responseMimeType: "application/json",
                    responseJsonSchema: request.responseSchema,
                }),
                thinkingConfig: THINKING_CONFIG,
            },
            opts.signal,
        )

        return {
            // Blocked or empty: pass the raw reply on, so it fails validation and is logged verbatim
            text: replyText(reply) || JSON.stringify(reply),
            usage: usageOf(reply),
        }
    }

    async chat(
        request: ChatRequest,
        opts: { signal: AbortSignal },
    ): Promise<ChatResponse> {
        const reply = await this.generate(
            request.messages.map(toContent),
            {
                systemInstruction: request.system,
                tools: [
                    {
                        functionDeclarations: request.tools.map((tool) => ({
                            name: tool.name,
                            description: tool.description,
                            parametersJsonSchema: tool.parameters,
                        })),
                    },
                ],
                toolConfig: {
                    functionCallingConfig: {
                        mode: FunctionCallingConfigMode.AUTO, // the model may answer without a tool, e.g. to decline
                    },
                },
                temperature: TEMPERATURE,
                maxOutputTokens: request.maxOutputTokens,
                thinkingConfig: THINKING_CONFIG,
            },
            opts.signal,
        )
        const parts = reply.candidates?.[0]?.content?.parts ?? []
        const calls: ToolCall[] = parts.flatMap((part, i) =>
            part.functionCall
                ? [
                      {
                          // Gemini often leaves out the id; ours only pairs a call with its result
                          id:
                              part.functionCall.id ??
                              `call-${request.messages.length}-${i}`,
                          name: part.functionCall.name ?? "",
                          args: part.functionCall.args ?? {},
                          signature: part.thoughtSignature,
                      },
                  ]
                : [],
        )

        return {
            // Blocked or empty: an empty answer fails validation and the raw reply is logged
            reply:
                calls.length > 0
                    ? { kind: "tool_calls", calls }
                    : { kind: "text", text: replyText(reply) },
            raw: JSON.stringify(reply),
            usage: usageOf(reply),
        }
    }

    private generate(
        contents: Content[],
        config: GenerateContentConfig,
        signal: AbortSignal,
    ): Promise<GenerateContentResponse> {
        return this.send(signal, () =>
            this.client.models.generateContent({
                model: this.model,
                contents,
                config: { ...config, abortSignal: signal },
            }),
        )
    }

    protected isUnavailable(error: unknown): boolean {
        return (
            error instanceof TypeError || // fetch's network failure, passed through by the SDK
            (error instanceof ApiError && isUnavailableStatus(error.status))
        )
    }
}

// Our message format to Gemini's: tool results go back as a user turn
function toContent(message: AgentMessage): Content {
    if (message.role === "user") {
        return { role: "user", parts: [{ text: message.text }] }
    }

    if (message.role === "model") {
        return {
            role: "model",
            parts: message.calls.map(({ id, name, args, signature }) => ({
                functionCall: {
                    id,
                    name,
                    args: args as Record<string, unknown>, // runAgent got these from Gemini as an object
                },
                thoughtSignature: signature,
            })),
        }
    }

    return {
        role: "user",
        parts: message.results.map(({ id, name, result }) => ({
            functionResponse: { id, name, response: { output: result } }, // response must be an object
        })),
    }
}

// The answer text, without thought summaries
function replyText(reply: GenerateContentResponse): string {
    return (reply.candidates?.[0]?.content?.parts ?? [])
        .filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("")
}

function usageOf(reply: GenerateContentResponse): LlmUsage {
    return {
        inputTokens: reply.usageMetadata?.promptTokenCount,
        outputTokens: reply.usageMetadata?.candidatesTokenCount,
    }
}
