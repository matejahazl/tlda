import { expect, it } from "vitest"
import { createLogger } from "@/lib/server/logger"

it("never writes secrets or auth headers", () => {
    const SECRET = "sk-super-secret-value"
    const lines: string[] = []
    createLogger({ write: (line: string) => lines.push(line) }).info({
        apiKey: SECRET,
        headers: { authorization: `Bearer ${SECRET}`, cookie: SECRET },
        config: { LLM_API_KEY: SECRET },
    })
    expect(lines[0]).not.toContain(SECRET)
    expect(lines[0]).toContain("[redacted]")
})
