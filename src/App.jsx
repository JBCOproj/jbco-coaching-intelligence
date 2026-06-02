import { useState, useCallback } from 'react'
import UploadPanel from './components/UploadPanel.jsx'
import FleetSummary from './components/FleetSummary.jsx'
import DriverCard from './components/DriverCard.jsx'
import ScorecardAnalytics from './components/ScorecardAnalytics.jsx'
import { parseCSV, readFileAsText, tierOrder, formatWeek, COL } from './utils.js'

const FILTERS = ['All drivers', 'Needs attention', 'Bronze', 'Silver', 'Gold', 'Platinum']
const TABS = ['Coaching reports', 'Scorecard analytics']

export default function App() {
  const [loaded, setLoaded] = useState({ scorecard: false, overview: false, concessions: false, safety: false, cdf: false, feedback: false })
  const [statuses, setStatuses] = useState({})
  const [csvData, setCsvData] = useState({ overview: null, concessions: null, safety: null, cdf: null, feedback: [] })
  const [pdfData, setPdfData] = useState(null) // parsed from PDF page 1
  const [report, setReport] = useState(null)
  const [filter, setFilter] = useState('All drivers')
  const [tab, setTab] = useState('Coaching reports')
  const [week, setWeek] = useState(null)

  const handleFile = useCallback(async (key, fileList) => {
    if (!fileList || !fileList.length) return

    if (key === 'scorecard') {
      // Store PDF file — will be sent to extract-pdf function on generate
      setLoaded(p => ({ ...p, scorecard: true }))
      setStatuses(p => ({ ...p, scorecard: fileList[0].name }))
      setCsvData(p => ({ ...p, scorecardFile: fileList[0] }))
      return
    }

    if (key === 'feedback') {
      const parsed = []
      for (const f of fileList) {
        const text = await readFileAsText(f)
        parsed.push(...parseCSV(text))
      }
      setCsvData(p => ({ ...p, feedback: parsed }))
      setLoaded(p => ({ ...p, feedback: true }))
      setStatuses(p => ({ ...p, feedback: `${fileList.length} file${fileList.length > 1 ? 's' : ''} loaded` }))
      return
    }

    const text = await readFileAsText(fileList[0])
    const parsed = parseCSV(text)
    setCsvData(p => ({ ...p, [key]: parsed }))
    setLoaded(p => ({ ...p, [key]: true }))
    const fname = fileList[0].name
    setStatuses(p => ({ ...p, [key]: fname.length > 32 ? fname.slice(0, 29) + '...' : fname }))

    // Extract week from overview CSV — it's already "2026-W21" format
    if (key === 'overview' && parsed.length > 0) {
      const weekVal = parsed[0][COL.week] || ''
      if (weekVal) setWeek(formatWeek(weekVal))
    }
  }, [])

  const ready = loaded.scorecard && loaded.overview && loaded.concessions && loaded.safety && loaded.cdf

  const buildReport = useCallback(() => {
    const { overview, concessions, safety, cdf, feedback } = csvData

    // Build lookup maps using Transporter ID
    const conMap = {}
    ;(concessions || []).forEach(r => {
      const id = r['Transporter ID'] || r[COL.tid] || r['Delivery Associate'] || r[COL.name]
      if (id) {
        if (!conMap[id]) conMap[id] = []
        conMap[id].push(r)
      }
    })

    const safetyMap = {}
    ;(safety || []).forEach(r => {
      const id = r['Transporter ID'] || r[COL.tid]
      if (id) {
        if (!safetyMap[id]) safetyMap[id] = []
        safetyMap[id].push(r)
      }
    })

    const feedbackMap = {}
    ;(feedback || []).forEach(r => {
      const id = r['Transporter ID'] || r[COL.tid] || r['Delivery Associate'] || r[COL.name]
      if (id) {
        if (!feedbackMap[id]) feedbackMap[id] = []
        feedbackMap[id].push(r)
      }
    })

    // Sort: worst standing first (Bronze → Silver → Gold → Platinum)
    // then by score ascending within each tier
    const sorted = [...(overview || [])].sort((a, b) => {
      const to = tierOrder(a[COL.standing]) - tierOrder(b[COL.standing])
      if (to !== 0) return to
      return (parseFloat(a[COL.score]) || 0) - (parseFloat(b[COL.score]) || 0)
    })

    // Top CDF offenders for analytics tab
    const cdfDrivers = [...(overview || [])]
      .filter(d => parseFloat(d[COL.cdfDpmo]) > 0)
      .sort((a, b) => parseFloat(b[COL.cdfDpmo]) - parseFloat(a[COL.cdfDpmo]))
      .slice(0, 10)
      .map(d => ({
        name: d[COL.name]?.trim() || '',
        cdfDpmo: parseFloat(d[COL.cdfDpmo]),
        packages: parseFloat(d[COL.packages]) || 0,
        tid: d[COL.tid],
      }))

    setReport({ drivers: sorted, conMap, safetyMap, feedbackMap, overview, cdfDrivers })
    setFilter('All drivers')
    setTab('Coaching reports')
  }, [csvData])

  const filteredDrivers = report ? report.drivers.filter(d => {
    const s = d[COL.standing]
    if (filter === 'All drivers') return true
    if (filter === 'Needs attention') return ['Bronze', 'Silver'].includes(s)
    return s === filter
  }) : []

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
            JBCO LLC — DSM4
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '3px' }}>
            Weekly coaching intelligence
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Upload weekly exports to generate driver coaching reports and scorecard analytics
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, paddingTop: '4px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '3px' }}>admin@jbcollc.com</div>
          <button style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
            <i className="ti ti-logout" /> Sign out
          </button>
        </div>
      </div>

      {/* Upload panel */}
      <UploadPanel
        loaded={loaded}
        statuses={statuses}
        onFile={handleFile}
        onAnalyze={buildReport}
        ready={ready}
        week={week}
        savedWeeks={week ? [week] : []}
      />

      {/* Tabs + content — only after report generated */}
      {report && (
        <>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1.25rem' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 16px', fontSize: '13px', fontWeight: '400',
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                borderBottom: tab === t ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                marginBottom: '-1px', transition: 'all 0.15s',
              }}>{t}</button>
            ))}
          </div>

          {tab === 'Coaching reports' && (
            <>
              <FleetSummary drivers={report.overview} week={week} />

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {FILTERS.map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    fontSize: '12px', padding: '5px 12px', borderRadius: '99px',
                    border: '0.5px solid var(--color-border)',
                    background: filter === f ? 'var(--color-text-primary)' : 'transparent',
                    color: filter === f ? '#fff' : 'var(--color-text-secondary)',
                    cursor: 'pointer', transition: 'all 0.1s',
                  }}>{f}</button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredDrivers.map((driver, i) => {
                  const tid = driver[COL.tid]
                  const dname = driver[COL.name]?.trim()
                  return (
                    <DriverCard
                      key={tid || i}
                      index={i}
                      driver={driver}
                      concessions={report.conMap[tid] || report.conMap[dname] || []}
                      safety={report.safetyMap[tid] || report.safetyMap[dname] || []}
                      feedback={report.feedbackMap[tid] || report.feedbackMap[dname] || []}
                    />
                  )
                })}
              </div>

              {filteredDrivers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-tertiary)', fontSize: '14px' }}>
                  No drivers match this filter
                </div>
              )}
            </>
          )}

          {tab === 'Scorecard analytics' && (
            <ScorecardAnalytics reportData={report} week={week} />
          )}
        </>
      )}
    </div>
  )
}
