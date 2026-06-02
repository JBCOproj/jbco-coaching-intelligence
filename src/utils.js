export function parseCSV(text) {
  if (!text || !text.trim()) return []
  const lines = text.trim().split('\n')
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

// Driver-level standing tiers
export const DRIVER_TIER_COLORS = {
  Platinum: '#358118',
  Gold:     '#b8860b',
  Silver:   '#6b7fa3',
  Bronze:   '#a0522d',
}

export function getDriverTierColor(tier) {
  return DRIVER_TIER_COLORS[tier] || '#9b9b9b'
}

export function tierOrder(tier) {
  const order = { Bronze: 0, Silver: 1, Gold: 2, Platinum: 3 }
  return order[tier] ?? 2
}

export function formatWeek(val) {
  if (!val) return ''
  const s = String(val).trim()

  // Already formatted: "2026-W21"
  if (/^\d{4}-W\d{1,2}$/.test(s)) return s

  // Plain week number: "21"
  if (/^\d{1,2}$/.test(s)) {
    const year = new Date().getFullYear()
    return `${year}-W${String(parseInt(s)).padStart(2, '0')}`
  }

  // ISO date string: "2026-05-20"
  try {
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    const year = d.getFullYear()
    const start = new Date(year, 0, 1)
    const week = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)
    return `${year}-W${String(week).padStart(2, '0')}`
  } catch { return s }
}

export function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}
