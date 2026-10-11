import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppError } from "@/lib/errors"
import type * as LoggerModule from "@/lib/server/logger"
import { logger } from "@/lib/server/logger"
import { readJson } from "@/lib/server/validate"
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

function post(body: BodyInit, headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/x", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body,
    })
}

beforeEach(() => {
    logs.length = 0
})

describe("withApi", () => {
    it("returns the body and logs a success completion", async () => {
        const route = withApi("/api/x", async (_req, ctx) => {
            ctx.addLogFields({ meetingId: 7 })
            return { status: 201, body: { ok: true } }
        })
        const res = await route(new Request("http://localhost/api/x"))

        expect(res.status).toBe(201)
        expect(await res.json()).toEqual({ ok: true })
        expect(completion()).toMatchObject({
            level: 30,
            requestId: res.headers.get("x-request-id"),
            method: "GET",
            route: "/api/x",
            status: 201,
            outcome: "success",
            meetingId: 7,
        })
        expect(typeof completion()?.durationMs).toBe("number")
        expect(logs.some((l) => l.msg === "request started")).toBe(true)
    })

    it("reuses a safe x-request-id and replaces an unsafe one", async () => {
        const route = withApi("/api/x", async () => ({ body: {} }))
        const kept = await route(
            new Request("http://localhost/", {
                headers: { "x-request-id": "abc-123" },
            }),
        )
        const replaced = await route(
            new Request("http://localhost/", {
                headers: { "x-request-id": "bad id with spaces" },
            }),
        )
        expect(kept.headers.get("x-request-id")).toBe("abc-123")
        expect(replaced.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/)
    })

    it("turns an AppError into the envelope and a warn log with issue paths only", async () => {
        const route = withApi("/api/items/:id", async () => {
            throw new AppError("VALIDATION_ERROR", {
                fields: { notes: "secret-value-in-message" },
            })
        })
        const res = await route(new Request("http://localhost/"))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error).toMatchObject({
            code: "VALIDATION_ERROR",
            fields: { notes: "secret-value-in-message" },
            requestId: res.headers.get("x-request-id"),
        })
        expect(completion()).toMatchObject({
            level: 40,
            outcome: "error",
            errorCode: "VALIDATION_ERROR",
            status: 400,
            issuePaths: ["notes"],
        })
        expect(JSON.stringify(completion())).not.toContain("secret-value")
    })

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

    it("logs expected failures as warn and provider failures as error", async () => {
        for (const [code, level] of [
            ["LLM_BAD_OUTPUT", 40],
            ["LLM_TIMEOUT", 50],
        ] as const) {
            logs.length = 0
            const route = withApi("/api/x", async () => {
                throw new AppError(code)
            })
            await route(new Request("http://localhost/"))
            expect(completion()?.level).toBe(level)
        }
    })

    it("passes route params to the handler", async () => {
        const route = withApi<{ id: string }>(
            "/api/items/:id",
            async (_r, ctx) => ({
                body: { id: ctx.params.id },
            }),
        )
        const res = await route(new Request("http://localhost/"), {
            params: Promise.resolve({ id: "5" }),
        })
        expect(await res.json()).toEqual({ id: "5" })
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

describe("readJson", () => {
    it("parses valid JSON", async () => {
        expect(await readJson(post('{"a":1}'))).toEqual({ a: 1 })
    })

    it("accepts a charset parameter", async () => {
        const req = post("{}", {
            "content-type": "application/json; charset=utf-8",
        })
        expect(await readJson(req)).toEqual({})
    })

    it("rejects a wrong or missing content type", async () => {
        for (const type of ["text/plain", "application/jsonx", ""]) {
            const req = post("{}", { "content-type": type })
            await expect(readJson(req)).rejects.toMatchObject({
                code: "VALIDATION_ERROR",
            })
        }
    })

    it("rejects malformed JSON with 400", async () => {
        await expect(readJson(post("{nope"))).rejects.toMatchObject({
            code: "VALIDATION_ERROR",
        })
    })

    it("rejects an oversized body with PAYLOAD_TOO_LARGE", async () => {
        const big = JSON.stringify({ notes: "a".repeat(200 * 1024) })
        await expect(readJson(post(big))).rejects.toMatchObject({
            code: "PAYLOAD_TOO_LARGE",
        })
    })
})
