type SeniorityLevel = "junior" | "pleno" | "senior"
type WorkMode = "remoto" | "hibrido" | "presencial"

type UserConfig = {
  desiredRole: string
  seniority: SeniorityLevel
  location: string
  keywords: string[]
  workMode: WorkMode
  dailyLimit: number
  delayMinMs: number
  delayMaxMs: number
  automationEnabled: boolean
}

type AppliedJob = {
  jobId: string
  jobUrl: string
  company?: string
  title?: string
  appliedAt: number
  compatibilityScore?: number
}

type LogEvent = {
  id: string
  ts: number
  level: "info" | "warn" | "error"
  message: string
  meta?: Record<string, unknown>
}

type Metrics = {
  totalApplied: number
  appliedToday: number
  companiesApplied: Record<string, number>
  responseRate: number
  interviews: number
  avgCompatibility: number
}

const STORAGE_KEYS = {
  config: "applyflow.config.v1",
  appliedJobs: "applyflow.appliedJobs.v1",
  blockedCompanies: "applyflow.blockedCompanies.v1",
  logs: "applyflow.logs.v1",
  metrics: "applyflow.metrics.v1",
  daily: "applyflow.daily.v1"
} as const

const DEFAULT_CONFIG: UserConfig = {
  desiredRole: "Frontend Developer",
  seniority: "pleno",
  location: "Brasil",
  keywords: ["react", "typescript", "frontend"],
  workMode: "remoto",
  dailyLimit: 20,
  delayMinMs: 2000,
  delayMaxMs: 8000,
  automationEnabled: false
}

const DEFAULT_METRICS: Metrics = {
  totalApplied: 0,
  appliedToday: 0,
  companiesApplied: {},
  responseRate: 0,
  interviews: 0,
  avgCompatibility: 0
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function startOfLocalDayTs(ts = Date.now()) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim()
}

function analyzeCompatibilityLocal(
  jobDescription: string,
  cfg: Pick<UserConfig, "keywords" | "desiredRole" | "seniority" | "workMode">
) {
  const text = norm(jobDescription)
  const keywords = (cfg.keywords ?? []).map(norm).filter(Boolean)
  const hits = keywords.filter((k) => text.includes(k))
  const hitRatio = keywords.length ? hits.length / keywords.length : 0
  const workModeBoost =
    cfg.workMode === "remoto" && /remote|remoto|home office|anywhere/.test(text)
      ? 0.08
      : cfg.workMode === "hibrido" && /hybrid|híbrido|hibrido/.test(text)
        ? 0.06
        : cfg.workMode === "presencial" && /on[- ]site|presencial/.test(text)
          ? 0.04
          : 0
  const seniorityPenalty =
    cfg.seniority === "junior" && /senior|sr\b|staff|principal|lead/.test(text)
      ? 0.25
      : cfg.seniority === "pleno" && /staff|principal|lead/.test(text)
        ? 0.12
        : 0
  const base = 0.45 + hitRatio * 0.55 + workModeBoost - seniorityPenalty
  return { score: Math.round(Math.max(0, Math.min(1, base)) * 100) }
}

async function getConfig(): Promise<UserConfig> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.config)
  return { ...DEFAULT_CONFIG, ...(res[STORAGE_KEYS.config] ?? {}) }
}

async function getAppliedJobs(): Promise<AppliedJob[]> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.appliedJobs)
  return (res[STORAGE_KEYS.appliedJobs] as AppliedJob[] | undefined) ?? []
}

async function addAppliedJob(job: AppliedJob): Promise<void> {
  const list = await getAppliedJobs()
  await chrome.storage.local.set({
    [STORAGE_KEYS.appliedJobs]: [job, ...list].slice(0, 5000)
  })
}

async function getBlockedCompanies(): Promise<string[]> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.blockedCompanies)
  return (res[STORAGE_KEYS.blockedCompanies] as string[] | undefined) ?? []
}

async function addLog(
  level: LogEvent["level"],
  message: string,
  meta?: LogEvent["meta"]
) {
  const res = await chrome.storage.local.get(STORAGE_KEYS.logs)
  const logs = (res[STORAGE_KEYS.logs] as LogEvent[] | undefined) ?? []
  const item: LogEvent = { id: uid("log"), ts: Date.now(), level, message, meta }
  await chrome.storage.local.set({ [STORAGE_KEYS.logs]: [item, ...logs].slice(0, 2000) })
}

