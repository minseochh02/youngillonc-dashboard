-- ============================================
-- Table: spendingrequests
-- SQL Name: spendingrequests
-- Rows: 1
-- ============================================

CREATE TABLE "spendingrequests" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "estimateId" TEXT NOT NULL,
  "lineItemId" TEXT DEFAULT NULL,
  "vendorId" TEXT DEFAULT NULL,
  "employeeId" TEXT DEFAULT NULL,
  "payeeName" TEXT DEFAULT NULL,
  "processName" TEXT DEFAULT NULL,
  "itemName" TEXT DEFAULT NULL,
  "materialActualCost" REAL DEFAULT 0,
  "laborActualCost" REAL DEFAULT 0,
  "expenseActualCost" REAL DEFAULT 0,
  "evidenceType" TEXT DEFAULT NULL,
  "evidenceText" TEXT DEFAULT NULL,
  "isUrgent" INTEGER DEFAULT 0,
  "deadlineMemo" TEXT DEFAULT NULL,
  "purchaseLink" TEXT DEFAULT NULL,
  "deliveryType" TEXT DEFAULT NULL,
  "contactInfo" TEXT DEFAULT NULL,
  "memo" TEXT DEFAULT NULL,
  "bankName" TEXT DEFAULT NULL,
  "accountNumber" TEXT DEFAULT NULL,
  "accountHolder" TEXT DEFAULT NULL,
  "hasTaxDeduction" INTEGER DEFAULT 0,
  "finalDeposit" REAL DEFAULT 0,
  "paymentStatus" TEXT DEFAULT '임시저장',
  "date" TEXT DEFAULT NULL,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

INSERT INTO "spendingrequests" ("estimateId", "lineItemId", "vendorId", "employeeId", "payeeName", "processName", "itemName", "materialActualCost", "laborActualCost", "expenseActualCost", "evidenceType", "evidenceText", "isUrgent", "deadlineMemo", "purchaseLink", "deliveryType", "contactInfo", "memo", "bankName", "accountNumber", "accountHolder", "hasTaxDeduction", "finalDeposit", "paymentStatus", "date", "createdAt", "updatedAt") VALUES ('EST-1772555178816', '1', NULL, NULL, NULL, '공사준비', '공사 동의서(공사 동의율 40% 기준)', 2000, 0, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '우리', '1111111111111', '대초', 0, 0, '임시저장', '2026-03-03', '2026-03-03', '2026-03-03T16:27:08.244Z');

-- Table Metadata:
-- Display Name: spendingrequests
-- Description: Imported from schema.sql
-- Created From: schema.sql
-- Duplicate Action: skip


-- ============================================
-- Table: lineitems
-- SQL Name: lineitems
-- Rows: 1
-- ============================================

CREATE TABLE "lineitems" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "estimateId" TEXT NOT NULL,
  "masterItemId" TEXT DEFAULT NULL,
  "isAdditional" INTEGER DEFAULT 0,
  "previousId" TEXT DEFAULT NULL,
  "isCurrent" INTEGER DEFAULT 1,
  "categoryName" TEXT DEFAULT NULL,
  "subCategoryName" TEXT DEFAULT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT DEFAULT NULL,
  "quantity" REAL DEFAULT 0,
  "materialUnitPrice" REAL DEFAULT 0,
  "laborUnitPrice" REAL DEFAULT 0,
  "expenseUnitPrice" REAL DEFAULT 0,
  "unitPrice" REAL DEFAULT 0,
  "amount" REAL DEFAULT 0,
  "note" TEXT DEFAULT NULL,
  "requestDate" TEXT DEFAULT NULL,
  "createdAt" TEXT DEFAULT (datetime('now'))
);

INSERT INTO "lineitems" ("estimateId", "masterItemId", "isAdditional", "previousId", "isCurrent", "categoryName", "subCategoryName", "name", "unit", "quantity", "materialUnitPrice", "laborUnitPrice", "expenseUnitPrice", "unitPrice", "amount", "note", "requestDate", "createdAt") VALUES ('EST-1772555178816', NULL, 0, NULL, NULL, '공사준비', '공사준비', '공사 동의서(공사 동의율 40% 기준)', '식', 1, 20000, 0, 0, 20000, 20000, NULL, NULL, NULL);

-- Table Metadata:
-- Display Name: lineitems
-- Description: Imported from schema.sql
-- Created From: schema.sql
-- Duplicate Action: skip


-- ============================================
-- Table: paymentmilestones
-- SQL Name: paymentmilestones
-- Rows: undefined
-- ============================================

CREATE TABLE "paymentmilestones" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "estimateId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "percentage" REAL DEFAULT NULL,
  "amount" REAL DEFAULT NULL,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

-- Table Metadata:
-- Display Name: paymentmilestones
-- Description: Imported from schema.sql
-- Created From: schema.sql
-- Duplicate Action: skip


-- ============================================
-- Table: schedules
-- SQL Name: schedules
-- Rows: 2
-- ============================================

CREATE TABLE "schedules" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "estimateId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "note" TEXT DEFAULT NULL,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

