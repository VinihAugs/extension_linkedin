import { useEffect, useMemo, useState } from "react"
import { Button, Card } from "../shared/ui"
import type { AppliedJob, LogEvent, Metrics } from "../types"
import { getAppliedJobs, getLogs, getMetrics } from "../storage/repo"

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-glow">
      <div className="text-xs font-medium text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-bold text-neon-300">{value}</div>
    </div>
  )
}

export function DashboardApp() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [applied, setApplied] = useState<AppliedJob[]>([])
  const [automationState, setAutomationState] = useState<{
    running: boolean
    pauseReason: string | null
  }>({ running: false, pauseReason: null })

  async function refresh() {
    const [m, l, a] = await Promise.all([getMetrics(), getLogs(), getAppliedJobs()])
    setMetrics(m)
    setLogs(l)
    setApplied(a)
    const s = await chrome.runtime.sendMessage({ type: "AF_GET_STATE" }).catch(() => null)
    if (s?.ok) {
      setAutomationState({ running: !!s.running, pauseReason: s.pauseReason ?? null })
    }
  }

  useEffect(() => {
    refresh()
    const t = window.setInterval(refresh, 2000)
    return () => window.clearInterval(t)
  }, [])

  const topCompanies = useMemo(() => {
    const c = metrics?.companiesApplied ?? {}
    return Object.entries(c)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
  }, [metrics])

  return (
    <div className="min-h-screen bg-[radial-gradient(60%_60%_at_50%_0%,rgba(124,58,237,.35),rgba(7,10,18,1))] p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Dashboard — ApplyFlow AI</div>
            <div className="text-sm text-white/60">
              Métricas, histórico e logs em tempo real
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => chrome.runtime.sendMessage({ type: "AF_START" })}>
              Start
            </Button>
            <Button variant="ghost" onClick={() => chrome.runtime.sendMessage({ type: "AF_RESUME" })}>
              Retomar
            </Button>
            <Button variant="ghost" onClick={() => chrome.runtime.sendMessage({ type: "AF_STOP" })}>
              Stop
            </Button>
            <Button onClick={refresh}>Atualizar</Button>
          </div>
        </div>

        {automationState.pauseReason ? (
          <div className="rounded-2xl border border-yellow-300/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            Automação pausada: {automationState.pauseReason}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            Status da automação: {automationState.running ? "rodando" : "parada"}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <StatCard label="Applications Today" value={`${metrics?.appliedToday ?? 0}`} />
          <StatCard label="Total Applied" value={`${metrics?.totalApplied ?? 0}`} />
          <StatCard label="Interviews" value={`${metrics?.interviews ?? 0}`} />
          <StatCard label="Response Rate" value={`${Math.round((metrics?.responseRate ?? 0) * 100)}%`} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Empresas (top)">
            {topCompanies.length ? (
              <div className="space-y-2">
                {topCompanies.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between rounded-xl border border-white/10 bg-bg-800/40 px-3 py-2">
                    <div className="text-sm text-white/80">{name}</div>
                    <div className="text-sm font-semibold text-neon-300">{count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-white/60">Sem dados ainda.</div>
            )}
          </Card>

          <Card title="Histórico (últimas aplicações)">
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {applied.slice(0, 40).map((j) => (
                <a
                  key={j.jobId}
                  href={j.jobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-white/10 bg-bg-800/40 px-3 py-2 hover:bg-bg-800/70"
                >
                  <div className="text-sm font-semibold text-white/90">{j.title ?? "Vaga"}</div>
                  <div className="text-xs text-white/60">
                    {j.company ?? "Empresa"} • {new Date(j.appliedAt).toLocaleString()}
                    {typeof j.compatibilityScore === "number" ? ` • ${j.compatibilityScore}%` : ""}
                  </div>
                </a>
              ))}
              {!applied.length && <div className="text-sm text-white/60">Nada por aqui ainda.</div>}
            </div>
          </Card>

          <Card title="Logs (tempo real)">
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1 font-mono text-xs">
              {logs.slice(0, 120).map((l) => (
                <div
                  key={l.id}
                  className="rounded-xl border border-white/10 bg-bg-800/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={[
                        "font-semibold",
                        l.level === "error"
                          ? "text-red-300"
                          : l.level === "warn"
                            ? "text-yellow-300"
                            : "text-neon-300"
                      ].join(" ")}
                    >
                      {l.level.toUpperCase()}
                    </span>
                    <span className="text-white/40">
                      {new Date(l.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-1 text-white/80">{l.message}</div>
                </div>
              ))}
              {!logs.length && <div className="text-sm text-white/60">Sem logs ainda.</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

