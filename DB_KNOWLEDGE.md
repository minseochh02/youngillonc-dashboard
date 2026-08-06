# Database Knowledge - Youngil ONC

## Overview
This document contains essential knowledge about the Youngil ONC database structure, business rules, and calculation methods. Use this as a reference when building queries or implementing new features.

---

## 1. Database Tables

### Core Operational Tables (Normalized)
| Table | Display Name | Row Count | Key Columns | Purpose |
|-------|-------------|-----------|-------------|---------|
| `sales` | 판매현황 | ~6,500 | 일자, 거래처코드, 품목코드, 수량, 중량, 합계 | Sales transactions (NORMALIZED) |
| `purchases` | 구매현황 | ~5,000 | 일자, 거래처코드, 품목코드, 수량, 중량, 합_계 | Purchase transactions (denormalized) |
| `ledger` | 계정별원장 | ~6,160 | 일자, 적요, 계정코드, 거래처코드, 차변금액, 대변금액, 잔액 | Unified accounting ledger (Source of Truth) |
| `bank_accounts` | 계좌리스트 | 56 | 계좌코드, 계좌명, 계정명_계정코드_ | Bank account metadata |
| `inventory` | 창고별재고 | ~54,000 | 품목코드, 창고코드, 재고수량 | Current inventory by warehouse |
| `inventory_transfers` | 창고이동현황 | ~138 | 일자, 출고창고명, 입고창고명, 품목명_규격, 수량 | Inter-warehouse transfers |

### Lookup Tables (NEW - for normalized schema)
| Table | Display Name | Row Count | Key Columns | Purpose |
|-------|-------------|-----------|-------------|---------|
| `items` | 품목 | 3,317 | 품목코드, 품목그룹1코드, 품목그룹2코드, 품목그룹3코드, 품목명 | Product master data |
| `clients` | 거래처리스트 | 10,755 | 거래처코드, 거래처명, 업종분류코드, 담당자코드, 지역코드 | Customer/vendor master |
| `warehouses` | 창고 | 25 | 창고코드, 창고명 | Warehouse master |
| `employees` | 사원 | 65 | 사원_담당_코드, 사원_담당_명 | Employee master |
| `employee_category` | 사원분류 | 47 | 담당자, b2b사업소, 전체사업소 | Employee branch assignments |
| `company_type_auto` | AUTO 업종분류기준 | 35 | 업종분류코드, 모빌_대시보드채널 | Customer industry classification |
| `company_type` | 업종분류 | 116 | 업종분류코드, 모빌분류, 산업분류 | Industry type definitions |

### Schema Changes (March 2026)
**IMPORTANT**: The `ledger` table was rebuilt on March 24, 2026, to include all collection data previously in `deposits`.

**NEW (March 24, 2026)**:
- `deposits` table is **DEPRECATED**. Use `ledger` instead.
- `ledger` table structure: `일자`, `적요`, `계정코드`, `거래처코드`, `차변금액`, `대변금액`, `잔액`.
- **Rule**: Customer collections (수금) are entries in `ledger` where `계정코드 = '1089'` (외상매출금) and `대변금액 > 0`.
- **Rule**: To identify **Card** vs **Cash** in ledger:
  - **Card**: `적요` contains `카드`, `이니시스`, `삼성`, `비씨`, `현대`, `롯데`, or bank names followed by numeric settlement IDs (e.g., `농협50389644`).
  - **Cash**: All other `1089` credits, excluding `적요 LIKE '%할인%'`.
- **Rule**: To get **Branch (사업소)**, JOIN with `clients` on `거래처코드` and use `거래처그룹1명`.
- **Rule**: Account codes:
  - `1039`: 보통예금 (Ordinary Deposit)
  - `1089`: 외상매출금 (Accounts Receivable)
  - `1109`: 받을어음 (Notes Receivable)
  - `1023/1024/1025`: 현금 시재금 (Cash on hand)

---

## 2. Branch Names (사업소)
**Standard**: MB, 화성, 창원, 남부, 중부, 서부, 동부, 제주, 부산

### Branch Mapping by Table

**`sales` (NORMALIZED - direct JOIN path)**:
```sql
-- Branch comes from employee_category.전체사업소 via direct JOIN:
-- sales → employees → employee_category
SELECT
  ec.전체사업소 as branch
FROM sales s
LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
```

**Other tables**:
- `purchases`: 거래처그룹1명 (still denormalized)
- `ledger` (Collections): `거래처그룹1명` (via JOIN with `clients`)
- `promissory_notes`: `부서명`
- `inventory_transfers`: `출고창고명`, `입고창고명`

### Branch Value Mapping
The `employee_category` (사원구분코드) table stores branch names in Korean, which need to be mapped to standardized short codes for display and analysis:

