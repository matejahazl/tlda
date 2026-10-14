import { ERROR_TABLE } from "@/lib/errors"
import type { ApiErrorBody, ErrorCode } from "@/types"

type RequestOptions = {
    method?: "GET" | "POST" | "PATCH"
    body?: unknown
}

export class ApiError extends Error {
    constructor(
        readonly code: ErrorCode,
        message: string,
        readonly fields?: Record<string, string>,
        readonly requestId?: string,
    ) {
        super(message)
        this.name = "ApiError"
    }

    static internal(): ApiError {
        return new ApiError("INTERNAL", ERROR_TABLE.INTERNAL.message)
    }
}

export async function apiFetch<T>(
    path: string,
    { method = "GET", body }: RequestOptions = {},
): Promise<T> {
    let response: Response
    try {
        response = await fetch(path, {
            method,
            cache: "no-store",
            headers:
                body === undefined
                    ? undefined
                    : { "content-type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
        })
    } catch {
        throw ApiError.internal()
    }

    if (!response.ok) {
        throw await readError(response)
    }
    try {
        return (await response.json()) as T
    } catch {
        throw ApiError.internal()
    }
}

async function readError(response: Response): Promise<ApiError> {
    try {
        const body: unknown = await response.json()
        if (isErrorBody(body)) {
            const { code, message, fields, requestId } = body.error
            return new ApiError(code, message, fields, requestId)
        }
    } catch {
        // not JSON: fall through to the generic error
    }
    return ApiError.internal()
}

function isErrorBody(value: unknown): value is ApiErrorBody {
    const error = (value as Partial<ApiErrorBody> | null)?.error
    return (
        typeof error?.message === "string" &&
        typeof error.code === "string" &&
        error.code in ERROR_TABLE
    )
}
