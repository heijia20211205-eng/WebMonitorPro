// =============================================================
// WebMonitor Pro v1.0 - 网页数值监控引擎
// 功能：定时刷新页面 → 截图/提取数值 → 比对触发 → QQ/音提醒
// =============================================================

// ---- 配置 ----
// QQ通知目标 - 直接设为当前会话ID
const QQ_NOTIFY_TARGET = '477D0196FFD56EA4A5A3003AE8B6BB16';

// ---- 工具类 ----
class Storage {
  async get(key) { const r = await chrome.storage.local.get(key); return r[key]; }
  async set(key, val) { await chrome.storage.local.set({ [key]: val }); }
  async getAll() { return chrome.storage.local.get(null); }
}

const storage = new Storage();

// ---- 任务管理器 ----
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
    task.lastAlertedTarget = false;  // 避免重复报警
    this.tasks.push(task);
    await this.save();
    await this.scheduleAlarm(task);
    return { success: true, data: task };
  }
  async update(id, patch) {
    const idx = this.tasks.findIndex(t => t.id === id);
    if (idx === -1) return { success: false, error: { message: '任务不存在' } };
    Object.assign(this.tasks[idx], patch);
    await this.save();
    await this.scheduleAlarm(this.tasks[idx]);
    return { success: true };
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
      chrome.alarms.create(task.id, { periodInMinutes: task.interval / 60 });
      // 立即触发第一次
      this.checkTask(task);
    }
  }
  async checkTask(task) {
    if (!task.enabled) return;
    console.log(`[监控] 检查任务: ${task.name}`);
    task.lastCheck = Date.now();

    try {
      const value = await this.scrapeValue(task.url, task);
      task.lastValue = value !== null ? String(value) : value;
      await this.save();

      // 数值变化提醒
      if (task.alertOnChange && value !== null) {
        await this.notify(task, `数值更新: ${task.name} = ${value}`, value);
      }

      // 目标值提醒
      if (task.alertOnTarget && value !== null && task.targetValue !== '') {
        const matched = this.compareValues(value, task.operator, task.targetValue);
        if (matched && !task.lastAlertedTarget) {
          task.lastAlertedTarget = true;
          await this.notify(task, `🎯 达标! ${task.name}: ${value} ${task.operator} ${task.targetValue}`, value);
        } else if (!matched) {
          task.lastAlertedTarget = false;
        }
        await this.save();
      }
    } catch (e) {
      console.error(`[监控] ${task.name} 检查失败:`, e);
    }
  }

  async scrapeValue(url, task) {
    // 方案1: 用 tabs API 打开/注入脚本提取文本
    // 方案2: 用 offscreen document + fetch + DOMParser
    // 这里使用方案2 更稳定
    try {
      const html = await this.fetchPage(url);
      if (!html) return null;
      const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      // 尝试从区域坐标附近提取数字
      return this.extractNumber(textContent, task);
    } catch (e) {
      console.error('[抓取] fetch失败，尝试tabs方案:', e.message);
      return null;
    }
  }

  async fetchPage(url) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000)
      });
      return await resp.text();
    } catch (e) {
      // 某些页面需要CORS，回退到tabs方案
      return this.fetchViaTab(url);
    }
  }

  async fetchViaTab(url) {
    // 用后台tab加载页面，注入脚本提取文本
    const tab = await chrome.tabs.create({ url, active: false });
    try {
      await this.waitTabLoaded(tab.id, 20000);
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body?.innerText || ''
      });
      await chrome.tabs.remove(tab.id);
      return results[0]?.result || '';
    } catch (e) {
      try { await chrome.tabs.remove(tab.id); } catch(_) {}
      throw e;
    }
  }

  waitTabLoaded(tabId, timeout) {
    return new Promise((resolve, reject) => {
      let done = false;
      const tid = setTimeout(() => { if (!done) { done = true; reject(new Error('timeout')); } }, timeout);
      chrome.tabs.onUpdated.addListener(function listener(id, info) {
        if (id === tabId && info.status === 'complete') {
          clearTimeout(tid);
          if (!done) { done = true; resolve(); }
        }
      });
    });
  }

  extractNumber(text, task) {
    // 尝试提取数字（兼容整数/小数/带逗号/带符号）
    const nums = text.match(/-?[\d,]+\.?\d*/g);
    if (!nums || nums.length === 0) return null;
    // 取最后一个有效数字（通常是页面中的主要数值）
    for (let i = nums.length - 1; i >= 0; i--) {
      const n = parseFloat(nums[i].replace(/,/g, ''));
      if (!isNaN(n)) return n;
    }
    return null;
  }

  compareValues(actual, operator, targetStr) {
    const target = parseFloat(targetStr);
    if (isNaN(target)) return false;
    const val = typeof actual === 'number' ? actual : parseFloat(String(actual).replace(/[^0-9.\-]/g, ''));
    if (isNaN(val)) return false;
    switch (operator) {
      case '==': return Math.abs(val - target) < 0.0001;
      case '>':  return val > target;
      case '>=': return val >= target;
      case '<':  return val < target;
      case '<=': return val <= target;
      default: return false;
    }
  }

  async notify(task, message, value) {
    // 1. 通知提醒
    if (task.notifyQQ !== false) {
      await this.sendQQNotify(message);
    }

    // 2. 提示音
    if (task.notifySound !== false) {
      await this.playSound(task.soundType || 'beep');
    }

    // 3. 浏览器桌面通知
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icon.png',
        title: task.name,
        message: String(value !== undefined ? `${message} (${value})` : message)
      });
    } catch (_) {}
  }

  async sendQQNotify(text) {
    // 通过 EasyClaw 的 QQ bot 通道发送
    const qid = QQ_NOTIFY_TARGET;
    if (!qid) {
      console.log('[QQ] 未配置QQ通知ID');
      return;
    }
    // 使用fetch触发本地EasyClaw网关转发
    try {
      const resp = await fetch('http://localhost:17840/api/qqbot/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: qid,
          message: `[WebMonitor] ${text}`
        })
      });
      if (!resp.ok) console.warn('[QQ] send notify failed:', await resp.text());
    } catch (e) {
      console.warn('[QQ] 无法发送QQ通知:', e.message);
    }
  }

  async playSound(type) {
    try {
      // 用Offscreen API播放声音
      const doc = await chrome.offscreen.createDocument({
        url: 'src/background/player.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: '播放提醒提示音'
      });
      chrome.runtime.sendMessage({
        type: 'PLAY_SOUND_IN_OFFSCREEN',
        sound: type || 'beep'
      });
      setTimeout(() => chrome.offscreen.closeDocument(), 3000);
    } catch (e) {
      console.warn('[音效] 播放失败:', e.message);
    }
  }
}

