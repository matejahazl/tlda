import "server-only"
import { randomUUID } from "node:crypto"
import type { Logger } from "pino"
import { AppError, ERROR_TABLE } from "@/lib/errors"
import { logger } from "@/lib/server/logger"
import type { ApiErrorBody } from "@/types"

const REQUEST_ID_PATTERN = /^[\w.-]{1,64}$/

export type ApiResult = { status?: number; body?: unknown }

export type ApiContext<P> = {
    log: Logger
    params: P
    addLogFields: (fields: Record<string, unknown>) => void
}

type RouteContext<P> = { params: Promise<P> }

type ApiHandler<P> = (req: Request, ctx: ApiContext<P>) => Promise<ApiResult>

// A request ends with the response and the completion log
type Completion = {
    status: number
    body: unknown
    level: "info" | "warn" | "error"
    logFields: Record<string, unknown>
}

// Wraps a route handler: request id, one JSON error envelope
export function withApi<
    P extends Record<string, string> = Record<string, never>,
>(route: string, handler: ApiHandler<P>) {
    return async (
        req: Request,
        routeCtx?: RouteContext<P>,
    ): Promise<Response> => {
        const start = performance.now()
        const incomingId = req.headers.get("x-request-id") ?? ""
        const requestId = REQUEST_ID_PATTERN.test(incomingId)
            ? incomingId
            : randomUUID()
        const log = logger.child({ requestId })
        const extra: Record<string, unknown> = {}

        log.debug({ method: req.method, route }, "request started")

        let done: Completion
        try {
            const params = routeCtx ? await routeCtx.params : ({} as P)
            const result = await handler(req, {
                log,
                params,
                addLogFields: (fields) => Object.assign(extra, fields),
            })
            done = {
                status: result.status ?? 200,
                body: result.body,
                level: "info",
                logFields: { outcome: "success" },
            }
        } catch (error) {
            done = failure(error, requestId)
        }

        log[done.level](
            {
                ...extra,
                method: req.method,
                route,
                status: done.status,
                durationMs: Math.round(performance.now() - start),
                ...done.logFields,
            },
            "request completed",
        )
        const headers = { "x-request-id": requestId }
        return done.status === 204
            ? new Response(null, { status: 204, headers })
            : Response.json(done.body, { status: done.status, headers })
    }
}

// Turns any thrown error into the JSON error envelope and its completion log fields
function failure(error: unknown, requestId: string): Completion {
    const appError =
        error instanceof AppError
            ? error
            : new AppError("INTERNAL", { cause: error })
    const { status, level } = ERROR_TABLE[appError.code]
    return {
        status,
        body: {
            error: {
                code: appError.code,
                message: appError.message,
                fields: appError.fields,
                requestId,
            },
        } satisfies ApiErrorBody,
        level,
        logFields: {
            outcome: "error",
            errorCode: appError.code,
            // validation failures log field paths, not the submitted values
            ...(appError.fields && {
                issuePaths: Object.keys(appError.fields),
            }),
            ...(level === "error" && { err: error }),
        },
    }
}
