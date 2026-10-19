/**
 * =========================================================================
 * Galapitiyagama Sanasa Bank - Inventory & Asset Management System
 * Google Apps Script Backend (Code.gs)
 * =========================================================================
 * 
 * INSTRUCTIONS:
 * 1. Open Google Sheets (https://sheets.new)
 * 2. Rename sheet to: "GSCS Bank Inventory Database"
 * 3. In the top menu, go to: Extensions > Apps Script
 * 4. Delete any code in the editor and PASTE THIS ENTIRE FILE
 * 5. Click "Save" (💾 icon)
 * 6. Click "Deploy" > "New deployment"
 * 7. Click the gear icon (⚙️) next to "Select type" and select "Web app"
 * 8. Configuration:
 *    - Description: GSCS Bank Cloud Sync
 *    - Execute as: Me (your email)
 *    - Who has access: Anyone
 * 9. Click "Deploy"
 * 10. Grant permissions if prompted (Click Advanced > Go to Untitled project (unsafe) > Allow)
 * 11. COPY the "Web App URL" (ends with /exec)
 * 12. Paste the URL into the GSCS Bank Inventory System Settings > Google Sheets Cloud Sync!
 * =========================================================================
 */

// Initialize sheets with proper headers if not already created
function getOrCreateSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Items Sheet
  let itemsSheet = ss.getSheetByName('Items');
  if (!itemsSheet) {
    itemsSheet = ss.insertSheet('Items');
    itemsSheet.appendRow([
      'ID', 'Barcode', 'Department', 'Name', 'Category', 'Type',
      'Qty', 'Unit', 'Cost', 'TotalCost', 'AccumulatedDepr',
      'PeriodDepr', 'NetValue', 'PurchaseDate', 'Location',
      'Condition', 'ReorderLevel', 'Notes', 'LastUpdated'
    ]);
    itemsSheet.getRange(1, 1, 1, 19).setFontWeight('bold').setBackground('#02457A').setFontColor('#FFFFFF');
    itemsSheet.setFrozenRows(1);
  }

  // 2. Transactions Sheet
  let transSheet = ss.getSheetByName('Transactions');
  if (!transSheet) {
    transSheet = ss.insertSheet('Transactions');
    transSheet.appendRow([
      'ID', 'ItemId', 'ItemName', 'Barcode', 'Department',
      'Type', 'Qty', 'BalanceAfter', 'Officer', 'Notes', 'Date'
    ]);
    transSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#EA580C').setFontColor('#FFFFFF');
    transSheet.setFrozenRows(1);
  }

  // 3. Departments Sheet
  let deptsSheet = ss.getSheetByName('Departments');
  if (!deptsSheet) {
    deptsSheet = ss.insertSheet('Departments');
    deptsSheet.appendRow(['Code', 'Name']);
    deptsSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#1E293B').setFontColor('#FFFFFF');
    deptsSheet.setFrozenRows(1);
  }

  return { itemsSheet, transSheet, deptsSheet };
}

// GET Handler - Fetch all data or ping status
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'getData';
    
    if (action === 'ping') {
      return createJsonResponse({
        status: 'success',
        message: 'GSCS Bank Cloud API is Online',
        timestamp: new Date().toISOString()
      });
    }

    const { itemsSheet, transSheet, deptsSheet } = getOrCreateSheets();

    // 1. Fetch Items
    const items = readItemsFromSheet(itemsSheet);
    
    // 2. Fetch Transactions
    const transactions = readTransactionsFromSheet(transSheet);

    // 3. Fetch Departments
    const departments = readDepartmentsFromSheet(deptsSheet);

    return createJsonResponse({
      status: 'success',
      items: items,
      transactions: transactions,
      departments: departments,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return createJsonResponse({
      status: 'error',
      message: err.toString()
    });
  }
}

