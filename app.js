/**
 * Galapitiyagama Sanasa Bank - Inventory & Asset Management System
 * Galapitiyagama Thrift & Credit Co-operative Society Ltd
 * Main Application Logic (English UI with Sinhala Asset Support & Robust SmartCoop PDF Parser)
 */

// Application State
const AppState = {
  items: [],
  transactions: [],
  departments: [],
  activeTab: 'dashboard',
  selectedItemsForLabels: new Set(),
  searchTerm: '',
  departmentFilter: 'all',
  categoryFilter: 'all',
  stockStatusFilter: 'all',
  barcodeRollDepartmentFilter: 'all',
  scannerInstance: null,
  isAudioEnabled: true,
  currentModalItem: null
};

// Storage Keys
const STORAGE_KEYS = {
  ITEMS: 'GSB_INVENTORY_ITEMS_V1',
  TRANSACTIONS: 'GSB_INVENTORY_TRANSACTIONS_V1',
  SETTINGS: 'GSB_INVENTORY_SETTINGS_V1',
  DEPARTMENTS: 'GCSC_DEPARTMENTS_V1',
  GAS_URL: 'GSB_GAS_WEB_APP_URL_V1',
  LAST_CLOUD_SYNC: 'GSB_LAST_CLOUD_SYNC_V1'
};

// Default Departments (6 Official Divisions)
const DEFAULT_DEPARTMENTS = [
  { code: 'OAD', name: 'Operations and Administration Division' },
  { code: 'FMD', name: 'Finance and Management Division' },
  { code: 'CSD', name: 'Customer Service Division' },
  { code: 'LID', name: 'Loan Issuance Division' },
  { code: 'LRP', name: 'Loan Recovery, Promotion, Welfare, and Technical Division' },
  { code: 'FLD', name: 'Field Division' }
];

// --- AUTHENTICATION & LOGIN (admin / admin123) ---
const AUTH_KEY = 'GSB_AUTH_SESSION_V1';

function checkAuth() {
  const session = localStorage.getItem(AUTH_KEY);
  const overlay = document.getElementById('loginScreenOverlay');
  if (!overlay) return true;

  if (session) {
    try {
      const user = JSON.parse(session);
      if (user && user.username === 'admin') {
        overlay.classList.add('hidden');
        return true;
      }
    } catch (e) {
      localStorage.removeItem(AUTH_KEY);
    }
  }

  // Not authenticated: display login screen
  overlay.classList.remove('hidden');
  const userField = document.getElementById('loginUsername');
  if (userField) setTimeout(() => userField.focus(), 150);
  return false;
}

function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const userField = document.getElementById('loginUsername');
  const passField = document.getElementById('loginPassword');
  const errorBox = document.getElementById('loginErrorMsg');
  const errorText = document.getElementById('loginErrorText');
  const loginCard = document.getElementById('loginCard');

  const username = userField ? userField.value.trim() : '';
  const password = passField ? passField.value : '';

  if (username === 'admin' && password === 'admin123') {
    // Correct credentials
    if (errorBox) errorBox.classList.add('hidden');
    const sessionData = {
      username: 'admin',
      role: 'Administrator',
      name: 'Admin',
      loginAt: new Date().toISOString()
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(sessionData));

    // Smooth fade out
    const overlay = document.getElementById('loginScreenOverlay');
    if (overlay) {
      overlay.classList.add('opacity-0');
      overlay.style.transition = 'opacity 0.25s ease-out';
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('opacity-0');
        overlay.style.transition = '';
      }, 250);
    }

    if (passField) passField.value = '';
    showToast('සාදරයෙන් පිළිගනිමු! (Welcome back, Admin)', 'success');
  } else {
    // Incorrect credentials
    if (errorBox) {
      errorBox.classList.remove('hidden');
      if (errorText) {
        errorText.textContent = 'වැරදි පරිශීලක නාමයක් හෝ මුරපදයක්! (Invalid username or password)';
      }
    }
    if (loginCard) {
      loginCard.classList.remove('shake-error');
      void loginCard.offsetWidth; // Force CSS reflow to re-trigger shake
      loginCard.classList.add('shake-error');
    }
    if (passField) {
      passField.value = '';
      passField.focus();
    }
  }
}

function handleLogout() {
  if (confirm('ඔබට පද්ධතියෙන් ඉවත් වීමට (Log Out) අවශ්‍යද?')) {
    localStorage.removeItem(AUTH_KEY);
    const overlay = document.getElementById('loginScreenOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      const userField = document.getElementById('loginUsername');
      const passField = document.getElementById('loginPassword');
      const errorBox = document.getElementById('loginErrorMsg');
      if (userField) userField.value = '';
      if (passField) passField.value = '';
      if (errorBox) errorBox.classList.add('hidden');
      if (userField) userField.focus();
    }
    showToast('පද්ධතියෙන් ඉවත් විය (Logged out successfully)', 'info');
  }
}

function togglePasswordVisibility() {
  const passField = document.getElementById('loginPassword');
  const icon = document.getElementById('passwordToggleIcon');
  if (!passField || !icon) return;
  if (passField.type === 'password') {
    passField.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    passField.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadData();
  setupEventListeners();
  renderAll();
  initCloudSync();
  checkLowStockAlerts(true);
});

// Load data from LocalStorage or seed with INITIAL_BANK_ITEMS
function loadData() {
  const storedItems = localStorage.getItem(STORAGE_KEYS.ITEMS);
  if (storedItems) {
    try {
      AppState.items = JSON.parse(storedItems);
    } catch (e) {
      console.error('Failed to parse stored items, using initial dataset', e);
      AppState.items = [...INITIAL_BANK_ITEMS];
    }
  } else {
    AppState.items = [...INITIAL_BANK_ITEMS];
    saveItems();
  }

  const storedTransactions = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  if (storedTransactions) {
    try {
      AppState.transactions = JSON.parse(storedTransactions);
    } catch (e) {
      AppState.transactions = [...INITIAL_TRANSACTIONS];
    }
  } else {
    AppState.transactions = [...INITIAL_TRANSACTIONS];
    saveTransactions();
  }

  // Load departments
  const storedDepts = localStorage.getItem(STORAGE_KEYS.DEPARTMENTS);
  if (storedDepts) {
    try {
      AppState.departments = JSON.parse(storedDepts);
      if (!AppState.departments.some(d => d.code === 'OAD')) {
        AppState.departments = [...DEFAULT_DEPARTMENTS];
        saveDepartments();
      } else {
        // Migrate: inject any new default departments that don't exist yet
        let changed = false;
        DEFAULT_DEPARTMENTS.forEach(def => {
          if (!AppState.departments.some(d => d.code === def.code)) {
            AppState.departments.push(def);
            changed = true;
          }
        });
        if (changed) saveDepartments();
      }
    } catch (e) {
      AppState.departments = [...DEFAULT_DEPARTMENTS];
      saveDepartments();
    }
  } else {
    AppState.departments = [...DEFAULT_DEPARTMENTS];
    saveDepartments();
  }

  // Ensure every item has a division/department assigned AND barcode is in GCSC format
  let needsSave = false;
  AppState.items.forEach(item => {
    // 1. Division assignment
    if (!item.department) {
      if (item.barcode && item.barcode.startsWith('GCSC/')) {
        item.department = extractDeptFromBarcode(item.barcode);
      } else if (item.location && item.location.includes('කවුන්ටර')) {
        item.department = 'CSD';
      } else if (item.category && item.category.includes('ණය')) {
        item.department = 'LID';
      } else {
        item.department = 'OAD';
      }
      needsSave = true;
    }

    // 2. Barcode auto-migration from GSB to GCSC/{DEPT}/{seq}
    if (item.barcode && (item.barcode.startsWith('GSB') || !item.barcode.startsWith('GCSC/'))) {
      const dept = item.department || 'OAD';
      const numMatch = item.barcode.match(/\d+$/);
      const seq = numMatch ? String(parseInt(numMatch[0])).padStart(4, '0') : '0001';
      item.barcode = `GCSC/${dept}/${seq}`;
      needsSave = true;
    }
  });
  if (needsSave) saveItems();
}

function saveItems(syncCloud = true) {
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(AppState.items));
  if (syncCloud) triggerAutoCloudSync();
}

function saveTransactions(syncCloud = true) {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(AppState.transactions));
  if (syncCloud) triggerAutoCloudSync();
}

function saveDepartments(syncCloud = true) {
  localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(AppState.departments));
  if (syncCloud) triggerAutoCloudSync();
}

// --- GOOGLE APPS SCRIPT / GOOGLE SHEETS CLOUD SYNC ---
// Backend Google Apps Script Web App Endpoint (Directly embedded)
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbz69DcZ0KzAvX8wPwv3cT2McnVv55d2K4AEaqd2LYCi3LUqs1fXa9-5gnoBAxeouLSB/exec';
let cloudSyncTimeout = null;

function getGasWebAppUrl() {
  return GAS_WEB_APP_URL;
}

function updateCloudSyncUI(status, message = '') {
  AppState.cloudSyncStatus = status;

  // Header pill badge
  const headerBadge = document.getElementById('cloudSyncHeaderBadge');
  const headerIcon = document.getElementById('cloudSyncHeaderIcon');
  const headerText = document.getElementById('cloudSyncHeaderText');

  if (headerBadge) {
    if (status === 'synced') {
      headerBadge.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-300 rounded-xl text-[11px] font-bold text-emerald-800 cursor-pointer shadow-xs transition-all';
      if (headerIcon) headerIcon.className = 'fas fa-cloud text-emerald-600';
      if (headerText) headerText.textContent = 'Sheets Synced';
    } else if (status === 'syncing') {
      headerBadge.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-xl text-[11px] font-bold text-amber-800 cursor-pointer shadow-xs transition-all';
      if (headerIcon) headerIcon.className = 'fas fa-sync fa-spin text-amber-600';
      if (headerText) headerText.textContent = 'Syncing...';
    } else if (status === 'error') {
      headerBadge.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-800 cursor-pointer shadow-xs transition-all';
      if (headerIcon) headerIcon.className = 'fas fa-exclamation-triangle text-rose-600';
      if (headerText) headerText.textContent = 'Sync Error';
    } else {
      headerBadge.className = 'hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-300 rounded-xl text-[11px] font-bold text-emerald-800 cursor-pointer shadow-xs transition-all';
      if (headerIcon) headerIcon.className = 'fas fa-cloud text-emerald-600';
      if (headerText) headerText.textContent = 'Sheets Connected';
    }
  }

  // Settings tab status box
  const settingsStatusEl = document.getElementById('gasSyncStatusInfo');
  if (settingsStatusEl) {
    const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_CLOUD_SYNC);
    const lastSyncStr = lastSync ? new Date(lastSync).toLocaleTimeString() : 'Pending sync';
    if (status === 'synced') {
      settingsStatusEl.innerHTML = `<span class="inline-flex items-center gap-1.5 text-emerald-700 font-bold"><i class="fas fa-check-circle"></i> Connected &amp; Synced with Google Sheets Cloud Database (Last: ${lastSyncStr})</span>`;
    } else if (status === 'syncing') {
      settingsStatusEl.innerHTML = `<span class="inline-flex items-center gap-1.5 text-amber-700 font-bold"><i class="fas fa-spinner fa-spin"></i> Syncing with Google Sheets Cloud Database...</span>`;
    } else if (status === 'error') {
      settingsStatusEl.innerHTML = `<span class="inline-flex items-center gap-1.5 text-rose-700 font-bold"><i class="fas fa-exclamation-triangle"></i> Status: Connecting / Retrying (${escapeHtml(message || 'Checking connection')})</span>`;
    } else {
      settingsStatusEl.innerHTML = `<span class="text-emerald-700 font-bold inline-flex items-center gap-1.5"><i class="fas fa-check-circle"></i> Google Sheets Cloud Backend Active &amp; Connected</span>`;
    }
  }
}

// Fetch all data from Google Sheets (Pull)
async function syncFromCloud(silent = false) {
  const url = getGasWebAppUrl();
  if (!url) {
    if (!silent) showToast('Please enter and save your Google Apps Script URL first!', 'warning');
    updateCloudSyncUI('offline');
    return;
  }

  try {
    updateCloudSyncUI('syncing');
    const resp = await fetch(`${url}?action=getData&_t=${Date.now()}`);
    const data = await resp.json();

    if (data && data.status === 'success') {
      if (Array.isArray(data.items) && data.items.length > 0) {
        AppState.items = data.items;
        saveItems(false);
      }
      if (Array.isArray(data.transactions) && data.transactions.length > 0) {
        AppState.transactions = data.transactions;
        saveTransactions(false);
      }
      if (Array.isArray(data.departments) && data.departments.length > 0) {
        AppState.departments = data.departments;
        saveDepartments(false);
      }

      localStorage.setItem(STORAGE_KEYS.LAST_CLOUD_SYNC, new Date().toISOString());
      updateCloudSyncUI('synced');
      renderAll();

      if (!silent) {
        showToast(`Google Sheets වෙතින් දත්ත ${data.items ? data.items.length : 0}ක් සාර්ථකව Sync කරන ලදී!`, 'success');
      }
    } else {
      throw new Error(data ? data.message : 'Invalid response from Google Sheets');
    }
  } catch (err) {
    console.warn('Cloud Pull Error:', err);
    updateCloudSyncUI('error', err.message);
    if (!silent) showToast(`Cloud sync failed: ${err.message}`, 'danger');
  }
}