```sql
CASE
  WHEN ec.전체사업소 = '벤츠' THEN 'MB'  -- Mercedes-Benz division
  WHEN ec.전체사업소 = '경남사업소' OR ec.전체사업소 = '창원사업소' THEN '창원'
  WHEN ec.전체사업소 LIKE '%화성%' THEN '화성'
  WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
  WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
  WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
  WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
  WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
  WHEN ec.전체사업소 LIKE '%부산%' THEN '부산'
  ELSE REPLACE(REPLACE(ec.전체사업소, '사업소', ''), '지사', '')
END
```

---

## 3. Product Categories (품목그룹)

### Brand-Specific Codes
- **Mobil**: `품목그룹1코드 IN ('IL', 'PVL', 'CVL', 'MB')`
- **Mobil-MB**: `품목그룹1코드='MB'` OR `판매처명 LIKE '메르세데스벤츠%'`
- **Blaser**: `품목그룹1코드='BL'`
- **Fuchs**: `품목그룹1코드='FU'`
- **Shell**: `품목그룹1코드='SH'`

---

## 4. Data Cleaning
Many numeric columns stored as TEXT with commas: `"1,234,567"`

**Always use**: `CAST(REPLACE(column,',','') AS NUMERIC)` (unless table is rebuilt with REAL type)

---

## 5. Dates
- **Standard Format**: `YYYY-MM-DD` (e.g., `2026-03-05`)
- **Ledger Format**: `YYYY-MM-DD`

---

## 6. Collections (수금)

### Ledger (Replaces Deposits)
- **Table**: `ledger`
- **Filter**: `계정코드='1089'` (외상매출금) and `대변금액 > 0`
- **Branch**: JOIN with `clients` on `거래처코드` to get `거래처그룹1명`.
- **Card**: `적요` LIKE '%카드%' or '%이니시스%' or issuer names (삼성, 현대, 비씨, 롯데, 농협, 하나)
- **Cash**: All other `1089` credits, excluding `적요 LIKE '%할인%'`

---

## 7. Sales terminology: 판매량 · 매출 (VAT)

### 판매량 = 중량 및 재고 중량 계산 Rule (중요)
- In business language, reports, and dashboards, **판매량** means **중량** (weight, typically liters), **not** piece count.
- **CRITICAL RULE**: **재고 계산 시에는 테이블에 기재된 `중량` 컬럼 값을 신뢰해서는 안 되며, 반드시 `수량 × 품목 규격(단위용량)`을 계산하여 중량을 도출해야 합니다.** (테이블에 따라 총중량이 아닌 단품 단위용량이 중량 컬럼에 잘못 기록되어 있는 등 데이터 오류가 자주 발생하기 때문입니다.)


### 매출 = 공급가 (부가세 제외); 컬럼 선택
- For analysis and cross-report consistency, **매출 (ex-VAT)** uses the **`공급가액`** column from synced ERP rows (`sales`, division sales, `purchases`). Clean commas then `CAST(... AS NUMERIC)`; **do not** derive ex-VAT by dividing `합계` by 1.1.
- **매출 (gross, VAT 포함)** uses **`합계`** the same way (no division).

```sql
-- ex-VAT
CAST(REPLACE(공급가액, ',', '') AS NUMERIC)
-- gross
CAST(REPLACE(합계, ',', '') AS NUMERIC)
```

- **Exceptions**: tables without `공급가액` (e.g. `shopping_sales`, `purchase_orders`) may still approximate ex-VAT with `합계 / 1.1` or another rule documented at the call site.

### Purchases source-of-truth rule (2026-04)
- For dashboard/report purchase metrics, use only the unified **`purchases`** table.
- Do **not** UNION `east_division_purchases` or `west_division_purchases` into analytic purchase queries; those tables are excluded by current business policy.

---

## 8. Ledger (원장) - Funds Status

### Key Accounts (계정코드)
- `1023/1024/1025`: 현금 시재금 (창원/화성/서울)
- `1039`: 보통예금
- `3350`: 퇴직연금운용자산
- `1109`: 받을어음
- `1040`: 외화예금

---

## 11. Daily Inventory Calculation (일일재고파악시트)

### Formula
The daily inventory sheet uses a **backwards calculation** from current inventory:

```
Beginning Inventory = Ending Inventory - Purchases + Sales - Net Transfers
```

---

## Quick Reference Card

