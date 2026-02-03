window.reminder.onReminder((payload) => {
  const title = document.getElementById('title');
  const body = document.getElementById('body');
  title.textContent = payload.title;
  body.textContent = payload.body;
});
