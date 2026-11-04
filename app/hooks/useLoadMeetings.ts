import { useState } from "react"
import { apiFetch } from "@/app/lib/apiClient"
import type { PaginatedMeetings } from "@/types"

export function useLoadMeetings(onLoaded: (page: PaginatedMeetings) => void) {
    const [pending, setPending] = useState(false)
    const [failed, setFailed] = useState(false)

    async function loadMore(cursor: number) {
        if (pending) {
            return
        }
        setPending(true)
        setFailed(false)
        try {
            onLoaded(
                await apiFetch<PaginatedMeetings>(
                    `/api/meetings?cursor=${cursor}`,
                ),
            )
        } catch {
            setFailed(true)
        } finally {
            setPending(false)
        }
    }

    return { pending, failed, loadMore }
}
