import { useState } from "react"
import { ApiError, apiFetch } from "@/app/lib/apiClient"
import type { CreateMeetingBody, Meeting } from "@/types"

export type CreatePhase = "idle" | "processing" | "error"

export function useCreateMeeting(onCreated: (meeting: Meeting) => void) {
    const [phase, setPhase] = useState<CreatePhase>("idle")
    const [error, setError] = useState<ApiError | null>(null)

    async function submit(body: CreateMeetingBody) {
        if (phase === "processing") {
            return
        }
        setPhase("processing")
        setError(null)
        try {
            const meeting = await apiFetch<Meeting>("/notes/extract", {
                method: "POST",
                body,
            })
            setPhase("idle")
            onCreated(meeting)
        } catch (caught) {
            setError(caught instanceof ApiError ? caught : ApiError.internal())
            setPhase("error")
        }
    }

    function reset() {
        if (phase !== "processing") {
            setPhase("idle")
            setError(null)
        }
    }

    return { phase, error, submit, reset }
}
