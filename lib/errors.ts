import type { ErrorCode } from "@/types"

type ErrorInfo = {
    status: number // HTTP status
    message: string // safe, human-readable text shown to the user
    level: "warn" | "error" // log level for the completion log
}

export const ERROR_TABLE: Record<ErrorCode, ErrorInfo> = {
    VALIDATION_ERROR: {
        status: 400,
        message: "Please check the highlighted fields.",
        level: "warn",
    },
    NOT_FOUND: {
        status: 404,
        message: "That item no longer exists.",
        level: "warn",
    },
    PAYLOAD_TOO_LARGE: {
        status: 413,
        message: "These notes are too long. Please shorten them and try again.",
        level: "warn",
    },
    NO_ACTION_ITEMS: {
        status: 422,
        message:
            "No action items could be found in these notes. Try adding who needs to do what.",
        level: "warn",
    },
    LLM_BAD_OUTPUT: {
        status: 502,
        message:
            "We couldn't turn these notes into action items. Please try again.",
        level: "warn",
    },
    LLM_UNAVAILABLE: {
        status: 502,
        message:
            "The extraction service is busy or unavailable. Please try again in a moment.",
        level: "error",
    },
    LLM_TIMEOUT: {
        status: 504,
        message: "Extraction took too long. Please try again.",
        level: "error",
    },
    INTERNAL: {
        status: 500,
        message: "Something went wrong on our side. Please try again.",
        level: "error",
    },
}

type AppErrorOptions = {
    message?: string // overrides the table message
    fields?: Record<string, string> // field name -> message, for validation errors
    cause?: unknown // the underlying error, logged but never sent to the client
}

export class AppError extends Error {
    readonly code: ErrorCode
    readonly fields?: Record<string, string>

    constructor(code: ErrorCode, options: AppErrorOptions = {}) {
        super(options.message ?? ERROR_TABLE[code].message, {
            cause: options.cause,
        })
        this.name = "AppError"
        this.code = code
        this.fields = options.fields
    }
}
