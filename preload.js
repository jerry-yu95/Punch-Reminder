const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xiaoxu', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  getSpeech: () => ipcRenderer.invoke('get-speech'),
  getWeatherSummary: () => ipcRenderer.invoke('get-weather-summary'),
  getRobotPath: () => ipcRenderer.invoke('get-robot-path'),
  setInteractive: (interactive) => ipcRenderer.invoke('set-interactive', interactive),
  openPunchUrl: () => ipcRenderer.invoke('open-punch-url'),
  onMood: (callback) => ipcRenderer.on('mood', (_event, mood) => callback(mood)),
  onReminder: (callback) => ipcRenderer.on('reminder', (_event, payload) => callback(payload)),
  showSettings: () => ipcRenderer.invoke('show-settings')
});
