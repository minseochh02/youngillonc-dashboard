# Fetching data for B2C 사업소별
_Exported on 4/3/2026 at 19:50:44 GMT+9 from Cursor (2.4.31)_

---

**User**

how are we fetching for b2c's 사업소별

---

**Cursor**


Searching the codebase for how B2C data is fetched with 사업소별 (by office) filtering.




Reading the B2C meetings API route for all tabs that use office/branch grouping.




Here’s how **B2C “사업소별”** is determined in this app.

## Source: 담당자’s `employee_category.전체사업소`

B2C office/branch is **not** taken from 거래처 `거래처그룹1명` (that pattern is used more for B2B). It comes from the **sales 담당자** row:

`sales` (union east/west) → `employees` on `s.담당자코드 = e.사원_담당_코드` → `employee_category` on `e.사원_담당_명 = ec.담당자`, then **`ec.전체사업소`**.

### Business tab (`tab=business`)

SQL collapses `전체사업소` into a `branch` label with `LIKE` rules; anything that doesn’t match 동부/서부/중부/남부/제주 becomes **`본부`**. Rows without `전체사업소` are dropped.

```50:78:src/app/api/dashboard/b2c-meetings/route.ts
        SELECT
          CASE
            WHEN ec.전체사업소 LIKE '%동부%' THEN '동부'
            WHEN ec.전체사업소 LIKE '%서부%' THEN '서부'
            WHEN ec.전체사업소 LIKE '%중부%' THEN '중부'
            WHEN ec.전체사업소 LIKE '%남부%' THEN '남부'
            WHEN ec.전체사업소 LIKE '%제주%' THEN '제주'
            ELSE '본부'
          END as branch,
          CASE
            WHEN ec.b2c_팀 = 'B2B' THEN 'B2B'
            ELSE 'B2C'
          END as business_type,
          ...
        FROM ${baseSalesTable} s
        ...
        LEFT JOIN employees e ON s.담당자코드 = e.사원_담당_코드
        LEFT JOIN employee_category ec ON e.사원_담당_명 = ec.담당자
        ...
          AND ec.전체사업소 IS NOT NULL
```

Filters: PVL/CVL, exclude 김도량, date range; VAT divisor applies to `합계`.

### Manager sales tab (`tab=manager-sales`)

Same join path; **`ec.전체사업소` is selected as `branch_raw`**, then the API maps it in JS (벤츠→MB, 경남사업소→창원, substring rules for 화성/남부/…/부산, else strip `사업소`/`지사`).

```117:180:src/app/api/dashboard/b2c-meetings/route.ts
        SELECT


