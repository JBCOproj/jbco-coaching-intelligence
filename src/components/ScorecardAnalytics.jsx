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

// ── SCORECARD METRICS ─────────────────────────────────────────
// Weights from Appendix A (before PSB redistribution)
// lowerBetter: true = left side of slider is worst (highest number), right = best (lowest number)
// lowerBetter: false = left side is worst (lowest number), right = best (highest number)
//
// Tier thresholds confirmed from W21 Overview CSV driver data
const METRICS = [
  // SAFETY
  {
    key: 'speeding', label: 'Speeding event rate',
    col: COL.speeding, scoreCol: 'Speeding Event Rate Score', tierCol: COL.speedingTier,
    weight: 11.7, category: 'safety', unit: '/100 trips', lowerBetter: true,
    // Slider: left=worst(high number), right=best(0)
    sliderMin: 0, sliderMax: 25,
    // Tier thresholds (confirmed from PDF + driver data)
    tF: 8.0, tG: 13.0, tFair: 20.0,
    // Worst/best for slider display
    worst: 25, best: 0,
  },
  {
    key: 'seatbelt', label: 'Seatbelt-off rate',
    col: COL.seatbelt, scoreCol: 'Seatbelt-Off Rate Score', tierCol: COL.seatbeltTier,
    weight: 11.7, category: 'safety', unit: '/100 trips', lowerBetter: true,
    sliderMin: 0, sliderMax: 10,
    tF: 3.0, tG: 5.0, tFair: 8.0,
    worst: 10, best: 0,
  },
  {
    key: 'signal', label: 'Sign/signal violations',
    col: COL.signalViol, scoreCol: 'Sign/ Signal Violations Rate Score', tierCol: COL.signalViolTier,
    weight: 11.7, category: 'safety', unit: '/100 trips', lowerBetter: true,
    sliderMin: 0, sliderMax: 20,
    tF: 6.0, tG: 9.0, tFair: 15.0,
    worst: 20, best: 0,
  },
  {
    key: 'distractions', label: 'Distractions rate',
    col: COL.distractions, scoreCol: 'Distractions Rate Score', tierCol: COL.distractionsTier,
    weight: 7.5, category: 'safety', unit: '/100 trips', lowerBetter: true,
    sliderMin: 0, sliderMax: 10,
    tF: 2.5, tG: 4.0, tFair: 7.0,
    worst: 10, best: 0,
  },
  {
    key: 'following', label: 'Following distance rate',
    col: COL.following, scoreCol: 'Following Distance Rate Score', tierCol: COL.followingTier,
    weight: 5.0, category: 'safety', unit: '/100 trips', lowerBetter: true,
    sliderMin: 0, sliderMax: 15,
    tF: 3.9, tG: 6.0, tFair: 10.0,
    worst: 15, best: 0,
  },
  // QUALITY
  {
    key: 'dcr', label: 'Delivery completion rate (DCR)',
    col: COL.dcr, scoreCol: 'DCR Score', tierCol: COL.dcrTier,
    weight: 12.7, category: 'quality', unit: '%', lowerBetter: false,
    sliderMin: 97, sliderMax: 100,
    tF: 99.5, tG: 99.0, tFair: 98.0,
    worst: 97, best: 100,
  },
  {
    key: 'dsb', label: 'Delivery success behaviors (DSB)',
    col: COL.dsb, scoreCol: 'DSB DPMO Score', tierCol: COL.dsbTier,
    weight: 12.7, category: 'quality', unit: 'DPMO', lowerBetter: true,
    sliderMin: 0, sliderMax: 1500,
    tF: 200, tG: 350, tFair: 600,
    worst: 1500, best: 0,
  },
  {
    key: 'ced', label: 'Customer escalation defect (CED)',
    col: COL.ced, scoreCol: 'CED Score', tierCol: COL.cedTier,
    weight: 12.7, category: 'quality', unit: 'DPMO', lowerBetter: true,
    sliderMin: 0, sliderMax: 500,
    tF: 0, tG: 50, tFair: 200,
    worst: 500, best: 0,
  },
  {
    key: 'cdf', label: 'Customer delivery feedback (CDF)',
    col: COL.cdfDpmo, scoreCol: 'CDF DPMO Score', tierCol: COL.cdfTier,
    weight: 6.3, category: 'quality', unit: 'DPMO', lowerBetter: true,
    sliderMin: 0, sliderMax: 4000,
    tF: 1076, tG: 1669, tFair: 2832,
    worst: 4000, best: 0,
  },
  {
    key: 'pod', label: 'Photo on delivery (POD)',
    col: COL.pod, scoreCol: 'POD Score', tierCol: COL.podTier,
    weight: 3.1, category: 'quality', unit: '%', lowerBetter: false,
    sliderMin: 94, sliderMax: 100,
    tF: 98.0, tG: 96.0, tFair: 94.0,
    worst: 94, best: 100,
  },
]

