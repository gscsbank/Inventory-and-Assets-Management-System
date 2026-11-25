// ============================================================
// STATIONERY MODULE — Office Stationery (කාර්යාල ලිපිද්‍රව්‍ය)
// Manager-approval-gated stock issue flow with Supplier Tracking
// ============================================================

const STATIONERY_PIN_KEY = 'GSB_STATIONERY_PIN_V1';
const STATIONERY_ISSUES_KEY = 'GSB_STATIONERY_ISSUES_V1';

// Preset stationery items for quick-add chips (with common bank stationery suppliers)
const STATIONERY_PRESETS = [
  { name: 'A4 Paper (A4 කඩදාසි)', unit: 'Reams', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 5, supplier: 'Atlas Axillia' },
  { name: 'Receipt Book (ලදුපත් පොත)', unit: 'Books', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 2, supplier: 'Security Printing Press' },
  { name: 'Passbook (ගිණුම් පොත / Passbook)', unit: 'Books', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 10, supplier: 'Govt Printing Press' },
  { name: 'Stamp Pad (මුද්‍රා තැටිය)', unit: 'Units', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 1, supplier: 'Samudra Bookshop' },
  { name: 'Ballpoint Pen (බෝල් පෙන්)', unit: 'Units', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 10, supplier: 'Atlas' },
  { name: 'Stapler Pins (ස්ටේප්ලර් ක්ලිප්)', unit: 'Boxes', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 2, supplier: 'Kangaroo' },
  { name: 'File Folder (ගොනු කවර)', unit: 'Units', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 5, supplier: 'Samudra Bookshop' },
  { name: 'Rubber Band (රබර් රේන්ද)', unit: 'Packs', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 1, supplier: 'Local Stationer' },
  { name: 'White-Out (නිවැරදි ද්‍රාවය)', unit: 'Units', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 2, supplier: 'Pentel' },
  { name: 'Printer Toner (ප්‍රින්ටර් තීන්ත)', unit: 'Units', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 1, supplier: 'Nanosoft / HP' },
  { name: 'Envelope (ලියුම් කවර)', unit: 'Packs', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 2, supplier: 'PrintX Pvt Ltd' },
  { name: 'Rubber Stamp (මුද්‍රාව)', unit: 'Units', category: 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග', reorderLevel: 1, supplier: 'Seal & Stamp Works' },
];

// ----- DATA LAYER -----

function loadStationeryData() {
  const stored = localStorage.getItem(STATIONERY_ISSUES_KEY);
  if (stored) {
    try {
      AppState.stationeryIssues = JSON.parse(stored);
    } catch (e) {
      AppState.stationeryIssues = [];
    }
  } else {
    AppState.stationeryIssues = [];
  }
}

function saveStationeryIssues() {
  localStorage.setItem(STATIONERY_ISSUES_KEY, JSON.stringify(AppState.stationeryIssues));
}

function getStationeryManagerPin() {
  return localStorage.getItem(STATIONERY_PIN_KEY) || '1234';
}

function saveStationeryManagerPin() {
  const input = document.getElementById('newManagerPinInput');
  if (!input) return;
  const pin = input.value.trim();
  if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    showToast('PIN must be 4–6 digits (ඉලක්කම් 4–6).', 'danger');
    return;
  }
  localStorage.setItem(STATIONERY_PIN_KEY, pin);
  showToast('Manager PIN updated successfully! 🔐', 'success');
  input.value = '';
  updatePinStatusDisplay();
}

function updatePinStatusDisplay() {
  const el = document.getElementById('currentPinStatus');
  if (el) {
    const pin = getStationeryManagerPin();
    const isDefault = (pin === '1234');
    el.textContent = isDefault ? 'Using default PIN (1234) — please change for security!' : `Custom PIN set (${pin.length} digits)`;
    el.className = isDefault ? 'font-bold text-amber-700' : 'font-bold text-emerald-700';
  }
}

// ----- HELPERS -----

function getStationeryItems() {
  return AppState.items.filter(i =>
    i.category === 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග' || i.type === 'consumable'
  );
}

function getLastIssuedTo(itemId) {
  if (!AppState.stationeryIssues) return '-';
  const record = [...AppState.stationeryIssues]
    .reverse()
    .find(r => r.itemId === itemId);
  return record ? `${record.recipientName} (${record.recipientDept})` : '-';
}

// ----- RENDER -----

function renderStationeryTab() {
  renderStationeryTable();
  renderStationeryIssueLog();
  updatePinStatusDisplay();
}

