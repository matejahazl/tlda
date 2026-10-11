import { Spinner } from "./Spinner"

const SKELETON_WIDTHS = ["w-3/5", "w-1/2", "w-7/12"] // one per placeholder row

export function SkeletonCard({ title }: { title: string }) {
    return (
        <article
            aria-busy="true"
            className="overflow-hidden rounded-[16px] bg-card shadow-card motion-safe:animate-enter motion-reduce:animate-fade"
        >
            <div className="flex items-center gap-[14px] px-[24px] py-[20px]">
                <Spinner tone="dark" />
                <div className="flex min-w-0 flex-col">
                    <h2 className="wrap-anywhere">{title}</h2>
                    <p className="text-sm text-muted">
                        Extracting action items from your notes…
                    </p>
                </div>
            </div>
            {SKELETON_WIDTHS.map((width) => (
                <div
                    key={width}
                    aria-hidden="true"
                    className="flex items-center justify-between gap-[16px] border-t-[1px] border-line px-[24px] py-[16px]"
                >
                    <div
                        className={`h-[16px] rounded-[8px] bg-skeleton motion-safe:animate-pulse-soft ${width}`}
                    />
                    <div className="h-[40px] w-[228px] flex-none rounded-[8px] bg-skeleton motion-safe:animate-pulse-soft" />
                </div>
            ))}
        </article>
    )
}
