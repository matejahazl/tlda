import "server-only"
import { randomUUID } from "node:crypto"
import type { Logger } from "pino"
import { AppError, ERROR_TABLE } from "@/lib/errors"
import { logger } from "@/lib/server/logger"
import type { ApiErrorBody } from "@/types"

const REQUEST_ID_PATTERN = /^[\w.-]{1,64}$/ // short and log-safe, anything else is replaced

export type ApiResult = { status?: number; body: unknown }

export type ApiContext<P> = {
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

        log.debug({ method: req.method, route }, "request started")

        const finish = (
            status: number,
            body: unknown,
            level: "info" | "warn" | "error",
            fields: Record<string, unknown>,
        ) => {
            log[level](
                {
                    ...extra,
                    method: req.method,
                    route,
                    status,
                    durationMs: Math.round(performance.now() - start),
                    ...fields,
                },
                "request completed",
            )
            return Response.json(body, {
                status,
                headers: { "x-request-id": requestId },
            })
        }

        try {
            const params = routeCtx ? await routeCtx.params : ({} as P)
            const result = await handler(req, {
                log,
                params,
                addLogFields: (fields) => Object.assign(extra, fields),
            })
            return finish(result.status ?? 200, result.body, "info", {
                outcome: "success",
            })
        } catch (error) {
            const appError =
                error instanceof AppError
                    ? error
                    : new AppError("INTERNAL", { cause: error })
            const { status, level } = ERROR_TABLE[appError.code]
            const body = {
                error: {
                    code: appError.code,
                    message: appError.message,
                    fields: appError.fields,
                    requestId,
                },
            } satisfies ApiErrorBody
            return finish(status, body, level, {
                outcome: "error",
                errorCode: appError.code,
                // validation failures log field paths, never the submitted values
                ...(appError.fields && {
                    issuePaths: Object.keys(appError.fields),
                }),
                ...(level === "error" && { err: error }),
            })
        }
    }
}
