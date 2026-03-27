import type { PropsWithChildren, ReactNode } from "react"

export function Card({
  title,
  right,
  children
}: PropsWithChildren<{ title?: string; right?: ReactNode }>) {
  return (
    <div className="rounded-2xl border border-white/10 bg-bg-900/80 shadow-glow">
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="text-sm font-semibold tracking-wide text-white/90">
            {title}
          </div>
          {right}
        </div>
      )}
      <div className="px-4 py-4">{children}</div>
    </div>
  )
}

export function Button({
  children,
  variant = "primary",
  ...props
}: PropsWithChildren<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "danger"
  }
>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-neon-400/70 disabled:opacity-60 disabled:cursor-not-allowed"
  const styles =
    variant === "primary"
      ? "bg-neon-500/90 hover:bg-neon-500 text-white shadow-glow"
      : variant === "danger"
        ? "bg-red-500/90 hover:bg-red-500 text-white"
        : "bg-white/5 hover:bg-white/10 text-white/90 border border-white/10"

  return (
    <button className={`${base} ${styles}`} {...props}>
      {children}
    </button>
  )
}

export function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-white/70">{label}</div>
      <input
        {...props}
        className="w-full rounded-xl border border-white/10 bg-bg-800/60 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-neon-400/60 focus:ring-2 focus:ring-neon-400/20"
      />
    </label>
  )
}

export function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-white/70">{label}</div>
      <select
        {...props}
        className="w-full rounded-xl border border-white/10 bg-bg-800/60 px-3 py-2 text-sm text-white outline-none focus:border-neon-400/60 focus:ring-2 focus:ring-neon-400/20"
      >
        {children}
      </select>
    </label>
  )
}

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
      onClick={() => onChange(!checked)}
    >
      <span className="text-white/80">{label}</span>
      <span
        className={[
          "relative inline-flex h-6 w-11 items-center rounded-full transition",
          checked ? "bg-neon-500/90" : "bg-white/10"
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white transition",
            checked ? "translate-x-5" : "translate-x-1"
          ].join(" ")}
        />
      </span>
    </button>
  )
}

