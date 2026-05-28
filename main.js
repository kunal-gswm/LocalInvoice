const { app, BrowserWindow } = require('electron');
const path = require('path');

// Set custom user data path in development to avoid pollution,
// but use standard system paths in production (packaged) to avoid permission issues.
if (!app.isPackaged) {
  const userDataPath = path.join(app.getAppPath(), '.userdata');
  app.setPath('userData', userDataPath);
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets', 'logo.png'),
    title: 'LocalInvoice — GST Billing App'
  });

  win.loadFile('index.html');

  // Optional: Open developer tools during development
  // win.webContents.openDevTools();

  // Optional: Remove default menu bar if you want a clean app feel
  // win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
