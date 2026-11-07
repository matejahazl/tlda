import type { ComponentProps, ReactNode } from "react"

type TextareaProps = Omit<ComponentProps<"textarea">, "className" | "id"> & {
    id: string
    label: ReactNode
    error?: string
}

export function Textarea({ id, label, error, ...rest }: TextareaProps) {
    const hintId = `${id}-hint`

    return (
        <div className="flex flex-col gap-[6px]">
            <label htmlFor={id} className="text-label">
                {label}
            </label>
            <textarea
                {...rest}
                id={id}
                className="field min-h-[240px] resize-y"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? hintId : undefined}
            />
            {error && (
                <p id={hintId} className="text-meta">
                    {error}
                </p>
            )}
        </div>
    )
}
