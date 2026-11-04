import { useLoadMeetings } from "@/app/hooks"
import type { ItemStatus, Meeting, PaginatedMeetings } from "@/types"
import { MeetingCard } from "./MeetingCard"
import { SkeletonCard } from "./SkeletonCard"
import { LoadMore } from "./ui"

type MeetingListProps = {
    meetings: Meeting[]
    isExtracting: boolean
    onSetStatus: (itemId: number, status: ItemStatus) => void
    onDeleted: (meeting: Meeting) => void
    nextCursor: number | null
    onLoaded: (page: PaginatedMeetings) => void
}

export function MeetingList({
    meetings,
    isExtracting,
    onSetStatus,
    onDeleted,
    nextCursor,
    onLoaded,
}: MeetingListProps) {
    const loader = useLoadMeetings(onLoaded)

    return (
        <section
            aria-label="Meetings"
            className="flex min-w-0 flex-[999_1_560px] flex-col gap-[20px]"
        >
            {isExtracting && <SkeletonCard />}
            {meetings.map((meeting) => (
                <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onSetStatus={onSetStatus}
                    onDeleted={onDeleted}
                />
            ))}
            {nextCursor !== null && (
                <LoadMore
                    pending={loader.pending}
                    failed={loader.failed}
                    onLoadMore={() => void loader.loadMore(nextCursor)}
                />
            )}
            {meetings.length === 0 && !isExtracting && nextCursor === null && (
                <div className="flex flex-col items-center gap-[6px] rounded-[16px] px-[32px] py-[56px] text-center shadow-field">
                    <h2 className="text-heading">No meetings yet</h2>
                    <p className="max-w-[320px] text-pretty text-muted">
                        Paste your meeting notes and the action items will show
                        up here, ready to track.
                    </p>
                </div>
            )}
        </section>
    )
}