// ── TIER HELPER ───────────────────────────────────────────────
function getTier(metric, value) {
  const v = parseFloat(String(value).replace('%', ''))
  if (isNaN(v)) return null
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

// Continuous 0-100 score within tier bands (confirmed from CSV)
function getMetricScore(metric, value) {
  const v = parseFloat(String(value).replace('%', ''))
  if (isNaN(v)) return 0
  const { tF, tG, tFair, lowerBetter } = metric
  if (lowerBetter) {
    if (v <= tF)    return 100
    if (v <= tG)    return 75 + (tG - v) / (tG - tF) * 25
    if (v <= tFair) return 50 + (tFair - v) / (tFair - tG) * 25
    return Math.max(0, 50 * tFair / v)
  } else {
    if (v >= tF)    return 100
    if (v >= tG)    return 75 + (v - tG) / (tF - tG) * 25
    if (v >= tFair) return 50 + (v - tFair) / (tG - tFair) * 25
    return Math.max(0, (v / tFair) * 50)
  }
}

// Category scores
function getCategoryScores(values) {
  const cats = { safety: { total: 0, w: 0 }, quality: { total: 0, w: 0 } }
  METRICS.forEach(m => {
    const v = values[m.key]
    if (v == null) return
    const score = getMetricScore(m, v)
    cats[m.category].total += score * m.weight
    cats[m.category].w += m.weight
  })
  return {
    safety:  cats.safety.w  > 0 ? cats.safety.total  / cats.safety.w  : 0,
    quality: cats.quality.w > 0 ? cats.quality.total / cats.quality.w : 0,
    team:    100, // Fleet Execution = Fantastic, Tenured = Fantastic
  }
}

// ── QUICK SCENARIOS ───────────────────────────────────────────
const SCENARIOS = [
  { label: 'Fix CDF to Great',      desc: 'CDF DPMO → 1,000',                  apply: v => ({ ...v, cdf: 1000 }) },
  { label: 'Fix CDF to Fantastic',  desc: 'CDF DPMO → 400',                    apply: v => ({ ...v, cdf: 400 }) },
  { label: 'Fix Following distance', desc: 'FDR → 2.0 events/100 trips',        apply: v => ({ ...v, following: 2.0 }) },
  { label: 'Fix all 3 focus areas', desc: 'CDF + DSB + Following to Fantastic', apply: v => ({ ...v, cdf: 400, dsb: 0, following: 1.0 }) },
  { label: 'All metrics Fantastic', desc: 'Every metric at best possible level', apply: v => ({ ...v, cdf: 400, dsb: 0, ced: 0, dcr: 100, speeding: 0, seatbelt: 0, signal: 0, distractions: 0, following: 0, pod: 100 }) },
]

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function ScorecardAnalytics({ reportData, week, publishedScore }) {
  // Build baseline from actual company metric values in Overview CSV
  const baseline = useMemo(() => {
    const drivers = reportData?.overview || []
    if (!drivers.length) {
      // Fallback to W21 actuals
      return { speeding: 7.9, seatbelt: 0.9, signal: 3.4, distractions: 1.7, following: 5.0, dcr: 99.67, dsb: 239, ced: 0, cdf: 1699, pod: 98.74 }
    }
    // Use actual driver averages weighted by packages as proxy for company metrics
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
      speeding:    wavg(COL.speeding),
      seatbelt:    wavg(COL.seatbelt),
      signal:      wavg(COL.signalViol),
      distractions:wavg(COL.distractions),
      following:   wavg(COL.following),
      dcr:         wavg(COL.dcr),
      dsb:         wavg(COL.dsb),
      ced:         wavg(COL.ced),
      cdf:         wavg(COL.cdfDpmo),
      pod:         wavg(COL.pod),
    }
  }, [reportData])

  const [values, setValues] = useState(baseline)
  const baseCategories = useMemo(() => getCategoryScores(baseline), [baseline])
  const projCategories = useMemo(() => getCategoryScores(values), [values])

  function reset() { setValues(baseline) }

  const score = publishedScore || 72.6

  return (
    <div style={{ maxWidth: 900 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 3 }}>Scorecard Analytics</h2>
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{week || ''} · Adjust sliders to see what-if impact on category scores</p>
        </div>
        <button onClick={reset} style={{ fontSize: 12, border: '0.5px solid var(--border)', borderRadius: 6, padding: '6px 14px', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-2)' }}>
          ↺ Reset sliders
        </button>
      </div>

      {/* Published score + category scores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        <div style={{ background: '#0f1e38', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', marginBottom: 4 }}>PUBLISHED SCORE</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{score}</div>
          <TierBadge tier={scoreTier(score)} />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Amazon published · {week}</div>
        </div>

        <CategoryCard label="Safety & Compliance" base={baseCategories.safety}  proj={projCategories.safety} />
        <CategoryCard label="Quality"              base={baseCategories.quality} proj={projCategories.quality} />
        <CategoryCard label="Team"                 base={baseCategories.team}    proj={projCategories.team} />
      </div>

      {/* Sliders — Safety */}
      <SliderGroup
        title="Safety & Compliance"
        metrics={METRICS.filter(m => m.category === 'safety')}
        values={values}
        baseline={baseline}
        onChange={(key, val) => setValues(p => ({ ...p, [key]: val }))}
        reportData={reportData}
      />

      {/* Sliders — Quality */}
      <SliderGroup
        title="Quality"
        metrics={METRICS.filter(m => m.category === 'quality')}
        values={values}
        baseline={baseline}
        onChange={(key, val) => setValues(p => ({ ...p, [key]: val }))}
        reportData={reportData}
      />

      {/* Quick scenarios */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 10 }}>
          Quick scenarios — click to apply
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {SCENARIOS.map(s => {
            const newVals = s.apply(baseline)
            const newCats = getCategoryScores(newVals)
            return (
              <div key={s.label} onClick={() => setValues(newVals)}
                style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '12px 14px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#aaa'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>{s.desc}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <ScorePill label="Safety"  score={newCats.safety} />
                  <ScorePill label="Quality" score={newCats.quality} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6, borderTop: '0.5px solid var(--border)', paddingTop: 14 }}>
        Category scores are computed from metric tier positions using Amazon's published weights (Appendix A).
        Published overall score ({score}) is from your Amazon DSP scorecard PDF.
        Slider adjustments show directional impact on Safety and Quality category scores.
      </div>
    </div>
  )
}

// ── SUB-COMPONENTS ────────────────────────────────────────────

function SliderGroup({ title, metrics, values, baseline, onChange, reportData }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {metrics.map(m => (
          <MetricSlider
            key={m.key}
            metric={m}
            value={values[m.key] ?? baseline[m.key] ?? 0}
            baseline={baseline[m.key] ?? 0}
            onChange={v => onChange(m.key, v)}
            reportData={reportData}
          />
        ))}
      </div>
    </div>
  )
}

function MetricSlider({ metric, value, baseline, onChange, reportData }) {
  const tier = getTier(metric, value)
  const baseTier = getTier(metric, baseline)
  const color = TIER_COLORS[tier] || '#9b9b9b'
  const fmt = v => {
    const n = parseFloat(v)
    if (metric.unit === '%') return `${n.toFixed(2)}%`
    if (metric.unit === 'DPMO' || metric.unit === '') return Math.round(n).toLocaleString()
    return n % 1 === 0 ? `${n}` : n.toFixed(1)
  }

  // Slider: left=worst, right=best always
  // For lowerBetter: invert so moving right = lower number = better
  const { sliderMin, sliderMax, lowerBetter } = metric

  // Convert internal value to slider position (0=left/worst, 1=right/best)
  const toSlider = v => lowerBetter
    ? 1 - (v - sliderMin) / (sliderMax - sliderMin)
    :     (v - sliderMin) / (sliderMax - sliderMin)

  const fromSlider = s => lowerBetter
    ? sliderMin + (1 - s) * (sliderMax - sliderMin)
    : sliderMin + s * (sliderMax - sliderMin)

  const sliderPos = Math.min(1, Math.max(0, toSlider(value)))

  // Track gradient: always Poor→Fair→Great→Fantastic left to right
  const gradient = `linear-gradient(to right, ${TIER_COLORS.Poor}, ${TIER_COLORS.Fair} 33%, ${TIER_COLORS.Great} 55%, ${TIER_COLORS.Fantastic} 75%, ${TIER_COLORS['Fantastic+']} 100%)`

  // Baseline marker position
  const baselinePos = Math.min(1, Math.max(0, toSlider(baseline)))

  // Top drivers for this metric (who's hurting it most)
  const topDrivers = useMemo(() => {
    const drivers = reportData?.overview || []
    return drivers
      .map(d => ({
        name: (d[COL.name] || '').trim(),
        val: parseFloat(String(d[metric.col] || '').replace('%', '')) || 0,
        score: parseFloat(d[metric.scoreCol]) || 0,
      }))
      .filter(d => d.name && !isNaN(d.val))
      .sort((a, b) => metric.lowerBetter ? b.val - a.val : a.val - b.val)
      .slice(0, 3)
  }, [reportData, metric])

  const tierChanged = tier !== baseTier

  return (
    <div style={{ padding: '10px 0', borderBottom: '0.5px solid var(--border-subtle)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 110px 80px', gap: 16, alignItems: 'center' }}>

        {/* Label */}
        <div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{metric.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
            {metric.weight}% weight
            {tierChanged && <span style={{ marginLeft: 6, color, fontWeight: 600 }}>→ {tier}</span>}
          </div>
        </div>

        {/* Slider */}
        <div style={{ position: 'relative', paddingTop: 4, paddingBottom: 4 }}>
          {/* Left label */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginBottom: 4 }}>
            <span style={{ color: TIER_COLORS.Poor }}>Poor · {fmt(metric.worst)}</span>
            <span style={{ color: TIER_COLORS['Fantastic+'] }}>Fantastic+ · {fmt(metric.best)}</span>
          </div>

          {/* Track */}
          <div style={{ position: 'relative', height: 8, borderRadius: 4, background: gradient, overflow: 'visible' }}>
            {/* Thumb indicator */}
            <div style={{
              position: 'absolute', top: '50%', left: `${sliderPos * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 16, height: 16, borderRadius: '50%',
              background: color, border: '2px solid #fff',
              boxShadow: `0 0 0 2px ${color}`,
              pointerEvents: 'none', zIndex: 2,
              transition: 'left 0.05s',
            }} />
            {/* Baseline marker */}
            <div style={{
              position: 'absolute', top: -3, left: `${baselinePos * 100}%`,
              transform: 'translateX(-50%)',
              width: 2, height: 14, background: '#6b7fa3',
              borderRadius: 1, pointerEvents: 'none', zIndex: 1,
            }} />
          </div>

          {/* Range input — inverted for lowerBetter */}
          <input
            type="range"
            min={0} max={1000} step={1}
            value={Math.round(sliderPos * 1000)}
            onChange={e => {
              const pos = parseInt(e.target.value) / 1000
              const raw = fromSlider(pos)
              // Round to reasonable precision
              const rounded = metric.unit === '%' ? Math.round(raw * 100) / 100 : Math.round(raw)
              onChange(rounded)
            }}
            style={{
              position: 'absolute', top: 4, left: 0, width: '100%',
              height: 16, opacity: 0, cursor: 'pointer', margin: 0,
            }}
          />
        </div>

        {/* Current value */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color, fontFamily: 'var(--font-mono)' }}>
            {fmt(value)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
            baseline: {fmt(baseline)}
          </div>
        </div>

        {/* Tier badge */}
        <div style={{ textAlign: 'right' }}>
          <TierBadge tier={tier} />
        </div>
      </div>

      {/* Top drivers impacting this metric */}
      {topDrivers.length > 0 && value !== baseline && (
        <div style={{ marginTop: 6, marginLeft: 220, fontSize: 10, color: 'var(--text-3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-3)' }}>Top drivers to coach:</span>
          {topDrivers.map((d, i) => (
            <span key={i} style={{ color: 'var(--text-2)', fontWeight: 500 }}>
              {d.name.split(' ').slice(0,2).join(' ')} ({fmt(d.val)})
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryCard({ label, base, proj }) {
  const tier = scoreTier(proj)
  const color = TIER_COLORS[tier] || '#9b9b9b'
  const changed = Math.abs(proj - base) > 0.5
  return (
    <div style={{ background: 'var(--surface)', border: `0.5px solid ${color}55`, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color, marginBottom: 4 }}>{proj.toFixed(1)}</div>
      <TierBadge tier={tier} />
      {changed && (
        <div style={{ fontSize: 10, color: proj > base ? TIER_COLORS.Great : TIER_COLORS.Poor, marginTop: 6 }}>
          {proj > base ? '▲' : '▼'} {Math.abs(proj - base).toFixed(1)} pts from baseline
        </div>
      )}
    </div>
  )
}

function TierBadge({ tier }) {
  if (!tier) return null
  const color = TIER_COLORS[tier] || '#9b9b9b'
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600,
      color, background: color + '18', border: `0.5px solid ${color}55`,
      borderRadius: 4, padding: '2px 8px',
    }}>{tier}</span>
  )
}

function ScorePill({ label, score }) {
  const tier = scoreTier(score)
  const color = TIER_COLORS[tier] || '#9b9b9b'
  return (
    <div style={{ fontSize: 10 }}>
      <span style={{ color: 'var(--text-3)' }}>{label}: </span>
      <span style={{ fontWeight: 600, color }}>{score.toFixed(1)}</span>
    </div>
  )
}

function scoreTier(score) {
  if (score >= 90) return 'Fantastic+'
  if (score >= 75) return 'Fantastic'
  if (score >= 60) return 'Great'
  if (score >= 40) return 'Fair'
  return 'Poor'
}


