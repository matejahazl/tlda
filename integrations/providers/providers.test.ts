import { afterEach, describe, expect, it, vi } from "vitest"
import { ClaudeProvider } from "./ClaudeProvider"
import { GeminiProvider } from "./GeminiProvider"
import { LlmUnavailableError } from "./LlmProvider"
import type { ChatRequest } from "./types"

const CLAUDE_TOOL_TURN = {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-test",
    content: [
        { type: "thinking", thinking: "", signature: "sig-abc" },
        {
            type: "tool_use",
            id: "toolu_1",
            name: "search_items",
            input: { status: "open" },
        },
    ],
    stop_reason: "tool_use",
    usage: { input_tokens: 10, output_tokens: 5 },
} // a thinking block before the call, which must be sent back unchanged

const GEMINI_TOOL_TURN = {
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

const REQUEST: ChatRequest = {
    system: "s",
    messages: [{ role: "user", text: "What's open?" }],
    tools: [
        {
            name: "search_items",
            description: "d",
            parameters: { type: "object", properties: {} },
        },
    ],
} // one user question with one tool

const PROVIDERS = [
    {
        name: "Claude",
        create: () => new ClaudeProvider("key", "claude-test"),
        rateLimitBody: {
            type: "error",
            error: { type: "rate_limit_error", message: "slow down" },
        },
    },
    {
        name: "Gemini",
        create: () => new GeminiProvider("key", "gemini-test"),
        rateLimitBody: { error: { code: 429, message: "slow down" } },
    },
] // the shared send() failure rule must hold for every provider

const signal = new AbortController().signal

function stubFetch(status: number, body: unknown) {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))

        return new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
        })
    })

    return bodies
}

// Runs the first turn, then a second turn replaying the calls with an empty result
async function roundTrip(
    create: () => ClaudeProvider | GeminiProvider,
    toolTurn: unknown,
) {
    const bodies = stubFetch(200, toolTurn)
    const provider = create() // after the stub: the Anthropic SDK captures fetch when the client is built
    const first = await provider.chat(REQUEST, { signal })

    if (first.reply.kind !== "tool_calls") {
        throw new Error("expected tool calls")
    }

    const [call] = first.reply.calls
    await provider.chat(
        {
            ...REQUEST,
            messages: [
                ...REQUEST.messages,
                { role: "model", calls: first.reply.calls },
                {
                    role: "tool",
                    results: [{ id: call.id, name: call.name, result: [] }],
                },
            ],
        },
        { signal },
    )

    return { calls: first.reply.calls, second: bodies[1] }
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("ClaudeProvider", () => {
    it("maps tool calls and replays the assistant turn unchanged", async () => {
        const { calls, second } = await roundTrip(
            () => new ClaudeProvider("key", "claude-test"),
            CLAUDE_TOOL_TURN,
        )

        expect(calls[0]).toMatchObject({
            id: "toolu_1",
            name: "search_items",
            args: { status: "open" },
        })
        const sent = second.messages as unknown[]
        expect(sent[1]).toEqual({
            role: "assistant",
            content: CLAUDE_TOOL_TURN.content,
        })
        expect(sent[2]).toEqual({
            role: "user",
            content: [
                { type: "tool_result", tool_use_id: "toolu_1", content: "[]" },
            ],
        })
    })
})

describe("GeminiProvider", () => {
    it("maps tool calls and sends the thought signature back", async () => {
        const { calls, second } = await roundTrip(
            () => new GeminiProvider("key", "gemini-test"),
            GEMINI_TOOL_TURN,
        )

        expect(calls).toEqual([
            {
                id: "call-1-0",
                name: "search_items",
                args: { status: "open" },
                signature: "sig-abc",
            },
        ])
        const sent = second.contents as unknown[]
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

    it("keeps a TypeError that isn't a network failure as an internal error", async () => {
        vi.stubGlobal("fetch", async () => {
            throw new TypeError("Cannot read properties of undefined")
        })

        await expect(
            new GeminiProvider("key", "gemini-test").complete(
                { system: "s", user: "u" },
                { signal },
            ),
        ).rejects.not.toBeInstanceOf(LlmUnavailableError)
    })
})

describe.each(PROVIDERS)("$name failures", ({ create, rateLimitBody }) => {
    it("turns a 429 into LlmUnavailableError", async () => {
        stubFetch(429, rateLimitBody)

        await expect(
            create().complete({ system: "s", user: "u" }, { signal }),
        ).rejects.toBeInstanceOf(LlmUnavailableError)
    })

    it.each(["fetch failed", "terminated"])(
        "turns a network failure (%s) into LlmUnavailableError",
        async (message) => {
            vi.stubGlobal("fetch", async () => {
                throw new TypeError(message)
            })

            await expect(
                create().complete({ system: "s", user: "u" }, { signal }),
            ).rejects.toBeInstanceOf(LlmUnavailableError)
        },
    )

    it("lets an abort through, so it is reported as a timeout", async () => {
        const controller = new AbortController()
        controller.abort()
        vi.stubGlobal("fetch", async () => {
            throw new DOMException("aborted", "AbortError")
        })

        // The SDK may wrap the abort in its own error; it must just not become "unavailable"
        await expect(
            create().complete(
                { system: "s", user: "u" },
                { signal: controller.signal },
            ),
        ).rejects.not.toBeInstanceOf(LlmUnavailableError)
    })
})
