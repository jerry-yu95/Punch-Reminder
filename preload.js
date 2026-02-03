const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('punch', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  testNotify: (type) => ipcRenderer.invoke('test-notify', type),
  resetWindowPosition: () => ipcRenderer.invoke('reset-window-position'),
  hideMainWindow: () => ipcRenderer.invoke('hide-main-window')
});
