export type SeniorityLevel = "junior" | "pleno" | "senior"
export type WorkMode = "remoto" | "hibrido" | "presencial"

export type UserConfig = {
  desiredRole: string
  seniority: SeniorityLevel
  location: string
  keywords: string[]
  workMode: WorkMode
  dailyLimit: number
  delayMinMs: number
  delayMaxMs: number
  automationEnabled: boolean
  /**
   * Se true, clica no container da linha da lista (não no link do título) para alinhar o painel
   * direito ao Easy Apply — mais candidaturas. Se false, só usa botões já visíveis.
   */
  selectJobViaRowContainer: boolean
  resumeFileName?: string
  openAiApiKey?: string
}

export type AppliedJob = {
  jobId: string
  jobUrl: string
  company?: string
  title?: string
  appliedAt: number
  compatibilityScore?: number
}

export type AutomationStatus =
  | { state: "idle" }
  | { state: "running"; startedAt: number; appliedToday: number }
  | { state: "paused"; reason: string }
  | { state: "error"; message: string }

export type LogLevel = "info" | "warn" | "error"
export type LogEvent = {
  id: string
  ts: number
  level: LogLevel
  message: string
  meta?: Record<string, unknown>
}

export type Metrics = {
  totalApplied: number
  appliedToday: number
  companiesApplied: Record<string, number>
  responseRate: number
  interviews: number
  avgCompatibility: number
}

