import { getFleetTier } from '../utils.js'

export default function FleetSummary({ drivers, week }) {
  if (!drivers || !drivers.length) return null

  // Use the published score from the overview data if available
  const publishedScore = parseFloat(drivers[0]?.['Fleet Score'] || drivers[0]?.['Published Score'] || 0)
  const scores = drivers.map(d => parseFloat(d['Overall Score'] || 0)).filter(s => s > 0)
  const displayScore = publishedScore > 0 ? publishedScore : (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0)
  const { label: tier, color } = getFleetTier(displayScore)

  const tierCounts = {}
  drivers.forEach(d => {
    const s = d['Overall Standing'] || 'Unknown'
    tierCounts[s] = (tierCounts[s] || 0) + 1
  })

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '0.5px solid var(--color-border)',
      borderRadius: '6px',
      padding: '14px 16px',
      marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            DSP Scorecard
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '24px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
              {displayScore.toFixed(1)}
            </span>
            <span style={{
              fontSize: '12px', fontWeight: '500', color,
              background: color + '18', border: `0.5px solid ${color}55`,
              borderRadius: '4px', padding: '2px 8px',
            }}>{tier}</span>
          </div>
          {week && <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{week}</div>}
        </div>

        <div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Drivers
          </div>
          <div style={{ fontSize: '20px', fontWeight: '600' }}>{drivers.length}</div>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Standing breakdown
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['Platinum', 'Gold', 'Silver', 'Bronze'].filter(t => tierCounts[t]).map(t => {
              const colors = { Platinum: '#358118', Gold: '#b8860b', Silver: '#6b7fa3', Bronze: '#a0522d' }
              const c = colors[t]
              return (
                <span key={t} style={{
                  fontSize: '11px', fontWeight: '500', color: c,
                  background: c + '18', border: `0.5px solid ${c}55`,
                  borderRadius: '4px', padding: '2px 8px',
                }}>
                  {tierCounts[t]} {t}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
