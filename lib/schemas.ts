import { z } from "zod"

const MIN_NOTES_LENGTH = 20 // min characters accepted for pasted notes
const MAX_NOTES_LENGTH = 20000 // max characters accepted for pasted notes
const MAX_TITLE_LENGTH = 120 // max characters in a meeting title

const CONTROL_CHARS = /(?![\t\n])\p{Cc}/gu // every control character except tab and newline

export const ITEM_STATUSES = ["open", "in_progress", "done"] as const
export const MAX_ITEMS = 30 // max action items accepted from the LLM
export const MAX_ITEM_TEXT_LENGTH = 300 // max characters in one action item

function cleanText(value: string): string {
    return value.replace(CONTROL_CHARS, "").trim()
}

function isSingleLine(value: string): boolean {
    return !/[\r\n]/.test(value)
}

const notesSchema = z
    .string({ error: "Notes are required" })
    .transform(cleanText)
    .pipe(
        z
            .string()
            .min(
                MIN_NOTES_LENGTH,
                `Add a bit more detail, at least ${MIN_NOTES_LENGTH} characters`,
            )
            .max(
                MAX_NOTES_LENGTH,
                `Notes are too long, at most ${MAX_NOTES_LENGTH} characters`,
            ),
    )

const titleSchema = z
    .string()
    .transform(cleanText)
    .pipe(
        z
            .string()
            .max(
                MAX_TITLE_LENGTH,
                `Title is too long, at most ${MAX_TITLE_LENGTH} characters`,
            ),
    )
    .transform((title) => title || undefined)
    .optional()

export const createMeetingSchema = z.strictObject({
    title: titleSchema,
    notes: notesSchema,
})

export const setStatusSchema = z.strictObject({
    status: z.enum(ITEM_STATUSES, { error: "Invalid status" }),
})

export const itemIdSchema = z
    .string()
    .regex(/^[1-9]\d*$/, "Invalid id")
    .transform(Number)
    .pipe(z.number().int().safe())

const llmItemSchema = z.object({
    text: z
        .string()
        .trim()
        .min(1)
        .max(MAX_ITEM_TEXT_LENGTH)
        .refine(isSingleLine, "Item text must be a single line"),
})

export const llmOutputSchema = z.object({
    title: z
        .string()
        .transform(cleanText)
        .pipe(z.string().min(1).max(MAX_TITLE_LENGTH).refine(isSingleLine))
        .optional()
        .catch(undefined),
    items: z
        .array(llmItemSchema)
        .max(MAX_ITEMS)
        .transform((items) => [
            ...new Map(items.map((item) => [item.text, item])).values(),
        ]),
})