function renderStationeryPresetChips() {
  const container = document.getElementById('stationeryPresetChips');
  if (!container) return;

  container.innerHTML = STATIONERY_PRESETS.map(preset => `
    <button type="button"
      onclick="openQuickAddStationeryItem(${JSON.stringify(preset).replace(/"/g, '&quot;')})"
      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 transition-all shadow-xs cursor-pointer">
      <i class="fas fa-plus-circle text-purple-500 text-[11px]"></i>
      <span>${escapeHtml(preset.name)}</span>
    </button>
  `).join('');
}

function renderStationeryTable() {
  const items = getStationeryItems();
  const tbody = document.getElementById('stationeryTableBody');
  const countEl = document.getElementById('stationeryItemCount');
  if (countEl) countEl.textContent = `${items.length} items`;
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-12 text-slate-400">
          <i class="fas fa-clipboard-list text-3xl mb-2 block text-purple-200"></i>
          <div class="font-medium">No stationery items found.</div>
          <div class="text-xs mt-1">Use the preset chips above or "Add Stationery Item" to register items.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map((item, idx) => {
    const qty = Number(item.qty) || 0;
    const reorder = Number(item.reorderLevel) || 0;
    const isOut = qty === 0;
    const isLow = reorder > 0 && qty <= reorder && qty > 0;

    const rowClass = isOut
      ? 'bg-rose-50/60 hover:bg-rose-50 border-l-4 border-rose-400'
      : isLow
      ? 'bg-amber-50/60 hover:bg-amber-50 border-l-4 border-amber-400'
      : 'hover:bg-purple-50/30';

    const qtyClass = isOut ? 'text-rose-700 font-black' : isLow ? 'text-amber-700 font-bold' : 'text-slate-800 font-bold';

    const statusBadge = isOut
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800"><i class="fas fa-ban"></i> Out</span>`
      : isLow
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 pulse-alert"><i class="fas fa-exclamation-triangle"></i> Low</span>`
      : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800"><i class="fas fa-check"></i> OK</span>`;

    const lastIssued = getLastIssuedTo(item.id);

    const supplierDisplay = item.supplier
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 max-w-[150px] truncate" title="${escapeHtml(item.supplier)}"><i class="fas fa-truck text-[10px] text-blue-500"></i> ${escapeHtml(item.supplier)}</span>`
      : `<span class="text-xs text-slate-400 italic">නොදක්වා ඇත</span>`;

    return `
      <tr class="transition-all text-sm ${rowClass}">
        <td class="p-3 text-center text-slate-500 font-mono text-xs">${idx + 1}</td>
        <td class="p-3">
          <div class="font-bold text-slate-800">${escapeHtml(item.name)}</div>
          <div class="text-xs text-slate-400 font-mono mt-0.5">${item.barcode} <span class="text-slate-300">|</span> <span class="text-purple-700 font-semibold">${item.department || 'OAD'}</span></div>
        </td>
        <td class="p-3">
          ${supplierDisplay}
        </td>
        <td class="p-3 text-center text-xs text-slate-600 font-medium">${escapeHtml(item.unit || 'Units')}</td>
        <td class="p-3 text-center">
          <span class="${qtyClass} text-base">${qty}</span>
          <div class="mt-0.5">${statusBadge}</div>
        </td>
        <td class="p-3 text-center text-xs text-slate-500 font-semibold">${reorder > 0 ? reorder : '—'}</td>
        <td class="p-3 text-xs text-slate-600 max-w-[160px] truncate" title="${escapeHtml(lastIssued)}">${escapeHtml(lastIssued)}</td>
        <td class="p-3 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="openStationeryIssueModal('${item.id}')" title="Issue Stock (Manager PIN Required)"
              class="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer">
              <i class="fas fa-paper-plane text-[10px]"></i> Issue
            </button>
            <button onclick="openStockInOutModal('${item.id}')" title="Add Stock (IN)"
              class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer">
              <i class="fas fa-plus text-[10px]"></i> Stock
            </button>
            <button onclick="openEditItemModal('${item.id}')" title="Edit Item"
              class="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer">
              <i class="fas fa-edit text-xs"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderStationeryIssueLog() {
  const tbody = document.getElementById('stationeryIssueLogBody');
  if (!tbody) return;
  if (!AppState.stationeryIssues) AppState.stationeryIssues = [];

  const recent = [...AppState.stationeryIssues].reverse().slice(0, 15);

  if (recent.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-slate-400 text-xs">
          <i class="fas fa-history text-2xl mb-2 block text-purple-100"></i>
          No issuances recorded yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = recent.map((rec, idx) => `
    <tr class="hover:bg-purple-50/20 transition-colors">
      <td class="p-3 text-center text-slate-400 font-mono">${idx + 1}</td>
      <td class="p-3 font-mono text-slate-600 text-xs">${rec.date ? rec.date.substring(0, 16).replace('T', ' ') : '—'}</td>
      <td class="p-3 font-semibold text-slate-800">${escapeHtml(rec.itemName || '—')}</td>
      <td class="p-3 text-center font-bold text-purple-800">${rec.qty}</td>
      <td class="p-3 text-slate-700 font-medium">${escapeHtml(rec.recipientName || '—')}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-bold text-[10px] border border-blue-100">${escapeHtml(rec.recipientDept || '—')}</span>
      </td>
      <td class="p-3">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-50 text-purple-900 border border-purple-200 rounded-full font-bold text-[11px]">
          <i class="fas fa-shield-alt text-purple-600 text-[10px]"></i>
          ${escapeHtml(rec.issuedBy || 'Branch Manager')}
        </span>
      </td>
      <td class="p-3 text-slate-500 text-xs">${escapeHtml(rec.purpose || '—')}</td>
    </tr>
  `).join('');
}

// ----- QUICK ADD PRESET -----

function openQuickAddStationeryItem(preset) {
  openAddItemModal();
  setTimeout(() => {
    const nameEl = document.getElementById('itemName');
    const catEl = document.getElementById('itemCategory');
    const typeEl = document.getElementById('itemType');
    const unitEl = document.getElementById('itemUnit');
    const reorderEl = document.getElementById('itemReorder');
    const supplierEl = document.getElementById('itemSupplier');
    if (nameEl) nameEl.value = preset.name;
    if (catEl) catEl.value = 'ලිපිද්‍රව්‍ය හා පරිභෝජන තොග';
    if (typeEl) typeEl.value = 'consumable';
    if (unitEl) unitEl.value = preset.unit || 'Units';
    if (reorderEl) reorderEl.value = preset.reorderLevel || 5;
    if (supplierEl) supplierEl.value = preset.supplier || '';
  }, 50);
}

// ----- ISSUE MODAL -----

function openStationeryIssueModal(itemId = null) {
  // Populate item dropdown
  const itemSel = document.getElementById('stnIssueItemId');
  const deptSel = document.getElementById('stnIssueDept');
  if (!itemSel || !deptSel) return;

  const stnItems = getStationeryItems();
  if (stnItems.length === 0) {
    showToast('No stationery items found. Please add items first!', 'warning');
    return;
  }

  itemSel.innerHTML = stnItems.map(i => {
    const qty = Number(i.qty) || 0;
    return `<option value="${i.id}" ${i.id === itemId ? 'selected' : ''}>${escapeHtml(i.name)} (Stock: ${qty} ${i.unit || ''})</option>`;
  }).join('');

  deptSel.innerHTML = AppState.departments.map(d =>
    `<option value="${d.code}">${d.code} — ${d.name}</option>`
  ).join('');

  // Reset form
  const form = document.getElementById('stationeryIssueForm');
  if (form) {
    document.getElementById('stnIssueRecipient').value = '';
    document.getElementById('stnIssuePurpose').value = '';
    document.getElementById('stnManagerPin').value = '';
    document.getElementById('stnIssueQty').value = 1;
    if (document.getElementById('stnAuthorizedOfficer')) {
      document.getElementById('stnAuthorizedOfficer').value = 'Branch Manager (කළමනාකරු)';
    }
  }
  hideStnPinError();

  if (itemId) itemSel.value = itemId;
  document.getElementById('stationeryIssueModal').classList.remove('hidden');
}

function closeStationeryIssueModal() {
  document.getElementById('stationeryIssueModal').classList.add('hidden');
  hideStnPinError();
}

function hideStnPinError() {
  const errEl = document.getElementById('stnPinError');
  if (errEl) errEl.classList.add('hidden');
}

function showStnPinError(msg) {
  const errEl = document.getElementById('stnPinError');
  const msgEl = document.getElementById('stnPinErrorMsg');
  if (errEl) errEl.classList.remove('hidden');
  if (msgEl) msgEl.textContent = msg || 'Invalid PIN! Access denied.';

  // Shake the modal
  const modal = document.getElementById('stationeryIssueModal');
  if (modal) {
    const inner = modal.querySelector('div');
    if (inner) {
      inner.classList.remove('shake-error');
      void inner.offsetWidth;
      inner.classList.add('shake-error');
    }
  }
}

function confirmStationeryIssue(e) {
  if (e) e.preventDefault();

  const itemId = document.getElementById('stnIssueItemId').value;
  const qty = Number(document.getElementById('stnIssueQty').value) || 0;
  const recipientName = document.getElementById('stnIssueRecipient').value.trim();
  const recipientDept = document.getElementById('stnIssueDept').value;
  const authorizedOfficer = document.getElementById('stnAuthorizedOfficer') ? document.getElementById('stnAuthorizedOfficer').value.trim() : 'Branch Manager (කළමනාකරු)';
  const purpose = document.getElementById('stnIssuePurpose').value.trim();
  const pin = document.getElementById('stnManagerPin').value;

  // Validate PIN
  const correctPin = getStationeryManagerPin();
  if (pin !== correctPin) {
    showStnPinError('Invalid Manager PIN! Stationery issue denied. (වැරදි PIN!)');
    document.getElementById('stnManagerPin').value = '';
    document.getElementById('stnManagerPin').focus();
    playAlertBeep(true);
    return;
  }

  if (qty <= 0) {
    showToast('Please enter a valid quantity.', 'danger');
    return;
  }
  if (!recipientName) {
    showToast('Please enter the recipient name.', 'danger');
    return;
  }

  // Find item and check stock
  const itemIndex = AppState.items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) {
    showToast('Item not found!', 'danger');
    return;
  }
  const item = AppState.items[itemIndex];
  const currentQty = Number(item.qty) || 0;

  if (qty > currentQty) {
    showToast(`Insufficient stock! Current available: ${currentQty} ${item.unit || 'units'}.`, 'danger');
    playAlertBeep(true);
    return;
  }

  // Deduct stock
  AppState.items[itemIndex].qty = currentQty - qty;

  // Record stationery issue
  const now = new Date();
  const issueRecord = {
    id: 'STN-' + Date.now(),
    itemId: item.id,
    itemName: item.name,
    barcode: item.barcode,
    qty,
    recipientName,
    recipientDept,
    purpose,
    issuedBy: authorizedOfficer || 'Branch Manager (කළමනාකරු)',
    date: now.toISOString(),
    authorizedAt: now.toISOString()
  };

  if (!AppState.stationeryIssues) AppState.stationeryIssues = [];
  AppState.stationeryIssues.push(issueRecord);

  // Also record in main transactions for audit log
  const dateStr = now.toISOString().replace('T', ' ').substring(0, 16);
  const tx = {
    id: 'TX-STN-' + Date.now().toString(36).toUpperCase(),
    barcode: item.barcode,
    itemName: item.name,
    type: 'OUT',
    qty,
    date: dateStr,
    recipient: `${recipientName} (${recipientDept})`,
    issuedBy: authorizedOfficer || 'Branch Manager (කළමනාකරු)',
    notes: purpose ? `${purpose} [Authorized by: ${authorizedOfficer}]` : `Stationery issue — Authorized by ${authorizedOfficer}`
  };
  AppState.transactions.unshift(tx);

  // Save all
  saveItems();
  saveTransactions();
  saveStationeryIssues();

  closeStationeryIssueModal();
  showToast(`✅ Stationery issued: ${qty} × ${item.name} → ${recipientName} (${recipientDept})`, 'success');
  renderAll();
  checkLowStockAlerts();

  // Refresh stationery tab if open
  if (AppState.activeTab === 'stationery') {
    renderStationeryTab();
  }
}

// ============================================================
// PATCH switchTab to handle stationery tab
// ============================================================
(function patchSwitchTab() {
  const originalSwitchTab = switchTab;
  window.switchTab = function(tabId) {
    originalSwitchTab(tabId);
    if (tabId === 'stationery') {
      renderStationeryTab();
    }
    if (tabId === 'settings') {
      updatePinStatusDisplay();
    }
  };
})();

// Initialize stationery module when DOM is ready (called after main loadData)
document.addEventListener('DOMContentLoaded', function() {
  // Wait for AppState to be initialized by loadData()
  setTimeout(() => {
    loadStationeryData();
    if (!AppState.stationeryIssues) AppState.stationeryIssues = [];
  }, 100);
});