async function getDailyState(): Promise<{ dayStartTs: number; appliedCount: number }> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.daily)
  const s = res[STORAGE_KEYS.daily] as
    | { dayStartTs: number; appliedCount: number }
    | undefined
  const today = startOfLocalDayTs()
  if (!s || s.dayStartTs !== today) {
    const next = { dayStartTs: today, appliedCount: 0 }
    await chrome.storage.local.set({ [STORAGE_KEYS.daily]: next })
    return next
  }
  return s
}

async function incAppliedToday() {
  const s = await getDailyState()
  const next = { ...s, appliedCount: s.appliedCount + 1 }
  await chrome.storage.local.set({ [STORAGE_KEYS.daily]: next })
  return next
}

async function getMetrics(): Promise<Metrics> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.metrics)
  return (res[STORAGE_KEYS.metrics] as Metrics | undefined) ?? DEFAULT_METRICS
}

async function setMetrics(m: Metrics): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.metrics]: m })
}

type BgState = {
  running: boolean
  tabId?: number
  pauseReason?: string
}

const state: BgState = { running: false }

function buildJobsSearchUrl(cfg: Awaited<ReturnType<typeof getConfig>>) {
  const keywords = encodeURIComponent(cfg.desiredRole || "developer")
  const location = encodeURIComponent(cfg.location || "")
  // f_AL=true => Easy Apply (Apply filter)
  // f_WT: 2 remote, 1 onsite, 3 hybrid (varia, mas ajuda)
  const f_WT =
    cfg.workMode === "remoto" ? "2" : cfg.workMode === "hibrido" ? "3" : "1"
  return `https://www.linkedin.com/jobs/search/?keywords=${keywords}&location=${location}&f_AL=true&f_WT=${f_WT}`
}

