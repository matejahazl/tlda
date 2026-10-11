import "server-only"
import { type Env, env } from "@/lib/server/env"
import { LlmIntegrationService } from "./LlmIntegrationService"
import { GeminiProvider } from "./providers/GeminiProvider"
import { MockProvider } from "./providers/MockProvider"
import type { LlmProvider } from "./types"

export * from "./errors"
export { LlmIntegrationService } from "./LlmIntegrationService"
export { GeminiProvider } from "./providers/GeminiProvider"
export { MockProvider } from "./providers/MockProvider"
export * from "./types"

const PROVIDER_FACTORIES: Record<Env["LLM_PROVIDER"], () => LlmProvider> = {
    mock: () => new MockProvider(),
    gemini: () => new GeminiProvider(env.LLM_API_KEY!, env.LLM_MODEL!),
}

const globalForLlm = globalThis as typeof globalThis & {
    __llm?: LlmIntegrationService
}

// One service (and one provider client) per process, reused across requests
export function getLlmIntegrationService(): LlmIntegrationService {
    return (globalForLlm.__llm ??= new LlmIntegrationService(
        PROVIDER_FACTORIES[env.LLM_PROVIDER](),
        { provider: env.LLM_PROVIDER, model: env.LLM_MODEL ?? "mock" },
    ))
}
