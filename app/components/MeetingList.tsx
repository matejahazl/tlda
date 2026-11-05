import { usePlanner } from "@/app/context"
import { useLoadMeetings } from "@/app/hooks"
import { MeetingCard } from "./MeetingCard"
import { SkeletonCard } from "./SkeletonCard"
import { LoadMore } from "./ui"

type MeetingListProps = {
    initialCursor: number | null
}

export function MeetingList({ initialCursor }: MeetingListProps) {
    const { meetings, listAnnouncement, extractPhase, appendMeetings } =
        usePlanner()
    const { hasMore, pending, failed, loadMore } = useLoadMeetings(
        initialCursor,
        appendMeetings,
    )
    const isExtracting = extractPhase === "processing"

    return (
        <section
            aria-label="Meetings"
            className="flex min-w-0 flex-[999_1_560px] flex-col gap-[20px]"
        >
            {isExtracting && <SkeletonCard />}
            {meetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
            {hasMore && (
                <LoadMore
                    pending={pending}
                    failed={failed}
                    onLoadMore={() => void loadMore()}
                />
            )}
            {meetings.length === 0 && !isExtracting && !hasMore && (
                <div className="flex flex-col items-center gap-[6px] rounded-[16px] px-[32px] py-[56px] text-center shadow-field">
                    <h2 className="text-heading">No meetings yet</h2>
                    <p className="max-w-[320px] text-pretty text-muted">
                        Paste your meeting notes and the action items will show
                        up here, ready to track.
                    </p>
                </div>
            )}
            {/* always rendered, so screen readers pick up the first message too */}
            <p aria-live="polite" className="sr-only">
                {listAnnouncement}
            </p>
        </section>
    )
}
