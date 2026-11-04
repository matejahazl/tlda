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
