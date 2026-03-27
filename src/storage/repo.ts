import type { AppliedJob, LogEvent, Metrics, UserConfig } from "../types"
import { uid } from "../utils/id"
import { startOfLocalDayTs } from "../utils/time"
import { storageGet, storageSet } from "./chromeStorage"
import { DEFAULT_CONFIG, DEFAULT_METRICS } from "./defaults"
import { STORAGE_KEYS } from "./keys"

export async function getConfig(): Promise<UserConfig> {
  const cfg = await storageGet<UserConfig>(STORAGE_KEYS.config)
  return { ...DEFAULT_CONFIG, ...(cfg ?? {}) }
}

export async function setConfig(next: UserConfig): Promise<void> {
  await storageSet(STORAGE_KEYS.config, next)
}

export async function getBlockedCompanies(): Promise<string[]> {
  return (await storageGet<string[]>(STORAGE_KEYS.blockedCompanies)) ?? []
}

export async function setBlockedCompanies(list: string[]): Promise<void> {
  await storageSet(STORAGE_KEYS.blockedCompanies, list)
}

export async function getAppliedJobs(): Promise<AppliedJob[]> {
  return (await storageGet<AppliedJob[]>(STORAGE_KEYS.appliedJobs)) ?? []
}

export async function addAppliedJob(job: AppliedJob): Promise<void> {
  const list = await getAppliedJobs()
  await storageSet(STORAGE_KEYS.appliedJobs, [job, ...list].slice(0, 5000))
}

export async function getLogs(): Promise<LogEvent[]> {
  return (await storageGet<LogEvent[]>(STORAGE_KEYS.logs)) ?? []
}

export async function addLog(
  level: LogEvent["level"],
  message: string,
  meta?: LogEvent["meta"]
) {
  const log: LogEvent = { id: uid("log"), ts: Date.now(), level, message, meta }
  const list = await getLogs()
  await storageSet(STORAGE_KEYS.logs, [log, ...list].slice(0, 2000))
}

type DailyState = { dayStartTs: number; appliedCount: number }

export async function getDailyState(): Promise<DailyState> {
  const s = await storageGet<DailyState>(STORAGE_KEYS.daily)
  const today = startOfLocalDayTs()
  if (!s || s.dayStartTs !== today) {
    const next = { dayStartTs: today, appliedCount: 0 }
    await storageSet(STORAGE_KEYS.daily, next)
    return next
  }
  return s
}

export async function incAppliedToday(): Promise<DailyState> {
  const s = await getDailyState()
  const next = { ...s, appliedCount: s.appliedCount + 1 }
  await storageSet(STORAGE_KEYS.daily, next)
  return next
}

export async function getMetrics(): Promise<Metrics> {
  return (await storageGet<Metrics>(STORAGE_KEYS.metrics)) ?? DEFAULT_METRICS
}

export async function setMetrics(m: Metrics): Promise<void> {
  await storageSet(STORAGE_KEYS.metrics, m)
}

