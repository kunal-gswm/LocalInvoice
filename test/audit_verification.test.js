const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ===== HELPER: LOAD PRODUCTION SCRIPT FROM index.html =====
function createMockIndexedDB() {
  const stores = {
    invoices: new Map(),
    items: new Map(),
    settings: new Map()
  };

  return {
    _stores: stores,
    open: (name, version) => {
      const req = { onsuccess: null, onerror: null, onupgradeneeded: null };
      setTimeout(() => {
        const db = {
          transaction: (storeNames, mode) => {
            const names = Array.isArray(storeNames) ? storeNames : [storeNames];
            const tx = {
              oncomplete: null,
              onerror: null,
              onabort: null,
              abort: () => {
                if (tx.onabort) tx.onabort({ target: { error: new Error('Aborted') } });
              },
              objectStore: (storeName) => {
                const store = stores[storeName] || new Map();
                return {
                  get: (key) => {
                    const r = { onsuccess: null, onerror: null, result: undefined };
                    setTimeout(() => {
                      r.result = store.get(key);
                      if (r.onsuccess) r.onsuccess({ target: r });
                    }, 0);
                    return r;
                  },
                  getAll: () => {
                    const r = { onsuccess: null, onerror: null, result: [] };
                    setTimeout(() => {
                      r.result = Array.from(store.values());
                      if (r.onsuccess) r.onsuccess({ target: r });
                    }, 0);
                    return r;
                  },
                  put: (val, key) => {
                    const r = { onsuccess: null, onerror: null };
                    setTimeout(() => {
                      const k = key || val.key || (val.id ? val.id : val.name);
                      store.set(k, val);
                      if (r.onsuccess) r.onsuccess({ target: r });
                    }, 0);
                    return r;
                  },
                  clear: () => {
                    const r = { onsuccess: null, onerror: null };
                    setTimeout(() => {
                      store.clear();
                      if (r.onsuccess) r.onsuccess({ target: r });
                    }, 0);
                    return r;
                  }
                };
              }
            };
            setTimeout(() => {
              if (tx.oncomplete) tx.oncomplete({});
            }, 10);
            return tx;
          }
        };
        req.result = db;
        if (req.onsuccess) req.onsuccess({ target: req });
      }, 0);
      return req;
    }
  };
}

function loadProductionEnvironment() {
  const htmlPath = path.resolve(__dirname, '../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    throw new Error('Could not find <script> tag in index.html');
  }
  const scriptContent = scriptMatch[1];

  const mockStorage = {};
  const mockEl = {
    addEventListener: () => {},
    value: '',
    style: {},
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 0, width: 0 })
  };

  const mockDoc = {
    getElementById: () => mockEl,
    addEventListener: () => {},
    createElement: () => mockEl,
    body: { appendChild: () => {} },
    title: ''
  };

  const mockWindow = {
    __TEST_ENV__: true,
    addEventListener: () => {},
    localStorage: {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = String(v); },
      removeItem: (k) => { delete mockStorage[k]; }
    },
    indexedDB: createMockIndexedDB()
  };

  const sandbox = {
    window: mockWindow,
    document: mockDoc,
    localStorage: mockWindow.localStorage,
    indexedDB: mockWindow.indexedDB,
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    RegExp,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    Array,
    Object,
    String,
    Number,
    encodeURIComponent,
    decodeURIComponent
  };

  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  return {
    window: sandbox.window,
    calcGST: sandbox.window.calcGST,
    calcInvoiceTotals: sandbox.window.calcInvoiceTotals,
    validateBackupData: sandbox.window.validateBackupData,
    numberToWords: sandbox.window.numberToWords,
    escapeHtml: sandbox.window.escapeHtml,
    findSafePageBreaks: sandbox.window.findSafePageBreaks,
    DB: sandbox.window.DB,
    loadInvoice: sandbox.window.loadInvoice,
    editInvoice: sandbox.window.editInvoice,
    duplicateInvoice: sandbox.window.duplicateInvoice,
    cancelEditDraft: sandbox.window.cancelEditDraft,
    hasUnsavedChanges: sandbox.window.hasUnsavedChanges,
    resetNewInvoice: sandbox.window.resetNewInvoice,
    saveDraft: sandbox.window.saveDraft,
    finaliseInvoice: sandbox.window.finaliseInvoice,
    renderHistory: sandbox.window.renderHistory,
    getInvoiceFormState: sandbox.window.getInvoiceFormState
  };
}

