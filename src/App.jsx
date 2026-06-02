import { useState, useCallback, useEffect } from 'react'
import UploadPanel from './components/UploadPanel.jsx'
import DriverCard from './components/DriverCard.jsx'
import ScorecardAnalytics from './components/ScorecardAnalytics.jsx'
import Dashboard from './components/Dashboard.jsx'
import { parseCSV, readFileAsText, tierOrder, formatWeek, COL, getDriverTierColor } from './utils.js'

const NAV = [
  { id: 'dashboard',   icon: 'ti-layout-dashboard', label: 'Dashboard',          section: 'MAIN' },
  { id: 'drivers',     icon: 'ti-users',             label: 'Drivers',            section: null },
  { id: 'analytics',   icon: 'ti-chart-bar',         label: 'Scorecard Analytics',section: null },
  { id: 'coaching',    icon: 'ti-clipboard-text',    label: 'Coaching Reports',   section: 'COACHING' },
  { id: 'ai',          icon: 'ti-sparkles',          label: 'AI Recommendations', section: null },
  { id: 'uploads',     icon: 'ti-upload',            label: 'Uploads',            section: 'TOOLS' },
  { id: 'contest',     icon: 'ti-file-alert',        label: 'Contest Scorecard',  section: null },
]

const FILTERS = ['All drivers', 'Needs attention', 'Bronze', 'Silver', 'Gold', 'Platinum']

