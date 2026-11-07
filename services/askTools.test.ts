import { beforeEach, describe, expect, it } from "vitest"
import { createDb, type Db } from "@/lib/server/db"
import { actionItems, meetings } from "@/lib/server/db/schema"
import type { ItemStatus } from "@/types"
import { getMeetingTool, listMeetingsTool, searchItemsTool } from "./askTools"

let db: Db

function seedMeeting(title: string, items: [string, ItemStatus][]) {
    const { id } = db
        .insert(meetings)
        .values({ title, notes: "secret raw notes" })
        .returning({ id: meetings.id })
        .get()

    if (items.length === 0) {
        return id
    }

    db.insert(actionItems)
        .values(
            items.map(([text, status]) => ({ meetingId: id, text, status })),
        )
        .run()

    return id
}

function search(args: Record<string, unknown> = {}) {
    const tool = searchItemsTool(db)

    return tool.handler(tool.args.parse(args))
}

const texts = (out: ReturnType<typeof search>) =>
    out.result.items.map((item) => item.text)

beforeEach(() => {
    db = createDb(":memory:")
})

describe("search_items", () => {
    let older: number
    let newer: number

    beforeEach(() => {
        older = seedMeeting("Pricing review", [
            ["Update the pricing page", "open"],
            ["Raise the price by 50%", "done"],
        ])
        newer = seedMeeting("Weekly sync", [
            ["Book the room", "in_progress"],
            ["Send PRICING notes to legal", "open"],
            ["Fix the user_id bug", "open"],
        ])
    })

    it("returns items newest meeting first, without the raw notes", () => {
        const out = search()

        expect(texts(out)).toEqual([
            "Book the room",
            "Send PRICING notes to legal",
            "Fix the user_id bug",
            "Update the pricing page",
            "Raise the price by 50%",
        ])
        expect(JSON.stringify(out)).not.toContain("secret raw notes")
    })

    it("filters by case-insensitive text and by status", () => {
        expect(texts(search({ query: "pricing" }))).toEqual([
            "Send PRICING notes to legal",
            "Update the pricing page",
        ])
        expect(
            texts(search({ query: "pricing", status: "open" })),
        ).toHaveLength(2)
        expect(texts(search({ status: "done" }))).toEqual([
            "Raise the price by 50%",
        ])
    })

    it("matches LIKE wildcards literally", () => {
        expect(texts(search({ query: "50%" }))).toEqual([
            "Raise the price by 50%",
        ])
        expect(texts(search({ query: "%" }))).toEqual([
            "Raise the price by 50%",
        ])
        expect(texts(search({ query: "o_m" }))).toEqual([]) // "_" as a wildcard would match "room"
        expect(texts(search({ query: "user_id" }))).toEqual([
            "Fix the user_id bug",
        ])
    })

    it("applies the limit", () => {
        expect(texts(search({ limit: 2 }))).toHaveLength(2)
    })

    it("lists each source meeting once, in result order", () => {
        expect(search().sources).toEqual([
            { meetingId: newer, title: "Weekly sync" },
            { meetingId: older, title: "Pricing review" },
        ])
        expect(search({ query: "nothing matches" }).sources).toEqual([])
    })
})

describe("list_meetings", () => {
    const list = (args: Record<string, unknown> = {}) => {
        const tool = listMeetingsTool(db)

        return tool.handler(tool.args.parse(args))
    }

    it("lists meetings newest first with item and done counts, without the raw notes", () => {
        const older = seedMeeting("Pricing review", [
            ["Update the pricing page", "done"],
            ["Raise the price", "open"],
        ])
        const newer = seedMeeting("Empty", [])

        const out = list()

        expect(out.result.meetings).toEqual([
            {
                id: newer,
                title: "Empty",
                createdAt: expect.any(String),
                itemCount: 0,
                doneCount: 0,
            },
            {
                id: older,
                title: "Pricing review",
                createdAt: expect.any(String),
                itemCount: 2,
                doneCount: 1,
            },
        ])
        expect(out.sources).toEqual([])
        expect(JSON.stringify(out)).not.toContain("secret raw notes")
    })

    it("applies the limit", () => {
        seedMeeting("One", [])
        seedMeeting("Two", [])

        expect(list({ limit: 1 }).result.meetings).toHaveLength(1)
    })
})

describe("get_meeting", () => {
    const get = (args: Record<string, unknown>) => {
        const tool = getMeetingTool(db)

        return tool.handler(tool.args.parse(args))
    }

    it("returns the meeting with its items, without the raw notes", () => {
        const id = seedMeeting("Weekly sync", [
            ["Book the room", "in_progress"],
            ["Send notes", "open"],
        ])

        const out = get({ id })

        expect(out.result).toEqual({
            id,
            title: "Weekly sync",
            createdAt: expect.any(String),
            items: [
                {
                    id: expect.any(Number),
                    text: "Book the room",
                    status: "in_progress",
                },
                { id: expect.any(Number), text: "Send notes", status: "open" },
            ],
        })
        expect(out.sources).toEqual([{ meetingId: id, title: "Weekly sync" }])
        expect(JSON.stringify(out)).not.toContain("secret raw notes")
    })

    it("returns not_found and no sources for a missing id", () => {
        expect(get({ id: 999 })).toEqual({
            result: { error: "not_found" },
            sources: [],
            rows: 0,
        })
    })
})
