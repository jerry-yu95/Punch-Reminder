async function init() {
  const settings = await window.xiaoxu.getSettings();
  document.getElementById('nickname').value = settings.nickname;
  document.getElementById('checkInTime').value = settings.checkInTime;
  document.getElementById('checkOutTime').value = settings.checkOutTime;
  document.getElementById('punchUrl').value = settings.punchUrl;
  document.getElementById('overtimeTime').value = settings.overtimeTime;
  document.getElementById('remindAdvanceMinutes').value = settings.remindAdvanceMinutes ?? 0;
  document.getElementById('aiProvider').value = settings.aiProvider;
  document.getElementById('aiKey').value = settings.aiKey;
  document.getElementById('aiModel').value = settings.aiModel;
  document.getElementById('aiBaseUrl').value = settings.aiBaseUrl;
  document.getElementById('alwaysOnTop').checked = settings.alwaysOnTop;
  document.getElementById('clickThrough').checked = settings.clickThrough;
  updateAiFields();
}

async function save() {
  const settings = await window.xiaoxu.getSettings();
  settings.nickname = document.getElementById('nickname').value.trim() || '小主';
  settings.checkInTime = document.getElementById('checkInTime').value || '09:05';
  settings.checkOutTime = document.getElementById('checkOutTime').value || '18:30';
  settings.punchUrl = document.getElementById('punchUrl').value.trim();
  settings.overtimeTime = document.getElementById('overtimeTime').value;
  settings.remindAdvanceMinutes = Number(document.getElementById('remindAdvanceMinutes').value || 0);
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
document.getElementById('aiProvider').addEventListener('change', updateAiFields);
document.getElementById('toggleAdvanced').addEventListener('click', () => {
  document.getElementById('aiAdvancedFields').classList.toggle('hidden');
});

init();

function updateAiFields() {
  const provider = document.getElementById('aiProvider').value;
  const isLocal = provider === 'local';
  const fields = document.getElementById('aiFields');
  const modelField = document.getElementById('aiModelField');
  const advToggle = document.getElementById('aiAdvancedToggle');
  const advFields = document.getElementById('aiAdvancedFields');

  if (isLocal) {
    fields.classList.add('hidden');
    modelField.classList.add('hidden');
    advToggle.classList.add('hidden');
    advFields.classList.add('hidden');
    return;
  }

  fields.classList.remove('hidden');
  modelField.classList.remove('hidden');
  advToggle.classList.remove('hidden');
  advFields.classList.add('hidden');
}
