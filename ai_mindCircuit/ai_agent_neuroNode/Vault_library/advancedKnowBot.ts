import {
  AELIRASENSE_INSIGHTS_CAPABILITIES as CAPABILITIES,
  INSIGHT_FLAGS as FLAGS,
} from "./capabilities"
import {
  AELIRASENSE_INSIGHTS_DESCRIPTION as DESCRIPTION,
  INSIGHTS_VERSION as VERSION,
} from "./description"
import { AELIRASENSE_INSIGHTS_BOT_ID as BOT_ID } from "./name"
import { INSIGHTS_TOOLKIT as TOOLKIT } from "./tools"

import type { AssistantProfile } from "@/aelirasense/agent"

export const aelirasenseInsightsBot: AssistantProfile = Object.freeze({
  id: BOT_ID,
  version: VERSION,
  label: "aelirasense-insights",
  promptBase: DESCRIPTION,
  features: {
    ...CAPABILITIES,
    flags: FLAGS,
  },
  extensions: TOOLKIT,
} as const)
