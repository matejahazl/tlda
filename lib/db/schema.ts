import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { ITEM_STATUSES } from "@/lib/schemas"

const createdAt = () =>
    integer("created_at", { mode: "timestamp_ms" })
        .notNull()
        .$defaultFn(() => new Date())

export const meetings = sqliteTable("meetings", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    notes: text("notes").notNull(),
    createdAt: createdAt(),
})

export const actionItems = sqliteTable(
    "action_items",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        meetingId: integer("meeting_id")
            .notNull()
            .references(() => meetings.id, { onDelete: "cascade" }),
        text: text("text").notNull(),
        status: text("status", { enum: ITEM_STATUSES })
            .notNull()
            .default("open"),
        createdAt: createdAt(),
    },
    (table) => [index("action_items_meeting_id_idx").on(table.meetingId)],
)
