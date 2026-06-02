import { useState, useMemo } from 'react'
import { getFleetTier, FLEET_TIERS, COL } from '../utils.js'

// Amazon DSP scorecard metric weights — from actual CSV weight columns
const METRICS = [
  { key: 'cdfDpmo',   label: 'CDF DPMO',              col: COL.cdfDpmo,    tierCol: COL.cdfTier,          weight: 0.126, unit: '',    lowerBetter: true,  fantastic: 400,  great: 1000, fair: 1750  },
  { key: 'dsbDpmo',   label: 'DSB DPMO',              col: COL.dsb,        tierCol: COL.dsbTier,          weight: 0.126, unit: '',    lowerBetter: true,  fantastic: 0,    great: 100,  fair: 500   },
  { key: 'dcr',       label: 'DCR',                   col: COL.dcr,        tierCol: COL.dcrTier,          weight: 0.126, unit: '%',   lowerBetter: false, fantastic: 99.8, great: 99.5, fair: 99    },
  { key: 'speeding',  label: 'Speeding event rate',   col: COL.speeding,   tierCol: COL.speedingTier,     weight: 0.132, unit: '/100',lowerBetter: true,  fantastic: 2,    great: 5,    fair: 10    },
  { key: 'seatbelt',  label: 'Seatbelt-off rate',    col: COL.seatbelt,   tierCol: COL.seatbeltTier,     weight: 0.132, unit: '/100',lowerBetter: true,  fantastic: 0,    great: 0.5,  fair: 1     },
  { key: 'signal',    label: 'Sign/signal violations',col: COL.signalViol, tierCol: COL.signalViolTier,   weight: 0.132, unit: '/100',lowerBetter: true,  fantastic: 1,    great: 3,    fair: 5     },
  { key: 'distract',  label: 'Distractions rate',    col: COL.distractions,tierCol: COL.distractionsTier,weight: 0.079, unit: '/100',lowerBetter: true,  fantastic: 0.5,  great: 1.5,  fair: 3     },
  { key: 'following', label: 'Following distance',   col: COL.following,  tierCol: COL.followingTier,    weight: 0.053, unit: '/100',lowerBetter: true,  fantastic: 1,    great: 3,    fair: 6     },
  { key: 'pod',       label: 'POD acceptance rate',  col: COL.pod,        tierCol: COL.podTier,          weight: 0.031, unit: '%',   lowerBetter: false, fantastic: 99,   great: 98,   fair: 95    },
]

function getMetricTier(metric, value) {
  const v = typeof value === 'string' ? parseFloat(value.replace('%','')) : value
  if (isNaN(v)) return null
  if (metric.lowerBetter) {
    if (v <= metric.fantastic) return { label: 'Fantastic', color: '#077398' }
    if (v <= metric.great)     return { label: 'Great',     color: '#358118' }
    if (v <= metric.fair)      return { label: 'Fair',      color: '#d4770d' }
    return { label: 'Poor', color: '#cc0c3a' }
  } else {
    const pct = v > 1 ? v : v * 100
    if (pct >= metric.fantastic) return { label: 'Fantastic', color: '#077398' }
    if (pct >= metric.great)     return { label: 'Great',     color: '#358118' }
    if (pct >= metric.fair)      return { label: 'Fair',      color: '#d4770d' }
    return { label: 'Poor', color: '#cc0c3a' }
  }
}

const QUICK_SCENARIOS = [
  { label: 'Fix CDF to Great',       desc: 'CDF DPMO → 1,000',                     apply: v => ({ ...v, cdfDpmo: 1000 }) },
  { label: 'Fix CDF to Fantastic',   desc: 'CDF DPMO → 400',                       apply: v => ({ ...v, cdfDpmo: 400  }) },
  { label: 'Fix following distance', desc: 'FDR → 2.0 events/100 trips',            apply: v => ({ ...v, following: 2 }) },
  { label: 'Fix all 3 focus areas',  desc: 'CDF Fantastic + DSB Fantastic + FDR Fantastic', apply: v => ({ ...v, cdfDpmo: 400, dsbDpmo: 0, following: 1 }) },
  { label: 'All metrics Fantastic',  desc: 'Every metric at best possible level',   apply: v => ({ ...v, cdfDpmo: 400, dsbDpmo: 0, dcr: 99.9, speeding: 2, seatbelt: 0, signal: 1, distract: 0.5, following: 1, pod: 99.5 }) },
]

