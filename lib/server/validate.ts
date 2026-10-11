import "server-only"
import type { z } from "zod"
import { AppError } from "@/lib/errors"
import { fieldMessages } from "@/lib/zodFields"

const MAX_BODY_BYTES = 128 * 1024 // request body cap (20,000 chars of notes plus JSON escaping)
const JSON_CONTENT_TYPE = /^application\/json\s*(;.*)?$/i

// Reads and parses a JSON body. Enforces content type, size cap and valid UTF-8 JSON.
export async function readJson(req: Request): Promise<unknown> {
    if (!JSON_CONTENT_TYPE.test(req.headers.get("content-type") ?? "")) {
        throw new AppError("VALIDATION_ERROR", {
            message: "Content-Type must be application/json.",
        })
    }

    const chunks: Uint8Array[] = []
    let total = 0
    const reader = req.body?.getReader()
    while (reader) {
        const { done, value } = await reader.read()
        if (done) {
            break
        }
        total += value.byteLength
        if (total > MAX_BODY_BYTES) {
            await reader.cancel()
            throw new AppError("PAYLOAD_TOO_LARGE")
        }
        chunks.push(value)
    }

    try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(
            Buffer.concat(chunks),
        )
        return JSON.parse(text)
    } catch {
        throw new AppError("VALIDATION_ERROR", {
            message: "The request body is not valid JSON.",
        })
    }
}

export function parseOrThrow<S extends z.ZodType>(
    schema: S,
    value: unknown,
    fallbackField = "body",
): z.output<S> {
    const result = schema.safeParse(value)
    if (result.success) {
        return result.data
    }
    throw new AppError("VALIDATION_ERROR", {
        fields: fieldMessages(result.error, fallbackField),
    })
}
