import { useMemo } from 'react';

export type SegmentKey =
  | 'vip'
  | 'recurring'
  | 'dormant'
  | 'at_risk'
  | 'one_shot_high'
  | 'new';

export interface CustomerLite {
  id: string;
  orderCount: number;
  totalSpent: number;
  productNames: string[];
  firstOrder: Date;
  lastOrder: Date;
}

export interface RFMScore {
  r: number; // 1-5 recency (5 = most recent)
  f: number; // 1-5 frequency
  m: number; // 1-5 monetary
}

export interface SegmentDefinition {
  key: SegmentKey;
  label: string;
  emoji: string;
  description: string;
  ids: Set<string>;
  totalLTV: number;
}

export interface BasketRule {
  from: string;
  to: string;
  support: number;     // co-purchase count
  confidence: number;  // P(to|from)
  lift: number;        // confidence / P(to)
}

export interface SegmentationResult {
  rfm: Map<string, RFMScore>;
  segments: Record<SegmentKey, SegmentDefinition>;
  segmentList: SegmentDefinition[];
  basketRules: Map<string, BasketRule[]>; // keyed by "from" product
  avgDaysBetweenOrders: Map<string, number>; // by customer id
  globalAvgDaysBetween: number;
  dormantThresholdDays: number;
  ownerOfProduct: Map<string, Set<string>>; // product -> customer ids
}

// Quintile helper: returns 1-5 score (5 = highest in `values`)
function quintile(value: number, sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 3;
  const idx = sortedAsc.findIndex(v => v >= value);
  const rank = idx === -1 ? sortedAsc.length - 1 : idx;
  const q = Math.ceil(((rank + 1) / sortedAsc.length) * 5);
  return Math.min(5, Math.max(1, q));
}

export function useCustomerSegmentation(customers: CustomerLite[]): SegmentationResult {
  return useMemo(() => {
    const now = Date.now();
    const DAY = 86_400_000;

    // ─── RFM ───
    const recencies = customers.map(c => (now - c.lastOrder.getTime()) / DAY);
    const sortedRecency = [...recencies].sort((a, b) => b - a); // ascending recency days = lower better → invert
    const sortedRecencyAsc = [...recencies].sort((a, b) => a - b);
    const sortedFreq = customers.map(c => c.orderCount).sort((a, b) => a - b);
    const sortedMon = customers.map(c => c.totalSpent).sort((a, b) => a - b);

    const rfm = new Map<string, RFMScore>();
    customers.forEach(c => {
      const recDays = (now - c.lastOrder.getTime()) / DAY;
      // recency: fewer days = better → invert quintile
      const rRaw = quintile(recDays, sortedRecencyAsc);
      const r = 6 - rRaw;
      const f = quintile(c.orderCount, sortedFreq);
      const m = quintile(c.totalSpent, sortedMon);
      rfm.set(c.id, { r, f, m });
    });

    // ─── Repeat cadence ───
    const avgDaysBetweenOrders = new Map<string, number>();
    let cadenceSum = 0, cadenceN = 0;
    customers.forEach(c => {
      if (c.orderCount < 2) return;
      const span = (c.lastOrder.getTime() - c.firstOrder.getTime()) / DAY;
      const avg = span / (c.orderCount - 1);
      avgDaysBetweenOrders.set(c.id, avg);
      cadenceSum += avg;
      cadenceN++;
    });
    const globalAvgDaysBetween = cadenceN ? cadenceSum / cadenceN : 90;
    const dormantThresholdDays = Math.max(120, globalAvgDaysBetween * 2);

    // ─── Segments ───
    const ltvSorted = [...customers].sort((a, b) => b.totalSpent - a.totalSpent);
    const vipCount = Math.max(1, Math.floor(customers.length * 0.1));
    const vipIds = new Set(ltvSorted.slice(0, vipCount).map(c => c.id));
    const medianLTV = sortedMon[Math.floor(sortedMon.length / 2)] ?? 0;
    const p75AOV = (() => {
      const aov = customers.filter(c => c.orderCount === 1).map(c => c.totalSpent).sort((a, b) => a - b);
      return aov[Math.floor(aov.length * 0.75)] ?? 0;
    })();

    const seg = (key: SegmentKey, label: string, emoji: string, description: string): SegmentDefinition => ({
      key, label, emoji, description, ids: new Set(), totalLTV: 0,
    });
    const segments: Record<SegmentKey, SegmentDefinition> = {
      vip:           seg('vip',           'VIP',                 '👑', 'Top 10% per LTV'),
      recurring:     seg('recurring',     'Ricorrenti',          '🔁', '≥3 ordini, attivi ultimi 90gg'),
      dormant:       seg('dormant',       'Dormienti',           '😴', `Ultimo ordine 180-365gg, LTV > mediana → win-back`),
      at_risk:       seg('at_risk',       'A rischio churn',     '⚠️', 'Inattivi oltre 2× la cadenza media'),
      one_shot_high: seg('one_shot_high', 'One-shot alto valore', '💎', '1 ordine, AOV > p75 → upsell'),
      new:           seg('new',           'Nuovi',               '✨', 'Primo ordine ultimi 60gg'),
    };

    customers.forEach(c => {
      const recDays = (now - c.lastOrder.getTime()) / DAY;
      const firstDays = (now - c.firstOrder.getTime()) / DAY;
      const cadence = avgDaysBetweenOrders.get(c.id) ?? globalAvgDaysBetween;

      if (vipIds.has(c.id)) { segments.vip.ids.add(c.id); segments.vip.totalLTV += c.totalSpent; }
      if (c.orderCount >= 3 && recDays <= 90) { segments.recurring.ids.add(c.id); segments.recurring.totalLTV += c.totalSpent; }
      if (recDays >= 180 && recDays <= 365 && c.totalSpent > medianLTV) {
        segments.dormant.ids.add(c.id); segments.dormant.totalLTV += c.totalSpent;
      }
      if (c.orderCount >= 2 && recDays > cadence * 2 && recDays < 365) {
        segments.at_risk.ids.add(c.id); segments.at_risk.totalLTV += c.totalSpent;
      }
      if (c.orderCount === 1 && c.totalSpent >= p75AOV && p75AOV > 0) {
        segments.one_shot_high.ids.add(c.id); segments.one_shot_high.totalLTV += c.totalSpent;
      }
      if (firstDays <= 60) { segments.new.ids.add(c.id); segments.new.totalLTV += c.totalSpent; }
    });

    const segmentList: SegmentDefinition[] = [
      segments.vip, segments.recurring, segments.new,
      segments.one_shot_high, segments.at_risk, segments.dormant,
    ];

    // ─── Market basket (lift) — limit top-200 products for perf ───
    const productPop = new Map<string, number>();
    const ownerOfProduct = new Map<string, Set<string>>();
    customers.forEach(c => c.productNames.forEach(p => {
      productPop.set(p, (productPop.get(p) || 0) + 1);
      if (!ownerOfProduct.has(p)) ownerOfProduct.set(p, new Set());
      ownerOfProduct.get(p)!.add(c.id);
    }));
    const topProducts = new Set(
      Array.from(productPop.entries()).sort((a, b) => b[1] - a[1]).slice(0, 200).map(([p]) => p)
    );

    const N = customers.length || 1;
    const co = new Map<string, Map<string, number>>();
    customers.forEach(c => {
      const ps = c.productNames.filter(p => topProducts.has(p));
      for (let i = 0; i < ps.length; i++) {
        for (let j = 0; j < ps.length; j++) {
          if (i === j) continue;
          if (!co.has(ps[i])) co.set(ps[i], new Map());
          const m = co.get(ps[i])!;
          m.set(ps[j], (m.get(ps[j]) || 0) + 1);
        }
      }
    });
    const basketRules = new Map<string, BasketRule[]>();
    co.forEach((others, from) => {
      const fromSupport = productPop.get(from) || 1;
      const rules: BasketRule[] = [];
      others.forEach((support, to) => {
        const toSupport = productPop.get(to) || 1;
        const confidence = support / fromSupport;
        const lift = confidence / (toSupport / N);
        if (support >= 2 && lift > 1) rules.push({ from, to, support, confidence, lift });
      });
      rules.sort((a, b) => b.lift - a.lift);
      basketRules.set(from, rules.slice(0, 8));
    });

    return {
      rfm, segments, segmentList, basketRules,
      avgDaysBetweenOrders, globalAvgDaysBetween, dormantThresholdDays,
      ownerOfProduct,
    };
  }, [customers]);
}

