import type { z } from "zod"

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
