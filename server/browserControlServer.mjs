import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

const HOST = '127.0.0.1';
const PORT = Number(process.env.BROWSER_CONTROL_PORT || 8787);
const DEBUG_PORT = Number(process.env.BROWSER_CONTROL_DEBUG_PORT || 9223);
const PROFILE_DIR = resolve(process.cwd(), '.browser-control-profile');

let chromeProcess = null;
let targetWsUrl = null;
let ws = null;
let commandId = 0;
let pending = new Map();

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const json = (res, status, body) => {
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
};

const readJson = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
};

const findChrome = () => {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chrome'
  ];

  return candidates.find(candidate => candidate.includes('/') ? existsSync(candidate) : true) || candidates[0];
};

const debugFetch = async (path, init = {}) => {
  const response = await fetch(`http://${HOST}:${DEBUG_PORT}${path}`, init);
  if (!response.ok) {
    throw new Error(`Chrome DevTools returned ${response.status} for ${path}`);
  }
  return response.json();
};

const isDevToolsReady = async () => {
  try {
    await debugFetch('/json/version');
    return true;
  } catch {
    return false;
  }
};

const launchChrome = async () => {
  if (!existsSync(PROFILE_DIR)) mkdirSync(PROFILE_DIR, { recursive: true });

  if (!chromeProcess || chromeProcess.killed) {
    chromeProcess = spawn(findChrome(), [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--new-window',
      'about:blank'
    ], {
      detached: true,
      stdio: 'ignore'
    });
    chromeProcess.unref();
  }

  for (let i = 0; i < 50; i += 1) {
    if (await isDevToolsReady()) return;
    await wait(100);
  }

  throw new Error('Timed out waiting for Chrome DevTools to become available.');
};

const openTarget = async (url = 'about:blank') => {
  await launchChrome();

  const encodedUrl = encodeURIComponent(url);
  const target = await debugFetch(`/json/new?${encodedUrl}`, { method: 'PUT' });
  targetWsUrl = target.webSocketDebuggerUrl;
  await connectTarget();
};

const connectTarget = async () => {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  if (!targetWsUrl) {
    await launchChrome();
    const targets = await debugFetch('/json');
    const page = targets.find(target => target.type === 'page');
    if (page?.webSocketDebuggerUrl) {
      targetWsUrl = page.webSocketDebuggerUrl;
    } else {
      await openTarget();
      return;
    }
  }

  ws = new WebSocket(targetWsUrl);
  pending = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;

    const { resolve: resolvePending, reject } = pending.get(message.id);
    pending.delete(message.id);

    if (message.error) {
      reject(new Error(message.error.message || 'Chrome DevTools command failed.'));
    } else {
      resolvePending(message.result || {});
    }
  });

  ws.addEventListener('close', () => {
    ws = null;
    pending.forEach(({ reject }) => reject(new Error('Chrome DevTools connection closed.')));
    pending.clear();
  });

  await new Promise((resolveConnection, rejectConnection) => {
    const timeout = setTimeout(() => rejectConnection(new Error('Timed out connecting to Chrome DevTools.')), 5000);
    ws.addEventListener('open', () => {
      clearTimeout(timeout);
      resolveConnection();
    }, { once: true });
    ws.addEventListener('error', () => {
      clearTimeout(timeout);
      rejectConnection(new Error('Could not connect to Chrome DevTools.'));
    }, { once: true });
  });

  await sendCdp('Page.enable');
  await sendCdp('Runtime.enable');
  await sendCdp('DOM.enable');
  await sendCdp('Input.setIgnoreInputEvents', { ignore: false });
};

const sendCdp = async (method, params = {}) => {
  await connectTarget();
  const id = ++commandId;

  return new Promise((resolveCommand, rejectCommand) => {
    pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
    ws.send(JSON.stringify({ id, method, params }));
  });
};

const evaluate = async (expression) => {
  const result = await sendCdp('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Page script evaluation failed.');
  }

  return result.result?.value;
};

const navigate = async (url) => {
  if (!targetWsUrl) {
    await openTarget(url);
  } else {
    await sendCdp('Page.navigate', { url });
  }
  return { status: 'navigated', url };
};