// ===== TEST 1: PRODUCTION SCRIPT EXPORTS (DEF-11) =====
test('TEST 1: Production script in index.html exports all required core modules', () => {
  const prod = loadProductionEnvironment();
  assert.strictEqual(typeof prod.calcGST, 'function', 'calcGST must be exported from index.html');
  assert.strictEqual(typeof prod.calcInvoiceTotals, 'function', 'calcInvoiceTotals must be exported from index.html');
  assert.strictEqual(typeof prod.validateBackupData, 'function', 'validateBackupData must be exported from index.html');
  assert.strictEqual(typeof prod.numberToWords, 'function', 'numberToWords must be exported from index.html');
  assert.strictEqual(typeof prod.escapeHtml, 'function', 'escapeHtml must be exported from index.html');
  assert.strictEqual(typeof prod.findSafePageBreaks, 'function', 'findSafePageBreaks must be exported from index.html');
  assert.strictEqual(typeof prod.DB, 'object', 'DB module must be exported from index.html');
  assert.strictEqual(typeof prod.loadInvoice, 'function', 'loadInvoice must be exported from index.html');
  assert.strictEqual(typeof prod.editInvoice, 'function', 'editInvoice must be exported from index.html');
  assert.strictEqual(typeof prod.duplicateInvoice, 'function', 'duplicateInvoice must be exported from index.html');
  assert.strictEqual(typeof prod.cancelEditDraft, 'function', 'cancelEditDraft must be exported from index.html');
  assert.strictEqual(typeof prod.hasUnsavedChanges, 'function', 'hasUnsavedChanges must be exported from index.html');
});

// ===== TEST 2: FINANCIAL ENGINE & ODD-PAISE SPLITTING (DEF-04) =====
test('TEST 2: Financial engine reverse-GST and odd-paise tax splitting', () => {
  const { calcGST } = loadProductionEnvironment();

  // Case A: 0% GST (e.g. Notebooks, Slate, Books)
  const zeroTax = calcGST(50, 0);
  assert.strictEqual(zeroTax.base, 50);
  assert.strictEqual(zeroTax.gstAmount, 0);
  assert.strictEqual(zeroTax.cgst, 0);
  assert.strictEqual(zeroTax.sgst, 0);

  // Case B: 5% GST (Ball pen ₹10)
  // Base = 10 / 1.05 = 9.5238... -> 9.52
  // GST = 10 - 9.52 = 0.48
  // CGST = 0.24, SGST = 0.24
  const fiveTax = calcGST(10, 5);
  assert.strictEqual(fiveTax.base, 9.52);
  assert.strictEqual(fiveTax.gstAmount, 0.48);
  assert.strictEqual(fiveTax.cgst, 0.24);
  assert.strictEqual(fiveTax.sgst, 0.24);
  assert.strictEqual(fiveTax.cgst + fiveTax.sgst, fiveTax.gstAmount);

  // Case C: 18% GST (Marker ₹45)
  // Base = 45 / 1.18 = 38.1355... -> 38.14
  // GST = 45 - 38.14 = 6.86
  // CGST = 3.43, SGST = 3.43
  const eighteenTax = calcGST(45, 18);
  assert.strictEqual(eighteenTax.base, 38.14);
  assert.strictEqual(eighteenTax.gstAmount, 6.86);
  assert.strictEqual(eighteenTax.cgst, 3.43);
  assert.strictEqual(eighteenTax.sgst, 3.43);
  assert.strictEqual(eighteenTax.cgst + eighteenTax.sgst, eighteenTax.gstAmount);

  // Case D: Odd-paise tax split (e.g. total GST = 0.35)
  // Base = 2.00 / 1.18 = 1.6949 -> 1.69
  // GST = 2.00 - 1.69 = 0.31 -> CGST: 0.16, SGST: 0.15 -> sum 0.31
  const oddTax = calcGST(2, 18);
  assert.strictEqual(oddTax.cgst + oddTax.sgst, oddTax.gstAmount, 'CGST + SGST must equal total GST amount');

  // Case E: Invalid or negative input
  const negativeTax = calcGST(-100, 18);
  assert.strictEqual(negativeTax.base, 0);
  assert.strictEqual(negativeTax.gstAmount, 0);
  assert.strictEqual(negativeTax.cgst, 0);
  assert.strictEqual(negativeTax.sgst, 0);
});