export default function App() {
  const [nav, setNav] = useState('uploads')
  const [loaded, setLoaded] = useState({ scorecard: false, overview: false, concessions: false, safety: false, cdf: false, feedback: false })
  const [statuses, setStatuses] = useState({})
  const [csvData, setCsvData] = useState({ overview: null, concessions: null, safety: null, cdf: null, feedback: [] })
  const [report, setReport] = useState(null)
  const [filter, setFilter] = useState('All drivers')
  const [week, setWeek] = useState(null)
  const [savedWeeks, setSavedWeeks] = useState([])
  const [savedReports, setSavedReports] = useState([])
  const [saving, setSaving] = useState(false)
  const [driverSearch, setDriverSearch] = useState('')

  useEffect(() => {
    fetch('/.netlify/functions/get-reports')
      .then(r => r.json())
      .then(data => {
        if (data.reports?.length > 0) {
          setSavedWeeks(data.reports.map(r => r.week_of))
          setSavedReports(data.reports)
        }
      })
      .catch(e => console.error('Failed to load saved weeks:', e))
  }, [])

  const handleFile = useCallback(async (key, fileList) => {
    if (!fileList || !fileList.length) return
    if (key === 'scorecard') {
      setLoaded(p => ({ ...p, scorecard: true }))
      setStatuses(p => ({ ...p, scorecard: fileList[0].name }))
      return
    }
    if (key === 'feedback') {
      const parsed = []
      for (const f of fileList) { const text = await readFileAsText(f); parsed.push(...parseCSV(text)) }
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
    if (key === 'overview' && parsed.length > 0) {
      const weekVal = parsed[0][COL.week] || ''
      if (weekVal) setWeek(formatWeek(weekVal))
    }
  }, [])

  const ready = loaded.scorecard && loaded.overview && loaded.concessions && loaded.safety && loaded.cdf

  const buildReport = useCallback(async () => {
    const { overview, concessions, safety, cdf, feedback } = csvData
    const conMap = {}
    ;(concessions || []).forEach(r => { const id = r['Transporter ID'] || r[COL.tid]; if (id) { if (!conMap[id]) conMap[id] = []; conMap[id].push(r) } })
    const safetyMap = {}
    ;(safety || []).forEach(r => { const id = r['Transporter ID'] || r[COL.tid]; if (id) { if (!safetyMap[id]) safetyMap[id] = []; safetyMap[id].push(r) } })
    const feedbackMap = {}
    ;(feedback || []).forEach(r => { const id = r['Transporter ID'] || r[COL.tid]; if (id) { if (!feedbackMap[id]) feedbackMap[id] = []; feedbackMap[id].push(r) } })
    const sorted = [...(overview || [])].sort((a, b) => {
      const to = tierOrder(a[COL.standing]) - tierOrder(b[COL.standing])
      if (to !== 0) return to
      return (parseFloat(a[COL.score]) || 0) - (parseFloat(b[COL.score]) || 0)
    })
    const cdfDrivers = [...(overview || [])].filter(d => parseFloat(d[COL.cdfDpmo]) > 0)
      .sort((a, b) => parseFloat(b[COL.cdfDpmo]) - parseFloat(a[COL.cdfDpmo])).slice(0, 10)
      .map(d => ({ name: d[COL.name]?.trim() || '', cdfDpmo: parseFloat(d[COL.cdfDpmo]), packages: parseFloat(d[COL.packages]) || 0, tid: d[COL.tid] }))
    const newReport = { drivers: sorted, conMap, safetyMap, feedbackMap, overview, cdfDrivers }
    setReport(newReport)
    setFilter('All drivers')
    setNav('dashboard')
    if (week) {
      setSaving(true)
      try {
        const res = await fetch('/.netlify/functions/save-report', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekOf: week, report: { drivers: sorted, overview, cdfDrivers, week } }),
        })
        if (res.ok) setSavedWeeks(prev => prev.includes(week) ? prev : [week, ...prev])
      } catch (e) { console.error('Failed to save:', e) } finally { setSaving(false) }
    }
  }, [csvData, week])

  async function loadSavedWeek(weekOf) {
    const found = savedReports.find(r => r.week_of === weekOf)
    if (!found) {
      try {
        const res = await fetch('/.netlify/functions/get-reports')
        const data = await res.json()
        const f = data.reports?.find(r => r.week_of === weekOf)
        if (f) applyReport(f.report, weekOf)
      } catch (e) { console.error(e) }
      return
    }
    applyReport(found.report, weekOf)
  }

  function applyReport(saved, weekOf) {
    setReport({ drivers: saved.drivers || [], overview: saved.overview || [], cdfDrivers: saved.cdfDrivers || [], conMap: {}, safetyMap: {}, feedbackMap: {} })
    setWeek(saved.week || weekOf)
    setNav('dashboard')
    setFilter('All drivers')
  }

  const filteredDrivers = report ? report.drivers.filter(d => {
    const s = d[COL.standing]
    const name = (d[COL.name] || '').toLowerCase()
    const matchFilter = filter === 'All drivers' ? true : filter === 'Needs attention' ? ['Bronze', 'Silver'].includes(s) : s === filter
    const matchSearch = !driverSearch || name.includes(driverSearch.toLowerCase())
    return matchFilter && matchSearch
  }) : []

  // Tier counts for dashboard
  const tierCounts = { Platinum: 0, Gold: 0, Silver: 0, Bronze: 0 }
  if (report?.overview) report.overview.forEach(d => { const s = d[COL.standing]; if (tierCounts[s] !== undefined) tierCounts[s]++ })
  const totalPackages = report?.overview?.reduce((s, d) => s + (parseFloat(d[COL.packages]) || 0), 0) || 0
  const publishedScore = 72.6 // TODO: read from PDF

  // Score history from saved reports
  const scoreHistory = savedReports.slice(0, 6).reverse().map(r => ({
    week: r.week_of,
    score: r.report?.overview?.[0]?.['Fleet Score'] || publishedScore,
  }))

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Sidebar */}
      <aside style={{ width: 210, minWidth: 210, background: 'var(--navy)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '0.04em' }}>JBCO</div>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginTop: '2px' }}>DSM4 · COACHING INTELLIGENCE</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV.map((item, i) => (
            <div key={item.id}>
              {item.section && (
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em', padding: i === 0 ? '10px 16px 5px' : '14px 16px 5px' }}>
                  {item.section}
                </div>
              )}
              <div onClick={() => setNav(item.id)} style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                padding: '9px 16px', fontSize: '12px', cursor: 'pointer',
                color: nav === item.id ? '#fff' : 'rgba(255,255,255,0.45)',
                background: nav === item.id ? 'rgba(255,255,255,0.07)' : 'transparent',
                borderLeft: `2px solid ${nav === item.id ? 'var(--fantastic)' : 'transparent'}`,
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (nav !== item.id) { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' } }}
              onMouseLeave={e => { if (nav !== item.id) { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'transparent' } }}
              >
                <i className={`ti ${item.icon}`} style={{ fontSize: '14px', width: '14px' }} />
                {item.label}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {week && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '6px' }}>Week {week}</div>}
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>Jason Bluemel</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '1px' }}>admin@jbcollc.com</div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <header style={{ height: 52, minHeight: 52, background: 'var(--surface)', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>
            {NAV.find(n => n.id === nav)?.label}
            {week && <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: '400', marginLeft: '10px' }}>{week}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {savedWeeks.length > 0 && (
              <select onChange={e => e.target.value && loadSavedWeek(e.target.value)}
                style={{ fontSize: '11px', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '5px 8px', background: 'var(--bg)', color: 'var(--text-2)', cursor: 'pointer' }}>
                <option value="">Load saved week</option>
                {savedWeeks.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            )}
            {saving && <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Saving...</span>}
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: '700' }}>JB</div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* DASHBOARD */}
          {nav === 'dashboard' && (
            <Dashboard
              report={report}
              week={week}
              tierCounts={tierCounts}
              totalPackages={totalPackages}
              publishedScore={publishedScore}
              scoreHistory={scoreHistory}
              onNav={setNav}
            />
          )}

          {/* UPLOADS */}
          {nav === 'uploads' && (
            <div style={{ maxWidth: 860 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Weekly data upload</h2>
                <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Upload your weekly Amazon DSP exports to generate coaching reports and scorecard analytics.</p>
              </div>
              <UploadPanel loaded={loaded} statuses={statuses} onFile={handleFile} onAnalyze={buildReport} ready={ready} week={week} savedWeeks={savedWeeks} onWeekChange={loadSavedWeek} saving={saving} />
            </div>
          )}

          {/* DRIVERS */}
          {nav === 'drivers' && (
            <div style={{ maxWidth: 900 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {FILTERS.map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                      fontSize: '12px', padding: '5px 12px', borderRadius: '99px',
                      border: '0.5px solid var(--border)',
                      background: filter === f ? 'var(--navy)' : 'transparent',
                      color: filter === f ? '#fff' : 'var(--text-2)',
                      cursor: 'pointer',
                    }}>{f}</button>
                  ))}
                </div>
                <input placeholder="Search drivers..." value={driverSearch} onChange={e => setDriverSearch(e.target.value)}
                  style={{ fontSize: 12, padding: '6px 12px', border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--surface)', width: 200 }} />
              </div>
              {!report ? (
                <EmptyState icon="ti-users" msg="No report loaded yet." action={() => setNav('uploads')} actionLabel="Upload files" />
              ) : (
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>{filteredDrivers.length} drivers</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredDrivers.map((driver, i) => {
                      const tid = driver[COL.tid]
                      return <DriverCard key={tid || i} index={i} driver={driver} concessions={report.conMap[tid] || []} safety={report.safetyMap[tid] || []} feedback={report.feedbackMap[tid] || []} />
                    })}
                  </div>
                  {filteredDrivers.length === 0 && <EmptyState icon="ti-search" msg="No drivers match this filter." />}
                </>
              )}
            </div>
          )}

          {/* SCORECARD ANALYTICS */}
          {nav === 'analytics' && (
            <div style={{ maxWidth: 900 }}>
              {!report ? (
                <EmptyState icon="ti-chart-bar" msg="No report loaded yet." action={() => setNav('uploads')} actionLabel="Upload files" />
              ) : (
                <ScorecardAnalytics reportData={report} week={week} publishedScore={publishedScore} />
              )}
            </div>
          )}

          {/* COACHING REPORTS — same as drivers but with expanded view focus */}
          {nav === 'coaching' && (
            <div style={{ maxWidth: 900 }}>
              {!report ? (
                <EmptyState icon="ti-clipboard-text" msg="No report loaded yet." action={() => setNav('uploads')} actionLabel="Upload files" />
              ) : (
                <>
                  <div style={{ marginBottom: 14, display: 'flex', gap: 6 }}>
                    {['All drivers', 'Needs attention', 'Bronze', 'Silver'].map(f => (
                      <button key={f} onClick={() => setFilter(f)} style={{
                        fontSize: '12px', padding: '5px 12px', borderRadius: '99px',
                        border: '0.5px solid var(--border)',
                        background: filter === f ? 'var(--navy)' : 'transparent',
                        color: filter === f ? '#fff' : 'var(--text-2)', cursor: 'pointer',
                      }}>{f}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredDrivers.map((driver, i) => {
                      const tid = driver[COL.tid]
                      return <DriverCard key={tid || i} index={i} driver={driver} concessions={report.conMap[tid] || []} safety={report.safetyMap[tid] || []} feedback={report.feedbackMap[tid] || []} />
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* AI RECOMMENDATIONS */}
          {nav === 'ai' && (
            <div style={{ maxWidth: 700 }}>
              {!report ? (
                <EmptyState icon="ti-sparkles" msg="No report loaded yet." action={() => setNav('uploads')} actionLabel="Upload files" />
              ) : (
                <AIRecommendations report={report} week={week} publishedScore={publishedScore} />
              )}
            </div>
          )}

          {/* CONTEST SCORECARD */}
          {nav === 'contest' && (
            <div style={{ maxWidth: 700 }}>
              {!report ? (
                <EmptyState icon="ti-file-alert" msg="No report loaded yet." action={() => setNav('uploads')} actionLabel="Upload files" />
              ) : (
                <ContestScorecard report={report} week={week} />
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

function EmptyState({ icon, msg, action, actionLabel }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
      <i className={`ti ${icon}`} style={{ fontSize: 36, display: 'block', marginBottom: 12 }} />
      <div style={{ fontSize: 13, marginBottom: 16 }}>{msg}</div>
      {action && <button onClick={action} style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 12, cursor: 'pointer' }}>{actionLabel}</button>}
    </div>
  )
}

function AIRecommendations({ report, week, publishedScore }) {
  const [notes, setNotes] = useState(null)
  const [loading, setLoading] = useState(false)

  const focusDrivers = (report.drivers || []).filter(d => ['Bronze', 'Silver'].includes(d[COL.standing])).slice(0, 5)
  const highCdf = (report.cdfDrivers || []).slice(0, 3)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/coaching', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fleetSummary: true, publishedScore, week, focusDrivers: focusDrivers.map(d => ({ name: d[COL.name], standing: d[COL.standing], score: d[COL.score], cdfDpmo: d[COL.cdfDpmo] })) }),
      })
      const data = await res.json()
      setNotes(data.notes || '')
    } catch { setNotes('Failed to generate recommendations.') } finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>AI Recommendations</h2>
        <p style={{ fontSize: 12, color: 'var(--text-2)' }}>AI-generated coaching priorities based on this week's data.</p>
      </div>
      {!notes && !loading && (
        <button onClick={generate} style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-sparkles" /> Generate AI recommendations
        </button>
      )}
      {loading && <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Generating recommendations...</div>}
      {notes && (
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '16px 18px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{notes}</div>
      )}
      {focusDrivers.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>Needs Attention</div>
          {focusDrivers.map((d, i) => {
            const tc = getDriverTierColor(d[COL.standing])
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '0.5px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 13 }}>{d[COL.name]?.trim()}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: tc }}>{d[COL.score]}</span>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: tc + '18', color: tc, fontWeight: 600 }}>{d[COL.standing]}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ContestScorecard({ report, week }) {
  const contestable = (report.overview || []).filter(d => {
    const dsbTier = d[COL.dsbTier]
    const dcrTier = d[COL.dcrTier]
    const cdfTier = d[COL.cdfTier]
    return dsbTier === 'Bronze' || dcrTier === 'Bronze' || cdfTier === 'Bronze'
  })

  function downloadCSV() {
    const rows = [
      ['Driver', 'Transporter ID', 'Metric', 'Reported Value', 'Tier', 'Notes'],
      ...contestable.flatMap(d => {
        const items = []
        if (d[COL.dsbTier] === 'Bronze') items.push([d[COL.name]?.trim(), d[COL.tid], 'DSB DPMO', d[COL.dsb], d[COL.dsbTier], 'Review delivery scan behavior data'])
        if (d[COL.dcrTier] === 'Bronze') items.push([d[COL.name]?.trim(), d[COL.tid], 'DCR', d[COL.dcr], d[COL.dcrTier], 'Review delivery completion data'])
        if (d[COL.cdfTier] === 'Bronze') items.push([d[COL.name]?.trim(), d[COL.tid], 'CDF DPMO', d[COL.cdfDpmo], d[COL.cdfTier], 'Review customer feedback data'])
        return items
      }),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `contest-${week || 'report'}.csv`; a.click()
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Contest Scorecard</h2>
        <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Metrics that may be eligible to dispute based on Bronze tier performance discrepancies.</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)' }}><span style={{ fontWeight: 600, color: 'var(--text)' }}>{contestable.length}</span> drivers with contestable metrics</div>
        {contestable.length > 0 && (
          <button onClick={downloadCSV} style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 6, padding: '7px 14px', fontSize: 11, cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-download" /> Download dispute CSV
          </button>
        )}
      </div>
      {contestable.map((d, i) => {
        const tc = getDriverTierColor(d[COL.standing])
        const flags = []
        if (d[COL.dsbTier] === 'Bronze') flags.push({ metric: 'DSB DPMO', val: d[COL.dsb], tier: 'Bronze' })
        if (d[COL.dcrTier] === 'Bronze') flags.push({ metric: 'DCR', val: d[COL.dcr], tier: 'Bronze' })
        if (d[COL.cdfTier] === 'Bronze') flags.push({ metric: 'CDF DPMO', val: d[COL.cdfDpmo], tier: 'Bronze' })
        return (
          <div key={i} style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{d[COL.name]?.trim()}</div>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: tc + '18', color: tc, fontWeight: 600 }}>{d[COL.standing]}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {flags.map((f, j) => (
                <div key={j} style={{ background: '#fdf0f2', border: '0.5px solid #f0b0b8', borderRadius: 5, padding: '4px 10px', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-2)' }}>{f.metric}: </span>
                  <span style={{ fontWeight: 600, color: 'var(--poor)' }}>{f.val} · {f.tier}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
