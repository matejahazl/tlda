import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError, apiFetch } from "@/app/lib/apiClient"
import type { CreateMeetingBody, Meeting } from "@/types"

export type CreatePhase = "idle" | "processing" | "error"

export function useCreateMeeting(onCreated: (meeting: Meeting) => void) {
    const [phase, setPhase] = useState<CreatePhase>("idle")
    const [error, setError] = useState<ApiError | null>(null)
    const inFlight = useRef<AbortController | null>(null)

    useEffect(() => () => inFlight.current?.abort(), [])

    const submit = useCallback(
        async (body: CreateMeetingBody) => {
            if (inFlight.current) {
                return
            }
            const controller = new AbortController()
            inFlight.current = controller
            setPhase("processing")
            setError(null)

            try {
                const meeting = await apiFetch<Meeting>("/notes/extract", {
                    method: "POST",
                    body,
                    signal: controller.signal,
                })
                inFlight.current = null
                setPhase("idle")
                onCreated(meeting)
            } catch (caught) {
                if (controller.signal.aborted) {
                    return
                }
                inFlight.current = null
                setError(
                    caught instanceof ApiError ? caught : ApiError.internal(),
                )
                setPhase("error")
            }
        },
        [onCreated],
    )

    const reset = useCallback(() => {
        if (!inFlight.current) {
            setPhase("idle")
            setError(null)
        }
    }, [])

    return { phase, error, submit, reset }
}
