import { create } from "zustand"
import type { AutomationStatus, UserConfig } from "../types"
import { DEFAULT_CONFIG } from "../storage/defaults"

type AppState = {
  config: UserConfig
  status: AutomationStatus
  setConfig: (cfg: UserConfig) => void
  setStatus: (st: AutomationStatus) => void
}

export const useAppStore = create<AppState>((set) => ({
  config: DEFAULT_CONFIG,
  status: { state: "idle" },
  setConfig: (config) => set({ config }),
  setStatus: (status) => set({ status })
}))

