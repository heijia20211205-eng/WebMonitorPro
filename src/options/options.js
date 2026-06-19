// Options page for WebMonitor Pro

function $(id) { return document.getElementById(id); }
function showToast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' error' : '');
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2500);
}

async function loadTasks() {
  const res = await chrome.runtime.sendMessage({ type: 'TASK_LIST' });
  if (!res.success) return;
  const tasks = res.data || [];
  const container = $('taskList');
  if (tasks.length === 0) {
    container.innerHTML = '<p style="color:#999">暂无任务</p>';
    return;
  }
  container.innerHTML = '';
  tasks.sort((a, b) => a.createdAt - b.createdAt);
  for (const t of tasks) {
    const div = document.createElement('div');
    div.className = 'task-item';
    const status = t.enabled !== false ? 'active' : 'paused';
    const lastVal = t.lastValue !== undefined ? `最新值：${t.lastValue}` : '尚未检测';
    div.innerHTML = `
      <div class="meta">
        <span class="status-light ${status}"></span>
        <strong>${escHtml(t.name)}</strong>
        <span class="badge">${t.interval}s</span>
        <span class="badge" style="background:#666">区域(${t.cropX},${t.cropY},${t.cropW},${t.cropH})</span>
      </div>
      <div style="font-size:12px;color:#888;margin-top:2px">
        ${escHtml(t.url)}
      </div>
      <div class="last-value">${lastVal}</div>
      <div class="task-actions">
        <button data-id="${t.id}" class="toggleBtn">${t.enabled !== false ? '⏸ 暂停' : '▶ 启用'}</button>
        <button data-id="${t.id}" class="deleteBtn danger" style="background:#ff4d4f;color:#fff">🗑 删除</button>
      </div>
    `;
    div.querySelector('.toggleBtn').addEventListener('click', async () => {
      const r = await chrome.runtime.sendMessage({ type: 'TASK_TOGGLE', taskId: t.id });
      if (r.success) { showToast('已更新'); loadTasks(); }
    });
    div.querySelector('.deleteBtn').addEventListener('click', async () => {
      if (!confirm(`确认删除监控「${t.name}」？`)) return;
      const r = await chrome.runtime.sendMessage({ type: 'TASK_DELETE', taskId: t.id });
      if (r.success) { showToast('已删除'); loadTasks(); }
    });
    container.appendChild(div);
  }
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

$('btnAdd').addEventListener('click', async () => {
  const task = {
    name: $('inputName').value.trim() || '未命名',
    url: $('inputUrl').value.trim(),
    interval: parseInt($('inputInterval').value) || 60,
    cropX: parseInt($('inputX').value) || 0,
    cropY: parseInt($('inputY').value) || 0,
    cropW: parseInt($('inputW').value) || 200,
    cropH: parseInt($('inputH').value) || 50,
    alertOnChange: $('inputAlertOnChange').checked,
    alertOnTarget: $('inputAlertOnTarget').checked,
    operator: $('inputOperator').value,
    targetValue: $('inputTargetValue').value.trim(),
    notifyQQ: $('inputNotifyQQ').checked,
    notifySound: $('inputNotifySound').checked,
    soundType: $('inputSound').value
  };
  if (!task.url) { showToast('请输入URL', true); return; }
  if (!task.url.startsWith('http://') && !task.url.startsWith('https://')) {
    task.url = 'https://' + task.url;
  }
  const res = await chrome.runtime.sendMessage({ type: 'TASK_CREATE', task });
  if (res.success) {
    showToast('✅ 监控已添加，开始监控！');
    // 清空表单
    $('inputUrl').value = '';
    $('inputName').value = '';
    loadTasks();
  } else {
    showToast('❌ ' + (res.error?.message || '添加失败'), true);
  }
});

$('btnTestSound').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'PLAY_SOUND', sound: $('inputSound').value });
  $('testResult').textContent = '🔊 已播放';
  setTimeout(() => $('testResult').textContent = '', 2000);
});

$('btnTestNotify').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'TEST_NOTIFY', text: '测试：WebMonitor Pro 检测到数值变化！' });
  $('testResult').textContent = '📩 通知已发送';
  setTimeout(() => $('testResult').textContent = '', 2000);
});

// 加载
loadTasks();
