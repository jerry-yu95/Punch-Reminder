const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
let store;
const storeDefaults = {
  nickname: '小主',
  checkInTime: '09:05',
  checkOutTime: '18:30',
  punchUrl: '',
  overtimeTime: '',
  remindAdvanceMinutes: 0,
  aiProvider: 'local',
  aiKey: '',
  aiModel: 'gpt-4o-mini',
  aiBaseUrl: 'https://api.openai.com/v1',
  alwaysOnTop: true,
  clickThrough: true,
  robotAssetPath: path.join(__dirname, 'assets', 'robot.png')
};

async function initStore() {
  const { default: Store } = await import('electron-store');
  store = new Store({ defaults: storeDefaults });
}

let widgetWindow;
let settingsWindow;
let reminderWindow;
let tray;
let isQuitting = false;
let lastReminder = { checkIn: '', checkOut: '', sedentary: '', overtime: '' };
let cachedWorkday = { date: '', isWorkday: true };
let cachedWeather = { date: '', isBad: false, summary: '', temp: null };
let cachedLocation = { date: '', lat: null, lon: null };
let lastSedentaryAt = Date.now();

const phrases = JSON.parse(fs.readFileSync(path.join(__dirname, 'local_phrases.json'), 'utf-8'));

function createWidgetWindow() {
  const windowOptions = {
    width: 60,
    height: 60,
    resizable: false,
    useContentSize: true,
    transparent: true,
    frame: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
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

function getSmartGreeting(nickname, weatherInfo) {
  const hour = new Date().getHours();
  let greeting = '';

  if (hour < 9) greeting = `早安，${nickname}！今天是元气满满的一天，记得签到哦~`;
  else if (hour < 12) greeting = `上午好，${nickname}！专注工作的同时，别忘了喝杯水。`;
  else if (hour < 14) greeting = `午休时间到了，${nickname}。睡个好觉，下午更有精神！`;
  else if (hour < 18) greeting = `下午茶时间，${nickname}。再坚持一下，离下班不远了！`;
  else greeting = `辛苦了，${nickname}！今天的任务完成了吗？准备撤退吧~`;

  if (weatherInfo && weatherInfo.includes('雨')) {
    greeting += ' 🌧️ 外面下雨了，下班打卡后记得带伞。';
  }

  return greeting;
}

function getFridayMode(nickname) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 5) {
    if (hour >= 14 && hour < 17) {
      return `【周五摸鱼态】${nickname}，离周末只有最后几小时了！效率拉满，准备撤退！🚀`;
    } else if (hour >= 17) {
      return `【狂欢预警】${nickname}！检测到周末信号！打完这最后一次卡，我们就自由啦！🎉`;
    }
  }
  return null;
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

async function getLocationByIP(dateKey) {
  if (cachedLocation.date === dateKey && cachedLocation.lat && cachedLocation.lon) {
    return cachedLocation;
  }
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    cachedLocation = {
      date: dateKey,
      lat: Number(data.latitude),
      lon: Number(data.longitude)
    };
    return cachedLocation;
  } catch (err) {
    return { date: dateKey, lat: null, lon: null };
  }
}

function weatherCodeToText(code) {
  const mapping = {
    0: '晴朗',
    1: '晴间多云',
    2: '多云',
    3: '阴天',
    45: '有雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '毛毛雨',
    55: '毛毛雨偏大',
    56: '冻毛毛雨',
    57: '冻毛毛雨偏大',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '冻雨偏大',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '小阵雨',
    81: '阵雨',
    82: '强阵雨',
    85: '小阵雪',
    86: '阵雪',
    95: '雷暴',
    96: '雷暴伴小冰雹',
    99: '雷暴伴大冰雹'
  };
  return mapping[code] || '天气变化';
}

