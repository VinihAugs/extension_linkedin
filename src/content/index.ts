let running = false
let loopInProgress = false

/** IDs de vagas já processados nesta execução (evita repetir na mesma leva visível). */
const processedJobIdsThisRun = new Set<string>()

type UserConfig = {
  desiredRole: string
  seniority: "junior" | "pleno" | "senior"
  location: string
  keywords: string[]
  workMode: "remoto" | "hibrido" | "presencial"
  dailyLimit: number
  delayMinMs: number
  delayMaxMs: number
  automationEnabled: boolean
  selectJobViaRowContainer: boolean
}

const STORAGE_KEYS = {
  config: "applyflow.config.v1"
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
  automationEnabled: false,
  selectJobViaRowContainer: true
}

/** Entre passos dentro do modal (regra do usuário). */
const CLICK_DELAY_MIN = 500
const CLICK_DELAY_MAX = 1500

/** Entre uma vaga e outra (regra do usuário). */
const BETWEEN_JOBS_MIN = 2000
const BETWEEN_JOBS_MAX = 5000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randInt(min: number, max: number) {
  const a = Math.ceil(min)
  const b = Math.floor(max)
  return Math.floor(Math.random() * (b - a + 1)) + a
}

async function betweenModalClicks() {
  await sleep(randInt(CLICK_DELAY_MIN, CLICK_DELAY_MAX))
}

async function betweenJobsDelay() {
  await sleep(randInt(BETWEEN_JOBS_MIN, BETWEEN_JOBS_MAX))
}

async function getConfig(): Promise<UserConfig> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.config)
  return { ...DEFAULT_CONFIG, ...(res[STORAGE_KEYS.config] ?? {}) }
}

function q<T extends Element = Element>(sel: string, root: ParentNode = document) {
  return root.querySelector(sel) as T | null
}

function qa<T extends Element = Element>(sel: string, root: ParentNode = document) {
  return Array.from(root.querySelectorAll(sel)) as T[]
}

function isVisible(el: HTMLElement) {
  const s = window.getComputedStyle(el)
  if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight
}

async function log(message: string, meta?: Record<string, unknown>, level: "info" | "warn" | "error" = "info") {
  await chrome.runtime.sendMessage({ type: "AF_LOG", level, message, meta })
}

function getJobIdFromUrl(url: string) {
  const m = url.match(/currentJobId=(\d+)/) || url.match(/\/view\/(\d+)/)
  return m?.[1] ?? url
}

function getVisibleJobUrl(): string {
  return window.location.href
}

function getJobTitle(): string | undefined {
  const h1 = q<HTMLElement>("h1")
  const t = h1?.innerText?.trim()
  return t || undefined
}

function getCompanyName(): string | undefined {
  const el =
    q<HTMLElement>(".job-details-jobs-unified-top-card__company-name") ||
    q<HTMLElement>(".jobs-unified-top-card__company-name") ||
    q<HTMLElement>('[data-test-job-card-company-name]')
  const t = el?.innerText?.trim()
  return t || undefined
}

function getJobDescription(): string {
  const desc =
    q<HTMLElement>("#job-details") ||
    q<HTMLElement>(".jobs-description__content") ||
    q<HTMLElement>(".jobs-box__html-content") ||
    q<HTMLElement>('[data-job-description]')
  return desc?.innerText?.trim() ?? ""
}

/** Painel de detalhes (direita), sem a lista. */
function getJobDetailsRoot(): HTMLElement | null {
  return (
    q<HTMLElement>(".jobs-search__job-details") ||
    q<HTMLElement>(".jobs-details-top-card") ||
    q<HTMLElement>("#job-details")?.closest("div") ||
    null
  )
}