// Push all current data to Google Sheets (Push)
async function syncToCloud(silent = false) {
  const url = getGasWebAppUrl();
  if (!url) {
    updateCloudSyncUI('offline');
    return;
  }

  try {
    updateCloudSyncUI('syncing');
    const payload = {
      action: 'syncAll',
      items: AppState.items,
      transactions: AppState.transactions,
      departments: AppState.departments,
      updatedAt: new Date().toISOString()
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const result = await resp.json();
    if (result && result.status === 'success') {
      localStorage.setItem(STORAGE_KEYS.LAST_CLOUD_SYNC, new Date().toISOString());
      updateCloudSyncUI('synced');
      if (!silent) {
        showToast('Google Sheets වෙත දත්ත සාර්ථකව Upload කරන ලදී!', 'success');
      }
    } else {
      throw new Error(result ? result.message : 'Unknown sync response');
    }
  } catch (err) {
    console.warn('Cloud Push Error:', err);
    updateCloudSyncUI('error', err.message);
    if (!silent) showToast(`Cloud upload failed: ${err.message}`, 'danger');
  }
}

// Debounced background sync trigger
function triggerAutoCloudSync() {
  const url = getGasWebAppUrl();
  if (!url) return;
  if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
  cloudSyncTimeout = setTimeout(() => {
    syncToCloud(true);
  }, 2000);
}

function saveGasUrl() {
  const input = document.getElementById('gasWebAppUrlInput');
  if (!input) return;
  const rawUrl = input.value.trim();
  if (!rawUrl) {
    localStorage.removeItem(STORAGE_KEYS.GAS_URL);
    updateCloudSyncUI('offline');
    showToast('Google Apps Script URL ඉවත් කරන ලදී (Local Only Mode)', 'info');
    return;
  }

  if (!rawUrl.startsWith('https://script.google.com/macros/s/') || !rawUrl.endsWith('/exec')) {
    if (!confirm('The URL does not end with "/exec". Make sure this is a Google Apps Script Web App Deployment URL. Save anyway?')) {
      return;
    }
  }

  localStorage.setItem(STORAGE_KEYS.GAS_URL, rawUrl);
  showToast('Google Apps Script URL saved! Connecting...', 'info');
  syncToCloud(false);
}

function initCloudSync() {
  const url = getGasWebAppUrl();
  if (url) {
    updateCloudSyncUI('syncing');
    syncFromCloud(true);
  }
}

// Get department code from name or find by code
function getDeptCode(deptName) {
  if (!deptName) return 'OAD';
  const d = AppState.departments.find(dep =>
    dep.name.toLowerCase() === deptName.toLowerCase() ||
    dep.code.toLowerCase() === deptName.toLowerCase()
  );
  return d ? d.code : deptName.substring(0, 3).toUpperCase().replace(/\s+/g, '');
}

// Canonical department getter for any item (prioritizes item.department, then extracts from barcode)
function getItemDepartment(item) {
  if (!item) return 'OAD';
  if (item.department) return item.department;
  if (item.barcode) return extractDeptFromBarcode(item.barcode);
  return 'OAD';
}

// Generate GCSC barcode: GCSC/DEPT/0001 (Auto-recycles deleted/vacant numbers)
function generateGcscBarcode(deptCode, excludeItemId = null) {
  const dept = deptCode || 'OAD';
  const prefix = `GCSC/${dept}/`;

  // Collect all currently assigned numbers for this department
  const usedNumbers = new Set();
  AppState.items.forEach(item => {
    if (excludeItemId && item.id === excludeItemId) return;
    if (item.barcode && item.barcode.startsWith(prefix)) {
      const numPart = parseInt(item.barcode.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > 0) {
        usedNumbers.add(numPart);
      }
    }
  });

  // Find the lowest available sequence number starting from 1 (reuses any deleted numbers)
  let nextSeq = 1;
  while (usedNumbers.has(nextSeq)) {
    nextSeq++;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// --- TAB NAVIGATION ---
function switchTab(tabId) {
  AppState.activeTab = tabId;
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
  const activePane = document.getElementById(`tab-${tabId}`);
  if (activePane) activePane.classList.remove('hidden');

  // Update navigation styling (supporting both macOS dock icons and standard nav buttons)
  document.querySelectorAll('.nav-btn, .macos-dock-icon').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active-tab', 'bg-slate-900', 'text-white', 'shadow-sm');
      btn.classList.remove('text-slate-500', 'hover:bg-slate-100', 'text-blue-100', 'hover:bg-blue-800/60');
    } else {
      btn.classList.remove('active-tab', 'bg-slate-900', 'text-white', 'shadow-sm', 'bg-blue-800');
      btn.classList.add('text-slate-500', 'hover:bg-slate-100');
    }
  });

  // Tab specific refreshes
  if (tabId === 'dashboard') renderDashboard();
  if (tabId === 'items') {
    populateDivisionFilter();
    renderItemsTable();
  }
  if (tabId === 'barcode') {
    populateDivisionFilter();
    renderBarcodeCenter();
  }
  if (tabId === 'scanner') startScannerTab();
  else stopScanner();
  if (tabId === 'reports') renderReportsView();
  if (tabId === 'transactions') renderTransactionsTable();
  if (tabId === 'lowstock') renderLowStockView();
  if (tabId === 'settings') renderDepartmentList();
}

