import "./globals.css"
import type { Metadata } from "next"
import { Geist, Instrument_Serif } from "next/font/google"

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
})

const instrumentSerif = Instrument_Serif({
    variable: "--font-instrument-serif",
    weight: "400",
    subsets: ["latin"],
})

export const metadata: Metadata = {
    title: "TL;DA",
    description: "Paste your meeting notes and get the to-dos.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${instrumentSerif.variable} h-full antialiased`}
        >
            <body className="min-h-full">{children}</body>
        </html>
    )
}
