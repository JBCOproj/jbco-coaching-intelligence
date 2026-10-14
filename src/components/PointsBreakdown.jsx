import { useMemo } from 'react'
import { METRICS, scoreWeek, whatIf, pathTo, tierFor } from '../scoreEngine.js'

// ── TIER COLORS — NEVER CHANGE ────────────────────────────────
const TIER_COLORS = {
  'Poor':       '#cc0c3a',
  'Fair':       '#d4770d',
  'Great':      '#358118',
  'Fantastic':  '#077398',
  'Fantastic+': '#0c4962',
}

// Bar colors by group (navy family — tier colors are reserved for tiers)
const GROUP_COLORS = {
  safety:      'var(--navy)',
  quality:     '#8a95a8',
  reliability: '#c4cad4',
}
const GROUP_LABELS = { safety: 'Safety', quality: 'Quality', reliability: 'Fleet' }

function fmtValue(m, v) {
  if (v == null) return '—'
  if (m.fromPct) return `${Number(v).toFixed(2)}%`
  if (m.unit === 'DPMO') return `${Math.round(v).toLocaleString()} DPMO`
  if (m.unit === 'per 100 trips') return `${Number(v).toFixed(1)} per 100 trips`
  return `${Number(v).toFixed(2)}${m.unit === '%' ? '%' : ''}`
}

function fmtTarget(m, v) {
  if (m.fromPct) return `${Number(v).toFixed(2)}%`
  if (m.unit === 'DPMO') return Math.round(v).toLocaleString()
  return Number(v).toFixed(1)
}

