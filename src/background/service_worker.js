// WebMonitor Pro v1.0 - Value Monitor Engine
// Features: periodic page check -> extract value -> compare -> QQ/sound alert

// ---- Config ----
const QQ_NOTIFY_TARGET = '477D0196FFD56EA4A5A3003AE8B6BB16';

// ---- Storage ----
class Storage {
  async get(key) { const r = await chrome.storage.local.get(key); return r[key]; }
  async set(key, val) { await chrome.storage.local.set({ [key]: val }); }
  async getAll() { return chrome.storage.local.get(null); }
}

const storage = new Storage();

// ---- Task Manager ----
class TaskManager {
  async load() {
    this.tasks = await storage.get('tasks') || [];
  }
  async save() {
    await storage.set('tasks', this.tasks);
  }
  async create(task) {
    task.id = crypto.randomUUID();
    task.createdAt = Date.now();
    task.enabled = true;
    task.lastValue = undefined;
    task.lastCheck = 0;
    task.lastAlertedTarget = false;
    this.tasks.push(task);
    await this.save();
    await this.scheduleAlarm(task);
    return { success: true, data: task };
  }
  async delete(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    await this.save();
    chrome.alarms.clear(id);
    return { success: true };
  }
  async toggle(id) {
    const t = this.tasks.find(t => t.id === id);
    if (!t) return { success: false };
    t.enabled = !t.enabled;
    await this.save();
    if (t.enabled) await this.scheduleAlarm(t);
    else chrome.alarms.clear(id);
    return { success: true };
  }
  async scheduleAlarm(task) {
    chrome.alarms.clear(task.id);
    if (task.enabled !== false) {
      chrome.alarms.create(task.id, { periodInMinutes: Math.max(task.interval / 60, 0.17) });
      this.checkTask(task);
    }
  }
  async checkTask(task) {
    if (!task.enabled) return;
    console.log('[Monitor] check task:', task.name);
    task.lastCheck = Date.now();
    try {
      const value = await this.scrapeValue(task.url);
      task.lastValue = value !== null ? String(value) : value;
      await this.save();
      if (task.alertOnChange && value !== null) {
        await this.notify(task, task.name + ' = ' + value, value);
      }
      if (task.alertOnTarget && value !== null && task.targetValue !== '') {
        const matched = this.compareValues(value, task.operator, task.targetValue);
        if (matched && !task.lastAlertedTarget) {
          task.lastAlertedTarget = true;
          await this.notify(task, 'TARGET! ' + task.name + ': ' + value + ' ' + task.operator + ' ' + task.targetValue, value);
        } else if (!matched) {
          task.lastAlertedTarget = false;
        }
        await this.save();
      }
    } catch (e) {
      console.error('[Monitor] check error:', e);
    }
  }
  async scrapeValue(url) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000)
      });
      const html = await resp.text();
      const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const nums = textContent.match(/-?[\d,]+\.?\d*/g);
      if (!nums || nums.length === 0) return null;
      for (let i = nums.length - 1; i >= 0; i--) {
        const n = parseFloat(nums[i].replace(/,/g, ''));
        if (!isNaN(n)) return n;
      }
      return null;
    } catch (e) {
      console.error('[Fetch] failed:', e.message);
      return null;
    }
  }
  compareValues(actual, operator, targetStr) {
    const target = parseFloat(targetStr);
    if (isNaN(target)) return false;
    const val = typeof actual === 'number' ? actual : parseFloat(String(actual).replace(/[^0-9.\-]/g, ''));
    if (isNaN(val)) return false;
    switch (operator) {
      case '==': return Math.abs(val - target) < 0.0001;
      case '>': return val > target;
      case '>=': return val >= target;
      case '<': return val < target;
      case '<=': return val <= target;
      default: return false;
    }
  }
  async notify(task, message, value) {
    if (task.notifyQQ !== false) {
      await this.sendQQNotify(message);
    }
    if (task.notifySound !== false) {
      await this.playSound(task.soundType || 'beep');
    }
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icon.png',
        title: task.name,
        message: String(value !== undefined ? message + ' (' + value + ')' : message)
      });
    } catch (_) {}
  }
  async sendQQNotify(text) {
    const qid = QQ_NOTIFY_TARGET;
    if (!qid) { console.log('[QQ] no target'); return; }
    try {
      const resp = await fetch('http://localhost:17840/api/qqbot/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: qid, message: '[WebMonitor] ' + text })
      });
      if (!resp.ok) console.warn('[QQ] send failed:', await resp.text());
    } catch (e) {
      console.warn('[QQ] error:', e.message);
    }
  }
  async playSound(type) {
    try {
      await chrome.offscreen.createDocument({
        url: 'src/background/player.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play alert sound'
      });
      chrome.runtime.sendMessage({ type: 'PLAY_SOUND_IN_OFFSCREEN', sound: type || 'beep' });
      setTimeout(() => chrome.offscreen.closeDocument(), 3000);
    } catch (e) {
      console.warn('[Sound] failed:', e.message);
    }
  }
}

// ---- Init ----
const taskManager = new TaskManager();
await taskManager.load();

// ---- Message Router ----
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  (async () => {
    try {
      switch (message.type) {
        case 'TASK_CREATE': {
          const r = await taskManager.create(message.task);
          respond(r);
          break;
        }
        case 'TASK_LIST': {
          respond({ success: true, data: taskManager.tasks });
          break;
        }
        case 'TASK_DELETE': {
          const r = await taskManager.delete(message.taskId);
          respond(r);
          break;
        }
        case 'TASK_TOGGLE': {
          const r = await taskManager.toggle(message.taskId);
          respond(r);
          break;
        }
        case 'TASK_UPDATE': {
          respond({ success: true });
          break;
        }
        case 'PLAY_SOUND': {
          await taskManager.playSound(message.sound || 'beep');
          respond({ success: true });
          break;
        }
        case 'TEST_NOTIFY': {
          await taskManager.sendQQNotify(message.text || 'Test notification');
          if (message.sound !== false) await taskManager.playSound('beep');
          respond({ success: true });
          break;
        }
        default:
          respond({ success: false, error: { message: 'Unknown type: ' + message.type } });
      }
    } catch (e) {
      respond({ success: false, error: { message: e.message } });
    }
  })();
  return true;
});

// ---- Alarms ----
chrome.alarms.onAlarm.addListener((alarm) => {
  const task = taskManager.tasks.find(t => t.id === alarm.name);
  if (task) taskManager.checkTask(task);
});

// ---- Restore alarms ----
for (const t of taskManager.tasks) {
  if (t.enabled !== false) {
    chrome.alarms.create(t.id, { periodInMinutes: Math.max(t.interval / 60, 0.17) });
  }
}

console.log('WebMonitor Pro started');