import { useState } from "react"
import { ApiError, apiFetch } from "@/app/lib/apiClient"
import type { Meeting } from "@/types"

export function useDeleteMeeting(onDeleted: (meeting: Meeting) => void) {
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<ApiError | null>(null)

    async function remove(meeting: Meeting) {
        if (pending) {
            return
        }
        setPending(true)
        setError(null)
        try {
            await apiFetch<void>(`/api/meetings/${meeting.id}`, {
                method: "DELETE",
            })
        } catch (caught) {
            const failure =
                caught instanceof ApiError ? caught : ApiError.internal()
            if (failure.code !== "NOT_FOUND") {
                setError(failure)
                setPending(false)
                return
            }
        }
        setPending(false)
        onDeleted(meeting)
    }

    function reset() {
        if (!pending) {
            setError(null)
        }
    }

    return { pending, error, remove, reset }
}
