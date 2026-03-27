import type { Metrics, UserConfig } from "../types"

export const DEFAULT_CONFIG: UserConfig = {
  desiredRole: "Frontend Developer",
  seniority: "pleno",
  location: "Brasil",
  keywords: ["react", "typescript", "frontend"],
  workMode: "remoto",
  dailyLimit: 20,
  delayMinMs: 2000,
  delayMaxMs: 8000,
  automationEnabled: false,
  selectJobViaRowContainer: true
}

export const DEFAULT_METRICS: Metrics = {
  totalApplied: 0,
  appliedToday: 0,
  companiesApplied: {},
  responseRate: 0,
  interviews: 0,
  avgCompatibility: 0
}

