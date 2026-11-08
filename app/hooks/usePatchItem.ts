import { startTransition, useOptimistic } from "react"
import { apiFetch } from "@/app/lib/apiClient"
import { patchItem } from "@/app/lib/meetings"
import type { ActionItem, ActionItemChanges, Meeting } from "@/lib/shared"

type PendingPatch = { itemId: number; changes: ActionItemChanges }

// Shows the changes on the item instantly and saves them. If the save fails, React drops the
// optimistic value when the transition ends, so the item goes back to its saved state.
export function usePatchItem(
    meeting: Meeting,
    onSaved: (item: ActionItem) => void,
) {
    const [optimisticMeeting, applyPatch] = useOptimistic(
        meeting,
        (current, { itemId, changes }: PendingPatch) =>
            patchItem(current, itemId, changes),
    )

    const patch = (itemId: number, changes: ActionItemChanges) => {
        startTransition(async () => {
            applyPatch({ itemId, changes })

            try {
                onSaved(
                    await apiFetch<ActionItem>(`/api/action-items/${itemId}`, {
                        method: "PATCH",
                        body: changes,
                    }),
                )
            } catch {
                // roll back by doing nothing; a failure message is listed in CONCERNS.md
            }
        })
    }

    return { meeting: optimisticMeeting, patch }
}
