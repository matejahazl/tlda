import { relations } from "drizzle-orm"
import {
    customType,
    index,
    integer,
    sqliteTable,
    text,
} from "drizzle-orm/sqlite-core"
import { ITEM_STATUSES } from "@/lib/shared"

const isoTimestamp = customType<{ data: string; driverData: number }>({
    dataType: () => "integer",
    fromDriver: (ms) => new Date(ms).toISOString(),
    toDriver: (iso) => new Date(iso).getTime(),
})

const createdAt = () =>
    isoTimestamp("created_at")
        .notNull()
        .$defaultFn(() => new Date().toISOString())

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

export const meetingsRelations = relations(meetings, ({ many }) => ({
    items: many(actionItems),
}))

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
    meeting: one(meetings, {
        fields: [actionItems.meetingId],
        references: [meetings.id],
    }),
}))

// The columns the API returns
export const MEETING_COLUMNS = {
    id: meetings.id,
    title: meetings.title,
    createdAt: meetings.createdAt,
}
export const ITEM_COLUMNS = {
    id: actionItems.id,
    meetingId: actionItems.meetingId,
    text: actionItems.text,
    status: actionItems.status,
}
