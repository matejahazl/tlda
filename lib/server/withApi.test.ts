import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as LoggerModule from "@/lib/server/logger"
import { logger } from "@/lib/server/logger"
import { withApi } from "@/lib/server/withApi"

const logs = vi.hoisted(() => [] as Record<string, unknown>[])

vi.mock("@/lib/server/logger", async () => {
    const actual = await vi.importActual<typeof LoggerModule>(
        "@/lib/server/logger",
    )
    return {
        ...actual,
        logger: actual.createLogger({
            write: (line: string) => logs.push(JSON.parse(line)),
        }),
    }
})

const SECRET = "sk-super-secret-value"

const completion = () => logs.find((l) => l.msg === "request completed")

beforeEach(() => {
    logs.length = 0
})

describe("withApi", () => {
    it("maps unexpected errors to INTERNAL without leaking details", async () => {
        const route = withApi("/api/x", async () => {
            throw new Error(`db exploded ${SECRET}`)
        })
        const res = await route(new Request("http://localhost/"))
        const text = await res.text()

        expect(res.status).toBe(500)
        expect(text).toContain("INTERNAL")
        expect(text).not.toContain("db exploded")
        expect(text).not.toContain("stack")
        expect(completion()).toMatchObject({
            level: 50,
            errorCode: "INTERNAL",
            outcome: "error",
        })
        expect(completion()?.err).toBeDefined()
    })
})

describe("logger redaction", () => {
    it("never writes secrets or auth headers", () => {
        logger.info(
            {
                apiKey: SECRET,
                headers: { authorization: `Bearer ${SECRET}`, cookie: SECRET },
                config: { LLM_API_KEY: SECRET },
            },
            "check",
        )
        const line = JSON.stringify(logs.at(-1))
        expect(line).not.toContain(SECRET)
        expect(line).toContain("[redacted]")
    })
})
