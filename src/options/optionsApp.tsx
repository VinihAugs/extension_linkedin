import { useEffect, useMemo, useState } from "react"
import { Button, Card, Input } from "../shared/ui"
import type { UserConfig } from "../types"
import { getBlockedCompanies, getConfig, setBlockedCompanies, setConfig } from "../storage/repo"

function toKeywords(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
}

export function OptionsApp() {
  const [cfg, setCfg] = useState<UserConfig | null>(null)
  const [blocked, setBlocked] = useState<string[]>([])
  const [blockedText, setBlockedText] = useState("")

  useEffect(() => {
    getConfig().then(setCfg)
    getBlockedCompanies().then((b) => {
      setBlocked(b)
      setBlockedText(b.join("\n"))
    })
  }, [])

  const keywordsText = useMemo(
    () => (cfg ? (cfg.keywords ?? []).join(", ") : ""),
    [cfg]
  )

  if (!cfg) {
    return (
      <div className="min-h-screen p-6">
        <Card title="ApplyFlow AI — Opções">
          <div className="text-sm text-white/70">Carregando…</div>
        </Card>
      </div>
    )
  }

  async function saveCfg(next: UserConfig) {
    setCfg(next)
    await setConfig(next)
  }

  async function saveBlocked() {
    const list = blockedText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
    setBlocked(list)
    await setBlockedCompanies(list)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(60%_60%_at_50%_0%,rgba(124,58,237,.35),rgba(7,10,18,1))] p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">ApplyFlow AI</div>
            <div className="text-sm text-white/60">
              Configurações avançadas e blacklist
            </div>
          </div>
          <a href="dashboard.html" target="_blank" rel="noreferrer">
            <Button variant="ghost">Abrir dashboard</Button>
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Preferências">
            <div className="grid grid-cols-1 gap-3">
              <Input
                label="Cargo desejado"
                value={cfg.desiredRole}
                onChange={(e) => saveCfg({ ...cfg, desiredRole: e.target.value })}
              />
              <Input
                label="Localização"
                value={cfg.location}
                onChange={(e) => saveCfg({ ...cfg, location: e.target.value })}
              />
              <Input
                label="Keywords (vírgula)"
                value={keywordsText}
                onChange={(e) =>
                  saveCfg({ ...cfg, keywords: toKeywords(e.target.value) })
                }
              />
              <Input
                label="OpenAI API Key (opcional)"
                value={cfg.openAiApiKey ?? ""}
                onChange={(e) =>
                  saveCfg({ ...cfg, openAiApiKey: e.target.value || undefined })
                }
                placeholder="sk-..."
              />
              <Input
                label="Nome do arquivo do currículo (opcional)"
                value={cfg.resumeFileName ?? ""}
                onChange={(e) =>
                  saveCfg({ ...cfg, resumeFileName: e.target.value || undefined })
                }
                placeholder="curriculo.pdf"
              />
            </div>
          </Card>

          <Card
            title="Blacklist de empresas"
            right={
              <span className="text-xs text-white/50">
                {blocked.length} bloqueadas
              </span>
            }
          >
            <div className="space-y-3">
              <div className="text-sm text-white/70">
                Vagas dessas empresas serão ignoradas automaticamente.
              </div>
              <textarea
                value={blockedText}
                onChange={(e) => setBlockedText(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-white/10 bg-bg-800/60 p-3 text-sm text-white outline-none focus:border-neon-400/60 focus:ring-2 focus:ring-neon-400/20"
                placeholder={"Empresa X\nEmpresa Y"}
              />
              <div className="flex justify-end">
                <Button onClick={saveBlocked}>Salvar blacklist</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

