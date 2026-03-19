/**
 * Budget 2026 monthly targets — single source of truth.
 * Used by Budget2026 page AND RevenueTarget progress bar.
 */

export const BUDGET_PRODUCTS = [
  { name: 'FLIPPER',       sales: [3627,9425,8610,20679,11117,14764,14089,16285,7548,5752,15785,5672],  target: 200320, startMonth: 0 },
  { name: 'OLLI BLOCK',    sales: [12177,4647,2669,9479,12177,7642,5770,7795,3601,4409,15241,3573],    target: 120190, startMonth: 0 },
  { name: 'OLLI RING',     sales: [474,2295,2059,4002,5180,4416,2350,3389,1136,1052,3064,1104],        target: 32050,  startMonth: 0 },
  { name: 'JAKE',          sales: [0,0,0,0,0,0,0,0,0,0,0,16788],                                      target: 99180,  startMonth: 2 },
  { name: 'WAY2',          sales: [0,0,0,0,0,0,0,0,0,22175,7959,2707],                                target: 112200, startMonth: 1 },
  { name: 'SIDE PRODUCTS', sales: [131,0,657,2281,2315,3406,2063,3182,2247,1514,4773,261],             target: 31030,  startMonth: 0 },
  { name: 'EA ELEMENTS',   sales: [0,0,0,0,0,0,0,0,0,0,0,0],                                         target: 30000,  startMonth: 4 },
] as const;

/** Distribute an annual target across 12 months using 2025 seasonality */
function monthlyTargetsForProduct(p: typeof BUDGET_PRODUCTS[number]): number[] {
  const sm = p.startMonth;
  const nonZero = p.sales.filter(v => v > 0).length;
  if (nonZero < 6) {
    const active = 12 - sm;
    return Array.from({ length: 12 }, (_, i) => i >= sm ? Math.round(p.target / active) : 0);
  }
  const tot = p.sales.reduce((s, v) => s + v, 0);
  return p.sales.map(v => tot > 0 ? Math.round((v / tot) * p.target) : 0);
}

/** Total annual target across all products */
export const BUDGET_ANNUAL_TARGET = BUDGET_PRODUCTS.reduce((s, p) => s + p.target, 0);

/** Monthly target totals (all products summed) — length 12 */
export const BUDGET_MONTHLY_TARGETS: number[] = (() => {
  const months = new Array(12).fill(0);
  BUDGET_PRODUCTS.forEach(p => {
    const mt = monthlyTargetsForProduct(p);
    mt.forEach((v, i) => { months[i] += v; });
  });
  return months;
})();