INSERT INTO "schedules" ("estimateId", "type", "date", "note", "createdAt", "updatedAt") VALUES ('EST-1772555178816', 'ESTIMATE', '2026-03-03', '자동 생성', NULL, NULL);
INSERT INTO "schedules" ("estimateId", "type", "date", "note", "createdAt", "updatedAt") VALUES ('EST-1772555351326', 'ESTIMATE', '2026-03-03', '자동 생성', NULL, NULL);

-- Table Metadata:
-- Display Name: schedules
-- Description: Imported from schema.sql
-- Created From: schema.sql
-- Duplicate Action: skip


-- ============================================
-- Table: estimates
-- SQL Name: estimates
-- Rows: 2
-- ============================================

CREATE TABLE "estimates" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "customerId" TEXT NOT NULL,
  "estimateCode" TEXT DEFAULT NULL,
  "siteCode" TEXT DEFAULT NULL,
  "status" TEXT DEFAULT NULL,
  "managerId" TEXT DEFAULT NULL,
  "siteManagerId" TEXT DEFAULT NULL,
  "totalAmount" REAL DEFAULT 0,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

INSERT INTO "estimates" ("customerId", "estimateCode", "siteCode", "status", "managerId", "siteManagerId", "totalAmount", "createdAt", "updatedAt") VALUES ('CUST-1772555178796', 'EST-2026-03-03-642', NULL, '상담접수', NULL, NULL, 20000, '2026-03-03T16:26:18.816Z', '2026-03-03 16:37:55');
INSERT INTO "estimates" ("customerId", "estimateCode", "siteCode", "status", "managerId", "siteManagerId", "totalAmount", "createdAt", "updatedAt") VALUES ('CUST-1772555351313', 'EST-2026-03-03-35', NULL, '상담접수', NULL, NULL, 0, '2026-03-03T16:29:11.326Z', '2026-03-03T16:29:11.326Z');

-- Table Metadata:
-- Display Name: estimates
-- Description: Imported from schema.sql
-- Created From: schema.sql
-- Duplicate Action: skip


-- ============================================
-- Table: customers
-- SQL Name: customers
-- Rows: 3
-- ============================================

CREATE TABLE "customers" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "postcode" TEXT DEFAULT NULL,
  "address" TEXT DEFAULT NULL,
  "detailAddress" TEXT DEFAULT NULL,
  "shortAddress" TEXT DEFAULT NULL,
  "size" TEXT DEFAULT NULL,
  "phone1" TEXT DEFAULT NULL,
  "phone2" TEXT DEFAULT NULL,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

INSERT INTO "customers" ("name", "postcode", "address", "detailAddress", "shortAddress", "size", "phone1", "phone2", "createdAt", "updatedAt") VALUES ('차민서', NULL, NULL, '한라비발디캠퍼스, 2406호', NULL, NULL, NULL, NULL, '2026-03-03T16:13:59.081Z', '2026-03-03T16:13:59.081Z');
INSERT INTO "customers" ("name", "postcode", "address", "detailAddress", "shortAddress", "size", "phone1", "phone2", "createdAt", "updatedAt") VALUES ('차민서', NULL, NULL, '한라비발디캠퍼스, 2406호', NULL, NULL, NULL, NULL, '2026-03-03T16:26:18.796Z', '2026-03-03T16:26:18.796Z');
INSERT INTO "customers" ("name", "postcode", "address", "detailAddress", "shortAddress", "size", "phone1", "phone2", "createdAt", "updatedAt") VALUES ('차민서', NULL, NULL, '한라비발디캠퍼스, 2406호', NULL, NULL, NULL, NULL, '2026-03-03T16:29:11.313Z', '2026-03-03T16:29:11.313Z');

-- Table Metadata:
-- Display Name: customers
-- Description: Imported from schema.sql
-- Created From: schema.sql
-- Duplicate Action: skip


-- ============================================
-- Table: vendors
-- SQL Name: vendors
-- Rows: 1
-- ============================================

CREATE TABLE "vendors" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "businessNumber" TEXT DEFAULT NULL,
  "representative" TEXT DEFAULT NULL,
  "phone" TEXT DEFAULT NULL,
  "address" TEXT DEFAULT NULL,
  "bankName" TEXT DEFAULT NULL,
  "accountNumber" TEXT DEFAULT NULL,
  "accountHolder" TEXT DEFAULT NULL,
  "isActive" INTEGER DEFAULT 1,
  "createdAt" TEXT DEFAULT (datetime('now')),
  "updatedAt" TEXT DEFAULT (datetime('now'))
);

INSERT INTO "vendors" ("name", "businessNumber", "representative", "phone", "address", "bankName", "accountNumber", "accountHolder", "isActive", "createdAt", "updatedAt") VALUES ('한샘키친', '12312123456', '대쵸', '010000000000', '주소', '우리', '1111111111111', '대초', 1, NULL, NULL);

-- Table Metadata:
-- Display Name: vendors
-- Description: Imported from schema.sql
-- Created From: schema.sql
-- Duplicate Action: skip

