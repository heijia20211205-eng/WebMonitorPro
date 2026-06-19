document.getElementById('openOptions').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

async function render() {
  const res = await chrome.runtime.sendMessage({ type: 'TASK_LIST' });
  const container = document.getElementById('tasks');
  if (!res.success || !res.data || res.data.length === 0) {
    container.innerHTML = '<div class="empty">暂无监控任务<br>点 ⚙️ 打开设置添加</div>';
    return;
  }
  container.innerHTML = '';
  for (const t of res.data) {
    const status = t.enabled !== false ? 'on' : 'off';
    const val = t.lastValue !== undefined ? String(t.lastValue) : '—';
    const time = t.lastCheck ? new Date(t.lastCheck).toLocaleTimeString() : '-';
    const div = document.createElement('div');
    div.className = 'task';
    div.innerHTML = `
      <div><span class="status ${status}"></span><span class="name">${esc(t.name)}</span></div>
      <div class="val">${esc(val)}</div>
      <div class="meta">${esc(t.url)} · 每${t.interval}s · 最近: ${time}</div>
    `;
    container.appendChild(div);
  }
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

render();