async function ensureJobsTab(): Promise<number> {
  const cfg = await getConfig()
  const url = buildJobsSearchUrl(cfg)

  const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/jobs/*" })
  const existing = tabs[0]
  if (existing?.id != null) {
    state.tabId = existing.id
    await chrome.tabs.update(existing.id, { active: true, url })
    return existing.id
  }

  const t = await chrome.tabs.create({ url, active: true })
  state.tabId = t.id
  return t.id!
}

async function startAutomation() {
  const cfg = await getConfig()
  if (!cfg.automationEnabled) {
    await addLog("warn", "Automação não iniciada: toggle está desativado.")
    return
  }

  const daily = await getDailyState()
  if (daily.appliedCount >= cfg.dailyLimit) {
    await addLog(
      "warn",
      `Limite diário atingido (${daily.appliedCount}/${cfg.dailyLimit}).`
    )
    return
  }

  state.running = true
  state.pauseReason = undefined
  const tabId = await ensureJobsTab()
  await addLog("info", "Automação iniciada.", { tabId })

  await triggerContentStart(tabId)
}

async function stopAutomation() {
  state.running = false
  if (state.tabId != null) {
    await chrome.tabs.sendMessage(state.tabId, { type: "AF_CONTENT_STOP" }).catch(
      () => {}
    )
  }
  await addLog("info", "Automação parada.")
}

async function pauseAutomation(reason: string, meta?: Record<string, unknown>) {
  state.running = false
  state.pauseReason = reason
  if (state.tabId != null) {
    await chrome.tabs.sendMessage(state.tabId, { type: "AF_CONTENT_STOP" }).catch(
      () => {}
    )
  }
  await addLog("warn", `Automação pausada: ${reason}`, meta)
}

async function triggerContentStart(tabId: number): Promise<boolean> {
  for (let attempt = 0; attempt < 8; attempt++) {
    let sent = await chrome.tabs
      .sendMessage(tabId, { type: "AF_CONTENT_START" })
      .then(() => true)
      .catch(() => false)

    if (!sent) {
      // Fallback: injeta programaticamente quando a aba já estava aberta antes do reload da extensão.
      await chrome.scripting
        .executeScript({
          target: { tabId },
          files: ["content/index.js"]
        })
        .catch(() => {})

      sent = await chrome.tabs
        .sendMessage(tabId, { type: "AF_CONTENT_START" })
        .then(() => true)
        .catch(() => false)
    }

    if (sent) return true
    await new Promise((resolve) => setTimeout(resolve, 700))
  }
  await addLog(
    "warn",
    "Não foi possível iniciar content script imediatamente. Aguardando carregamento da aba."
  )
  return false
}

async function updateMetricsOnApplied(job: AppliedJob) {
  const m = await getMetrics()
  const next: Metrics = {
    ...m,
    totalApplied: m.totalApplied + 1,
    appliedToday: (await getDailyState()).appliedCount,
    companiesApplied: {
      ...m.companiesApplied,
      ...(job.company
        ? { [job.company]: (m.companiesApplied[job.company] ?? 0) + 1 }
        : {})
    },
    avgCompatibility:
      typeof job.compatibilityScore === "number"
        ? Math.round(
            (m.avgCompatibility * Math.max(0, m.totalApplied) +
              job.compatibilityScore) /
              Math.max(1, m.totalApplied + 1)
          )
        : m.avgCompatibility
  }
  await setMetrics(next)
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ;(async () => {
    if (msg?.type === "AF_START") {
      await startAutomation()
      sendResponse({ ok: true })
      return
    }

    if (msg?.type === "AF_STOP") {
      await stopAutomation()
      sendResponse({ ok: true })
      return
    }

    if (msg?.type === "AF_RESUME") {
      state.pauseReason = undefined
      await addLog("info", "Retomando automação por ação do usuário.")
      await startAutomation()
      sendResponse({ ok: true })
      return
    }

    if (msg?.type === "AF_LOG") {
      await addLog(msg.level ?? "info", msg.message ?? "", msg.meta)
      sendResponse({ ok: true })
      return
    }

    if (msg?.type === "AF_GET_ACTIVE_JOB") {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      })
      if (!tab?.id) {
        sendResponse({ ok: false })
        return
      }
      const res = await chrome.tabs
        .sendMessage(tab.id, { type: "AF_EXTRACT_JOB" })
        .catch(() => null)
      sendResponse(res)
      return
    }

    if (msg?.type === "AF_SHOULD_SKIP") {
      const [applied, blocked, cfg] = await Promise.all([
        getAppliedJobs(),
        getBlockedCompanies(),
        getConfig()
      ])
      const already = applied.some((j) => j.jobId === msg.jobId)
      const blockedCompany =
        typeof msg.company === "string" &&
        blocked.some((b) => b.toLowerCase() === msg.company.toLowerCase())

      // skip seniority acima (heurística simples por texto)
      const titleText = String(msg.title ?? "").toLowerCase()
      const seniorityTooHigh =
        cfg.seniority === "junior" &&
        /(senior|sr\b|lead|staff|principal)/.test(titleText)
          ? true
          : cfg.seniority === "pleno" &&
              /(staff|principal)/.test(titleText)
            ? true
            : false

      sendResponse({
        skip: already || blockedCompany || seniorityTooHigh,
        reason: already
          ? "already_applied"
          : blockedCompany
            ? "blocked_company"
            : seniorityTooHigh
              ? "seniority_too_high"
              : null
      })
      return
    }

    if (msg?.type === "AF_APPLIED") {
      const cfg = await getConfig()
      const daily = await incAppliedToday()
      const comp = msg.description
        ? analyzeCompatibilityLocal(msg.description, cfg)
        : null

      const job: AppliedJob = {
        jobId: msg.jobId,
        jobUrl: msg.jobUrl,
        company: msg.company,
        title: msg.title,
        appliedAt: Date.now(),
        compatibilityScore: comp?.score
      }

      await addAppliedJob(job)
      await addLog("info", "Aplicação registrada.", {
        jobId: msg.jobId,
        company: msg.company,
        appliedToday: daily.appliedCount,
        compatibility: comp?.score
      })
      await updateMetricsOnApplied(job)

      // se bater limite, para
      if (daily.appliedCount >= cfg.dailyLimit) {
        await addLog(
          "warn",
          `Limite diário atingido (${daily.appliedCount}/${cfg.dailyLimit}). Parando.`
        )
        await stopAutomation()
      }

      sendResponse({ ok: true })
      return
    }

    if (msg?.type === "AF_PAUSE") {
      await pauseAutomation(String(msg.reason ?? "pausa solicitada"), msg.meta)
      sendResponse({ ok: true })
      return
    }

    if (msg?.type === "AF_GET_STATE") {
      sendResponse({
        ok: true,
        running: state.running,
        pauseReason: state.pauseReason ?? null
      })
      return
    }

    sendResponse({ ok: false })
  })()

  return true
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  ;(async () => {
    if (!state.running) return
    if (changeInfo.status !== "complete") return
    if (!tab.url?.startsWith("https://www.linkedin.com/jobs/")) return
    await triggerContentStart(tabId)
  })()
})

export {}

