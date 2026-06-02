import { COL, getDriverTierColor, getFleetTier } from '../utils.js'

const TIER_COLORS = { Platinum: '#358118', Gold: '#b8860b', Silver: '#6b7fa3', Bronze: '#a0522d' }

export default function Dashboard({ report, week, tierCounts, totalPackages, publishedScore, scoreHistory, onNav }) {
  if (!report) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-3)' }}>
        <i className="ti ti-layout-dashboard" style={{ fontSize: 40, display: 'block', marginBottom: 14 }} />
        <div style={{ fontSize: 14, marginBottom: 6 }}>No report loaded yet</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>Upload your weekly files to get started</div>
        <button onClick={() => onNav('uploads')} style={{ background: '#0f1e38', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 12, cursor: 'pointer' }}>
          Upload files
        </button>
      </div>
    )
  }

  const { label: tier, color } = getFleetTier(publishedScore)
  const gap = Math.max(0, 75 - publishedScore).toFixed(1)
  const totalDrivers = Object.values(tierCounts).reduce((s, v) => s + v, 0)

  // Focus areas from the scorecard
  const focusDrivers = (report.drivers || []).filter(d => ['Bronze', 'Silver'].includes(d[COL.standing])).slice(0, 5)
  const highCdf = (report.cdfDrivers || []).slice(0, 3)

  // Quick metric snapshot
  const overview = report.overview || []
  function avgMetric(col) {
    const vals = overview.map(d => parseFloat((d[col] || '').replace('%', ''))).filter(v => !isNaN(v) && v > 0)
    return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length) : 0
  }

  return (
    <div style={{ maxWidth: 980, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Row 1: Score hero + tier counts */}
      <div style={{ display: 'grid', gridTemplateColumns: '210px repeat(4, 1fr)', gap: 10 }}>

        {/* DSP Score */}
        <div style={{ background: '#0f1e38', borderRadius: 10, padding: '16px 16px 14px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', marginBottom: 6 }}>DSP SCORE</div>
          <div style={{ fontSize: 38, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{publishedScore}</div>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', background: color, padding: '2px 9px', borderRadius: 4 }}>{tier}</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
            {gap === '0.0' ? 'At Fantastic threshold' : `Gap to Fantastic: ${gap} pts`}
          </div>
          {/* Mini sparkline */}
          {scoreHistory.length > 1 && (
            <svg style={{ position: 'absolute', bottom: 10, right: 10, opacity: 0.4 }} width="60" height="24" viewBox="0 0 60 24">
              <polyline
                points={scoreHistory.map((s, i) => `${i * (60 / (scoreHistory.length - 1))},${24 - ((s.score - 60) / 30) * 24}`).join(' ')}
                fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {/* Tier count cards */}
        {[
          { label: 'PLATINUM', key: 'Platinum', icon: 'ti-award' },
          { label: 'GOLD', key: 'Gold', icon: 'ti-star' },
          { label: 'SILVER', key: 'Silver', icon: 'ti-medal' },
          { label: 'BRONZE', key: 'Bronze', icon: 'ti-shield' },
        ].map(({ label, key, icon }) => {
          const c = TIER_COLORS[key]
          const count = tierCounts[key] || 0
          const pct = totalDrivers > 0 ? ((count / totalDrivers) * 100).toFixed(1) : '0.0'
          return (
            <div key={key} onClick={() => onNav('drivers')} style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 14px 12px', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#aaa'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 9, color: c, letterSpacing: '0.1em', fontWeight: 600 }}>{label}</div>
                <i className={`ti ${icon}`} style={{ fontSize: 13, color: c }} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, color: c, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{pct}% of drivers</div>
            </div>
          )
        })}
      </div>

      {/* Row 2: AI Priorities + Score Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* AI coaching priorities */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>AI Coaching Priorities</div>
            <span style={{ fontSize: 9, color: '#077398', background: '#e8f4f8', padding: '2px 7px', borderRadius: 3, letterSpacing: '0.04em', fontWeight: 500 }}>POWERED BY AI</span>
          </div>
          {[
            { n: 1, title: 'Improve CDF performance', desc: `CDF DPMO at ${avgMetric(COL.cdfDpmo).toFixed(0)} — above Fantastic target of 400`, pts: '+2.4 pts' },
            { n: 2, title: 'Coach drivers on following distance', desc: `${focusDrivers.length} drivers below target on FDR`, pts: '+1.8 pts' },
            { n: 3, title: 'Reduce seatbelt-off violations', desc: `Avg ${avgMetric(COL.seatbelt).toFixed(1)}/100 trips`, pts: '+0.7 pts' },
          ].map(p => (
            <div key={p.n} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '0.5px solid var(--border-subtle)', alignItems: 'flex-start' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#0f1e38', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{p.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{p.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.4 }}>{p.desc}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#358118', flexShrink: 0 }}>{p.pts}</div>
            </div>
          ))}
          <div onClick={() => onNav('ai')} style={{ marginTop: 10, fontSize: 11, color: '#077398', cursor: 'pointer' }}>View all AI recommendations →</div>
        </div>

        {/* Score trend */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Score Trend</div>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Last {scoreHistory.length} weeks</span>
          </div>
          <ScoreTrendChart history={scoreHistory} currentScore={publishedScore} />
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {[['#cc0c3a', 'Poor <40'], ['#d4770d', 'Fair 40–60'], ['#358118', 'Great 60–75'], ['#077398', 'Fantastic 75–90'], ['#0c4962', 'F+ 90+']].map(([c, l]) => (
              <span key={l} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: c + '18', color: c, fontWeight: 600 }}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Driver preview + scorecard snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14 }}>

        {/* Driver performance preview */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Driver Performance</div>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Needs attention first</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 56px 56px 56px 72px', gap: 8, fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.08em', paddingBottom: 6, borderBottom: '0.5px solid var(--border-subtle)' }}>
            <div></div><div>DRIVER</div><div style={{ textAlign: 'right' }}>PKGS</div><div style={{ textAlign: 'center' }}>SAFETY</div><div style={{ textAlign: 'right' }}>SCORE</div><div style={{ textAlign: 'right' }}>TIER</div>
          </div>
          {(report.drivers || []).slice(0, 5).map((d, i) => {
            const tc = getDriverTierColor(d[COL.standing])
            const name = d[COL.name]?.trim() || `Driver ${i + 1}`
            const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
            const safetyCount = (report.safetyMap[d[COL.tid]] || []).length
            return (
              <div key={i} onClick={() => onNav('drivers')} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 56px 56px 56px 72px', gap: 8, padding: '7px 0', borderBottom: '0.5px solid var(--border-subtle)', alignItems: 'center', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fafaf8'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: tc + '18', color: tc, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{d[COL.packages]} pkgs</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11 }}>{d[COL.packages]}</div>
                <div style={{ textAlign: 'center' }}>
                  {safetyCount > 0 && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 10, background: safetyCount > 2 ? '#fdf0f2' : '#fff8f0', color: safetyCount > 2 ? '#cc0c3a' : '#d4770d', fontWeight: 600 }}>{safetyCount}</span>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: tc }}>{parseFloat(d[COL.score] || 0).toFixed(1)}</div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: tc + '18', color: tc, fontWeight: 500 }}>{d[COL.standing]}</span>
                </div>
              </div>
            )
          })}
          <div onClick={() => onNav('drivers')} style={{ marginTop: 10, fontSize: 11, color: '#077398', cursor: 'pointer' }}>View all {totalDrivers} drivers →</div>
        </div>

        {/* Scorecard metrics snapshot */}
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Scorecard Metrics</div>
          {[
            { label: 'CDF DPMO', val: avgMetric(COL.cdfDpmo).toFixed(0), tier: avgMetric(COL.cdfDpmo) <= 400 ? 'Fantastic' : avgMetric(COL.cdfDpmo) <= 1000 ? 'Great' : 'Fair' },
            { label: 'Following distance', val: avgMetric(COL.following).toFixed(1), tier: avgMetric(COL.following) <= 3 ? 'Fantastic' : 'Fair' },
            { label: 'DCR', val: avgMetric(COL.dcr).toFixed(2) + '%', tier: avgMetric(COL.dcr) >= 99.8 ? 'Fantastic' : avgMetric(COL.dcr) >= 99.5 ? 'Great' : 'Fair' },
            { label: 'Speeding', val: avgMetric(COL.speeding).toFixed(1), tier: avgMetric(COL.speeding) <= 2 ? 'Fantastic' : avgMetric(COL.speeding) <= 5 ? 'Great' : 'Fair' },
            { label: 'DSB DPMO', val: avgMetric(COL.dsb).toFixed(0), tier: avgMetric(COL.dsb) <= 100 ? 'Fantastic' : avgMetric(COL.dsb) <= 500 ? 'Great' : 'Fair' },
            { label: 'Seatbelt-off', val: avgMetric(COL.seatbelt).toFixed(1), tier: avgMetric(COL.seatbelt) <= 0.5 ? 'Fantastic' : 'Fair' },
          ].map(m => {
            const tc = m.tier === 'Fantastic' ? '#077398' : m.tier === 'Great' ? '#358118' : m.tier === 'Fair' ? '#d4770d' : '#cc0c3a'
            return (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid var(--border-subtle)', fontSize: 11 }}>
                <span style={{ color: 'var(--text-2)' }}>{m.label}</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: tc + '18', color: tc, fontWeight: 600 }}>{m.tier}</span>
              </div>
            )
          })}
          <div onClick={() => onNav('contest')} style={{ marginTop: 10, fontSize: 11, color: '#d4770d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="ti ti-file-alert" style={{ fontSize: 12 }} /> Review contestable metrics
          </div>
        </div>
      </div>

    </div>
  )
}

