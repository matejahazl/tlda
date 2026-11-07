import "server-only"
import { LlmUnavailableError } from "../LlmIntegrationService"
import type {
    AgentMessage,
    ChatRequest,
    ChatResponse,
    LlmProvider,
    LlmRequest,
    LlmResponse,
    ToolCall,
} from "../types"

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models" // Gemini REST endpoint
const MAX_OUTPUT_TOKENS = 600 // the reply is a short JSON list
const MAX_CHAT_OUTPUT_TOKENS = 800 // enough for a 2000-character answer
const TEMPERATURE = 0.1 // near-deterministic extraction
const MAX_ERROR_BODY_CHARS = 500 // enough of a provider error to debug from the log
const THINKING_CONFIG = { thinkingLevel: "minimal" } // minimal to reduce latency

// JSON mode alone let the model return items as plain strings, so enforce the shape here (measured)
const RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
        title: { type: "STRING" },
        items: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: { text: { type: "STRING" } },
                required: ["text"],
            },
        },
    },
    required: ["title", "items"],
}

type GeminiPart = {
    text?: string
    thought?: boolean
    thoughtSignature?: string
    functionCall?: { id?: string; name: string; args?: unknown }
    functionResponse?: { id?: string; name: string; response: object }
}

type GeminiReply = {
    candidates?: { content?: { parts?: GeminiPart[] } }[]
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
}

// Plain fetch on the REST API: no SDK dependency, and Node reuses connections between calls
export class GeminiProvider implements LlmProvider {
    constructor(
        private readonly apiKey: string,
        private readonly model: string,
    ) {}

    async complete(
        request: LlmRequest,
        opts: { signal: AbortSignal },
    ): Promise<LlmResponse> {
        const raw = await this.generate(
            {
                systemInstruction: { parts: [{ text: request.system }] },
                contents: [{ role: "user", parts: [{ text: request.user }] }],
                generationConfig: {
                    temperature: TEMPERATURE,
                    maxOutputTokens: MAX_OUTPUT_TOKENS,
                    responseMimeType: "application/json",
                    responseSchema: RESPONSE_SCHEMA,
                    thinkingConfig: THINKING_CONFIG,
                },
            },
            opts.signal,
        )
        const reply = JSON.parse(raw) as GeminiReply

        return {
            // Blocked or empty: pass the raw reply on, so it fails validation and is logged verbatim
            text: replyText(reply) || raw,
            usage: usageOf(reply),
        }
    }

    async chat(
        request: ChatRequest,
        opts: { signal: AbortSignal },
    ): Promise<ChatResponse> {
        const raw = await this.generate(
            {
                systemInstruction: { parts: [{ text: request.system }] },
                contents: request.messages.map(toContent),
                tools: [
                    {
                        functionDeclarations: request.tools.map((tool) => ({
                            name: tool.name,
                            description: tool.description,
                            parametersJsonSchema: tool.parameters,
                        })),
                    },
                ],
                toolConfig: { functionCallingConfig: { mode: "AUTO" } }, // the model may answer without a tool, e.g. to decline
                generationConfig: {
                    temperature: TEMPERATURE,
                    maxOutputTokens: MAX_CHAT_OUTPUT_TOKENS,
                    thinkingConfig: THINKING_CONFIG,
                },
            },
            opts.signal,
        )
        const reply = JSON.parse(raw) as GeminiReply
        const parts = reply.candidates?.[0]?.content?.parts ?? []
        const calls: ToolCall[] = parts.flatMap((part, i) =>
            part.functionCall
                ? [
                      {
                          // Gemini often leaves out the id; ours only pairs a call with its result
                          id:
                              part.functionCall.id ??
                              `call-${request.messages.length}-${i}`,
                          name: part.functionCall.name,
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
            raw,
            usage: usageOf(reply),
        }
    }

    private async generate(body: object, signal: AbortSignal): Promise<string> {
        let res: Response
        try {
            res = await fetch(`${API_URL}/${this.model}:generateContent`, {
                method: "POST",
                // The key goes in a header, never the URL, so it can't leak into logs
                headers: {
                    "content-type": "application/json",
                    "x-goog-api-key": this.apiKey,
                },
                body: JSON.stringify(body),
                signal,
            })
        } catch (error) {
            if (signal.aborted) {
                throw error // LlmIntegrationService reports this as a timeout
            }

            throw new LlmUnavailableError("Could not reach Gemini", {
                cause: error,
            })
        }

        if (!res.ok) {
            const detail = (await res.text().catch(() => "")).slice(
                0,
                MAX_ERROR_BODY_CHARS,
            )
            const message = `Gemini returned ${res.status}: ${detail}`

            // 429 and 5xx are the provider's problem; anything else (bad key, bad model) is ours
            throw res.status === 429 || res.status >= 500
                ? new LlmUnavailableError(message)
                : new Error(message)
        }

        return res.text()
    }
}

// Our message format to Gemini's: tool results go back as a user turn
function toContent(message: AgentMessage) {
    if (message.role === "user") {
        return { role: "user", parts: [{ text: message.text }] }
    }

    if (message.role === "model") {
        return {
            role: "model",
            parts: message.calls.map(
                ({ id, name, args, signature }): GeminiPart => ({
                    functionCall: { id, name, args },
                    thoughtSignature: signature,
                }),
            ),
        }
    }

    return {
        role: "user",
        parts: message.results.map(({ id, name, result }): GeminiPart => ({
            functionResponse: { id, name, response: { output: result } }, // response must be an object
        })),
    }
}

// The answer text, without thought summaries
function replyText(reply: GeminiReply): string {
    return (reply.candidates?.[0]?.content?.parts ?? [])
        .filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("")
}

function usageOf(reply: GeminiReply): LlmResponse["usage"] {
    return {
        inputTokens: reply.usageMetadata?.promptTokenCount,
        outputTokens: reply.usageMetadata?.candidatesTokenCount,
    }
}
