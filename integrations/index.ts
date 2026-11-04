import "server-only"
import { type Env, env } from "@/lib/server/env"
import { LlmIntegrationService } from "./LlmIntegrationService"
import { GeminiProvider } from "./providers/GeminiProvider"
import { MockProvider } from "./providers/MockProvider"
import type { LlmProvider } from "./types"

export {
    LlmIntegrationService,
    LlmUnavailableError,
} from "./LlmIntegrationService"
export { GeminiProvider } from "./providers/GeminiProvider"
export { MockProvider } from "./providers/MockProvider"
export * from "./types"

const PROVIDER_FACTORIES: Record<Env["LLM_PROVIDER"], () => LlmProvider> = {
    mock: () => new MockProvider(),
    gemini: () => new GeminiProvider(env.LLM_API_KEY!, env.LLM_MODEL!),
}

export function getLlmIntegrationService(): LlmIntegrationService {
    return new LlmIntegrationService(PROVIDER_FACTORIES[env.LLM_PROVIDER](), {
        provider: env.LLM_PROVIDER,
        model: env.LLM_MODEL ?? "mock",
    })
}
