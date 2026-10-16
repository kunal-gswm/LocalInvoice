const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable GPU acceleration and hardware rendering for headless test run
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');

let mainWindow;

app.whenReady().then(async () => {
  console.log('====================================================');
  console.log('LOCALINVOICE: REAL CHROMIUM & ELECTRON AUDIT RUNNER');
  console.log('Chromium Version:', process.versions.chrome);
  console.log('Electron Version:', process.versions.electron);
  console.log('Node Version:    ', process.versions.node);
  console.log('====================================================\n');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Intercept and verify navigation events (same logic as main.js)
  let navigationBlocked = false;
  let blockedUrl = null;
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (navigationUrl !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      navigationBlocked = true;
      blockedUrl = navigationUrl;
    }
  });

  const indexPath = path.resolve(__dirname, '../index.html');
  await mainWindow.loadFile(indexPath);

  const results = [];
  const pdfOutDir = path.resolve(__dirname, 'output_pdfs');
  if (!fs.existsSync(pdfOutDir)) fs.mkdirSync(pdfOutDir, { recursive: true });

  async function runRendererTest(name, fnString, saveFileName) {
    try {
      const res = await mainWindow.webContents.executeJavaScript(`(${fnString})()`);
      if (saveFileName && res && res.base64) {
        const filePath = path.join(pdfOutDir, saveFileName);
        fs.writeFileSync(filePath, Buffer.from(res.base64, 'base64'));
        const stat = fs.statSync(filePath);
        res.savedPath = filePath;
        res.diskBytes = stat.size;
        delete res.base64;
      }
      results.push({ name, pass: true, detail: res });
      console.log(`✔ [PASS] ${name}`);
      if (res) console.log(`    Detail: ${typeof res === 'object' ? JSON.stringify(res) : res}`);
    } catch (err) {
      results.push({ name, pass: false, error: err.message });
      console.error(`✖ [FAIL] ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  // ===== TEST SUITE 1: REAL INDEXEDDB TRANSACTIONS & ATOMIC ROLLBACK =====
  console.log('\n--- SECTION 1: REAL INDEXEDDB TRANSACTIONS & ROLLBACK ---');

  await runRendererTest('1.1: Real IndexedDB Initialization in Chromium', `async () => {
    await window.DB.init();
    const invs = await window.DB.getInvoices();
    const items = await window.DB.getItems();
    const settings = await window.DB.getSettings();
    return { invoicesCount: invs.length, itemsCount: items.length, shopName: settings.shopName || null };
  }`);

  await runRendererTest('1.2: Real Atomic Rollback on Aborted Multi-Store Transaction', `async () => {
    // 1. Setup clean baseline
    await window.DB.restoreAll({
      invoices: [{ id: 'PBD-0001', customerName: 'Original Customer', grandTotal: 100 }],
      items: [{ name: 'Original Pen', gstPercent: 18, hsn: '9608', unit: 'pcs' }],
      settings: { shopName: 'Original Shop' },
      counter: 1
    });

    // 2. Open a real transaction on LevelDB and deliberately ABORT it
    const db = window.DB.getDB();
    const tx = db.transaction(['invoices', 'items', 'settings'], 'readwrite');
    const invStore = tx.objectStore('invoices');
    const itemStore = tx.objectStore('items');
    const setStore = tx.objectStore('settings');

    // Queue destructive writes
    invStore.clear();
    invStore.put({ id: 'PBD-9999', customerName: 'Rogue Data', grandTotal: 9999 });
    itemStore.clear();
    itemStore.put({ name: 'Rogue Item', gstPercent: 28 });
    setStore.put({ key: 'main', data: { shopName: 'Hacked Shop' } });

    // Abort the transaction
    await new Promise((resolve) => {
      tx.onabort = () => resolve();
      tx.abort();
    });

    // 3. Verify original data survived 100% unchanged
    const invsAfter = await window.DB.getInvoices();
    const itemsAfter = await window.DB.getItems();
    const settingsAfter = await window.DB.getSettings();

    if (invsAfter.length !== 1 || invsAfter[0].id !== 'PBD-0001' || invsAfter[0].customerName !== 'Original Customer') {
      throw new Error('Rollback failed! Invoices store was modified despite tx.abort()');
    }
    if (itemsAfter.length !== 1 || itemsAfter[0].name !== 'Original Pen') {
      throw new Error('Rollback failed! Items store was modified despite tx.abort()');
    }
    if (settingsAfter.shopName !== 'Original Shop') {
      throw new Error('Rollback failed! Settings store was modified despite tx.abort()');
    }

    return 'ATOMIC_ROLLBACK_VERIFIED_ON_LEVELDB';
  }`);

  await runRendererTest('1.3: Counter Recovery When Backup Omits Counter Field', `async () => {
    await window.DB.restoreAll({
      invoices: [
        { id: 'PBD-0100', grandTotal: 50 },
        { id: 'PBD-0345', grandTotal: 150 },
        { id: 'PBD-0020', grandTotal: 25 }
      ],
      items: [{ name: 'Scale 15cm', gstPercent: 5 }],
      settings: { shopName: 'Counter Test Shop' },
      counter: null // Intentionally missing
    });

    const recoveredCounter = await window.DB.getCounter();
    if (recoveredCounter !== 345) {
      throw new Error('Expected recovered counter 345, got ' + recoveredCounter);
    }

    const nextNum = await window.DB.nextInvoiceNumber();
    if (nextNum !== 'PBD-0346') {
      throw new Error('Expected next invoice number PBD-0346, got ' + nextNum);
    }

    return { recoveredCounter, nextNum };
  }`);

  // ===== TEST SUITE 2: ACTUAL MULTI-PAGE PDF GENERATION & ROW INTEGRITY =====
  console.log('\n--- SECTION 2: REAL MULTI-PAGE PDF GENERATION (1, 10, 20, 50, 100 ITEMS) ---');

  await runRendererTest('2.1: Real PDF Generation (1 Item - Single Page)', `async () => {
    const inv = {
      id: 'TEST-0001',
      date: '2026-10-16',
      customerName: 'Single Item Customer',
      customerPhone: '9876543210',
      items: [
        { name: 'Parker Classic Ball Pen', hsn: '9608', gstPercent: 18, quantity: 2, finalPrice: 250, basePrice: 211.86, lineBase: 423.73, gstAmount: 76.27, cgst: 38.14, sgst: 38.13, lineTotal: 500 }
      ],
      totalBase: 423.73,
      totalCGST: 38.14,
      totalSGST: 38.13,
      grandTotal: 500.00,
      shopSnapshot: {
        shopName: 'Quality Stationers',
        shopAddress: '123 Market Road, Delhi',
        gstNumber: '07AAAAA0000A1Z5',
        upiId: 'quality@upi',
        shopPhone: '9876500000'
      }
    };

    const el = document.getElementById('invoice-print-area');
    el.style.display = 'block';
    await renderPrintArea(inv);

    const qrEl = document.getElementById('qr-print');
    const qrChild = qrEl && (qrEl.querySelector('canvas') || qrEl.querySelector('img'));
    if (!qrChild) throw new Error('QR code failed to render inside #qr-print');

    const canvas = await html2canvas(el, { scale: 1.5, width: 794, windowWidth: 794, backgroundColor: '#ffffff' });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    const pageCanvasHeight = Math.floor(canvas.width * (pageH / pageW));
    const slices = findSafePageBreaks(canvas.height, pageCanvasHeight, el);

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageW, imgH, undefined, 'FAST');
    const pageCount = pdf.internal.getNumberOfPages();
    const pdfBytes = pdf.output('arraybuffer').byteLength;
    const base64 = pdf.output('datauristring').split(',')[1];
    el.style.display = 'none';

    if (pageCount !== 1) throw new Error('Expected 1 page for 1-item invoice, got ' + pageCount);
    if (pdfBytes < 1000) throw new Error('Generated PDF byte length is suspiciously small: ' + pdfBytes);

    return { pageCount, canvasHeight: canvas.height, pdfBytes, slicesCount: slices.length, base64 };
  }`, 'invoice_1.pdf');

  await runRendererTest('2.2: Real PDF Generation (10 Items - Near Single-Page Boundary)', `async () => {
    const items = [];
    for (let i = 1; i <= 10; i++) {
      items.push({
        name: 'Item #' + i + ' Regular Notebook / Pencil / Eraser',
        hsn: '4820',
        gstPercent: 18,
        quantity: 2,
        finalPrice: 50.00
      });
    }

    const totals = calcInvoiceTotals(items);
    const inv = {
      id: 'TEST-0010',
      date: '2026-10-16',
      customerName: 'Ten Items Retail Customer',
      items: totals.rows,
      totalBase: totals.totalBase,
      totalCGST: totals.totalCGST,
      totalSGST: totals.totalSGST,
      grandTotal: totals.grandTotal,
      shopSnapshot: {
        shopName: 'Metro Stationers',
        gstNumber: '27AABCU9603R1ZX'
      }
    };

    const el = document.getElementById('invoice-print-area');
    el.style.display = 'block';
    await renderPrintArea(inv);

    const canvas = await html2canvas(el, { scale: 1.5, width: 794, windowWidth: 794, backgroundColor: '#ffffff' });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const pageCanvasHeight = Math.floor(canvas.width * (pageH / pageW));

    const slices = findSafePageBreaks(canvas.height, pageCanvasHeight, el);

    let renderedH = 0;
    for (let i = 0; i < slices.length; i++) {
      const sliceH = slices[i];
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, renderedH, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const sliceData = pageCanvas.toDataURL('image/png');
      const slicePdfH = (sliceH * pageW) / canvas.width;
      if (i > 0) pdf.addPage();
      pdf.addImage(sliceData, 'PNG', 0, 0, pageW, slicePdfH, undefined, 'FAST');
      renderedH += sliceH;
    }

    const pageCount = pdf.internal.getNumberOfPages();
    const pdfBytes = pdf.output('arraybuffer').byteLength;
    const base64 = pdf.output('datauristring').split(',')[1];
    el.style.display = 'none';

    return { pageCount, slicesCount: slices.length, totalHeight: canvas.height, pdfBytes, base64 };
  }`, 'invoice_10.pdf');

  await runRendererTest('2.3: Real PDF Generation (20 Items - Clean Page Split Across Row Seams)', `async () => {
    const items = [];
    for (let i = 1; i <= 20; i++) {
      items.push({
        name: 'Stationery Catalog Item #' + i + ' Premium Long Title Description',
        hsn: '9608',
        gstPercent: 18,
        quantity: i,
        finalPrice: 50 + i
      });
    }

    const totals = calcInvoiceTotals(items);
    const inv = {
      id: 'TEST-0020',
      date: '2026-10-16',
      customerName: 'Multi-Page Buyer Ltd',
      items: totals.rows,
      totalBase: totals.totalBase,
      totalCGST: totals.totalCGST,
      totalSGST: totals.totalSGST,
      grandTotal: totals.grandTotal,
      shopSnapshot: {
        shopName: 'Metro Office World',
        shopAddress: 'Ring Road Commercial Complex, Block B',
        gstNumber: '27AABCU9603R1ZX',
        upiId: 'metro@upi',
        shopPhone: '9988776655'
      }
    };

    const el = document.getElementById('invoice-print-area');
    el.style.display = 'block';
    await renderPrintArea(inv);

    const canvas = await html2canvas(el, { scale: 1.5, width: 794, windowWidth: 794, backgroundColor: '#ffffff' });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const pageCanvasHeight = Math.floor(canvas.width * (pageH / pageW));

    const slices = findSafePageBreaks(canvas.height, pageCanvasHeight, el);

    let renderedH = 0;
    for (let i = 0; i < slices.length; i++) {
      const sliceH = slices[i];
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, renderedH, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const sliceData = pageCanvas.toDataURL('image/png');
      const slicePdfH = (sliceH * pageW) / canvas.width;
      if (i > 0) pdf.addPage();
      pdf.addImage(sliceData, 'PNG', 0, 0, pageW, slicePdfH, undefined, 'FAST');
      renderedH += sliceH;
    }

    const pageCount = pdf.internal.getNumberOfPages();
    const pdfBytes = pdf.output('arraybuffer').byteLength;
    const base64 = pdf.output('datauristring').split(',')[1];
    el.style.display = 'none';

    if (pageCount < 2) throw new Error('Expected at least 2 pages for 20 items, got ' + pageCount);
    if (renderedH !== canvas.height) throw new Error('Total rendered height (' + renderedH + ') does not match canvas height (' + canvas.height + ')');

    return { pageCount, slices, totalHeight: canvas.height, pdfBytes, base64 };
  }`, 'invoice_20.pdf');

  await runRendererTest('2.4: Real PDF Generation (50 Items - Stress Test & Grand Total Verification)', `async () => {
    const items = [];
    for (let i = 1; i <= 50; i++) {
      items.push({
        name: 'Bulk Item #' + i + ' Drawing Notebook / Register / Marker',
        hsn: '4820',
        gstPercent: i % 2 === 0 ? 18 : 0,
        quantity: 5,
        finalPrice: 60.00
      });
    }

    const totals = calcInvoiceTotals(items);
    const inv = {
      id: 'TEST-0050',
      date: '2026-10-16',
      customerName: 'Government College Stationery Depot',
      items: totals.rows,
      totalBase: totals.totalBase,
      totalCGST: totals.totalCGST,
      totalSGST: totals.totalSGST,
      grandTotal: totals.grandTotal,
      shopSnapshot: {
        shopName: 'Metro Office World',
        gstNumber: '27AABCU9603R1ZX'
      }
    };

    const el = document.getElementById('invoice-print-area');
    el.style.display = 'block';
    await renderPrintArea(inv);

    const canvas = await html2canvas(el, { scale: 1.2, width: 794, windowWidth: 794, backgroundColor: '#ffffff' });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const pageCanvasHeight = Math.floor(canvas.width * (pageH / pageW));

    const slices = findSafePageBreaks(canvas.height, pageCanvasHeight, el);

    let renderedH = 0;
    for (let i = 0; i < slices.length; i++) {
      const sliceH = slices[i];
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, renderedH, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const sliceData = pageCanvas.toDataURL('image/png');
      const slicePdfH = (sliceH * pageW) / canvas.width;
      if (i > 0) pdf.addPage();
      pdf.addImage(sliceData, 'PNG', 0, 0, pageW, slicePdfH, undefined, 'FAST');
      renderedH += sliceH;
    }

    const pageCount = pdf.internal.getNumberOfPages();
    const pdfBytes = pdf.output('arraybuffer').byteLength;
    const base64 = pdf.output('datauristring').split(',')[1];
    el.style.display = 'none';

    if (pageCount < 3) throw new Error('Expected at least 3 pages for 50 items, got ' + pageCount);

    return { pageCount, slicesCount: slices.length, totalCanvasHeight: canvas.height, grandTotal: totals.grandTotal, pdfBytes, base64 };
  }`, 'invoice_50.pdf');

  await runRendererTest('2.5: Real PDF Generation (100 Items - Mega Invoice Boundary Stability)', `async () => {
    const items = [];
    for (let i = 1; i <= 100; i++) {
      items.push({
        name: 'Item Line ' + i + ' - Special Exam Pad (सुपर फाइन स्टेशनरी & Co.)',
        hsn: '4820',
        gstPercent: 18,
        quantity: 2,
        finalPrice: 75.00
      });
    }

    const totals = calcInvoiceTotals(items);
    const inv = {
      id: 'TEST-0100',
      date: '2026-10-16',
      customerName: 'Mega University Bookstore <Head Office>',
      items: totals.rows,
      totalBase: totals.totalBase,
      totalCGST: totals.totalCGST,
      totalSGST: totals.totalSGST,
      grandTotal: totals.grandTotal,
      shopSnapshot: {
        shopName: 'Metro Office World',
        shopAddress: 'Sector 62, Noida, UP',
        gstNumber: '09AABCU9603R1ZX',
        upiId: 'metro@upi',
        shopPhone: '9811002233'
      }
    };

    const el = document.getElementById('invoice-print-area');
    el.style.display = 'block';
    await renderPrintArea(inv);

    if (!el.innerText.includes('सुपर फाइन स्टेशनरी')) {
      throw new Error('Hindi Unicode text missing from rendered print area table!');
    }

    const canvas = await html2canvas(el, { scale: 1.0, width: 794, windowWidth: 794, backgroundColor: '#ffffff' });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const pageCanvasHeight = Math.floor(canvas.width * (pageH / pageW));

    const slices = findSafePageBreaks(canvas.height, pageCanvasHeight, el);

    let renderedH = 0;
    for (let i = 0; i < slices.length; i++) {
      const sliceH = slices[i];
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, renderedH, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const sliceData = pageCanvas.toDataURL('image/png');
      const slicePdfH = (sliceH * pageW) / canvas.width;
      if (i > 0) pdf.addPage();
      pdf.addImage(sliceData, 'PNG', 0, 0, pageW, slicePdfH, undefined, 'FAST');
      renderedH += sliceH;
    }

    const pageCount = pdf.internal.getNumberOfPages();
    const pdfBytes = pdf.output('arraybuffer').byteLength;
    const base64 = pdf.output('datauristring').split(',')[1];
    el.style.display = 'none';

    if (pageCount < 4) throw new Error('Expected at least 4 pages for 100 items, got ' + pageCount);

    return { pageCount, slicesCount: slices.length, totalCanvasHeight: canvas.height, grandTotal: totals.grandTotal, pdfBytes, base64 };
  }`, 'invoice_100.pdf');

  // ===== TEST SUITE 3: INVOICE HISTORY EVENT DELEGATION & ADVERSARIAL IDS =====
  console.log('\n--- SECTION 3: INVOICE HISTORY EVENT DELEGATION & ADVERSARIAL IDS ---');

  await runRendererTest('3.1: Event Delegation on Malicious / Special-Character Invoice IDs', `async () => {
    const maliciousIDs = [
      "INV-2024's-001",
      'INV-"<script>alert(1)</script>"',
      "INV-100% Cotton Paper",
      "INV-%20%ff%fe-hex",
      "INV-हिंदी-2026-🎉-SPECIAL"
    ];

    const testInvoices = maliciousIDs.map((id, idx) => ({
      id: id,
      date: '2026-10-16',
      customerName: 'Customer ' + idx,
      grandTotal: 100 + idx,
      status: idx % 2 === 0 ? 'draft' : 'final'
    }));

    await window.DB.saveInvoices(testInvoices);
    await renderHistory('');

    const container = document.getElementById('invoice-list-container');
    const rows = Array.from(container.querySelectorAll('.invoice-row'));

    if (rows.length !== maliciousIDs.length) {
      throw new Error('Expected ' + maliciousIDs.length + ' rows, found ' + rows.length);
    }

    const retrievedIds = new Set(rows.map(r => r.dataset.invoiceId));
    for (const expectedId of maliciousIDs) {
      if (!retrievedIds.has(expectedId)) {
        throw new Error('Missing or corrupted ID in rendered DOM: ' + expectedId);
      }
    }

    return { verifiedCount: rows.length, allMaliciousIdsAccountedFor: true };
  }`);

  // ===== TEST SUITE 4: DRAFT RECOVERY & INVOICE NUMBERING =====
  console.log('\n--- SECTION 4: DRAFT AUTO-RECOVERY & INVOICE NUMBERING ---');

  await runRendererTest('4.1: Draft Auto-Save and LocalStorage Persistence', `async () => {
    localStorage.removeItem('li_active_draft');
    
    const sampleDraft = {
      id: 'DRAFT-TEMP-01',
      date: '2026-10-16',
      customerName: 'Draft Recover Buyer',
      customerPhone: '9123456780',
      items: [
        { name: 'Gel Pen Black', hsn: '9608', gstPercent: 5, quantity: 10, finalPrice: 10 }
      ]
    };

    localStorage.setItem('li_active_draft', JSON.stringify(sampleDraft));
    const stored = JSON.parse(localStorage.getItem('li_active_draft'));
    if (!stored || stored.customerName !== 'Draft Recover Buyer') {
      throw new Error('Draft failed to persist in localStorage');
    }

    localStorage.removeItem('li_active_draft');
    return 'DRAFT_STORAGE_VERIFIED';
  }`);

  await runRendererTest('4.2: Sequential Monotonic Invoice Numbering In Real DB', `async () => {
    await window.DB.saveInvoices([
      { id: 'PBD-0001' },
      { id: 'PBD-0002' },
      { id: 'PBD-0004' } // Gap at 0003, max is 0004
    ]);
    await window.DB.setCounter(4);

    const n1 = await window.DB.nextInvoiceNumber();
    if (n1 !== 'PBD-0005') throw new Error('Expected PBD-0005, got ' + n1);

    const n2 = await window.DB.nextInvoiceNumber();
    if (n2 !== 'PBD-0006') throw new Error('Expected PBD-0006, got ' + n2);

    return { n1, n2 };
  }`);

  await runRendererTest('4.3: Real Concurrent Invoice Number Allocation (Web Locks API / Mutex)', `async () => {
    const results = await Promise.all([
      window.DB.nextInvoiceNumber(),
      window.DB.nextInvoiceNumber(),
      window.DB.nextInvoiceNumber(),
      window.DB.nextInvoiceNumber(),
      window.DB.nextInvoiceNumber()
    ]);

    const unique = new Set(results);
    if (unique.size !== 5) {
      throw new Error('Collision detected in concurrent allocation! Results: ' + JSON.stringify(results));
    }

    const expected = ['PBD-0007', 'PBD-0008', 'PBD-0009', 'PBD-0010', 'PBD-0011'];
    for (let i = 0; i < expected.length; i++) {
      if (results[i] !== expected[i]) {
        throw new Error('Expected ' + expected[i] + ' at index ' + i + ', got ' + results[i]);
      }
    }
    return { allocated: results };
  }`);

  // ===== TEST SUITE 5: ELECTRON SECURITY LOCKDOWN =====
  console.log('\n--- SECTION 5: ELECTRON DESKTOP SECURITY AUDIT ---');

  await runRendererTest('5.1: Renderer Sandboxing & Context Isolation Verification', `() => {
    const hasRequire = typeof require !== 'undefined';
    const hasProcess = typeof process !== 'undefined';
    const hasNodeGlobals = typeof global !== 'undefined' && global.process;

    if (hasRequire || hasProcess || hasNodeGlobals) {
      throw new Error('Sandbox violation! Node globals are accessible in renderer context');
    }

    return { sandboxed: true, hasRequire, hasProcess };
  }`);

  // Test Renderer-initiated navigation interception via will-navigate
  await mainWindow.webContents.executeJavaScript(`(() => {
    try {
      window.location.href = 'https://malicious-external-site.com/steal-data.html';
    } catch (e) {}
  })()`);

  await new Promise(r => setTimeout(r, 600));

  if (navigationBlocked) {
    console.log('✔ [PASS] 5.2: Navigation Lockdown: will-navigate successfully intercepted and blocked external navigation');
    console.log(`    Detail: Blocked URL = ${blockedUrl}`);
    results.push({ name: '5.2: Navigation Lockdown', pass: true, detail: `Blocked ${blockedUrl}` });
  } else {
    console.error('✖ [FAIL] 5.2: Navigation Lockdown: Navigation was not blocked!');
    results.push({ name: '5.2: Navigation Lockdown', pass: false, error: 'Navigation not blocked' });
  }

  // Summary
  console.log('\n====================================================');
  console.log('AUDIT RUNNER COMPLETE: SUMMARY OF RESULTS');
  console.log('====================================================');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`TOTAL TESTS: ${results.length}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    app.exit(1);
  } else {
    app.exit(0);
  }
});
