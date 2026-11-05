import { useState } from "react"
import { ApiError, apiFetch } from "@/app/lib/apiClient"
export function useDeleteMeeting(onDeleted: () => void) {
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<ApiError | null>(null)

    async function remove(meetingId: number) {
        if (pending) {
            return
        }
        setPending(true)
        setError(null)
        try {
            await apiFetch<void>(`/api/meetings/${meetingId}`, {
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
        onDeleted()
    }

    function reset() {
        if (!pending) {
            setError(null)
        }
    }

    return { pending, error, remove, reset }
}
