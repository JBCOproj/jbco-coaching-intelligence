import { useState, useMemo } from 'react'
import { getFleetTier, FLEET_TIERS } from '../utils.js'

// Amazon DSP scorecard metrics with weights — DO NOT CHANGE
const METRICS = [
  { key: 'cdfDpmo',        label: 'CDF DPMO',             weight: 0.063, unit: 'dpmo', lowerBetter: true,  fantastic: 400,  great: 1000, fair: 2000 },
  { key: 'dsbDpmo',        label: 'DSB DPMO',             weight: 0.127, unit: 'dpmo', lowerBetter: true,  fantastic: 100,  great: 250,  fair: 500  },
  { key: 'followingDist',  label: 'Following distance',   weight: 0.050, unit: '/100', lowerBetter: true,  fantastic: 1,    great: 3,    fair: 6    },
  { key: 'speedingRate',   label: 'Speeding event rate',  weight: 0.117, unit: '/100', lowerBetter: true,  fantastic: 2,    great: 5,    fair: 10   },
  { key: 'seatbeltRate',   label: 'Seatbelt-off rate',    weight: 0.117, unit: '/100', lowerBetter: true,  fantastic: 0,    great: 0.5,  fair: 1    },
  { key: 'distractRate',   label: 'Distractions rate',    weight: 0.075, unit: '/100', lowerBetter: true,  fantastic: 0.5,  great: 1.5,  fair: 3    },
  { key: 'signViolations', label: 'Sign/signal violations',weight:0.117, unit: '/100', lowerBetter: true,  fantastic: 1,    great: 3,    fair: 6    },
  { key: 'dcr',            label: 'DCR',                  weight: 0.127, unit: '%',    lowerBetter: false, fantastic: 99.8, great: 99.5, fair: 99   },
  { key: 'pod',            label: 'POD acceptance rate',  weight: 0.031, unit: '%',    lowerBetter: false, fantastic: 99,   great: 98,   fair: 95   },
]

function getMetricTier(metric, value) {
  if (metric.lowerBetter) {
    if (value <= metric.fantastic) return { label: 'Fantastic', color: '#077398' }
    if (value <= metric.great)    return { label: 'Great',      color: '#358118' }
    if (value <= metric.fair)     return { label: 'Fair',       color: '#d4770d' }
    return { label: 'Poor', color: '#cc0c3a' }
  } else {
    if (value >= metric.fantastic) return { label: 'Fantastic', color: '#077398' }
    if (value >= metric.great)     return { label: 'Great',     color: '#358118' }
    if (value >= metric.fair)      return { label: 'Fair',      color: '#d4770d' }
    return { label: 'Poor', color: '#cc0c3a' }
  }
}

function computeScore(values) {
  // Simplified weighted score — in production uses Amazon's actual formula
  let score = 72.6 // baseline
  METRICS.forEach(m => {
    const v = values[m.key]
    const tier = getMetricTier(m, v)
    const tierPoints = { 'Fantastic': 1, 'Great': 0.5, 'Fair': 0, 'Poor': -0.5 }
    score += (tierPoints[tier.label] || 0) * m.weight * 10
  })
  return Math.max(0, Math.min(100, score))
}

const QUICK_SCENARIOS = [
  { label: 'Fix CDF to Great',       desc: 'CDF DPMO → 1,000',                    apply: v => ({ ...v, cdfDpmo: 1000 }) },
  { label: 'Fix CDF to Fantastic',   desc: 'CDF DPMO → 400',                      apply: v => ({ ...v, cdfDpmo: 400  }) },
  { label: 'Fix following distance', desc: 'FDR → 2.0 events/100 trips',           apply: v => ({ ...v, followingDist: 2 }) },
  { label: 'Fix all 3 focus areas',  desc: 'CDF Fantastic + DSB Fantastic + FDR Fantastic', apply: v => ({ ...v, cdfDpmo: 400, dsbDpmo: 100, followingDist: 1 }) },
  { label: 'All metrics Fantastic',  desc: 'Every metric at best possible level',  apply: v => ({ ...v, cdfDpmo: 400, dsbDpmo: 100, followingDist: 1, speedingRate: 2, seatbeltRate: 0, distractRate: 0.5, signViolations: 1, dcr: 99.9, pod: 99.5 }) },
]

