import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PATCH } from "@/app/api/action-items/[id]/route"
import { POST as ASK } from "@/app/api/ask/route"
import { DELETE } from "@/app/api/meetings/[id]/route"
import { GET, POST } from "@/app/api/meetings/route"
import {
    LlmIntegrationService,
    LlmUnavailableError,
    MockProvider,
} from "@/integrations"
import {
    MAX_ITEM_TEXT_LENGTH,
    MAX_NOTES_LENGTH,
    MAX_QUESTION_LENGTH,
    MAX_TITLE_LENGTH,
    MIN_NOTES_LENGTH,
} from "@/lib/schemas"
import { createDb, type Db } from "@/lib/server/db"
import { actionItems, meetings } from "@/lib/server/db/schema"
import type * as LoggerModule from "@/lib/server/logger"
import { AskService } from "@/services/AskService"
import { MeetingService } from "@/services/MeetingService"

type Handler = ConstructorParameters<typeof MockProvider>[0]

const state = vi.hoisted(() => ({
    db: undefined as unknown as Db,
    service: undefined as unknown as MeetingService,
    askService: undefined as unknown as AskService,
    logs: [] as Record<string, unknown>[],
}))

vi.mock("@/services", () => ({
    getMeetingService: () => state.service,
    getAskService: () => state.askService,
}))
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

const ask = (body: unknown) => ASK(json("/api/ask", "POST", body))

const patchItem = (id: string, body: unknown) =>
    PATCH(json(`/api/action-items/${id}`, "PATCH", body), {
        params: Promise.resolve({ id }),
    })

const deleteMeeting = (id: string) =>
    DELETE(
        new Request(`http://localhost/api/meetings/${id}`, {
            method: "DELETE",
        }),
        {
            params: Promise.resolve({ id }),
        },
    )

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
    state.askService = new AskService()
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

        const { meetings: list } = await (
            await GET(new Request("http://localhost/api/meetings"))
        ).json()
        expect(list).toHaveLength(1)
        expect(list[0]).not.toHaveProperty("notes")
        expect(list[0].items[0]).toMatchObject({
            meetingId: meeting.id,
            text: "Send the report to Bob",
        })

        const patched = await patchItem(String(meeting.items[0].id), {
            status: "done",
        })
        expect(patched.status).toBe(200)
        expect(await patched.json()).toMatchObject({
            id: meeting.items[0].id,
            meetingId: meeting.id,
            status: "done",
        })

        const { meetings: after } = await (
            await GET(new Request("http://localhost/api/meetings"))
        ).json()
        expect(after[0].items[0].status).toBe("done")
        expect(after[0].items[1].status).toBe("open")
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

    it("falls back to Untitled meeting when the model gives no valid title", async () => {
        useLlm(() =>
            JSON.stringify({ title: "Two\nlines", items: [{ text: "Do it" }] }),
        )
        const res = await postMeeting({ notes: NOTES })
        expect((await res.json()).title).toBe("Untitled meeting")
    })
})

describe("request validation", () => {
    it("rejects bad bodies before calling the LLM and writes nothing", async () => {
        const llm = vi.fn(() => GOOD_REPLY)
        useLlm(llm)
        const bodies = [
            "{not json",
            {},
            { notes: "a".repeat(MIN_NOTES_LENGTH - 1) },
            { notes: NOTES, extra: true },
            { notes: "a".repeat(MAX_NOTES_LENGTH + 1) },
            { notes: NOTES, title: "a".repeat(MAX_TITLE_LENGTH + 1) },
        ]
        for (const body of bodies) {
            const res = await postMeeting(body)
            expect(res.status).toBe(400)
            expect((await res.json()).error.code).toBe("VALIDATION_ERROR")
        }
        expect(llm).not.toHaveBeenCalled()
        expect(rowCounts()).toEqual({ meetings: 0, items: 0 })
    })
})

describe("unusable LLM output", () => {
    const longItem = JSON.stringify({
        items: [{ text: "a".repeat(MAX_ITEM_TEXT_LENGTH + 1) }],
    })
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
        [
            "wrong-shape JSON",
            JSON.stringify({ tasks: ["a"] }),
            "schema_mismatch",
        ],
        ["an over-long item", longItem, "prose"],
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
})

