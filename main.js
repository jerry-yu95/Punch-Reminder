const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store({
  defaults: {
    nickname: '小主',
    checkInTime: '09:05',
    checkOutTime: '18:30',
    punchUrl: '',
    overtimeTime: '',
    weatherKey: '',
    weatherLat: 0,
    weatherLon: 0,
    aiProvider: 'local',
    aiKey: '',
    aiModel: 'gpt-4o-mini',
    aiBaseUrl: 'https://api.openai.com/v1',
    alwaysOnTop: true,
    clickThrough: false,
    robotAssetPath: path.join(__dirname, 'assets', 'robot.png')
  }
});

let widgetWindow;
let settingsWindow;
let reminderWindow;
let tray;
let isQuitting = false;
let lastReminder = { checkIn: '', checkOut: '', sedentary: '' };
let cachedWorkday = { date: '', isWorkday: true };
let cachedWeather = { date: '', isBad: false, summary: '' };
let lastSedentaryAt = Date.now();

const phrases = JSON.parse(fs.readFileSync(path.join(__dirname, 'local_phrases.json'), 'utf-8'));

function createWidgetWindow() {
  const windowOptions = {
    width: 320,
    height: 380,
    resizable: true,
    minWidth: 240,
    minHeight: 260,
    transparent: true,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: store.get('alwaysOnTop'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  };

  widgetWindow = new BrowserWindow(windowOptions);
  widgetWindow.loadFile(path.join(__dirname, 'renderer', 'widget', 'index.html'));
  widgetWindow.setIgnoreMouseEvents(store.get('clickThrough'), { forward: true });

  widgetWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    widgetWindow.hide();
  });

  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });

  widgetWindow.webContents.on('context-menu', () => {
    showWidgetMenu();
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 720,
    resizable: true,
    title: '小序设置',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings', 'index.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createReminderWindow() {
  reminderWindow = new BrowserWindow({
    width: 260,
    height: 150,
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

  reminderWindow.loadFile(path.join(__dirname, 'renderer', 'reminder', 'index.html'));
  reminderWindow.on('closed', () => {
    reminderWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  let trayImage = nativeImage.createFromPath(iconPath);
  if (trayImage.isEmpty()) {
    trayImage = nativeImage.createFromBuffer(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=', 'base64')).resize({ width: 16, height: 16 });
  }
  tray = new Tray(trayImage);
  tray.setToolTip('小序');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开设置', click: () => createSettingsWindow() },
    { label: '显示/隐藏挂件', click: () => toggleWidget() },
    {
      label: store.get('clickThrough') ? '关闭鼠标穿透' : '开启鼠标穿透',
      click: () => {
        const next = !store.get('clickThrough');
        store.set('clickThrough', next);
        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.setIgnoreMouseEvents(next, { forward: true });
        }
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]));
  tray.on('click', () => toggleWidget());
}

function showWidgetMenu() {
  const menu = Menu.buildFromTemplate([
    { label: '打开设置', click: () => createSettingsWindow() },
    {
      label: store.get('alwaysOnTop') ? '取消置顶' : '置顶显示',
      click: () => {
        const next = !store.get('alwaysOnTop');
        store.set('alwaysOnTop', next);
        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.setAlwaysOnTop(next);
        }
      }
    },
    {
      label: store.get('clickThrough') ? '关闭鼠标穿透' : '开启鼠标穿透',
      click: () => {
        const next = !store.get('clickThrough');
        store.set('clickThrough', next);
        if (widgetWindow && !widgetWindow.isDestroyed()) {
          widgetWindow.setIgnoreMouseEvents(next, { forward: true });
        }
      }
    },
    { label: '隐藏挂件', click: () => widgetWindow.hide() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);
  menu.popup({ window: widgetWindow });
}

function toggleWidget() {
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    createWidgetWindow();
    return;
  }
  if (widgetWindow.isVisible()) {
    widgetWindow.hide();
  } else {
    widgetWindow.show();
    widgetWindow.focus();
  }
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function timeToMinutes(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number);
  return hh * 60 + mm;
}

function randomFrom(list) {
  if (!list || list.length === 0) return '';
  return list[Math.floor(Math.random() * list.length)];
}

async function isWorkday(date) {
  const key = formatDateKey(date);
  if (cachedWorkday.date === key) return cachedWorkday.isWorkday;
  try {
    const response = await fetch(`https://timor.tech/api/holiday/info/${key}`);
    const data = await response.json();
    const type = data?.type?.type;
    const isWork = type === 0 || type === 3;
    cachedWorkday = { date: key, isWorkday: isWork };
    return isWork;
  } catch (err) {
    return true;
  }
}

async function updateWeather(date) {
  const key = formatDateKey(date);
  if (cachedWeather.date === key) return cachedWeather;
  const apiKey = store.get('weatherKey');
  const lat = store.get('weatherLat');
  const lon = store.get('weatherLon');
  if (!apiKey || !lat || !lon) {
    cachedWeather = { date: key, isBad: false, summary: '' };
    return cachedWeather;
  }
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=zh_cn`;
    const res = await fetch(url);
    const data = await res.json();
    const main = data.weather?.[0]?.main || '';
    const bad = ['Rain', 'Snow', 'Thunderstorm', 'Extreme'].includes(main);
    cachedWeather = { date: key, isBad: bad, summary: data.weather?.[0]?.description || '' };
    return cachedWeather;
  } catch (err) {
    cachedWeather = { date: key, isBad: false, summary: '' };
    return cachedWeather;
  }
}

async function getSpeech() {
  const provider = store.get('aiProvider');
  if (!provider || provider === 'local' || !store.get('aiKey')) {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11) return randomFrom(phrases.morning);
    if (hour >= 11 && hour < 14) return randomFrom(phrases.noon);
    if (hour >= 14 && hour < 20) return randomFrom(phrases.on_time);
    return randomFrom(phrases.late);
  }

  const nickname = store.get('nickname');
  const mood = '温柔、治愈、像小宠物的机器人';
  const now = new Date().toLocaleString();
  const weather = cachedWeather.summary || '未知天气';
  const overtime = store.get('overtimeTime') || '未设置';
  const prompt = `你是${mood}，称呼对方为${nickname}。现在时间${now}，天气${weather}，预计下班${overtime}。请生成一句20字以内的中文短句，语气像贴心小宠物。`;

  try {
    if (provider === 'gemini') {
      const apiKey = store.get('aiKey');
      const model = store.get('aiModel') || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || randomFrom(phrases.on_time);
    }

    const baseUrl = store.get('aiBaseUrl') || 'https://api.openai.com/v1';
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${store.get('aiKey')}`
      },
      body: JSON.stringify({
        model: store.get('aiModel') || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 60
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || randomFrom(phrases.on_time);
  } catch (err) {
    return randomFrom(phrases.on_time);
  }
}

function showReminder(payload) {
  if (!reminderWindow || reminderWindow.isDestroyed()) {
    createReminderWindow();
  }
  reminderWindow.show();
  reminderWindow.webContents.send('reminder', payload);
}

async function schedulerTick() {
  const now = new Date();
  const dateKey = formatDateKey(now);

  const workday = await isWorkday(now);
  if (!workday) return;

  const weather = await updateWeather(now);
  const extraAdvance = weather.isBad ? 10 : 0;

  const checkIn = timeToMinutes(store.get('checkInTime')) - extraAdvance;
  const checkOut = timeToMinutes(store.get('checkOutTime')) - extraAdvance;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (nowMinutes === checkIn && lastReminder.checkIn !== dateKey) {
    lastReminder.checkIn = dateKey;
    showReminder({ title: '签到提醒', body: weather.isBad ? '今天可能有雨，提前打卡哦。' : '到签到时间啦。', showButton: true });
    new Notification({ title: '签到提醒', body: '到签到时间啦。' }).show();
  }

  if (nowMinutes === checkOut && lastReminder.checkOut !== dateKey) {
    lastReminder.checkOut = dateKey;
    showReminder({ title: '签退提醒', body: '到签退时间啦。', showButton: true });
    new Notification({ title: '签退提醒', body: '到签退时间啦。' }).show();
  }

  const overtime = store.get('overtimeTime');
  if (overtime) {
    const overtimeMinutes = timeToMinutes(overtime);
    if (nowMinutes === overtimeMinutes - 15 && widgetWindow) {
      widgetWindow.webContents.send('mood', 'worry');
    }
  }

  if (Date.now() - lastSedentaryAt >= 2 * 60 * 60 * 1000) {
    lastSedentaryAt = Date.now();
    showReminder({ title: '久坐提醒', body: randomFrom(phrases.sedentary), showButton: false });
    new Notification({ title: '久坐提醒', body: randomFrom(phrases.sedentary) }).show();
  }
}

ipcMain.handle('get-settings', () => store.store);
ipcMain.handle('set-settings', (_event, settings) => {
  store.set(settings);
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.setAlwaysOnTop(store.get('alwaysOnTop'));
    widgetWindow.webContents.send('mood', 'normal');
  }
  return true;
});

ipcMain.handle('get-speech', () => getSpeech());

ipcMain.handle('open-punch-url', () => {
  const url = store.get('punchUrl');
  if (url) shell.openExternal(url);
});

ipcMain.handle('show-settings', () => createSettingsWindow());

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  createWidgetWindow();
  createTray();
  createReminderWindow();
  setInterval(schedulerTick, 60 * 1000);
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});
