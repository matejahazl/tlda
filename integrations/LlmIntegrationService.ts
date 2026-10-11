import "server-only"
import { LlmUnavailableError } from "./errors"
import { parseLlmOutput } from "./parseOutput"
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt"
import type {
    ExtractionResult,
    FailureReason,
    LlmProvider,
    LlmResponse,
} from "./types"

const LLM_TIMEOUT_MS = 30_000

export class LlmIntegrationService {
    constructor(
        private readonly provider: LlmProvider,
        readonly info: { provider: string; model: string },
    ) {}

    async extract(notes: string): Promise<ExtractionResult> {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

        let response: LlmResponse
        try {
            response = await this.provider.complete(
                { system: SYSTEM_PROMPT, user: buildUserMessage(notes) },
                { signal: controller.signal },
            )
        } catch (error) {
            return {
                ok: false,
                reason: providerFailureReason(error, controller.signal.aborted),
                cause: error,
            }
        } finally {
            clearTimeout(timer)
        }

        const parsed = parseLlmOutput(response.text)
        return parsed.ok
            ? { ok: true, extraction: parsed.value, response }
            : { ok: false, reason: parsed.reason, response }
    }
}

function providerFailureReason(
    error: unknown,
    timedOut: boolean,
): FailureReason {
    if (timedOut) {
        return "timeout"
    }
    return error instanceof LlmUnavailableError
        ? "provider_unavailable"
        : "provider_error"
}
