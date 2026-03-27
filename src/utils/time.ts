export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function randInt(min: number, max: number) {
  const a = Math.ceil(min)
  const b = Math.floor(max)
  return Math.floor(Math.random() * (b - a + 1)) + a
}

export function humanDelay(minMs: number, maxMs: number) {
  const jitter = randInt(minMs, maxMs)
  return sleep(jitter)
}

export function startOfLocalDayTs(ts = Date.now()) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

