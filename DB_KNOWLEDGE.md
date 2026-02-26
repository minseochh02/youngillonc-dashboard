# Database Knowledge Base - Youngil ONC

This document maintains key discoveries about the database schema, column mappings, and data characteristics to ensure consistent dashboard development.

## 1. Business Locations (사업소 / Branches)

The "Branch" dimension is identified by different columns in different tables. For reporting, these should be mapped to short display names.

| Table | Primary Branch Column | Sample Values | Short Name |
| :--- | :--- | :--- | :--- |
| **Sales** | `거래처그룹1코드명` | 창원사업소, 화성사업소, MB, 서부사업소, 중부사업소, 부산사업소, 제주사업소, 동부사업소, 남부지사 | 창원, 화성, MB, 서부, 중부, 부산, 제주, 동부, 남부 |
| **Purchases** | `거래처그룹1명` | 창원사업소, 화성사업소, 서부사업소, 동부사업소, 부산사업소, 제주사업소, 남부지사, 매입처 | 창원, 화성, 서부, 동부, 부산, 제주, 남부 |
| **Deposits** | `부서명` | 창원, 화성, 서부, etc. | 창원, 화성, 서부, etc. |
| **Notes** | `부서명` | 창원, 화성, 서부, etc. | 창원, 화성, 서부, etc. |

> **Note**: Always use `COALESCE` or `REPLACE` in SQL to normalize these names when joining tables.

## 2. Product Categorization

| Category | Identification Logic (SQL) | Description |
| :--- | :--- | :--- |
| **Mobil Products** | `품목그룹1코드 IN ('IL', 'PVL', 'MB', 'CVL', 'AVI', 'MAR')` | Mobil brand products identified by group codes. |
| **Misc Mobil** | `품목명_규격_ LIKE 'MOBIL%' AND 품목그룹1코드 = 'AA'` | Mobil items straying in the Miscellaneous group. |
| **Flagship Tier** | `품목그룹3코드 = 'FLA'` | High-end product category. |

### Mobil Product Group Codes:
- **IL**: Mobil-산업유 (Industrial)
- **PVL**: Mobil-자동차 (Passenger Vehicle)
- **CVL**: Mobil-대형차 (Commercial Vehicle)
- **AVI**: Mobil-항공기유 (Aviation)
- **MAR**: Mobil-선박유 (Marine)
- **MB**: Mobil-MB (Mercedes-Benz specialized)

## 3. Data Types & Cleaning

The database stores many numeric and financial fields as **formatted strings** (e.g., `"1,234,567"`). 

### Required Cleaning Logic:
Before performing aggregations (SUM, AVG), characters like commas must be removed and the value cast to a numeric type.

**Standard Pattern:**
```sql
SUM(CAST(REPLACE(column_name, ',', '') AS NUMERIC))
```

### Key Columns Needing Cleaning:
- `합_계` (Total with tax)
- `공급가액` (Supply Amount)
- `중량` (Weight)

## 4. Measurement Units
- **Currency**: KRW (₩)
- **Weight**: KG (kg)

## 5. Collection (수금) Business Logic

Based on official internal reporting rules:

### 5.1 Deposits (Cash/Card)
- **Table**: `deposits`
- **Mandatory Filter**: `계정명 = '외상매출금'` (Accounts Receivable only).
- **Excluded**: 미수금, 잡이익, etc.
- **Categorization**: 
    - **Card**: Account (`계좌`) contains '카드' or '이니시스' AND does not match specific bank branch names.
    - **Cash**: Specific bank branch accounts or generic accounts not labeled as card.

### 5.2 Notes (어음)
- **Table**: `promissory_notes`
- **Filter**: `증감구분 = '증가'` (New notes received).
- **Branch Mapping Prefixes**: 
    - **Y**: 화성
    - **IC**: 서부
    - **N**: 동부
    - **C**: 창원
    - **P**: 부산

## 6. Mobil Payment (모빌결제내역) Business Logic

Based on Mobil Korea purchase tracking:

### 6.1 Industry Group Classification
- **Table**: `purchase_orders` (발주서현황) - **Exclusive Source**
- **Supplier Filter**: `거래처명 LIKE '%모빌%'`
- **Date Filter**: `월_일` column
- **Branch Column**: `창고명`
- **Categorization Logic**:
    - **IL (Industrial)**: `품목그룹1코드 = 'IL'` (Mobil-산업유)
    - **AUTO (Automotive)**: `품목그룹1코드 IN ('PVL', 'CVL')` (Mobil-자동차, Mobil-대형차)
    - **MBK (Specialized)**: `품목그룹1코드 IN ('MB', 'AVI')` (Mobil-MB, Mobil-항공기유)
- **Primary Group**: The "산업군" displayed in the report is dynamically determined by the highest payment volume category among IL, AUTO, and MBK for each branch.
