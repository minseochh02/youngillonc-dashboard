/**
 * Component Router
 *
 * Maps query intent to appropriate display components.
 * Transforms raw SQL results to component-specific data formats.
 */

export interface ComponentConfig {
  component: 'SalesTable' | 'GenericResultTable';
  transform: (data: any[]) => any;
}

/**
 * Transform data for SalesTable component
 */
function transformToSalesTable(rows: any[]): any[] {
  return rows.map((row, idx) => ({
    id: `row-${idx}`,
    branch: row['사업소'] || row['창고명'] || '',
    totalSales: parseNumber(row['총매출액'] || row['합계'] || row['매출액'] || 0),
    mobileSalesAmount: parseNumber(row['모빌매출액'] || 0),
    mobileSalesWeight: parseNumber(row['모빌판매중량'] || row['판매중량'] || 0),
    flagshipSalesWeight: parseNumber(row['플래그십중량'] || 0),
    mobilePurchaseWeight: parseNumber(row['모빌구매중량'] || row['구매중량'] || 0),
    flagshipPurchaseWeight: parseNumber(row['플래그십구매중량'] || 0),
    isTotal: false
  }));
}

/**
 * Parse number from various formats
 */
function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Select appropriate component based on query intent
 */
export function selectComponent(intent: string, data: any[]): ComponentConfig {
  switch (intent) {
    case 'sales_by_branch':
    case 'monthly_sales_by_branch':
    case 'daily_sales_by_division':
      // Check if data structure matches SalesTable requirements
      if (data.length > 0 && (data[0]['사업소'] || data[0]['창고명'])) {
        return {
          component: 'SalesTable',
          transform: transformToSalesTable
        };
      }
      return {
        component: 'GenericResultTable',
        transform: (data) => data
      };

    case 'customer_sales':
    case 'inventory_status':
    case 'high_inventory':
    case 'daily_collections':
    case 'pending_purchases':
    case 'pending_sales':
    case 'product_group_sales':
    case 'daily_total_sales':
    case 'generic':
    default:
      return {
        component: 'GenericResultTable',
        transform: (data) => data
      };
  }
}

/**
 * Check if data can be displayed with SalesTable
 */
export function canUseSalesTable(data: any[]): boolean {
  if (data.length === 0) return false;

  const firstRow = data[0];
  const hasRequiredFields = (
    (firstRow['사업소'] || firstRow['창고명']) &&
    (firstRow['총매출액'] || firstRow['매출액'] || firstRow['합계'])
  );

  return hasRequiredFields;
}
