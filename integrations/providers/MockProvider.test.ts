import { describe, expect, it } from "vitest"
import type { ChatRequest } from "../types"
import { MockProvider } from "./MockProvider"

const REQUEST: ChatRequest = {
    system: "",
    messages: [{ role: "user", text: "What's open?" }],
    tools: [],
}
const OPTS = { signal: new AbortController().signal }

describe("MockProvider.chat", () => {
    it("returns the scripted replies in order, then fails when they run out", async () => {
        const provider = new MockProvider(undefined, [
            {
                kind: "tool_calls",
                calls: [{ id: "1", name: "list_meetings", args: {} }],
            },
            (request) => ({
                kind: "text",
                text: `got ${request.messages.length}`,
            }),
        ])

        expect((await provider.chat(REQUEST, OPTS)).reply.kind).toBe(
            "tool_calls",
        )
        const last = await provider.chat(REQUEST, OPTS)
        expect(last).toEqual({
            reply: { kind: "text", text: "got 1" },
            raw: JSON.stringify({ kind: "text", text: "got 1" }),
        })
        await expect(provider.chat(REQUEST, OPTS)).rejects.toThrow(
            "no scripted reply",
        )
    })

    it("without a script, calls a tool first and answers after the tool results", async () => {
        const provider = new MockProvider()

        expect((await provider.chat(REQUEST, OPTS)).reply.kind).toBe(
            "tool_calls",
        )
        const afterTools = await provider.chat(
            {
                ...REQUEST,
                messages: [
                    ...REQUEST.messages,
                    {
                        role: "tool",
                        results: [
                            { id: "mock-1", name: "search_items", result: {} },
                        ],
                    },
                ],
            },
            OPTS,
        )
        expect(afterTools.reply.kind).toBe("text")
    })
})