// POST Handler - Save / Sync all data from the frontend
function doPost(e) {
  try {
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      throw new Error('No POST data received');
    }

    const action = data.action || 'syncAll';
    const { itemsSheet, transSheet, deptsSheet } = getOrCreateSheets();

    if (action === 'syncAll') {
      // Sync Items
      if (Array.isArray(data.items)) {
        writeItemsToSheet(itemsSheet, data.items);
      }

      // Sync Transactions
      if (Array.isArray(data.transactions)) {
        writeTransactionsToSheet(transSheet, data.transactions);
      }

      // Sync Departments
      if (Array.isArray(data.departments)) {
        writeDepartmentsToSheet(deptsSheet, data.departments);
      }

      return createJsonResponse({
        status: 'success',
        message: 'All inventory data synced successfully',
        syncedItemsCount: data.items ? data.items.length : 0,
        syncedTransCount: data.transactions ? data.transactions.length : 0,
        timestamp: new Date().toISOString()
      });
    }

    return createJsonResponse({
      status: 'error',
      message: 'Unknown action: ' + action
    });

  } catch (err) {
    return createJsonResponse({
      status: 'error',
      message: err.toString()
    });
  }
}

// --- HELPER FUNCTIONS FOR READING SHEETS ---

function readItemsFromSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  const values = sheet.getRange(2, 1, lastRow - 1, 19).getValues();
  return values.map(row => ({
    id: String(row[0] || ''),
    barcode: String(row[1] || ''),
    department: String(row[2] || ''),
    name: String(row[3] || ''),
    category: String(row[4] || ''),
    type: String(row[5] || 'fixed_asset'),
    qty: Number(row[6]) || 0,
    unit: String(row[7] || 'Units'),
    cost: Number(row[8]) || 0,
    totalCost: Number(row[9]) || 0,
    accumulatedDepr: Number(row[10]) || 0,
    periodDepr: Number(row[11]) || 0,
    netValue: Number(row[12]) || 0,
    purchaseDate: row[13] ? formatSheetDate(row[13]) : '',
    location: String(row[14] || ''),
    condition: String(row[15] || ''),
    reorderLevel: Number(row[16]) || 0,
    notes: String(row[17] || '')
  }));
}

function readTransactionsFromSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  return values.map(row => ({
    id: String(row[0] || ''),
    itemId: String(row[1] || ''),
    itemName: String(row[2] || ''),
    barcode: String(row[3] || ''),
    department: String(row[4] || ''),
    type: String(row[5] || 'in'),
    qty: Number(row[6]) || 0,
    balanceAfter: Number(row[7]) || 0,
    officer: String(row[8] || ''),
    notes: String(row[9] || ''),
    date: row[10] ? formatSheetDate(row[10]) : ''
  }));
}

function readDepartmentsFromSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  return values.map(row => ({
    code: String(row[0] || '').trim(),
    name: String(row[1] || '').trim()
  })).filter(d => d.code && d.name);
}

// --- HELPER FUNCTIONS FOR WRITING SHEETS ---

function writeItemsToSheet(sheet, items) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 19).clearContent();
  }

  if (items.length === 0) return;

  const now = new Date().toISOString();
  const rows = items.map(item => [
    item.id || '',
    item.barcode || '',
    item.department || '',
    item.name || '',
    item.category || '',
    item.type || 'fixed_asset',
    Number(item.qty) || 0,
    item.unit || 'Units',
    Number(item.cost) || 0,
    Number(item.totalCost) || Number(item.cost) || 0,
    Number(item.accumulatedDepr) || 0,
    Number(item.periodDepr) || 0,
    Number(item.netValue) || 0,
    item.purchaseDate || '',
    item.location || '',
    item.condition || '',
    Number(item.reorderLevel) || 0,
    item.notes || '',
    now
  ]);

  sheet.getRange(2, 1, rows.length, 19).setValues(rows);
}

function writeTransactionsToSheet(sheet, transactions) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 11).clearContent();
  }

  if (transactions.length === 0) return;

  const rows = transactions.map(t => [
    t.id || '',
    t.itemId || '',
    t.itemName || '',
    t.barcode || '',
    t.department || '',
    t.type || 'in',
    Number(t.qty) || 0,
    Number(t.balanceAfter) || 0,
    t.officer || '',
    t.notes || '',
    t.date || ''
  ]);

  sheet.getRange(2, 1, rows.length, 11).setValues(rows);
}

function writeDepartmentsToSheet(sheet, departments) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
  }

  if (departments.length === 0) return;

  const rows = departments.map(d => [d.code || '', d.name || '']);
  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
}

function formatSheetDate(val) {
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return String(val);
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
