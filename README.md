# extension_linkedin

# ApplyFlow AI — LinkedIn Auto Apply Assistant

Extensão MV3 (Chrome/Edge/Opera/Firefox) para automatizar candidaturas **Easy Apply** no LinkedIn, com filtros, “score” de compatibilidade (IA local) e **dashboard** de métricas/logs.

## Requisitos

- Node.js 20+ (você está com Node 22)

## Rodar / Buildar

```bash
npm install
npm run build
```

O build sai em `dist/`.

## Instalar localmente (Chrome/Edge/Opera)

- Abra `chrome://extensions`
- Ative **Developer mode**
- Clique em **Load unpacked**
- Selecione a pasta `dist/`

## Instalar localmente (Firefox)

- Abra `about:debugging#/runtime/this-firefox`
- Clique em **Load Temporary Add-on…**
- Selecione o arquivo `dist/manifest.json`

## Uso básico

- Abra o LinkedIn Jobs em `https://www.linkedin.com/jobs/`
- Clique no ícone da extensão (popup)
- Ajuste filtros, **ative “Ativar automação”** e clique em **Start**
- Acompanhe métricas/logs em `dashboard.html` (link no popup)

## O que está implementado (MVP funcional)

- **Config (popup/options)**: cargo, nível, localização, keywords, modalidade, limite/dia, delays, blacklist de empresas
- **Busca automatizada**: abre LinkedIn Jobs com filtro `Easy Apply`
- **Detecção Easy Apply**: identifica “Easy Apply” / “Candidatura simplificada”
- **Auto-apply (best-effort)**: abre vaga, inicia Easy Apply e tenta avançar/submit no modal
- **Automação segura**: delays aleatórios (min/max), limite diário, logs
- **IA local**: score por keywords + sinais de modalidade/senioridade (preview no popup)
- **Dashboard**: cards (Applications Today, Total Applied, Interviews, Response Rate), empresas top, histórico, logs em tempo real

## Limitações importantes (por segurança do navegador/LinkedIn)

- **Upload de currículo**: browsers não permitem selecionar arquivo local automaticamente em `input[type=file]` sem interação do usuário. O fluxo “upload automático” aqui é **best-effort** e pode exigir clique manual em alguns casos.
- LinkedIn muda o DOM frequentemente: os seletores do content script são heurísticos e podem precisar de ajustes.

