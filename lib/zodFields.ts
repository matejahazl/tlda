import type { z } from "zod"

// One message per field (the first), keyed by the field path.
export function fieldMessages(
    error: z.ZodError,
    fallbackField = "body",
): Record<string, string> {
    const fields: Record<string, string> = {}
    for (const issue of error.issues) {
        const field = issue.path.join(".") || fallbackField
        fields[field] ??= issue.message
    }
    return fields
}
