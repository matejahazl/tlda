import { describe, expect, it } from "vitest"
import { parseEnv } from "@/lib/env"

const SECRET = "sk-super-secret-value"

function messageFor(source: Record<string, string | undefined>) {
    try {
        parseEnv(source)
    } catch (error) {
        return (error as Error).message
    }
    return ""
}

describe("parseEnv", () => {
    it("accepts the mock provider with nothing else", () => {
        expect(parseEnv({ LLM_PROVIDER: "mock" })).toMatchObject({
            LLM_PROVIDER: "mock",
            LOG_LEVEL: "info",
        })
    })

    it("names LLM_API_KEY when it is missing for a real provider", () => {
        const message = messageFor({ LLM_PROVIDER: "gemini", LLM_MODEL: "m" })
        expect(message).toContain("LLM_API_KEY")
    })

    it("treats an empty value as missing", () => {
        const message = messageFor({
            LLM_PROVIDER: "gemini",
            LLM_MODEL: "m",
            LLM_API_KEY: "",
        })
        expect(message).toContain("LLM_API_KEY")
    })

    it("names LLM_BASE_URL when it is missing for openai-compatible", () => {
        const message = messageFor({
            LLM_PROVIDER: "openai-compatible",
            LLM_MODEL: "m",
            LLM_API_KEY: SECRET,
        })
        expect(message).toContain("LLM_BASE_URL")
        expect(message).not.toContain(SECRET)
    })

    it("names an invalid provider and never prints the key", () => {
        const message = messageFor({
            LLM_PROVIDER: "nope",
            LLM_API_KEY: SECRET,
        })
        expect(message).toContain("LLM_PROVIDER")
        expect(message).not.toContain(SECRET)
    })
})
