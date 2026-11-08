import "server-only"
import type {
    ChatRequest,
    ChatResponse,
    CompleteRequest,
    CompleteResponse,
} from "./types"

// Map provider 5xx, network errors and 429 to this, for consistent API error codes across providers
export class LlmUnavailableError extends Error {
    constructor(message = "LLM provider unavailable", options?: ErrorOptions) {
        super(message, options)
        this.name = "LlmUnavailableError"
    }
}

export function isUnavailableStatus(status: number): boolean {
    return status === 429 || status >= 500
}

// Providers only make the HTTP call. Prompt, parsing, validation and the timeout live in LlmIntegrationService.
export abstract class LlmProvider {
    protected abstract readonly name: string

    abstract complete(
        request: CompleteRequest,
        opts: { signal: AbortSignal },
    ): Promise<CompleteResponse>

    // one turn of a tool-using conversation (used by the ask agent only)
    abstract chat(
        request: ChatRequest,
        opts: { signal: AbortSignal },
    ): Promise<ChatResponse>

    // The shared failure rule:
    // Abort => unchanged, LlmIntegrationService reports a timeout
    // Provider trouble => LlmUnavailableError
    // Anything else => rethrown as is (internal)
    protected async send<T>(
        signal: AbortSignal,
        call: () => Promise<T>,
    ): Promise<T> {
        try {
            return await call()
        } catch (error) {
            if (signal.aborted) {
                throw error
            }

            if (this.isUnavailable(error)) {
                throw new LlmUnavailableError(`${this.name} is unavailable`, {
                    cause: error,
                })
            }

            throw error
        }
    }

    // A network error, 429 or 5xx, in provider's own error types
    protected isUnavailable(_error: unknown): boolean {
        return false
    }
}
