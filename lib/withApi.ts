import "server-only"
import { randomUUID } from "node:crypto"
import type { Logger } from "pino"
import type { ApiErrorBody } from "@/app/types"
import { AppError, ERROR_TABLE } from "@/lib/errors"
import { logger } from "@/lib/logger"

const REQUEST_ID_PATTERN = /^[\w.-]{1,64}$/ // short and log-safe, anything else is replaced

export type ApiResult = { status?: number; body: unknown }

export type ApiContext<P> = {
    requestId: string
    log: Logger
    params: P
    addLogFields: (fields: Record<string, unknown>) => void // merged into the completion log
}

type RouteContext<P> = { params: Promise<P> }

type ApiHandler<P> = (req: Request, ctx: ApiContext<P>) => Promise<ApiResult>

// Wraps a route handler: request id, one JSON error envelope, one completion log per request
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
        const base = { method: req.method, route }

        log.debug(base, "request started")

        let status: number
        let body: unknown
        let failure: { error: unknown; appError: AppError } | undefined
        try {
            const params = routeCtx ? await routeCtx.params : ({} as P)
            const result = await handler(req, {
                requestId,
                log,
                params,
                addLogFields: (fields) => Object.assign(extra, fields),
            })
            status = result.status ?? 200
            body = result.body
        } catch (error) {
            const appError =
                error instanceof AppError
                    ? error
                    : new AppError("INTERNAL", { cause: error })
            failure = { error, appError }
            status = ERROR_TABLE[appError.code].status
            body = {
                error: {
                    code: appError.code,
                    message: appError.message,
                    fields: appError.fields,
                    requestId,
                },
            } satisfies ApiErrorBody
        }

        const completion = {
            ...extra,
            ...base,
            status,
            durationMs: Math.round(performance.now() - start),
        }
        if (!failure) {
            log.info({ ...completion, outcome: "success" }, "request completed")
        } else {
            const { error, appError } = failure
            const level = ERROR_TABLE[appError.code].level
            log[level](
                {
                    ...completion,
                    outcome: "error",
                    errorCode: appError.code,
                    // validation failures log field paths, never the submitted values
                    ...(appError.fields && {
                        issuePaths: Object.keys(appError.fields),
                    }),
                    ...(level === "error" && { err: error }),
                },
                "request completed",
            )
        }

        return Response.json(body, {
            status,
            headers: { "x-request-id": requestId },
        })
    }
}
