export type LlmRequest = {
    system: string // instructions
    user: string // the notes
}

export type LlmResponse = {
    text: string
    usage?: { inputTokens?: number; outputTokens?: number }
}

// Providers only make the HTTP call. Prompt, parsing, validation and the timeout live in LlmIntegrationService.
export interface LlmProvider {
    complete(
        request: LlmRequest,
        opts: { signal: AbortSignal },
    ): Promise<LlmResponse>
}

export type ExtractedItem = { text: string }

export type Extraction = {
    title?: string // a valid model-suggested title, if there was one
    items: ExtractedItem[] // may be empty: deciding what that means is the caller's job
}

export type FailureReason =
    | "timeout"
    | "provider_unavailable"
    | "provider_bad_output"
    | "provider_error" // anything else, such as a bad API key
    | "not_json"
    | "schema_mismatch"
    | "prose"

// Never throws: the caller logs the outcome (including the raw response) and decides the error
export type ExtractionResult =
    | { ok: true; extraction: Extraction; response: LlmResponse }
    | {
          ok: false
          reason: FailureReason
          response?: LlmResponse // missing when the call failed before a reply
          cause?: unknown // the provider error, for the log only
      }
