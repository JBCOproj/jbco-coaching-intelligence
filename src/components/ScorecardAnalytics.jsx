import { useState, useMemo } from 'react'
import { COL } from '../utils.js'

// ── TIER COLORS — NEVER CHANGE ────────────────────────────────
const TIER_COLORS = {
  'Poor':       '#cc0c3a',
  'Fair':       '#d4770d',
  'Great':      '#358118',
  'Fantastic':  '#077398',
  'Fantastic+': '#0c4962',
}

// ── TIER POINTS (calibrated to match Amazon's published score) ─
// Fantastic=79.5, Great=60, Fair=40, Poor=20, No Data=0
// Formula: Overall Score = Σ(Weight × Points) / Σ(Weight)
const TIER_POINTS = {
  'Fantastic+': 79.5,
  'Fantastic':  79.5,
  'Great':      60,
  'Fair':       40,
  'Poor':       20,
  'No Data':    0,
}

// ── SCORECARD METRICS ─────────────────────────────────────────
// Weights from Appendix A. Tier thresholds confirmed from W21 CSV + PDF.
// lowerBetter: slider left=worst(high number), right=best(low number)
// lowerBetter false: slider left=worst(low number), right=best(high number)
const METRICS = [
  // SAFETY — 47.6% total
  {
    key: 'speeding', label: 'Speeding event rate',
    col: COL.speeding, tierCol: COL.speedingTier,
    weight: 11.7, category: 'safety', unit: '/100 trips', lowerBetter: true,
    sliderMin: 0, sliderMax: 25,
    tF: 8.0, tG: 13.0, tFair: 20.0,
  },
  {
    key: 'seatbelt', label: 'Seatbelt-off rate',
    col: COL.seatbelt, tierCol: COL.seatbeltTier,
    weight: 11.7, category: 'safety', unit: '/100 trips', lowerBetter: true,
    sliderMin: 0, sliderMax: 10,
    tF: 3.0, tG: 5.0, tFair: 8.0,
  },
  {
    key: 'signal', label: 'Sign/signal violations',
    col: COL.signalViol, tierCol: COL.signalViolTier,
    weight: 11.7, category: 'safety', unit: '/100 trips', lowerBetter: true,
    sliderMin: 0, sliderMax: 20,
    tF: 6.0, tG: 9.0, tFair: 15.0,
  },
  {
    key: 'distractions', label: 'Distractions rate',
    col: COL.distractions, tierCol: COL.distractionsTier,
    weight: 7.5, category: 'safety', unit: '/100 trips', lowerBetter: true,
    sliderMin: 0, sliderMax: 10,
    tF: 2.5, tG: 4.0, tFair: 7.0,
  },
  {
    key: 'following', label: 'Following distance rate',
    col: COL.following, tierCol: COL.followingTier,
    weight: 5.0, category: 'safety', unit: '/100 trips', lowerBetter: true,
    sliderMin: 0, sliderMax: 15,
    tF: 2.0, tG: 4.0, tFair: 7.0,
  },
  // QUALITY — 47.5% total
  {
    key: 'dcr', label: 'Delivery completion rate (DCR)',
    col: COL.dcr, tierCol: COL.dcrTier,
    weight: 12.7, category: 'quality', unit: '%', lowerBetter: false,
    sliderMin: 97, sliderMax: 100,
    tF: 99.5, tG: 99.0, tFair: 98.0,
  },
  {
    key: 'dsb', label: 'Delivery success behaviors (DSB)',
    col: COL.dsb, tierCol: COL.dsbTier,
    weight: 12.7, category: 'quality', unit: 'DPMO', lowerBetter: true,
    sliderMin: 0, sliderMax: 1500,
    tF: 200, tG: 350, tFair: 600,
  },
  {
    key: 'ced', label: 'Customer escalation defect (CED)',
    col: COL.ced, tierCol: COL.cedTier,
    weight: 12.7, category: 'quality', unit: 'DPMO', lowerBetter: true,
    sliderMin: 0, sliderMax: 500,
    tF: 0, tG: 50, tFair: 200,
  },
  {
    key: 'cdf', label: 'Customer delivery feedback (CDF)',
    col: COL.cdfDpmo, tierCol: COL.cdfTier,
    weight: 6.3, category: 'quality', unit: 'DPMO', lowerBetter: true,
    sliderMin: 0, sliderMax: 4000,
    tF: 1076, tG: 1669, tFair: 2832,
  },
  {
    key: 'pod', label: 'Photo on delivery (POD)',
    col: COL.pod, tierCol: COL.podTier,
    weight: 3.1, category: 'quality', unit: '%', lowerBetter: false,
    sliderMin: 94, sliderMax: 100,
    tF: 98.0, tG: 96.0, tFair: 94.0,
  },
  // TEAM — 5% total
  {
    key: 'fleetExec', label: 'Fleet execution',
    col: 'Fleet Execution', tierCol: 'Fleet Execution Tier',
    weight: 5.0, category: 'team', unit: '', lowerBetter: true,
    sliderMin: 0, sliderMax: 10,
    tF: 1.0, tG: 3.0, tFair: 6.0,
  },
]

