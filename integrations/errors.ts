// Providers map their own failures to these, so API error codes never change when swapping providers

export class LlmTimeoutError extends Error {
    constructor(message = "LLM call timed out", options?: ErrorOptions) {
        super(message, options)
        this.name = "LlmTimeoutError"
    }
}

// Provider 5xx, network error or provider 429
export class LlmUnavailableError extends Error {
    constructor(message = "LLM provider unavailable", options?: ErrorOptions) {
        super(message, options)
        this.name = "LlmUnavailableError"
    }
}

// The provider answered but gave nothing usable (for example blocked or empty)
export class LlmBadOutputError extends Error {
    constructor(
        message = "LLM returned no usable output",
        options?: ErrorOptions,
    ) {
        super(message, options)
        this.name = "LlmBadOutputError"
    }
}
