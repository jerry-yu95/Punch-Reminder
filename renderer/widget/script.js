const robot = document.getElementById('robot');
const bubble = document.getElementById('bubble');

async function init() {
  const settings = await window.xiaoxu.getSettings();
  const assetPath = settings.robotAssetPath || './robot.png';
  if (assetPath.startsWith('http')) {
    robot.src = assetPath;
  } else {
    const normalized = assetPath.replace(/\\/g, '/');
    robot.src = normalized.startsWith('file://') ? normalized : `file://${normalized}`;
  }
}

async function updateSpeech() {
  const speech = await window.xiaoxu.getSpeech();
  if (!speech) return;
  bubble.textContent = speech;
  bubble.classList.remove('hidden');
}

window.addEventListener('mouseenter', updateSpeech);

window.xiaoxu.onMood((mood) => {
  if (mood === 'worry') {
    bubble.style.background = 'rgba(255, 235, 235, 0.95)';
    bubble.style.color = '#7a1d1d';
  } else {
    bubble.style.background = '';
    bubble.style.color = '';
  }
});

init();
