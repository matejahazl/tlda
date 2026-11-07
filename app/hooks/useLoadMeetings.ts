import { useState } from "react"
import { apiFetch } from "@/app/lib/apiClient"
import type { Meeting, PaginatedMeetings } from "@/types"

// Owns the cursor: only the list that loads more pages needs it
export function useLoadMeetings(
    initialCursor: number | null,
    onLoaded: (meetings: Meeting[]) => void,
) {
    const [cursor, setCursor] = useState(initialCursor)
    const [pending, setPending] = useState(false)
    const [failed, setFailed] = useState(false)

    async function loadMore() {
        if (pending || cursor === null) {
            return
        }

        setPending(true)
        setFailed(false)

        try {
            const page = await apiFetch<PaginatedMeetings>(
                `/api/meetings?cursor=${cursor}`,
            )
            setCursor(page.nextCursor)
            onLoaded(page.meetings)
        } catch {
            setFailed(true)
        } finally {
            setPending(false)
        }
    }

    return { hasMore: cursor !== null, pending, failed, loadMore }
}
