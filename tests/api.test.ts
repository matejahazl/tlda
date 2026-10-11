import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    LlmBadOutputError,
    LlmIntegrationService,
    LlmUnavailableError,
    MockProvider,
} from "@/integrations"
import { createDb, type Db } from "@/lib/server/db"
import { actionItems, meetings } from "@/lib/server/db/schema"
import type * as LoggerModule from "@/lib/server/logger"
import { MeetingService } from "@/services/MeetingService"
import { PATCH } from "../app/api/items/[id]/route"
import { GET, POST } from "../app/api/meetings/route"

type Handler = ConstructorParameters<typeof MockProvider>[0]

const state = vi.hoisted(() => ({
    db: undefined as unknown as Db,
    service: undefined as unknown as MeetingService,
    logs: [] as Record<string, unknown>[],
}))

vi.mock("@/services", () => ({ getMeetingService: () => state.service }))
vi.mock("@/lib/server/logger", async () => {
    const actual = await vi.importActual<typeof LoggerModule>(
        "@/lib/server/logger",
    )
    return {
        ...actual,
        logger: actual.createLogger({
            write: (line: string) => state.logs.push(JSON.parse(line)),
        }),
    }
})

const NOTES =
    "Alice will send the report to Bob by Friday.\nBob will book the room."
const GOOD_REPLY = JSON.stringify({
    title: "Weekly sync",
    items: [{ text: "Send the report to Bob" }, { text: "Book the room" }],
})

function useLlm(handler: Handler) {
    state.service = new MeetingService(
        state.db,
        new LlmIntegrationService(new MockProvider(handler), {
            provider: "mock",
            model: "test-model",
        }),
    )
}

