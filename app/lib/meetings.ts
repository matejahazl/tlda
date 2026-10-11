import type { ActionItem, Meeting } from "@/types"

// Returns new meetings with one item changed
export function patchItem(
    meetings: Meeting[],
    itemId: number,
    changes: Partial<ActionItem>,
): Meeting[] {
    return meetings.map((meeting) => ({
        ...meeting,
        items: meeting.items.map((item) =>
            item.id === itemId ? { ...item, ...changes } : item,
        ),
    }))
}
