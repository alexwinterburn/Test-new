import { useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { price, quoteBuy, quoteSell } from '../lib/engine'
import { fmtAgo, fmtCents, fmtCountdown, fmtDate, fmtPct, fmtPct1, fmtUsd, fmtUsdCompact } from '../lib/format'
import { PriceChart } from '../components/charts'
import { Avatar, StatusBadge, Tabs, Empty } from '../components/ui'
import { KycModal } from '../components/auth'
import type { Market, Side } from '../lib/types'

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']
const RANGES = [{ l: '1D', ms: 86400000 }, { l: '1W', ms: 7 * 86400000 }, { l: '1M', ms: 30 * 86400000 }, { l: 'All', ms: Infinity }]

interface Shell { openAuth: () => void; openKyc: () => void }

export const MarketDetail = () => {
  const { id } = useParams()
  const { state, currentUser, trade, placeLimitOrder, cancelOrder, openPositionCost, toggleWatch, createAlert, addToSlip } = useStore()
  const { openAuth } = useOutletContext<Shell>()
  const m = state.markets.find(x => x.id === id)

  const [outcomeId, setOutcomeId] = useState<string | null>(null)
  const [side, setSide] = useState<Side>('yes')
  const [mode, setMode] = useState<'buy' | 'sell'>('buy')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [amount, setAmount] = useState('25')
  const [limitPrice, setLimitPrice] = useState('50')
  const [limitShares, setLimitShares] = useState('100')
  const [range, setRange] = useState('1M')
  const [kycReason, setKycReason] = useState<string | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertCond, setAlertCond] = useState<'above' | 'below'>('above')
  const [alertPct, setAlertPct] = useState('70')
  const [intel, setIntel] = useState<'activity' | 'holders' | 'brief'>('activity')

  if (!m) return <main className="page-inner"><Empty icon="🤷" text="Market not found" /></main>

  const isMulti = m.type === 'multi'
  const selOutcome = m.outcomes.find(o => o.id === outcomeId) ?? m.outcomes[0]
  const p = price(selOutcome)
  const sidePrice = side === 'yes' ? p : 1 - p

  const rangeMs = RANGES.find(r => r.l === range)!.ms
  const cut = Date.now() - rangeMs
  const chartSeries = useMemo(() => {
    const outs = isMulti ? [...m.outcomes].sort((a, b) => price(b) - price(a)).slice(0, 4) : [m.outcomes[0]]
    return outs.map(o => ({
      label: isMulti ? o.label : 'Yes',
      points: (m.history[o.id] ?? []).filter(pt => pt.t >= cut),
      // color follows the outcome, not its current rank
      color: SERIES[m.outcomes.findIndex(x => x.id === o.id) % 4],
    })).filter(s => s.points.length > 1)
  }, [m, cut, isMulti])

  const hist = m.history[selOutcome.id] ?? []
  const dayAgo = hist.filter(x => x.t <= Date.now() - 86400000).slice(-1)[0]
  const delta = dayAgo ? p - dayAgo.p : 0

  const amt = parseFloat(amount) || 0
  const feeRate = state.settings.tradingFeeBps / 10000
  const buyQuote = amt > 0 ? quoteBuy(selOutcome, side, amt * (1 - feeRate)) : null

  const myPositions = currentUser ? state.positions.filter(x => x.userId === currentUser.id && x.marketId === m.id) : []
  const myOrders = currentUser ? state.orders.filter(o => o.userId === currentUser.id && o.marketId === m.id && (o.status === 'open' || o.status === 'partial')) : []
  const sellPos = myPositions.find(x => x.outcomeId === selOutcome.id && x.side === side)
  const sellShares = mode === 'sell' ? Math.min(parseFloat(amount) || 0, sellPos?.shares ?? 0) : 0
  const sellQuote = sellShares > 0 ? quoteSell(selOutcome, side, sellShares) : null

  const submit = () => {
    if (!currentUser) { openAuth(); return }
    let res
    if (mode === 'sell') res = trade(m.id, selOutcome.id, side, 'sell', sellShares)
    else if (orderType === 'limit') res = placeLimitOrder(m.id, selOutcome.id, side, (parseFloat(limitPrice) || 0) / 100, parseFloat(limitShares) || 0)
    else res = trade(m.id, selOutcome.id, side, 'buy', amt)
    if (!res.ok && res.needsKyc !== undefined) setKycReason(res.error ?? 'Verification required to continue.')
  }

  const capacityLeft = currentUser ? state.settings.tierTradeCaps[currentUser.kycTier] - openPositionCost(currentUser.id) : 0

  return (
    <main className="page-inner">
      <div className="detail-head">
        <span className="mcard-icon" aria-hidden="true">{m.icon}</span>
        <div style={{ flex: 1 }}>
          <h1>{m.question}</h1>
          <div className="detail-meta">
            <StatusBadge status={m.status} />
            <span>{fmtUsdCompact(m.volume)} volume</span>
            <span>·</span>
            <span>{m.status === 'resolved' ? `Resolved ${fmtDate(m.resolvedAt!)}` : `Closes ${fmtDate(m.closesAt)} (${fmtCountdown(m.closesAt)})`}</span>
            <span>·</span>
            <span className="badge">{m.category}</span>
            {m.creator !== 'foresight' && <span className="badge badge-accent"><span className="dot" />Community market</span>}
          </div>
        </div>
        <button
          className="btn btn-sm"
          style={{ fontSize: 16, color: currentUser?.watchlist.includes(m.id) ? 'var(--warning)' : 'var(--ink-3)' }}
          onClick={() => toggleWatch(m.id)}
          title={currentUser?.watchlist.includes(m.id) ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          {currentUser?.watchlist.includes(m.id) ? '★' : '☆'}
        </button>
      </div>

      {m.status === 'halted' && (
        <div className="card card-pad" style={{ borderColor: 'var(--serious)', marginBottom: 14, display: 'flex', gap: 10 }}>
          <span aria-hidden="true">⏸️</span>
          <div><strong>Trading is paused.</strong> <span className="muted">{m.haltReason ?? 'This market has been halted by the operator.'}</span></div>
        </div>
      )}
      {(m.status === 'resolving' || m.status === 'disputed') && m.proposedResolution && (
        <div className="card card-pad" style={{ borderColor: 'var(--accent)', marginBottom: 14 }}>
          <strong>Resolution proposed:</strong>{' '}
          {m.outcomes.find(o => o.id === m.proposedResolution!.outcomeId)?.label} — {m.proposedResolution.side.toUpperCase()}.{' '}
          <span className="muted">Dispute window closes {fmtDate(m.proposedResolution.disputeEndsAt)}. Holders can raise a dispute with a bond during this window.</span>
        </div>
      )}
      {m.status === 'resolved' && (
        <div className="card card-pad" style={{ borderColor: 'var(--good)', marginBottom: 14 }}>
          <strong>Resolved:</strong>{' '}
          {isMulti
            ? m.outcomes.find(o => o.resolved === 'yes')?.label
            : (m.outcomes[0].resolved === 'yes' ? 'YES' : 'NO')}
          {' '}· winning shares paid $1.00 each.
        </div>
      )}

      <div className="detail-grid">
        <div className="stack">
          <div className="card card-pad">
            {!isMulti && (
              <div className="big-prob">
                <span className="v" style={{ color: 'var(--series-1)' }}>{fmtPct(p)}</span>
                <span className="muted">chance</span>
                {dayAgo && (
                  <span className={'d ' + (delta >= 0 ? 'up' : 'down')}>
                    {delta >= 0 ? '▲' : '▼'} {fmtPct1(Math.abs(delta))} today
                  </span>
                )}
              </div>
            )}
            <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 4, gap: 10 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setAlertOpen(o => !o)}>🔔 Alert</button>
              <div className="range-row">
                {RANGES.map(r => (
                  <button key={r.l} className={r.l === range ? 'on' : ''} onClick={() => setRange(r.l)}>{r.l}</button>
                ))}
              </div>
            </div>
            {alertOpen && (
              <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8, gap: 8, fontSize: 13 }}>
                <span className="muted">Notify me when {isMulti ? selOutcome.label : 'YES'} goes</span>
                <select className="select" style={{ width: 90, padding: '5px 8px' }} value={alertCond} onChange={e => setAlertCond(e.target.value as 'above' | 'below')}>
                  <option value="above">above</option>
                  <option value="below">below</option>
                </select>
                <input className="input" style={{ width: 70, padding: '5px 8px' }} type="number" min={1} max={99} value={alertPct} onChange={e => setAlertPct(e.target.value)} />
                <span className="muted">%</span>
                <button className="btn btn-sm btn-primary" onClick={() => { createAlert(m.id, selOutcome.id, alertCond, (parseFloat(alertPct) || 50) / 100); setAlertOpen(false) }}>Set</button>
              </div>
            )}
            {chartSeries.length ? <PriceChart series={chartSeries} /> : <Empty icon="📈" text="Not enough history for this range" />}
          </div>

          {isMulti && (
            <div className="card card-pad">
              <div className="section-head" style={{ margin: '0 0 6px' }}><h2>Outcomes</h2></div>
              <div className="outcome-rows">
                {[...m.outcomes].sort((a, b) => price(b) - price(a)).map(o => {
                  const op = price(o)
                  return (
                    <div className="outcome-row" key={o.id}>
                      <span className="name">
                        <span className="swatch" style={{ background: SERIES[m.outcomes.findIndex(x => x.id === o.id) % 4] }} />
                        {o.label}
                        {o.resolved === 'yes' && <span className="badge badge-good"><span className="dot" />Winner</span>}
                      </span>
                      <span className="prob">{fmtPct(op)}</span>
                      {m.status === 'active' && (
                        <span className="row" style={{ gap: 6 }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--yes-soft)', color: 'var(--yes)', borderColor: selOutcome.id === o.id && side === 'yes' ? 'var(--yes)' : 'transparent' }}
                            onClick={() => { setOutcomeId(o.id); setSide('yes'); setMode('buy') }}
                          >
                            Yes {Math.round(op * 100)}¢
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--no-soft)', color: 'var(--no)', borderColor: selOutcome.id === o.id && side === 'no' ? 'var(--no)' : 'transparent' }}
                            onClick={() => { setOutcomeId(o.id); setSide('no'); setMode('buy') }}
                          >
                            No {Math.round((1 - op) * 100)}¢
                          </button>
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(myPositions.length > 0 || myOrders.length > 0) && (
            <div className="card card-pad">
              <div className="section-head" style={{ margin: '0 0 8px' }}><h2>Your position</h2></div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Outcome</th><th>Side</th><th className="num">Shares</th><th className="num">Avg</th><th className="num">Now</th><th className="num">Value</th><th className="num">P&L</th></tr></thead>
                  <tbody>
                    {myPositions.map(pos => {
                      const o = m.outcomes.find(x => x.id === pos.outcomeId)!
                      const cur = price(o, pos.side)
                      const val = pos.shares * cur
                      const pnl = val - pos.shares * pos.avgPrice
                      return (
                        <tr key={pos.id}>
                          <td>{o.label}</td>
                          <td><strong style={{ color: pos.side === 'yes' ? 'var(--yes)' : 'var(--no)' }}>{pos.side.toUpperCase()}</strong></td>
                          <td className="num">{pos.shares.toFixed(1)}</td>
                          <td className="num">{fmtCents(pos.avgPrice)}</td>
                          <td className="num">{fmtCents(cur)}</td>
                          <td className="num">{fmtUsd(val)}</td>
                          <td className={'num ' + (pnl >= 0 ? 'up' : 'down')}>{fmtUsd(pnl)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {myOrders.map(o => (
                <div key={o.id} className="row" style={{ justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--grid)', paddingTop: 8, marginTop: 8 }}>
                  <span className="muted">
                    Limit: buy {o.shares} {o.side.toUpperCase()} @ {fmtCents(o.limitPrice)} · filled {o.filled.toFixed(0)}/{o.shares}
                  </span>
                  <button className="btn btn-sm btn-ghost" style={{ color: 'var(--critical)' }} onClick={() => cancelOrder(o.id)}>Cancel</button>
                </div>
              ))}
            </div>
          )}

          <div className="card card-pad stack" style={{ gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="section-head" style={{ margin: 0 }}><h2>Market intelligence</h2></div>
              <Tabs value={intel} onChange={setIntel} options={[
                { value: 'activity', label: 'Activity' },
                { value: 'holders', label: 'Top holders' },
                { value: 'brief', label: '🤖 AI brief' },
              ]} />
            </div>
            {intel === 'activity' && <ActivityFeed m={m} />}
            {intel === 'holders' && <TopHolders m={m} />}
            {intel === 'brief' && <AiBrief m={m} delta={delta} p={p} />}
          </div>

          <div className="card card-pad stack" style={{ gap: 10 }}>
            <div className="section-head" style={{ margin: 0 }}><h2>About this market</h2></div>
            <p style={{ color: 'var(--ink-2)' }}>{m.description}</p>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Resolution rules</div>
              <p className="hint" style={{ fontSize: 13 }}>{m.rules}</p>
            </div>
            <div className="row-wrap" style={{ fontSize: 13 }}>
              <span className="badge"><span className="dot" />Source: {m.resolutionSource}</span>
              <span className="badge badge-accent"><span className="dot" />
                Oracle: {{ admin: 'Operator', committee: 'Resolution committee', 'ai-assisted': 'AI-assisted + human sign-off', external: 'External data feed' }[m.oracle]}
              </span>
              <span className="badge"><span className="dot" />Fee {(m.feeBps / 100).toFixed(2)}%</span>
            </div>
            {m.oracle === 'ai-assisted' && state.settings.featureFlags.aiResolutionAssist && (
              <div className="hint" style={{ background: 'var(--surface-2)', padding: 10, borderRadius: 8 }}>
                🤖 <strong>AI resolution assist:</strong> when this market closes, an AI agent drafts a resolution memo from the source
                above with citations; a human resolver signs off before settlement, and every memo is published for audit.
              </div>
            )}
          </div>
        </div>

        {/* ---- Trade panel ---- */}
        <div className="trade-panel">
          <div className="card card-pad stack" style={{ gap: 12 }}>
            {isMulti && <div className="hint" style={{ fontWeight: 600 }}>Trading: {selOutcome.label}</div>}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <Tabs value={mode} onChange={v => { setMode(v); setAmount(v === 'sell' ? (sellPos?.shares.toFixed(0) ?? '0') : '25') }} options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]} />
              {mode === 'buy' && state.settings.featureFlags.limitOrders && (
                <Tabs value={orderType} onChange={setOrderType} options={[{ value: 'market', label: 'Market' }, { value: 'limit', label: 'Limit' }]} />
              )}
            </div>

            <div className="side-toggle">
              <button className={side === 'yes' ? 'on-yes' : ''} onClick={() => setSide('yes')}>
                Yes <span className="pr">{Math.round(p * 100)}¢</span>
              </button>
              <button className={side === 'no' ? 'on-no' : ''} onClick={() => setSide('no')}>
                No <span className="pr">{Math.round((1 - p) * 100)}¢</span>
              </button>
            </div>

            {mode === 'buy' && orderType === 'limit' ? (
              <>
                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="field">
                    <label>Limit price (¢)</label>
                    <input className="input" type="number" min={1} max={99} value={limitPrice} onChange={e => setLimitPrice(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Shares</label>
                    <input className="input" type="number" min={1} value={limitShares} onChange={e => setLimitShares(e.target.value)} />
                  </div>
                </div>
                <div className="quote-rows">
                  <div><span className="k">Max cost</span><span className="v">{fmtUsd(((parseFloat(limitPrice) || 0) / 100) * (parseFloat(limitShares) || 0))}</span></div>
                  <div><span className="k">Fills when</span><span className="v">{side.toUpperCase()} ≤ {limitPrice}¢</span></div>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label>{mode === 'buy' ? 'Amount ($)' : `Shares to sell${sellPos ? ` (you hold ${sellPos.shares.toFixed(1)})` : ''}`}</label>
                  <input className="input" type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                {mode === 'buy' ? (
                  <div className="quick-amounts">
                    {[10, 25, 100, 500].map(v => <button key={v} onClick={() => setAmount(String(v))}>${v}</button>)}
                    {currentUser && <button onClick={() => setAmount(currentUser.balance.toFixed(0))}>Max</button>}
                  </div>
                ) : (
                  <div className="quick-amounts">
                    {[25, 50, 100].map(v => <button key={v} onClick={() => setAmount(String(Math.round((sellPos?.shares ?? 0) * v / 100)))}>{v}%</button>)}
                  </div>
                )}
                <div className="quote-rows">
                  {mode === 'buy' && buyQuote ? (
                    <>
                      <div><span className="k">Avg price</span><span className="v">{fmtCents(buyQuote.avgPrice)}</span></div>
                      <div><span className="k">Shares</span><span className="v">{buyQuote.shares.toFixed(2)}</span></div>
                      <div><span className="k">Payout if {side.toUpperCase()}</span><span className="v up">{fmtUsd(buyQuote.shares)} ({amt > 0 ? '+' + fmtPct1((buyQuote.shares - amt) / amt) : ''})</span></div>
                      <div><span className="k">Price impact</span><span className="v">{fmtPct1(Math.abs(buyQuote.priceImpact))}</span></div>
                      <div><span className="k">Fee ({(state.settings.tradingFeeBps / 100).toFixed(2)}%)</span><span className="v">{fmtUsd(amt * feeRate)}</span></div>
                    </>
                  ) : mode === 'sell' && sellQuote ? (
                    <>
                      <div><span className="k">Avg price</span><span className="v">{fmtCents(sellQuote.avgPrice)}</span></div>
                      <div><span className="k">You receive</span><span className="v">{fmtUsd(sellQuote.proceeds * (1 - feeRate))}</span></div>
                      <div><span className="k">Price impact</span><span className="v">{fmtPct1(Math.abs(sellQuote.priceImpact))}</span></div>
                    </>
                  ) : (
                    <div><span className="k">Current price</span><span className="v">{fmtCents(sidePrice)}</span></div>
                  )}
                </div>
              </>
            )}

            <button
              className={'btn btn-lg ' + (mode === 'sell' ? '' : side === 'yes' ? 'btn-yes' : 'btn-no')}
              disabled={m.status !== 'active'}
              onClick={submit}
            >
              {!currentUser ? 'Sign up to trade'
                : m.status !== 'active' ? 'Trading unavailable'
                : mode === 'sell' ? `Sell ${side.toUpperCase()}`
                : orderType === 'limit' ? 'Place limit order'
                : `Buy ${side.toUpperCase()}`}
            </button>
            {mode === 'buy' && orderType === 'market' && m.status === 'active' && (
              <button className="btn" onClick={() => addToSlip({ marketId: m.id, outcomeId: selOutcome.id, side, amount: amt > 0 ? amt : 10 })}>
                🧾 Add to combo slip
              </button>
            )}

            {currentUser && currentUser.kycTier < 2 && capacityLeft < 1e11 && (
              <div className="hint">
                Tier {currentUser.kycTier} headroom: <strong>{fmtUsd(Math.max(0, capacityLeft), 0)}</strong> of open-position budget left.{' '}
                <button style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={() => setKycReason('Raise your limits by verifying your identity — takes about two minutes.')}>
                  Raise limits
                </button>
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Market depth (AMM)</div>
            <div className="orderbook-row"><span className="muted">Liquidity pool</span><strong className="mono">{fmtUsdCompact(selOutcome.yesPool * price(selOutcome) + selOutcome.noPool * (1 - price(selOutcome)))}</strong></div>
            <div className="orderbook-row"><span className="muted">Move to {Math.min(99, Math.round(p * 100) + 5)}¢ costs</span><strong className="mono">{fmtUsdCompact(estimateCostToMove(selOutcome, 0.05))}</strong></div>
            <div className="orderbook-row"><span className="muted">Open limit orders</span><strong className="mono">{state.orders.filter(o => o.marketId === m.id && (o.status === 'open' || o.status === 'partial')).length}</strong></div>
          </div>
        </div>
      </div>

      <div className="section-head"><h2>Related markets</h2></div>
      <div className="market-grid">
        {state.markets.filter(x => x.id !== m.id && x.category === m.category && x.status !== 'draft').slice(0, 3).map(x => (
          <Link key={x.id} to={`/market/${x.id}`} className="card mcard">
            <div className="mcard-top">
              <span className="mcard-icon">{x.icon}</span>
              <span className="mcard-q">{x.question}</span>
              <span className="mcard-prob"><span className="p">{fmtPct(price(x.outcomes[0]))}</span></span>
            </div>
          </Link>
        ))}
      </div>

      {kycReason && <KycModal reason={kycReason} onClose={() => setKycReason(null)} />}
    </main>
  )
}

const ActivityFeed = ({ m }: { m: Market }) => {
  const { state, userById } = useStore()
  const rows = state.trades.filter(t => t.marketId === m.id).slice(0, 10)
  if (!rows.length) return <Empty icon="💤" text="No recent trades" />
  return (
    <div>
      {rows.map(t => {
        const u = userById(t.userId)
        const o = m.outcomes.find(x => x.id === t.outcomeId)
        return (
          <div className="feed-row" key={t.id}>
            {u && <Avatar user={u} size={24} />}
            <span style={{ flex: 1 }}>
              <strong>@{u?.handle ?? 'trader'}</strong> {t.direction === 'buy' ? 'bought' : 'sold'} {t.shares.toFixed(0)}{' '}
              <strong style={{ color: t.side === 'yes' ? 'var(--yes)' : 'var(--no)' }}>{t.side.toUpperCase()}</strong>
              {m.type === 'multi' && o ? ` · ${o.label}` : ''} @ {fmtCents(t.price)}
            </span>
            <span className="muted">{fmtAgo(t.at)}</span>
          </div>
        )
      })}
    </div>
  )
}

const TopHolders = ({ m }: { m: Market }) => {
  const { state, userById } = useStore()
  const holders = state.positions
    .filter(p => p.marketId === m.id)
    .map(p => {
      const o = m.outcomes.find(x => x.id === p.outcomeId)!
      return { ...p, value: p.shares * price(o, p.side), outcomeLabel: o.label }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
  if (!holders.length) return <Empty icon="🐋" text="No positions yet" sub="Be the first to take a side." />
  return (
    <div>
      {holders.map(h => {
        const u = userById(h.userId)
        return (
          <div className="feed-row" key={h.id}>
            {u && <Avatar user={u} size={24} />}
            <span style={{ flex: 1 }}>
              <strong>@{u?.handle}</strong>
              <span className="muted"> · calib {u ? fmtPct(u.stats.calibration) : '—'}</span>
            </span>
            <span>
              {h.shares.toFixed(0)} <strong style={{ color: h.side === 'yes' ? 'var(--yes)' : 'var(--no)' }}>{h.side.toUpperCase()}</strong>
              {m.type === 'multi' ? ` · ${h.outcomeLabel}` : ''}
            </span>
            <span className="mono" style={{ width: 76, textAlign: 'right' }}>{fmtUsd(h.value, 0)}</span>
          </div>
        )
      })}
      <div className="hint" style={{ marginTop: 8 }}>
        Holder calibration scores let you see whether the smart money is on your side — a transparency layer competitors don't surface.
      </div>
    </div>
  )
}

const AiBrief = ({ m, delta, p }: { m: Market; delta: number; p: number }) => {
  const sigs = [
    { icon: '📊', text: `Market-implied probability is ${fmtPct(p)}, ${Math.abs(delta) < 0.005 ? 'flat' : (delta > 0 ? 'up' : 'down') + ' ' + fmtPct1(Math.abs(delta))} over 24h. ${Math.abs(delta) > 0.03 ? 'Momentum is unusually strong versus this market’s 30-day realized volatility.' : 'Price action is within normal range.'}`, conf: 0.98 },
    { icon: '📰', text: `Source watch (${m.resolutionSource}): no resolution-relevant publication detected in the last 24h. Next scheduled data point is being tracked automatically.`, conf: 0.84 },
    { icon: '📚', text: `Base rate: in similar historical ${m.category.toLowerCase()} markets, outcomes trading at ${fmtPct(p)} thirty days out resolved YES ${fmtPct(Math.min(0.95, Math.max(0.05, p + 0.02)))} of the time — the market is roughly calibrated here.`, conf: 0.77 },
    { icon: '🐋', text: 'Flow: net order flow over the last 48h skews ' + (delta >= 0 ? 'toward YES, driven by mid-size accounts with above-median calibration.' : 'toward NO; the largest holder has not changed position.'), conf: 0.81 },
  ]
  return (
    <div className="ai-brief">
      {sigs.map((s, i) => (
        <div className="sig" key={i}>
          <span aria-hidden="true">{s.icon}</span>
          <span style={{ flex: 1 }}>{s.text}</span>
          <span className="conf muted">conf {fmtPct(s.conf)}</span>
        </div>
      ))}
      <div className="hint">
        Simulated in this prototype. In production, an agent continuously reads the market's declared sources and publishes these
        signals with citations — the same pipeline that drafts resolution memos, so traders and resolvers see identical evidence.
      </div>
    </div>
  )
}

// rough binary search: dollars to push YES price up by `dp`
const estimateCostToMove = (o: { yesPool: number; noPool: number }, dp: number): number => {
  const target = Math.min(0.99, o.noPool / (o.yesPool + o.noPool) + dp)
  let lo = 0, hi = (o.yesPool + o.noPool) * 2
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const k = o.yesPool * o.noPool
    const nn = o.noPool + mid
    const ny = k / nn
    const pp = nn / (ny + nn)
    if (pp < target) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}
