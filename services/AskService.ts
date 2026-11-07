import "server-only"
import type { LlmIntegrationService } from "@/integrations"
import { AppError } from "@/lib/errors"
import { LLM_FAILURE_CODES } from "@/lib/server/errors"
import type { AskAnswer } from "@/types"

export class AskService {
    constructor(private readonly llm: LlmIntegrationService) {}

    // shortcut: no ask event log yet, it comes in build step 13
    async ask(question: string): Promise<AskAnswer> {
        const result = await this.llm.runAgent({ question })
        if (!result.ok) {
            throw new AppError(LLM_FAILURE_CODES[result.reason], {
                cause: result.cause,
            })
        }
        return { answer: result.answer, sources: result.sources }
    }
}
