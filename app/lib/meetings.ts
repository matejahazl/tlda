import type { ActionItem, Meeting } from "@/lib/shared"

// Returns a copy of the meeting with one item changed
export function patchItem(
    meeting: Meeting,
    itemId: number,
    changes: Partial<ActionItem>,
): Meeting {
    return {
        ...meeting,
        items: meeting.items.map((item) =>
            item.id === itemId ? { ...item, ...changes } : item,
        ),
    }
}