| What | Where | Filter Column | Format |
|------|-------|---------------|--------|
| Sales by branch | `sales` (JOIN via employees→employee_category) | `ec.전체사업소` | LIKE '%사업소%' OR = '벤츠' |
| Purchases by branch | `purchases` | `거래처그룹1명` | LIKE '%창원%' |
| Inventory by warehouse | `inventory` | `창고명` | LIKE '%창원%' |
| Collections by branch | `ledger` (JOIN via clients) | `c.거래처그룹1명` | LIKE '%창원%' |
| Product categories | `items` table | `품목코드` | Exact match |
| Daily transactions | All tables | `일자` | 'YYYY-MM-DD' |
| Ledger entries | `ledger` | `일자` | 'YYYY-MM-DD' |
| 판매량 (volume) | `sales`, `purchases`, division sales | **`중량`** | Sum `중량`, not `수량` |
| 매출 (ex-VAT) | `sales`, division sales, `purchases` | **`공급가액`** | comma-clean → numeric |
| 매출 (gross) | same | **`합계`** | comma-clean → numeric |

## 12. Inventory Management Rules (재고 관리 및 수불 규칙)

### 재고수량관리제외 규칙 (Exclusion of Non-Inventory Items)
- **품목 마스터 (`items`)** 테이블에 **`재고수량관리`** 컬럼이 존재합니다.
- 컬럼의 값이 **`수량관리제외`**인 품목(예: 운반비외, 가격정정, 쇼핑몰 포인트, 단수조정, EHS가공비 등)은 실물 재고 관리 대상이 아닙니다.
- **Rule**: 재고 현황 산출, 월별 수불 집계, 엑셀 파일 다운로드 등 재고 관련 연산을 수행할 때는 반드시 `재고수량관리 != '수량관리제외'` 조건을 적용하여 해당 품목들을 제외해야 합니다.

### 외주가공 창고의 가상 이동 및 실재고 수렴 (Subcontracting Virtual Transfers)
- 외주가공처 창고(`영일유화 P2`, `백호테크원 P3`, `다우기업 P4`)는 원재료를 자체 매입하지 않고 모체 공장에서 받아 소모하는 구조입니다.
- **Rule**: 외주가공처 창고의 장부상 실재고가 음수(-)로 차감되는 현상을 막고 현실을 반영하기 위해, 생산 원재료 소모(`production_material_consumption`) 발생 시 실제 원재료 매입처인 모체 공장(`화성 05`, `창원 06`)에서 외주 창고로 가상 이동(Virtual Transfer)하여 즉시 소모된 것으로 처리합니다.
- 이에 따라 외주가공처 창고의 기말 재고 수량/중량은 음수 없이 항상 **`0`**으로 수렴하며, 모체 공장 재고에서 최종 소모량이 올바르게 차감됩니다.

### 규격정보 용량 기반 중량 계산 (Standard Weight Calculations)
- 창고별/월별 수불 집계 시 총중량(L, kg)은 데이터의 오류 가능성이 높은 테이블의 `중량` 컬럼 값을 직접 누적하지 않고, **`수량 × 단품 규격정보 용량`**으로 재산출해야 합니다.
- **규격 파싱 프로그램 알고리즘 및 규칙**:
  1. **규격정보가 NULL이거나 비어있을 때 (Fallback to Item Name)**:
     - `품목명` 텍스트를 기준으로 2차 정규식(Regex)을 돌립니다.
     - **패턴 1**: `(\d+)X(\d+)LT` (예: `MOBIL JET OIL 24X1LT` ➔ $24 \times 1 = 24\text{ L}$)
     - **패턴 2**: `(\d+)L` (예: `MOBIL DELVAC 20L` ➔ $20\text{ L}$)
     - 패턴 매칭 실패 시 최종 단위중량은 `0`으로 처리합니다.
  2. **규격정보 텍스트 정규화 (Normalization)**:
     - 텍스트의 앞뒤 공백을 제거하고 대문자로 변환한 뒤, 전각 슬래시 `／`를 반각 슬래시 `/`로 통합 치환합니다.
  3. **소수점 단위 변환 배율 설정 (Unit Scaling)**:
     - 텍스트에 밀리리터(`ML`)나 그램(`G`)이 포함되고, `KG` 또는 `GL`(Gallon)이 미포함된 경우 배율(Scale)을 `0.001`로 지정하여 기본 단위를 L(kg)로 보정합니다.
  4. **슬래시 분할 및 연산 (Box Pack parsing)**:
     - 슬래시 `/`를 기준으로 문장을 2개의 파트로 분리합니다 (예: `0.95/24`).
     - 각 파트에서 특수문자를 제거하고 숫자만 추출하여 `실제용량(A) × 박스당입수(B) × 소수점 배율`을 계산해 최종 단위중량을 도출합니다 (예: `0.95/24` ➔ $0.95 \times 24 \times 1 = 22.8\text{ L}$).
  5. **단일 수치 규격 처리 (Single value spec)**:
     - 슬래시가 없는 단일 용량 문자열(예: `18.9`, `20L`, `0.39`)인 경우 단위(L, KG, EA 등)를 소거한 후 숫자만 남겨 단위중량으로 인식합니다 (예: `18.9` ➔ $18.9\text{ L}$).
     - 파싱 불가능한 텍스트이거나 파싱 결과가 NaN인 경우 기본값 `0`을 할당합니다.


