const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xiaoxu', {
  onReminder: (callback) => ipcRenderer.on('reminder', (_event, payload) => callback(payload)),
  openPunchUrl: () => ipcRenderer.invoke('open-punch-url')
});
