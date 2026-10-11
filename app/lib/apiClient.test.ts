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
})
