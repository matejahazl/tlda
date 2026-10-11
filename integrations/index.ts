import "server-only"
import { type Env, env } from "@/lib/server/env"
import { LlmIntegrationService } from "./LlmIntegrationService"
import { MockProvider } from "./providers/MockProvider"
import type { LlmProvider } from "./types"

export * from "./errors"
export { LlmIntegrationService } from "./LlmIntegrationService"
export { MockProvider } from "./providers/MockProvider"
export * from "./types"

const PROVIDER_FACTORIES: Record<Env["LLM_PROVIDER"], () => LlmProvider> = {
    mock: () => new MockProvider(),
    gemini: () => {
        throw new Error("The gemini provider is not implemented yet")
    },
    "openai-compatible": () => {
        throw new Error("The openai-compatible provider is not implemented yet")
    },
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
