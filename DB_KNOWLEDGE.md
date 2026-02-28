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
| **Ledger** | `부서명` | 창원사업소, 화성사업소, etc. | 창원, 화성, etc. |

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
- **Date Filter**: `월_일` column (format: `YYYY-MM-DD`)
- **Branch Column**: `창고명` — actual values: 창원, 화성, 부산, 중부(화성auto), 화성(B2B), 본사직송. No '사업소'/'지사' suffix.
- **Categorization Logic**:
    - **IL (Industrial)**: `품목그룹1코드 = 'IL'` (Mobil-산업유)
    - **AUTO (Automotive)**: `품목그룹1코드 IN ('PVL', 'CVL')` (Mobil-자동차, Mobil-대형차)
    - **MBK (Specialized)**: `품목그룹1코드 IN ('MB', 'AVI')` (Mobil-MB, Mobil-항공기유)
- **Primary Group**: The "산업군" displayed in the report is dynamically determined by the highest payment volume category among IL, AUTO, and MBK for each branch.

## 7. Expense (지출결의서) — Deprecated

The `expenses` table is **no longer available**. 입출금현황 withdrawals and 자금현황 지출 are not sourced from DB; ledger/deposits only.

## 8. Ledger (원장 / 계정별원장) — 자금현황

Used for **자금현황** (Funds Status) to show real account balances and daily flow. The ledger table contains **all** account types (cash, deposits, receivables, expenses, P&amp;L, etc.); for funds we **must filter by `계정명`** and never aggregate all rows into one figure.

### 8.1 Table: `ledger`
- **Date column**: `일자_no_` — format `YYYY/MM/DD -n` (e.g. `2026/01/05 -29`). Filter by `일자_no_ LIKE 'YYYY/MM/DD%'` (convert request date `YYYY-MM-DD` to `YYYY/MM/DD`).
- **Account**: `계정명` — exact account name per row. Use for filtering; do not sum across all accounts.
- **Branch**: `부서명` — department/branch (e.g. 창원사업소, 화성사업소). Ledger has column `부서명` for branch dimension.
- **Amounts** (apply §3 cleaning: `REPLACE(column, ',', '')`, then `CAST(... AS NUMERIC)`):
  - `차변금액` — debit (당일증가)
  - `대변금액` — credit (당일감소)
  - `잔액` — running balance per row; use **latest per 계정명** (max `id` per account for that date) for "금일잔액", and same for previous day for "전일잔액".
- **Metadata**: `회사명` (e.g. (주)영일오엔씨), `기간` (e.g. 01 ~ 2026), `계정코드`, `계정코드_메타`, `계정명_메타` — map 계정코드 1039 → 보통예금, 1040 → 외화예금, 1023/1024/1025 → 현금 시재금-창원/화성/서울.
- **Other**: `적요`, `거래처명`, `거래처코드`.

### 8.2 Ledger account names (계정명) — funds-relevant

Ledger has **many** distinct `계정명` values (61+). For 자금현황, filter rows by `계정명` as follows.

**KRW (현금 및 예금):**

| Funds category   | Filter (계정명) | Notes |
| :---             | :---            | :---  |
| **현금 시재금**  | `계정명 LIKE '현금 시재금%'` | 현금 시재금-서울, 현금 시재금-창원, 현금 시재금-화성 only. |
| **보통예금**     | `계정명 = '보통예금'` | Single account. |
| **퇴직연금**     | `계정명 = '퇴직연금운용자산'` | |
| **받을어음**     | `계정명 = '받을어음'` (balance); 당일 flow from `promissory_notes` (§5.2). | |
| **단기차입금**   | `계정명 = '단기차입금'` | |
| **장기차입금**   | `계정명 = '장기차입금'` | |

**Foreign (외화 자산) — exact match:**

- `외화예금`
- `외환차익`

**Loans / Liabilities (차입금·부채) — exact match:**

- `단기차입금`, `장기차입금`
- (Temporarily excluded: `미지급금`, `미지급비용`, `외상매입금`, `예수금`, `부가세예수금`)

All other 계정명 (e.g. 미수금, 외상매출금, expenses, P&amp;L) must be excluded when computing funds.

### 8.3 Funds (자금현황) aggregation
- **Currency Convention**: All values (including foreign assets and loans) are reported in **KRW (₩)**. The `ledger` table already stores the converted Won value for foreign accounts based on the exchange rate at the time of entry.
- **현금 시재금**: From `ledger` where `계정명 LIKE '현금 시재금%'` only — 전일잔액 = sum of latest 잔액 per 계정명 for previous day; 금일잔액 = sum of latest 잔액 per 계정명 for selected date; 당일증가/당일감소 = sum of 차변금액/대변금액 for that date.
- **보통예금**: From `ledger` where `계정명 = '보통예금'` — same aggregation (전일/금일 잔액, 당일 차변/대변).
- **외화예금**: From `ledger` where `계정명 = '외화예금'` — same aggregation.
- **받을어음 (당일 flow)**: `promissory_notes` where 증감구분 = '증가' (§5.2). Balance can also be taken from ledger `계정명 = '받을어음'`.

### 8.4 입출금현황 — 일일 입출금 (In-Out Flow)

Sourced **entirely from the `ledger` table** for the account `보통예금` only.

- **Deposits (입금)**: Rows where `차변금액` (debit) > 0 AND `계정명 = '보통예금'`.
- **Withdrawals (출금)**: Rows where `대변금액` (credit) > 0 AND `계정명 = '보통예금'`.
