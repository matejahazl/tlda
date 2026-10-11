import type { z } from "zod"
import type { createMeetingSchema, ITEM_STATUSES } from "@/lib/schemas"

export type ItemStatus = (typeof ITEM_STATUSES)[number]

export type ErrorCode =
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "PAYLOAD_TOO_LARGE"
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
    text: string
    owner: string | null
    status: ItemStatus
}

export type Meeting = {
    id: number
    title: string
    createdAt: string
    items: ActionItem[]
}

// What the client sends, before the schema trims and cleans it
export type CreateMeetingBody = z.input<typeof createMeetingSchema>
