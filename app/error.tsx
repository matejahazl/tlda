"use client"

import { Button } from "@/app/components/Button"

type ErrorPageProps = {
    error: Error & { digest?: string }
    reset: () => void
}

export default function ErrorPage({ reset }: ErrorPageProps) {
    return (
        <main className="mx-auto flex max-w-page flex-col items-start gap-[16px] px-[32px] py-[48px]">
            <h1 className="text-heading">Something went wrong</h1>
            <p className="text-muted">
                Something went wrong on our side. Please try again.
            </p>
            <Button onClick={reset}>Try again</Button>
        </main>
    )
}
