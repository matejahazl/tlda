import { describe, expect, it } from "vitest"
import { LlmUnavailableError } from "../LlmIntegrationService"
import { ClaudeProvider } from "./ClaudeProvider"

const TOOL_TURN = {
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

function fakeFetch(status: number, body: unknown) {
    const bodies: Record<string, unknown>[] = []
    const fetchFn = (async (_url: unknown, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))

        return new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json" },
        })
    }) as typeof fetch

    return { fetchFn, bodies }
}

const signal = new AbortController().signal

describe("ClaudeProvider", () => {
    it("maps tool calls and replays the assistant turn unchanged", async () => {
        const { fetchFn, bodies } = fakeFetch(200, TOOL_TURN)
        const provider = new ClaudeProvider("key", "claude-test", {
            fetch: fetchFn,
        })
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
        expect(first.reply.kind).toBe("tool_calls")

        if (first.reply.kind !== "tool_calls") {
            return
        }

        expect(first.reply.calls[0]).toMatchObject({
            id: "toolu_1",
            name: "search_items",
            args: { status: "open" },
        })

        await provider.chat(
            {
                ...request,
                messages: [
                    ...request.messages,
                    { role: "model", calls: first.reply.calls },
                    {
                        role: "tool",
                        results: [
                            { id: "toolu_1", name: "search_items", result: [] },
                        ],
                    },
                ],
            },
            { signal },
        )
        const sent = bodies[1].messages as {
            role: string
            content: unknown
        }[]
        expect(sent[1]).toEqual({
            role: "assistant",
            content: TOOL_TURN.content,
        })
        expect(sent[2]).toEqual({
            role: "user",
            content: [
                { type: "tool_result", tool_use_id: "toolu_1", content: "[]" },
            ],
        })
    })

    it("turns a 429 into LlmUnavailableError", async () => {
        const { fetchFn } = fakeFetch(429, {
            type: "error",
            error: { type: "rate_limit_error", message: "slow down" },
        })
        const provider = new ClaudeProvider("key", "claude-test", {
            fetch: fetchFn,
        })

        await expect(
            provider.complete({ system: "s", user: "u" }, { signal }),
        ).rejects.toBeInstanceOf(LlmUnavailableError)
    })
})