function json(url: string, method: string, body: unknown, headers = {}) {
    return new Request(`http://localhost${url}`, {
        method,
        headers: { "content-type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
    })
}

const postMeeting = (body: unknown) => POST(json("/api/meetings", "POST", body))

const patchItem = (id: string, body: unknown) =>
    PATCH(json(`/api/items/${id}`, "PATCH", body), {
        params: Promise.resolve({ id }),
    })

function rowCounts() {
    return {
        meetings: state.db.select().from(meetings).all().length,
        items: state.db.select().from(actionItems).all().length,
    }
}

const find = (message: string) => state.logs.find((l) => l.msg === message)

beforeEach(() => {
    state.db = createDb(":memory:")
    state.logs.length = 0
    useLlm(() => GOOD_REPLY)
})

afterEach(() => {
    vi.useRealTimers()
})

describe("happy path", () => {
    it("creates a meeting with open items, lists it without notes, changes a status", async () => {
        const created = await postMeeting({ notes: NOTES })
        const meeting = await created.json()

        expect(created.status).toBe(201)
        expect(meeting.title).toBe("Weekly sync")
        expect(meeting.items).toHaveLength(2)
        expect(meeting.items.map((i: { status: string }) => i.status)).toEqual([
            "open",
            "open",
        ])
        expect(meeting).not.toHaveProperty("notes")

        const list = await (
            await GET(new Request("http://localhost/api/meetings"))
        ).json()
        expect(list).toHaveLength(1)
        expect(list[0]).not.toHaveProperty("notes")
        expect(list[0].items[0]).toMatchObject({
            text: "Send the report to Bob",
        })

        const patched = await patchItem(String(meeting.items[0].id), {
            status: "done",
        })
        expect(patched.status).toBe(200)
        expect(await patched.json()).toMatchObject({
            id: meeting.items[0].id,
            status: "done",
        })

        const after = await (
            await GET(new Request("http://localhost/api/meetings"))
        ).json()
        expect(after[0].items[0].status).toBe("done")
        expect(after[0].items[1].status).toBe("open")
    })

    it("lists the newest meeting first", async () => {
        await postMeeting({ title: "First", notes: NOTES })
        await postMeeting({ title: "Second", notes: NOTES })
        const list = await (
            await GET(new Request("http://localhost/api/meetings"))
        ).json()
        expect(list.map((m: { title: string }) => m.title)).toEqual([
            "Second",
            "First",
        ])
    })

    it("ignores a status the model tries to set", async () => {
        useLlm(() =>
            JSON.stringify({ items: [{ text: "Do it", status: "done" }] }),
        )
        const meeting = await (await postMeeting({ notes: NOTES })).json()
        expect(meeting.items[0].status).toBe("open")
    })

    it("logs a success completion and an extraction event with the raw notes", async () => {
        const rawNotes = `  ${NOTES}\u0007  `
        useLlm(() => ({
            text: GOOD_REPLY,
            usage: { inputTokens: 10, outputTokens: 5 },
        }))
        const res = await postMeeting({ notes: rawNotes })

        expect(find("extraction completed")).toMatchObject({
            event: "extraction",
            level: 30,
            provider: "mock",
            model: "test-model",
            outcome: "success",
            rawNotes, // exactly as submitted, before trimming and stripping
            llmResponse: GOOD_REPLY,
            inputTokens: 10,
            outputTokens: 5,
            itemCount: 2,
        })
        expect(typeof find("extraction completed")?.latencyMs).toBe("number")
        expect(find("request completed")).toMatchObject({
            requestId: res.headers.get("x-request-id"),
            method: "POST",
            route: "/api/meetings",
            status: 201,
            outcome: "success",
            itemCount: 2,
        })
    })
})

describe("meeting title", () => {
    it("prefers the title the user typed", async () => {
        const res = await postMeeting({ title: "My title", notes: NOTES })
        expect((await res.json()).title).toBe("My title")
    })

    it("uses the model title when the user left it blank", async () => {
        const res = await postMeeting({ title: "  ", notes: NOTES })
        expect((await res.json()).title).toBe("Weekly sync")
    })

    it.each([
        ["missing", undefined],
        ["not a string", 42],
        ["multi-line", "Two\nlines"],
        ["empty", "   "],
        ["too long", "a".repeat(121)],
    ])(
        "falls back to Untitled meeting when the model title is %s",
        async (_label, title) => {
            useLlm(() => JSON.stringify({ title, items: [{ text: "Do it" }] }))
            const res = await postMeeting({ notes: NOTES })
            expect(res.status).toBe(201)
            expect((await res.json()).title).toBe("Untitled meeting")
        },
    )
})

describe("request validation", () => {
    it("rejects bad bodies before calling the LLM and writes nothing", async () => {
        const llm = vi.fn(() => GOOD_REPLY)
        useLlm(llm)
        const bodies = [
            "{not json",
            {},
            { notes: "short" },
            { notes: NOTES, extra: true },
            { notes: "a".repeat(20001) },
        ]
        for (const body of bodies) {
            const res = await postMeeting(body)
            expect(res.status).toBe(400)
            expect((await res.json()).error.code).toBe("VALIDATION_ERROR")
        }
        expect(llm).not.toHaveBeenCalled()
        expect(rowCounts()).toEqual({ meetings: 0, items: 0 })
    })

    it("returns field messages for the matching inputs", async () => {
        const res = await postMeeting({
            title: "x".repeat(121),
            notes: "short",
        })
        const { error } = await res.json()
        expect(Object.keys(error.fields).sort()).toEqual(["notes", "title"])
        expect(find("request completed")).toMatchObject({
            level: 40,
            errorCode: "VALIDATION_ERROR",
            issuePaths: expect.arrayContaining(["notes", "title"]),
        })
    })

    it("rejects a wrong content type", async () => {
        const res = await POST(
            json("/api/meetings", "POST", "{}", {
                "content-type": "text/plain",
            }),
        )
        expect(res.status).toBe(400)
    })

    it("rejects an oversized body with 413", async () => {
        const res = await postMeeting({ notes: "a".repeat(200 * 1024) })
        expect(res.status).toBe(413)
        expect((await res.json()).error.code).toBe("PAYLOAD_TOO_LARGE")
        expect(rowCounts()).toEqual({ meetings: 0, items: 0 })
    })
})

describe("unusable LLM output", () => {
    const longItem = JSON.stringify({ items: [{ text: "a".repeat(301) }] })
    const cases: [string, string, string][] = [
        [
            "plain sentences",
            "Sure! Here are the action items: send the report.",
            "not_json",
        ],
        [
            "markdown",
            "## Action items\n- Send the report\n- Book the room",
            "not_json",
        ],
        [
            "a refusal",
            "I'm sorry, but I can't help with that request.",
            "not_json",
        ],
        ["JSON with text around it", `Here you go: ${GOOD_REPLY}`, "not_json"],
        [
            "wrong-shape JSON",
            JSON.stringify({ tasks: ["a"] }),
            "schema_mismatch",
        ],
        ["a JSON array", JSON.stringify(["a", "b"]), "schema_mismatch"],
        ["an over-long item", longItem, "prose"],
        [
            "a multi-line item",
            JSON.stringify({ items: [{ text: "line one\nline two" }] }),
            "prose",
        ],
        [
            "more than 30 items",
            JSON.stringify({
                items: Array.from({ length: 31 }, (_, i) => ({
                    text: `Item ${i}`,
                })),
            }),
            "schema_mismatch",
        ],
        [
            "one bad item among good ones",
            JSON.stringify({ items: [{ text: "ok" }, { text: "bad\nitem" }] }),
            "prose",
        ],
    ]

    it.each(cases)(
        "%s returns LLM_BAD_OUTPUT, writes nothing and logs everything",
        async (_label, reply, reason) => {
            useLlm(() => reply)
            const res = await postMeeting({ notes: NOTES })
            const { error } = await res.json()

            expect(res.status).toBe(502)
            expect(error.code).toBe("LLM_BAD_OUTPUT")
            expect(error.message).toBe(
                "We couldn't turn these notes into action items. Please try again.",
            )
            expect(JSON.stringify(error)).not.toContain(reply.slice(0, 20))
            expect(rowCounts()).toEqual({ meetings: 0, items: 0 })
            expect(find("extraction completed")).toMatchObject({
                level: 40,
                outcome: "error",
                reason,
                rawNotes: NOTES,
                llmResponse: reply,
            })
            expect(find("request completed")).toMatchObject({
                level: 40,
                outcome: "error",
                errorCode: "LLM_BAD_OUTPUT",
                status: 502,
            })
        },
    )

    it("tolerates a single json fence", async () => {
        useLlm(() => `\`\`\`json\n${GOOD_REPLY}\n\`\`\``)
        expect((await postMeeting({ notes: NOTES })).status).toBe(201)
    })

    it("dedupes identical items before saving", async () => {
        useLlm(() =>
            JSON.stringify({ items: [{ text: "Do it" }, { text: "Do it" }] }),
        )
        const meeting = await (await postMeeting({ notes: NOTES })).json()
        expect(meeting.items).toHaveLength(1)
    })
})

describe("no action items", () => {
    it("returns NO_ACTION_ITEMS for a valid empty list, writes nothing and logs the response", async () => {
        const reply = '{"items": []}'
        useLlm(() => reply)
        const res = await postMeeting({ notes: NOTES })
        const { error } = await res.json()

        expect(res.status).toBe(422)
        expect(error.code).toBe("NO_ACTION_ITEMS")
        expect(error.message).toBe(
            "No action items could be found in these notes. Try adding who needs to do what.",
        )
        expect(rowCounts()).toEqual({ meetings: 0, items: 0 })
        expect(find("extraction completed")).toMatchObject({
            level: 40,
            reason: "no_action_items",
            rawNotes: NOTES,
            llmResponse: reply,
        })
    })
})

describe("provider failures", () => {
    it("maps an unavailable provider to LLM_UNAVAILABLE with an error log", async () => {
        useLlm(() => {
            throw new LlmUnavailableError("provider 503")
        })
        const res = await postMeeting({ notes: NOTES })

        expect(res.status).toBe(502)
        expect((await res.json()).error.code).toBe("LLM_UNAVAILABLE")
        expect(rowCounts()).toEqual({ meetings: 0, items: 0 })
        expect(find("extraction completed")).toMatchObject({
            level: 50,
            reason: "provider_unavailable",
            rawNotes: NOTES,
            llmResponse: null,
        })
        expect(find("extraction completed")?.err).toBeDefined()
    })

    it("maps a provider bad-output error to LLM_BAD_OUTPUT", async () => {
        useLlm(() => {
            throw new LlmBadOutputError("blocked")
        })
        const res = await postMeeting({ notes: NOTES })
        expect((await res.json()).error.code).toBe("LLM_BAD_OUTPUT")
        expect(find("extraction completed")).toMatchObject({
            reason: "provider_bad_output",
            llmResponse: null,
        })
    })

    it("maps an unknown provider error (such as a bad key) to INTERNAL without leaking it", async () => {
        useLlm(() => {
            throw new Error("401 invalid API key sk-secret")
        })
        const res = await postMeeting({ notes: NOTES })
        const text = await res.text()

        expect(res.status).toBe(500)
        expect(text).toContain("INTERNAL")
        expect(text).not.toContain("sk-secret")
        expect(find("request completed")).toMatchObject({
            level: 50,
            errorCode: "INTERNAL",
        })
        expect(rowCounts()).toEqual({ meetings: 0, items: 0 })
    })

    it("returns LLM_TIMEOUT after 30 seconds and writes nothing", async () => {
        vi.useFakeTimers()
        useLlm(
            (_request, { signal }) =>
                new Promise((_resolve, reject) => {
                    signal.addEventListener("abort", () =>
                        reject(new Error("aborted")),
                    )
                }),
        )
        const pending = postMeeting({ notes: NOTES })

        await vi.advanceTimersByTimeAsync(29_999)
        expect(find("request completed")).toBeUndefined()
        await vi.advanceTimersByTimeAsync(1)
        const res = await pending

        expect(res.status).toBe(504)
        expect((await res.json()).error.code).toBe("LLM_TIMEOUT")
        expect(rowCounts()).toEqual({ meetings: 0, items: 0 })
        expect(find("extraction completed")).toMatchObject({
            level: 50,
            reason: "timeout",
            rawNotes: NOTES,
            llmResponse: null,
        })
    })
})

describe("PATCH /api/items/:id", () => {
    it("rejects a bad id, a bad status and unknown keys", async () => {
        for (const [id, body] of [
            ["abc", { status: "done" }],
            ["0", { status: "done" }],
            ["1", { status: "finished" }],
            ["1", {}],
            ["1", { status: "done", extra: 1 }],
        ] as const) {
            const res = await patchItem(id, body)
            expect(res.status).toBe(400)
            expect((await res.json()).error.code).toBe("VALIDATION_ERROR")
        }
    })

    it("returns 404 for a missing item and logs the id", async () => {
        const res = await patchItem("999", { status: "done" })
        expect(res.status).toBe(404)
        expect((await res.json()).error.message).toBe(
            "That item no longer exists.",
        )
        expect(find("request completed")).toMatchObject({
            level: 40,
            route: "/api/items/:id",
            errorCode: "NOT_FOUND",
            itemId: 999,
            status: 404,
        })
    })

    it("logs the item id and new status on success", async () => {
        const meeting = await (await postMeeting({ notes: NOTES })).json()
        state.logs.length = 0
        await patchItem(String(meeting.items[1].id), { status: "in_progress" })
        expect(find("request completed")).toMatchObject({
            level: 30,
            itemId: meeting.items[1].id,
            newStatus: "in_progress",
            status: 200,
            outcome: "success",
        })
    })
})
