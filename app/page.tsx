import { Planner } from "@/app/components"
import { getMeetingService } from "@/services"

export const dynamic = "force-dynamic" // the list changes, never prerender it

export default function Home() {
    return <Planner initialPage={getMeetingService().list()} />
}
