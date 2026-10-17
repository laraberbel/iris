const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let overlayWindow;
let tray = null;
let isQuiting = false;

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
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('IRIS // Focus & Eye Rest');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Iris',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    {
      label: 'Sair Completamente',
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindows() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 590,
    resizable: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });
  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  overlayWindow = new BrowserWindow({
    fullscreen: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    closable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });
  overlayWindow.loadFile('overlay.html');
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-close', () => mainWindow.hide());

  // Traz a janela principal para primeiro plano no final dos 50 minutos
  ipcMain.on('focus-main-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  ipcMain.on('show-eye-break', (event, data) => {
    overlayWindow.webContents.send('start-countdown', data);
    overlayWindow.show();
    overlayWindow.focus();
  });

  ipcMain.on('hide-eye-break', () => {
    overlayWindow.hide();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('eye-break-completed');
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
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindows();
    createTray();
  });
}

app.on('before-quit', () => {
  isQuiting = true;
});

app.on('window-all-closed', () => {});