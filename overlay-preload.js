const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('iris', {
  hideEyeBreak: () => ipcRenderer.send('overlay:hide-eye-break'),
  quit: () => ipcRenderer.send('app:quit'),
  onStartEyeBreak: (callback) => {
    if (typeof callback !== 'function') throw new TypeError('Callback must be a function.');
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('overlay:start-eye-break', listener);
    return () => {
      ipcRenderer.removeListener('overlay:start-eye-break', listener);
    };
  }
});
