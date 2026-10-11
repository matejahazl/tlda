import type { Meeting } from "@/types"

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
})

export function formatDate(iso: string): string {
    return DATE_FORMAT.format(new Date(iso))
}

export function countDone(meeting: Meeting): number {
    return meeting.items.filter((item) => item.status === "done").length
}

export function pluralize(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`
}

export function summaryLine(meetings: Meeting[]): string {
    if (meetings.length === 0) {
        return "Nothing tracked yet"
    }
    const open = meetings.reduce(
        (sum, meeting) => sum + meeting.items.length - countDone(meeting),
        0,
    )
    return `${pluralize(meetings.length, "meeting")} · ${pluralize(open, "open item")}`
}
