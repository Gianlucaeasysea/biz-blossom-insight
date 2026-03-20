import { useMemo } from 'react';
import { Filter } from 'lucide-react';

interface ProductFilterProps {
  /** All unique product names extracted from orders */
  productNames: string[];
  /** All unique SKUs extracted from orders */
  skus: string[];
  /** Currently selected product name (empty = all) */
  selectedProduct: string;
  /** Currently selected SKU (empty = all) */
  selectedSku: string;
  onProductChange: (value: string) => void;
  onSkuChange: (value: string) => void;
  /** Show only SKU dropdown (no product name) */
  skuOnly?: boolean;
}

export function ProductFilter({
  productNames, skus, selectedProduct, selectedSku,
  onProductChange, onSkuChange, skuOnly,
}: ProductFilterProps) {
  const sortedNames = useMemo(() => [...productNames].sort(), [productNames]);
  const sortedSkus = useMemo(() => [...skus].sort(), [skus]);

  return (
    <div className="flex items-center gap-1.5">
      {!skuOnly && (
        <select
          value={selectedProduct}
          onChange={e => { onProductChange(e.target.value); if (e.target.value) onSkuChange(''); }}
          className="h-7 text-xs rounded border border-border/50 bg-muted/50 px-2 text-foreground max-w-[180px] truncate"
        >
          <option value="">All Products</option>
          {sortedNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      )}
      <select
        value={selectedSku}
        onChange={e => { onSkuChange(e.target.value); if (e.target.value) onProductChange(''); }}
        className="h-7 text-xs rounded border border-border/50 bg-muted/50 px-2 text-foreground max-w-[140px]"
      >
        <option value="">All SKUs</option>
        {sortedSkus.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}
