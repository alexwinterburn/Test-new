export const fmtUsd = (n: number, digits = 2) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const fmtUsdCompact = (n: number) => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-$' : '$'
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1) + 'M'
  if (abs >= 10_000) return sign + (abs / 1_000).toFixed(0) + 'k'
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(1) + 'k'
  return sign + abs.toFixed(0)
}

export const fmtCents = (p: number) => Math.round(p * 100) + '¢'
export const fmtPct = (p: number) => Math.round(p * 100) + '%'
export const fmtPct1 = (p: number) => (p * 100).toFixed(1) + '%'

export const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const fmtDateTime = (t: number) =>
  new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export const fmtAgo = (t: number) => {
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

export const fmtCountdown = (t: number) => {
  const ms = t - Date.now()
  if (ms <= 0) return 'ended'
  const d = Math.floor(ms / 86400000)
  if (d > 30) return Math.round(d / 30) + 'mo left'
  if (d >= 1) return d + 'd left'
  const h = Math.floor(ms / 3600000)
  if (h >= 1) return h + 'h left'
  return Math.max(1, Math.floor(ms / 60000)) + 'm left'
}

export const shortId = () => Math.random().toString(36).slice(2, 10)
