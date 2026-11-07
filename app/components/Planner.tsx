"use client"

import { PlannerProvider } from "@/app/context"
import type { PaginatedMeetings } from "@/types"
import { AskPanel } from "./AskPanel"
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
                    <div className="flex flex-wrap items-baseline-last gap-x-[16px] gap-y-[4px]">
                        <h1>TL;DA</h1>
                        <p className="text-tagline">
                            <span className="block">Too long;</span>
                            <span className="block">do actions.</span>
                        </p>
                    </div>
                    <p className="pt-[6px]">
                        Paste your meeting notes and get the to-dos.
                    </p>
                </div>
                <div className="flex flex-wrap gap-[8px] lg:hidden">
                    <a
                        className="btn-link bg-accent text-on-accent hover-fine:bg-accent-hover"
                        href="#meeting-form"
                    >
                        New meeting notes
                    </a>
                    <a
                        className="btn-link bg-segment text-ink hover-fine:bg-segment-hover"
                        href="#ask"
                    >
                        Ask about your meetings
                    </a>
                </div>
            </header>
            <main className="mx-auto flex max-w-page flex-wrap items-start gap-[32px] px-[32px] pb-[72px]">
                <MeetingList initialCursor={initialPage.nextCursor} />
                <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-[24px]">
                    <MeetingForm />
                    <AskPanel />
                </div>
            </main>
        </PlannerProvider>
    )
}