const snapshot = async () => evaluate(`(() => {
  const selector = 'a,button,input,textarea,select,[role="button"],[role="link"],[contenteditable="true"]';
  const isVisible = (el) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 1 && rect.height > 1;
  };
  const labelFor = (el) => {
    const id = el.getAttribute('id');
    const label = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
    return [
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('placeholder'),
      label?.innerText,
      el.innerText,
      el.value,
      el.textContent
    ].find(value => value && String(value).trim()) || '';
  };
  return Array.from(document.querySelectorAll(selector))
    .filter(isVisible)
    .slice(0, 80)
    .map((el, index) => {
      const rect = el.getBoundingClientRect();
      const browserControlId = String(index + 1);
      el.setAttribute('data-browser-control-id', browserControlId);
      return {
        id: browserControlId,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        label: String(labelFor(el)).replace(/\\s+/g, ' ').trim().slice(0, 160),
        href: el.href || '',
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    });
})()`);

const clickElement = async (elementId) => evaluate(`(() => {
  const el = document.querySelector('[data-browser-control-id="${String(elementId).replace(/"/g, '\\"')}"]');
  if (!el) return { error: 'No element with that snapshot id. Take a fresh snapshot.' };
  el.scrollIntoView({ block: 'center', inline: 'center' });
  el.focus?.();
  el.click();
  return { status: 'clicked', id: '${String(elementId).replace(/'/g, "\\'")}', label: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 160) };
})()`);

const clickText = async (text) => evaluate(`(() => {
  const wanted = ${JSON.stringify(String(text).toLowerCase())};
  const candidates = Array.from(document.querySelectorAll('a,button,input,textarea,select,[role="button"],[role="link"],[contenteditable="true"]'));
  const match = candidates.find(el => {
    const label = [
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('placeholder'),
      el.innerText,
      el.value,
      el.textContent
    ].filter(Boolean).join(' ').toLowerCase();
    const rect = el.getBoundingClientRect();
    return label.includes(wanted) && rect.width > 1 && rect.height > 1;
  });
  if (!match) return { error: 'No visible element matching that text.' };
  match.scrollIntoView({ block: 'center', inline: 'center' });
  match.focus?.();
  match.click();
  return { status: 'clicked', text: ${JSON.stringify(text)} };
})()`);

const typeText = async (text) => {
  await sendCdp('Input.insertText', { text: String(text) });
  return { status: 'typed', length: String(text).length };
};

const pressKey = async (key) => {
  const keyName = String(key || 'Enter');
  const virtualKeyCodes = {
    Enter: 13,
    Tab: 9,
    Escape: 27,
    Backspace: 8,
    Delete: 46,
    ArrowUp: 38,
    ArrowDown: 40,
    ArrowLeft: 37,
    ArrowRight: 39
  };
  const windowsVirtualKeyCode = virtualKeyCodes[keyName] || keyName.toUpperCase().charCodeAt(0);
  await sendCdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: keyName, windowsVirtualKeyCode });
  await sendCdp('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, windowsVirtualKeyCode });
  return { status: 'pressed', key: keyName };
};

const scrollBy = async (deltaY = 600) => {
  await sendCdp('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 400,
    y: 400,
    deltaY: Number(deltaY) || 600,
    deltaX: 0
  });
  return { status: 'scrolled', deltaY: Number(deltaY) || 600 };
};

const handleBrowserControl = async (args) => {
  const action = args.action || 'show_home';

  if (action === 'open_url') return navigate(normalizeUrl(args.url || 'https://www.google.com'));
  if (action === 'search') return navigate(`https://www.google.com/search?q=${encodeURIComponent(args.query || '')}`);
  if (action === 'show_home') return navigate('https://www.google.com');
  if (action === 'snapshot') return { status: 'snapshot', elements: await snapshot() };
  if (action === 'click_element') return clickElement(args.elementId);
  if (action === 'click_text') return clickText(args.text || '');
  if (action === 'type') return typeText(args.text || '');
  if (action === 'key') return pressKey(args.key || 'Enter');
  if (action === 'scroll') return scrollBy(args.deltaY);
  if (action === 'wait') {
    await wait(Number(args.ms) || 1000);
    return { status: 'waited', ms: Number(args.ms) || 1000 };
  }

  throw new Error(`Unsupported browser control action: ${action}`);
};

const normalizeUrl = (value) => {
  const trimmed = String(value || '').trim().replace(/[),.;!?]+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && req.url === '/status') {
      json(res, 200, {
        ok: true,
        bridge: 'ready',
        chromeDevToolsReady: await isDevToolsReady(),
        debugPort: DEBUG_PORT,
        supportedActions: ['open_url', 'search', 'show_home', 'snapshot', 'click_element', 'click_text', 'type', 'key', 'scroll', 'wait']
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/browser-control') {
      const body = await readJson(req);
      const output = await handleBrowserControl(body);
      json(res, 200, { ok: true, output });
      return;
    }

    json(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Browser Control bridge ready at http://${HOST}:${PORT}`);
});