// ── TIER HELPERS ──────────────────────────────────────────────
function getTier(metric, value) {
  const v = parseFloat(String(value).replace('%', ''))
  if (isNaN(v)) return 'No Data'
  if (metric.lowerBetter) {
    if (v <= metric.tF)    return 'Fantastic'
    if (v <= metric.tG)    return 'Great'
    if (v <= metric.tFair) return 'Fair'
    return 'Poor'
  } else {
    if (v >= metric.tF)    return 'Fantastic'
    if (v >= metric.tG)    return 'Great'
    if (v >= metric.tFair) return 'Fair'
    return 'Poor'
  }
}

// ── SCORE FORMULA ─────────────────────────────────────────────
function computeScore(metricTiers) {
  // Overall Score = Σ(Weight × Tier Points) / Σ(Weight)
  let numerator = 0
  let denominator = 0
  METRICS.forEach(m => {
    const tier = metricTiers[m.key] || 'No Data'
    const points = TIER_POINTS[tier] ?? 0
    if (tier !== 'No Data') {
      numerator += m.weight * points
      denominator += m.weight
    }
  })
  return denominator > 0 ? numerator / denominator : 0
}

function computeCategories(metricTiers) {
  const cats = {
    safety:  { num: 0, den: 0 },
    quality: { num: 0, den: 0 },
    team:    { num: 0, den: 0 },
  }
  METRICS.forEach(m => {
    const tier = metricTiers[m.key] || 'No Data'
    const points = TIER_POINTS[tier] ?? 0
    if (tier !== 'No Data') {
      cats[m.category].num += m.weight * points
      cats[m.category].den += m.weight
    }
  })
  return {
    safety:  cats.safety.den  > 0 ? cats.safety.num  / cats.safety.den  : 0,
    quality: cats.quality.den > 0 ? cats.quality.num / cats.quality.den : 0,
    team:    cats.team.den    > 0 ? cats.team.num    / cats.team.den    : 0,
  }
}

function computeWeightByTier(metricTiers) {
  const byTier = { Fantastic: 0, Great: 0, Fair: 0, Poor: 0, 'No Data': 0 }
  METRICS.forEach(m => {
    const tier = metricTiers[m.key] || 'No Data'
    byTier[tier] = (byTier[tier] || 0) + m.weight
  })
  return byTier
}

function scoreStanding(score) {
  if (score >= 90) return 'Fantastic+'
  if (score >= 75) return 'Fantastic'
  if (score >= 60) return 'Great'
  if (score >= 40) return 'Fair'
  return 'Poor'
}

function fmtVal(metric, v) {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  if (metric.unit === '%') return `${n.toFixed(2)}%`
  if (metric.unit === 'DPMO') return Math.round(n).toLocaleString()
  if (metric.unit === '/100 trips') return n % 1 === 0 ? `${n}` : n.toFixed(1)
  return n % 1 === 0 ? `${n}` : n.toFixed(2)
}

