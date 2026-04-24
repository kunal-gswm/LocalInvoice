import re

with open('index.html', 'r', encoding='utf-8') as f:
    code = f.read()

old_css = """/* ===== PRINT MEDIA ===== */
@media print {
  body { background: #fff; margin: 0; padding: 0; }
  body > *:not(#invoice-print-area) { display: none !important; }
  #invoice-print-area {
    display: block !important;
    position: static;
    width: 210mm;
    padding: 10mm;
    font-size: 12pt;
    font-weight: 600;
    color: #000;
    background: #fff;
    margin: 0 auto;
  }
  .no-print { display: none !important; }
  .invoice-border-box { border: 3px solid #000 !important; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1.5px solid #000 !important; padding: 6px 8px; color: #000 !important; font-weight: 600 !important; }
  th { font-weight: 800 !important; border-width: 2px !important; }
  .print-bill-to { border: 1px solid #000 !important; }
  .print-bill-to .bill-to-left { border-right: 1px solid #000 !important; }
  .print-bill-to .bill-to-right { background: none !important; }
  .status-badge { border-color: #000 !important; color: #000 !important; }
  .amount-words { color: #000 !important; }
  .print-items-table tbody tr td:first-child { border-left: 1.5px solid #000 !important; }
  @page { size: A4; margin: 0; }
}"""

new_css = """/* ===== PRINT MEDIA ===== */
@media print {
  @page { size: A4 portrait; margin: 0; }
  body { background: #fff; margin: 0; padding: 0; }
  body > *:not(#invoice-print-area) { display: none !important; }
  #invoice-print-area {
    display: block !important;
    width: 210mm;
    min-height: 297mm;
    padding: 12mm 14mm;
    font-size: 11pt;
    color: #000;
    background: #fff;
    margin: 0;
    box-shadow: none !important;
  }
  .no-print { display: none !important; }
  /* Corner squares — print as solid black */
  .corner-accent-dark { background: #000 !important; }
  .corner-accent-color { background: #000 !important; }
  /* INVOICE label block */
  .invoice-label-block { background: #000 !important; color: #fff !important; }
  /* Header border */
  .header-border-line { border-color: #000 !important; }
  /* Table header */
  .print-items-table thead tr th {
    background: #000 !important;
    color: #fff !important;
    border: 1px solid #000 !important;
  }
  /* Table body rows */
  .print-items-table tbody tr td {
    background: none !important;
    border-bottom: 1px solid #000 !important;
    border-right: 1px solid #ccc !important;
    color: #000 !important;
  }
  /* Totals */
  .totals-subtotal-row, .totals-tax-row {
    background: none !important;
    border: 1px solid #000 !important;
    color: #000 !important;
  }
  .totals-grand-row {
    background: #000 !important;
    color: #fff !important;
  }
  /* Amount words */
  .amount-words { color: #000 !important; }
  /* Payment section */
  .payment-section { border-top: 1.5px solid #000 !important; }
  /* Footer */
  .invoice-footer { border-top: 1px solid #000 !important; color: #000 !important; }
  .print-disclaimer { color: #000 !important; }
  /* Status badge */
  .status-badge { border: 1.5px solid #000 !important; color: #000 !important; background: none !important; }
  /* No shadows anywhere */
  * { box-shadow: none !important; text-shadow: none !important; }
}"""

if old_css in code:
    code = code.replace(old_css, new_css)
else:
    print("WARNING: OLD CSS NOT FOUND")