export default function PointsBreakdown({ scorecard }) {
  const data = useMemo(() => {
    if (!scorecard?.metrics || scorecard.overall == null) return null
    const input = { ...scorecard.metrics, safetyTier: scorecard.safetyTier }
    const engine = scoreWeek(input)
    const published = scorecard.overall
    const totalLost = 100 - published
    const notItemized = engine.overall - published // + means Amazon took more than the engine itemizes

    // Scenario scores are anchored to the published score so the engine gap doesn't distort them
    const anchored = (s) => published + (s.overall - engine.overall)
    const toFantastic = (group) => {
      const o = {}
      for (const [k, m] of Object.entries(METRICS)) {
        if (m.group !== group || input[k] == null) continue
        if (m.fromPct) o[k] = Math.max(input[k], +(100 - m.fantastic).toFixed(2))
        else o[k] = Math.min(input[k], m.fantastic)
      }
      return o
    }
    const safetyFixed = anchored(whatIf(input, { ...toFantastic('safety'), safetyTier: 'Fantastic' }))
    const qualityFixed = anchored(whatIf(input, toFantastic('quality')))

    // Path to Fantastic+ (85): solve on engine scale, offset by the engine gap
    const target = 85 + (engine.overall - published)
    const path = pathTo(input, target)

    return { engine, published, totalLost, notItemized, safetyFixed, qualityFixed, path }
  }, [scorecard])

  if (!data) return null
  const { engine, published, totalLost, notItemized, safetyFixed, qualityFixed, path } = data
  const rows = engine.rows.filter((r) => r.lost >= 0.005)
  const maxLost = Math.max(...rows.map((r) => r.lost), Math.abs(notItemized), 0.01)
  const pathGain = path.steps.reduce((s, x) => s + x.gain, 0)
  // Combine repeat steps on the same metric into one line (e.g. Sign/Signal 9.0 → 6.2 → 3.1 becomes 9.0 → 3.1)
  const steps = []
  for (const st of path.steps) {
    const prev = steps.find((x) => x.key === st.key)
    if (prev) { prev.to = st.to; prev.gain += st.gain } else steps.push({ ...st })
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <SectionHeader title="Where the points went" subtitle={`${scorecard.week || ''} · from your scorecard PDF`} />

      {/* Breakdown card */}
      <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Where the <b style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{totalLost.toFixed(1)}</b> points went
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-2)' }}>
            {['safety', 'quality', 'reliability'].map((g) => (
              <span key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: GROUP_COLORS[g] }} />{GROUP_LABELS[g]}
              </span>
            ))}
          </div>
        </div>

        {rows.map((r) => (
          <BarRow key={r.key} label={r.label} sub={fmtValue(r, r.value)} value={r.lost} max={maxLost} color={GROUP_COLORS[r.group]} />
        ))}
        {Math.abs(notItemized) >= 0.05 && (
          <BarRow label="Not itemized" sub="engine gap vs. Amazon" value={notItemized} max={maxLost} color="var(--border)" muted />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, borderTop: '0.5px solid var(--border)', marginTop: 12, paddingTop: 10, fontSize: 11, color: 'var(--text-2)' }}>
          <span>
            Safety <b style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>-{engine.lostSafety.toFixed(2)}</b>
            &nbsp;&nbsp;Quality <b style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>-{engine.lostQuality.toFixed(2)}</b>
            &nbsp;&nbsp;Fleet <b style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>-{engine.lostReliability.toFixed(2)}</b>
          </span>
          <span>Not itemized = difference between this calculation and Amazon's published score</span>
        </div>
      </div>

      {/* Scenario cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 10 }}>
        <ScenarioCard title="If every Safety metric hit Fantastic" score={safetyFixed} published={published} />
        <ScenarioCard title="If every Quality metric hit Fantastic" score={qualityFixed} published={published} />
      </div>

      {/* Path to Fantastic+ */}
      <div style={{ background: 'var(--surface)', border: `0.5px solid ${TIER_COLORS['Fantastic+']}55`, borderRadius: 8, padding: '14px 16px', marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 18 }}>
        <div style={{ minWidth: 150 }}>
          <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>What it takes to reach</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, fontFamily: 'var(--font-mono)', color: TIER_COLORS['Fantastic+'] }}>
              {Math.max(85, published + pathGain).toFixed(1)}
            </span>
            <TierBadge tier="Fantastic+" />
          </div>
          {published >= 85 && <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6 }}>Already at Fantastic+</div>}
        </div>
        {published < 85 && (
          <div style={{ flex: 1, minWidth: 220, borderLeft: '0.5px solid var(--border)', paddingLeft: 16 }}>
            {steps.map((s, i) => {
              const m = METRICS[s.key]
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '3px 0' }}>
                  <span>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: GROUP_COLORS[m.group], marginRight: 7 }} />
                    <b style={{ fontWeight: 600 }}>{s.label}</b>
                    <span style={{ color: 'var(--text-2)' }}> {fmtTarget(m, s.from)} → {fmtTarget(m, s.to)}</span>
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: TIER_COLORS.Great }}>+{s.gain.toFixed(1)}</span>
                </div>
              )
            })}
            {!path.reached && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Even with these changes the target isn't reached this week.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BarRow({ label, sub, value, max, color, muted }) {
  const pct = Math.min(100, (Math.abs(value) / max) * 100)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 170px) 1fr 56px', alignItems: 'center', gap: 12, padding: '5px 0' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: muted ? 'var(--text-3)' : 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{sub}</div>
      </div>
      <div style={{ height: 10, background: 'var(--border-subtle)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5 }} />
      </div>
      <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: muted ? 'var(--text-3)' : 'var(--text)' }}>
        {value >= 0 ? '-' : '+'}{Math.abs(value).toFixed(2)}
      </div>
    </div>
  )
}

function ScenarioCard({ title, score, published }) {
  const tier = tierFor(score).name
  const diff = score - published
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: TIER_COLORS[tier] }}>{score.toFixed(1)}</span>
          <TierBadge tier={tier} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: diff > 0.05 ? TIER_COLORS.Great : 'var(--text-3)' }}>
          {diff > 0.05 ? `+${diff.toFixed(1)} pts` : 'no change'}
        </span>
      </div>
    </div>
  )
}

function TierBadge({ tier }) {
  const color = TIER_COLORS[tier] || '#9b9b9b'
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color, background: color + '18', border: `0.5px solid ${color}55`, borderRadius: 4, padding: '2px 8px' }}>{tier}</span>
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
