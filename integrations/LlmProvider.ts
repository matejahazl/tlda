import "server-only"
import type {
    ChatRequest,
    ChatResponse,
    CompleteRequest,
    CompleteResponse,
} from "./types"

// Providers only make the HTTP call. Prompt, parsing, validation and the timeout live in LlmIntegrationService.
export abstract class LlmProvider {
    abstract complete(
        request: CompleteRequest,
        opts: { signal: AbortSignal },
    ): Promise<CompleteResponse>

    // one turn of a tool-using conversation (used by the ask agent only)
    abstract chat(
        request: ChatRequest,
        opts: { signal: AbortSignal },
    ): Promise<ChatResponse>
}
