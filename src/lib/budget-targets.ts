/**
 * Budget 2026 monthly targets — single source of truth.
 * Values from "BDG MKT_V2" sheet (REVENUE BDG 2026).
 * Used by Budget2026 page AND RevenueTarget progress bar.
 */

export const BUDGET_PRODUCTS = [
  { name: 'FLIPPER',       monthlyTargets: [5357, 6534, 9462, 21443, 29330, 25249, 17211, 27851, 9220, 7027, 34708, 6928],  target: 200320, startMonth: 0 },
  { name: 'OLLI BLOCK',    monthlyTargets: [3190, 3890, 6261, 12765, 17460, 15032, 10246, 16577, 5487, 4500, 20659, 4125],  target: 120192, startMonth: 0 },
  { name: 'OLLI RING',     monthlyTargets: [837, 1019, 1639, 4005, 5858, 4463, 2685, 4344, 1436, 1095, 5415, 1199],        target: 33995,  startMonth: 0 },
  { name: 'JAKE',          monthlyTargets: [0, 0, 24767, 8460, 13659, 9965, 6791, 10990, 3637, 2771, 15400, 2734],         target: 99174,  startMonth: 2 },
  { name: 'WAY2',          monthlyTargets: [0, 3707, 5966, 12164, 16637, 14323, 9761, 15796, 5230, 5000, 19687, 3929],     target: 112200, startMonth: 1 },
  { name: 'SIDE PRODUCTS', monthlyTargets: [787, 963, 1547, 3157, 4317, 3715, 2534, 4100, 2264, 1520, 5108, 1020],         target: 31032,  startMonth: 0 },
  { name: 'EA ELEMENTS',   monthlyTargets: [0, 0, 0, 0, 5586, 4809, 3278, 5303, 1755, 1339, 6610, 1320],                  target: 30000,  startMonth: 4 },
] as const;

/** Total annual target across all products */
export const BUDGET_ANNUAL_TARGET = BUDGET_PRODUCTS.reduce((s, p) => s + p.target, 0);

/** Monthly target totals (all products summed) — length 12 */
export const BUDGET_MONTHLY_TARGETS: number[] = (() => {
  const months = new Array(12).fill(0);
  BUDGET_PRODUCTS.forEach(p => {
    p.monthlyTargets.forEach((v, i) => { months[i] += v; });
  });
  return months;
})();

/** Per-product monthly targets (for Budget2026 page) */
export function getProductMonthlyTargets(productName: string): number[] {
  const p = BUDGET_PRODUCTS.find(bp => bp.name === productName);
  return p ? [...p.monthlyTargets] : new Array(12).fill(0);
}
