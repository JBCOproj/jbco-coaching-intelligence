// Reads company-level numbers from the Amazon DSP Scorecard PDF text.
// Pure text parsing so it can be tested outside the browser.

const tierName = (t) => (t === 'Fantastic Plus' ? 'Fantastic+' : t || null)
const num = (s) => (s == null ? null : parseFloat(String(s).replace(/,/g, '')))

function grab(text, re) {
  const m = text.match(re)
  return m ? num(m[1]) : null
}

export function parseScorecardText(raw) {
  // Collapse whitespace so line breaks / column layout don't matter
  // pdf.js splits "Seatbelt-Off" into "Seatbelt- Off" and "Sign/Signal" into "Sign/ Signal"
  const text = raw.replace(/\s+/g, ' ').replace(/([-/])\s+/g, '$1')

  // Only read the "DSP Scorecard" page section, before the driver table
  const start = text.indexOf('Overall Standing:')
  const end = text.indexOf('DA Current Week Performance', start)
  const sc = start >= 0 ? text.slice(start, end > 0 ? end : undefined) : text

  const weekMatch = text.match(/Week\s+(\d{1,2})\s+(\d{4})/)
  const overallMatch = sc.match(/Overall Standing:\s*([\d.]+)\s*\|\s*(Fantastic Plus|Fantastic|Great|Fair|Poor)/)
  const safetyMatch = sc.match(/Safety and Compliance:\s*(Fantastic Plus|Fantastic|Great|Fair|Poor)/)

  const rate = (label) => grab(sc, new RegExp(label + '\\s+([\\d.]+)\\s+events per 100 trips'))
  const dpmo = (label) => grab(sc, new RegExp(label + '\\s+([\\d,.]+)\\s*\\|'))

  const metrics = {
    SOR:  rate('Seatbelt-Off Rate'),
    SER:  rate('Speeding Event Rate'),
    SSVR: rate('Sign/Signal Violations Rate'),
    DR:   rate('Distractions Rate'),
    FDR:  rate('Following Distance Rate'),
    CED:  dpmo('Customer Escalation Defect DPMO'),
    CDF:  dpmo('Customer Delivery Feedback DPMO'),
    DC:   dpmo('Delivery Completion DPMO'),
    DSB:  dpmo('Delivery Success Behaviors'),
    POD:  grab(sc, /Photo-On-Delivery Acceptance Rate\s+([\d.]+)%/),
    FE:   grab(sc, /Fleet Execution\s+([\d.]+)\s*\|/),
  }

  const found = Object.values(metrics).filter((v) => v != null).length
  return {
    week: weekMatch ? `W${weekMatch[1]} ${weekMatch[2]}` : null,
    weekNumber: weekMatch ? +weekMatch[1] : null,
    year: weekMatch ? +weekMatch[2] : null,
    overall: overallMatch ? num(overallMatch[1]) : null,
    tier: overallMatch ? tierName(overallMatch[2]) : null,
    safetyTier: safetyMatch ? tierName(safetyMatch[1]) : null,
    capped: /Capped for Safety/.test(sc),
    metrics,
    ok: !!overallMatch && found >= 8,
  }
}

// Browser: read a File into text with pdf.js, then parse
export async function readScorecardPdf(file) {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.js?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  let text = ''
  for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    text += ' ' + content.items.map((i) => i.str).join(' ')
  }
  return parseScorecardText(text)
}
