import "server-only"
import type { z } from "zod"
import { AppError } from "@/lib/errors"
import { fieldMessages } from "@/lib/zodFields"

const JSON_CONTENT_TYPE = /^application\/json\s*(;.*)?$/i

// Reads and parses a JSON body. Enforces the JSON content type, which also blocks plain cross-site form posts.
export async function readJson(req: Request): Promise<unknown> {
    if (!JSON_CONTENT_TYPE.test(req.headers.get("content-type") ?? "")) {
        throw new AppError("VALIDATION_ERROR", {
            message: "Content-Type must be application/json.",
        })
    }
    try {
        return await req.json()
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