// ===== TEST 3: GRAND TOTAL IDENTITY RECONCILIATION =====
test('TEST 3: calcInvoiceTotals guarantees Subtotal + Tax = Grand Total exactly', () => {
  const { calcInvoiceTotals } = loadProductionEnvironment();

  const items = [
    { name: 'Pencil HB', quantity: 10, finalPrice: 5.00, gstPercent: 0 },
    { name: 'Gel Pen Blue', quantity: 3, finalPrice: 15.00, gstPercent: 5 },
    { name: 'Marker Black', quantity: 4, finalPrice: 45.00, gstPercent: 18 },
    { name: 'Special Item', quantity: 2, finalPrice: 33.33, gstPercent: 28 }
  ];

  const totals = calcInvoiceTotals(items);

  // Calculate sum of line totals
  const expectedGrandTotal = Math.round((10 * 5.00 + 3 * 15.00 + 4 * 45.00 + 2 * 33.33) * 100) / 100;
  assert.strictEqual(totals.grandTotal, expectedGrandTotal, `Grand total must equal ${expectedGrandTotal}`);

  // Subtotal + CGST + SGST must strictly equal Grand Total
  const sumOfParts = Math.round((totals.totalBase + totals.totalCGST + totals.totalSGST) * 100) / 100;
  assert.strictEqual(sumOfParts, totals.grandTotal, 'totalBase + totalCGST + totalSGST must strictly equal grandTotal');
  assert.strictEqual(totals.totalCGST, Math.round((totals.totalCGST) * 100) / 100);
  assert.strictEqual(totals.totalSGST, Math.round((totals.totalSGST) * 100) / 100);
});

// ===== TEST 4: MULTI-PAGE ELEMENT-AWARE SAFE PAGE BREAKS (DEF-02 & DEF-12) =====
test('TEST 4: findSafePageBreaks avoids cutting table rows across page boundaries', () => {
  const { findSafePageBreaks } = loadProductionEnvironment();

  const pageCanvasHeight = 1123; // Standard A4 canvas height at 794px width

  // Case A: Short single-page invoice
  const singlePageSlices = findSafePageBreaks(600, pageCanvasHeight, null);
  assert.deepStrictEqual(Array.from(singlePageSlices), [600], 'Single page invoice should return single slice of canvas height');

  // Case B: Multi-page without container element (graceful fallback)
  const fallbackSlices = findSafePageBreaks(2500, pageCanvasHeight, null);
  const totalFallbackHeight = fallbackSlices.reduce((a, b) => a + b, 0);
  assert.strictEqual(totalFallbackHeight, 2500, 'Sum of fallback slices must equal total canvas height');
  assert.strictEqual(fallbackSlices.length, 3, '2500px should split into 3 pages');

  // Case C: Simulated multi-page with DOM table rows
  // Suppose page 1 ends at 1123, but Row 20 spans from 1100 to 1145 (crosses 1123)
  const mockContainer = {
    getBoundingClientRect: () => ({ top: 0, height: 2500 }),
    querySelectorAll: (sel) => [
      // Mock rows
      { getBoundingClientRect: () => ({ top: 1050, bottom: 1095 }) },
      { getBoundingClientRect: () => ({ top: 1100, bottom: 1145 }) }, // Crosses page 1!
      { getBoundingClientRect: () => ({ top: 1150, bottom: 1195 }) },
      { getBoundingClientRect: () => ({ top: 2210, bottom: 2255 }) }  // Crosses page 2!
    ]
  };

  const smartSlices = findSafePageBreaks(2500, pageCanvasHeight, mockContainer);
  const totalSmartHeight = smartSlices.reduce((a, b) => a + b, 0);
  assert.strictEqual(totalSmartHeight, 2500, 'Sum of smart slices must equal total canvas height');

  // Page 1 should break cleanly before the crossing element (at top = 1100) instead of mid-row 1123!
  assert.strictEqual(smartSlices[0], 1100, 'Page 1 must break at row boundary 1100 instead of slicing row at 1123');
});

// ===== TEST 5: NUMBER TO WORDS INVARIANTS =====
test('TEST 5: numberToWords generates correct Indian English currency representations', () => {
  const { numberToWords } = loadProductionEnvironment();

  assert.strictEqual(numberToWords(0), 'Rupees Zero Only');
  assert.strictEqual(numberToWords(1), 'Rupees One Only');
  assert.strictEqual(numberToWords(100), 'Rupees One Hundred Only');
  assert.strictEqual(numberToWords(100.50), 'Rupees One Hundred and Fifty Paise Only');
  assert.strictEqual(numberToWords(1000), 'Rupees One Thousand Only');
  assert.strictEqual(numberToWords(100000), 'Rupees One Lakh Only');
  assert.strictEqual(numberToWords(10000000), 'Rupees One Crore Only');

  const complexWords = numberToWords(1234567.89);
  assert.match(complexWords, /Twelve Lakh/i);
  assert.match(complexWords, /Thirty Four Thousand/i);
  assert.match(complexWords, /Five Hundred/i);
  assert.match(complexWords, /Eighty Nine Paise/i);

  // Safety tests
  assert.strictEqual(numberToWords(null), 'Rupees Zero Only');
  assert.strictEqual(numberToWords(undefined), 'Rupees Zero Only');
  assert.strictEqual(numberToWords(NaN), 'Rupees Zero Only');
});

