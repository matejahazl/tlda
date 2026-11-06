import type { z } from "zod"
import type {
    createMeetingSchema,
    ITEM_STATUSES,
    patchItemSchema,
} from "@/lib/schemas"

export type ItemStatus = (typeof ITEM_STATUSES)[number]

export type ErrorCode =
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "NO_ACTION_ITEMS"
    | "LLM_BAD_OUTPUT"
    | "LLM_UNAVAILABLE"
    | "LLM_TIMEOUT"
    | "INTERNAL"

export type ApiErrorBody = {
    error: {
        code: ErrorCode
        message: string
        fields?: Record<string, string>
        requestId: string
    }
}

export type ActionItem = {
    id: number
    meetingId: number
    text: string
    status: ItemStatus
}

export type Meeting = {
    id: number
    title: string
    createdAt: string
    items: ActionItem[]
}

export type PaginatedMeetings = {
    meetings: Meeting[]
    nextCursor: number | null
}

export type AskSource = {
    meetingId: number
    title: string
}

// sources: the meetings the ask agent read to answer the question
export type AskAnswer = {
    answer: string
    sources: AskSource[]
}

// The fields of an action item the client can change
export type ActionItemChanges = z.input<typeof patchItemSchema>

// What the client sends, before the schema trims and cleans it
export type CreateMeetingBody = z.input<typeof createMeetingSchema>

// What the service gets, the cleaned body, plus raw notes (for the log)
export type CreateMeetingInput = z.output<typeof createMeetingSchema> & {
    rawNotes: string
}
