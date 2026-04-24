import re

with open('index.html', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. DB Object Replacement
old_db = """// ===== DATABASE LAYER =====
const DB = {
  getInvoices: () => JSON.parse(localStorage.getItem('li_invoices') || '[]'),
  saveInvoices: (arr) => localStorage.setItem('li_invoices', JSON.stringify(arr)),
  getItems: () => JSON.parse(localStorage.getItem('li_items') || '[]'),
  saveItems: (arr) => localStorage.setItem('li_items', JSON.stringify(arr)),
  getSettings: () => JSON.parse(localStorage.getItem('li_settings') || '{}'),
  saveSettings: (obj) => localStorage.setItem('li_settings', JSON.stringify(obj)),
  _formatInvoiceNumber: (n) => {
    const settings = DB.getSettings();
    const prefix = (settings.invoicePrefix || 'PBD').toUpperCase();
    return `${prefix}-${String(n).padStart(4, '0')}`;
  },
  nextInvoiceNumber: () => {
    const n = parseInt(localStorage.getItem('li_counter') || '0') + 1;
    localStorage.setItem('li_counter', String(n));
    return DB._formatInvoiceNumber(n);
  },
  peekNextNumber: () => {
    const n = parseInt(localStorage.getItem('li_counter') || '0') + 1;
    return DB._formatInvoiceNumber(n);
  }
};"""

new_db = """// ===== INDEXEDDB LAYER =====
const DB = (() => {
  let db = null;

  async function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('LocalInvoiceDB', 1);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('invoices'))
          d.createObjectStore('invoices', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('items'))
          d.createObjectStore('items', { keyPath: 'name' });
        if (!d.objectStoreNames.contains('settings'))
          d.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function tx(store, mode = 'readonly') {
    return db.transaction(store, mode).objectStore(store);
  }

  function getAll(store) {
    return new Promise((resolve, reject) => {
      const req = tx(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function putRecord(store, record) {
    return new Promise((resolve, reject) => {
      const req = tx(store, 'readwrite').put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function putAll(store, records) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      const s = transaction.objectStore(store);
      s.clear();
      records.forEach(r => s.put(r));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  return {
    init: openDB,

    getInvoices: () => getAll('invoices'),
    saveInvoices: (arr) => putAll('invoices', arr),

    getItems: () => getAll('items'),
    saveItems: (arr) => putAll('items', arr),

    getSettings: async () => {
      return new Promise((resolve) => {
        const req = tx('settings').get('main');
        req.onsuccess = () => resolve(req.result?.data || {});
        req.onerror = () => resolve({});
      });
    },
    saveSettings: (obj) => putRecord('settings', { key: 'main', data: obj }),

    _formatInvoiceNumber: (n) => {
      const cached = JSON.parse(localStorage.getItem('li_settings_cache') || '{}');
      const prefix = (cached.invoicePrefix || 'PBD').toUpperCase();
      return `${prefix}-${String(n).padStart(4, '0')}`;
    },
    nextInvoiceNumber: () => {
      const n = parseInt(localStorage.getItem('li_counter') || '0') + 1;
      localStorage.setItem('li_counter', String(n));
      return DB._formatInvoiceNumber(n);
    },
    peekNextNumber: () => {
      const n = parseInt(localStorage.getItem('li_counter') || '0') + 1;
      return DB._formatInvoiceNumber(n);
    }
  };
})();"""
code = code.replace(old_db, new_db)


# 2. initApp
old_init = """function initApp() {
  if (!localStorage.getItem('li_items')) {
    DB.saveItems(SEED_ITEMS);
  }
  if (!localStorage.getItem('li_counter')) {
    localStorage.setItem('li_counter', '0');
  }
  navigate('new');
}"""

new_init = """async function initApp() {
  await DB.init();

  const items = await DB.getItems();
  if (items.length === 0) {
    await DB.saveItems(SEED_ITEMS);
  }
  if (!localStorage.getItem('li_counter')) {
    localStorage.setItem('li_counter', '0');
  }

  const s = await DB.getSettings();
  localStorage.setItem('li_settings_cache', JSON.stringify(s));

  if (!s.shopName) {
    navigate('settings');
    showToast('Welcome! Please fill your shop details first.');
  } else {
    navigate('new');
  }
}"""
code = code.replace(old_init, new_init)

# 3. searchItems -> async, use DB.getItems() with await inside it, but wait: input event listener is better changing synchronously or reading from cache?
# Wait, let's keep searchItems async and change it.
code = code.replace("function searchItems(query) {", "async function searchItems(query) {")
code = code.replace("const items = DB.getItems();", "const items = await DB.getItems();")

# The nameInput.addEventListener('input' ...
event_listener_old = """    nameInput.addEventListener('input', () => {
      const val = nameInput.value.trim();
      if (val.length > 0) {
        const searchData = searchItems(val);
        showAutocomplete(nameInput, searchData);
        // Check if typed name is a known item
        const exact = DB.getItems().find(i => i.name.toLowerCase() === val.toLowerCase());
        if (exact) {
          gstInput.value = exact.gstPercent;
          gstInput.disabled = true;
          tr.querySelector('.item-hsn').value = exact.hsn || '';
          tr.querySelector('.item-unit').value = exact.unit || 'pcs';
        } else {
          gstInput.disabled = false;
        }
      } else {
        hideAllAutocomplete();
        gstInput.disabled = false;
      }
      recalcRow(tr);
    });"""

event_listener_new = """    nameInput.addEventListener('input', async () => {
      const val = nameInput.value.trim();
      if (val.length > 0) {
        const searchData = await searchItems(val);
        showAutocomplete(nameInput, searchData);
        // Check if typed name is a known item
        const items = await DB.getItems();
        const exact = items.find(i => i.name.toLowerCase() === val.toLowerCase());
        if (exact) {
          gstInput.value = exact.gstPercent;
          gstInput.disabled = true;
          tr.querySelector('.item-hsn').value = exact.hsn || '';
          tr.querySelector('.item-unit').value = exact.unit || 'pcs';
        } else {
          gstInput.disabled = false;
        }
      } else {
        hideAllAutocomplete();
        gstInput.disabled = false;
      }
      recalcRow(tr);
    });"""
code = code.replace(event_listener_old, event_listener_new)

# addItemRow isKnown
code = code.replace(
    "const isKnown = data && data.name && DB.getItems().some(i => i.name.toLowerCase() === data.name.toLowerCase().trim());",
    "// We cannot await here if keeping it sync. We run it asynchronously later:\n" +
    "  let isKnown = false;"
)
# We handle isKnown by checking later:
code = code.replace(
    "if (!data && !isReadOnly) nameInput.focus();",
    "if (!data && !isReadOnly) nameInput.focus();\n  if (data && data.name) {\n    DB.getItems().then(items => {\n      isKnown = items.some(i => i.name.toLowerCase() === data.name.toLowerCase().trim());\n      if (isKnown || isReadOnly) tr.querySelector('.item-gst').disabled = true;\n    });\n  }"
)

# Replace other DB.getInvoices, DB.getItems, DB.getSettings
code = code.replace('function fillShopDetails() {\n  const s = DB.getSettings();', 'async function fillShopDetails() {\n  const s = await DB.getSettings();')
code = code.replace('function renderHistory(filter) {\n  const invoices = DB.getInvoices();', 'async function renderHistory(filter) {\n  const invoices = await DB.getInvoices();')
code = code.replace('function renderInventory(query = \'\') {\n  const tbody = document.getElementById(\'inventory-tbody\');\n  let items = DB.getItems();', 'async function renderInventory(query = \'\') {\n  const tbody = document.getElementById(\'inventory-tbody\');\n  let items = await DB.getItems();')
code = code.replace('function loadSettings() {\n  const s = DB.getSettings();', 'async function loadSettings() {\n  const s = await DB.getSettings();')

# saveSettings
save_settings_old = """function saveSettings() {
  const settings = {
    shopName: document.getElementById('set-shop-name').value.trim(),
    shopAddress: document.getElementById('set-shop-address').value.trim(),
    gstNumber: document.getElementById('set-gst-number').value.trim(),
    upiId: document.getElementById('set-upi-id').value.trim(),
    bankName: document.getElementById('set-bank-name').value.trim(),
    accNumber: document.getElementById('set-acc-number').value.trim(),
    ifsc: document.getElementById('set-ifsc').value.trim(),
    accHolder: document.getElementById('set-acc-holder').value.trim(),
    invoicePrefix: document.getElementById('set-invoice-prefix').value.trim()
  };
  DB.saveSettings(settings);"""
save_settings_new = """async function saveSettings() {
  const settings = {
    shopName: document.getElementById('set-shop-name').value.trim(),
    shopAddress: document.getElementById('set-shop-address').value.trim(),
    gstNumber: document.getElementById('set-gst-number').value.trim(),
    upiId: document.getElementById('set-upi-id').value.trim(),
    bankName: document.getElementById('set-bank-name').value.trim(),
    accNumber: document.getElementById('set-acc-number').value.trim(),
    ifsc: document.getElementById('set-ifsc').value.trim(),
    accHolder: document.getElementById('set-acc-holder').value.trim(),
    invoicePrefix: document.getElementById('set-invoice-prefix').value.trim()
  };
  await DB.saveSettings(settings);
  localStorage.setItem('li_settings_cache', JSON.stringify(settings));"""
code = code.replace(save_settings_old, save_settings_new)

# saveDraft
code = code.replace('function saveDraft() {', 'async function saveDraft() {')
code = code.replace('const invoices = DB.getInvoices();', 'const invoices = await DB.getInvoices();')
code = code.replace('DB.saveInvoices(invoices);', 'await DB.saveInvoices(invoices);')
code = code.replace('saveNewItems(data.items);', 'await saveNewItems(data.items);')

# finaliseInvoice
code = code.replace('function finaliseInvoice() {', 'async function finaliseInvoice() {')
code = code.replace("showConfirm('Finalise Invoice', 'Once finalised, this invoice cannot be edited. Continue?', () => {", "showConfirm('Finalise Invoice', 'Once finalised, this invoice cannot be edited. Continue?', async () => {")


# finaliseInvoice internals
code = code.replace('const data = buildInvoiceData(true);\n    const invoices = DB.getInvoices();', 'const data = buildInvoiceData(true);\n    const invoices = await DB.getInvoices();')
code = code.replace('DB.saveInvoices(invoices);\n    saveNewItems(data.items);', 'await DB.saveInvoices(invoices);\n    await saveNewItems(data.items);')
code = code.replace('setReadOnly();\n    renderPrintArea(data);', 'setReadOnly();\n    await renderPrintArea(data);')


# setReadOnly
code = code.replace('const invoices = DB.getInvoices();', 'const invoices = await DB.getInvoices();')
code = code.replace('function setReadOnly() {', 'async function setReadOnly() {')

# loadInvoice
code = code.replace('function loadInvoice(invoiceId) {', 'async function loadInvoice(invoiceId) {')


# renderPrintArea
code = code.replace('function renderPrintArea(inv) {', 'async function renderPrintArea(inv) {')
code = code.replace('const shop = inv.shopSnapshot || DB.getSettings();', 'const shop = inv.shopSnapshot || await DB.getSettings();')

# downloadPDF
code = code.replace('inv = DB.getInvoices().find(', 'const invoices = await DB.getInvoices();\\n    inv = invoices.find(')
code = code.replace('if (!inv.shopSnapshot) inv.shopSnapshot = DB.getSettings();', 'if (!inv.shopSnapshot) inv.shopSnapshot = await DB.getSettings();')
code = code.replace('renderPrintArea(inv);', 'await renderPrintArea(inv);')

# saveNewItems
code = code.replace('function saveNewItems(items) {', 'async function saveNewItems(items) {')
code = code.replace('const savedItems = DB.getItems();', 'const savedItems = await DB.getItems();')
code = code.replace('DB.saveItems(savedItems);', 'await DB.saveItems(savedItems);')

# exportBackup
export_backup_old = """function exportBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    invoices: DB.getInvoices(),
    items: DB.getItems(),
    settings: DB.getSettings(),
    counter: localStorage.getItem('li_counter') || '0'
  };"""
export_backup_new = """async function exportBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '2.0',
    invoices: await DB.getInvoices(),
    items: await DB.getItems(),
    settings: await DB.getSettings(),
    counter: localStorage.getItem('li_counter') || '0'
  };"""
code = code.replace(export_backup_old, export_backup_new)

# importBackup
import_backup_old = """function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const invCount = (data.invoices || []).length;
      const itemCount = (data.items || []).length;
      showConfirm('Import Backup',
        `This will import ${invCount} invoices and ${itemCount} items. Current data will be overwritten. Continue?`,
        () => {
          DB.saveInvoices(data.invoices || []);
          DB.saveItems(data.items || []);
          if (data.settings) DB.saveSettings(data.settings);
          if (data.counter) localStorage.setItem('li_counter', data.counter);
          showToast('Backup restored successfully!');
          setTimeout(() => location.reload(), 800);
        }
      );"""
import_backup_new = """async function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const invCount = (data.invoices || []).length;
      const itemCount = (data.items || []).length;
      showConfirm('Import Backup',
        `Import ${invCount} invoices and ${itemCount} items? Current data will be replaced.`,
        async () => {
          await DB.saveInvoices(data.invoices || []);
          await DB.saveItems(data.items || []);
          if (data.settings) {
            await DB.saveSettings(data.settings);
            localStorage.setItem('li_settings_cache', JSON.stringify(data.settings));
          }
          if (data.counter) localStorage.setItem('li_counter', data.counter);
          showToast('Backup restored!');
          setTimeout(() => location.reload(), 800);
        }
      );"""
code = code.replace(import_backup_old, import_backup_new)

# cancelInvoiceAction
code = code.replace('function cancelInvoiceAction(id) {\n  showConfirm(', 'function cancelInvoiceAction(id) {\n  showConfirm(\'Cancel Invoice\', `Mark invoice ${id} as Cancelled? This cannot be undone.`, async () => {\n')
# Wait, let's fix cancelInvoiceAction properly
cancel_old = """function cancelInvoiceAction(id) {
  showConfirm('Cancel Invoice', `Mark invoice ${id} as Cancelled? This cannot be undone.`, () => {
    const invoices = DB.getInvoices();
    const inv = invoices.find(i => i.id === id);
    if (inv) {
      inv.status = 'cancelled';
      inv.updatedAt = new Date().toISOString();
      DB.saveInvoices(invoices);
      showToast('Invoice ' + id + ' cancelled.');
      renderHistory(document.getElementById('search-invoices').value);
    }
  });
}"""
cancel_new = """function cancelInvoiceAction(id) {
  showConfirm('Cancel Invoice', `Mark invoice ${id} as Cancelled? This cannot be undone.`, async () => {
    const invoices = await DB.getInvoices();
    const inv = invoices.find(i => i.id === id);
    if (inv) {
      inv.status = 'cancelled';
      inv.updatedAt = new Date().toISOString();
      await DB.saveInvoices(invoices);
      showToast('Invoice ' + id + ' cancelled.');
      renderHistory(document.getElementById('search-invoices').value);
    }
  });
}"""
if cancel_old in code:
    code = code.replace(cancel_old, cancel_new)
else:
    # Handle slight variations
    code = code.replace('() => {\n    const invoices = DB.getInvoices();', 'async () => {\n    const invoices = await DB.getInvoices();')
    code = code.replace('DB.saveInvoices(invoices);', 'await DB.saveInvoices(invoices);')

# openItemModal
code = code.replace('function openItemModal(encodedName = null) {\n  const modal =', 'async function openItemModal(encodedName = null) {\n  const modal =')
code = code.replace('const item = DB.getItems().find', 'const items = await DB.getItems();\n    const item = items.find')

# saveItemFromModal
code = code.replace('function saveItemFromModal() {', 'async function saveItemFromModal() {')
code = code.replace('let items = DB.getItems();', 'let items = await DB.getItems();')

# deleteItem
code = code.replace('function deleteItem(encodedName) {\n  const name = decodeURIComponent(encodedName);\n  showConfirm(', 'async function deleteItem(encodedName) {\n  const name = decodeURIComponent(encodedName);\n  showConfirm(\'Delete Item\', `Are you sure you want to delete "${name}"?`, async () => {')
# and replace DB.getItems() inside it
delete_old = """async function deleteItem(encodedName) {
  const name = decodeURIComponent(encodedName);
  showConfirm('Delete Item', `Are you sure you want to delete "${name}"?`, async () => {
    let items = DB.getItems();
    items = items.filter(i => i.name !== name);
    DB.saveItems(items);
    showToast('Item deleted!');
    renderInventory(document.getElementById('search-inventory').value);
  });
}"""
delete_new = """async function deleteItem(encodedName) {
  const name = decodeURIComponent(encodedName);
  showConfirm('Delete Item', `Are you sure you want to delete "${name}"?`, async () => {
    let items = await DB.getItems();
    items = items.filter(i => i.name !== name);
    await DB.saveItems(items);
    showToast('Item deleted!');
    renderInventory(document.getElementById('search-inventory').value);
  });
}"""
code = code.replace("showConfirm('Delete Item', `Are you sure you want to delete \"${name}\"?`, () => {\n    let items = DB.getItems();\n    items = items.filter(i => i.name !== name);\n    DB.saveItems(items);", "showConfirm('Delete Item', `Are you sure you want to delete \"${name}\"?`, async () => {\n    let items = await DB.getItems();\n    items = items.filter(i => i.name !== name);\n    await DB.saveItems(items);")

code = code.replace('reprintInvoice(id) {\n  const inv = DB.getInvoices()', 'async function reprintInvoice(id) {\n  const invoices = await DB.getInvoices();\n  const inv = invoices.find')
code = code.replace('function reprintInvoice(id) {', 'async function reprintInvoice(id) {')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(code)

print('Success')
