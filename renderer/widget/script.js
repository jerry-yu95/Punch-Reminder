const robot = document.getElementById('robot');
const bubble = document.getElementById('bubble');

async function init() {
  const robotPath = await window.xiaoxu.getRobotPath();
  const normalized = robotPath.replace(/\\/g, '/');
  robot.src = normalized.startsWith('file://') ? normalized : `file://${normalized}`;
  window.xiaoxu.setInteractive(false);

  const weather = await window.xiaoxu.getWeatherSummary();
  if (weather) {
    bubble.textContent = `今日${weather}`;
    bubble.classList.remove('hidden');
    setTimeout(() => {
      bubble.classList.add('hidden');
    }, 4000);
  }
}

async function updateSpeech() {
  const speech = await window.xiaoxu.getSpeech();
  if (!speech) return;
  bubble.textContent = speech;
  bubble.classList.remove('hidden');
}

window.addEventListener('mouseenter', updateSpeech);

robot.addEventListener('mouseenter', () => {
  window.xiaoxu.setInteractive(true);
});

robot.addEventListener('mouseleave', () => {
  window.xiaoxu.setInteractive(false);
});

robot.addEventListener('mousedown', () => {
  window.xiaoxu.setInteractive(true);
});

robot.addEventListener('mouseup', () => {
  window.xiaoxu.setInteractive(false);
});

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
