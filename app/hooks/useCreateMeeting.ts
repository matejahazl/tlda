import { useState } from "react"
import { ApiError, apiFetch } from "@/app/lib/apiClient"
import type { CreateMeetingBody, Meeting } from "@/types"

export type CreatePhase = "idle" | "processing" | "error"

export function useCreateMeeting(onCreated: (meeting: Meeting) => void) {
    const [phase, setPhase] = useState<CreatePhase>("idle")
    const [error, setError] = useState<ApiError | null>(null)

    // resolves to true when the meeting was created
    async function submit(body: CreateMeetingBody): Promise<boolean> {
        if (phase === "processing") {
            return false
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
            return true
        } catch (caught) {
            setError(caught instanceof ApiError ? caught : ApiError.internal())
            setPhase("error")
            return false
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
