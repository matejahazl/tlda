import "server-only"
import { getLlmIntegrationService } from "@/integrations"
import { getDb } from "@/lib/server/db"
import { MeetingService } from "./MeetingService"

export { MeetingService } from "./MeetingService"

export function getMeetingService(): MeetingService {
    return new MeetingService(getDb(), getLlmIntegrationService())
}
