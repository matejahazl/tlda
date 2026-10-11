// Providers map provider 5xx, network errors and 429 to this, so API error codes never change when swapping providers
export class LlmUnavailableError extends Error {
    constructor(message = "LLM provider unavailable", options?: ErrorOptions) {
        super(message, options)
        this.name = "LlmUnavailableError"
    }
}
