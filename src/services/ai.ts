import type { UserConfig } from "../types"

export type CompatibilityResult = {
  score: number
  reasons: string[]
  summary?: string
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim()
}

export function analyzeCompatibilityLocal(
  jobDescription: string,
  cfg: Pick<UserConfig, "keywords" | "desiredRole" | "seniority" | "workMode">
): CompatibilityResult {
  const text = norm(jobDescription)
  const keywords = (cfg.keywords ?? []).map(norm).filter(Boolean)

  const hits = keywords.filter((k) => text.includes(k))
  const hitRatio = keywords.length ? hits.length / keywords.length : 0

  // Heurística simples: keywords + sinais de modalidade + senioridade
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
  const score = Math.max(0, Math.min(1, base))

  return {
    score: Math.round(score * 100),
    reasons: hits.slice(0, 8)
  }
}

export function generatePersonalMessageLocal(
  cfg: Pick<UserConfig, "desiredRole" | "keywords">,
  jobTitle?: string,
  company?: string
) {
  const kws = (cfg.keywords ?? []).slice(0, 6).join(", ")
  const parts = [
    company ? `Olá, time da ${company}.` : "Olá!",
    `Tenho interesse na vaga${jobTitle ? ` de ${jobTitle}` : ""} e experiência prática em ${kws || "desenvolvimento de produtos digitais"}.`,
    `Atuo com foco em impacto, qualidade e colaboração, e acredito que posso contribuir como ${cfg.desiredRole}.`
  ]
  return parts.join(" ")
}

