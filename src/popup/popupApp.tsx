import { useEffect, useMemo, useState } from "react"
import { Card, Button, Input, Select, Toggle } from "../shared/ui"
import type { UserConfig } from "../types"
import { getConfig, setConfig } from "../storage/repo"
import { analyzeCompatibilityLocal, generatePersonalMessageLocal } from "../services/ai"

function toKeywords(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
}

export function PopupApp() {
  const [cfg, setCfg] = useState<UserConfig | null>(null)
  const [compat, setCompat] = useState<number | null>(null)
  const [reasons, setReasons] = useState<string[]>([])
  const [automationState, setAutomationState] = useState<{
    running: boolean
    pauseReason: string | null
  }>({ running: false, pauseReason: null })

  useEffect(() => {
    getConfig().then(setCfg)
  }, [])

  useEffect(() => {
    let mounted = true
    const readState = async () => {
      const s = await chrome.runtime.sendMessage({ type: "AF_GET_STATE" }).catch(() => null)
      if (mounted && s?.ok) {
        setAutomationState({ running: !!s.running, pauseReason: s.pauseReason ?? null })
      }
    }
    void readState()
    const t = window.setInterval(readState, 1500)
    return () => {
      mounted = false
      window.clearInterval(t)
    }
  }, [])

  const keywordsText = useMemo(
    () => (cfg ? (cfg.keywords ?? []).join(", ") : ""),
    [cfg]
  )

  if (!cfg) {
    return (
      <div className="w-[380px] p-4">
        <Card title="ApplyFlow AI">
          <div className="text-sm text-white/70">Carregando…</div>
        </Card>
      </div>
    )
  }

  const currentCfg = cfg

  async function save(next: UserConfig) {
    setCfg(next)
    await setConfig(next)
  }

  async function start() {
    await chrome.runtime.sendMessage({ type: "AF_START" })
  }

  async function stop() {
    await chrome.runtime.sendMessage({ type: "AF_STOP" })
  }

  async function resume() {
    await chrome.runtime.sendMessage({ type: "AF_RESUME" })
  }

  async function previewAnalyzeCurrentJob() {
    const res = await chrome.runtime.sendMessage({ type: "AF_GET_ACTIVE_JOB" })
    if (!res?.description) {
      setCompat(null)
      setReasons([])
      return
    }
    const r = analyzeCompatibilityLocal(res.description, currentCfg)
    setCompat(r.score)
    setReasons(r.reasons)
  }

  const msgPreview = generatePersonalMessageLocal(
    currentCfg,
    "Frontend Developer",
    "Empresa"
  )

  return (
    <div className="w-[380px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold tracking-wide">ApplyFlow AI</div>
          <div className="text-xs text-white/50">
            LinkedIn Auto Apply Assistant
          </div>
        </div>
        <a
          className="text-xs text-neon-300 hover:text-neon-200"
          href="dashboard.html"
          target="_blank"
          rel="noreferrer"
        >
          Abrir dashboard
        </a>
      </div>

      <div className="space-y-3">
        <Card
          title="Automação"
          right={
            <span
              className={[
                "text-xs font-semibold",
                cfg.automationEnabled ? "text-neon-300" : "text-white/40"
              ].join(" ")}
            >
              {cfg.automationEnabled ? "ATIVA" : "INATIVA"}
            </span>
          }
        >
          <div className="space-y-2">
            <Toggle
              checked={cfg.automationEnabled}
              onChange={(v) => save({ ...cfg, automationEnabled: v })}
              label="Ativar automação"
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={start}>
                Start
              </Button>
              <Button className="flex-1" variant="ghost" onClick={resume}>
                Retomar
              </Button>
              <Button className="flex-1" variant="ghost" onClick={stop}>
                Stop
              </Button>
            </div>
            {automationState.pauseReason ? (
              <div className="rounded-xl border border-yellow-300/30 bg-yellow-500/10 p-2 text-xs text-yellow-200">
                Pausada: {automationState.pauseReason}
              </div>
            ) : (
              <div className="text-xs text-white/50">
                Status: {automationState.running ? "rodando" : "parada"}
              </div>
            )}
          </div>
        </Card>

        <Card title="Configurações">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Cargo desejado"
              value={cfg.desiredRole}
              onChange={(e) => save({ ...cfg, desiredRole: e.target.value })}
              placeholder="Ex: Frontend Developer"
            />
            <Select
              label="Nível"
              value={cfg.seniority}
              onChange={(e) =>
                save({ ...cfg, seniority: e.target.value as UserConfig["seniority"] })
              }
            >
              <option value="junior">Junior</option>
              <option value="pleno">Pleno</option>
              <option value="senior">Senior</option>
            </Select>
            <Input
              label="Localização"
              value={cfg.location}
              onChange={(e) => save({ ...cfg, location: e.target.value })}
              placeholder="Ex: São Paulo"
            />
            <Select
              label="Modalidade"
              value={cfg.workMode}
              onChange={(e) =>
                save({ ...cfg, workMode: e.target.value as UserConfig["workMode"] })
              }
            >
              <option value="remoto">Remoto</option>
              <option value="hibrido">Híbrido</option>
              <option value="presencial">Presencial</option>
            </Select>
            <div className="col-span-2">
              <Input
                label="Palavras-chave (separadas por vírgula)"
                value={keywordsText}
                onChange={(e) =>
                  save({ ...cfg, keywords: toKeywords(e.target.value) })
                }
                placeholder="react, typescript, graphql"
              />
            </div>
            <Input
              label="Limite/dia"
              type="number"
              value={cfg.dailyLimit}
              onChange={(e) =>
                save({ ...cfg, dailyLimit: Number(e.target.value) || 0 })
              }
            />
            <Input
              label="Delay min (ms)"
              type="number"
              value={cfg.delayMinMs}
              onChange={(e) =>
                save({ ...cfg, delayMinMs: Number(e.target.value) || 0 })
              }
            />
            <Input
              label="Delay max (ms)"
              type="number"
              value={cfg.delayMaxMs}
              onChange={(e) =>
                save({ ...cfg, delayMaxMs: Number(e.target.value) || 0 })
              }
            />
          </div>
        </Card>

        <Card title="IA — Compatibilidade">
          <div className="space-y-2">
            <Button variant="ghost" onClick={previewAnalyzeCurrentJob}>
              Analisar vaga aberta (preview)
            </Button>
            {compat !== null ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">Compatibilidade</div>
                <div className="text-2xl font-bold text-neon-300">
                  {compat}%
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {reasons.length ? (
                    reasons.map((r) => (
                      <span
                        key={r}
                        className="rounded-lg border border-white/10 bg-bg-800/60 px-2 py-1 text-xs text-white/70"
                      >
                        {r}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-white/50">
                      Sem matches de palavras-chave.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-white/50">
                Abra uma vaga no LinkedIn Jobs para analisar.
              </div>
            )}
          </div>
        </Card>

        <Card title="IA — Mensagem personalizada (preview)">
          <div className="text-sm text-white/70">{msgPreview}</div>
        </Card>

        <Card title="Atalhos">
          <div className="flex gap-2">
            <a
              className="flex-1"
              href="options.html"
              target="_blank"
              rel="noreferrer"
            >
              <Button className="w-full" variant="ghost">
                Opções
              </Button>
            </a>
            <a
              className="flex-1"
              href="https://www.linkedin.com/jobs/"
              target="_blank"
              rel="noreferrer"
            >
              <Button className="w-full" variant="ghost">
                LinkedIn Jobs
              </Button>
            </a>
          </div>
        </Card>
      </div>
    </div>
  )
}

