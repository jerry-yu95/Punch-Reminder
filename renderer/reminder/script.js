const title = document.getElementById('title');
const body = document.getElementById('body');
const openBtn = document.getElementById('open');

window.xiaoxu.onReminder((payload) => {
  title.textContent = payload.title;
  body.textContent = payload.body;
  openBtn.style.display = payload.showButton ? 'block' : 'none';
});

openBtn.addEventListener('click', () => {
  window.xiaoxu.openPunchUrl();
  window.close();
});
