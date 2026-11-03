import { startTransition, useOptimistic } from "react"
import { apiFetch } from "@/app/lib/apiClient"
import { patchItem } from "@/app/lib/meetings"
import type { ActionItem, ItemStatus, Meeting } from "@/types"

type StatusChange = { itemId: number; status: ItemStatus }

// Flips the status instantly and saves it. If the save fails, React drops the optimistic
// value when the transition ends, so the item goes back to its saved status.
export function useSetItemStatus(
    meetings: Meeting[],
    onSaved: (item: ActionItem) => void,
) {
    const [optimisticMeetings, applyChange] = useOptimistic(
        meetings,
        (current, { itemId, status }: StatusChange) =>
            patchItem(current, itemId, { status }),
    )

    const setItemStatus = (itemId: number, status: ItemStatus) => {
        startTransition(async () => {
            applyChange({ itemId, status })
            try {
                onSaved(
                    await apiFetch<ActionItem>(`/api/action-items/${itemId}`, {
                        method: "PATCH",
                        body: { status },
                    }),
                )
            } catch {
                // roll back by doing nothing; a failure message is listed in CONCERNS.md
            }
        })
    }

    return { meetings: optimisticMeetings, setItemStatus }
}