// ── QUICK SCENARIOS ───────────────────────────────────────────
const SCENARIOS = [
  {
    label: 'Fix CDF to Great',
    desc: 'CDF DPMO → 1,300',
    apply: v => ({ ...v, cdf: 1300 }),
  },
  {
    label: 'Fix CDF to Fantastic',
    desc: 'CDF DPMO → 650',
    apply: v => ({ ...v, cdf: 650 }),
  },
  {
    label: 'Fix Following to Fantastic',
    desc: 'FDR → 1.5 events/100 trips',
    apply: v => ({ ...v, following: 1.5 }),
  },
  {
    label: 'Fix all 3 focus areas',
    desc: 'CDF + DSB + Following to Fantastic',
    apply: v => ({ ...v, cdf: 650, dsb: 100, following: 1.5 }),
  },
  {
    label: 'All metrics Fantastic',
    desc: 'Every metric at Fantastic level',
    apply: v => ({ ...v, speeding: 2, seatbelt: 0.5, signal: 1, distractions: 1, following: 1, dcr: 99.8, dsb: 50, ced: 0, cdf: 400, pod: 99, fleetExec: 0 }),
  },
]

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function ScorecardAnalytics({ reportData, week, publishedScore }) {
  // Build baseline values from Overview CSV
  const baseline = useMemo(() => {
    const drivers = reportData?.overview || []
    if (!drivers.length) {
      // W21 actuals as fallback
      return { speeding: 7.9, seatbelt: 0.9, signal: 3.4, distractions: 1.7, following: 5.0, dcr: 99.67, dsb: 239, ced: 0, cdf: 1699, pod: 98.74, fleetExec: 0.0 }
    }
    function wavg(col) {
      let total = 0, w = 0
      drivers.forEach(d => {
        const v = parseFloat(String(d[col] || '').replace('%', ''))
        const pkgs = parseFloat(d[COL.packages]) || 1
        if (!isNaN(v) && v >= 0) { total += v * pkgs; w += pkgs }
      })
      return w > 0 ? total / w : 0
    }
    return {
      speeding:     wavg(COL.speeding),
      seatbelt:     wavg(COL.seatbelt),
      signal:       wavg(COL.signalViol),
      distractions: wavg(COL.distractions),
      following:    wavg(COL.following),
      dcr:          wavg(COL.dcr),
      dsb:          wavg(COL.dsb),
      ced:          wavg(COL.ced),
      cdf:          wavg(COL.cdfDpmo),
      pod:          wavg(COL.pod),
      fleetExec:    0,
    }
  }, [reportData])

  const [values, setValues] = useState(baseline)

  // Compute tiers for baseline and current values
  const baseTiers = useMemo(() => {
    const t = {}
    METRICS.forEach(m => { t[m.key] = getTier(m, baseline[m.key] ?? 0) })
    return t
  }, [baseline])

  const currTiers = useMemo(() => {
    const t = {}
    METRICS.forEach(m => { t[m.key] = getTier(m, values[m.key] ?? 0) })
    return t
  }, [values])

  const baseScore = publishedScore || computeScore(baseTiers)
  const projScore = computeScore(currTiers)
  const projCats  = computeCategories(currTiers)
  const baseCats  = computeCategories(baseTiers)
  const weightByTier = computeWeightByTier(currTiers)
  const scoreDiff = projScore - baseScore

  function reset() { setValues(baseline) }

  return (
    <div style={{ maxWidth: 920 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 3 }}>Scorecard Analytics</h2>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {week || ''} · Formula: Σ(Weight × Tier Points) ÷ Σ(Weight) · F=79.5 · G=60 · Fair=40 · Poor=20
          </p>
        </div>
        <button onClick={reset} style={{ fontSize: 12, border: '0.5px solid var(--border)', borderRadius: 6, padding: '6px 14px', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-2)' }}>
          ↺ Reset
        </button>
      </div>

      {/* Score panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>

        {/* Published */}
        <div style={{ background: '#0f1e38', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 4 }}>PUBLISHED SCORE</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{baseScore.toFixed(1)}</div>
          <div style={{ marginTop: 6 }}><TierBadge tier={scoreStanding(baseScore)} /></div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Amazon DSP · {week}</div>
        </div>

        {/* Projected */}
        <div style={{
          background: 'var(--surface)',
          border: `0.5px solid ${TIER_COLORS[scoreStanding(projScore)]}55`,
          borderRadius: 8, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 4 }}>PROJECTED SCORE</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: TIER_COLORS[scoreStanding(projScore)], lineHeight: 1 }}>
            {projScore.toFixed(1)}
          </div>
          <div style={{ marginTop: 6 }}><TierBadge tier={scoreStanding(projScore)} /></div>
          {Math.abs(scoreDiff) > 0.05 && (
            <div style={{ fontSize: 11, color: scoreDiff > 0 ? TIER_COLORS.Great : TIER_COLORS.Poor, marginTop: 6, fontWeight: 600 }}>
              {scoreDiff > 0 ? '▲' : '▼'} {Math.abs(scoreDiff).toFixed(2)} pts
            </div>
          )}
        </div>

        {/* Safety category */}
        <CategoryCard label="Safety & Compliance" base={baseCats.safety} proj={projCats.safety} />

        {/* Quality category */}
        <CategoryCard label="Delivery Quality" base={baseCats.quality} proj={projCats.quality} />
      </div>

      {/* Weight by tier summary */}
      <WeightSummary weightByTier={weightByTier} />

      {/* Sliders — Safety */}
      <SliderSection
        title="Safety & Compliance"
        totalWeight={47.6}
        metrics={METRICS.filter(m => m.category === 'safety')}
        values={values}
        baseline={baseline}
        currTiers={currTiers}
        baseTiers={baseTiers}
        onChange={(key, val) => setValues(p => ({ ...p, [key]: val }))}
        publishedScore={baseScore}
        allCurrTiers={currTiers}
      />

      {/* Sliders — Quality */}
      <SliderSection
        title="Delivery Quality"
        totalWeight={47.5}
        metrics={METRICS.filter(m => m.category === 'quality')}
        values={values}
        baseline={baseline}
        currTiers={currTiers}
        baseTiers={baseTiers}
        onChange={(key, val) => setValues(p => ({ ...p, [key]: val }))}
        publishedScore={baseScore}
        allCurrTiers={currTiers}
      />

      {/* Sliders — Team */}
      <SliderSection
        title="Team & Fleet"
        totalWeight={5.0}
        metrics={METRICS.filter(m => m.category === 'team')}
        values={values}
        baseline={baseline}
        currTiers={currTiers}
        baseTiers={baseTiers}
        onChange={(key, val) => setValues(p => ({ ...p, [key]: val }))}
        publishedScore={baseScore}
        allCurrTiers={currTiers}
      />

      {/* Quick scenarios */}
      <div style={{ marginTop: 28 }}>
        <SectionHeader title="Quick Scenarios — Click to Apply" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {SCENARIOS.map(s => {
            const nv = s.apply(baseline)
            const nt = {}
            METRICS.forEach(m => { nt[m.key] = getTier(m, nv[m.key] ?? 0) })
            const ns = computeScore(nt)
            const diff = ns - baseScore
            const standing = scoreStanding(ns)
            const color = TIER_COLORS[standing]
            return (
              <div key={s.label} onClick={() => setValues(nv)}
                style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#aaa'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>{s.desc}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color }}>{ns.toFixed(2)}</span>
                    <TierBadge tier={standing} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: diff >= 0 ? TIER_COLORS.Great : TIER_COLORS.Poor }}>
                    {diff >= 0 ? '+' : ''}{diff.toFixed(2)} pts
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, borderTop: '0.5px solid var(--border)', paddingTop: 14 }}>
        Formula: Overall Score = Σ(Weight × Tier Points) ÷ Σ(Weight) &nbsp;·&nbsp;
        Fantastic = 79.5 pts &nbsp;·&nbsp; Great = 60 pts &nbsp;·&nbsp; Fair = 40 pts &nbsp;·&nbsp; Poor = 20 pts &nbsp;·&nbsp; No Data = 0 pts<br />
        Published score ({baseScore.toFixed(1)}) is from your Amazon DSP scorecard PDF. Projected score uses the same formula applied to slider values.
      </div>
    </div>
  )
}

