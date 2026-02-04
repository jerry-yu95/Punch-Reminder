async function init() {
  const settings = await window.xiaoxu.getSettings();
  document.getElementById('nickname').value = settings.nickname;
  document.getElementById('checkInTime').value = settings.checkInTime;
  document.getElementById('checkOutTime').value = settings.checkOutTime;
  document.getElementById('punchUrl').value = settings.punchUrl;
  document.getElementById('overtimeTime').value = settings.overtimeTime;
  document.getElementById('weatherKey').value = settings.weatherKey;
  document.getElementById('weatherLat').value = settings.weatherLat;
  document.getElementById('weatherLon').value = settings.weatherLon;
  document.getElementById('aiProvider').value = settings.aiProvider;
  document.getElementById('aiKey').value = settings.aiKey;
  document.getElementById('aiModel').value = settings.aiModel;
  document.getElementById('aiBaseUrl').value = settings.aiBaseUrl;
  document.getElementById('alwaysOnTop').checked = settings.alwaysOnTop;
  document.getElementById('clickThrough').checked = settings.clickThrough;
}

async function save() {
  const settings = await window.xiaoxu.getSettings();
  settings.nickname = document.getElementById('nickname').value.trim() || '小主';
  settings.checkInTime = document.getElementById('checkInTime').value || '09:05';
  settings.checkOutTime = document.getElementById('checkOutTime').value || '18:30';
  settings.punchUrl = document.getElementById('punchUrl').value.trim();
  settings.overtimeTime = document.getElementById('overtimeTime').value;
  settings.weatherKey = document.getElementById('weatherKey').value.trim();
  settings.weatherLat = Number(document.getElementById('weatherLat').value);
  settings.weatherLon = Number(document.getElementById('weatherLon').value);
  settings.aiProvider = document.getElementById('aiProvider').value;
  settings.aiKey = document.getElementById('aiKey').value.trim();
  settings.aiModel = document.getElementById('aiModel').value.trim();
  settings.aiBaseUrl = document.getElementById('aiBaseUrl').value.trim();
  settings.alwaysOnTop = document.getElementById('alwaysOnTop').checked;
  settings.clickThrough = document.getElementById('clickThrough').checked;
  await window.xiaoxu.setSettings(settings);
  window.close();
}

document.getElementById('save').addEventListener('click', save);

init();
