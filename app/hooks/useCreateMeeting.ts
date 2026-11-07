import { useState } from "react"
import { ApiError, apiFetch } from "@/app/lib/apiClient"
import type { CreateMeetingBody, Meeting } from "@/types"

export type CreatePhase = "idle" | "processing" | "error"

export function useCreateMeeting(onCreated: (meeting: Meeting) => void) {
    const [phase, setPhase] = useState<CreatePhase>("idle")
    const [error, setError] = useState<ApiError | null>(null)

    // resolves to the created meeting, or null when nothing was created
    async function submit(body: CreateMeetingBody): Promise<Meeting | null> {
        if (phase === "processing") {
            return null
        }

        setPhase("processing")
        setError(null)

        try {
            const meeting = await apiFetch<Meeting>("/api/meetings", {
                method: "POST",
                body,
            })
            setPhase("idle")
            onCreated(meeting)

            return meeting
        } catch (caught) {
            setError(caught instanceof ApiError ? caught : ApiError.internal())
            setPhase("error")

            return null
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
