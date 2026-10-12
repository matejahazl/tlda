import { countDone, formatDate } from "@/app/lib/format"
import type { ItemStatus, Meeting } from "@/types"
import { StatusButtons } from "./StatusButtons"

type MeetingCardProps = {
    meeting: Meeting
    onSetStatus: (itemId: number, status: ItemStatus) => void
}

export function MeetingCard({ meeting, onSetStatus }: MeetingCardProps) {
    const done = countDone(meeting)
    const total = meeting.items.length

    return (
        <article className="overflow-hidden rounded-[16px] bg-card shadow-card motion-safe:animate-enter motion-reduce:animate-fade">
            <div className="flex flex-wrap items-center justify-between gap-x-[24px] gap-y-[12px] px-[24px] py-[20px]">
                <div className="flex min-w-0 flex-col">
                    <h2 className="wrap-anywhere">{meeting.title}</h2>
                    <time
                        dateTime={meeting.createdAt}
                        suppressHydrationWarning // server and browser time zones can differ
                        className="text-sm text-muted"
                    >
                        {formatDate(meeting.createdAt)}
                    </time>
                </div>
                <div className="flex items-center gap-[12px]">
                    <span className="text-sm text-muted tabular-nums">
                        {`${done} of ${total} done`}
                    </span>
                    <ProgressBar ratio={total ? done / total : 0} />
                </div>
            </div>
            <ul>
                {meeting.items.map((item) => (
                    <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-x-[24px] gap-y-[12px] border-t-[1px] border-line px-[24px] py-[14px]"
                    >
                        <span
                            className={`min-w-0 flex-[1_1_240px] transition-colors duration-200 wrap-anywhere ${
                                item.status === "done"
                                    ? "text-muted line-through decoration-strike"
                                    : ""
                            }`}
                        >
                            {item.text}
                        </span>
                        <StatusButtons
                            status={item.status}
                            itemText={item.text}
                            onChange={(status) => onSetStatus(item.id, status)}
                        />
                    </li>
                ))}
            </ul>
        </article>
    )
}

// Decorative: the "X of Y done" text carries the meaning
function ProgressBar({ ratio }: { ratio: number }) {
    return (
        <div
            aria-hidden="true"
            className="h-[6px] w-[80px] overflow-hidden rounded-full bg-track"
        >
            <div
                className="size-full origin-left rounded-full bg-done-fill transition-transform duration-300 ease-out"
                style={{ transform: `scaleX(${ratio})` }}
            />
        </div>
    )
}
