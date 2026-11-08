import { afterEach, describe, expect, it, vi } from "vitest"
import { LlmUnavailableError } from "../LlmProvider"
import { GeminiProvider } from "./GeminiProvider"

const TOOL_TURN = {
    candidates: [
        {
            content: {
                role: "model",
                parts: [
                    {
                        functionCall: {
                            name: "search_items",
                            args: { status: "open" },
                        },
                        thoughtSignature: "sig-abc",
                    },
                ],
            },
        },
    ],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
} // no call id (Gemini often omits it) and a thought signature that must go back

function stubFetch(status: number, body: unknown) {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))

        return new Response(JSON.stringify(body), { status })
    })

    return bodies
}

const signal = new AbortController().signal

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("GeminiProvider", () => {
    it("maps tool calls and sends the thought signature back", async () => {
        const bodies = stubFetch(200, TOOL_TURN)
        const provider = new GeminiProvider("key", "gemini-test")
        const request = {
            system: "s",
            messages: [{ role: "user" as const, text: "What's open?" }],
            tools: [
                {
                    name: "search_items",
                    description: "d",
                    parameters: { type: "object", properties: {} },
                },
            ],
        }

        const first = await provider.chat(request, { signal })
        expect(first.reply).toEqual({
            kind: "tool_calls",
            calls: [
                {
                    id: "call-1-0",
                    name: "search_items",
                    args: { status: "open" },
                    signature: "sig-abc",
                },
            ],
        })

        if (first.reply.kind !== "tool_calls") {
            return
        }

        await provider.chat(
            {
                ...request,
                messages: [
                    ...request.messages,
                    { role: "model", calls: first.reply.calls },
                    {
                        role: "tool",
                        results: [
                            {
                                id: "call-1-0",
                                name: "search_items",
                                result: [],
                            },
                        ],
                    },
                ],
            },
            { signal },
        )
        const sent = bodies[1].contents as unknown[]
        expect(sent[1]).toEqual({
            role: "model",
            parts: [
                {
                    functionCall: {
                        id: "call-1-0",
                        name: "search_items",
                        args: { status: "open" },
                    },
                    thoughtSignature: "sig-abc",
                },
            ],
        })
        expect(sent[2]).toEqual({
            role: "user",
            parts: [
                {
                    functionResponse: {
                        id: "call-1-0",
                        name: "search_items",
                        response: { output: [] },
                    },
                },
            ],
        })
    })

    it("turns a 429 into LlmUnavailableError", async () => {
        stubFetch(429, { error: { code: 429, message: "slow down" } })
        const provider = new GeminiProvider("key", "gemini-test")

        await expect(
            provider.complete({ system: "s", user: "u" }, { signal }),
        ).rejects.toBeInstanceOf(LlmUnavailableError)
    })

    it("turns a network failure into LlmUnavailableError", async () => {
        vi.stubGlobal("fetch", async () => {
            throw new TypeError("fetch failed")
        })
        const provider = new GeminiProvider("key", "gemini-test")

        await expect(
            provider.complete({ system: "s", user: "u" }, { signal }),
        ).rejects.toBeInstanceOf(LlmUnavailableError)
    })

    it("lets an abort through unchanged, so it is reported as a timeout", async () => {
        const abort = new DOMException("aborted", "AbortError")
        const controller = new AbortController()
        controller.abort(abort)
        vi.stubGlobal("fetch", async () => {
            throw abort
        })
        const provider = new GeminiProvider("key", "gemini-test")

        await expect(
            provider.complete(
                { system: "s", user: "u" },
                { signal: controller.signal },
            ),
        ).rejects.toBe(abort)
    })
})
