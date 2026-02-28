# (창원) 일일매출/수금 마감현황 Answer Key
**Date**: 2025-11-01 (토요일)
**Target Division**: 창원

## 1. 판매현황 (Sales Status) - [단위: 원, VAT포함]
| 구분 | 당일 (Today) | 누계 (Accumulated) | 비고 (Remarks / Weight) |
| :--- | :--- | :--- | :--- |
| **Mobil** | 31,562,388 | 31,562,388 | 21.05 |
| **Mobil-MB** | 0 | 0 | 54.46 |
| **블라자** | 0 | 0 | - |
| **훅스** | 2,264,570 | 2,264,570 | 2.03 |
| **기타(셸 외 타사제품)** | 0 | 0 | - |
| **매출액 합계** | **33,826,958** | **33,826,958** | **77.54** |

## 2. 수금액 (Collection Status) - [단위: 원]
| 구분 | 당일 (Today) | 누계 (Accumulated) |
| :--- | :--- | :--- |
| **Cash** | 149,600 | 149,600 |
| **어음** | 0 | 0 |
| **카드** | 0 | 0 |
| **합계** | **149,600** | **149,600** |

## 3. IL (Flagship) 실적 - [단위: L]
| 구분 | 당일 (Today) | 누계 (Accumulated) |
| :--- | :--- | :--- |
| **매출 Vol(L)** | 18 | 18 |
| **매입 Vol(L)** | 0 | 0 |

## 4. 재고현황 (Inventory Status) - [단위: D/M]
| 구분 | 전일재고 (Prev) | 입고 (In) | 출고 (Out) | 재고 (Stock) |
| :--- | :--- | :--- | :--- | :--- |
| **Mobil** | 653.59 | 0 | 20.45 | 633.14 |
| **Mobil-MB** | 130.16 | 0 | 54.46 | 75.70 |
| **블라자** | 0 | 0 | 0 | 0 |
| **훅스** | 67.10 | 0 | 2.03 | 65.08 |
| **기타** | 30.88 | 0 | 0 | 30.88 |
| **합계** | **881.73** | **0** | **76.94** | **804.79** |

---

## 5. 지표 분석 및 매핑 가이드 (Logic to find in DB)

### A. 판매현황 (Sales)
*   **Source Table**: `sales`
*   **Filters**:
    *   `일자 = '2025-11-01'`
    *   `거래처그룹1코드명` or similar field filtering for '창원'.
*   **Categorization (품목그룹1코드 or 품목명)**:
    *   **Mobil**: Likely `품목그룹1코드` in ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR') and product names containing 'MOBIL'.
    *   **훅스**: Likely `품목그룹1코드` or `품목명` related to 'FUCHS' or '훅스'.
    *   **매출액**: `합_계` column (Clean commas and cast to numeric).
    *   **비고 (Weight)**: `중량` column.

### B. 수금액 (Collections)
*   **Source Table**: `deposits` (입금보고서집계) or `ledger` (계정별원장).
*   **Filters**:
    *   `전표번호` date part = '2025-11-01'.
    *   `부서명` or `거래처그룹` filtering for '창원'.
*   **Categorization**:
    *   **Cash**: `계정명` = '보통예금' or '현금'.
    *   **어음**: `계정명` = '받을어음'.

### C. 재고현황 (Inventory)
*   **Source Table**: `inventory_transfers`, `sales` (for Out), `purchases` (for In).
*   **Logic**:
    *   `전일재고` = Sum of all historical (In - Out) up to 2025-10-31.
    *   `입고` = `purchases` on 2025-11-01.
    *   `출고` = `sales` on 2025-11-01.
    *   `D/M` vs `L`: Conversion factor needed (Likely 1 Drum = 200L or similar based on the ratio in the table).
        *   *Calculation check*: Mobil Out 20.45 (D/M) -> 4,090 (L). **Factor = 200** (20.45 * 200 = 4090).
        *   *Calculation check*: MB Out 54.46 (D/M) -> 10,892 (L). **Factor = 200** (54.46 * 200 = 10892).
        *   *Calculation check*: 훅스 Out 2.03 (D/M) -> 405 (L). **Factor = 200** (2.025 * 200 = 405).

### D. IL (Flagship)
*   **Source Table**: `sales`
*   **Filter**: `품목그룹3코드 = 'FLA'` (based on existing code in `api/dashboard/daily-status/sales/route.ts`).
