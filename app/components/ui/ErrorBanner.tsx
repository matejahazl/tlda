import { WarningIcon } from "../icons"

type ErrorBannerProps = {
    title: string
    message: string
}

export function ErrorBanner({ title, message }: ErrorBannerProps) {
    return (
        <div
            role="alert"
            className="flex gap-[12px] rounded-[12px] bg-danger p-[16px] text-danger-ink shadow-danger"
        >
            <WarningIcon className="size-[20px] flex-none translate-y-[2px]" />
            <div className="flex flex-col gap-[2px]">
                <strong className="font-semibold">{title}</strong>
                <span className="text-meta text-pretty text-danger-ink">
                    {message}
                </span>
            </div>
        </div>
    )
}
