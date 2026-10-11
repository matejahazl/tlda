import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { actionItems, createDb, meetings } from "@/lib/db"

describe("database", () => {
    it("migrates, defaults status to open and cascades deletes", () => {
        const db = createDb(":memory:")
        const meeting = db
            .insert(meetings)
            .values({ title: "Sync", notes: "notes" })
            .returning()
            .get()
        const item = db
            .insert(actionItems)
            .values({ meetingId: meeting.id, text: "Do it" })
            .returning()
            .get()

        expect(item.status).toBe("open")
        expect(item.owner).toBeNull()

        db.delete(meetings).where(eq(meetings.id, meeting.id)).run()
        expect(db.select().from(actionItems).all()).toHaveLength(0)
    })
})