// --- SOUND NOTIFICATION (Synthesized Web Audio API) ---
function playAlertBeep(isUrgent = false) {
  if (!AppState.isAudioEnabled) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (isUrgent) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.15); // A4
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    }
  } catch (err) {
    // Audio might require user interaction first
  }
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-600 text-white' :
                  type === 'danger' ? 'bg-rose-600 text-white' :
                  type === 'warning' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-white';
  
  const icon = type === 'success' ? 'fa-check-circle' :
               type === 'danger' ? 'fa-exclamation-triangle' :
               type === 'warning' ? 'fa-bell' : 'fa-info-circle';

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${bgClass} transform transition-all duration-300 translate-y-2 opacity-0 text-sm font-medium z-50`;
  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- LOW STOCK ALERT CHECKS ---
function getLowStockItems() {
  return AppState.items.filter(item => {
    const qty = Number(item.qty) || 0;
    const reorder = Number(item.reorderLevel) || 0;
    return (reorder > 0 && qty <= reorder) || qty === 0;
  });
}

function checkLowStockAlerts(isInitial = false) {
  const lowItems = getLowStockItems();
  const alertBadge = document.getElementById('lowStockCountBadge');
  const alertDot = document.getElementById('navLowStockBadge');
  
  if (alertBadge) {
    if (lowItems.length > 0) {
      alertBadge.textContent = lowItems.length;
      alertBadge.classList.remove('hidden');
      if (alertDot) alertDot.classList.remove('hidden');
      if (!isInitial) playAlertBeep(true);
    } else {
      alertBadge.classList.add('hidden');
      if (alertDot) alertDot.classList.add('hidden');
    }
  }
}

// --- SMOOTH ROLLING NUMBER ANIMATOR ---
function animateNumberCounter(elementId, targetValue, isCurrency = false, duration = 650) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = 0;
  const startTime = performance.now();

  function updateCount(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Smooth easeOutCubic curve for Apple-like smoothness
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentVal = start + (targetValue - start) * easeProgress;

    if (isCurrency) {
      el.textContent = 'Rs. ' + currentVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      el.textContent = Math.round(currentVal).toLocaleString('en-US');
    }

    if (progress < 1) {
      requestAnimationFrame(updateCount);
    }
  }

  requestAnimationFrame(updateCount);
}

// --- DASHBOARD RENDERING (Modern UI inspired by Image 3) ---
function renderDashboard() {
  const totalItemsCount = AppState.items.length;
  const totalQuantity = AppState.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const totalCost = AppState.items.reduce((sum, item) => sum + ((Number(item.cost) || 0) * (Number(item.qty) || 1)), 0);
  const totalNetValue = AppState.items.reduce((sum, item) => sum + (Number(item.netValue) || ((Number(item.cost) || 0) * (Number(item.qty) || 1)) || 0), 0);
  const lowStockCount = getLowStockItems().length;

  // Smooth Rolling Number Counters
  animateNumberCounter('statTotalItems', totalItemsCount, false);
  animateNumberCounter('statTotalQty', totalQuantity, false);
  animateNumberCounter('statNetValue', totalNetValue, true);

  const totalCostEl = document.getElementById('statTotalCost');
  if (totalCostEl) totalCostEl.textContent = 'Rs. ' + totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const lowStockEl = document.getElementById('statLowStock');
  if (lowStockEl) lowStockEl.textContent = lowStockCount.toLocaleString('en-US');

  // Categories Count
  const uniqueCats = new Set(AppState.items.map(i => i.category).filter(Boolean));
  const catCountBadge = document.getElementById('statCategoriesCount');
  if (catCountBadge) catCountBadge.textContent = `${uniqueCats.size || 4} Categories`;

  // 1. Division Allocation Bars (Patterned Hatched Bars like Image)
  const divBarsContainer = document.getElementById('topMacosDivisionBars');
  const divLabelsContainer = document.getElementById('topMacosDivisionLabels');
  if (divBarsContainer && divLabelsContainer) {
    const deptData = AppState.departments.map(d => {
      const deptItems = AppState.items.filter(i => getItemDepartment(i) === d.code);
      const count = deptItems.length;
      const deptVal = deptItems.reduce((sum, i) => sum + (Number(i.netValue) || 0), 0);
      return { code: d.code, name: d.name, count, value: deptVal };
    });

    const maxCount = Math.max(...deptData.map(d => d.count), 1);

    divBarsContainer.innerHTML = deptData.map(d => {
      const heightPct = Math.max(Math.round((d.count / maxCount) * 100), 14);
      const isHighlighted = d.code === 'OAD';

      return `
        <div class="flex flex-col items-center flex-1 h-full justify-end group cursor-pointer relative" onclick="selectDivisionFilter('${d.code}'); switchTab('items');" title="${d.code} (${d.name}): ${d.count} Assets">
          ${isHighlighted ? `
            <div class="absolute -top-7 bg-[#18181b] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md whitespace-nowrap z-10 flex items-center gap-1 animate-pulse">
              <span>${d.code}: ${d.count} Assets</span>
            </div>
          ` : ''}
          <div class="w-8 sm:w-12 animated-bar flex flex-col justify-end transition-all duration-500 rounded-t-lg overflow-hidden group-hover:opacity-90 shadow-xs" style="height: ${heightPct}%;">
            <!-- Patterned Hatched Upper Segment -->
            <div class="h-6 w-full ${isHighlighted ? 'bar-hatched-orange' : 'bar-hatched-pattern'}"></div>
            <!-- Solid Lower Segment -->
            <div class="flex-1 w-full ${isHighlighted ? 'bg-[#ff4b26]' : 'bg-[#18181b]'}"></div>
          </div>
        </div>
      `;
    }).join('');

    divLabelsContainer.innerHTML = deptData.map(d => `
      <div class="flex-1 cursor-pointer hover:text-slate-900 transition-colors" onclick="selectDivisionFilter('${d.code}'); switchTab('items');">
        <span>${d.code}</span>
      </div>
    `).join('');
  }

  // 2. Division Share (Right bottom vertical bars matching image)
  const shareBarsContainer = document.getElementById('divisionShareBars');
  const shareLabelsContainer = document.getElementById('divisionShareLabels');
  if (shareBarsContainer && shareLabelsContainer) {
    const deptData = AppState.departments.map(d => {
      const count = AppState.items.filter(i => getItemDepartment(i) === d.code).length;
      const pct = totalItemsCount > 0 ? Math.round((count / totalItemsCount) * 100) : 0;
      return { code: d.code, count, pct };
    });

    shareBarsContainer.innerHTML = deptData.map(d => {
      const hPct = Math.max(d.pct, 8);
      return `
        <div class="flex flex-col items-center flex-1 h-full justify-end group cursor-pointer" onclick="selectDivisionFilter('${d.code}'); switchTab('items');" title="${d.code}: ${d.pct}%">
          <span class="text-[10px] font-bold text-slate-700 mb-1 font-mono">${d.pct}%</span>
          <div class="w-6 sm:w-8 animated-bar bg-[#18181b] hover:bg-[#ff4b26] rounded-t-md transition-all duration-300 shadow-xs" style="height: ${hPct}%;"></div>
        </div>
      `;
    }).join('');

    shareLabelsContainer.innerHTML = deptData.map(d => `
      <div class="flex-1 text-center font-bold text-slate-500 hover:text-slate-900 cursor-pointer" onclick="selectDivisionFilter('${d.code}'); switchTab('items');">
        <span>${d.code}</span>
      </div>
    `).join('');
  }

  // 3. Orange Card Badges (OAD vs Other Divisions)
  const oadCount = AppState.items.filter(i => getItemDepartment(i) === 'OAD').length;
  const oadPct = totalItemsCount > 0 ? Math.round((oadCount / totalItemsCount) * 100) : 94;
  const oadBadge = document.getElementById('dashOadPctBadge');
  if (oadBadge) oadBadge.textContent = `${oadPct}%`;
  const otherBadge = document.getElementById('dashOtherPctBadge');
  if (otherBadge) otherBadge.textContent = `${100 - oadPct}%`;

  // 4. Product Sales / Recent Assets Table (6 Columns matching header)
  const recentTable = document.getElementById('dashboardRecentAssetsTable');
  if (recentTable) {
    const recents = AppState.items.slice(0, 6);
    if (recents.length === 0) {
      recentTable.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">No assets registered yet.</td></tr>`;
    } else {
      recentTable.innerHTML = recents.map(item => {
        const qty = Number(item.qty) || 0;
        const cost = Number(item.cost) || 0;
        const net = Number(item.netValue) || (cost * qty) || 0;
        const dept = getItemDepartment(item);
        return `
          <tr class="smart-table-row hover:bg-slate-50/80 transition-all">
            <td class="py-2.5 px-3">
              <div class="font-bold text-slate-800 text-xs">${escapeHtml(item.name)}</div>
              <div class="font-mono text-[11px] text-blue-700">${item.barcode} <span class="text-slate-400 ml-1">(${dept})</span></div>
            </td>
            <td class="py-2.5 px-3 text-center font-bold text-slate-800">
              ${qty} <span class="text-[10px] text-slate-400 font-normal">${item.unit || 'Units'}</span>
            </td>
            <td class="py-2.5 px-3 text-right font-mono text-slate-600 text-xs">
              Rs. ${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td class="py-2.5 px-3 text-center">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${qty > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                ${qty > 0 ? 'In Stock' : 'Low Stock'}
              </span>
            </td>
            <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900 text-xs">
              Rs. ${net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td class="py-2.5 px-3 text-center">
              <button onclick="viewItemBarcodeModal('${item.id}')" title="Print Barcode Label" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors">
                <i class="fas fa-barcode mr-1 text-slate-500"></i> Label
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

function getCategoryEnglishName(cat) {
  if (cat.includes('ගොඩනැගිලි')) return 'Buildings (ගොඩනැගිලි)';
  if (cat.includes('නාම')) return 'Nameboards (නාම පුවරු)';
  if (cat.includes('කාර්යාල')) return 'Office Equipment (කාර්යාල උපකරණ)';
  if (cat.includes('ලිපිද්‍රව්‍ය')) return 'Stationery & Consumables (ලිපිද්‍රව්‍ය)';
  if (cat.includes('ඉලෙක්ට්‍රොනික')) return 'IT & Electronics';
  return cat;
}

function getCategoryIcon(cat) {
  if (cat.includes('ගොඩනැගිලි')) return 'fa-building';
  if (cat.includes('නාම')) return 'fa-sign-hanging';
  if (cat.includes('කාර්යාල')) return 'fa-chair';
  if (cat.includes('ලිපිද්‍රව්‍ය')) return 'fa-file-invoice';
  if (cat.includes('ඉලෙක්ට්‍රොනික')) return 'fa-laptop';
  return 'fa-box';
}

// --- ITEMS DIRECTORY & TABLE ---
function filterItems() {
  const search = AppState.searchTerm.toLowerCase().trim();
  const category = AppState.categoryFilter;
  const status = AppState.stockStatusFilter;
  const department = AppState.departmentFilter || 'all';

  return AppState.items.filter(item => {
    const itemDept = getItemDepartment(item);

    const matchSearch = !search || 
      item.name.toLowerCase().includes(search) || 
      item.barcode.toLowerCase().includes(search) || 
      (item.department && item.department.toLowerCase().includes(search)) ||
      (item.location && item.location.toLowerCase().includes(search)) ||
      (item.notes && item.notes.toLowerCase().includes(search));

    const matchCategory = category === 'all' || item.category === category;
    const matchDepartment = department === 'all' || itemDept === department;

    let matchStatus = true;
    const qty = Number(item.qty) || 0;
    const reorder = Number(item.reorderLevel) || 0;
    if (status === 'out') matchStatus = qty === 0;
    else if (status === 'low') matchStatus = reorder > 0 && qty <= reorder && qty > 0;
    else if (status === 'ok') matchStatus = qty > reorder;

    return matchSearch && matchCategory && matchDepartment && matchStatus;
  });
}

function populateDivisionFilter() {
  const sel = document.getElementById('divisionFilterSelect');
  const currentVal = AppState.departmentFilter || 'all';
  if (sel) {
    sel.innerHTML = `<option value="all">🏢 All Divisions (සියලු අංශ - ${AppState.items.length})</option>` +
      AppState.departments.map(d => {
        const count = AppState.items.filter(i => getItemDepartment(i) === d.code).length;
        return `<option value="${d.code}" ${d.code === currentVal ? 'selected' : ''}>${d.code} — ${d.name} (${count})</option>`;
      }).join('');
  }

  // Also populate Tab 3 rollDivisionSelect
  const rollSel = document.getElementById('rollDivisionSelect');
  if (rollSel) {
    const rollCurrent = AppState.barcodeRollDepartmentFilter || 'all';
    rollSel.innerHTML = `<option value="all">සියලු අංශ (All Divisions)</option>` +
      AppState.departments.map(d => {
        const count = AppState.items.filter(i => getItemDepartment(i) === d.code).length;
        return `<option value="${d.code}" ${d.code === rollCurrent ? 'selected' : ''}>${d.code} (${count} items)</option>`;
      }).join('');
  }

  renderDivisionPills();
}

// Helper: count items in a specific dept, applying search/category/status filters but NOT dept filter
function countItemsForDivision(deptCode) {
  const search = AppState.searchTerm.toLowerCase().trim();
  const category = AppState.categoryFilter;
  const status = AppState.stockStatusFilter;

  return AppState.items.filter(item => {
    if (getItemDepartment(item) !== deptCode) return false;

    const matchSearch = !search ||
      item.name.toLowerCase().includes(search) ||
      item.barcode.toLowerCase().includes(search) ||
      (item.department && item.department.toLowerCase().includes(search)) ||
      (item.location && item.location.toLowerCase().includes(search)) ||
      (item.notes && item.notes.toLowerCase().includes(search));

    const matchCategory = category === 'all' || item.category === category;

    let matchStatus = true;
    const qty = Number(item.qty) || 0;
    const reorder = Number(item.reorderLevel) || 0;
    if (status === 'out') matchStatus = qty === 0;
    else if (status === 'low') matchStatus = reorder > 0 && qty <= reorder && qty > 0;
    else if (status === 'ok') matchStatus = qty > reorder;

    return matchSearch && matchCategory && matchStatus;
  }).length;
}

function renderDivisionPills() {
  const container = document.getElementById('divisionPillsBar');
  if (!container) return;

  const current = AppState.departmentFilter || 'all';
  const badge = document.getElementById('activeDivisionBadge');

  if (badge) {
    if (current === 'all') {
      badge.textContent = `All Divisions (සියල්ල - ${AppState.items.length})`;
      badge.className = "text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200";
    } else {
      const d = AppState.departments.find(dep => dep.code === current);
      const count = countItemsForDivision(current);
      badge.textContent = `${current}: ${d ? d.name : current} (${count})`;
      badge.className = "text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300";
    }
  }

  let html = `
    <button onclick="selectDivisionFilter('all')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${current === 'all' ? 'bg-blue-700 text-white shadow-sm ring-2 ring-blue-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}">
      <span>🏢 All</span>
      <span class="text-[10px] px-1.5 py-0.2 rounded-full ${current === 'all' ? 'bg-blue-900/60 text-white' : 'bg-slate-200 text-slate-600'}">${AppState.items.length}</span>
    </button>
  `;

  AppState.departments.forEach(d => {
    const count = countItemsForDivision(d.code);
    const isActive = current === d.code;
    html += `
      <button onclick="selectDivisionFilter('${d.code}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isActive ? 'bg-blue-700 text-white shadow-sm ring-2 ring-blue-400' : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-800 text-slate-700 border border-slate-200'}">
        <span class="font-mono font-extrabold">${d.code}</span>
        <span class="hidden sm:inline font-medium text-[11px]">${d.name}</span>
        <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? 'bg-blue-900/60 text-white' : 'bg-blue-100 text-blue-900'}">${count}</span>
      </button>
    `;
  });

  container.innerHTML = html;
}

function selectDivisionFilter(code) {
  AppState.departmentFilter = code;
  const sel = document.getElementById('divisionFilterSelect');
  if (sel) sel.value = code;
  renderItemsTable();
  renderDivisionPills();
}

function filterBarcodeRollByDivision(deptCode) {
  AppState.barcodeRollDepartmentFilter = deptCode;
  renderBarcodeCenter();
}

function renderItemsTable() {
  const filtered = filterItems();
  const tbody = document.getElementById('itemsTableBody');
  const countEl = document.getElementById('filteredItemsCount');
  if (countEl) countEl.textContent = `${filtered.length} / ${AppState.items.length}`;

  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-12 text-slate-400">
          <i class="fas fa-search text-3xl mb-2 block"></i>
          No items found matching your search.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((item, index) => {
    const qty = Number(item.qty) || 0;
    const reorder = Number(item.reorderLevel) || 0;
    const isOut = qty === 0;
    const isLow = reorder > 0 && qty <= reorder && qty > 0;

    const statusBadge = isOut 
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800"><i class="fas fa-times-circle"></i> Out of Stock</span>`
      : isLow 
      ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 pulse-alert"><i class="fas fa-exclamation-triangle"></i> Low Stock</span>`
      : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><i class="fas fa-check-circle"></i> In Stock</span>`;

    const isSelected = AppState.selectedItemsForLabels.has(item.id);

    return `
      <tr class="smart-table-row hover:bg-blue-50/40 transition-all border-b border-slate-100 text-sm">
        <td class="p-3 text-center">
          <input type="checkbox" onchange="toggleItemSelect('${item.id}', this.checked)" ${isSelected ? 'checked' : ''} class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300">
        </td>
        <td class="p-3 text-center text-slate-500 font-mono text-xs">${index + 1}</td>
        <td class="p-3">
          <div class="font-bold text-slate-800 text-sm flex items-center gap-2">
            <span>${item.name}</span>
            ${item.type === 'consumable' ? '<span class="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">Consumable</span>' : ''}
          </div>
          <div class="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
            <span class="inline-flex items-center gap-1 text-slate-600 font-mono"><i class="fas fa-barcode text-blue-600"></i> ${item.barcode}</span>
            <span>&bull;</span>
            <span class="px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded font-bold text-[10px] font-mono border border-blue-200" title="Division">${getItemDepartment(item)}</span>
            <span>&bull;</span>
            <span>${item.location || 'Main Office'}</span>
          </div>
        </td>
        <td class="p-3 text-slate-600 text-xs">
          <span class="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">${getCategoryEnglishName(item.category)}</span>
        </td>
        <td class="p-3 text-center">
          <span class="font-bold text-slate-800">${qty}</span>
          <span class="text-[11px] text-slate-500 block">${item.unit || 'Units'}</span>
        </td>
        <td class="p-3 text-right font-mono text-xs text-slate-700">
          Rs. ${(Number(item.cost) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td class="p-3 text-right font-mono text-xs font-semibold text-blue-900">
          Rs. ${(Number(item.netValue) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td class="p-3 text-center">
          ${statusBadge}
        </td>
        <td class="p-3 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="viewItemBarcodeModal('${item.id}')" title="View Barcode / QR Label" class="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors">
              <i class="fas fa-qrcode"></i>
            </button>
            <button onclick="openStockInOutModal('${item.id}')" title="Record Stock In / Out" class="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded transition-colors">
              <i class="fas fa-exchange-alt"></i>
            </button>
            <button onclick="openEditItemModal('${item.id}')" title="Edit Item" class="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition-colors">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="deleteItem('${item.id}')" title="Delete Item" class="p-1.5 text-rose-600 hover:bg-rose-100 rounded transition-colors">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// --- SELECTION FOR LABELS ---
function toggleItemSelect(id, isSelected) {
  if (isSelected) AppState.selectedItemsForLabels.add(id);
  else AppState.selectedItemsForLabels.delete(id);
  updateSelectedLabelCount();
}

function toggleSelectAllFiltered(checked) {
  const filtered = filterItems();
  filtered.forEach(item => {
    if (checked) AppState.selectedItemsForLabels.add(item.id);
    else AppState.selectedItemsForLabels.delete(item.id);
  });
  renderItemsTable();
  updateSelectedLabelCount();
}

function updateSelectedLabelCount() {
  const count = AppState.selectedItemsForLabels.size;
  const countBadge = document.getElementById('selectedLabelCountBadge');
  if (countBadge) countBadge.textContent = count;
}

// --- ADD / EDIT ITEM MODAL ---
function populateDepartmentDropdown(selectedValue) {
  const sel = document.getElementById('itemDepartment');
  if (!sel) return;
  sel.innerHTML = AppState.departments.map(d =>
    `<option value="${d.code}" ${d.code === selectedValue ? 'selected' : ''}>${d.code} — ${d.name}</option>`
  ).join('');
}

function openAddItemModal() {
  const form = document.getElementById('itemForm');
  if (form) form.reset();
  document.getElementById('modalItemTitle').textContent = 'Add New Inventory Item';
  document.getElementById('editItemId').value = '';

  // Default to currently active division filter if selected, otherwise first division
  const activeDept = (AppState.departmentFilter && AppState.departmentFilter !== 'all')
    ? AppState.departmentFilter
    : (AppState.departments[0]?.code || 'OAD');

  populateDepartmentDropdown(activeDept);
  document.getElementById('itemDepartment').value = activeDept;
  document.getElementById('itemBarcode').value = generateGcscBarcode(activeDept);
  document.getElementById('itemPurchaseDate').value = new Date().toISOString().split('T')[0];

  document.getElementById('itemModal').classList.remove('hidden');
}

function onDeptChange() {
  const deptCode = document.getElementById('itemDepartment')?.value;
  if (!deptCode) return;
  const editId = document.getElementById('editItemId').value;

  if (!editId) {
    // New item: automatically get lowest vacant barcode for this division
    document.getElementById('itemBarcode').value = generateGcscBarcode(deptCode);
  } else {
    // Editing item: if user changed the division, suggest next available code in new division
    const currentBarcode = document.getElementById('itemBarcode').value.trim();
    const currentBarcodeDept = extractDeptFromBarcode(currentBarcode);
    if (currentBarcodeDept !== deptCode) {
      document.getElementById('itemBarcode').value = generateGcscBarcode(deptCode, editId);
    }
  }
}

function openEditItemModal(id) {
  const item = AppState.items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('modalItemTitle').textContent = 'Edit Item Details';
  document.getElementById('editItemId').value = item.id;
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemCategory').value = item.category;
  document.getElementById('itemType').value = item.type || 'fixed_asset';
  document.getElementById('itemBarcode').value = item.barcode;
  document.getElementById('itemPurchaseDate').value = item.purchaseDate || '';
  document.getElementById('itemQty').value = item.qty;
  document.getElementById('itemUnit').value = item.unit || 'Units';
  document.getElementById('itemCost').value = item.cost;
  document.getElementById('itemNetValue').value = item.netValue !== undefined ? item.netValue : item.cost;
  document.getElementById('itemReorder').value = item.reorderLevel || 0;
  document.getElementById('itemLocation').value = item.location || '';
  document.getElementById('itemCondition').value = item.condition || 'Good Condition';
  document.getElementById('itemNotes').value = item.notes || '';

  // Populate department and select the item's department
  const itemDeptCode = getItemDepartment(item);
  populateDepartmentDropdown(itemDeptCode);

  document.getElementById('itemModal').classList.remove('hidden');
}

function extractDeptFromBarcode(barcode) {
  if (!barcode) return 'OAD';
  // e.g. GCSC/OAD/0001 → OAD
  const parts = barcode.split('/');
  if (parts.length >= 3 && parts[0] === 'GCSC') return parts[1];
  return 'OAD';
}

function closeItemModal() {
  document.getElementById('itemModal').classList.add('hidden');
}

function saveItemForm(e) {
  e.preventDefault();
  const editId = document.getElementById('editItemId').value;
  const name = document.getElementById('itemName').value.trim();
  const category = document.getElementById('itemCategory').value;
  const type = document.getElementById('itemType').value;
  const department = document.getElementById('itemDepartment')?.value || 'OAD';
  const barcode = document.getElementById('itemBarcode').value.trim().toUpperCase();
  const purchaseDate = document.getElementById('itemPurchaseDate').value;
  const qty = Number(document.getElementById('itemQty').value) || 0;
  const unit = document.getElementById('itemUnit').value.trim();
  const cost = Number(document.getElementById('itemCost').value) || 0;
  const netValue = Number(document.getElementById('itemNetValue').value) || 0;
  const reorderLevel = Number(document.getElementById('itemReorder').value) || 0;
  const location = document.getElementById('itemLocation').value.trim();
  const condition = document.getElementById('itemCondition').value.trim();
  const notes = document.getElementById('itemNotes').value.trim();

  if (!name || !barcode) {
    showToast('Please enter both item name and barcode number.', 'danger');
    return;
  }

  // Check duplicate barcode
  const duplicate = AppState.items.find(i => i.barcode === barcode && i.id !== editId);
  if (duplicate) {
    showToast(`Barcode (${barcode}) is already assigned to "${duplicate.name}"!`, 'danger');
    return;
  }

  if (editId) {
    // Update existing
    const index = AppState.items.findIndex(i => i.id === editId);
    if (index !== -1) {
      AppState.items[index] = {
        ...AppState.items[index],
        name, category, type, department, barcode, purchaseDate, qty, unit, cost, netValue,
        reorderLevel, location, condition, notes
      };
      showToast('Item updated successfully.', 'success');
    }
  } else {
    // Create new
    const newItem = {
      id: 'GCSC-' + Date.now().toString(36).toUpperCase(),
      name, category, type, department, barcode, purchaseDate, qty, unit, cost,
      purchasesPeriod: cost * qty,
      totalCost: cost * qty,
      accumulatedDepr: 0.00,
      periodDepr: 0.00,
      netValue, reorderLevel, location, condition, notes
    };
    AppState.items.unshift(newItem);
    showToast('New item registered successfully.', 'success');
  }

  saveItems();
  closeItemModal();
  renderAll();
  checkLowStockAlerts();
}

function deleteItem(id) {
  const item = AppState.items.find(i => i.id === id);
  if (!item) return;

  const deletedBarcode = item.barcode;
  const deletedDept = getItemDepartment(item);

  if (confirm(`Are you sure you want to delete "${item.name}" (${deletedBarcode}) from the system?`)) {
    AppState.items = AppState.items.filter(i => i.id !== id);
    AppState.selectedItemsForLabels.delete(id);
    saveItems();
    showToast(`"${item.name}" (${deletedBarcode}) ඉවත් කරන ලදී. ${deletedDept} හි මීළඟ භාණ්ඩය සඳහා මෙම කේතය (${deletedBarcode}) ස්වයංක්‍රීයව භාවිතයට ලැබේ.`, 'warning');
    renderAll();
    checkLowStockAlerts();
  }
}

// --- DEPARTMENT MANAGEMENT ---
function renderDepartmentList() {
  const container = document.getElementById('departmentListContainer');
  if (!container) return;
  if (AppState.departments.length === 0) {
    container.innerHTML = `<div class="text-center text-sm text-slate-400 py-6">No departments defined. Add one above.</div>`;
    return;
  }
  container.innerHTML = AppState.departments.map((d, idx) => {
    const itemCount = AppState.items.filter(i => getItemDepartment(i) === d.code).length;
    return `
      <div class="flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50/40 rounded-xl border border-slate-200 transition-colors">
        <div class="flex items-center gap-2.5 min-w-0 pr-2">
          <span class="font-mono font-bold text-xs text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 shrink-0">${d.code}</span>
          <div class="min-w-0">
            <span class="text-xs text-slate-800 font-bold block truncate" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
            <span class="text-[10px] text-slate-500 font-medium">${itemCount} ${itemCount === 1 ? 'item' : 'items'}</span>
          </div>
        </div>
        <button onclick="deleteDepartment(${idx})" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-all shrink-0" title="Delete Department">
          <i class="fas fa-trash-alt text-xs"></i>
        </button>
      </div>
    `;
  }).join('');
}

function addDepartment() {
  const codeInput = document.getElementById('newDeptCode');
  const nameInput = document.getElementById('newDeptName');
  const code = codeInput.value.trim().toUpperCase().replace(/\s+/g, '').substring(0, 8);
  const name = nameInput.value.trim();

  if (!code || !name) {
    showToast('Please enter both Department Code and Name.', 'danger');
    return;
  }

  if (AppState.departments.find(d => d.code === code)) {
    showToast(`Department code "${code}" already exists!`, 'danger');
    return;
  }

  AppState.departments.push({ code, name });
  saveDepartments();
  renderDepartmentList();
  populateDivisionFilter();
  codeInput.value = '';
  nameInput.value = '';
  showToast(`Department "${code} — ${name}" added!`, 'success');
}

function deleteDepartment(idx) {
  const dept = AppState.departments[idx];
  if (!dept) return;
  const inUse = AppState.items.some(item => getItemDepartment(item) === dept.code);
  if (inUse) {
    showToast(`Cannot delete "${dept.code}" — it is used by existing items!`, 'danger');
    return;
  }
  if (confirm(`Delete department "${dept.code} — ${dept.name}"?`)) {
    AppState.departments.splice(idx, 1);
    saveDepartments();
    renderDepartmentList();
    populateDivisionFilter();
    showToast(`Department "${dept.code}" deleted.`, 'warning');
  }
}

// Convert all existing item barcodes to GCSC/{DEPT}/0001 format
function upgradeAllBarcodesToGCSC() {
  if (!confirm('This will convert all existing "GSB0001" style barcodes into "GCSC/{DEPT}/0001" format based on your divisions. Proceed?')) {
    return;
  }
  const deptCounters = {};
  AppState.items.forEach(item => {
    let dept = item.department;
    if (!dept) {
      if (item.category && item.category.includes('ලිපිද්‍රව්‍ය')) dept = 'OAD';
      else if (item.location && item.location.includes('කවුන්ටර')) dept = 'CSD';
      else if (item.category && item.category.includes('ණය')) dept = 'LID';
      else if (item.category && item.category.includes('ඉලෙක්ට්‍රොනික')) dept = 'OAD';
      else dept = 'OAD';
      item.department = dept;
    }
    if (!deptCounters[dept]) deptCounters[dept] = 1;
    item.barcode = `GCSC/${dept}/${String(deptCounters[dept]++).padStart(4, '0')}`;
  });
  saveItems();
  renderAll();
  showToast('All item barcodes successfully converted to GCSC/DEPARTMENT/0001 format!', 'success');
}

// Re-sequence / clean gaps in division barcodes sequentially (0001, 0002, 0003...)
function resequenceDivisionBarcodes() {
  if (!confirm('This will clean up any gaps and re-number all items sequentially (0001, 0002, 0003...) within each division. Proceed?')) {
    return;
  }
  const counters = {};
  AppState.departments.forEach(d => {
    counters[d.code] = 1;
    const deptItems = AppState.items.filter(i => getItemDepartment(i) === d.code);
    // Sort by current numeric sequence
    deptItems.sort((a, b) => {
      const numA = parseInt(a.barcode.replace(`GCSC/${d.code}/`, ''), 10) || 0;
      const numB = parseInt(b.barcode.replace(`GCSC/${d.code}/`, ''), 10) || 0;
      return numA - numB;
    });
    deptItems.forEach(item => {
      item.department = d.code;
      item.barcode = `GCSC/${d.code}/${String(counters[d.code]++).padStart(4, '0')}`;
    });
  });
  saveItems();
  renderAll();
  showToast('සියලු අංශවල Barcodes හිස්තැන් නොමැතිව අනුක්‍රමිකව (0001, 0002...) යාවත්කාලීන කරන ලදී!', 'success');
}

// --- DYNAMIC PRINT PAGE STYLES ---
function preparePrintStyles(mode, orientation = 'landscape') {
  let styleEl = document.getElementById('dynamicPrintPageStyle');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamicPrintPageStyle';
    document.head.appendChild(styleEl);
  }

  if (mode === 'roll-50x25') {
    const isLandscape = orientation === 'landscape';
    styleEl.innerHTML = `
      @page {
        size: 50mm 25mm ${isLandscape ? 'landscape' : 'portrait'} !important;
        margin: 0mm !important;
      }
      @media print {
        body > *:not(#printableArea),
        header, nav, aside, main, .no-print,
        #itemModal, #viewBarcodeModal, #stockInOutModal {
          display: none !important;
        }
        html, body {
          width: 50mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #printableArea {
          display: block !important;
          width: 50mm !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .thermal-50x25-label {
          width: 50mm !important;
          height: 25mm !important;
          max-width: 50mm !important;
          max-height: 25mm !important;
          min-width: 50mm !important;
          min-height: 25mm !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 1.2mm 3.5mm 1.2mm 3.5mm !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          align-items: center !important;
          overflow: hidden !important;
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          background: #ffffff !important;
          border: none !important;
          box-shadow: none !important;
        }
        .thermal-label-header {
          font-size: 6.5pt !important;
          font-weight: 800 !important;
          letter-spacing: 0.2px !important;
          padding-bottom: 0.2mm !important;
          line-height: 1.1 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          width: 100% !important;
          text-align: center !important;
          text-transform: uppercase !important;
          border-bottom: 0.5px solid #000 !important;
          color: #000 !important;
        }
        .thermal-label-title {
          font-size: 6.8pt !important;
          font-weight: 700 !important;
          line-height: 1.15 !important;
          margin-top: 0.2mm !important;
          margin-bottom: 0.1mm !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          width: 100% !important;
          text-align: center !important;
          color: #000 !important;
        }
        .thermal-barcode-wrapper {
          width: 100% !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          height: 8.5mm !important;
          overflow: hidden !important;
          margin: 0 !important;
        }
        .thermal-barcode-wrapper svg {
          max-width: 42mm !important;
          height: 8mm !important;
          display: block !important;
        }
        .thermal-label-footer {
          width: 100% !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          font-size: 6pt !important;
          line-height: 1 !important;
          border-top: 0.5px solid #000 !important;
          padding-top: 0.2mm !important;
          margin-top: 0.1mm !important;
          color: #000 !important;
        }
        .thermal-barcode-text {
          font-weight: 800 !important;
          letter-spacing: 0.2px !important;
          font-size: 6.2pt !important;
        }
        .thermal-barcode-sub {
          font-size: 5.8pt !important;
          font-weight: 700 !important;
          max-width: 22mm !important;
          text-align: right !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .thermal-50x25-label:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
      }
    `;
  } else {
    // A4 Official Report
    styleEl.innerHTML = `
      @page {
        size: A4 portrait !important;
        margin: 8mm 8mm 8mm 8mm !important;
      }
      @media print {
        html, body {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        #printableArea {
          display: block !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      }
    `;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- BARCODE STICKER MODAL (5cm x 2.5cm ROLL) ---
function viewItemBarcodeModal(id) {
  const item = AppState.items.find(i => i.id === id);
  if (!item) return;

  AppState.currentModalItem = item;

  document.getElementById('barcodeModalItemName').textContent = item.name;
  document.getElementById('barcodeModalItemCategory').textContent = getCategoryEnglishName(item.category);
  document.getElementById('barcodeModalItemLocation').textContent = item.location || 'Main Office';

  // Populate 5cm x 2.5cm Sticker Preview
  document.getElementById('modalStickerTitle').textContent = item.name;
  document.getElementById('modalStickerBarcode').textContent = item.barcode;
  document.getElementById('modalStickerSub').textContent = item.department ? `DIV: ${item.department}` : (item.location || 'MAIN');

  const copiesInput = document.getElementById('modalStickerCopies');
  if (copiesInput) copiesInput.value = 1;

  // Generate Barcode SVG for 50mm x 25mm label
  try {
    JsBarcode("#barcodeModalSvg", item.barcode, {
      format: "CODE128",
      width: 0.9,
      height: 26,
      displayValue: false,
      margin: 0
    });
  } catch (e) {
    console.error("Barcode generation error", e);
  }

  document.getElementById('viewBarcodeModal').classList.remove('hidden');
}

function adjustModalCopies(delta) {
  const input = document.getElementById('modalStickerCopies');
  if (!input) return;
  let val = parseInt(input.value) || 1;
  val = Math.max(1, Math.min(100, val + delta));
  input.value = val;
}

function closeViewBarcodeModal() {
  document.getElementById('viewBarcodeModal').classList.add('hidden');
  AppState.currentModalItem = null;
}

// Print single item on 5cm x 2.5cm roll
function printCurrentModalItemRoll() {
  const item = AppState.currentModalItem;
  if (!item) return;

  const copiesInput = document.getElementById('modalStickerCopies');
  const copies = Math.max(1, parseInt(copiesInput?.value) || 1);
  const orientation = document.getElementById('modalOrientationSelect')?.value || 'landscape';

  // Close modal before opening print dialog so the modal dialog never leaks into print
  closeViewBarcodeModal();

  printSingleItemRoll(item, copies, orientation);
}

function printSingleItemRoll(item, copies = 1, orientation = 'landscape') {
  preparePrintStyles('roll-50x25', orientation);
  const printArea = document.getElementById('printableArea');

  let labelsHtml = '';
  for (let c = 0; c < copies; c++) {
    labelsHtml += `
      <div class="thermal-50x25-label">
        <div class="thermal-label-header">GALAPITIYAGAMA SANASA BANK</div>
        <div class="thermal-label-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
        <div class="thermal-barcode-wrapper">
          <svg id="singleRollBarcode_${c}"></svg>
        </div>
        <div class="thermal-label-footer">
          <span class="thermal-barcode-text">${item.barcode}</span>
          <span class="thermal-barcode-sub">${escapeHtml(item.department ? `DIV: ${item.department}` : (item.location || 'MAIN'))}</span>
        </div>
      </div>
    `;
  }

  printArea.innerHTML = labelsHtml;

  // Draw barcodes
  for (let c = 0; c < copies; c++) {
    try {
      JsBarcode(`#singleRollBarcode_${c}`, item.barcode, {
        format: "CODE128",
        width: 0.9,
        height: 26,
        displayValue: false,
        margin: 0
      });
    } catch (e) {
      console.warn("JsBarcode render error", e);
    }
  }

  setTimeout(() => {
    window.print();
  }, 100);
}

// --- RENDER 5cm x 2.5cm BARCODE STICKER ROLL CENTER ---
function renderBarcodeCenter() {
  const container = document.getElementById('barcodeSheetPreview');
  const countBadge = document.getElementById('barcodeSelectedCount');

  const rollDept = AppState.barcodeRollDepartmentFilter || 'all';
  let pool = AppState.items;
  if (rollDept !== 'all') {
    pool = pool.filter(i => getItemDepartment(i) === rollDept);
  }

  let targetItems = [];
  if (AppState.selectedItemsForLabels.size > 0) {
    targetItems = pool.filter(i => AppState.selectedItemsForLabels.has(i.id));
  } else {
    targetItems = pool.slice(0, 25);
  }

  if (countBadge) {
    if (AppState.selectedItemsForLabels.size > 0) {
      countBadge.innerHTML = `<span>තෝරාගත් භාණ්ඩ: <strong>${targetItems.length}</strong></span> &bull; <button onclick="clearBarcodeSelection()" class="text-rose-600 hover:underline">තේරීම ඉවත් කරන්න (Clear)</button>`;
    } else {
      const deptLabel = rollDept === 'all' ? 'සියලු අංශ' : rollDept;
      countBadge.innerHTML = `<span>පෙරදසුන (${deptLabel}): භාණ්ඩ <strong>${targetItems.length} / ${pool.length}</strong></span> &bull; <button onclick="selectAllForBarcodeRoll()" class="text-blue-600 hover:underline font-bold">මෙම අංශයේ සියල්ල තෝරන්න (Select All)</button>`;
    }
  }

  if (!container) return;

  // Render vertical roll strip with gap simulation matching real sticker roll
  container.innerHTML = targetItems.map((item, idx) => `
    <div class="thermal-roll-item-wrap">
      <div class="thermal-50x25-label preview-mode">
        <div class="thermal-label-header">GALAPITIYAGAMA SANASA BANK</div>
        <div class="thermal-label-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
        <div class="thermal-barcode-wrapper">
          <svg id="sheetBarcode_${idx}"></svg>
        </div>
        <div class="thermal-label-footer">
          <span class="thermal-barcode-text">${item.barcode}</span>
          <span class="thermal-barcode-sub">${escapeHtml(item.department ? `DIV: ${item.department}` : (item.location || 'MAIN'))}</span>
        </div>
      </div>
      ${idx < targetItems.length - 1 ? `
        <div class="thermal-roll-gap">
          <div class="thermal-roll-gap-line"></div>
        </div>
      ` : ''}
    </div>
  `).join('');

  // Render barcodes
  targetItems.forEach((item, idx) => {
    try {
      JsBarcode(`#sheetBarcode_${idx}`, item.barcode, {
        format: "CODE128",
        width: 0.9,
        height: 26,
        displayValue: false,
        margin: 0
      });
    } catch (e) {
      console.warn('JsBarcode render error on roll', e);
    }
  });
}

function selectAllForBarcodeRoll() {
  const rollDept = AppState.barcodeRollDepartmentFilter || 'all';
  let pool = AppState.items;
  if (rollDept !== 'all') {
    pool = pool.filter(i => getItemDepartment(i) === rollDept);
  }
  pool.forEach(item => AppState.selectedItemsForLabels.add(item.id));
  renderItemsTable();
  renderBarcodeCenter();
  showToast(`අංශයේ (${rollDept === 'all' ? 'සියලු' : rollDept}) භාණ්ඩ ${pool.length}ම මුද්‍රණය සඳහා තෝරාගන්නා ලදී`, 'info');
}

function clearBarcodeSelection() {
  AppState.selectedItemsForLabels.clear();
  renderItemsTable();
  renderBarcodeCenter();
  showToast('තේරීම ඉවත් කරන ලදී', 'info');
}

// Print batch / selected 5cm x 2.5cm roll stickers
function printRollLabels() {
  const rollDept = AppState.barcodeRollDepartmentFilter || 'all';
  let pool = AppState.items;
  if (rollDept !== 'all') {
    pool = pool.filter(i => getItemDepartment(i) === rollDept);
  }

  let targetItems = [];
  if (AppState.selectedItemsForLabels.size > 0) {
    targetItems = pool.filter(i => AppState.selectedItemsForLabels.has(i.id));
  } else {
    targetItems = pool;
  }

  if (targetItems.length === 0) {
    showToast("මුද්‍රණය සඳහා කිසිදු භාණ්ඩයක් හමු නොවීය!", "warning");
    return;
  }

  const copiesMode = document.getElementById('rollCopiesSelect')?.value || '1';
  const orientation = document.getElementById('rollOrientationSelect')?.value || 'landscape';
  preparePrintStyles('roll-50x25', orientation);

  const printArea = document.getElementById('printableArea');
  let labelIdx = 0;
  let labelsHtml = '';
  const barcodesToDraw = [];

  targetItems.forEach(item => {
    const numCopies = copiesMode === 'stock'
      ? Math.max(1, parseInt(item.quantity) || 1)
      : Math.max(1, parseInt(copiesMode) || 1);

    for (let c = 0; c < numCopies; c++) {
      const svgId = `rollPrintSvg_${labelIdx}`;
      barcodesToDraw.push({ svgId, barcode: item.barcode });
      labelsHtml += `
        <div class="thermal-50x25-label">
          <div class="thermal-label-header">GALAPITIYAGAMA SANASA BANK</div>
          <div class="thermal-label-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="thermal-barcode-wrapper">
            <svg id="${svgId}"></svg>
          </div>
          <div class="thermal-label-footer">
            <span class="thermal-barcode-text">${item.barcode}</span>
            <span class="thermal-barcode-sub">${escapeHtml(item.department ? `DIV: ${item.department}` : (item.location || 'MAIN'))}</span>
          </div>
        </div>
      `;
      labelIdx++;
    }
  });

  printArea.innerHTML = labelsHtml;

  // Draw barcodes
  barcodesToDraw.forEach(b => {
    try {
      JsBarcode(`#${b.svgId}`, b.barcode, {
        format: "CODE128",
        width: 0.9,
        height: 26,
        displayValue: false,
        margin: 0
      });
    } catch (e) {}
  });

  setTimeout(() => {
    window.print();
  }, 100);
}

// Backward compatibility aliases
const printAllSelectedLabels = printRollLabels;
const printSingleItemLabel = printSingleItemRoll;

// --- BARCODE SCANNER (Camera & Hardware USB Gun) ---
function startScannerTab() {
  const readerElement = document.getElementById('qr-reader');
  if (!readerElement) return;

  // Clear previous
  stopScanner();

  try {
    if (typeof Html5QrcodeScanner !== 'undefined') {
      AppState.scannerInstance = new Html5QrcodeScanner(
        "qr-reader", 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      AppState.scannerInstance.render(onScanSuccess, onScanError);
    }
  } catch (e) {
    console.warn("Camera scanner notice:", e);
  }

  // Auto focus manual input for USB scanner guns
  setTimeout(() => {
    const input = document.getElementById('manualBarcodeInput');
    if (input) input.focus();
  }, 200);
}

function stopScanner() {
  if (AppState.scannerInstance) {
    try {
      AppState.scannerInstance.clear();
    } catch (e) {}
    AppState.scannerInstance = null;
  }
}

function onScanSuccess(decodedText) {
  playAlertBeep(false);
  handleBarcodeScanned(decodedText.trim());
}

function onScanError(error) {
  // Silent frame scan errors
}

function handleManualBarcodeScan(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const code = e.target.value.trim();
    if (code) {
      handleBarcodeScanned(code);
      e.target.value = '';
    }
  }
}

function handleBarcodeScanned(barcode) {
  let searchCode = barcode;
  try {
    if (barcode.startsWith('{')) {
      const parsed = JSON.parse(barcode);
      if (parsed.code) searchCode = parsed.code;
    }
  } catch (e) {}

  const foundItem = AppState.items.find(i => i.barcode.toLowerCase() === searchCode.toLowerCase());
  const resultContainer = document.getElementById('scannedResultContainer');

  if (!foundItem) {
    playAlertBeep(true);
    showToast(`Barcode (${searchCode}) was not found in database!`, 'danger');
    if (resultContainer) {
      resultContainer.innerHTML = `
        <div class="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-center justify-between">
          <div>
            <strong>Not Found:</strong> No item registered with barcode "${searchCode}".
          </div>
          <button onclick="openAddItemWithBarcode('${searchCode}')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold">
            + Register as New Item
          </button>
        </div>
      `;
    }
    return;
  }

  showToast(`Item Identified: ${foundItem.name}`, 'success');
  if (resultContainer) {
    resultContainer.innerHTML = `
      <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-emerald-700">Scan Successful</span>
          <h4 class="text-lg font-bold text-slate-800">${foundItem.name}</h4>
          <div class="text-xs text-slate-600 mt-1 flex flex-wrap gap-3">
            <span><strong>Barcode:</strong> ${foundItem.barcode}</span>
            <span><strong>Category:</strong> ${getCategoryEnglishName(foundItem.category)}</span>
            <span><strong>Current Stock:</strong> <span class="text-emerald-700 font-bold">${foundItem.qty} ${foundItem.unit || ''}</span></span>
            <span><strong>Location:</strong> ${foundItem.location || 'Main Office'}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openStockInOutModal('${foundItem.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors">
            <i class="fas fa-exchange-alt mr-1"></i> Stock In / Out
          </button>
          <button onclick="viewItemBarcodeModal('${foundItem.id}')" class="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors">
            <i class="fas fa-eye mr-1"></i> Details
          </button>
        </div>
      </div>
    `;
  }
}

function openAddItemWithBarcode(barcode) {
  openAddItemModal();
  document.getElementById('itemBarcode').value = barcode;
}

// --- STOCK IN / OUT TRANSACTIONS ---
function openStockInOutModal(itemId) {
  const item = AppState.items.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('stockInOutItemId').value = item.id;
  document.getElementById('stockInOutItemName').textContent = item.name;
  document.getElementById('stockInOutCurrentQty').textContent = `${item.qty} ${item.unit || 'Units'}`;
  document.getElementById('stockInOutBarcode').textContent = item.barcode;
  document.getElementById('stockInOutQty').value = 1;
  document.getElementById('stockInOutRecipient').value = '';
  document.getElementById('stockInOutNotes').value = '';

  document.getElementById('stockInOutModal').classList.remove('hidden');
}

function closeStockInOutModal() {
  document.getElementById('stockInOutModal').classList.add('hidden');
}

function saveStockInOut(e) {
  e.preventDefault();
  const itemId = document.getElementById('stockInOutItemId').value;
  const type = document.getElementById('stockInOutType').value; // 'OUT' or 'IN'
  const qty = Number(document.getElementById('stockInOutQty').value) || 0;
  const recipient = document.getElementById('stockInOutRecipient').value.trim();
  const notes = document.getElementById('stockInOutNotes').value.trim();

  if (qty <= 0) {
    showToast('Please enter a valid quantity.', 'danger');
    return;
  }

  const itemIndex = AppState.items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return;

  const item = AppState.items[itemIndex];
  const currentQty = Number(item.qty) || 0;

  if (type === 'OUT' && qty > currentQty) {
    showToast(`Insufficient stock to issue! Current available stock: ${currentQty}`, 'danger');
    playAlertBeep(true);
    return;
  }

  // Update item quantity
  if (type === 'OUT') item.qty = currentQty - qty;
  else item.qty = currentQty + qty;

  // Record transaction
  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').substring(0, 16);
  const tx = {
    id: 'TX-' + Date.now().toString(36).toUpperCase(),
    barcode: item.barcode,
    itemName: item.name,
    type,
    qty,
    date: dateStr,
    recipient: recipient || (type === 'OUT' ? 'Office Use' : 'Main Storage'),
    issuedBy: 'Authorized Officer',
    notes
  };

  AppState.transactions.unshift(tx);

  saveItems();
  saveTransactions();
  closeStockInOutModal();
  showToast(type === 'OUT' ? `Stock issued successfully (-${qty})` : `New stock received successfully (+${qty})`, 'success');
  renderAll();
  checkLowStockAlerts();
}

function renderTransactionsTable() {
  const tbody = document.getElementById('transactionsTableBody');
  if (!tbody) return;

  if (AppState.transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-slate-400">No stock movements recorded yet</td></tr>`;
    return;
  }

  tbody.innerHTML = AppState.transactions.map((tx, idx) => `
    <tr class="hover:bg-blue-50/30 transition-colors border-b border-slate-100 text-sm">
      <td class="p-3 text-center text-slate-500 text-xs">${idx + 1}</td>
      <td class="p-3 font-mono text-xs text-slate-600">${tx.date}</td>
      <td class="p-3">
        <div class="font-bold text-slate-800">${tx.itemName}</div>
        <div class="text-xs text-slate-500 font-mono">${tx.barcode}</div>
      </td>
      <td class="p-3 text-center">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${tx.type === 'OUT' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
          ${tx.type === 'OUT' ? '<i class="fas fa-arrow-up"></i> Issue (OUT)' : '<i class="fas fa-arrow-down"></i> Receive (IN)'}
        </span>
      </td>
      <td class="p-3 text-center font-bold text-slate-800">${tx.qty}</td>
      <td class="p-3 text-slate-700 text-xs">${tx.recipient || '-'}</td>
      <td class="p-3 text-slate-500 text-xs">${tx.notes || '-'}</td>
    </tr>
  `).join('');
}

// --- LOW STOCK VIEW ---
function renderLowStockView() {
  const lowItems = getLowStockItems();
  const container = document.getElementById('lowStockItemsList');
  const countBadge = document.getElementById('lowStockTabCount');

  if (countBadge) countBadge.textContent = lowItems.length;
  if (!container) return;

  if (lowItems.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-slate-400">
        <i class="fas fa-check-double text-4xl text-emerald-500 mb-3 block"></i>
        <div class="text-base font-semibold text-slate-700">All items are at healthy stock levels!</div>
        <div class="text-xs text-slate-500 mt-1">No items require immediate re-ordering.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = lowItems.map(item => `
    <div class="p-4 bg-white border border-amber-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-lg ${item.qty === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'} flex items-center justify-center font-bold">
          <i class="fas ${item.qty === 0 ? 'fa-ban' : 'fa-exclamation-triangle'}"></i>
        </div>
        <div>
          <h4 class="font-bold text-slate-800 text-base">${item.name}</h4>
          <div class="text-xs text-slate-500 flex flex-wrap gap-2 mt-1">
            <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700"><i class="fas fa-barcode"></i> ${item.barcode}</span>
            <span>&bull;</span>
            <span>Location: ${item.location || 'Main Office'}</span>
            <span>&bull;</span>
            <span>Category: ${getCategoryEnglishName(item.category)}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
        <div class="text-right">
          <div class="text-xs text-slate-500">Current Stock Qty:</div>
          <div class="text-lg font-bold ${item.qty === 0 ? 'text-rose-600' : 'text-amber-600'}">${item.qty} ${item.unit || ''}</div>
          <div class="text-[11px] text-slate-400">Reorder Threshold: ${item.reorderLevel}</div>
        </div>
        <button onclick="openStockInOutModal('${item.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap">
          <i class="fas fa-cart-plus"></i> + Add / Restock
        </button>
      </div>
    </div>
  `).join('');
}

// --- ROBUST SMARTCOOP PDF & REPORT PARSER ---
async function handlePdfUpload(file) {
  const statusEl = document.getElementById('importStatusMessage');
  statusEl.innerHTML = `<i class="fas fa-spinner fa-spin text-blue-600"></i> Reading file "${file.name}"...`;
  statusEl.classList.remove('hidden');

  // Check if text/csv
  if (file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
    const text = await file.text();
    parseSmartCoopRawText(text);
    return;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    statusEl.innerHTML = `<i class="fas fa-spinner fa-spin text-blue-600"></i> Extracting ${pdf.numPages} page(s) with visual coordinate grouping...`;

    const lines = [];
    let totalTextItems = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items || [];
      totalTextItems += items.length;

      // Filter valid text tokens
      const validItems = items.filter(it => it.str && it.str.trim().length > 0);
      if (validItems.length === 0) continue;

      // Group by Y coordinate (vertical band of 4px)
      const rows = {};
      validItems.forEach(it => {
        const y = it.transform ? Math.round(it.transform[5] / 4) * 4 : 0;
        if (!rows[y]) rows[y] = [];
        rows[y].push(it);
      });

      // Sort Y descending (top of page to bottom)
      const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a);

      sortedY.forEach(y => {
        // Sort X ascending (left to right)
        const rowItems = rows[y].sort((a, b) => (a.transform ? a.transform[4] : 0) - (b.transform ? b.transform[4] : 0));
        const lineText = rowItems.map(it => it.str.trim()).join(' ');
        if (lineText.length > 0) {
          lines.push(lineText);
        }
      });
    }

    if (totalTextItems === 0) {
      statusEl.innerHTML = `
        <div class="text-amber-800">
          <strong><i class="fas fa-exclamation-triangle"></i> Scanned Image PDF Notice:</strong><br>
          This PDF contains scanned images without an underlying digital text layer.
          <div class="mt-2 flex items-center gap-2">
            <button onclick="loadAllSampleBankItemsToImport()" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold">
              ⚡ Click here to Load All 77 Bank Items Instantly
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Now parse the assembled visual lines
    parseSmartCoopVisualLines(lines);

  } catch (err) {
    console.error('PDF parsing error', err);
    statusEl.innerHTML = `
      <div class="text-rose-700">
        <i class="fas fa-exclamation-triangle"></i> Error reading PDF: ${err.message}.<br>
        <span class="text-slate-600 text-xs">You can click "Load All 77 Bank Items from Images" above to load the exact items without re-uploading.</span>
      </div>
    `;
  }
}

function parseSmartCoopVisualLines(lines) {
  const statusEl = document.getElementById('importStatusMessage');
  const parsedItems = [];
  let currentCategory = 'කාර්යාල උපකරණ';

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect Categories
    if (trimmed.includes('ගොඩනැගිලි')) {
      currentCategory = 'ගොඩනැගිලි විස්තර';
      return;
    }
    if (trimmed.includes('නාම පුවරු විස්තර') || (trimmed.startsWith('නාම පුවරු') && trimmed.includes('විස්තර'))) {
      currentCategory = 'නාම පුවරු විස්තර';
      return;
    }
    if (trimmed.includes('කාර්යාල උපකරණ')) {
      currentCategory = 'කාර්යාල උපකරණ';
      return;
    }

    // Ignore headers, totals, signatures and footers
    if (trimmed.includes('අනු අංකය') || trimmed.includes('මිලදී ගත්') || trimmed.includes('SmartCoop') || trimmed.includes('පිටු අංක') || trimmed.includes('සහතික කරමු') || trimmed.includes('සභාපති')) {
      return;
    }

    // Smart Regex:
    // Matches: [RowNumber] [ItemName...] [YYYY-MM-DD Date] [Qty] [Cost] [Optional other numbers...]
    const match = trimmed.match(/(\d{1,4})\s+(.+?)\s+(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+(\d+)\s+([\d,]+\.?\d*)(.*)/);
    if (match) {
      const serialNo = match[1];
      const itemName = match[2].trim();
      const purchaseDate = match[3];
      const qty = parseInt(match[4], 10) || 1;
      const cost = parseFloat(match[5].replace(/,/g, '')) || 0;

      // Extract Net Value from the rest of the numbers on the line
      let netValue = cost;
      if (match[6]) {
        const remainingNumbers = match[6].match(/[\d,]+\.?\d*/g) || [];
        if (remainingNumbers.length > 0) {
          const lastNum = parseFloat(remainingNumbers[remainingNumbers.length - 1].replace(/,/g, ''));
          if (!isNaN(lastNum)) netValue = lastNum;
        }
      }

      const existing = AppState.items.find(i => i.name.toLowerCase() === itemName.toLowerCase());

      parsedItems.push({
        name: itemName,
        category: currentCategory,
        purchaseDate,
        qty,
        cost,
        netValue,
        isExisting: !!existing
      });
    }
  });

  if (parsedItems.length === 0) {
    // Fallback: Try token stream matching if lines were condensed
    const fullText = lines.join(' \n ');
    parseSmartCoopRawText(fullText);
    return;
  }

  statusEl.innerHTML = `
    <div class="text-emerald-700 font-semibold flex items-center justify-between">
      <span><i class="fas fa-check-circle"></i> Successfully extracted <strong>${parsedItems.length}</strong> items from SmartCoop report!</span>
    </div>
  `;

  renderImportPreviewTable(parsedItems);
}

function parseSmartCoopRawText(text) {
  const statusEl = document.getElementById('importStatusMessage');
  statusEl.classList.remove('hidden');
  const parsedItems = [];

  // Match pattern anywhere in the stream:
  // Row number, description, date, qty, cost
  const regex = /(\d{1,4})\s+([\u0D80-\u0DFFa-zA-Z0-9\s\*\(\)\-\.\/]+?)\s+(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+(\d+)\s+([\d,]+\.?\d*)/g;
  let m;

  let currentCategory = 'කාර්යාල උපකරණ';
  const lines = text.split(/[\r\n]+/);

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.includes('ගොඩනැගිලි')) currentCategory = 'ගොඩනැගිලි විස්තර';
    if (trimmed.includes('නාම පුවරු')) currentCategory = 'නාම පුවරු විස්තර';
    if (trimmed.includes('කාර්යාල උපකරණ')) currentCategory = 'කාර්යාල උපකරණ';

    const lineMatch = trimmed.match(/(\d{1,4})\s+(.+?)\s+(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+(\d+)\s+([\d,]+\.?\d*)(.*)/);
    if (lineMatch) {
      const itemName = lineMatch[2].trim();
      const purchaseDate = lineMatch[3];
      const qty = parseInt(lineMatch[4], 10) || 1;
      const cost = parseFloat(lineMatch[5].replace(/,/g, '')) || 0;
      
      let netValue = cost;
      if (lineMatch[6]) {
        const nums = lineMatch[6].match(/[\d,]+\.?\d*/g) || [];
        if (nums.length > 0) {
          const last = parseFloat(nums[nums.length - 1].replace(/,/g, ''));
          if (!isNaN(last)) netValue = last;
        }
      }

      const existing = AppState.items.find(i => i.name.toLowerCase() === itemName.toLowerCase());
      parsedItems.push({
        name: itemName,
        category: currentCategory,
        purchaseDate,
        qty,
        cost,
        netValue,
        isExisting: !!existing
      });
    }
  });

  if (parsedItems.length === 0) {
    statusEl.innerHTML = `
      <div class="text-amber-800 p-2">
        <strong><i class="fas fa-exclamation-triangle"></i> Could not identify items from the provided text format.</strong><br>
        <span class="text-xs">If this is a scanned/image PDF, please click the button below to load all 77 items from the report images automatically:</span>
        <div class="mt-2">
          <button onclick="loadAllSampleBankItemsToImport()" class="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5">
            <i class="fas fa-bolt"></i> Load All 77 Bank Items from Images (One-Click)
          </button>
        </div>
      </div>
    `;
    return;
  }

  statusEl.innerHTML = `<span class="text-emerald-700 font-semibold"><i class="fas fa-check-circle"></i> Successfully extracted <strong>${parsedItems.length}</strong> items! Review and confirm below.</span>`;
  renderImportPreviewTable(parsedItems);
}

// One-click loader for all 77 items from the bank images
function loadAllSampleBankItemsToImport() {
  const items = INITIAL_BANK_ITEMS.map(i => ({
    name: i.name,
    category: i.category,
    purchaseDate: i.purchaseDate,
    qty: i.qty,
    cost: i.cost,
    netValue: i.netValue,
    isExisting: AppState.items.some(existing => existing.name === i.name)
  }));

  const statusEl = document.getElementById('importStatusMessage');
  statusEl.classList.remove('hidden');
  statusEl.innerHTML = `<span class="text-emerald-700 font-semibold"><i class="fas fa-check-circle"></i> Loaded all <strong>${items.length}</strong> official items from Galapitiyagama Sanasa Bank records! Confirm import below.</span>`;

  renderImportPreviewTable(items);
}

function insertSampleSmartCoopText() {
  const sample = `1 කබඩ් 2000-01-01 1 1,946.79 0.00 1,946.79 1,945.79 0.00 1,945.79 1.00\n2 වානේ කබඩ් 2000-01-01 1 5,600.00 0.00 5,600.00 5,599.00 0.00 5,599.00 1.00\n3 මේස 2000-01-01 1 5,800.00 0.00 5,800.00 5,799.00 0.00 5,799.00 1.00`;
  const area = document.getElementById('rawTextImportArea');
  if (area) {
    area.value = sample;
    parseSmartCoopRawText(sample);
  }
}

let pendingImportItems = [];
function renderImportPreviewTable(items) {
  pendingImportItems = items;
  const container = document.getElementById('importPreviewContainer');
  container.classList.remove('hidden');

  const summaryEl = document.getElementById('importPreviewSummary');
  if (summaryEl) {
    const existingCount = items.filter(i => i.isExisting).length;
    summaryEl.textContent = `Total extracted: ${items.length} items (${existingCount} already exist in system)`;
  }

  const tbody = document.getElementById('importPreviewTableBody');
  tbody.innerHTML = items.map((item, idx) => `
    <tr class="border-b border-slate-100 text-xs ${item.isExisting ? 'bg-amber-50/50' : 'hover:bg-slate-50'}">
      <td class="p-2 text-center">
        <input type="checkbox" id="importCheck_${idx}" ${item.isExisting ? '' : 'checked'} class="w-4 h-4 rounded text-blue-600">
      </td>
      <td class="p-2 text-center text-slate-500">${idx + 1}</td>
      <td class="p-2 font-semibold text-slate-800">
        ${item.name}
        ${item.isExisting ? '<span class="text-[10px] ml-1 text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-normal">(Already Exists)</span>' : ''}
      </td>
      <td class="p-2 text-slate-600">${getCategoryEnglishName(item.category)}</td>
      <td class="p-2 text-center text-slate-600 font-mono">${item.purchaseDate || '-'}</td>
      <td class="p-2 text-center font-bold text-slate-800">${item.qty}</td>
      <td class="p-2 text-right font-mono text-slate-700">Rs. ${(Number(item.cost) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td class="p-2 text-right font-mono text-blue-900 font-bold">Rs. ${(Number(item.netValue) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');
}

function selectAllImportPreview(checked) {
  pendingImportItems.forEach((_, idx) => {
    const chk = document.getElementById(`importCheck_${idx}`);
    if (chk) chk.checked = checked;
  });
}

function commitImport() {
  let importedCount = 0;
  let nextNum = AppState.items.length + 1;

  pendingImportItems.forEach((item, idx) => {
    const isChecked = document.getElementById(`importCheck_${idx}`)?.checked;
    if (isChecked) {
      const barcode = generateGcscBarcode('OAD');
      AppState.items.push({
        id: 'GCSC-IMP-' + Date.now().toString(36).toUpperCase() + '-' + idx,
        barcode,
        department: 'OAD',
        name: item.name,
        category: item.category,
        type: 'fixed_asset',
        purchaseDate: item.purchaseDate,
        qty: item.qty,
        unit: 'Units',
        cost: item.cost,
        purchasesPeriod: 0,
        totalCost: item.cost * item.qty,
        accumulatedDepr: 0,
        periodDepr: 0,
        netValue: item.netValue,
        location: 'Main Office',
        reorderLevel: 0,
        condition: 'Good Condition',
        notes: 'Imported from SmartCoop report'
      });
      importedCount++;
    }
  });

  if (importedCount === 0) {
    showToast('No items were selected for import.', 'warning');
    return;
  }

  saveItems();
  renderAll();
  showToast(`Successfully imported ${importedCount} items to the system!`, 'success');
  document.getElementById('importPreviewContainer').classList.add('hidden');
  switchTab('items');
}

// --- OFFICIAL A4 PRINTABLE REPORTS ---
function handleReportTypeChange() {
  const reportType = document.getElementById('reportTypeSelect')?.value || 'asset_register';
  const dateContainer = document.getElementById('reportDateContainer');
  const datePicker = document.getElementById('reportDatePicker');

  if (dateContainer) {
    if (reportType === 'daily_movement') {
      dateContainer.classList.remove('hidden');
      if (datePicker && !datePicker.value) {
        datePicker.value = new Date().toISOString().split('T')[0];
      }
    } else {
      dateContainer.classList.add('hidden');
    }
  }

  renderReportsView();
}

function openDailyMovementReportToday() {
  switchTab('reports');
  const select = document.getElementById('reportTypeSelect');
  const datePicker = document.getElementById('reportDatePicker');
  if (select) select.value = 'daily_movement';
  if (datePicker) datePicker.value = new Date().toISOString().split('T')[0];
  handleReportTypeChange();
}

function renderReportsView() {
  const container = document.getElementById('reportPreviewArea');
  if (!container) return;

  const reportType = document.getElementById('reportTypeSelect')?.value || 'asset_register';
  container.innerHTML = generateOfficialReportHtml(reportType);
}

function generateOfficialReportHtml(reportType) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('en-US');

  // Handle Daily Stock Movement Report
  if (reportType === 'daily_movement') {
    const selectedDate = document.getElementById('reportDatePicker')?.value || dateStr;
    const dayTx = AppState.transactions.filter(t => t.date && t.date.startsWith(selectedDate));

    const totalIssued = dayTx.filter(t => t.type === 'OUT').reduce((sum, t) => sum + (Number(t.qty) || 0), 0);
    const totalReceived = dayTx.filter(t => t.type === 'IN').reduce((sum, t) => sum + (Number(t.qty) || 0), 0);
    const uniqueItems = new Set(dayTx.map(t => t.barcode)).size;

    let rowsHtml = '';
    if (dayTx.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 25px; color: #64748b;">
            <i class="fas fa-calendar-times text-2xl mb-1 block"></i>
            No stock movements (Issues or Receipts) recorded for <strong>${selectedDate}</strong>.<br>
            <span class="text-xs">Select another date above or record new movements in the "Stock In / Out" tab.</span>
          </td>
        </tr>
      `;
    } else {
      rowsHtml = dayTx.map((tx, idx) => {
        const timePart = tx.date.includes(' ') ? tx.date.split(' ')[1] : '-';
        return `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="text-align: center; font-family: monospace;">${timePart}</td>
            <td style="text-align: center; font-family: monospace; font-size: 8pt;">${tx.barcode}</td>
            <td style="text-align: left; font-weight: 600;">${tx.itemName}</td>
            <td style="text-align: center;">
              <span style="display: inline-block; padding: 2px 6px; font-size: 8pt; font-weight: bold; border-radius: 4px; ${tx.type === 'OUT' ? 'background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;' : 'background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7;'}">
                ${tx.type === 'OUT' ? 'ISSUE (OUT / නිකුත්)' : 'RECEIVE (IN / ලැබීම)'}
              </span>
            </td>
            <td style="text-align: center; font-weight: bold; font-size: 10pt;">${tx.qty}</td>
            <td style="text-align: left;">${tx.recipient || '-'}</td>
            <td style="text-align: left; font-size: 8pt; color: #475569;">${tx.notes || '-'}</td>
          </tr>
        `;
      }).join('');
    }

    return `
      <div class="print-page bg-white p-6 max-w-5xl mx-auto border border-slate-200 shadow-sm">
        <!-- Bank Letterhead -->
        <div class="text-center border-b-2 border-slate-800 pb-3 mb-4">
          <h2 class="text-lg font-bold text-slate-900 leading-tight">GALAPITIYAGAMA THRIFT & CREDIT CO-OPERATIVE SOCIETY LTD</h2>
          <div class="text-xs text-slate-600 font-medium">සීමා සහිත ගලපිටියාගම සකසුරුවම් හා ණය ගනුදෙනු පිළිබඳ සමූපකාර සමිතිය &bull; SANASA BANK</div>
          <div class="text-sm font-bold text-slate-800 mt-1 uppercase">DAILY STOCK MOVEMENT REPORT (දෛනික තොග සංචලන වාර්තාව)</div>
          <div class="text-xs text-slate-600 font-bold mt-0.5">Date of Movement: <span class="text-blue-900 font-mono text-sm underline">${selectedDate}</span> &bull; Printed: ${dateStr} ${timeStr}</div>
        </div>

        <!-- Daily KPIs Summary Box -->
        <div class="grid grid-cols-4 gap-3 mb-5 page-break-inside-avoid">
          <div class="p-2.5 bg-slate-50 border border-slate-300 rounded text-center">
            <div class="text-[10px] text-slate-500 uppercase font-bold">Total Operations</div>
            <div class="text-lg font-bold text-slate-800 font-mono">${dayTx.length}</div>
            <div class="text-[9px] text-slate-400">ගනුදෙනු වාර ගණන</div>
          </div>
          <div class="p-2.5 bg-amber-50 border border-amber-300 rounded text-center">
            <div class="text-[10px] text-amber-800 uppercase font-bold">Total Stock Issued (OUT)</div>
            <div class="text-lg font-bold text-amber-900 font-mono">${totalIssued}</div>
            <div class="text-[9px] text-amber-700">නිකුත් කළ ප්‍රමාණය</div>
          </div>
          <div class="p-2.5 bg-emerald-50 border border-emerald-300 rounded text-center">
            <div class="text-[10px] text-emerald-800 uppercase font-bold">Total Stock Received (IN)</div>
            <div class="text-lg font-bold text-emerald-900 font-mono">${totalReceived}</div>
            <div class="text-[9px] text-emerald-700">ලැබුණු ප්‍රමාණය</div>
          </div>
          <div class="p-2.5 bg-blue-50 border border-blue-300 rounded text-center">
            <div class="text-[10px] text-blue-800 uppercase font-bold">Distinct Item Types</div>
            <div class="text-lg font-bold text-blue-900 font-mono">${uniqueItems}</div>
            <div class="text-[9px] text-blue-700">භාණ්ඩ වර්ග ගණන</div>
          </div>
        </div>

        <!-- Movement Table -->
        <table class="report-table mb-6">
          <thead>
            <tr>
              <th style="width: 5%;">No.</th>
              <th style="width: 8%;">Time</th>
              <th style="width: 13%;">Barcode</th>
              <th style="width: 26%; text-align: left;">Item Description</th>
              <th style="width: 14%;">Type (වර්ගය)</th>
              <th style="width: 8%;">Qty</th>
              <th style="width: 16%; text-align: left;">Issued To / Recipient</th>
              <th style="width: 10%; text-align: left;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Signatures for Daily Movement Audit -->
        <div class="signatures-section mt-8 pt-4 border-t border-slate-400 page-break-inside-avoid">
          <div class="text-xs text-center text-slate-800 font-medium mb-8">
            I hereby certify that the above daily stock issues and receipts have been physically verified and recorded accurately.
            <div class="text-[10px] text-slate-500 mt-0.5">(ඉහත සඳහන් දෛනික තොග නිකුත් කිරීම් හා ලැබීම් භෞතිකව පරීක්ෂා කර නිවැරදිව වාර්තා කළ බව සහතික කරමි)</div>
          </div>
          <div class="grid grid-cols-3 gap-6 text-center text-xs">
            <div>
              <div class="border-b border-dotted border-slate-600 mb-1 w-3/4 mx-auto h-8"></div>
              <div class="font-bold text-slate-800">Store Keeper / Inventory Clerk</div>
              <div class="text-[10px] text-slate-500">ගබඩා භාරකරු / ලිපිකරු</div>
            </div>
            <div>
              <div class="border-b border-dotted border-slate-600 mb-1 w-3/4 mx-auto h-8"></div>
              <div class="font-bold text-slate-800">General Manager</div>
              <div class="text-[10px] text-slate-500">කළමනාකාර</div>
            </div>
            <div>
              <div class="border-b border-dotted border-slate-600 mb-1 w-3/4 mx-auto h-8"></div>
              <div class="font-bold text-slate-800">Internal Auditor</div>
              <div class="text-[10px] text-slate-500">අභ්‍යන්තර විගණක</div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex justify-between items-center text-[9px] text-slate-400 mt-6 pt-2 border-t border-slate-200 font-mono">
            <span>Galapitiyagama Sanasa Bank - Daily Inventory Movement Audit</span>
            <span>Printed: ${dateStr} ${timeStr}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Filter items based on report type
  let reportItems = [...AppState.items];
  let reportTitle = "FIXED ASSET & EQUIPMENT REGISTER (දේපළ පිරියත උපකරණ ලේඛණය)";
  let reportSubtitle = `As at 2025-12-31 (Printed: ${dateStr} ${timeStr})`;

  if (reportType === 'low_stock') {
    reportItems = getLowStockItems();
    reportTitle = "LOW STOCK & URGENT RE-ORDER REPORT";
    reportSubtitle = `Emergency Replenishment Schedule - ${dateStr}`;
  } else if (reportType === 'consumables') {
    reportItems = AppState.items.filter(i => i.type === 'consumable');
    reportTitle = "STATIONERY & CONSUMABLES INVENTORY REGISTER";
    reportSubtitle = `Branch Operations Stock Balance - ${dateStr}`;
  }

  // Calculate totals
  const totalCost = reportItems.reduce((sum, i) => sum + (Number(i.cost) * (Number(i.qty) || 1) || 0), 0);
  const totalDepr = reportItems.reduce((sum, i) => sum + (Number(i.accumulatedDepr) || 0), 0);
  const totalNet = reportItems.reduce((sum, i) => sum + (Number(i.netValue) || 0), 0);
  const totalQty = reportItems.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

  // Group by category for fixed assets
  const categories = {};
  reportItems.forEach(item => {
    if (!categories[item.category]) categories[item.category] = [];
    categories[item.category].push(item);
  });

  let tablesHtml = '';
  let overallIndex = 1;

  for (const [catName, catItems] of Object.entries(categories)) {
    const catCost = catItems.reduce((sum, i) => sum + (Number(i.cost) * (Number(i.qty) || 1) || 0), 0);
    const catNet = catItems.reduce((sum, i) => sum + (Number(i.netValue) || 0), 0);

    tablesHtml += `
      <div class="mb-6 page-break-inside-avoid">
        <div class="bg-slate-200 text-slate-900 font-bold px-3 py-1.5 text-xs uppercase border border-slate-400 flex justify-between">
          <span>${getCategoryEnglishName(catName)}</span>
          <span class="text-[10px] text-slate-600 font-mono">${catName}</span>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 5%;">No.</th>
              <th style="width: 14%;">Barcode</th>
              <th style="width: 25%; text-align: left;">Item Description</th>
              <th style="width: 10%;">Purchase Date</th>
              <th style="width: 6%;">Qty</th>
              <th style="width: 13%; text-align: right;">Cost (Rs.)</th>
              <th style="width: 13%; text-align: right;">Accum. Depr (Rs.)</th>
              <th style="width: 14%; text-align: right;">Net Value (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${catItems.map(item => `
              <tr>
                <td style="text-align: center;">${overallIndex++}</td>
                <td style="text-align: center; font-family: monospace; font-size: 8pt;">${item.barcode}</td>
                <td style="text-align: left; font-weight: 500;">${item.name}</td>
                <td style="text-align: center;">${item.purchaseDate || '-'}</td>
                <td style="text-align: center; font-weight: bold;">${item.qty}</td>
                <td style="text-align: right; font-family: monospace;">${(Number(item.cost) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="text-align: right; font-family: monospace;">${(Number(item.accumulatedDepr) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="text-align: right; font-family: monospace; font-weight: bold;">${(Number(item.netValue) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <td colspan="4" style="text-align: right;">Subtotal (${getCategoryEnglishName(catName)}):</td>
              <td style="text-align: center;">${catItems.reduce((s, i) => s + (Number(i.qty) || 0), 0)}</td>
              <td style="text-align: right; font-family: monospace;">${catCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="text-align: right;">-</td>
              <td style="text-align: right; font-family: monospace;">${catNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <div class="print-page bg-white p-6 max-w-5xl mx-auto border border-slate-200 shadow-sm">
      <!-- Bank Letterhead -->
      <div class="text-center border-b-2 border-slate-800 pb-3 mb-4">
        <h2 class="text-lg font-bold text-slate-900 leading-tight">GALAPITIYAGAMA THRIFT & CREDIT CO-OPERATIVE SOCIETY LTD</h2>
        <div class="text-xs text-slate-600 font-medium">සීමා සහිත ගලපිටියාගම සකසුරුවම් හා ණය ගනුදෙනු පිළිබඳ සමූපකාර සමිතිය &bull; SANASA BANK</div>
        <div class="text-sm font-bold text-slate-800 mt-1">${reportTitle}</div>
        <div class="text-xs text-slate-500 mt-0.5">${reportSubtitle}</div>
      </div>

      <!-- Report Tables -->
      ${tablesHtml}

      <!-- Grand Totals Section -->
      <div class="p-3 bg-slate-100 border border-slate-400 rounded mt-4 page-break-inside-avoid">
        <div class="flex justify-between items-center text-xs font-bold">
          <span>Total Item Types: ${reportItems.length} | Total Stock Count: ${totalQty}</span>
          <span>Total Original Cost: Rs. ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span>Total Net Value: Rs. ${totalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <!-- Official Certification & Signatures Section (Matching Sanasa SmartCoop Format) -->
      <div class="signatures-section mt-8 pt-4 border-t border-slate-400">
        <div class="text-xs text-center text-slate-800 font-medium mb-10">
          We hereby certify that the balances and asset schedule from item 1 to ${reportItems.length} are accurate and verified.
          <div class="text-[10px] text-slate-500 mt-0.5">(අනු 1 සිට ${reportItems.length} දක්වා ගිණුම් උපලේඛනයේ සඳහන් ශේෂයන් නිවැරදි බවට සහතික කරමු)</div>
        </div>
        <div class="grid grid-cols-3 gap-6 text-center text-xs">
          <div>
            <div class="border-b border-dotted border-slate-600 mb-1 w-3/4 mx-auto h-8"></div>
            <div class="font-bold text-slate-800">Hon. President / Chairman</div>
            <div class="text-[10px] text-slate-500">ගරු සභාපති</div>
          </div>
          <div>
            <div class="border-b border-dotted border-slate-600 mb-1 w-3/4 mx-auto h-8"></div>
            <div class="font-bold text-slate-800">Hon. Secretary</div>
            <div class="text-[10px] text-slate-500">ගරු ලේකම්</div>
          </div>
          <div>
            <div class="border-b border-dotted border-slate-600 mb-1 w-3/4 mx-auto h-8"></div>
            <div class="font-bold text-slate-800">General Manager</div>
            <div class="text-[10px] text-slate-500">කළමනාකාර</div>
          </div>
        </div>

        <div class="mt-8 pt-4 border-t border-dashed border-slate-300">
          <div class="text-xs text-slate-700 italic mb-4">Inspected and verified for internal audit (විගණනය සඳහා පරීක්ෂා කරන ලදී)</div>
          <div class="w-1/3 text-center text-xs">
            <div class="border-b border-dotted border-slate-600 mb-1 h-6"></div>
            <div class="font-bold text-slate-800">Internal Auditor</div>
            <div class="text-[10px] text-slate-500">විගණක</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-between items-center text-[9px] text-slate-400 mt-6 pt-2 border-t border-slate-200 font-mono">
          <span>Galapitiyagama Sanasa Bank Inventory System</span>
          <span>Printed on: ${dateStr} ${timeStr}</span>
        </div>
      </div>
    </div>
  `;
}

function printOfficialReport() {
  preparePrintStyles('a4-report');
  const reportType = document.getElementById('reportTypeSelect')?.value || 'asset_register';
  const printArea = document.getElementById('printableArea');
  printArea.innerHTML = generateOfficialReportHtml(reportType);
  setTimeout(() => {
    window.print();
  }, 100);
}

// --- DATA BACKUP & RESTORE ---
function exportDataBackup() {
  const backup = {
    organization: "Galapitiyagama Sanasa Bank",
    version: "1.0",
    exportDate: new Date().toISOString(),
    items: AppState.items,
    transactions: AppState.transactions
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Sanasa_Galapitiyagama_Inventory_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSON Backup downloaded successfully!', 'success');
}

function importDataBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.items)) {
        AppState.items = data.items;
        if (Array.isArray(data.transactions)) {
          AppState.transactions = data.transactions;
        }
        saveItems();
        saveTransactions();
        renderAll();
        checkLowStockAlerts();
        showToast('Data restored successfully from backup!', 'success');
      } else {
        throw new Error('Invalid structure');
      }
    } catch (err) {
      showToast('Invalid backup file: ' + err.message, 'danger');
    }
  };
  reader.readAsText(file);
}

function exportToCsv() {
  const headers = ["No.", "Barcode", "Item Name", "Category", "Purchase Date", "Quantity", "Cost (Rs.)", "Net Value (Rs.)", "Location", "Condition"];
  const rows = AppState.items.map((item, idx) => [
    idx + 1,
    `"${item.barcode}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.category}"`,
    `"${item.purchaseDate || ''}"`,
    item.qty,
    item.cost,
    item.netValue,
    `"${(item.location || '').replace(/"/g, '""')}"`,
    `"${item.condition || ''}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Sanasa_Inventory_Export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Excel/CSV export downloaded successfully!', 'success');
}

function resetToDefaultDataset() {
  if (confirm('Are you sure you want to reset all data back to the default SmartCoop bank dataset (77+ items)? Any newly added items will be replaced.')) {
    AppState.items = [...INITIAL_BANK_ITEMS];
    AppState.transactions = [...INITIAL_TRANSACTIONS];
    saveItems();
    saveTransactions();
    renderAll();
    checkLowStockAlerts();
    showToast('System reset to initial default dataset.', 'info');
  }
}

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
  // Navigation buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Search input
  const searchInput = document.getElementById('itemSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.searchTerm = e.target.value;
      renderItemsTable();
    });
  }

  // Division filter
  const divFilter = document.getElementById('divisionFilterSelect');
  if (divFilter) {
    divFilter.addEventListener('change', (e) => {
      AppState.departmentFilter = e.target.value;
      renderItemsTable();
      renderDivisionPills();
    });
  }

  // Category filter
  const catFilter = document.getElementById('categoryFilterSelect');
  if (catFilter) {
    catFilter.addEventListener('change', (e) => {
      AppState.categoryFilter = e.target.value;
      renderItemsTable();
    });
  }

  // Stock status filter
  const stockFilter = document.getElementById('stockStatusFilterSelect');
  if (stockFilter) {
    stockFilter.addEventListener('change', (e) => {
      AppState.stockStatusFilter = e.target.value;
      renderItemsTable();
    });
  }

  // Item form submit
  const itemForm = document.getElementById('itemForm');
  if (itemForm) itemForm.addEventListener('submit', saveItemForm);

  // Stock In/Out form submit
  const stockInOutForm = document.getElementById('stockInOutForm');
  if (stockInOutForm) stockInOutForm.addEventListener('submit', saveStockInOut);

  // Manual Barcode Input
  const manualInput = document.getElementById('manualBarcodeInput');
  if (manualInput) manualInput.addEventListener('keydown', handleManualBarcodeScan);

  // PDF File Drop / Change
  const pdfInput = document.getElementById('pdfFileInput');
  if (pdfInput) {
    pdfInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handlePdfUpload(e.target.files[0]);
      }
    });
  }

  // Backup File Input
  const backupInput = document.getElementById('backupFileInput');
  if (backupInput) {
    backupInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importDataBackup(e.target.files[0]);
      }
    });
  }

  // Report Date Picker default
  const datePicker = document.getElementById('reportDatePicker');
  if (datePicker && !datePicker.value) {
    datePicker.value = new Date().toISOString().split('T')[0];
  }
  handleReportTypeChange();
}

// Global render update
function renderAll() {
  populateDivisionFilter();
  renderDashboard();
  renderItemsTable();
  updateSelectedLabelCount();
  if (AppState.activeTab === 'barcode') renderBarcodeCenter();
  if (AppState.activeTab === 'lowstock') renderLowStockView();
  if (AppState.activeTab === 'reports') renderReportsView();
  if (AppState.activeTab === 'transactions') renderTransactionsTable();
  if (AppState.activeTab === 'settings') renderDepartmentList();
}
