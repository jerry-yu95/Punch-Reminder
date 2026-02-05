const robot = document.getElementById('robot');
const bubble = document.getElementById('bubble');
const widget = document.getElementById('widget');

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

// 保持全天候穿透，交互由强提醒窗口接管

window.xiaoxu.onMood((mood) => {
  if (mood === 'worry') {
    bubble.style.background = 'rgba(255, 235, 235, 0.95)';
    bubble.style.color = '#7a1d1d';
    widget.dataset.mood = 'worry';
  } else if (mood === 'excited') {
    bubble.style.background = 'rgba(235, 248, 255, 0.95)';
    bubble.style.color = '#155b8a';
    widget.dataset.mood = 'excited';
  } else {
    bubble.style.background = '';
    bubble.style.color = '';
    widget.dataset.mood = 'normal';
  }
});

init();
