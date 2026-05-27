# LocalInvoice

LocalInvoice is an offline GST-compliant billing desktop application designed specifically for local stationery shops in India. It enables shop owners to generate invoices, manage drafts, view invoice history, and manage item inventory without requiring an internet connection.

## Key Features

* **Offline First:** All data is stored locally on your machine using IndexedDB. No internet connection is required.
* **GST Calculation:** Automatically splits and calculates CGST and SGST from the final prices.
* **Smart Autocomplete:** Suggests stationery items with predefined HSN codes and GST rates from an inventory of 260+ standard items.
* **Interactive Dashboard:** Allows invoice searching, editing drafts, and print/PDF downloads.
* **UPI QR Code Generation:** Automatically generates a payment QR code on the invoice using your UPI ID.
* **Backup and Restore:** Provides data export and import options via JSON backups to safeguard invoice history.

## Project Structure

* **index.html:** The core frontend user interface containing styles, layout, and application logic.
* **main.js:** The Electron main process script configuring window creation, preferences, and local data persistence.
* **assets/:** Contains static design assets (such as the application icon).
* **lib/:** Contains local vendor libraries used for PDF capturing, QR code generation, and styling utilities.
* **package.json:** Handles developer scripts, app metadata, and Electron packaging configurations.

## Getting Started

### Prerequisites

Make sure you have Node.js installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kunal-gswm/LocalInvoice.git
   cd LocalInvoice
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application Locally

Start the desktop application in development mode:
```bash
npm start
```

### Packaging the Desktop App

To build a standalone installer executable for Windows:
```bash
npm run dist
```
The output installer will be generated inside the `dist/` directory.

## First-Time Setup

1. Open the application.
2. Navigate to the "Settings" tab in the top-right corner.
3. Enter your shop details:
   * Shop Name and Address
   * GSTIN Number
   * Bank Details (Account Holder, Number, IFSC)
   * UPI ID (for QR code payments)
4. Click "Save Settings". These details will auto-fill on every new invoice.

## Usage Guide

### Creating an Invoice
1. Go to "New Invoice".
2. Enter the customer's name (required) and phone number (optional).
3. Add item rows. Start typing item names to see matching suggestions. Select a suggestion or type custom items.
4. Enter the item quantity and final price (GST included). The base price, GST split (CGST/SGST), and line totals will auto-calculate.
5. Click "Save Draft" to save and edit later, or click "Finalise & Print" to lock the invoice and print.

### Managing Inventory
* Go to the "Items" tab to view pre-loaded stationery items.
* Add new custom items or edit existing items (including HSN codes, units, GST rates, and stock values).

### Backing Up Data
* Go to the "History" tab.
* Click "Export Backup" to save your database to a `.json` file.
* To restore data on another system or browser, click "Import Backup" and select your backup file.

## Technical Details

* **Runtime environment:** Electron
* **Database:** IndexedDB (persisted under a local `.userdata` directory)
* **Libraries:**
  * html2canvas (v1.4.1) for print-to-canvas rendering
  * jsPDF (v2.5.1) for PDF creation
  * qrcode.js for dynamic UPI QR generation
