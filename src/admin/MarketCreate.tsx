import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { fmtUsd } from '../lib/format'
import type { OracleType } from '../lib/types'

const CATS = ['Politics', 'Economics', 'Crypto', 'AI & Tech', 'Sports', 'Science', 'Climate', 'Culture']
const ICONS = ['🔮', '🗳️', '📈', '₿', '🤖', '⚽', '🚀', '🌡️', '🎬', '🏦', '⚡', '🧬']

export const MarketCreate = () => {
  const { adminCreateMarket, state } = useStore()
  const nav = useNavigate()
  const [step, setStep] = useState(0)

  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [category, setCategory] = useState('Politics')
  const [icon, setIcon] = useState('🔮')
  const [type, setType] = useState<'binary' | 'multi' | 'scalar'>('binary')
  const [outcomes, setOutcomes] = useState<{ label: string; p: number }[]>([{ label: 'Yes', p: 0.5 }])
  const [scalarMin, setScalarMin] = useState('0')
  const [scalarMax, setScalarMax] = useState('100')
  const [scalarUnit, setScalarUnit] = useState('%')
  const [closesDays, setClosesDays] = useState('90')
  const [source, setSource] = useState('')
  const [oracle, setOracle] = useState<OracleType>('admin')
  const [liquidity, setLiquidity] = useState('25000')
  const [feeBps, setFeeBps] = useState(String(state.settings.tradingFeeBps))
  const [featured, setFeatured] = useState(false)

  const stepValid = [
    question.trim().length >= 10 && rules.trim().length >= 10,
    type !== 'multi' || (outcomes.length >= 2 && outcomes.every(o => o.label.trim())),
    source.trim().length >= 3,
    parseFloat(liquidity) >= 500,
  ][step]

  const setOutcome = (i: number, patch: Partial<{ label: string; p: number }>) =>
    setOutcomes(os => os.map((o, j) => (j === i ? { ...o, ...patch } : o)))

  const create = (status: 'draft' | 'active') => {
    const finalOutcomes = type === 'binary'
      ? [{ label: 'Yes', p: outcomes[0].p }]
      : type === 'scalar'
        ? [{ label: 'Forecast', p: outcomes[0].p }]
        : outcomes
    adminCreateMarket({
      question: question.trim(), description: description.trim() || question.trim(), rules: rules.trim(),
      category, icon, type, outcomes: finalOutcomes,
      ...(type === 'scalar' ? { scalarRange: { min: parseFloat(scalarMin) || 0, max: parseFloat(scalarMax) || 100, unit: scalarUnit } } : {}),
      closesAt: Date.now() + (parseFloat(closesDays) || 30) * 86400000,
      resolutionSource: source.trim(), oracle,
      liquidity: parseFloat(liquidity) || 1000, feeBps: parseFloat(feeBps) || 100,
      featured, status,
    })
    nav('/admin/markets')
  }

  const STEPS = ['Question', 'Outcomes', 'Resolution', 'Economics']

  return (
    <>
      <div className="admin-head"><h1>Create market</h1><span className="hint">Step {step + 1} of {STEPS.length} — {STEPS[step]}</span></div>

      <div className="card card-pad" style={{ maxWidth: 720 }}>
        <div className="wizard-steps">
          {STEPS.map((s, i) => <span key={s} className={'st' + (i <= step ? ' on' : '')} />)}
        </div>

        {step === 0 && (
          <div className="stack">
            <div className="field">
              <label>Question (resolvable, unambiguous, has a deadline)</label>
              <input className="input" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Will X happen by DATE?" autoFocus />
            </div>
            <div className="field">
              <label>Description (shown to traders)</label>
              <textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="field">
              <label>Resolution rules (exact criteria, edge cases, fallback source)</label>
              <textarea className="input" rows={3} value={rules} onChange={e => setRules(e.target.value)} placeholder="Resolves YES if… Resolves NO if… If the source is unavailable, then…" />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Category</label>
                <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Icon</label>
                <div className="row-wrap" style={{ gap: 4 }}>
                  {ICONS.map(i => (
                    <button key={i} className="btn btn-sm" style={{ borderColor: i === icon ? 'var(--accent)' : 'var(--border)', fontSize: 16 }} onClick={() => setIcon(i)}>{i}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="stack">
            <div className="field">
              <label>Market structure</label>
              <div className="row">
                <button className={'btn' + (type === 'binary' ? ' btn-primary' : '')} onClick={() => { setType('binary'); setOutcomes([{ label: 'Yes', p: outcomes[0]?.p ?? 0.5 }]) }}>Binary (Yes/No)</button>
                <button className={'btn' + (type === 'multi' ? ' btn-primary' : '')} onClick={() => { setType('multi'); if (outcomes.length < 2) setOutcomes([{ label: '', p: 0.5 }, { label: '', p: 0.5 }]) }}>Multi-outcome</button>
                <button
                  className={'btn' + (type === 'scalar' ? ' btn-primary' : '')}
                  disabled={!state.settings.featureFlags.scalarMarkets}
                  title={state.settings.featureFlags.scalarMarkets ? 'Settles proportionally across a numeric range' : 'Enable in Feature flags'}
                  onClick={() => { setType('scalar'); setOutcomes([{ label: 'Forecast', p: outcomes[0]?.p ?? 0.5 }]) }}
                >
                  Scalar (range)
                </button>
              </div>
            </div>
            {type === 'scalar' && (
              <div className="grid-3">
                <div className="field">
                  <label>Range min</label>
                  <input className="input" type="number" value={scalarMin} onChange={e => setScalarMin(e.target.value)} />
                </div>
                <div className="field">
                  <label>Range max</label>
                  <input className="input" type="number" value={scalarMax} onChange={e => setScalarMax(e.target.value)} />
                </div>
                <div className="field">
                  <label>Unit</label>
                  <input className="input" value={scalarUnit} onChange={e => setScalarUnit(e.target.value)} placeholder="%, $, °C…" />
                </div>
              </div>
            )}
            {type !== 'multi' ? (
              <div className="field">
                <label>
                  {type === 'scalar'
                    ? `Initial market forecast: ${((parseFloat(scalarMin) || 0) + (outcomes[0].p * ((parseFloat(scalarMax) || 100) - (parseFloat(scalarMin) || 0)))).toFixed(1)}${scalarUnit}`
                    : `Initial probability: ${Math.round(outcomes[0].p * 100)}%`}
                </label>
                <input type="range" min={5} max={95} value={outcomes[0].p * 100} onChange={e => setOutcome(0, { p: parseFloat(e.target.value) / 100 })} />
                <span className="hint">Where the AMM opens. Get this close to consensus to avoid gifting early traders an edge.</span>
              </div>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {outcomes.map((o, i) => (
                  <div className="row" key={i}>
                    <input className="input" style={{ flex: 2 }} placeholder={`Outcome ${i + 1}`} value={o.label} onChange={e => setOutcome(i, { label: e.target.value })} />
                    <input className="input" style={{ width: 90 }} type="number" min={1} max={99} value={Math.round(o.p * 100)} onChange={e => setOutcome(i, { p: (parseFloat(e.target.value) || 1) / 100 })} />
                    <span className="hint">%</span>
                    {outcomes.length > 2 && <button className="btn btn-sm btn-ghost" style={{ color: 'var(--critical)' }} onClick={() => setOutcomes(os => os.filter((_, j) => j !== i))}>✕</button>}
                  </div>
                ))}
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <button className="btn btn-sm" onClick={() => setOutcomes(os => [...os, { label: '', p: 0.1 }])}>+ Add outcome</button>
                  <span className={'hint' + (Math.abs(outcomes.reduce((a, o) => a + o.p, 0) - 1) > 0.02 ? ' down' : '')}>
                    Initial probabilities sum to {Math.round(outcomes.reduce((a, o) => a + o.p, 0) * 100)}% (should be ~100%)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <div className="grid-2">
              <div className="field">
                <label>Trading closes in (days)</label>
                <input className="input" type="number" min={1} value={closesDays} onChange={e => setClosesDays(e.target.value)} />
              </div>
              <div className="field">
                <label>Resolution source</label>
                <input className="input" value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. bls.gov, AP, official announcement" />
              </div>
            </div>
            <div className="field">
              <label>Oracle</label>
              <select className="select" value={oracle} onChange={e => setOracle(e.target.value as OracleType)}>
                <option value="admin">Operator — resolver on the ops team</option>
                <option value="committee">Resolution committee — multi-sign for contentious markets</option>
                <option value="ai-assisted">AI-assisted — agent drafts memo, human countersigns</option>
                <option value="external">External data feed — automatic from the source API</option>
              </select>
            </div>
            <div className="hint">Every resolution goes through propose → dispute window → finalize, regardless of oracle type.</div>
          </div>
        )}

        {step === 3 && (
          <div className="stack">
            <div className="grid-2">
              <div className="field">
                <label>Seed liquidity ($)</label>
                <input className="input" type="number" min={500} value={liquidity} onChange={e => setLiquidity(e.target.value)} />
                <span className="hint">Deeper pools = less slippage. House capital at risk until LPs join.</span>
              </div>
              <div className="field">
                <label>Trading fee (bps)</label>
                <input className="input" type="number" min={0} max={500} value={feeBps} onChange={e => setFeeBps(e.target.value)} />
                <span className="hint">{(parseFloat(feeBps) / 100 || 0).toFixed(2)}% per trade. Platform default is {(state.settings.tradingFeeBps / 100).toFixed(2)}%.</span>
              </div>
            </div>
            <label className="row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} />
              Feature on the homepage
            </label>
            <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Review</div>
              <div className="hint">
                {icon} {question || '—'}<br />
                {type} · {category} · closes in {closesDays}d · oracle: {oracle} · source: {source || '—'}<br />
                seed {fmtUsd(parseFloat(liquidity) || 0, 0)} · fee {(parseFloat(feeBps) / 100 || 0).toFixed(2)}%
              </div>
            </div>
          </div>
        )}

        <div className="row" style={{ marginTop: 18, justifyContent: 'space-between' }}>
          <button className="btn" disabled={step === 0} onClick={() => setStep(s => s - 1)}>← Back</button>
          {step < 3 ? (
            <button className="btn btn-primary" disabled={!stepValid} onClick={() => setStep(s => s + 1)}>Continue →</button>
          ) : (
            <div className="row">
              <button className="btn" onClick={() => create('draft')}>Save as draft</button>
              <button className="btn btn-primary" onClick={() => create('active')}>Publish market</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