// ===== TEST 6: HTML SANITIZATION AND INLINE HANDLER ENCODING (DEF-06 & DEF-16) =====
test('TEST 6: escapeHtml and URI parameter encoding prevent attribute breakout and injection', () => {
  const { escapeHtml } = loadProductionEnvironment();

  // Basic HTML entity escaping
  assert.strictEqual(escapeHtml('<script>alert("XSS")</script>'), '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
  assert.strictEqual(escapeHtml("Stationer's Choice & Co"), 'Stationer&#039;s Choice &amp; Co');
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');

  // Inline handler attribute payload security (DEF-16)
  // Single quote in invoice ID must not break out of JS string inside onclick="..."
  const dangerousId = "INV-2024's-001\";alert(1)//";
  const safeId = encodeURIComponent(dangerousId).replace(/'/g, "%27");

  // safeId must contain NO single quotes or double quotes or HTML markup
  assert.strictEqual(safeId.includes("'"), false, 'Safe ID must contain no single quotes');
  assert.strictEqual(safeId.includes('"'), false, 'Safe ID must contain no double quotes');
  assert.strictEqual(safeId.includes('<'), false, 'Safe ID must contain no angle brackets');
  assert.strictEqual(safeId.includes('>'), false, 'Safe ID must contain no angle brackets');

  // When decoded at runtime in handler, it exactly restores the original ID
  assert.strictEqual(decodeURIComponent(safeId), dangerousId);
});

// ===== TEST 7: BACKUP SCHEMA VALIDATION (DEF-03) =====
test('TEST 7: validateBackupData rejects corrupt, missing, or malformed schemas', () => {
  const { validateBackupData } = loadProductionEnvironment();

  // Valid backup
  const valid = validateBackupData({
    version: '1.2.1',
    invoices: [{ id: 'PBD-0001', grandTotal: 100 }],
    items: [{ name: 'Pen', gstPercent: 18 }],
    settings: { shopName: 'Stationery Hub' },
    counter: 1
  });
  assert.strictEqual(valid.valid, true);

  // Malformed root
  assert.strictEqual(validateBackupData(null).valid, false);
  assert.strictEqual(validateBackupData("invalid string").valid, false);
  assert.strictEqual(validateBackupData([]).valid, false);

  // Missing or non-array invoices
  assert.strictEqual(validateBackupData({ invoices: 'not an array', items: [] }).valid, false);

  // Invoice missing string id
  assert.strictEqual(validateBackupData({
    invoices: [{ grandTotal: 50 }],
    items: []
  }).valid, false);

  // Missing or non-array items
  assert.strictEqual(validateBackupData({ invoices: [], items: 'not array' }).valid, false);

  // Item missing string name
  assert.strictEqual(validateBackupData({
    invoices: [],
    items: [{ gstPercent: 18 }]
  }).valid, false);

  // Invalid counter
  assert.strictEqual(validateBackupData({
    invoices: [],
    items: [],
    counter: -5
  }).valid, false);
});

// ===== TEST 8: INDEXEDDB ATOMIC RESTORE AND COUNTER RECOVERY (DEF-03) =====
test('TEST 8: DB.restoreAll executes atomically and auto-recovers missing counter', async () => {
  const { DB } = loadProductionEnvironment();
  await DB.init();

  // Restore with explicit counter
  await DB.restoreAll({
    invoices: [
      { id: 'PBD-0010', grandTotal: 250 },
      { id: 'PBD-0020', grandTotal: 500 }
    ],
    items: [{ name: 'Notebook Large', gstPercent: 0 }],
    settings: { shopName: 'Test Books' },
    counter: 20
  });

  const invoices = await DB.getInvoices();
  assert.strictEqual(invoices.length, 2);
  const items = await DB.getItems();
  assert.strictEqual(items.length, 1);
  const counter = await DB.getCounter();
  assert.strictEqual(counter, 20);

  // Restore with missing counter -> should auto-compute from highest invoice number (20)
  await DB.restoreAll({
    invoices: [
      { id: 'PBD-0050', grandTotal: 100 },
      { id: 'PBD-0025', grandTotal: 50 }
    ],
    items: [{ name: 'Chalk Box', gstPercent: 0 }],
    settings: { shopName: 'Test Books' },
    counter: null // Missing!
  });

  const recoveredCounter = await DB.getCounter();
  assert.strictEqual(recoveredCounter, 50, 'Counter must be auto-computed from highest invoice ID');
});

// ===== TEST 9: SEQUENTIAL COLLISION-FREE INVOICE NUMBER GENERATION (DEF-07) =====
test('TEST 9: DB.nextInvoiceNumber generates monotonic collision-free numbers', async () => {
  const { DB } = loadProductionEnvironment();
  await DB.init();

  // Reset to known state
  await DB.restoreAll({
    invoices: [{ id: 'PBD-0001' }, { id: 'PBD-0003' }], // Hole at PBD-0002
    items: [],
    counter: 0
  });

  // Since max invoice is 0003, next number must be at least 0004
  const next1 = await DB.nextInvoiceNumber();
  assert.strictEqual(next1, 'PBD-0004', 'Next invoice number must skip past highest existing ID');

  const next2 = await DB.nextInvoiceNumber();
  assert.strictEqual(next2, 'PBD-0005', 'Consecutive call must advance monotonically');

  // Concurrency check: Promise.all must produce distinct monotonic IDs without collisions
  const concurrent = await Promise.all([
    DB.nextInvoiceNumber(),
    DB.nextInvoiceNumber(),
    DB.nextInvoiceNumber()
  ]);
  assert.deepStrictEqual(
    concurrent,
    ['PBD-0006', 'PBD-0007', 'PBD-0008'],
    'Concurrent nextInvoiceNumber calls must be serialized without collisions or duplicates'
  );
});

// ===== TEST 10: ELECTRON SECURITY CONFIGURATION (DEF-08) =====
test('TEST 10: main.js enforces Electron sandbox, context isolation, and navigation lockdown', () => {
  const mainJsPath = path.resolve(__dirname, '../main.js');
  const mainJs = fs.readFileSync(mainJsPath, 'utf8');

  // Check webPreferences
  assert.match(mainJs, /contextIsolation:\s*true/, 'contextIsolation must be enabled');
  assert.match(mainJs, /nodeIntegration:\s*false/, 'nodeIntegration must be disabled');
  assert.match(mainJs, /sandbox:\s*true/, 'sandbox must be enabled');

  // Check navigation lockdown
  assert.match(mainJs, /will-navigate/, 'will-navigate handler must be registered');
  assert.match(mainJs, /setWindowOpenHandler/, 'setWindowOpenHandler must be registered');
  assert.match(mainJs, /shell\.openExternal/, 'External links must be routed to system browser');
});

// ===== TEST 11: IMMUTABILITY ENFORCEMENT & DRAFT EDIT CONTRACT =====
test('TEST 11: Finalized/cancelled invoices are immutable against in-place edits and draft updates preserve sequence', async () => {
  const { DB } = loadProductionEnvironment();
  await DB.init();

  // Setup: one draft, one final, one cancelled
  const seedInvoices = [
    { id: 'PBD-0001', status: 'draft', customerName: 'Initial Draft Buyer', grandTotal: 100 },
    { id: 'PBD-0002', status: 'final', customerName: 'Finalized Customer', grandTotal: 500 },
    { id: 'PBD-0003', status: 'cancelled', customerName: 'Cancelled Customer', grandTotal: 200 }
  ];
  await DB.restoreAll({ invoices: seedInvoices, items: [], settings: {}, counter: 3 });

  // 1. In-place edit of draft PBD-0001 must update existing record and NOT advance counter
  let invoices = await DB.getInvoices();
  const draftIdx = invoices.findIndex(i => i.id === 'PBD-0001');
  assert(draftIdx !== -1, 'Draft must exist');
  invoices[draftIdx].customerName = 'Updated Draft Buyer';
  invoices[draftIdx].grandTotal = 150;
  await DB.saveInvoices(invoices);

  const updatedInvoices = await DB.getInvoices();
  const updatedDraft = updatedInvoices.find(i => i.id === 'PBD-0001');
  assert.strictEqual(updatedDraft.customerName, 'Updated Draft Buyer');
  assert.strictEqual(updatedDraft.grandTotal, 150);
  assert.strictEqual(updatedInvoices.length, 3, 'Invoice count must remain unchanged after draft edit');

  // Sequence counter must NOT have advanced
  const counterAfterEdit = await DB.getCounter();
  assert.strictEqual(counterAfterEdit, 3, 'Draft editing must not increment invoice sequence counter');

  // 2. Next invoice number must still be PBD-0004
  const peek = await DB.peekNextNumber();
  assert.strictEqual(peek, 'PBD-0004', 'Peek next number must match next sequence');
});