function ScoreTrendChart({ history, currentScore }) {
  if (!history || history.length < 2) {
    return (
      <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-3)' }}>
        Save more weeks to see trend
      </div>
    )
  }
  const W = 320, H = 70
  const scores = history.map(h => parseFloat(h.score) || currentScore)
  const minS = Math.min(...scores) - 5
  const maxS = Math.max(...scores) + 5
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * W
    const y = H - ((s - minS) / (maxS - minS)) * H
    return `${x},${y}`
  }).join(' ')
  const lastX = W, lastY = H - ((scores[scores.length - 1] - minS) / (maxS - minS)) * H
  const fantasticY = H - ((75 - minS) / (maxS - minS)) * H

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {fantasticY > 0 && fantasticY < H && (
        <>
          <line x1="0" y1={fantasticY} x2={W} y2={fantasticY} stroke="#358118" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.5" />
          <text x="4" y={fantasticY - 3} fontSize="8" fill="#358118" opacity="0.7" fontFamily="Arial">Fantastic</text>
        </>
      )}
      <polyline points={pts} fill="none" stroke="#077398" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="4" fill="#077398" />
      <text x={lastX - 2} y={lastY - 8} fontSize="9" fill="#077398" textAnchor="end" fontFamily="Arial">{scores[scores.length - 1]}</text>
    </svg>
  )
}
