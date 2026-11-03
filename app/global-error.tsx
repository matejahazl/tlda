"use client"

import "./globals.css"
import { Button } from "@/app/components/Button"

type GlobalErrorPageProps = {
    error: Error & { digest?: string }
    reset: () => void
}

export default function GlobalError({ reset }: GlobalErrorPageProps) {
    return (
        <html lang="en">
            <body>
                <main className="mx-auto flex max-w-page flex-col items-start gap-[16px] px-[32px] py-[48px]">
                    <h1 className="text-heading">Something went wrong</h1>
                    <p className="text-muted">
                        Something went wrong on our side. Please try again.
                    </p>
                    <Button onClick={reset}>Try again</Button>
                </main>
            </body>
        </html>
    )
}
