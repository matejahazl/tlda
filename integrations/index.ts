import "server-only"
import { type Env, env } from "@/lib/server/env"
import { LlmIntegrationService } from "./LlmIntegrationService"
import type { LlmProvider } from "./LlmProvider"
import { ClaudeProvider } from "./providers/ClaudeProvider"
import { GeminiProvider } from "./providers/GeminiProvider"
import { MockProvider } from "./providers/MockProvider"

export { LlmIntegrationService } from "./LlmIntegrationService"
export { LlmProvider, LlmUnavailableError } from "./LlmProvider"
export { ClaudeProvider } from "./providers/ClaudeProvider"
export { GeminiProvider } from "./providers/GeminiProvider"
export { MockProvider } from "./providers/MockProvider"
export * from "./types"

// The SDK clients hold a connection pool, so each provider is built once
let claudeProvider: ClaudeProvider | undefined
let geminiProvider: GeminiProvider | undefined

const PROVIDER_FACTORIES: Record<Env["LLM_PROVIDER"], () => LlmProvider> = {
    mock: () => new MockProvider(),
    gemini: () =>
        (geminiProvider ??= new GeminiProvider(
            env.LLM_API_KEY!,
            env.LLM_MODEL!,
        )),
    claude: () =>
        (claudeProvider ??= new ClaudeProvider(
            env.LLM_API_KEY!,
            env.LLM_MODEL!,
        )),
}

export function getLlmIntegrationService(): LlmIntegrationService {
    return new LlmIntegrationService(PROVIDER_FACTORIES[env.LLM_PROVIDER](), {
        provider: env.LLM_PROVIDER,
        model: env.LLM_MODEL ?? "mock",
    })
}
