import { describe, expect, it } from "vitest"
import { parseEnv } from "@/lib/server/env"

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
    it("names LLM_API_KEY when it is missing for a real provider", () => {
        const message = messageFor({
            LLM_PROVIDER: "gemini",
            LLM_MODEL: "m",
            LLM_API_KEY: "",
        })
        expect(message).toContain("LLM_API_KEY")
    })

    it("names a missing LLM_MODEL without printing the key", () => {
        const message = messageFor({
            LLM_PROVIDER: "gemini",
            LLM_API_KEY: SECRET,
        })
        expect(message).toContain("LLM_MODEL")
        expect(message).not.toContain(SECRET)
    })
})
