import type { Outcome, Side } from './types'

// ---------------------------------------------------------------------------
// Constant-product AMM (Polymarket-style CPMM) over YES/NO share pools.
// price(YES) = noPool / (yesPool + noPool)
// ---------------------------------------------------------------------------

export const price = (o: Outcome, side: Side = 'yes'): number => {
  const p = o.noPool / (o.yesPool + o.noPool)
  return side === 'yes' ? p : 1 - p
}

export interface BuyQuote {
  shares: number
  avgPrice: number
  newPrice: number // new YES probability after the trade
  priceImpact: number
  maxPayout: number
}

/** Quote buying `amount` dollars of `side` shares. Pure — does not mutate. */
export const quoteBuy = (o: Outcome, side: Side, amount: number): BuyQuote => {
  const { yesPool, noPool } = o
  const k = yesPool * noPool
  let shares: number
  let ny = yesPool
  let nn = noPool
  if (side === 'yes') {
    // deposit `amount` into both pools, withdraw yes shares keeping k constant
    shares = yesPool + amount - k / (noPool + amount)
    ny = yesPool + amount - shares
    nn = noPool + amount
  } else {
    shares = noPool + amount - k / (yesPool + amount)
    nn = noPool + amount - shares
    ny = yesPool + amount
  }
  const p0 = price(o, side)
  const newYes = nn / (ny + nn)
  const p1 = side === 'yes' ? newYes : 1 - newYes
  return {
    shares,
    avgPrice: shares > 0 ? amount / shares : p0,
    newPrice: newYes,
    priceImpact: p1 - p0,
    maxPayout: shares,
  }
}

export interface SellQuote {
  proceeds: number
  avgPrice: number
  newPrice: number
  priceImpact: number
}

/** Quote selling `shares` of `side`. Solves the CPMM invariant quadratic. */
export const quoteSell = (o: Outcome, side: Side, shares: number): SellQuote => {
  const yes = side === 'yes' ? o.yesPool : o.noPool
  const no = side === 'yes' ? o.noPool : o.yesPool
  // user returns s shares, receives r dollars: (yes + s - r)(no - r) = yes*no
  const s = shares
  const b = yes + s + no
  const r = (b - Math.sqrt(b * b - 4 * s * no)) / 2
  const ny = side === 'yes' ? yes + s - r : no - r
  const nn = side === 'yes' ? no - r : yes + s - r
  const p0 = price(o, side)
  const newYes = nn / (ny + nn)
  const p1 = side === 'yes' ? newYes : 1 - newYes
  return { proceeds: r, avgPrice: s > 0 ? r / s : p0, newPrice: newYes, priceImpact: p1 - p0 }
}

/** Apply a buy to the pools (mutates a copy, returns it). */
export const applyBuy = (o: Outcome, side: Side, amount: number): Outcome => {
  const q = quoteBuy(o, side, amount)
  const k = o.yesPool * o.noPool
  if (side === 'yes') {
    const nn = o.noPool + amount
    return { ...o, noPool: nn, yesPool: k / nn }
  } else {
    const ny = o.yesPool + amount
    return { ...o, yesPool: ny, noPool: k / ny }
  }
}

export const applySell = (o: Outcome, side: Side, shares: number): Outcome => {
  const q = quoteSell(o, side, shares)
  if (side === 'yes') {
    return { ...o, yesPool: o.yesPool + shares - q.proceeds, noPool: o.noPool - q.proceeds }
  } else {
    return { ...o, noPool: o.noPool + shares - q.proceeds, yesPool: o.yesPool - q.proceeds }
  }
}

/** Build pools seeded with `liquidity` dollars at initial probability p. */
export const seedPools = (liquidity: number, p: number): { yesPool: number; noPool: number } => {
  // choose pools so price = p and geometric liquidity depth ~ liquidity
  const clamped = Math.min(0.98, Math.max(0.02, p))
  const yesPool = liquidity * (1 - clamped) * 2
  const noPool = liquidity * clamped * 2
  return { yesPool, noPool }
}

/** Approximate dollar value sitting in an outcome's AMM pools. */
export const poolValue = (o: Outcome): number => {
  const p = price(o)
  return o.yesPool * p + o.noPool * (1 - p)
}

/** Dollars required to push the YES price up by `dp` (bisection on the CPMM). */
export const costToMove = (o: Outcome, dp: number): number => {
  const target = Math.min(0.99, price(o) + dp)
  let lo = 0
  let hi = (o.yesPool + o.noPool) * 2
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const k = o.yesPool * o.noPool
    const nn = o.noPool + mid
    const ny = k / nn
    if (nn / (ny + nn) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Dollars needed to move price to a limit — used to fill crossable limit orders. */
export const crossesLimit = (o: Outcome, side: Side, limitPrice: number): boolean =>
  price(o, side) <= limitPrice + 1e-9
