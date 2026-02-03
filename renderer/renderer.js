async function init() {
  const settings = await window.punch.getSettings();
  document.getElementById('checkInTime').value = settings.checkInTime;
  document.getElementById('checkOutTime').value = settings.checkOutTime;
  document.getElementById('checkInEnabled').checked = settings.checkInEnabled;
  document.getElementById('checkOutEnabled').checked = settings.checkOutEnabled;
  document.getElementById('weekdaysOnly').checked = settings.weekdaysOnly;
  document.getElementById('preReminderEnabled').checked = settings.preReminderEnabled;
  document.getElementById('preReminderMinutesIn').value = String(settings.preReminderMinutesIn);
  document.getElementById('preReminderMinutesOut').value = String(settings.preReminderMinutesOut);
  document.getElementById('autoHideAfterReminder').checked = settings.autoHideAfterReminder;

  const onboarding = document.getElementById('onboarding');
  const overlay = document.getElementById('onboardingOverlay');
  if (settings.firstRun) {
    onboarding.classList.remove('hidden');
    overlay.classList.remove('hidden');
  } else {
    onboarding.classList.add('hidden');
    overlay.classList.add('hidden');
  }
}

async function save() {
  const settings = await window.punch.getSettings();
  settings.checkInTime = document.getElementById('checkInTime').value;
  settings.checkOutTime = document.getElementById('checkOutTime').value;
  settings.checkInEnabled = document.getElementById('checkInEnabled').checked;
  settings.checkOutEnabled = document.getElementById('checkOutEnabled').checked;
  settings.weekdaysOnly = document.getElementById('weekdaysOnly').checked;
  settings.preReminderEnabled = document.getElementById('preReminderEnabled').checked;
  settings.preReminderMinutesIn = Number(document.getElementById('preReminderMinutesIn').value);
  settings.preReminderMinutesOut = Number(document.getElementById('preReminderMinutesOut').value);
  settings.autoHideAfterReminder = document.getElementById('autoHideAfterReminder').checked;
  await window.punch.setSettings(settings);
  flash('已保存');
}

function flash(text) {
  const badge = document.createElement('div');
  badge.className = 'toast';
  badge.textContent = text;
  document.body.appendChild(badge);
  setTimeout(() => badge.classList.add('show'), 10);
  setTimeout(() => {
    badge.classList.remove('show');
    setTimeout(() => badge.remove(), 300);
  }, 1400);
}

document.getElementById('save').addEventListener('click', save);

document.getElementById('testIn').addEventListener('click', () => {
  window.punch.testNotify('checkIn');
});

document.getElementById('testOut').addEventListener('click', () => {
  window.punch.testNotify('checkOut');
});

document.getElementById('resetPosition').addEventListener('click', () => {
  window.punch.resetWindowPosition();
  flash('已重置位置');
});

document.getElementById('hideWindow').addEventListener('click', () => {
  window.punch.hideMainWindow();
});

document.getElementById('dismissOnboarding').addEventListener('click', async () => {
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('onboardingOverlay').classList.add('hidden');
  try {
    const settings = await window.punch.getSettings();
    settings.firstRun = false;
    await window.punch.setSettings(settings);
  } catch (err) {
    flash('设置保存失败');
  }
});

document.getElementById('overlayDismiss').addEventListener('click', async () => {
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('onboardingOverlay').classList.add('hidden');
  try {
    const settings = await window.punch.getSettings();
    settings.firstRun = false;
    await window.punch.setSettings(settings);
  } catch (err) {
    flash('设置保存失败');
  }
});

document.getElementById('onboardingOverlay').addEventListener('click', async (event) => {
  if (event.target.id !== 'onboardingOverlay') return;
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('onboardingOverlay').classList.add('hidden');
  try {
    const settings = await window.punch.getSettings();
    settings.firstRun = false;
    await window.punch.setSettings(settings);
  } catch (err) {
    flash('设置保存失败');
  }
});

document.addEventListener('keydown', async (event) => {
  if (event.key !== 'Escape') return;
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('onboardingOverlay').classList.add('hidden');
  try {
    const settings = await window.punch.getSettings();
    settings.firstRun = false;
    await window.punch.setSettings(settings);
  } catch (err) {
    flash('设置保存失败');
  }
});

init();
