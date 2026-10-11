import { afterEach, describe, expect, it, vi } from "vitest"
import { LlmBadOutputError, LlmUnavailableError } from "../errors"
import { GeminiProvider } from "./GeminiProvider"

const REQUEST = { system: "sys", user: "notes" }
const provider = new GeminiProvider("secret-key", "test-model")

function mockFetch(response: Response | Error) {
    const fn = vi.fn(async () => {
        if (response instanceof Error) {
            throw response
        }
        return response
    })
    vi.stubGlobal("fetch", fn)
    return fn
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status })

afterEach(() => vi.unstubAllGlobals())

describe("GeminiProvider", () => {
    it.each([429, 500, 503])("maps HTTP %i to unavailable", async (status) => {
        mockFetch(json({ error: { message: "x" } }, status))
        await expect(
            provider.complete(REQUEST, {
                signal: new AbortController().signal,
            }),
        ).rejects.toBeInstanceOf(LlmUnavailableError)
    })

    it("maps a network error to unavailable", async () => {
        mockFetch(new TypeError("fetch failed"))
        await expect(
            provider.complete(REQUEST, {
                signal: new AbortController().signal,
            }),
        ).rejects.toBeInstanceOf(LlmUnavailableError)
    })

    it("treats a bad key (403) as a plain error, not unavailable", async () => {
        mockFetch(json({ error: { message: "API key not valid" } }, 403))
        const error = await provider
            .complete(REQUEST, { signal: new AbortController().signal })
            .catch((e: unknown) => e)
        expect(error).toBeInstanceOf(Error)
        expect(error).not.toBeInstanceOf(LlmUnavailableError)
        expect((error as Error).message).not.toContain("secret-key")
    })

    it("maps a blocked or empty reply to bad output", async () => {
        mockFetch(json({ promptFeedback: { blockReason: "SAFETY" } }))
        await expect(
            provider.complete(REQUEST, {
                signal: new AbortController().signal,
            }),
        ).rejects.toBeInstanceOf(LlmBadOutputError)
    })
})
