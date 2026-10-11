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

    // shortcut: reads the whole body before the size check, fine for a local app, stream it if exposed
    const bytes = new Uint8Array(await req.arrayBuffer())
    if (bytes.byteLength > MAX_BODY_BYTES) {
        throw new AppError("PAYLOAD_TOO_LARGE")
    }

    try {
        return JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        )
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