// ── WEIGHT SUMMARY ────────────────────────────────────────────
function WeightSummary({ weightByTier }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
      {[['Fantastic', '#077398'], ['Great', '#358118'], ['Fair', '#d4770d'], ['Poor', '#cc0c3a']].map(([tier, color]) => (
        <div key={tier} style={{ background: color + '10', border: `0.5px solid ${color}44`, borderRadius: 6, padding: '8px 12px' }}>
          <div style={{ fontSize: 9, color, letterSpacing: '0.1em', fontWeight: 600, marginBottom: 2 }}>{tier.toUpperCase()} WEIGHT</div>
          <div style={{ fontSize: 18, fontWeight: 700, color }}>{(weightByTier[tier] || 0).toFixed(1)}%</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{TIER_POINTS[tier]} pts each</div>
        </div>
      ))}
    </div>
  )
}

// ── SLIDER SECTION ────────────────────────────────────────────
function SliderSection({ title, totalWeight, metrics, values, baseline, currTiers, baseTiers, onChange, publishedScore, allCurrTiers }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader title={title} subtitle={`${totalWeight}% of overall score`} />
      <div>
        {metrics.map(m => (
          <MetricSlider
            key={m.key}
            metric={m}
            value={values[m.key] ?? baseline[m.key] ?? 0}
            baseline={baseline[m.key] ?? 0}
            currTier={currTiers[m.key] || 'No Data'}
            baseTier={baseTiers[m.key] || 'No Data'}
            onChange={v => onChange(m.key, v)}
            publishedScore={publishedScore}
            allCurrTiers={allCurrTiers}
          />
        ))}
      </div>
    </div>
  )
}