function buttonLabel(el: HTMLElement) {
  return (el.innerText || el.getAttribute("aria-label") || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/** Easy Apply / Candidatura simplificada / Apply quando claramente in-app (texto curto). */
function isEasyApplyButton(el: HTMLElement): boolean {
  const t = buttonLabel(el)
  const aria = (el.getAttribute("aria-label") || "").toLowerCase()

  if (
    t.includes("easy apply") ||
    t.includes("candidatura simplificada") ||
    t.includes("candidatura rápida") ||
    t.includes("candidatura rapida") ||
    aria.includes("easy apply") ||
    aria.includes("candidatura simplificada")
  ) {
    return true
  }

  if (el.matches("button.jobs-apply-button, a.jobs-apply-button")) return true

  if (t === "apply" && (el.closest(".jobs-search__job-details") || el.closest(".jobs-apply-button")))
    return true

  return false
}

function findEasyApplyInScope(root: ParentNode): HTMLElement | null {
  const candidates = qa<HTMLElement>("button, a[role='button'], a.jobs-apply-button", root)
  for (const b of candidates) {
    if (!isVisible(b)) continue
    if (isEasyApplyButton(b)) return b
  }
  return q<HTMLElement>("button.jobs-apply-button", root as ParentNode)
}

/**
 * Clica no container da linha (split view), evitando `<a href=".../jobs/view/...">` —
 * não abre nova aba nem página inteira da vaga.
 */
async function focusJobRowForDetailsPanel(row: HTMLElement) {
  const avoid = row.querySelectorAll<HTMLElement>('a[href*="/jobs/view/"], a.job-card-list__title--link')

  const tryClick = async (el: HTMLElement | null) => {
    if (!el || !isVisible(el)) return false
    for (const a of avoid) {
      if (a === el || a.contains(el) || el.contains(a)) return false
    }
    await click(el)
    return true
  }

  const container =
    row.querySelector<HTMLElement>(".job-card-container--clickable") ||
    row.querySelector<HTMLElement>(".job-card-list__entity-lockup") ||
    row.querySelector<HTMLElement>("div.job-card-container") ||
    null

  if (await tryClick(container)) return

  const hit = row.querySelector<HTMLElement>("div[class*='job-card-list']:not(a)")
  if (await tryClick(hit)) return

  await click(row)
}

function getJobIdFromRow(row: HTMLElement): string | null {
  const occ = row.getAttribute("data-occludable-job-id")
  if (occ && /^\d+$/.test(occ)) return occ

  const withAttr = row.querySelector("[data-job-id]")
  const dj = withAttr?.getAttribute("data-job-id")
  if (dj && /^\d+$/.test(dj)) return dj

  const a = row.querySelector<HTMLAnchorElement>('a[href*="/jobs/view/"], a[href*="currentJobId"]')
  if (a?.href) return getJobIdFromUrl(a.href)

  return null
}

function parseRowTitleCompany(row: HTMLElement) {
  const title =
    row.querySelector<HTMLElement>(".job-card-list__title")?.innerText?.trim() ||
    row.querySelector<HTMLElement>("[class*='job-card-list__title']")?.innerText?.trim()
  const company =
    row.querySelector<HTMLElement>(".job-card-container__primary-description")?.innerText?.trim() ||
    row.querySelector<HTMLElement>(".job-card-container__company-name")?.innerText?.trim() ||
    row.querySelector<HTMLElement>(".artdeco-entity-lockup__subtitle")?.innerText?.trim()
  return { title, company }
}

function getJobListCards(): HTMLElement[] {
  const withJobLink = (el: HTMLElement) =>
    !!q<HTMLElement>("a[href*='/jobs/view/']", el) ||
    !!q<HTMLElement>("a[href*='currentJobId']", el) ||
    !!q<HTMLElement>("a[href*='linkedin.com/jobs']", el)

  const trySelectors = [
    "ul.jobs-search-results__list > li",
    ".jobs-search-results-list li.jobs-search-results__list-item",
    ".jobs-search-results__list-item",
    "li[data-occludable-job-id]",
    "li.scaffold-layout__list-item",
    ".job-card-container--clickable",
    ".job-card-container"
  ]

  for (const sel of trySelectors) {
    const raw = qa<HTMLElement>(sel)
    const filtered = raw.filter(withJobLink)
    if (filtered.length) return filtered
    if (raw.length) return raw
  }

  const listRoot =
    q<HTMLElement>(".jobs-search-results-list") ||
    q<HTMLElement>("ul.scaffold-layout__list") ||
    q<HTMLElement>(".scaffold-layout__list")

  if (listRoot) {
    const lis = qa<HTMLElement>("li", listRoot)
    const filtered = lis.filter(withJobLink)
    if (filtered.length) return filtered
    if (lis.length) return lis
  }
  return []
}

function getVisibleJobRows(): HTMLElement[] {
  return getJobListCards().filter((row) => isVisible(row))
}

function scrollJobsListDown() {
  const scroller =
    q<HTMLElement>(".jobs-search-results-list") ||
    q<HTMLElement>(".scaffold-layout__list-container") ||
    q<HTMLElement>(".scaffold-layout__list")
  if (scroller) scroller.scrollBy({ top: Math.min(480, window.innerHeight * 0.75), behavior: "smooth" })
}

function modalShowsApplicationSent(modal: HTMLElement): boolean {
  const t = modal.innerText.toLowerCase()
  return (
    t.includes("application was submitted") ||
    t.includes("your application has been sent") ||
    t.includes("you've applied") ||
    t.includes("you applied") ||
    t.includes("candidatura enviada") ||
    t.includes("candidatura foi enviada") ||
    t.includes("sua candidatura foi enviada") ||
    t.includes("aplicación enviada")
  )
}

async function click(el: Element) {
  const node = el as HTMLElement
  node.scrollIntoView({ block: "center" })
  node.focus?.()
  node.click()
  node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
  node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
  node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
  node.dispatchEvent(new MouseEvent("click", { bubbles: true }))
}

async function fillSimpleFieldsInModal(modal: HTMLElement) {
  for (const sel of qa<HTMLSelectElement>("select", modal)) {
    if (!sel.required || sel.value) continue
    if (sel.options.length > 1) {
      sel.selectedIndex = 1
      sel.dispatchEvent(new Event("change", { bubbles: true }))
    }
  }

  const textInputs = qa<HTMLInputElement>("input[type='text'], input:not([type])", modal)
  for (const inp of textInputs) {
    if (!inp.required || inp.value) continue
    if (inp.placeholder?.toLowerCase().includes("optional")) continue
  }

  const groups = new Set<string>()
  for (const radio of qa<HTMLInputElement>("input[type='radio']", modal)) {
    const name = radio.name
    if (!name || groups.has(name)) continue
    groups.add(name)
    const checked = qa<HTMLInputElement>("input[type='radio']", modal).find(
      (r) => r.name === name && r.checked
    )
    if (!checked) {
      radio.click()
      break
    }
  }
}

function hasRequiredFileUploadWithoutFile() {
  const modal = q<HTMLElement>(".artdeco-modal")
  if (!modal) return false
  const fileInputs = qa<HTMLInputElement>("input[type='file']", modal)
  if (!fileInputs.length) return false
  return fileInputs.some((input) => {
    const requiredByAttr = input.required || input.getAttribute("aria-required") === "true"
    return requiredByAttr && !input.files?.length
  })
}

function getDismissButton(): HTMLButtonElement | null {
  const modal = q<HTMLElement>(".artdeco-modal")
  if (!modal) return null
  return (
    q<HTMLButtonElement>("button[aria-label*='Fechar']", modal) ||
    q<HTMLButtonElement>("button[aria-label*='Close']", modal) ||
    q<HTMLButtonElement>("button.artdeco-modal__dismiss", modal)
  )
}

/**
 * Próximo botão do fluxo: Submit > Done > Review > Next (e equivalentes PT).
 */
function findModalContinuationButton(modal: HTMLElement): HTMLButtonElement | null {
  const buttons = qa<HTMLButtonElement>("button", modal).filter((b) => !b.disabled && isVisible(b))

  const byText = (pred: (t: string) => boolean) => buttons.find((b) => pred(buttonLabel(b)))

  return (
    byText((t) => /submit application|submeter candidatura|enviar candidatura|send/i.test(t)) ||
    byText((t) => /^done$|^dismiss$|concluíd|fechar modal|close/i.test(t)) ||
    byText((t) => /^review\b|revisar|revisão/i.test(t)) ||
    byText((t) => /^next\b|avançar|continuar|próximo|proximo/i.test(t)) ||
    buttons.find((b) => b.classList.contains("artdeco-button--primary")) ||
    null
  )
}

function logLabelForButton(label: string): string {
  const t = label.toLowerCase()
  if (/submit|enviar candidatura|send/i.test(t)) return "Submetendo candidatura"
  if (/^review\b|revisar/i.test(t)) return "Clicando Review"
  if (/^next\b|avançar|continuar|próximo|proximo/i.test(t)) return "Clicando Next"
  if (/done|concluíd|dismiss|fechar/i.test(t)) return "Clicando Done"
  return "Avançando no modal"
}

async function runEasyApplyFromButton(startBtn: HTMLElement): Promise<{
  submitted: boolean
  reason: "modal_not_open" | "required_resume_upload" | null
}> {
  await log("Aplicando vaga")
  await betweenModalClicks()
  await click(startBtn)

  for (let i = 0; i < 40; i++) {
    if (q(".artdeco-modal")) break
    await sleep(150)
  }

  let modal = q<HTMLElement>(".artdeco-modal")
  if (!modal) {
    await log("Modal de candidatura não detectado após Easy Apply.", {}, "warn")
    return { submitted: false, reason: "modal_not_open" }
  }

  let stagnant = 0
  let sentLogged = false

  for (let step = 0; step < 45 && running; step++) {
    modal = q<HTMLElement>(".artdeco-modal") || modal
    if (!modal) break

    if (modalShowsApplicationSent(modal)) {
      if (!sentLogged) {
        await log("Aplicação enviada")
        sentLogged = true
      }
      break
    }

    if (hasRequiredFileUploadWithoutFile()) {
      await log("Upload obrigatório sem arquivo — pausando para ação manual.", { step }, "warn")
      return { submitted: false, reason: "required_resume_upload" }
    }

    await fillSimpleFieldsInModal(modal)
    await betweenModalClicks()

    const btn = findModalContinuationButton(modal)
    if (!btn) {
      stagnant++
      if (stagnant >= 5) {
        await log("Sem botão de continuação no modal — interrompendo esta vaga.", { step }, "warn")
        break
      }
      await sleep(400)
      continue
    }

    stagnant = 0
    const rawLabel = (btn.innerText || btn.getAttribute("aria-label") || "").trim()
    await log(logLabelForButton(rawLabel), { rotulo: rawLabel })
    await click(btn)

    if (/submit application|submeter|enviar candidatura|send/i.test(buttonLabel(btn))) {
      await betweenModalClicks()
    }

    await sleep(randInt(200, 450))
    modal = q<HTMLElement>(".artdeco-modal") || modal
    if (modal && modalShowsApplicationSent(modal)) {
      if (!sentLogged) {
        await log("Aplicação enviada")
        sentLogged = true
      }
      break
    }
    if (!q(".artdeco-modal")) {
      if (!sentLogged) {
        await log("Aplicação enviada")
        sentLogged = true
      }
      break
    }
  }

  if (q(".artdeco-modal")) {
    const m = q<HTMLElement>(".artdeco-modal")!
    if (modalShowsApplicationSent(m) && !sentLogged) {
      await log("Aplicação enviada")
      sentLogged = true
    }
    const dismiss = getDismissButton()
    if (dismiss) {
      await betweenModalClicks()
      await click(dismiss)
    }
  }

  const stillOpen = !!q(".artdeco-modal")
  const submitted = sentLogged || (!stillOpen && !hasRequiredFileUploadWithoutFile())
  return { submitted, reason: null }
}

async function loop() {
  if (loopInProgress) {
    await log("Loop já estava em execução. Ignorando novo start.", {}, "warn")
    return
  }
  loopInProgress = true
  processedJobIdsThisRun.clear()

  const cfg = await getConfig()
  await log("Content script loop iniciado.", {
    selectJobViaRowContainer: cfg.selectJobViaRowContainer
  })

  for (let i = 0; i < 60; i++) {
    if (
      q(".jobs-search-results-list") ||
      q(".jobs-search-results__list") ||
      q(".scaffold-layout__list")
    )
      break
    await sleep(250)
  }

  let firstJob = true
  let outerRounds = 0

  while (running && outerRounds < 80) {
    outerRounds++
    let rows = getVisibleJobRows()
    if (!rows.length) {
      scrollJobsListDown()
      await sleep(800)
      rows = getVisibleJobRows()
      if (!rows.length) {
        await log("Nenhuma vaga visível na lista.", { url: window.location.href }, "warn")
        break
      }
    }

    await log("Diagnóstico: vagas visíveis na lista.", { total: rows.length })

    let progressedThisRound = false

    for (const row of rows) {
      if (!running) break

      const jobId = getJobIdFromRow(row)
      if (!jobId) continue
      if (processedJobIdsThisRun.has(jobId)) continue

      let easyBtn = findEasyApplyInScope(row)

      if (!easyBtn) {
        const details = getJobDetailsRoot()
        if (details) {
          const urlId = getJobIdFromUrl(getVisibleJobUrl())
          if (urlId === jobId) easyBtn = findEasyApplyInScope(details)
        }
      }

      if (!easyBtn && cfg.selectJobViaRowContainer) {
        await log("Selecionando vaga pelo container da linha (sem link do título).", { jobId })
        await focusJobRowForDetailsPanel(row)
        await sleep(randInt(400, 900))
        easyBtn =
          findEasyApplyInScope(row) ||
          (getJobDetailsRoot() ? findEasyApplyInScope(getJobDetailsRoot()!) : null)
      }

      if (!easyBtn) {
        await log("Pulando vaga", {
          motivo: cfg.selectJobViaRowContainer ? "sem_easy_apply" : "sem_easy_apply_visivel_sem_clique_no_card",
          jobId,
          nota: cfg.selectJobViaRowContainer
            ? undefined
            : "Ative em Opções: seleção pelo container da linha, ou alinhe o painel manualmente."
        })
        processedJobIdsThisRun.add(jobId)
        if (!firstJob) await betweenJobsDelay()
        firstJob = false
        continue
      }

      const { title: titleRow, company: companyRow } = parseRowTitleCompany(row)
      await log("Easy Apply encontrado", { jobId })

      const skipRes = await chrome.runtime.sendMessage({
        type: "AF_SHOULD_SKIP",
        jobId,
        company: companyRow ?? getCompanyName(),
        title: titleRow ?? getJobTitle()
      })

      if (skipRes?.skip) {
        await log("Pulando vaga", {
          motivo: skipRes.reason ?? "filtro",
          jobId
        })
        processedJobIdsThisRun.add(jobId)
        if (!firstJob) await betweenJobsDelay()
        firstJob = false
        continue
      }

      const jobUrl = getVisibleJobUrl()
      const company = companyRow ?? getCompanyName()
      const title = titleRow ?? getJobTitle()
      const desc = getJobDescription()

      const result = await runEasyApplyFromButton(easyBtn)

      if (result.reason === "required_resume_upload") {
        await chrome.runtime.sendMessage({
          type: "AF_PAUSE",
          reason:
            "Upload obrigatório sem currículo anexado no Easy Apply. Complete manualmente e clique em Retomar.",
          meta: { jobId, company, title }
        })
        running = false
        break
      }

      if (result.submitted) {
        await chrome.runtime.sendMessage({
          type: "AF_APPLIED",
          jobId,
          jobUrl,
          company,
          title,
          description: desc
        })
        await log("Próxima vaga", { jobId })
      }

      processedJobIdsThisRun.add(jobId)
      progressedThisRound = true
      firstJob = false
      await betweenJobsDelay()
    }

    if (!progressedThisRound) {
      scrollJobsListDown()
      await sleep(900)
    }
  }

  await log("Loop finalizado (parado ou sem mais vagas).")
  loopInProgress = false
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  ;(async () => {
    if (msg?.type === "AF_CONTENT_START") {
      running = true
      void loop()
      sendResponse({ ok: true })
      return
    }
    if (msg?.type === "AF_CONTENT_STOP") {
      running = false
      loopInProgress = false
      sendResponse({ ok: true })
      return
    }
    if (msg?.type === "AF_EXTRACT_JOB") {
      sendResponse({
        ok: true,
        title: getJobTitle(),
        company: getCompanyName(),
        description: getJobDescription(),
        url: getVisibleJobUrl()
      })
      return
    }
    sendResponse({ ok: false })
  })()
  return true
})

export {}
