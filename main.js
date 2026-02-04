const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let reminderWindow;
let tray;
let isQuitting = false;
const SETTINGS_FILE = 'settings.json';

const defaultSettings = {
  checkInEnabled: true,
  checkOutEnabled: true,
  checkInTime: '09:30',
  checkOutTime: '18:30',
  weekdaysOnly: true,
  preReminderEnabled: true,
  preReminderMinutesIn: 10,
  preReminderMinutesOut: 10,
  autoHideAfterReminder: true,
  windowPosition: null,
  firstRun: true,
  shownTrayTip: false,
  lastNotified: {
    checkIn: '',
    checkOut: '',
    checkInPre: '',
    checkOutPre: ''
  }
};

function getUserDataPath() {
  return app.getPath('userData');
}

function loadSettings() {
  const filePath = path.join(getUserDataPath(), SETTINGS_FILE);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...parsed, lastNotified: { ...defaultSettings.lastNotified, ...parsed.lastNotified } };
  } catch (err) {
    return { ...defaultSettings };
  }
}

function saveSettings(settings) {
  const filePath = path.join(getUserDataPath(), SETTINGS_FILE);
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
}

function createWindow() {
  const settings = loadSettings();
  const windowOptions = {
    width: 360,
    height: 360,
    resizable: true,
    minWidth: 320,
    minHeight: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    titleBarStyle: 'hidden',
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  };

  if (settings.windowPosition && Array.isArray(settings.windowPosition)) {
    windowOptions.x = settings.windowPosition[0];
    windowOptions.y = settings.windowPosition[1];
  }

  mainWindow = new BrowserWindow({
    ...windowOptions
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    // Keep app running in tray; hide instead of destroying the window.
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('blur', () => {
    // Subtle auto-hide on blur for quick dismiss
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide();
    }
  });

  let saveTimer = null;
  mainWindow.on('move', () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const currentSettings = loadSettings();
      currentSettings.windowPosition = mainWindow.getPosition();
      saveSettings(currentSettings);
    }, 300);
  });
}

function createReminderWindow() {
  reminderWindow = new BrowserWindow({
    width: 260,
    height: 120,
    resizable: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'reminderPreload.js')
    }
  });

  reminderWindow.loadFile(path.join(__dirname, 'renderer', 'reminder.html'));
  reminderWindow.webContents.on('did-finish-load', () => {
    if (pendingReminderPayload) {
      reminderWindow.webContents.send('reminder', pendingReminderPayload);
    }
  });
  reminderWindow.on('closed', () => {
    reminderWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  let trayImage = nativeImage.createFromPath(iconPath);
  if (trayImage.isEmpty()) {
    const base64Icon =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    trayImage = nativeImage
      .createFromBuffer(Buffer.from(base64Icon, 'base64'))
      .resize({ width: 16, height: 16 });
  }
  tray = new Tray(trayImage);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show / Hide',
      click: () => toggleWindow()
    },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);
  tray.setToolTip('Punch Reminder');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleWindow());
}

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function timeToMinutes(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number);
  return hh * 60 + mm;
}

function shouldNotifyAt(nowMinutes, targetMinutes, lastNotifiedDate, now) {
  return nowMinutes === targetMinutes && formatDateKey(now) !== lastNotifiedDate;
}

function sendReminder(type, settings) {
  const isPre = type === 'checkInPre' || type === 'checkOutPre';
  const isCheckIn = type === 'checkIn' || type === 'checkInPre';
  const title = isCheckIn ? '签到提醒' : '签退提醒';
  const preMinutes = isCheckIn ? settings.preReminderMinutesIn : settings.preReminderMinutesOut;
  const body = isPre
    ? `${preMinutes} 分钟后需要${isCheckIn ? '签到' : '签退'}，别忘了。`
    : `到了${isCheckIn ? '签到' : '签退'}时间，记得打卡。`;
  new Notification({ title, body }).show();
  showReminderWindow({ title, body }, settings);
}

let pendingReminderPayload = null;
function showReminderWindow(payload, settings) {
  if (!reminderWindow) createReminderWindow();
  pendingReminderPayload = payload;
  try {
    reminderWindow.showInactive();
  } catch (err) {
    reminderWindow.show();
  }
  reminderWindow.webContents.send('reminder', payload);
  if (settings.autoHideAfterReminder) {
    setTimeout(() => {
      if (reminderWindow && reminderWindow.isVisible()) {
        reminderWindow.hide();
      }
    }, 5500);
  }
}

function startScheduler() {
  setInterval(() => {
    const settings = loadSettings();
    const now = new Date();
    if (settings.weekdaysOnly && !isWeekday(now)) return;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const checkInMinutes = timeToMinutes(settings.checkInTime);
    const checkOutMinutes = timeToMinutes(settings.checkOutTime);

    if (settings.preReminderEnabled) {
      const preIn = checkInMinutes - settings.preReminderMinutesIn;
      if (preIn >= 0 && settings.checkInEnabled && shouldNotifyAt(nowMinutes, preIn, settings.lastNotified.checkInPre, now)) {
        sendReminder('checkInPre', settings);
        settings.lastNotified.checkInPre = formatDateKey(now);
        saveSettings(settings);
      }
      const preOut = checkOutMinutes - settings.preReminderMinutesOut;
      if (preOut >= 0 && settings.checkOutEnabled && shouldNotifyAt(nowMinutes, preOut, settings.lastNotified.checkOutPre, now)) {
        sendReminder('checkOutPre', settings);
        settings.lastNotified.checkOutPre = formatDateKey(now);
        saveSettings(settings);
      }
    }

    if (settings.checkInEnabled && shouldNotifyAt(nowMinutes, checkInMinutes, settings.lastNotified.checkIn, now)) {
      sendReminder('checkIn', settings);
      settings.lastNotified.checkIn = formatDateKey(now);
      saveSettings(settings);
    }

    if (settings.checkOutEnabled && shouldNotifyAt(nowMinutes, checkOutMinutes, settings.lastNotified.checkOut, now)) {
      sendReminder('checkOut', settings);
      settings.lastNotified.checkOut = formatDateKey(now);
      saveSettings(settings);
    }
  }, 30 * 1000);
}

ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('set-settings', (_event, settings) => {
  saveSettings(settings);
  return true;
});

ipcMain.handle('test-notify', (_event, type) => {
  const settings = loadSettings();
  sendReminder(type, settings);
  return true;
});

ipcMain.handle('reset-window-position', () => {
  const settings = loadSettings();
  settings.windowPosition = null;
  saveSettings(settings);
  if (mainWindow) {
    mainWindow.center();
  }
  return true;
});

ipcMain.handle('hide-main-window', () => {
  const settings = loadSettings();
  if (mainWindow) {
    mainWindow.hide();
  }
  if (!settings.shownTrayTip) {
    new Notification({ title: '已最小化到托盘', body: '提醒会在后台继续运行。' }).show();
    settings.shownTrayTip = true;
    saveSettings(settings);
  }
  return true;
});

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  createWindow();
  createTray();
  startScheduler();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});
