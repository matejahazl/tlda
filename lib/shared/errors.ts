import type { ErrorCode } from "./types"

type ErrorInfo = {
    status: number
    message: string
    level: "warn" | "error"
}

export const ERROR_TABLE: Record<ErrorCode, ErrorInfo> = {
    VALIDATION_ERROR: {
        status: 400,
        message: "Please check the highlighted fields.",
        level: "warn",
    },
    NOT_FOUND: {
        status: 404,
        message: "Item not found.",
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
        message: "The AI response couldn't be used. Please try again.",
        level: "warn",
    },
    LLM_UNAVAILABLE: {
        status: 502,
        message:
            "The AI service is busy or unavailable. Please try again in a moment.",
        level: "error",
    },
    LLM_TIMEOUT: {
        status: 504,
        message: "This took too long. Please try again.",
        level: "error",
    },
    INTERNAL: {
        status: 500,
        message: "Something went wrong on our side. Please try again.",
        level: "error",
    },
}

type AppErrorOptions = {
    message?: string
    fields?: Record<string, string>
    cause?: unknown
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
