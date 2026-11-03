import type { ComponentProps, ReactNode } from "react"

type TextInputProps = Omit<ComponentProps<"input">, "className" | "id"> & {
    id: string
    label: ReactNode
    error?: string
}

export function TextInput({ id, label, error, ...rest }: TextInputProps) {
    const hintId = `${id}-hint`
    return (
        <div className="flex flex-col gap-[6px]">
            <label htmlFor={id} className="text-label">
                {label}
            </label>
            <input
                {...rest}
                id={id}
                type="text"
                className="field"
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
