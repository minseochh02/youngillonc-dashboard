import * as XLSX from 'xlsx';

/**
 * Options for Excel export
 */
export interface ExcelExportOptions {
  sheetName?: string;
  includeHeaders?: boolean;
  columnWidths?: number[];
  formatters?: Record<string, (value: any) => any>;
}

/**
 * Island table structure for daily-status page
 */
export interface IslandTable {
  title: string;
  headers: string[];
  data: any[][];
  includeTotal?: boolean;
}

/**
 * Auto-detect column type based on Korean header
 */
function detectColumnType(header: string): 'number' | 'currency' | 'text' {
  const currencyKeywords = ['금액', '매출', '수금', '잔액', '원'];
  const numberKeywords = ['수량', '중량', 'kg', '톤', '건수', '개', '율'];

  if (currencyKeywords.some(keyword => header.includes(keyword))) {
    return 'currency';
  }

  if (numberKeywords.some(keyword => header.includes(keyword))) {
    return 'number';
  }

  return 'text';
}

/**
 * Format number with thousand separators
 */
export function formatNumberCell(value: any): string | number {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;

  if (isNaN(num)) {
    return value;
  }

  return num;
}

/**
 * Format currency value
 */
export function formatCurrencyCell(value: any): string | number {
  return formatNumberCell(value);
}

/**
 * Apply cell formatting based on column type
 */
function applyCellFormat(ws: XLSX.WorkSheet, cellAddress: string, type: 'number' | 'currency' | 'text') {
  if (!ws[cellAddress]) return;

  if (type === 'number' || type === 'currency') {
    ws[cellAddress].t = 'n'; // number type
    ws[cellAddress].z = '#,##0'; // thousand separator format
  }
}

/**
 * Set column widths in worksheet
 */
function setColumnWidths(ws: XLSX.WorkSheet, widths?: number[]) {
  if (!widths) return;

  ws['!cols'] = widths.map(w => ({ wch: w }));
}

/**
 * Main export function for single-sheet tables
 */
export function exportToExcel(
  data: any[],
  filename: string,
  options: ExcelExportOptions = {}
): void {
  const {
    sheetName = 'Sheet1',
    includeHeaders = true,
    columnWidths,
    formatters = {}
  } = options;

  if (!data || data.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }

  // Extract headers from first row keys
  const headers = Object.keys(data[0]);

  // Detect column types from headers
  const columnTypes = headers.map(header => detectColumnType(header));

  // Convert data to 2D array
  const rows = data.map(row =>
    headers.map((header, index) => {
      let value = row[header];

      // Apply custom formatter if provided
      if (formatters[header]) {
        value = formatters[header](value);
      }

      // Format based on column type
      const type = columnTypes[index];
      if (type === 'number' || type === 'currency') {
        return formatNumberCell(value);
      }

      return value ?? '';
    })
  );

  // Add headers if needed
  const worksheetData = includeHeaders ? [headers, ...rows] : rows;

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Apply formatting to data cells
  if (includeHeaders) {
    rows.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
        applyCellFormat(ws, cellAddress, columnTypes[colIndex]);
      });
    });
  }

  // Set column widths
  if (columnWidths) {
    setColumnWidths(ws, columnWidths);
  } else {
    // Auto-calculate column widths based on content
    const maxWidths = headers.map((header, colIndex) => {
      const headerLength = header.length;
      const maxDataLength = Math.max(
        ...rows.map(row => String(row[colIndex] ?? '').length)
      );
      return Math.max(headerLength, maxDataLength, 10);
    });
    setColumnWidths(ws, maxWidths);
  }

  // Create workbook and add worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate Excel file and trigger download
  XLSX.writeFile(wb, filename);
}

/**
 * Export multiple tables as "island tables" in a single sheet
 * Used for daily-status page
 */
export function exportIslandTables(
  islands: IslandTable[],
  filename: string
): void {
  if (!islands || islands.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }

  const worksheetData: any[][] = [];

  islands.forEach((island, islandIndex) => {
    // Add section title
    if (island.title) {
      worksheetData.push([island.title]);
      worksheetData.push([]); // Blank row after title
    }

    // Add headers
    worksheetData.push(island.headers);

    // Detect column types
    const columnTypes = island.headers.map(header => detectColumnType(header));

    // Add data rows
    island.data.forEach(row => {
      const formattedRow = row.map((cell, colIndex) => {
        const type = columnTypes[colIndex];
        if (type === 'number' || type === 'currency') {
          return formatNumberCell(cell);
        }
        return cell ?? '';
      });
      worksheetData.push(formattedRow);
    });

    // Add total row if specified
    if (island.includeTotal && island.data.length > 0) {
      const totalRow = island.data[island.data.length - 1];
      const formattedTotal = totalRow.map((cell, colIndex) => {
        const type = columnTypes[colIndex];
        if (type === 'number' || type === 'currency') {
          return formatNumberCell(cell);
        }
        return cell ?? '';
      });
      // Total row is already in data, no need to add again
    }

    // Add blank rows between islands (except after last island)
    if (islandIndex < islands.length - 1) {
      worksheetData.push([]);
      worksheetData.push([]);
    }
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Apply formatting to all cells
  let currentRow = 0;
  islands.forEach((island) => {
    // Skip title row and blank row
    if (island.title) {
      currentRow += 2;
    }

    // Skip header row
    currentRow += 1;

    // Detect column types
    const columnTypes = island.headers.map(header => detectColumnType(header));

    // Format data rows
    island.data.forEach(() => {
      island.headers.forEach((_, colIndex) => {
        const cellAddress = XLSX.utils.encode_cell({ r: currentRow, c: colIndex });
        applyCellFormat(ws, cellAddress, columnTypes[colIndex]);
      });
      currentRow += 1;
    });

    // Skip blank rows between islands
    currentRow += 2;
  });

  // Auto-calculate column widths
  const maxCols = Math.max(...islands.map(island => island.headers.length));
  const maxWidths = Array(maxCols).fill(10);

  islands.forEach(island => {
    island.headers.forEach((header, colIndex) => {
      const headerLength = header.length;
      const maxDataLength = Math.max(
        ...island.data.map(row => String(row[colIndex] ?? '').length)
      );
      maxWidths[colIndex] = Math.max(maxWidths[colIndex], headerLength, maxDataLength);
    });
  });

  setColumnWidths(ws, maxWidths);

  // Create workbook and add worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '일일현황');

  // Generate Excel file and trigger download
  XLSX.writeFile(wb, filename);
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(prefix: string, extension: string = 'xlsx'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  return `${prefix}-${year}-${month}-${day}-${hour}${minute}.${extension}`;
}

/**
 * Flatten nested objects for Excel export
 * Useful for sales-inventory and inventory pages
 */
export function flattenObject(obj: any, parentKey: string = ''): Record<string, any> {
  let result: Record<string, any> = {};

  for (const key in obj) {
    const newKey = parentKey ? `${parentKey} ${key}` : key;

    if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      // Recursively flatten nested objects
      Object.assign(result, flattenObject(obj[key], newKey));
    } else {
      result[newKey] = obj[key];
    }
  }

  return result;
}

/**
 * Convert array of objects with nested properties to flat array
 */
export function flattenDataArray(data: any[]): any[] {
  return data.map(item => flattenObject(item));
}
