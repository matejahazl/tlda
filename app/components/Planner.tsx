"use client"

import { PlannerProvider } from "@/app/context"
import type { PaginatedMeetings } from "@/types"
import { MeetingForm } from "./MeetingForm"
import { MeetingList } from "./MeetingList"

type PlannerProps = {
    initialPage: PaginatedMeetings
}

export function Planner({ initialPage }: PlannerProps) {
    return (
        <PlannerProvider initialMeetings={initialPage.meetings}>
            <header className="mx-auto flex max-w-page flex-wrap items-end justify-between gap-[16px] px-[32px] pb-[28px] pt-[48px]">
                <div className="flex flex-col gap-[6px]">
                    <h1>TL;DA</h1>
                    <p className="text-tagline text-muted">
                        Too long; do actions.
                    </p>
                    <p className="pt-[6px]">
                        Paste your meeting notes and get the to-dos.
                    </p>
                </div>
                <a className="btn-primary lg:hidden" href="#meeting-form">
                    New meeting notes
                </a>
            </header>
            <main className="mx-auto flex max-w-page flex-wrap items-start gap-[32px] px-[32px] pb-[72px]">
                <MeetingList initialCursor={initialPage.nextCursor} />
                <MeetingForm />
            </main>
        </PlannerProvider>
    )
}
