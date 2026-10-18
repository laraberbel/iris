const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('iris', {
  minimize: () => ipcRenderer.send('main:minimize'),
  quit: () => ipcRenderer.send('app:quit'),
  showEyeBreak: (data) => ipcRenderer.send('main:show-eye-break', data),
  focusMainWindow: () => ipcRenderer.send('main:focus-window'),
  onEyeBreakCompleted: (callback) => {
    if (typeof callback !== 'function') throw new TypeError('Callback must be a function.');
    const listener = () => callback();
    ipcRenderer.on('main:eye-break-completed', listener);
    return () => {
      ipcRenderer.removeListener('main:eye-break-completed', listener);
    };
  }
});
