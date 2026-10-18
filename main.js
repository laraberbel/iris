const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, screen } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let overlayWindow;
let tray = null;
let isQuiting = false;
let overlayReady = false;
let pendingEyeBreak;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'IRIS // ATUALIZAÇÃO DISPONÍVEL',
      message: `Versão ${info.version} descarregada com sucesso.`,
      detail: 'Deseja reiniciar a aplicação agora para aplicar a atualização?',
      buttons: ['Reiniciar Agora', 'Depois'],
      defaultId: 0
    }).then((res) => {
      if (res.response === 0) {
        isQuiting = true;
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Erro na verificação de atualizações:', err);
  });
}

function createTray() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = path.join(__dirname, 'assets', iconName);
  tray = new Tray(iconPath);
  tray.setToolTip('IRIS // Focus & Eye Rest');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Iris',
      click: showMainWindow
    },
    { type: 'separator' },
    {
      label: 'Sair Completamente',
      click: quitApp
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showMainWindow();
    }
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function quitApp() {
  if (isQuiting) return;
  isQuiting = true;
  pendingEyeBreak = null;
  if (tray) {
    tray.destroy();
    tray = null;
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  app.exit(0);
}

function createWindows() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 590,
    resizable: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'main-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  overlayWindow = new BrowserWindow({
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    closable: false,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  overlayWindow.webContents.on('did-start-loading', () => {
    overlayReady = false;
  });
  overlayWindow.webContents.on('did-finish-load', () => {
    overlayReady = true;
    if (pendingEyeBreak) {
      overlayWindow.webContents.send('start-countdown', pendingEyeBreak);
      pendingEyeBreak = null;
    }
  });
  overlayWindow.loadFile('overlay.html');
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  ipcMain.on('main:minimize', (event) => {
    if (event.sender === mainWindow.webContents) mainWindow.minimize();
  });
  ipcMain.on('app:quit', (event) => {
    if (event.sender === mainWindow.webContents || event.sender === overlayWindow.webContents) {
      quitApp();
    }
  });

  // Traz a janela principal para primeiro plano no final dos 50 minutos
  ipcMain.on('main:focus-window', (event) => {
    if (event.sender !== mainWindow.webContents) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  ipcMain.on('main:show-eye-break', (event, data) => {
    if (event.sender !== mainWindow.webContents) return;
    if (overlayReady) {
      overlayWindow.webContents.send('overlay:start-eye-break', data);
    } else {
      pendingEyeBreak = data;
    }
    overlayWindow.setBounds(screen.getDisplayMatching(mainWindow.getBounds()).bounds);
    overlayWindow.show();
    overlayWindow.focus();
  });

  ipcMain.on('overlay:hide-eye-break', (event) => {
    if (event.sender !== overlayWindow.webContents) return;
    pendingEyeBreak = null;
    overlayWindow.hide();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('main:eye-break-completed');
    }
  });

  mainWindow.once('ready-to-show', () => {
    setupAutoUpdates();
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.on('activate', showMainWindow);

  app.whenReady().then(() => {
    createWindows();
    createTray();
  });
}

app.on('before-quit', () => {
  isQuiting = true;
});
