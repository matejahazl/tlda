import "server-only"
import { LlmUnavailableError } from "../errors"
import type { LlmProvider, LlmRequest, LlmResponse } from "../types"

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models" // Gemini REST endpoint
const MAX_OUTPUT_TOKENS = 600 // the reply is a short JSON list
const TEMPERATURE = 0.1 // near-deterministic extraction
const MAX_ERROR_BODY_CHARS = 500 // enough of a provider error to debug from the log

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

type GeminiReply = {
    candidates?: {
        content?: { parts?: { text?: string }[] }
    }[]
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
        let res: Response
        try {
            res = await fetch(`${API_URL}/${this.model}:generateContent`, {
                method: "POST",
                // The key goes in a header, never the URL, so it can't leak into logs
                headers: {
                    "content-type": "application/json",
                    "x-goog-api-key": this.apiKey,
                },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: request.system }] },
                    contents: [
                        { role: "user", parts: [{ text: request.user }] },
                    ],
                    generationConfig: {
                        temperature: TEMPERATURE,
                        maxOutputTokens: MAX_OUTPUT_TOKENS,
                        responseMimeType: "application/json",
                        responseSchema: RESPONSE_SCHEMA,
                        thinkingConfig: { thinkingLevel: "minimal" }, // reasoning is the biggest hidden latency; Gemini 3.x rejects thinkingBudget: 0
                    },
                }),
                signal: opts.signal,
            })
        } catch (error) {
            if (opts.signal.aborted) {
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

        const raw = await res.text()
        const reply = JSON.parse(raw) as GeminiReply
        const text = reply.candidates?.[0]?.content?.parts
            ?.map((part) => part.text ?? "")
            .join("")
        return {
            // Blocked or empty: pass the raw reply on, so it fails validation and is logged verbatim
            text: text || raw,
            usage: {
                inputTokens: reply.usageMetadata?.promptTokenCount,
                outputTokens: reply.usageMetadata?.candidatesTokenCount,
            },
        }
    }
}
