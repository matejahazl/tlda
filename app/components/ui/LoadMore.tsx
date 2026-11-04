import { Button } from "./Button"

type LoadMoreProps = {
    pending: boolean
    failed: boolean
    onLoadMore: () => void
}

export function LoadMore({ pending, failed, onLoadMore }: LoadMoreProps) {
    return (
        <div className="flex flex-col items-center gap-[10px] pt-[4px]">
            {failed && (
                <p role="alert" className="text-meta text-danger-ink">
                    Couldn&apos;t load more items.
                </p>
            )}
            <Button
                variant="secondary"
                size="sm"
                pending={pending}
                onClick={onLoadMore}
            >
                {pending ? "Loading…" : failed ? "Try again" : "Load more"}
            </Button>
        </div>
    )
}