old_js = """// ===== PRINT AREA =====
async function renderPrintArea(inv) {
  const shop = inv.shopSnapshot || await DB.getSettings();
  const el = document.getElementById('print-content');
  
  // Set document title for print-to-pdf default filename
  document.title = `Invoice-${inv.id}`;

  const totalItems = (inv.items || []).length;
  const totalQty = (inv.items ||[]).reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

  let gstRates = new Set();
  let itemsHTML = '';
  (inv.items || []).forEach((item, i) => {
    if (item.gstPercent > 0) gstRates.add(item.gstPercent);
    const g = calcGST(item.finalPrice, item.gstPercent);
    const lt = item.finalPrice * item.quantity;
    itemsHTML += `<tr>
      <td style="text-align:center">${i+1}</td>
      <td>${item.name}</td>
      <td style="text-align:center;font-size:0.8rem;">${item.hsn || ''}</td>
      <td style="text-align:center">${item.gstPercent}%</td>
      <td class="num">${item.quantity}</td>
      <td style="text-align:center;font-size:0.8rem;">${item.unit || ''}</td>
      <td class="num">${g.base.toFixed(2)}</td>
      <td class="num">${(g.gstAmount * item.quantity).toFixed(2)}</td>
      <td class="num">${lt.toFixed(2)}</td>
    </tr>`;
  });

  let cgstLabel = "CGST";
  let sgstLabel = "SGST";
  if (gstRates.size === 1) {
    const rate = Array.from(gstRates)[0];
    cgstLabel = `CGST (@${rate / 2}%)`;
    sgstLabel = `SGST (@${rate / 2}%)`;
  } else if (gstRates.size > 1) {
    cgstLabel = "CGST (mixed)";
    sgstLabel = "SGST (mixed)";
  } else {
    cgstLabel = "CGST (@0%)";
    sgstLabel = "SGST (@0%)";
  }

  el.innerHTML = `
    <div class="print-header">
      <h1>${shop.shopName || 'Shop Name'}</h1>
      <p>${shop.shopAddress || ''}</p>
      <p class="gst-line">GSTIN: ${shop.gstNumber || 'N/A'}</p>
    </div>
    <hr class="print-separator">
    
    <div class="print-meta">
      <div style="flex: 1; display: flex; gap: 40px;">
        <div><strong>Invoice No:</strong> ${inv.id}</div>
        <div><strong>Date:</strong> ${formatDate(inv.date)}</div>
      </div>
    </div>
    
    <div class="print-bill-to">
      <div class="bill-to-left">
        <div class="label">Bill To</div>
        <div class="name">${inv.customerName || ''}</div>
        ${inv.customerPhone ? `<div class="phone">${inv.customerPhone}</div>` : ''}
      </div>
      <div class="bill-to-right">
        <div><strong>Total Items:</strong> ${totalItems}</div>
      </div>
    </div>

    <table class="print-items-table">
      <thead>
        <tr>
          <th style="width:30px;text-align:center">Sr.</th>
          <th>Item Name</th>
          <th style="width:50px;text-align:center">HSN</th>
          <th style="width:40px;text-align:center">GST%</th>
          <th style="width:40px;text-align:right">Qty</th>
          <th style="width:40px;text-align:center">Unit</th>
          <th style="width:70px;text-align:right">Rate (₹)</th>
          <th style="width:70px;text-align:right">GST (₹)</th>
          <th style="width:80px;text-align:right">Total (₹)</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>
    
    <div class="print-totals">
      <table>
        <tr><td>Base Total:</td><td>₹${inv.totalBase.toFixed(2)}</td></tr>
        <tr><td>${cgstLabel}:</td><td>₹${inv.totalCGST.toFixed(2)}</td></tr>
        <tr><td>${sgstLabel}:</td><td>₹${inv.totalSGST.toFixed(2)}</td></tr>
        <tr class="grand"><td>Grand Total:</td><td>₹${inv.grandTotal.toFixed(2)}</td></tr>
      </table>
    </div>
    <div class="amount-words">${numberToWords(Math.round(inv.grandTotal || 0))}</div>

    <div class="print-bank-qr">
      <div class="bank-info">
        <strong>Bank Name:</strong> ${shop.bankName || '—'}<br>
        <strong>Account Holder:</strong> ${shop.accHolder || '—'}<br>
        <strong>Account No:</strong> ${shop.accNumber || '—'}<br>
        <strong>IFSC:</strong> ${shop.ifsc || '—'}<br>
        <strong>UPI ID:</strong> ${shop.upiId || '—'}
      </div>
      <div class="qr-box">
        <div id="qr-print"></div>
        <p>Scan to Pay</p>
      </div>
    </div>
    
    <div class="print-footer-new" style="justify-content: center;">
      <div style="text-align:center; font-style:italic;">Thank you for your business!</div>
    </div>
    
    <div class="print-disclaimer">This is a computer-generated invoice. No signature required.</div>
  `;

  // Generate QR in print area
  const qrPrint = document.getElementById('qr-print');
  if (qrPrint && shop.upiId && typeof QRCode !== 'undefined') {
    try {
      new QRCode(qrPrint, {
        text: \`upi://pay?pa=${shop.upiId}&pn=${encodeURIComponent(shop.shopName || '')}&am=${inv.grandTotal}&cu=INR\`,
        width: 80,
        height: 80,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch(e) {}
  }
}"""

