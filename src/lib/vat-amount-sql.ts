/**
 * ERP sales/purchase rows expose both 합계 (VAT-inclusive gross) and 공급가액 (supply, ex-VAT).
 * Prefer the column for the requested view instead of dividing 합계 by 1.1.
 *
 * Tables without 공급가액 (e.g. shopping_sales, purchase_orders) must keep a legacy
 * gross→net approximation at call sites.
 */

export function sqlSalesAmountExpr(tableAlias: string, includeVat: boolean): string {
  const a = tableAlias;
  return includeVat
    ? `CAST(REPLACE(${a}.합계, ',', '') AS NUMERIC)`
    : `CAST(REPLACE(${a}.공급가액, ',', '') AS NUMERIC)`;
}

export function sqlPurchaseAmountExpr(tableAlias: string, includeVat: boolean): string {
  const a = tableAlias;
  return includeVat
    ? `CAST(REPLACE(${a}.합계, ',', '') AS NUMERIC)`
    : `CAST(REPLACE(${a}.공급가액, ',', '') AS NUMERIC)`;
}

/** Same as sqlSalesAmountExpr but COALESCE(..., '0') for nullable text amounts. */
export function sqlSalesAmountExprCoalesced(tableAlias: string, includeVat: boolean): string {
  const a = tableAlias;
  return includeVat
    ? `CAST(REPLACE(COALESCE(${a}.합계, '0'), ',', '') AS NUMERIC)`
    : `CAST(REPLACE(COALESCE(${a}.공급가액, '0'), ',', '') AS NUMERIC)`;
}