async function updateWeather(date) {
  const key = formatDateKey(date);
  if (cachedWeather.date === key) return cachedWeather;
  const loc = await getLocationByIP(key);
  const lat = loc.lat;
  const lon = loc.lon;
  if (!lat || !lon) {
    cachedWeather = { date: key, isBad: false, summary: '', temp: null };
    return cachedWeather;
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    const code = data.current_weather?.weathercode ?? null;
    const temp = data.current_weather?.temperature ?? null;
    const badCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
    const bad = code !== null && badCodes.includes(code);
    const summary = code === null ? '' : `${weatherCodeToText(code)}${temp !== null ? `，${temp}°C` : ''}`;
    cachedWeather = { date: key, isBad: bad, summary, temp };
    return cachedWeather;
  } catch (err) {
    cachedWeather = { date: key, isBad: false, summary: '', temp: null };
    return cachedWeather;
  }
}

async function getSpeech() {
  const provider = store.get('aiProvider');
  const nickname = store.get('nickname');
  const fridayLine = getFridayMode(nickname);
  if (fridayLine) return fridayLine;
  if (!provider || provider === 'local' || !store.get('aiKey')) {
    return getSmartGreeting(nickname, cachedWeather.summary || '');
  }

  const mood = '温柔、治愈、像小宠物的机器人';
  const now = new Date().toLocaleString();
  const weather = cachedWeather.summary || '未知天气';
  const overtime = store.get('overtimeTime') || '未设置';
  const prompt = `你是${mood}，称呼对方为${nickname}。现在时间${now}，天气${weather}，预计下班${overtime}。请生成一句20字以内的中文短句，语气像贴心小宠物。若天气含雨，附带带伞提醒。`;

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
  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  const x = width - 280;
  const y = 40;
  reminderWindow.setPosition(x, y, false);
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
  const userAdvance = Number(store.get('remindAdvanceMinutes') || 0);
  const totalAdvance = Math.max(0, userAdvance + extraAdvance);

  const checkIn = timeToMinutes(store.get('checkInTime')) - totalAdvance;
  const checkOut = timeToMinutes(store.get('checkOutTime')) - totalAdvance;
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
  const nowDay = now.getDay();
  if (nowDay === 5 && now.getHours() >= 14 && widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('mood', 'excited');
  } else if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('mood', 'normal');
  }
  if (overtime) {
    const overtimeMinutes = timeToMinutes(overtime);
    if (nowMinutes >= overtimeMinutes + 30 && lastReminder.overtime !== dateKey && lastReminder.checkOut !== dateKey) {
      lastReminder.overtime = dateKey;
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send('mood', 'worry');
      }
      showReminder({
        title: '加班关怀',
        body: '小主，身体是革命的本钱，今天辛苦了，我们回家吧。',
        showButton: false
      });
      new Notification({ title: '加班关怀', body: '小主，身体是革命的本钱，今天辛苦了，我们回家吧。' }).show();
    }
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
    widgetWindow.setIgnoreMouseEvents(store.get('clickThrough'), { forward: true });
    widgetWindow.webContents.send('mood', 'normal');
  }
  return true;
});

ipcMain.handle('get-speech', () => getSpeech());
ipcMain.handle('get-robot-path', () => path.join(app.getAppPath(), 'assets', 'robot.png'));
ipcMain.handle('set-interactive', (_event, interactive) => {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  if (!store.get('clickThrough')) {
    widgetWindow.setIgnoreMouseEvents(false);
    return;
  }
  widgetWindow.setIgnoreMouseEvents(!interactive, { forward: true });
});
ipcMain.handle('get-weather-summary', async () => {
  const weather = await updateWeather(new Date());
  return weather.summary || '';
});

ipcMain.handle('open-punch-url', () => {
  const raw = (store.get('punchUrl') || '').trim();
  if (!raw) {
    new Notification({ title: '打卡链接未设置', body: '请先在设置里填写打卡链接。' }).show();
    return false;
  }
  const hasScheme = /^https?:\/\//i.test(raw);
  const url = hasScheme ? raw : `https://${raw}`;
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.hide();
  }
  shell.openExternal(url);
  return true;
});

ipcMain.handle('show-settings', () => createSettingsWindow());

app.whenReady().then(async () => {
  await initStore();
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  createWidgetWindow();
  createTray();
  createReminderWindow();
  await updateWeather(new Date());
  setInterval(schedulerTick, 60 * 1000);
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});
