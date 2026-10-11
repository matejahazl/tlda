import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError, apiFetch } from "@/app/lib/apiClient"

const GENERIC = "Something went wrong on our side. Please try again."

function mockFetch(response: Response | Error) {
    const fetchMock = vi.fn(async () => {
        if (response instanceof Error) {
            throw response
        }
        return response
    })
    vi.stubGlobal("fetch", fetchMock)
    return fetchMock
}

async function failure(promise: Promise<unknown>) {
    return promise.then(
        () => undefined,
        (error: unknown) => error,
    )
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("apiFetch", () => {
    it("returns parsed JSON and sends no-store and a JSON body", async () => {
        const fetchMock = mockFetch(Response.json({ ok: 1 }))
        const result = await apiFetch("/api/x", {
            method: "POST",
            body: { a: 1 },
        })

        expect(result).toEqual({ ok: 1 })
        expect(fetchMock).toHaveBeenCalledWith("/api/x", {
            method: "POST",
            cache: "no-store",
            signal: undefined,
            headers: { "content-type": "application/json" },
            body: '{"a":1}',
        })
    })

    it("turns the server error envelope into an ApiError", async () => {
        mockFetch(
            Response.json(
                {
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Please check the highlighted fields.",
                        fields: { notes: "Add a bit more detail" },
                        requestId: "req-1",
                    },
                },
                { status: 400 },
            ),
        )
        const error = await failure(apiFetch("/api/x"))

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({
            code: "VALIDATION_ERROR",
            message: "Please check the highlighted fields.",
            fields: { notes: "Add a bit more detail" },
            requestId: "req-1",
        })
    })

    it.each([
        [
            "an HTML error page",
            new Response("<html>boom</html>", { status: 500 }),
        ],
        [
            "JSON that is not our envelope",
            Response.json({ error: "x" }, { status: 500 }),
        ],
        [
            "an unknown error code",
            Response.json(
                { error: { code: "NOPE", message: "m" } },
                { status: 500 },
            ),
        ],
        ["a network failure", new TypeError("Failed to fetch")],
    ])(
        "falls back to the generic INTERNAL error for %s",
        async (_label, response) => {
            mockFetch(response)
            const error = await failure(apiFetch("/api/x"))

            expect(error).toBeInstanceOf(ApiError)
            expect(error).toMatchObject({ code: "INTERNAL", message: GENERIC })
        },
    )

    it("falls back to INTERNAL when a success response is not JSON", async () => {
        mockFetch(new Response("not json"))
        expect(await failure(apiFetch("/api/x"))).toMatchObject({
            code: "INTERNAL",
        })
    })

    it("rethrows the abort instead of reporting a failure", async () => {
        const controller = new AbortController()
        const abort = new DOMException("aborted", "AbortError")
        mockFetch(abort)
        controller.abort()

        expect(
            await failure(apiFetch("/api/x", { signal: controller.signal })),
        ).toBe(abort)
    })
})
