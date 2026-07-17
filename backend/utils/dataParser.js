const Papa = require('papaparse');
const XLSX = require('xlsx');

/**
 * Parse uploaded file (CSV or Excel) into array of row objects.
 * Returns { rows, skippedRows, warnings }
 */
function parseFile(buffer, originalName, mimetype) {
  const ext = originalName.split('.').pop().toLowerCase();
  let rawRows = [];
  let skippedRows = 0;
  const warnings = [];

  if (ext === 'csv' || mimetype === 'text/csv') {
    rawRows = parseCSV(buffer, warnings);
  } else if (['xlsx', 'xls'].includes(ext)) {
    rawRows = parseExcel(buffer, warnings);
  } else {
    throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error('The file appears to be empty or contains only headers.');
  }

  // Validate and clean rows
  const headers = Object.keys(rawRows[0]);
  const expectedLen = headers.length;
  const cleanRows = [];

  rawRows.forEach((row, i) => {
    const keys = Object.keys(row);
    // Lenient: if all values are empty/undefined, skip silently
    const values = Object.values(row);
    if (values.every(v => v === null || v === undefined || v === '')) {
      skippedRows++;
      return;
    }
    cleanRows.push(row);
  });

  if (cleanRows.length === 0) {
    throw new Error('No data rows found — file contains only headers or empty rows.');
  }

  return { rows: cleanRows, skippedRows, warnings };
}

function parseCSV(buffer, warnings) {
  let text;
  try {
    text = buffer.toString('utf8');
    // Basic sanity check — does it look like valid text?
    if (text.includes('\0')) throw new Error('Binary content detected');
  } catch (e) {
    try {
      text = buffer.toString('latin1');
      warnings.push('File encoding detected as non-UTF8; converted to UTF-8 automatically.');
    } catch {
      throw new Error('Could not decode file. Please ensure it is a valid CSV.');
    }
  }

  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false, // Keep as strings for our own type detection
    transformHeader: h => (h || '').trim(),
    transform: v => (typeof v === 'string' ? v.trim() : v),
  });

  if (result.errors && result.errors.length > 0) {
    const serious = result.errors.filter(e => e.type === 'Delimiter' || e.type === 'Quotes');
    if (serious.length > 0) warnings.push(`CSV parsing had ${serious.length} format issues; some rows may be incomplete.`);
  }

  return result.data || [];
}

function parseExcel(buffer, warnings) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch (e) {
    throw new Error('Could not read Excel file. It may be corrupted or password-protected.');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel file has no sheets.');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false, // Convert everything to string for uniform processing
  });

  if (workbook.SheetNames.length > 1) {
    warnings.push(`Excel file has ${workbook.SheetNames.length} sheets; using the first sheet ("${sheetName}") only.`);
  }

  return rows;
}

module.exports = { parseFile };