// ---- 初始化 ----
const taskManager = new TaskManager();
await taskManager.load();



// ---- 消息路由 ----
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
          const r = await taskManager.update(message.taskId, message.patch);
          respond(r);
          break;
        }
        case 'PLAY_SOUND': {
          await taskManager.playSound(message.sound || 'beep');
          respond({ success: true });
          break;
        }
        case 'TEST_NOTIFY': {
          await taskManager.sendQQNotify(message.text || '测试通知');
          if (message.sound !== false) await taskManager.playSound('beep');
          respond({ success: true });
          break;
        }

        default:
          respond({ success: false, error: { message: `未知消息类型: ${message.type}` } });
      }
    } catch (e) {
      respond({ success: false, error: { message: e.message } });
    }
  })();
  return true; // 异步响应
});

// ---- Alarm触发器 ----
chrome.alarms.onAlarm.addListener((alarm) => {
  const task = taskManager.tasks.find(t => t.id === alarm.name);
  if (task) taskManager.checkTask(task);
});

// ---- 启动时恢复所有alarms ----
for (const t of taskManager.tasks) {
  if (t.enabled !== false) {
    chrome.alarms.create(t.id, { periodInMinutes: Math.max(t.interval / 60, 0.17) }); // 最小10秒
  }
}

console.log('✅ WebMonitor Pro 已启动');
