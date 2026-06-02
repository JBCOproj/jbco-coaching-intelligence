import { useState } from 'react'
import { getDriverTierColor, getInitials, COL } from '../utils.js'

const TIER_BG = {
  Platinum: '#f0faf0',
  Gold:     '#fffbf0',
  Silver:   '#f0f4fa',
  Bronze:   '#faf4f0',
}

export default function DriverCard({ driver, concessions, safety, feedback, index }) {
  const [open, setOpen] = useState(false)
  const [coachingNotes, setCoachingNotes] = useState(null)
  const [loadingNotes, setLoadingNotes] = useState(false)

  const name    = driver[COL.name]?.trim() || `Driver ${index + 1}`
  const tid     = driver[COL.tid] || ''
  const standing = driver[COL.standing] || ''
  const score   = parseFloat(driver[COL.score] || 0)
  const tierColor = getDriverTierColor(standing)
  const initials  = getInitials(name)
  const pkgs    = driver[COL.packages] || ''

  const safetyCount    = safety.length
  const complaintCount = feedback.length
  const dsbImpact      = concessions.filter(c =>
    (c['Impact'] || '').toLowerCase().includes('dsb') ||
    (c['DSB Impact'] || '') === 'Yes'
  ).length

  // Scorecard metrics — exact column names from CSV
  const metrics = [
    { label: 'Overall score',                   val: driver[COL.score],        tier: driver[COL.standing] },
    { label: 'Delivery completion rate (DCR)',   val: driver[COL.dcr],          tier: driver[COL.dcrTier],          dispute: shouldDispute(driver[COL.dcr], driver[COL.dcrTier]) },
    { label: 'CDF DPMO',                        val: driver[COL.cdfDpmo],      tier: driver[COL.cdfTier],          dispute: shouldDispute(driver[COL.cdfDpmo], driver[COL.cdfTier]) },
    { label: 'Photo on delivery (POD)',          val: driver[COL.pod],          tier: driver[COL.podTier] },
    { label: 'Delivery scan behavior (DSB)',     val: driver[COL.dsb],          tier: driver[COL.dsbTier],          dispute: shouldDispute(driver[COL.dsb], driver[COL.dsbTier]) },
    { label: 'Speeding event rate',              val: driver[COL.speeding],     tier: driver[COL.speedingTier] },
    { label: 'Seatbelt-off rate',               val: driver[COL.seatbelt],     tier: driver[COL.seatbeltTier] },
    { label: 'Distractions rate',               val: driver[COL.distractions], tier: driver[COL.distractionsTier] },
    { label: 'Sign/signal violations',          val: driver[COL.signalViol],   tier: driver[COL.signalViolTier] },
    { label: 'Following distance',              val: driver[COL.following],    tier: driver[COL.followingTier] },
  ]

  async function generateCoachingNotes() {
    if (coachingNotes) return
    setLoadingNotes(true)
    try {
      const res = await fetch('/.netlify/functions/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver, concessions, safety, feedback }),
      })
      const data = await res.json()
      setCoachingNotes(data.notes || 'No coaching notes generated.')
    } catch {
      setCoachingNotes('Failed to generate coaching notes.')
    } finally {
      setLoadingNotes(false)
    }
  }

  function handleToggle() {
    setOpen(o => {
      if (!o) generateCoachingNotes()
      return !o
    })
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '0.5px solid var(--color-border)',
      borderLeft: `3px solid ${tierColor}`,
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div onClick={handleToggle} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}>

        {/* Initials avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: TIER_BG[standing] || '#f5f4f0',
          border: `1.5px solid ${tierColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: '600', color: tierColor, flexShrink: 0,
        }}>{initials}</div>

        {/* Name + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>{name}</div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
            {pkgs && <Badge text={`${pkgs} pkgs`} color="var(--color-text-tertiary)" bg="#f5f4f0" />}
            {safetyCount > 0 && <Badge text={`${safetyCount} safety`} color="#b8860b" bg="#fffbf0" border="#f0d080" />}
            {complaintCount > 0 && <Badge text={`${complaintCount} complaint`} color="var(--tier-poor)" bg="#fdf0f2" border="#f0b0b8" />}
            {dsbImpact > 0 && <Badge text={`${dsbImpact} DSB impact`} color="var(--tier-fantastic)" bg="#f0f7fa" border="#b0d8e8" />}
          </div>
        </div>

        {/* Score + tier */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--color-text-primary)' }}>{score.toFixed(1)}</div>
          <TierPill label={standing} color={tierColor} />
        </div>

        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ color: 'var(--color-text-tertiary)', fontSize: '14px', flexShrink: 0 }} />
      </div>

      {/* Expanded content */}
      {open && (
        <div style={{ borderTop: '0.5px solid var(--color-border-subtle)' }}>

          {/* SCORECARD METRICS */}
          <Section title="SCORECARD METRICS">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {metrics.map((m, i) => {
                  if (!m.val && m.val !== 0) return null
                  const tc = getDriverTierColor(m.tier)
                  return (
                    <tr key={i} style={{ borderBottom: '0.5px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: '7px 0', fontSize: '13px', color: 'var(--color-text-primary)' }}>
                        {m.label}
                        {m.dispute && (
                          <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--tier-fair)', background: '#fff8f0', border: '0.5px solid #f0d0a0', borderRadius: '4px', padding: '1px 6px', fontWeight: '500' }}>
                            ⚠ review to dispute
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '7px 0', textAlign: 'right', fontSize: '13px', fontWeight: '500' }}>{m.val}</td>
                      <td style={{ padding: '7px 0 7px 10px', textAlign: 'right', width: '80px' }}>
                        {m.tier && <TierPill label={m.tier} color={tc} small />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Section>

          {/* DELIVERY CONCESSIONS */}
          {concessions.length > 0 && (
            <Section
              title={`DELIVERY CONCESSIONS (${concessions.length} TOTAL${dsbImpact > 0 ? `, ${dsbImpact} IMPACT DSB` : ''})`}
              action={dsbImpact > 0 ? { label: '⚠ REVIEW TO DISPUTE', color: 'var(--tier-poor)' } : null}
            >
              {concessions.map((c, i) => (
                <div key={i} style={{ padding: '8px 10px', background: '#fdf9f6', border: '0.5px solid var(--color-border)', borderRadius: '4px', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: '500' }}>{c['Concession Type'] || c['Type'] || 'Concession'}</span>
                    {(c['Impact'] || '').toLowerCase().includes('dsb') && <Badge text="DSB impact" color="var(--tier-fantastic)" bg="#f0f7fa" border="#b0d8e8" />}
                  </div>
                  {c['Reason'] && <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{c['Reason']}</div>}
                </div>
              ))}
            </Section>
          )}

          {/* SAFETY EVENTS */}
          {safety.length > 0 && (
            <Section title={`SAFETY EVENTS ON SCORECARD (${safety.length})`}>
              {safety.map((s, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: i < safety.length - 1 ? '0.5px solid var(--color-border-subtle)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500' }}>{s['Event Type'] || s['Type'] || 'Safety event'}</span>
                        {s['Dispute Status'] === 'denied' && <Badge text="dispute denied" color="var(--tier-poor)" bg="#fdf0f2" border="#f0b0b8" />}
                      </div>
                      {s['Event Detail'] && <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '1px' }}>{s['Event Detail']}</div>}
                      {s['Timestamp'] && <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{s['Timestamp']}</div>}
                    </div>
                    {s['Footage URL'] && (
                      <a href={s['Footage URL']} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '11px', color: 'var(--tier-fantastic)', textDecoration: 'none', flexShrink: 0, marginLeft: '12px' }}
                        onClick={e => e.stopPropagation()}>
                        <i className="ti ti-external-link" /> view footage
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* COACHING TALKING POINTS */}
          <Section title="COACHING TALKING POINTS">
            {loadingNotes ? (
              <div style={{ color: 'var(--color-text-tertiary)', fontSize: '13px', padding: '8px 0' }}>Generating coaching notes...</div>
            ) : coachingNotes ? (
              <div style={{ fontSize: '13px', lineHeight: '1.65', color: 'var(--color-text-primary)', background: '#fafaf8', border: '0.5px solid var(--color-border)', borderRadius: '4px', padding: '12px 14px', whiteSpace: 'pre-wrap' }}>
                {coachingNotes}
              </div>
            ) : null}
          </Section>

        </div>
      )}
    </div>
  )
}

// Flag for dispute suggestion: Bronze or Silver tier on key metrics
function shouldDispute(val, tier) {
  if (!val || !tier) return false
  return tier === 'Bronze' || tier === 'Silver'
}

function Section({ title, children, action }) {
  return (
    <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--color-border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="ti ti-circle-dot" style={{ fontSize: '10px' }} />
          {title}
        </div>
        {action && (
          <span style={{ fontSize: '10px', fontWeight: '600', color: action.color, background: '#fdf0f2', border: '0.5px solid #f0b0b8', borderRadius: '4px', padding: '2px 8px', letterSpacing: '0.04em' }}>
            {action.label}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function TierPill({ label, color, small }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: small ? '10px' : '11px', fontWeight: '500',
      color, background: color + '18', border: `0.5px solid ${color}55`,
      borderRadius: '4px', padding: small ? '1px 6px' : '2px 8px',
    }}>{label}</span>
  )
}

function Badge({ text, color, bg, border }) {
  return (
    <span style={{ fontSize: '10px', fontWeight: '500', color, background: bg || 'transparent', border: `0.5px solid ${border || color + '55'}`, borderRadius: '99px', padding: '1px 7px' }}>
      {text}
    </span>
  )
}