new_js = r"""// ===== PRINT AREA =====
async function renderPrintArea(inv) {
  const shop = inv.shopSnapshot || await DB.getSettings();
  const el = document.getElementById('print-content');
  
  document.title = `Invoice-${inv.id}`;

  const MIN_ROWS = 12;
  const items = inv.items || [];
  const itemCount = items.length;
  
  let itemsHTML = '';
  items.forEach((item, i) => {
    const g = calcGST(item.finalPrice, item.gstPercent);
    const lt = item.finalPrice * item.quantity;
    itemsHTML += `<tr>
      <td style="text-align:center">${i+1}</td>
      <td style="font-weight:600">${item.name}</td>
      <td style="text-align:center;font-size:0.8rem">${item.hsn || ''}</td>
      <td style="text-align:center">${item.gstPercent}%</td>
      <td style="text-align:right">${item.quantity}</td>
      <td style="text-align:center;font-size:0.8rem">${item.unit || ''}</td>
      <td style="text-align:right">${g.base.toFixed(2)}</td>
      <td style="text-align:right">${(g.gstAmount * item.quantity).toFixed(2)}</td>
      <td style="text-align:right">${lt.toFixed(2)}</td>
    </tr>`;
  });

  const emptyRowsNeeded = Math.max(0, MIN_ROWS - itemCount);
  for (let i = 0; i < emptyRowsNeeded; i++) {
    itemsHTML += `<tr style="height:26px;">
      <td>&nbsp;</td><td></td><td></td><td></td>
      <td></td><td></td><td></td><td></td><td></td>
    </tr>`;
  }

  const cgst = inv.totalCGST || 0;
  const sgst = inv.totalSGST || 0;
  const taxStr = `₹${(cgst + sgst).toFixed(2)}`;

  let statusColor = '#e67e22';
  if (inv.status === 'final') statusColor = '#27ae60';
  if (inv.status === 'cancelled') statusColor = '#c0392b';

  el.innerHTML = `
<div class="invoice-border-box" style="position:relative; padding:0; overflow:hidden; background:#fff; box-shadow:0 0 10px rgba(0,0,0,0.1); border:none;">

  <!-- TOP-RIGHT CORNER SQUARES -->
  <div style="position:absolute;top:0;right:0;width:50px;height:50px;">
    <div class="corner-accent-dark" style="position:absolute;top:0;right:0;
      width:28px;height:28px;background:#1a1a2e;"></div>
    <div class="corner-accent-color" style="position:absolute;top:14px;right:14px;
      width:20px;height:20px;background:#c0392b;"></div>
  </div>

  <!-- BOTTOM-LEFT CORNER SQUARES -->
  <div style="position:absolute;bottom:0;left:0;width:50px;height:50px;">
    <div class="corner-accent-color" style="position:absolute;bottom:14px;left:14px;
      width:20px;height:20px;background:#c0392b;"></div>
    <div class="corner-accent-dark" style="position:absolute;bottom:0;left:0;
      width:28px;height:28px;background:#1a1a2e;"></div>
  </div>

  <div style="padding:20px 24px 16px;">

    <!-- HEADER -->
    <div style="display:flex;justify-content:space-between;align-items:center;
      padding-bottom:14px;border-bottom:2px solid #1a1a2e;" class="header-border-line">
      <div>
        <div style="font-size:22pt;font-weight:900;color:#1a1a2e;line-height:1;">
          ${shop.shopName || 'Shop Name'}
        </div>
        <div style="font-size:9pt;color:#888;font-style:italic;margin-top:4px;">
          ${shop.shopAddress || ''}
        </div>
        <div style="font-size:9pt;color:#555;font-weight:600;">
          GSTIN: ${shop.gstNumber || 'N/A'}
        </div>
      </div>
      <div class="invoice-label-block" style="background:#c0392b;color:#fff;
        padding:12px 28px;font-size:26pt;font-weight:900;letter-spacing:1px;">
        INVOICE
      </div>
    </div>

    <!-- META ROW -->
    <div style="display:flex;justify-content:space-between;
      padding:16px 0 14px;align-items:flex-start;">
      <div>
        <div style="font-size:9pt;color:#888;font-weight:600;
          text-transform:uppercase;margin-bottom:4px;">Invoice to:</div>
        <div style="font-size:14pt;font-weight:800;color:#1a1a2e;">
          ${inv.customerName || ''}
        </div>
        <div style="font-size:9.5pt;color:#555;margin-top:2px;">
          ${inv.customerPhone || ''}
        </div>
      </div>
      <div style="text-align:right;">
        <table style="border:none;font-size:10.5pt;margin-left:auto;">
          <tr>
            <td style="border:none;font-weight:600;padding:2px 12px 2px 0;
              color:#888;">Invoice #</td>
            <td style="border:none;font-weight:800;color:#1a1a2e;">${inv.id}</td>
          </tr>
          <tr>
            <td style="border:none;font-weight:600;padding:2px 12px 2px 0;
              color:#888;">Date</td>
            <td style="border:none;font-weight:800;color:#1a1a2e;">${formatDate(inv.date)}</td>
          </tr>
          <tr>
            <td style="border:none;font-weight:600;padding:2px 12px 2px 0;
              color:#888;">Status</td>
            <td style="border:none;">
              <span class="status-badge ${inv.status || 'draft'}" style="display:inline-block;padding:2px 10px;border:1.5px solid ${statusColor};color:${statusColor};border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">
                ${(inv.status || 'DRAFT').toUpperCase()}
              </span>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <style>
      .print-items-table tbody tr:nth-child(odd) td { background: #ffffff; }
      .print-items-table tbody tr:nth-child(even) td { background: #f7f7f7; }
      .print-items-table tbody tr td { border-bottom: 1px solid #e0e0e0; border-right: 1px solid #ddd; padding: 6px 10px; }
      .print-items-table tbody tr td:last-child { border-right: 1px solid #e0e0e0; }
      .print-items-table tbody tr td:first-child { border-left: 1px solid #e0e0e0; }
    </style>
    <table class="print-items-table" style="width:100%;border-collapse:collapse;margin-bottom:15px;font-size:10.5pt;color:#1a1a2e;">
      <thead>
        <tr>
          <th style="background:#1a1a2e;color:#ffffff;font-size:10pt;text-transform:uppercase;letter-spacing:0.05em;padding:8px 10px;border:1px solid #ddd;border-right:1px solid #ddd;font-weight:600;width:30px;text-align:center;">No</th>
          <th style="background:#1a1a2e;color:#ffffff;font-size:10pt;text-transform:uppercase;letter-spacing:0.05em;padding:8px 10px;border:1px solid #ddd;border-right:1px solid #ddd;font-weight:600;text-align:left;">Item Description</th>
          <th style="background:#1a1a2e;color:#ffffff;font-size:10pt;text-transform:uppercase;letter-spacing:0.05em;padding:8px 10px;border:1px solid #ddd;border-right:1px solid #ddd;font-weight:600;width:50px;text-align:center;">HSN</th>
          <th style="background:#1a1a2e;color:#ffffff;font-size:10pt;text-transform:uppercase;letter-spacing:0.05em;padding:8px 10px;border:1px solid #ddd;border-right:1px solid #ddd;font-weight:600;width:50px;text-align:center;">GST%</th>
          <th style="background:#1a1a2e;color:#ffffff;font-size:10pt;text-transform:uppercase;letter-spacing:0.05em;padding:8px 10px;border:1px solid #ddd;border-right:1px solid #ddd;font-weight:600;width:50px;text-align:right;">Qty</th>
          <th style="background:#1a1a2e;color:#ffffff;font-size:10pt;text-transform:uppercase;letter-spacing:0.05em;padding:8px 10px;border:1px solid #ddd;border-right:1px solid #ddd;font-weight:600;width:40px;text-align:center;">Unit</th>
          <th style="background:#1a1a2e;color:#ffffff;font-size:10pt;text-transform:uppercase;letter-spacing:0.05em;padding:8px 10px;border:1px solid #ddd;border-right:1px solid #ddd;font-weight:600;width:70px;text-align:right;">Rate (₹)</th>
          <th style="background:#1a1a2e;color:#ffffff;font-size:10pt;text-transform:uppercase;letter-spacing:0.05em;padding:8px 10px;border:1px solid #ddd;border-right:1px solid #ddd;font-weight:600;width:80px;text-align:right;">GST Amt (₹)</th>
          <th style="background:#1a1a2e;color:#ffffff;font-size:10pt;text-transform:uppercase;letter-spacing:0.05em;padding:8px 10px;border:1px solid #ddd;font-weight:600;width:80px;text-align:right;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <!-- TOTALS BLOCK -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
      <div style="width:240px;text-align:right;">
        <table style="width:100%;border-collapse:collapse;font-size:11pt;color:#1a1a2e;">
          <tr class="totals-subtotal-row" style="background:#f0f0f0;">
            <td style="padding:9px 14px;font-weight:600;border:none;">Sub Total</td>
            <td style="padding:9px 14px;font-weight:600;border:none;">₹${inv.totalBase.toFixed(2)}</td>
          </tr>
          <tr class="totals-tax-row" style="background:#f0f0f0;">
            <td style="padding:6px 14px 9px;font-weight:600;border:none;">Tax (CGST+SGST)</td>
            <td style="padding:6px 14px 9px;font-weight:600;border:none;">${taxStr}</td>
          </tr>
          <tr class="totals-grand-row" style="background:#c0392b;color:#ffffff;">
            <td style="padding:10px 14px;font-weight:800;font-size:13pt;border:none;">TOTAL</td>
            <td style="padding:10px 14px;font-weight:800;font-size:13pt;border:none;">₹${inv.grandTotal.toFixed(2)}</td>
          </tr>
        </table>
      </div>
    </div>
    
    <!-- AMOUNT IN WORDS -->
    <div class="amount-words" style="text-align:right;font-style:italic;font-size:10pt;color:#555;margin-bottom:24px;">
      ${numberToWords(Math.round(inv.grandTotal || 0))}
    </div>

    <!-- PAYMENT INFO SECTION -->
    <div class="payment-section" style="display:flex;border-top:1px solid #ddd;padding-top:16px;margin-bottom:16px;">
      <div style="flex:1;border-right:1px solid #ddd;padding-right:20px;">
        <div style="font-weight:800;color:#1a1a2e;margin-bottom:6px;font-size:10pt;">Payment Info:</div>
        <table style="border:none;font-size:9.5pt;color:#1a1a2e;line-height:1.5;">
          <tr><td style="border:none;padding:0 8px 0 0;">Account # :</td><td style="border:none;padding:0;font-weight:600;">${shop.accNumber || '—'}</td></tr>
          <tr><td style="border:none;padding:0 8px 0 0;">A/C Name:</td><td style="border:none;padding:0;font-weight:600;">${shop.accHolder || '—'}</td></tr>
          <tr><td style="border:none;padding:0 8px 0 0;">Bank:</td><td style="border:none;padding:0;font-weight:600;">${shop.bankName || '—'}</td></tr>
          <tr><td style="border:none;padding:0 8px 0 0;">IFSC:</td><td style="border:none;padding:0;font-weight:600;">${shop.ifsc || '—'}</td></tr>
          <tr><td style="border:none;padding:0 8px 0 0;">UPI ID:</td><td style="border:none;padding:0;font-weight:600;">${shop.upiId || '—'}</td></tr>
        </table>
      </div>
      <div style="flex:1;padding-left:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div id="qr-print" style="width:80px;height:80px;"></div>
        <div style="font-size:9pt;color:#555;font-weight:600;margin-top:4px;margin-bottom:8px;">Scan to Pay</div>
        <div style="font-size:9pt;color:#1a1a2e;text-align:center;line-height:1.4;">
          ${shop.shopPhone ? `📞 ${shop.shopPhone}<br>` : ''}
          📍 ${shop.shopAddress || ''}<br>
          ${shop.shopEmail ? `✉ ${shop.shopEmail}<br>` : ''}
          <span style="font-weight:600">GSTIN: ${shop.gstNumber || 'N/A'}</span>
        </div>
      </div>
    </div>

    <!-- FOOTER STRIP -->
    <div class="invoice-footer" style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #ddd;padding-top:16px;">
      <div style="font-size:9pt;color:#1a1a2e;flex:1;">
        ${shop.shopPhone ? `☎ ${shop.shopPhone} / ` : ''}📍 ${shop.shopAddress || ''}
        ${shop.shopEmail || shop.shopWebsite ? `<br>` : ''}
        ${shop.shopEmail ? `✉ ${shop.shopEmail} ` : ''}
        ${shop.shopEmail && shop.shopWebsite ? `/ ` : ''}
        ${shop.shopWebsite ? `🌐 ${shop.shopWebsite}` : ''}
      </div>
      <div style="flex:1;"></div>
      <div style="flex:1;text-align:right;">
        <div style="border-bottom:1px solid #1a1a2e;width:160px;margin-left:auto;margin-bottom:4px;height:24px;"></div>
        <div style="font-size:10pt;color:#1a1a2e;font-weight:600;text-align:center;width:160px;margin-left:auto;">Authorised Sign</div>
      </div>
    </div>

    <!-- DISCLAIMER -->
    <div class="print-disclaimer" style="text-align:center;font-size:8pt;color:#888;font-style:italic;margin-top:24px;">
      This is a computer-generated invoice. No signature required.
    </div>

  </div>
</div>
  `;

  // Generate QR in print area
  const qrPrint = document.getElementById('qr-print');
  if (qrPrint && shop.upiId && typeof QRCode !== 'undefined') {
    qrPrint.innerHTML = '';
    try {
      new QRCode(qrPrint, {
        text: `upi://pay?pa=${shop.upiId}&pn=${encodeURIComponent(shop.shopName || '')}&am=${inv.grandTotal}&cu=INR`,
        width: 80,
        height: 80,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch(e) {}
  }
}"""

if old_js in code:
    code = code.replace(old_js, new_js)
    print("JS REPLACE SUCCESS")
else:
    print("WARNING: OLD JS NOT FOUND")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(code)

print('Success')
