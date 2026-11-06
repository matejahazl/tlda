import "server-only"
import { getLlmIntegrationService } from "@/integrations"
import { getDb } from "@/lib/server/db"
import { AskService } from "./AskService"
import { MeetingService } from "./MeetingService"

export { AskService } from "./AskService"
export { MeetingService } from "./MeetingService"

export function getMeetingService(): MeetingService {
    return new MeetingService(getDb(), getLlmIntegrationService())
}

export function getAskService(): AskService {
    return new AskService()
}
