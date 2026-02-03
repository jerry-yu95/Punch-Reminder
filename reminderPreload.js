const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reminder', {
  onReminder: (callback) => ipcRenderer.on('reminder', (_event, payload) => callback(payload))
});