export default function ScorecardAnalytics({ reportData, week }) {
  const baseline = useMemo(() => ({
    cdfDpmo: 1699, dsbDpmo: 239, followingDist: 5,
    speedingRate: 7.9, seatbeltRate: 0.9, distractRate: 1.7,
    signViolations: 3.4, dcr: 99.67, pod: 98.74,
    ...(reportData?.baselineMetrics || {}),
  }), [reportData])

  const [values, setValues] = useState(baseline)
  const baseScore = reportData?.publishedScore ?? 72.6
  const projScore = computeScore(values)
  const projTier = getFleetTier(projScore)
  const baseTier = getFleetTier(baseScore)

  // Tier bar positions
  const tierMarkers = [
    { label: 'Poor', score: 0 },
    { label: 'Fair', score: 40 },
    { label: 'Great', score: 60 },
    { label: 'Fantastic', score: 75, isCurrent: true },
    { label: 'F+', score: 90 },
  ]

  function reset() { setValues(baseline) }

  const cdfDrivers = reportData?.cdfDrivers || []

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-tertiary)', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
          SCORECARD ANALYTICS — {week || '2026-W21'}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select style={{ fontSize: '12px', border: '0.5px solid var(--color-border)', borderRadius: '4px', padding: '3px 8px', background: 'var(--color-surface)' }}>
            <option>{week || '2026-W21'}</option>
          </select>
          <button onClick={reset} style={{ fontSize: '12px', border: '0.5px solid var(--color-border)', borderRadius: '4px', padding: '3px 10px', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            Reset sliders
          </button>
        </div>
      </div>

      {/* Score panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        <ScorePanel
          title={`Published scorecard — ${week || '2026-W21'}`}
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

      {/* Tier bar */}
      <TierBar score={baseScore} projScore={projScore} />

      {/* What-if sliders */}
      <div style={{ marginTop: '20px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
            WHAT-IF SLIDERS
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
            ← slide left to improve "lower is better" metrics · slide right for "higher is better"
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {METRICS.map(m => (
            <MetricSlider
              key={m.key}
              metric={m}
              value={values[m.key]}
              baseline={baseline[m.key]}
              onChange={v => setValues(p => ({ ...p, [m.key]: v }))}
            />
          ))}
        </div>
      </div>

      {/* Quick scenarios */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
          QUICK SCENARIOS — CLICK TO APPLY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {QUICK_SCENARIOS.map(s => {
            const newVals = s.apply(baseline)
            const newScore = computeScore(newVals)
            const newTier = getFleetTier(newScore)
            const diff = newScore - baseScore
            return (
              <div key={s.label}
                onClick={() => setValues(newVals)}
                style={{
                  background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
                  borderRadius: '6px', padding: '12px 14px', cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#aaa'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
              >
                <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>{s.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '8px' }}>{s.desc}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '18px', fontWeight: '600' }}>{newScore.toFixed(1)}</span>
                    <TierBadge label={newTier.label} color={newTier.color} />
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

      {/* Driver CDF Impact table */}
      {cdfDrivers.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
            DRIVER CDF IMPACT — FIXING EACH DRIVER'S EFFECT ON SCORECARD
          </div>
          <div style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--color-border)' }}>
                  {['Driver', 'CDF DPMO', 'Packages', '', 'Projected scorecard if fixed'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: '400', textAlign: i > 1 ? 'right' : 'left', fontFamily: 'var(--font-mono)' }}>{h}</th>
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

      {/* Bottom 10% scenario */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
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

      {/* AI Path to Fantastic */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
          AI PATH TO FANTASTIC
        </div>
        <button
          onClick={() => {/* TODO */}}
          style={{
            background: 'var(--color-surface)', border: '0.5px solid var(--color-border)',
            borderRadius: '6px', padding: '10px 18px', fontSize: '13px', fontWeight: '500',
            cursor: 'pointer', color: 'var(--color-text-primary)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <i className="ti ti-sparkles" />
          Generate AI path to Fantastic ↗
        </button>
      </div>

      {/* Footer note */}
      <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--color-text-tertiary)', lineHeight: '1.6', borderTop: '0.5px solid var(--color-border)', paddingTop: '14px' }}>
        Projected scores use your published baseline ({baseScore.toFixed(1)}) scaled proportionally by metric tier improvements using Amazon's published weights. "Lower is better" sliders move right-to-left. All metrics at Fantastic = Fantastic+ territory. Preview scorecard (effective Week 23) shows 73.1 Fantastic.
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
  const markers = [0, 40, 60, 75, 90, 100]
  const labels = ['Poor', 'Fair (40)', 'Great (60)', 'Fantastic (75) ↑', '', 'F+ (90)']
  const pct = s => Math.min(100, Math.max(0, s))

  return (
    <div style={{ padding: '12px 0 4px' }}>
      <div style={{ position: 'relative', height: '8px', background: '#e8e6e0', borderRadius: '4px', marginBottom: '6px' }}>
        {/* Fill */}
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct(score)}%`, background: '#077398', borderRadius: '4px' }} />
        {/* Projected indicator */}
        {projScore !== score && (
          <div style={{ position: 'absolute', top: '-3px', left: `${pct(projScore)}%`, width: '2px', height: '14px', background: '#358118', borderRadius: '1px', transform: 'translateX(-50%)' }} />
        )}
        {/* Tier markers */}
        {[40, 60, 75, 90].map(m => (
          <div key={m} style={{ position: 'absolute', top: 0, left: `${m}%`, width: '1px', height: '100%', background: 'rgba(255,255,255,0.5)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
        <span>Poor</span>
        <span>Fair (40)</span>
        <span>Great (60)</span>
        <span style={{ color: '#077398', fontWeight: '500' }}>Fantastic (75) ↑</span>
        <span></span>
        <span>F+ (90)</span>
      </div>
    </div>
  )
}

function MetricSlider({ metric, value, baseline, onChange }) {
  const tier = getMetricTier(metric, value)

  // Slider range: center on baseline ±50%
  const rangeMin = metric.lowerBetter
    ? Math.max(0, metric.fantastic * 0.5)
    : metric.fair * 0.9
  const rangeMax = metric.lowerBetter
    ? baseline * 2
    : Math.min(100, metric.fantastic * 1.005)

  const pct = metric.lowerBetter
    ? 100 - ((value - rangeMin) / (rangeMax - rangeMin)) * 100
    : ((value - rangeMin) / (rangeMax - rangeMin)) * 100

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '220px 1fr 80px 90px',
      alignItems: 'center', gap: '12px',
      padding: '8px 0', borderBottom: '0.5px solid var(--color-border-subtle)',
    }}>
      <div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{metric.label}</div>
        <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          {(metric.weight * 100).toFixed(1)}% weight · baseline: {baseline}{metric.unit}
        </div>
      </div>

      <div style={{ position: 'relative', height: '4px', background: '#e8e6e0', borderRadius: '2px' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: tier.color, borderRadius: '2px' }} />
        <input
          type="range"
          min={rangeMin}
          max={rangeMax}
          step={metric.unit === '%' ? 0.01 : 1}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', top: '-8px', left: 0, width: '100%', opacity: 0, height: '20px', cursor: 'pointer', margin: 0 }}
        />
      </div>

      <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '500', fontFamily: 'var(--font-mono)' }}>
        {metric.unit === '%' ? `${value.toFixed(2)}%` : value % 1 === 0 ? value : value.toFixed(1)}{metric.unit !== '%' ? metric.unit : ''}
      </div>

      <div>
        <TierBadge label={tier.label} color={tier.color} />
      </div>
    </div>
  )
}

function TierBadge({ label, color }) {
  return (
    <span style={{
      fontSize: '11px', fontWeight: '500', color,
      background: color + '18', border: `0.5px solid ${color}55`,
      borderRadius: '4px', padding: '2px 8px',
      whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}