describe("no action items", () => {
    it("returns NO_ACTION_ITEMS for a valid empty list, writes nothing and logs the response", async () => {
        const reply = '{"items": []}'
        const rawNotes = `  ${NOTES}\u0007  `
        useLlm(() => reply)
        const res = await postMeeting({ notes: rawNotes })
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
            rawNotes, // exactly as submitted, before trimming and stripping
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

describe("GET /api/meetings pagination", () => {
    const getPage = async (query = "") =>
        GET(new Request(`http://localhost/api/meetings${query}`))

    it("pages newest first and a next cursor until the last page", async () => {
        const created = []
        for (let i = 0; i < 7; i++) {
            created.push(await (await postMeeting({ notes: NOTES })).json())
        }
        await patchItem(String(created[0].items[0].id), { status: "done" })
        const ids = created.map((m) => m.id).reverse()

        const first = await (await getPage()).json()
        expect(first.meetings.map((m: { id: number }) => m.id)).toEqual(
            ids.slice(0, 5),
        )
        expect(first.nextCursor).toBe(ids[4])

        const second = await (
            await getPage(`?cursor=${first.nextCursor}`)
        ).json()
        expect(second.meetings.map((m: { id: number }) => m.id)).toEqual(
            ids.slice(5),
        )
        expect(second.nextCursor).toBeNull()
    })

    it("rejects a bad cursor and unknown query params", async () => {
        for (const query of ["?cursor=abc", "?cursor=0", "?page=2"]) {
            const res = await getPage(query)
            expect(res.status).toBe(400)
            expect((await res.json()).error.code).toBe("VALIDATION_ERROR")
        }
    })
})

describe("PATCH /action-items/:id", () => {
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
        expect((await res.json()).error.message).toBe("Item not found.")
        expect(find("request completed")).toMatchObject({
            level: 40,
            route: "/api/action-items/:id",
            errorCode: "NOT_FOUND",
            itemId: 999,
            status: 404,
        })
    })
})

describe("DELETE /api/meetings/:id", () => {
    it("deletes the meeting and its items", async () => {
        const meeting = await (await postMeeting({ notes: NOTES })).json()
        expect(rowCounts()).toEqual({ meetings: 1, items: 2 })

        const res = await deleteMeeting(String(meeting.id))

        expect(res.status).toBe(204)
        expect(await res.text()).toBe("")
        expect(rowCounts()).toEqual({ meetings: 0, items: 0 })
    })

    it("returns 404 for a missing meeting", async () => {
        const res = await deleteMeeting("999")

        expect(res.status).toBe(404)
        expect((await res.json()).error.code).toBe("NOT_FOUND")
    })

    it("returns 400 for an invalid id", async () => {
        const res = await deleteMeeting("abc")

        expect(res.status).toBe(400)
        expect((await res.json()).error.code).toBe("VALIDATION_ERROR")
    })
})

describe("POST /api/ask", () => {
    it("answers a valid question", async () => {
        const res = await ask({ question: "What's still open?" })

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            answer: expect.any(String),
            sources: [],
        })
    })

    it("rejects bad bodies with VALIDATION_ERROR", async () => {
        const bodies = [
            "{not json",
            {},
            { question: " " },
            { question: "a".repeat(MAX_QUESTION_LENGTH + 1) },
            { question: "What's open?", extra: true },
        ]
        for (const body of bodies) {
            const res = await ask(body)
            expect(res.status).toBe(400)
            expect((await res.json()).error.code).toBe("VALIDATION_ERROR")
        }
    })
})

describe("routes with a JSON body", () => {
    it("reject a non-JSON content type", async () => {
        const plain = (url: string, method: string, body: unknown) =>
            json(url, method, body, { "content-type": "text/plain" })
        const params = { params: Promise.resolve({ id: "1" }) }

        const responses = [
            await POST(plain("/api/meetings", "POST", { notes: NOTES })),
            await PATCH(
                plain("/api/action-items/1", "PATCH", { status: "done" }),
                params,
            ),
            await ASK(plain("/api/ask", "POST", { question: "What's open?" })),
        ]

        for (const res of responses) {
            expect(res.status).toBe(400)
            expect((await res.json()).error.code).toBe("VALIDATION_ERROR")
        }
    })
})
