export function parseCSV(text) {
  if (!text || !text.trim()) return []
  // Remove BOM if present
  const cleaned = text.replace(/^\uFEFF/, '')
  const lines = cleaned.trim().split('\n')
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h.trim()] = (values[i] || '').trim() })
    return row
  }).filter(row => Object.values(row).some(v => v))
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// Fleet-level scorecard tiers (Amazon DSP) — NEVER CHANGE COLORS
export const FLEET_TIERS = [
  { label: 'Fantastic+', min: 90, color: '#0c4962' },
  { label: 'Fantastic',  min: 75, color: '#077398' },
  { label: 'Great',      min: 60, color: '#358118' },
  { label: 'Fair',       min: 40, color: '#d4770d' },
  { label: 'Poor',       min: 0,  color: '#cc0c3a' },
]

export function getFleetTier(score) {
  return FLEET_TIERS.find(t => score >= t.min) || FLEET_TIERS[FLEET_TIERS.length - 1]
}

// Driver-level standing tiers — NEVER CHANGE COLORS
export const DRIVER_TIER_COLORS = {
  Platinum: '#358118',
  Gold:     '#b8860b',
  Silver:   '#6b7fa3',
  Bronze:   '#a0522d',
}

export function getDriverTierColor(tier) {
  return DRIVER_TIER_COLORS[tier] || '#9b9b9b'
}

// Sort worst first for coaching priority
export function tierOrder(tier) {
  const order = { Bronze: 0, Silver: 1, Gold: 2, Platinum: 3 }
  return order[tier] ?? 2
}

// Week is already formatted as "2026-W21" in the CSV — just return it
export function formatWeek(val) {
  if (!val) return ''
  return String(val).trim()
}

export function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

// Exact column names from DSP_Overview_Dashboard CSV
export const COL = {
  week:          'Week',
  name:          'Delivery Associate ',
  tid:           'Transporter ID',
  standing:      'Overall Standing',
  score:         'Overall Score',
  packages:      'Packages Delivered',

  speeding:      'Speeding Event Rate (per trip)',
  speedingTier:  'Speeding Event Rate Tier',

  seatbelt:      'Seatbelt-Off Rate (per trip)',
  seatbeltTier:  'Seatbelt-Off Rate Tier',

  distractions:  'Distractions Rate (per trip)',
  distractionsTier: 'Distractions Rate Tier',

  signalViol:    'Sign/ Signal Violations Rate (per trip)',
  signalViolTier:'Sign/ Signal Violations Rate Tier',

  following:     'Following Distance Rate (per trip)',
  followingTier: 'Following Distance Rate Tier',

  cdfDpmo:       'CDF DPMO',
  cdfTier:       'CDF DPMO Tier',

  ced:           'CED',
  cedTier:       'CED Tier',

  dcr:           'DCR',
  dcrTier:       'DCR Tier',

  dsb:           'DSB',
  dsbTier:       'DSB DPMO Tier',

  pod:           'POD',
  podTier:       'POD Tier',
}
