const TAB = 9
const LINE_FEED = 10
const FIRST_PRINTABLE = 32
const DELETE = 127

// Removes control characters but keeps newlines and tabs
export function stripControlChars(value: string): string {
    return Array.from(value)
        .filter((char) => {
            const code = char.codePointAt(0) ?? 0
            return (
                code === TAB ||
                code === LINE_FEED ||
                (code >= FIRST_PRINTABLE && code !== DELETE)
            )
        })
        .join("")
}

export function cleanText(value: string): string {
    return stripControlChars(value).trim()
}

export function isSingleLine(value: string): boolean {
    return !/[\r\n]/.test(value)
}
