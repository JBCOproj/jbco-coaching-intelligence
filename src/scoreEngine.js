// JBCO LLC — Scorecard Engine (company-level, from the DSP Scorecard PDF)
// Weights: Amazon scorecard appendix (Q3 2026, weeks 30–38).
// Fantastic thresholds: calibrated on W30–W38 (RMSE ≈ 1.2 pts), blind-tested on W40 (gap 0.0) and W41 (gap 0.5).
// Re-calibrate as more weeks are saved (see calibrate notes at bottom).

export const TIERS = [
  { name: "Fantastic+",     min: 85, color: "#0c4962" },
  { name: "Fantastic",      min: 70, color: "#077398" },
  { name: "Great",          min: 50, color: "#358118" }, // Great/Fair/Poor cutoffs not yet confirmed
  { name: "Fair",           min: 30, color: "#d4770d" },
  { name: "Poor",           min: 0,  color: "#cc0c3a" },
];

// group: "safety" | "quality" | "reliability"
// fantastic: metric value that scores exactly 70 (lower is better for every metric here)
export const METRICS = {
  SER:  { label: "Speeding",             group: "safety",      weight: 11.7, fantastic: 7.4,    unit: "per 100 trips" },
  SOR:  { label: "Seatbelt-Off",         group: "safety",      weight: 11.7, fantastic: 2.8,    unit: "per 100 trips" },
  SSVR: { label: "Sign/Signal",          group: "safety",      weight: 11.7, fantastic: 6.2,    unit: "per 100 trips" },
  DR:   { label: "Distractions",         group: "safety",      weight: 7.5,  fantastic: 3.2,    unit: "per 100 trips" },
  FDR:  { label: "Following Distance",   group: "safety",      weight: 5.0,  fantastic: 2.9,    unit: "per 100 trips" },
  DC:   { label: "Delivery Completion",  group: "quality",     weight: 12.7, fantastic: 2631,   unit: "DPMO" },
  DSB:  { label: "Delivery Success",     group: "quality",     weight: 12.7, fantastic: 214,    unit: "DPMO" },
  POD:  { label: "Photo on Delivery",    group: "quality",     weight: 3.1,  fantastic: 0.93,   unit: "% rejected", fromPct: true },
  CDF:  { label: "Customer Feedback",    group: "quality",     weight: 6.3,  fantastic: 956,    unit: "DPMO" },
  CED:  { label: "Customer Escalations", group: "quality",     weight: 12.7, fantastic: 1.3,    unit: "DPMO", zeroTarget: true }, // any escalation costs heavily; goal is 0
  FE:   { label: "Fleet Execution",      group: "reliability", weight: 5.0,  fantastic: 4.0,    unit: "%" },
  // Tenured Workforce carries 0% weight; Safe Driving, Working Device, PSB are "Coming Soon" and excluded.
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function rawValue(key, input) {
  const v = input[key];
  if (v == null) return null;
  return METRICS[key].fromPct ? 100 - v : v; // POD entered as acceptance %, scored as rejection %
}

export function metricScore(key, input) {
  const v = rawValue(key, input);
  if (v == null) return null;
  return clamp(100 - (30 * v) / METRICS[key].fantastic, 0, 100);
}

export function tierFor(score) {
  return TIERS.find((t) => score >= t.min);
}

// input: { SER, SOR, SSVR, DR, FDR, DC, DSB, POD, CDF, CED, FE, safetyTier? }
export function scoreWeek(input) {
  const rows = [];
  let total = 0, weightSum = 0;
  for (const [key, m] of Object.entries(METRICS)) {
    const s = metricScore(key, input);
    if (s == null) continue; // "Coming Soon" → weight redistributed
    rows.push({ key, ...m, value: input[key], score: s });
    total += m.weight * s;
    weightSum += m.weight;
  }
  const overall = total / weightSum;

  // Points lost per metric, in overall-score points
  for (const r of rows) r.lost = ((100 - r.score) * r.weight) / weightSum;
  rows.sort((a, b) => b.lost - a.lost);

  const byGroup = (g) => rows.filter((r) => r.group === g).reduce((s, r) => s + r.lost, 0);

  // Safety cap: overall TIER cannot exceed the Safety & Compliance tier.
  // Confirmed in W33 (64.7) and W34 (72.9): score printed as-is, tier held at Great.
  let tier = tierFor(overall);
  const safetyTier = input.safetyTier || null; // read from the PDF ("Safety and Compliance: Great")
  let capped = false;
  if (safetyTier && TIERS.findIndex((t) => t.name === safetyTier) > TIERS.indexOf(tier)) {
    tier = TIERS.find((t) => t.name === safetyTier);
    capped = true;
  }

  return {
    overall: +overall.toFixed(1),
    tier: tier.name,
    capped,
    rows,
    lostSafety: +byGroup("safety").toFixed(2),
    lostQuality: +byGroup("quality").toFixed(2),
    lostReliability: +byGroup("reliability").toFixed(2),
  };
}

// Residual vs Amazon's printed score = the "Not itemized" bar
export function reconcile(input, actualOverall) {
  const r = scoreWeek(input);
  return { ...r, notItemized: +(r.overall - actualOverall).toFixed(2) };
}

// What-if: apply overrides, re-score
export function whatIf(input, overrides) {
  return scoreWeek({ ...input, ...overrides });
}

// Goal solver: cheapest set of metric improvements (to their Fantastic line, then to 0)
// that reaches a target score. Greedy by points gained per metric.
export function pathTo(input, target = 85) {
  let current = { ...input };
  const steps = [];
  for (let i = 0; i < 20; i++) {
    const base = scoreWeek(current);
    if (base.overall >= target) return { reached: true, overall: base.overall, steps };
    let best = null;
    for (const key of Object.keys(METRICS)) {
      if (current[key] == null) continue;
      const m = METRICS[key];
      const raw = rawValue(key, current);
      // Step 1: get to the Fantastic line. Then cut the remaining value in half (realistic coaching target).
      const goalRaw = m.zeroTarget ? 0 : raw > m.fantastic ? m.fantastic : +(raw / 2).toPrecision(3);
      if (goalRaw >= raw || raw - goalRaw < 1e-6 || raw === 0) continue;
      const goal = m.fromPct ? +(100 - goalRaw).toFixed(2) : goalRaw;
      const gain = scoreWeek({ ...current, [key]: goal }).overall - base.overall;
      if (!best || gain > best.gain) best = { key, label: m.label, from: current[key], to: goal, gain };
    }
    if (!best || best.gain <= 0) break;
    steps.push({ ...best, gain: +best.gain.toFixed(1) });
    current[best.key] = best.to;
  }
  return { reached: false, overall: scoreWeek(current).overall, steps };
}
