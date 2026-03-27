type Area = "local" | "sync"

function getArea(area: Area) {
  // Firefox/Chrome/Edge/Opera expõem `chrome`. (Para Firefox, o user pode habilitar "chrome" alias).
  return chrome.storage[area]
}

export async function storageGet<T>(
  key: string,
  area: Area = "local"
): Promise<T | undefined> {
  const res = await getArea(area).get(key)
  return res[key] as T | undefined
}

export async function storageSet<T>(
  key: string,
  value: T,
  area: Area = "local"
): Promise<void> {
  await getArea(area).set({ [key]: value })
}

export async function storageRemove(key: string, area: Area = "local") {
  await getArea(area).remove(key)
}