// Compute lift-based recommendations for a single customer
export function liftRecommendations(
  customer: CustomerLite,
  rules: Map<string, BasketRule[]>,
  limit = 5,
): { product: string; score: number; sources: string[] }[] {
  const owned = new Set(customer.productNames);
  const score = new Map<string, { s: number; from: Set<string> }>();
  customer.productNames.forEach(p => {
    const list = rules.get(p);
    if (!list) return;
    list.forEach(r => {
      if (owned.has(r.to)) return;
      const cur = score.get(r.to) ?? { s: 0, from: new Set<string>() };
      cur.s += r.lift;
      cur.from.add(p);
      score.set(r.to, cur);
    });
  });
  return Array.from(score.entries())
    .sort((a, b) => b[1].s - a[1].s)
    .slice(0, limit)
    .map(([product, { s, from }]) => ({ product, score: s, sources: Array.from(from) }));
}

// Propensity score 0-100 for a target customer given a campaign product set
export function propensityScore(
  customer: CustomerLite,
  campaignProducts: string[],
  rules: Map<string, BasketRule[]>,
  rfm: RFMScore | undefined,
): number {
  if (campaignProducts.length === 0) return 0;
  // Lift contribution from owned products → campaign products
  let liftSum = 0;
  const ownedSet = new Set(customer.productNames);
  customer.productNames.forEach(p => {
    const list = rules.get(p);
    if (!list) return;
    list.forEach(r => {
      if (campaignProducts.includes(r.to) && !ownedSet.has(r.to)) {
        liftSum += Math.min(5, r.lift);
      }
    });
  });
  const liftPart = Math.min(50, liftSum * 5);
  // RFM contribution
  const rfmPart = rfm ? ((rfm.r + rfm.f + rfm.m) / 15) * 50 : 25;
  return Math.round(Math.min(100, liftPart + rfmPart));
}