export default function ScorecardAnalytics({ reportData, week, publishedScore: propPublished }) {
  const baseline = useMemo(() => {
    const drivers = reportData?.overview || []
    if (!drivers.length) return { cdfDpmo: 1699, dsbDpmo: 239, dcr: 99.67, speeding: 7.9, seatbelt: 0.9, signal: 3.4, distract: 1.7, following: 5.0, pod: 98.74 }

    function avg(col) {
      const vals = drivers.map(d => parseFloat((d[col] || '').replace('%', ''))).filter(v => !isNaN(v) && v > 0)
      if (!vals.length) return 0
      return vals.reduce((s, v) => s + v, 0) / vals.length
    }

    return {
      cdfDpmo:   avg(COL.cdfDpmo),
      dsbDpmo:   avg(COL.dsb),
      dcr:       avg(COL.dcr),
      speeding:  avg(COL.speeding),
      seatbelt:  avg(COL.seatbelt),
      signal:    avg(COL.signalViol),
      distract:  avg(COL.distractions),
      following: avg(COL.following),
      pod:       avg(COL.pod),
    }
  }, [reportData])

  const [values, setValues] = useState(() => baseline)
  const baseScore = propPublished || 72.6
  const baseTier = getFleetTier(baseScore)

  const projScore = useMemo(() => {
    let adj = 0
    METRICS.forEach(m => {
      const bv = baseline[m.key] || 0
      const cv = values[m.key] || 0
      const bt = getMetricTier(m, bv)
      const ct = getMetricTier(m, cv)
      if (!bt || !ct) return
      const ts = { Platinum: 100, Fantastic: 100, Gold: 75, Great: 50, Silver: 50, Fair: 25, Bronze: 0, Poor: 0 }
      const diff = (ts[ct.label] || 0) - (ts[bt.label] || 0)
      adj += diff * m.weight
    })
    return Math.max(0, Math.min(100, baseScore + adj * 0.3))
  }, [values, baseline, baseScore])

  const projTier = getFleetTier(projScore)
  const cdfDrivers = reportData?.cdfDrivers || []

  function reset() { setValues(baseline) }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          SCORECARD ANALYTICS — {week || ''}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select style={{ fontSize: '12px', border: '0.5px solid var(--color-border)', borderRadius: '4px', padding: '3px 8px', background: 'var(--color-surface)' }}>
            <option>{week || ''}</option>
          </select>
          <button onClick={reset} style={{ fontSize: '12px', border: '0.5px solid var(--color-border)', borderRadius: '4px', padding: '3px 10px', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            Reset sliders
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <ScorePanel
          title={`Published scorecard — ${week || ''}`}
          score={baseScore}
          tier={baseTier}
          subtitle={`Amazon DSP published score · gap to Fantastic: ${Math.max(0, 75 - baseScore).toFixed(1)} pts`}
        />
        <ScorePanel
          title="Projected score — with slider adjustments"
          score={projScore}
          tier={projTier}
          subtitle={projScore >= 75
            ? <span style={{ color: '#358118' }}>▲ Above Fantastic threshold</span>
            : <span style={{ color: '#cc0c3a' }}>Still {(75 - projScore).toFixed(1)} pts from Fantastic</span>
          }
        />
      </div>

      <TierBar score={baseScore} projScore={projScore} />

      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>WHAT-IF SLIDERS</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>← slide left to improve "lower is better" metrics · slide right for "higher is better"</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {METRICS.map(m => (
            <MetricSlider key={m.key} metric={m} value={values[m.key] || 0} baseline={baseline[m.key] || 0}
              onChange={v => setValues(p => ({ ...p, [m.key]: v }))} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '10px' }}>
          QUICK SCENARIOS — CLICK TO APPLY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {QUICK_SCENARIOS.map(s => {
            const nv = s.apply(baseline)
            let adj = 0
            METRICS.forEach(m => {
              const bv = baseline[m.key] || 0
              const cv = nv[m.key] !== undefined ? nv[m.key] : bv
              const bt = getMetricTier(m, bv)
              const ct = getMetricTier(m, cv)
              if (!bt || !ct) return
              const ts = { Platinum: 100, Fantastic: 100, Gold: 75, Great: 50, Silver: 50, Fair: 25, Bronze: 0, Poor: 0 }
              adj += ((ts[ct.label] || 0) - (ts[bt.label] || 0)) * m.weight
            })
            const ns = Math.max(0, Math.min(100, baseScore + adj * 0.3))
            const nt = getFleetTier(ns)
            const diff = ns - baseScore
            return (
              <div key={s.label} onClick={() => setValues(nv)}
                style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '6px', padding: '12px 14px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#aaa'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
              >
                <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>{s.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>{s.desc}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '18px', fontWeight: '600' }}>{ns.toFixed(1)}</span>
                    <TierBadge label={nt.label} color={nt.color} />
                  </div>
                  <span style={{ fontSize: '12px', color: diff >= 0 ? '#358118' : '#cc0c3a', fontWeight: '500' }}>
                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)} pts
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {cdfDrivers.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '10px' }}>
            DRIVER CDF IMPACT — FIXING EACH DRIVER'S EFFECT ON SCORECARD
          </div>
          <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--color-border)' }}>
                  {['Driver', 'CDF DPMO', 'Packages', '', 'Projected scorecard if fixed'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: '400', textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cdfDrivers.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '8px 14px', fontSize: '13px' }}>{d.name}</td>
                    <td style={{ padding: '8px 14px', fontSize: '13px', textAlign: 'right' }}>{d.cdfDpmo?.toLocaleString()}</td>
                    <td style={{ padding: '8px 14px', fontSize: '13px', textAlign: 'right' }}>{d.packages?.toLocaleString()}</td>
                    <td style={{ padding: '8px 14px', width: '120px' }}>
                      <div style={{ height: '6px', background: '#f0ede6', borderRadius: '2px' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (d.cdfDpmo / 15000) * 100)}%`, background: '#cc0c3a', borderRadius: '2px' }} />
                      </div>
                    </td>
                    <td style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'right' }}>→ {baseScore.toFixed(1)} (+0.0)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '10px' }}>
          BOTTOM 10% SCENARIO ANALYSIS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { title: `Bottom ${Math.ceil((reportData?.drivers?.length || 10) * 0.1)} drivers removed`, sub: 'If Amazon excluded their deliveries entirely' },
            { title: `Bottom ${Math.ceil((reportData?.drivers?.length || 10) * 0.1)} drivers improve 50%`, sub: 'Realistic coaching outcome this week' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '6px', padding: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>{s.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '10px' }}>{s.sub}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                <span style={{ fontSize: '20px', fontWeight: '600' }}>{baseScore.toFixed(1)}</span>
                <TierBadge label={baseTier.label} color={baseTier.color} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>0.0 pts</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '10px' }}>
          AI PATH TO FANTASTIC
        </div>
        <button style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '6px', padding: '10px 18px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="ti ti-sparkles" />
          Generate AI path to Fantastic ↗
        </button>
      </div>

      <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--color-text-tertiary)', lineHeight: '1.6', borderTop: '0.5px solid var(--color-border)', paddingTop: '14px' }}>
        Projected scores use your published baseline ({baseScore.toFixed(1)}) scaled proportionally by metric tier improvements using Amazon's published weights. "Lower is better" sliders move right-to-left. All metrics at Fantastic = Fantastic+ territory.
      </div>
    </div>
  )
}

function ScorePanel({ title, score, tier, subtitle }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '6px', padding: '16px' }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: '32px', fontWeight: '600', color: tier.color }}>{score.toFixed(1)}</span>
        <TierBadge label={tier.label} color={tier.color} />
      </div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{subtitle}</div>
    </div>
  )
}

function TierBar({ score, projScore }) {
  const pct = s => Math.min(100, Math.max(0, s))
  return (
    <div style={{ padding: '12px 0 4px' }}>
      <div style={{ position: 'relative', height: '8px', background: '#e8e6e0', borderRadius: '4px', marginBottom: '6px' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct(score)}%`, background: '#077398', borderRadius: '4px' }} />
        {projScore !== score && (
          <div style={{ position: 'absolute', top: '-3px', left: `${pct(projScore)}%`, width: '2px', height: '14px', background: '#358118', borderRadius: '1px', transform: 'translateX(-50%)' }} />
        )}
        {[40, 60, 75, 90].map(m => (
          <div key={m} style={{ position: 'absolute', top: 0, left: `${m}%`, width: '1px', height: '100%', background: 'rgba(255,255,255,0.5)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
        <span>Poor</span><span>Fair (40)</span><span>Great (60)</span>
        <span style={{ color: '#077398', fontWeight: '500' }}>Fantastic (75) ↑</span>
        <span></span><span>F+ (90)</span>
      </div>
    </div>
  )
}

function MetricSlider({ metric, value, baseline, onChange }) {
  const tier = getMetricTier(metric, value)
  const rangeMin = metric.lowerBetter ? 0 : Math.max(85, metric.fair * 0.95)
  const rangeMax = metric.lowerBetter ? Math.max(baseline * 2.5, metric.fair * 1.5) : 100
  const pct = metric.lowerBetter
    ? 100 - ((value - rangeMin) / (rangeMax - rangeMin)) * 100
    : ((value - rangeMin) / (rangeMax - rangeMin)) * 100

  const fmt = v => {
    if (metric.unit === '%') return `${v.toFixed(2)}%`
    if (metric.unit === '/100') return `${v % 1 === 0 ? v : v.toFixed(1)}/100`
    return v % 1 === 0 ? String(v) : v.toFixed(1)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 90px 90px', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
      <div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{metric.label}</div>
        <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
          {(metric.weight * 100).toFixed(1)}% weight · baseline: {fmt(baseline)}
        </div>
      </div>
      <div style={{ position: 'relative', height: '4px', background: '#e8e6e0', borderRadius: '2px' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: tier?.color || '#077398', borderRadius: '2px' }} />
        <input type="range" min={rangeMin} max={rangeMax} step={metric.unit === '%' ? 0.01 : 0.1} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', top: '-8px', left: 0, width: '100%', opacity: 0, height: '20px', cursor: 'pointer', margin: 0 }} />
        <div style={{ position: 'absolute', top: '-2px', left: `${((baseline - rangeMin) / (rangeMax - rangeMin)) * 100}%`, transform: 'translateX(-50%)', width: '2px', height: '8px', background: '#6b7fa3', borderRadius: '1px', pointerEvents: 'none' }} />
      </div>
      <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '500' }}>{fmt(value)}</div>
      <div>{tier && <TierBadge label={tier.label} color={tier.color} />}</div>
    </div>
  )
}

function TierBadge({ label, color }) {
  return (
    <span style={{ fontSize: '11px', fontWeight: '500', color, background: color + '18', border: `0.5px solid ${color}55`, borderRadius: '4px', padding: '2px 8px', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}
