import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { isUnavailableStatus, LlmProvider } from "./LlmProvider"
import type {
    AgentMessage,
    ChatRequest,
    ChatResponse,
    CompleteRequest,
    CompleteResponse,
    LlmUsage,
    ToolCall,
} from "./types"

const EFFORT = "low" // low effort keeps it short
const THINKING_HEADROOM_TOKENS = 2000 // thinking counts toward max_tokens, so the reply isn't cut off
const DEFAULT_MAX_TOKENS = 16000 // when the caller sets no limit

// The SDK keeps its own connection pool, so the client is made once per provider and the provider once per app
export class ClaudeProvider extends LlmProvider {
    protected readonly name = "Claude"
    private readonly client: Anthropic

    constructor(
        apiKey: string,
        private readonly model: string,
    ) {
        super()
        this.client = new Anthropic({ apiKey, maxRetries: 0 })
    }

    async complete(
        request: CompleteRequest,
        opts: { signal: AbortSignal },
    ): Promise<CompleteResponse> {
        const message = await this.create(
            {
                model: this.model,
                max_tokens: maxTokens(request.maxOutputTokens),
                system: request.system,
                messages: [{ role: "user", content: request.user }],
                output_config: {
                    effort: EFFORT,
                    ...(request.responseSchema && {
                        format: {
                            type: "json_schema",
                            schema: request.responseSchema,
                        },
                    }),
                },
            },
            opts.signal,
        )

        return {
            // Refused or empty: pass the raw reply on, so it fails validation and is logged verbatim
            text: replyText(message) || JSON.stringify(message),
            usage: usageOf(message),
        }
    }

    async chat(
        request: ChatRequest,
        opts: { signal: AbortSignal },
    ): Promise<ChatResponse> {
        const message = await this.create(
            {
                model: this.model,
                max_tokens: maxTokens(request.maxOutputTokens),
                system: request.system,
                messages: request.messages.map(toMessageParam),
                tools: request.tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    input_schema: {
                        type: "object" as const,
                        ...tool.parameters,
                    },
                })),
                tool_choice: { type: "auto" }, // the model may answer without a tool, e.g. to decline
                output_config: { effort: EFFORT },
            },
            opts.signal,
        )
        const uses = message.content.filter(
            (block) => block.type === "tool_use",
        )
        const calls: ToolCall[] = uses.map((block, i) => ({
            id: block.id,
            name: block.name,
            args: block.input,
            // The whole assistant turn (thinking blocks included) must go back unchanged
            signature: i === 0 ? JSON.stringify(message.content) : undefined,
        }))

        return {
            // Refused or empty: an empty answer fails validation and the raw reply is logged
            reply:
                calls.length > 0
                    ? { kind: "tool_calls", calls }
                    : { kind: "text", text: replyText(message) },
            raw: JSON.stringify(message),
            usage: usageOf(message),
        }
    }

    private create(
        body: Anthropic.MessageCreateParamsNonStreaming,
        signal: AbortSignal,
    ): Promise<Anthropic.Message> {
        return this.send(signal, () =>
            this.client.messages.create(body, { signal }),
        )
    }

    protected isUnavailable(error: unknown): boolean {
        return (
            error instanceof Anthropic.APIConnectionError ||
            (error instanceof Anthropic.APIError &&
                isUnavailableStatus(error.status ?? 0))
        )
    }
}

function maxTokens(maxOutputTokens: number | undefined): number {
    return maxOutputTokens
        ? maxOutputTokens + THINKING_HEADROOM_TOKENS
        : DEFAULT_MAX_TOKENS
}

// Our message format to Claude's: tool results go back as one user turn
function toMessageParam(message: AgentMessage): Anthropic.MessageParam {
    if (message.role === "user") {
        return { role: "user", content: message.text }
    }

    if (message.role === "model") {
        const saved = message.calls[0]?.signature

        return {
            role: "assistant",
            content: saved
                ? (JSON.parse(saved) as Anthropic.ContentBlockParam[])
                : message.calls.map(({ id, name, args }) => ({
                      type: "tool_use" as const,
                      id,
                      name,
                      input: args,
                  })),
        }
    }

    return {
        role: "user",
        content: message.results.map(({ id, result }) => ({
            type: "tool_result" as const,
            tool_use_id: id,
            content: JSON.stringify(result),
        })),
    }
}

// The answer text, without thinking blocks
function replyText(message: Anthropic.Message): string {
    return message.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
}

function usageOf(message: Anthropic.Message): LlmUsage {
    return {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
    }
}