// ── METRIC SLIDER ─────────────────────────────────────────────
function MetricSlider({ metric, value, baseline, currTier, baseTier, onChange, publishedScore, allCurrTiers }) {
  const color = TIER_COLORS[currTier] || '#9b9b9b'
  const tierChanged = currTier !== baseTier

  // What would the score be if THIS metric improved one tier?
  const nextTier = { Poor: 'Fair', Fair: 'Great', Great: 'Fantastic', Fantastic: 'Fantastic' }[currTier]
  const ptGain = nextTier ? (TIER_POINTS[nextTier] - TIER_POINTS[currTier]) * metric.weight / 100 : 0

  // Slider: left=worst, right=best always
  const { sliderMin, sliderMax, lowerBetter } = metric
  const toPos = v => lowerBetter
    ? 1 - (Math.min(sliderMax, Math.max(sliderMin, v)) - sliderMin) / (sliderMax - sliderMin)
    :     (Math.min(sliderMax, Math.max(sliderMin, v)) - sliderMin) / (sliderMax - sliderMin)
  const fromPos = p => lowerBetter
    ? sliderMin + (1 - p) * (sliderMax - sliderMin)
    : sliderMin + p * (sliderMax - sliderMin)

  const sliderPos = toPos(value)
  const basePos = toPos(baseline)

  // Gradient always Poor→Fair→Great→Fantastic→Fantastic+ left to right
  const gradient = `linear-gradient(to right, ${TIER_COLORS.Poor} 0%, ${TIER_COLORS.Fair} 33%, ${TIER_COLORS.Great} 55%, ${TIER_COLORS.Fantastic} 78%, ${TIER_COLORS['Fantastic+']} 100%)`

  const fmtV = v => {
    const n = parseFloat(v)
    if (isNaN(n)) return '—'
    if (metric.unit === '%') return `${n.toFixed(2)}%`
    if (metric.unit === 'DPMO') return Math.round(n).toLocaleString()
    return n % 1 === 0 ? `${n}` : n.toFixed(1)
  }

  return (
    <div style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border-subtle)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 120px 90px', gap: 14, alignItems: 'center' }}>

        {/* Label */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{metric.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, display: 'flex', gap: 8 }}>
            <span>{metric.weight}% weight</span>
            {currTier !== 'Fantastic' && currTier !== 'No Data' && (
              <span style={{ color: TIER_COLORS.Great }}>
                +{ptGain.toFixed(2)} pts to {nextTier}
              </span>
            )}
          </div>
        </div>

        {/* Slider track */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginBottom: 5 }}>
            <span style={{ color: TIER_COLORS.Poor }}>Poor · {fmtV(metric.lowerBetter ? sliderMax : sliderMin)}</span>
            <span style={{ color: TIER_COLORS['Fantastic+'] }}>Fantastic+ · {fmtV(metric.lowerBetter ? sliderMin : sliderMax)}</span>
          </div>
          <div style={{ position: 'relative', height: 8, borderRadius: 4, background: gradient }}>
            {/* Baseline marker */}
            <div style={{
              position: 'absolute', top: -3, left: `${basePos * 100}%`,
              transform: 'translateX(-50%)',
              width: 2, height: 14, background: '#6b7fa3',
              borderRadius: 1, pointerEvents: 'none', zIndex: 1,
            }} />
            {/* Thumb */}
            <div style={{
              position: 'absolute', top: '50%', left: `${sliderPos * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 16, height: 16, borderRadius: '50%',
              background: color, border: '2px solid #fff',
              boxShadow: `0 0 0 2px ${color}`,
              pointerEvents: 'none', zIndex: 2,
              transition: 'left 0.05s, background 0.1s',
            }} />
          </div>
          <input
            type="range" min={0} max={1000} step={1}
            value={Math.round(sliderPos * 1000)}
            onChange={e => {
              const pos = parseInt(e.target.value) / 1000
              const raw = fromPos(pos)
              const rounded = metric.unit === '%'
                ? Math.round(raw * 100) / 100
                : metric.unit === 'DPMO' ? Math.round(raw) : Math.round(raw * 10) / 10
              onChange(rounded)
            }}
            style={{ position: 'absolute', top: 13, left: 0, width: '100%', height: 20, opacity: 0, cursor: 'pointer', margin: 0 }}
          />
        </div>

        {/* Value */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
            {fmtV(value)}
            {tierChanged && <span style={{ fontSize: 9, marginLeft: 4 }}>↑</span>}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>base: {fmtV(baseline)}</div>
        </div>

        {/* Tier badge */}
        <div style={{ textAlign: 'right' }}>
          <TierBadge tier={currTier} />
          {tierChanged && (
            <div style={{ fontSize: 9, color: TIER_COLORS[baseTier] || 'var(--text-3)', marginTop: 3 }}>
              was {baseTier}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── REUSABLE COMPONENTS ───────────────────────────────────────
function CategoryCard({ label, base, proj }) {
  const tier = scoreStanding(proj)
  const color = TIER_COLORS[tier] || '#9b9b9b'
  const diff = proj - base
  return (
    <div style={{ background: 'var(--surface)', border: `0.5px solid ${color}55`, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{proj.toFixed(1)}</div>
      <div style={{ marginTop: 6 }}><TierBadge tier={tier} /></div>
      {Math.abs(diff) > 0.1 && (
        <div style={{ fontSize: 10, color: diff > 0 ? TIER_COLORS.Great : TIER_COLORS.Poor, marginTop: 5, fontWeight: 600 }}>
          {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)} pts
        </div>
      )}
    </div>
  )
}

function TierBadge({ tier }) {
  if (!tier || tier === 'No Data') return null
  const color = TIER_COLORS[tier] || '#9b9b9b'
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600,
      color, background: color + '18', border: `0.5px solid ${color}55`,
      borderRadius: 4, padding: '2px 8px',
    }}>{tier}</span>
  )
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{subtitle}</div>}
    </div>
  )
}