### 지사 간 내부 거래(본사 ➔ 지사 공급) 처리 규칙: 김도량 담당 건
- **개념**: 본사 매출 테이블(`sales`)의 **담당자 `김도량` (`담당자코드 = '031'`)** 전 건은 본사 공장에서 동부지사(`YI90000`) 및 서부지사(`YI90001`)로 물류를 공급(출고)한 **사내 지사간 이관 매출(Internal Sales)**입니다.
- **매출 실적 분석 시 (Sales Analytics)**:
  - 김도량 담당 건은 대외 영업 매출이 아닌 사내 이동 매출이므로, 매출 실적/실납/사원 실적 집계 시에는 `SPECIAL_HANDLING_EMPLOYEE_NAMES` (`'김도량'`) 필터로 **제외**해야 매출 중복 합산이 방지됩니다.
- **재고 수불 계산 시 (Inventory Calculation Rules)**:
  - **본사 재고**: 본사 `sales` 테이블의 김도량 매출 건에 의해 본사 창고 실물 재고가 **차감(-)** 됩니다.
  - **지사 재고**: 동부/서부 매입 테이블(`east_division_purchases`, `west_division_purchases`)에 본사(`PR10001`) 명의로 동등한 일자/품목/수량의 입고 내역이 1:1 매칭되어 존재하므로 지사 창고 실물 재고가 **가산(+)** 됩니다.
  - **Rule**: 재고 수불 연산 시 김도량 건은 본사 출고(-) 및 지사 입고(+)로 정상 동작하여 사내 전사 총재고가 차감 없이 정확히 유지됩니다.

### 지사별 재고 수불 계산 규칙 (Branch-Specific Inventory Status & Table Rules)
- 전체 사내 또는 지사별(본사/서부/동부) 재고 현황 및 수불을 산출할 때는 지사별로 독립 구성된 8대 수불 테이블 세트를 각각 참조 및 합산해야 합니다.

#### 지사별 8대 수불 테이블 대응표
| 수불 항목 (역할) | HQ / Main (본사) | West (서부) | East (동부) | 부호 (수불 반영) |
|---|---|---|---|---|
| **기초 재고 스냅샷** | `youngil_inventory_20251231` | `west_inventory_20251231` | `east_inventory_20251231` | **기초 (+)** |
| **매입현황** | `purchases` | `west_division_purchases` | `east_division_purchases` | **입고 (+)** |
| **매출현황** | `sales` | `west_division_sales` | `east_division_sales` | **출고 (-)** |
| **자가사용현황** | `internal_uses` | `west_internal_uses` | `east_internal_uses` | **출고 (-)** |
| **폐기재고현황** | `disposed_inventory` | `west_disposed_inventory` | `east_disposed_inventory` | **출고 (-)** |
| **창고이동현황** | `inventory_transfers` | `west_inventory_transfers` | `east_inventory_transfers` | **입고(+) / 출고(-)** |
| **재고조정현황** | `inventory_adjustments` | `west_inventory_adjustments` | `east_inventory_adjustments` | **가산(+) / 차감(-)** |
| **생산 원자재 소모현황** | `production_material_consumption` | `west_production_material_consumption` | `east_production_material_consumption` | **생산입고(+) / 소모출고(-)** |

#### 기말 재고 수불 공식 (Ending Inventory Equation)
$$\text{기말재고} = \text{기초스냅샷} + \text{매입} - \text{매출} - \text{자가사용} - \text{폐기} \pm \text{창고이동} \pm \text{재고조정} + \text{생산입고} - \text{원자재소모}$$

- **Rule**: 지사별 수불 계산 시 본사, 서부, 동부 각 사업소의 창고 코드가 겹치거나 독립되어 동작하므로, 지사별 통합 재고 집계 시 위 8개 대응 테이블을 UNION ALL 하거나 각 지사별 테이블 세트에서 수불을 산출하여 합산해야 정확한 기말 재고가 도출됩니다.

---

**Last Updated**: 2026-08-06 (§12: Added Kim Doryang Internal Transfer rules, Branch-Specific Inventory Status & Table Rules for Main, West, East 8-table sets, Inventory Exclusion rule, Subcontractor virtual transfer logic, weight recalculation rules, and specification parsing algorithm)

