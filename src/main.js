'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  session,
  shell,
  dialog,
  screen,
  systemPreferences,
  desktopCapturer,
  Tray,
  nativeImage,
  webContents,
} = require('electron');
const fs = require('fs');
const path = require('path');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
const APP_ID = 'com.dannyeggy.teamsmessenger';
const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');
const TEAMS_URL = 'https://teams.microsoft.com/v2/';
const PARTITION = 'persist:teams';
const THEME_DIR = path.join(__dirname, 'theme');
// Each look is a stack of CSS files from src/theme, injected in order:
// colour variables first, then the shared Messenger layout, then overrides.
const THEMES = [
  { id: 'love', label: 'Messenger – Love (hồng/tím)', files: ['palettes/love.css', 'messenger.css'] },
  { id: 'classic', label: 'Messenger – Classic (xanh)', files: ['palettes/classic.css', 'messenger.css'] },
  { id: 'zalo', label: 'Zalo', files: ['palettes/zalo.css', 'messenger.css', 'zalo.css'] },
];
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

// `npm run dev` exposes Chrome DevTools Protocol on localhost only, for theme work.
const DEBUG_PORT = !app.isPackaged && process.env.TEAMS_DEBUG_PORT;
if (DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', DEBUG_PORT);
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
}

// Pretend to be Edge so Teams doesn't show "unsupported browser".
const chromeVersion = process.versions.chrome;
const UA_PLATFORM = IS_WIN ? 'Windows NT 10.0; Win64; x64' : 'Macintosh; Intel Mac OS X 10_15_7';
const USER_AGENT =
  `Mozilla/5.0 (${UA_PLATFORM}) AppleWebKit/537.36 ` +
  `(KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 Edg/${chromeVersion}`;
app.userAgentFallback = USER_AGENT;

// Windows only shows toast notifications for apps with an AppUserModelID.
// Unpackaged (npm start) runs must use the Electron executable path.
if (IS_WIN) app.setAppUserModelId(app.isPackaged ? APP_ID : process.execPath);

let mainWindow = null;
let tray = null;
let isQuitting = false;
let unreadCount = 0;

// ---------------------------------------------------------------------------
// Settings (window bounds + theme toggle), stored as plain JSON in userData
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = { themeEnabled: true, palette: 'love', bounds: null, isMaximized: false };

function currentTheme() {
  return THEMES.find((t) => t.id === settings.palette) || THEMES[0];
}

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = loadSettings();

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('[settings] save failed:', err.message);
  }
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Only reuse saved bounds if they're still visible on a connected display.
function restoredBounds() {
  const b = settings.bounds;
  if (!b) return { width: 1200, height: 800 };
  const visible = screen.getAllDisplays().some(({ workArea: a }) =>
    b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y);
  return visible ? b : { width: b.width, height: b.height };
}

function rememberWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  settings.isMaximized = mainWindow.isMaximized();
  if (!mainWindow.isFullScreen()) settings.bounds = mainWindow.getNormalBounds();
  saveSettings();
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const MS_EXACT_HOSTS = new Set([
  'login.microsoftonline.com', 'login.live.com', 'login.windows.net',
  'teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft',
]);
const MS_HOST_SUFFIXES = [
  'microsoft.com', 'microsoftonline.com', 'office.com', 'office.net',
  'live.com', 'skype.com', 'cloud.microsoft',
];
// Pages on which we let the main window navigate anywhere (federated company IdPs, MFA, ...).
const AUTH_HOST_SUFFIXES = ['microsoftonline.com', 'login.live.com', 'login.windows.net'];

function hostMatches(host, suffixes) {
  return suffixes.some((s) => host === s || host.endsWith('.' + s));
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isMicrosoftUrl(url) {
  const u = parseUrl(url);
  if (!u || u.protocol !== 'https:') return false;
  return MS_EXACT_HOSTS.has(u.hostname) || hostMatches(u.hostname, MS_HOST_SUFFIXES);
}

function openExternally(url) {
  const u = parseUrl(url);
  if (u && ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol)) {
    shell.openExternal(url).catch((err) => console.error('[openExternal]', err.message));
  }
}

function windowOpenHandler({ url }) {
  if (url === 'about:blank' || url === '' || isMicrosoftUrl(url)) return { action: 'allow' };
  openExternally(url);
  return { action: 'deny' };
}

// Popups (auth, Teams sub-windows) get the same link handling as the main window.
function wirePopups(contents) {
  contents.setWindowOpenHandler(windowOpenHandler);
  contents.on('did-create-window', (child) => wirePopups(child.webContents));
}

// ---------------------------------------------------------------------------
// Theme CSS injection + hot reload
// ---------------------------------------------------------------------------

let cssKey = null; // key returned by insertCSS for the current document
let cssQueue = Promise.resolve(); // serialize insert/remove so keys never get lost
let warnedMissingCss = false;

function readThemeCss() {
  const { files } = currentTheme();
  try {
    const css = files.map((f) => fs.readFileSync(path.join(THEME_DIR, f), 'utf8')).join('\n');
    warnedMissingCss = false;
    return css;
  } catch (err) {
    if (!warnedMissingCss) console.warn(`[theme] ${err.message}, skipping`);
    warnedMissingCss = true;
    return null;
  }
}

function queueCss(task) {
  cssQueue = cssQueue.then(task).catch((err) => console.error('[theme]', err.message));
  return cssQueue;
}

async function removeThemeNow(wc) {
  if (!cssKey) return;
  const key = cssKey;
  cssKey = null;
  await wc.removeInsertedCSS(key).catch(() => {});
}

// Only theme Teams itself, not the Microsoft / company login pages.
function isTeamsPage(url) {
  const u = parseUrl(url);
  return !!u && ['teams.microsoft.com', 'teams.cloud.microsoft', 'teams.live.com'].includes(u.hostname);
}

async function insertThemeNow(wc) {
  if (!settings.themeEnabled || !isTeamsPage(wc.getURL())) return;
  const css = readThemeCss();
  if (css === null) return;
  cssKey = await wc.insertCSS(css);
}

// Insert if not already present in the current document.
function ensureTheme() {
  return queueCss(async () => {
    const wc = mainWindow?.webContents;
    if (!wc || wc.isDestroyed() || cssKey || !settings.themeEnabled) return;
    await insertThemeNow(wc);
  });
}

// Swap the CSS in place (used by hot reload / toggle) — no page reload needed.
function reloadTheme() {
  return queueCss(async () => {
    const wc = mainWindow?.webContents;
    if (!wc || wc.isDestroyed()) return;
    await removeThemeNow(wc);
    await insertThemeNow(wc);
    console.log(`[theme] ${settings.themeEnabled && cssKey ? 'applied' : 'removed'}`);
  });
}

function setThemeEnabled(enabled) {
  settings.themeEnabled = enabled;
  saveSettings();
  reloadTheme();
}

function setPalette(id) {
  settings.palette = id;
  saveSettings();
  reloadTheme();
}

function watchThemeFile() {
  if (app.isPackaged) return; // bundled CSS inside the .app never changes
  const onChange = debounce(reloadTheme, 150);
  try {
    // Watch the folder (not the files) so atomic saves / file creation are picked up.
    fs.watch(THEME_DIR, { recursive: true }, (_event, filename) => {
      if (!filename || filename.endsWith('.css')) onChange();
    });
  } catch (err) {
    console.warn('[theme] cannot watch theme folder:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Session: user agent, permissions, screen sharing
// ---------------------------------------------------------------------------

const ALLOWED_PERMISSIONS = new Set([
  'notifications', 'media', 'clipboard-read', 'clipboard-sanitized-write',
  'fullscreen', 'display-capture',
]);

async function requestMacMediaAccess(mediaTypes = []) {
  if (!IS_MAC) return true;
  const wanted = [];
  if (mediaTypes.includes('video')) wanted.push('camera');
  if (mediaTypes.includes('audio')) wanted.push('microphone');
  for (const type of wanted) {
    if (systemPreferences.getMediaAccessStatus(type) === 'granted') continue;
    if (!(await systemPreferences.askForMediaAccess(type))) return false;
  }
  return true;
}

// Screen-share picker shown before Teams gets any capture stream.
async function pickDisplaySource(wc) {
  const sources = (await desktopCapturer.getSources({ types: ['screen', 'window'] })).slice(0, 8);
  if (!sources.length) return null;
  const parent = BrowserWindow.fromWebContents(wc) || mainWindow;
  const { response } = await dialog.showMessageBox(parent, {
    type: 'question',
    message: 'Chia sẻ màn hình',
    detail: 'Chọn màn hình hoặc cửa sổ muốn chia sẻ trong Teams.',
    buttons: [...sources.map((src) => src.name), 'Hủy'],
    cancelId: sources.length,
    defaultId: sources.length,
  });
  return sources[response] || null;
}

function setupSession(ses) {
  ses.setUserAgent(USER_AGENT);

  // Only Microsoft pages get permissions; the session may also show company
  // login pages or other sites reached through redirects.
  ses.setPermissionCheckHandler((_wc, _permission, requestingOrigin) => isMicrosoftUrl(requestingOrigin));
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    if (!ALLOWED_PERMISSIONS.has(permission)) return callback(false);
    if (!isMicrosoftUrl(details.requestingUrl || wc.getURL())) return callback(false);
    if (permission === 'media') {
      requestMacMediaAccess(details.mediaTypes).then(callback, () => callback(false));
      return;
    }
    callback(true);
  });

  // getDisplayMedia (Teams screen sharing). macOS 15+ shows the native picker;
  // elsewhere the user picks a screen/window in our dialog. Never share silently.
  ses.setDisplayMediaRequestHandler(
    (request, callback) => {
      if (!isTeamsPage(request.securityOrigin || request.frame?.url || '')) return callback({});
      const wc = request.frame ? webContents.fromFrame(request.frame) : null;
      pickDisplaySource(wc || mainWindow?.webContents)
        .then((source) => callback(source ? { video: source } : {}))
        .catch(() => callback({}));
    },
    { useSystemPicker: true },
  );
}

// ---------------------------------------------------------------------------
// DOM outline export (structure only, no private content)
// ---------------------------------------------------------------------------

// Runs inside the page. Emits tag / data-tid / role / classes / [aria] only.
const DOM_OUTLINE_SCRIPT = `(() => {
  const MAX_DEPTH = 25, MAX_NODES = 6000, MAX_CLASSES = 6, MAX_SAME_SIBLINGS = 3;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META']);
  const LEAF = new Set(['svg', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO', 'IMG']);
  // Mask anything that looks like an id, email or long number.
  const scrub = (s) => String(s)
    .replace(/\\S+@\\S+/g, '<id>')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{20,}/gi, '<id>')
    .replace(/\\d{6,}/g, '<id>')
    .slice(0, 80);
  const lines = [];
  let count = 0, truncated = false;

  const describe = (el) => {
    let s = el.tagName.toLowerCase();
    const tid = el.getAttribute('data-tid');
    if (tid) s += '[data-tid="' + scrub(tid) + '"]';
    const role = el.getAttribute('role');
    if (role) s += '[role=' + scrub(role) + ']';
    const cls = Array.from(el.classList);
    if (cls.length) {
      s += '.' + cls.slice(0, MAX_CLASSES).map(scrub).join('.');
      if (cls.length > MAX_CLASSES) s += ' (+' + (cls.length - MAX_CLASSES) + ' cls)';
    }
    if (el.hasAttribute('aria-label')) s += ' [aria]';
    return s;
  };

  const walk = (el, depth) => {
    if (count >= MAX_NODES) { truncated = true; return; }
    count++;
    const pad = '  '.repeat(depth);
    lines.push(pad + describe(el));
    if (LEAF.has(el.tagName) || depth >= MAX_DEPTH) {
      if (!LEAF.has(el.tagName) && el.children.length) lines.push(pad + '  … (max depth)');
      return;
    }
    // Collapse long runs of look-alike siblings (message lists, chat lists, ...).
    const seen = new Map();
    for (const child of el.children) {
      if (SKIP.has(child.tagName)) continue;
      const sig = describe(child);
      const n = (seen.get(sig) || 0) + 1;
      seen.set(sig, n);
      if (n <= MAX_SAME_SIBLINGS) walk(child, depth + 1);
    }
    for (const [sig, n] of seen) {
      if (n > MAX_SAME_SIBLINGS) lines.push(pad + '  … +' + (n - MAX_SAME_SIBLINGS) + ' more like: ' + sig);
    }
  };

  walk(document.body, 0);
  const header = [
    '# Teams DOM outline (structure only: tag, data-tid, role, class, [aria] = has aria-label)',
    '# generated: ' + new Date().toISOString(),
    '# viewport: ' + innerWidth + 'x' + innerHeight + ', nodes: ' + count + (truncated ? ' (truncated)' : ''),
    '',
  ];
  return header.concat(lines).join('\\n');
})()`;

async function exportDomOutline() {
  if (!mainWindow) return;
  try {
    const outline = await mainWindow.webContents.executeJavaScript(DOM_OUTLINE_SCRIPT, true);
    const file = path.join(app.getPath('desktop'), 'teams-dom-outline.txt');
    fs.writeFileSync(file, outline);
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: 'Đã xuất cấu trúc DOM',
      detail: `File đã lưu tại:\n${file}\n\nChỉ có tên thẻ, data-tid, role, class — không có nội dung tin nhắn.`,
      buttons: ['OK', IS_MAC ? 'Hiện trong Finder' : 'Mở thư mục chứa file'],
    });
    if (response === 1) shell.showItemInFolder(file);
  } catch (err) {
    dialog.showErrorBox('Xuất DOM thất bại', err.message);
  }
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

function buildMenu() {
  const wc = () => mainWindow?.webContents;
  const template = [
    IS_MAC ? { role: 'appMenu' } : { role: 'fileMenu' },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => wc()?.reload() },
        { type: 'separator' },
        {
          label: 'Bật/Tắt theme',
          type: 'checkbox',
          checked: settings.themeEnabled,
          accelerator: 'CmdOrCtrl+Shift+M',
          click: (item) => setThemeEnabled(item.checked),
        },
        {
          label: 'Giao diện',
          submenu: THEMES.map((p) => ({
            label: p.label,
            type: 'radio',
            checked: settings.palette === p.id,
            click: () => setPalette(p.id),
          })),
        },
        { label: 'Reload theme CSS', accelerator: 'CmdOrCtrl+Shift+R', click: () => reloadTheme() },
        { type: 'separator' },
        { label: 'Toggle DevTools', accelerator: 'Alt+CmdOrCtrl+I', click: () => wc()?.toggleDevTools() },
        { label: 'Xuất cấu trúc DOM (ẩn nội dung)', click: exportDomOutline },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------

function showMainWindow() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  const ses = session.fromPartition(PARTITION);

  mainWindow = new BrowserWindow({
    ...restoredBounds(),
    minWidth: 480,
    minHeight: 400,
    title: 'Teams Messenger',
    backgroundColor: '#ffffff',
    icon: IS_MAC ? undefined : ICON_PATH,
    autoHideMenuBar: !IS_MAC, // Windows: menu bar appears when Alt is pressed
    show: false,
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  if (settings.isMaximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());

  const wc = mainWindow.webContents;
  wirePopups(wc);

  // A new document drops previously inserted CSS, so forget the old key.
  wc.on('did-navigate', () => queueCss(() => { cssKey = null; }));
  wc.on('dom-ready', ensureTheme);
  wc.on('did-finish-load', ensureTheme);
  wc.on('did-navigate-in-page', ensureTheme);

  // Links and redirects that try to take over the main window go to the
  // default browser, except while on a login page (company SSO may redirect
  // to its own IdP).
  const guardNavigation = (event, url) => {
    if (isMicrosoftUrl(url)) return;
    const current = parseUrl(wc.getURL());
    const onAuthPage = !current || !isMicrosoftUrl(wc.getURL()) ||
      hostMatches(current.hostname, AUTH_HOST_SUFFIXES);
    if (onAuthPage && parseUrl(url)?.protocol === 'https:') return;
    event.preventDefault();
    openExternally(url);
  };
  wc.on('will-navigate', guardNavigation);
  wc.on('will-redirect', guardNavigation);

  // Unread count from titles like "(3) Chat | Microsoft Teams":
  // Dock badge on macOS, tray tooltip + taskbar flash on Windows.
  mainWindow.on('page-title-updated', (_event, title) => {
    const match = /^\((\d+)\+?\)/.exec(title);
    const count = match ? Number(match[1]) : 0;
    if (IS_MAC) {
      app.dock.setBadge(match ? match[0].slice(1, -1) : '');
    } else {
      tray?.setToolTip(count ? `Teams Messenger (${count} tin chưa đọc)` : 'Teams Messenger');
      if (count > unreadCount && !mainWindow.isFocused()) mainWindow.flashFrame(true);
    }
    unreadCount = count;
  });
  mainWindow.on('focus', () => mainWindow.flashFrame(false));

  wc.on('render-process-gone', (_event, details) => {
    console.error('[renderer] gone:', details.reason);
    if (details.reason !== 'clean-exit') setTimeout(() => wc.isDestroyed() || wc.reload(), 1000);
  });

  const saveState = debounce(rememberWindowState, 500);
  mainWindow.on('resize', saveState);
  mainWindow.on('move', saveState);

  // Closing hides the window so notifications keep coming. Quit with Cmd+Q
  // (macOS) or the tray menu (Windows).
  mainWindow.on('close', (event) => {
    rememberWindowState();
    if (isQuitting || (!IS_MAC && !tray)) return;
    event.preventDefault();
    if (mainWindow.isFullScreen()) {
      mainWindow.once('leave-full-screen', () => mainWindow.hide());
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.loadURL(TEAMS_URL);
}

// Windows: tray icon so the app keeps running after the window is closed.
function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 }));
  tray.setToolTip('Teams Messenger');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở Teams Messenger', click: showMainWindow },
    { type: 'separator' },
    { label: 'Thoát', click: () => app.quit() },
  ]));
  tray.on('click', showMainWindow);
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);

  app.whenReady().then(() => {
    setupSession(session.fromPartition(PARTITION));
    buildMenu();
    if (IS_WIN) createTray();
    createWindow();
    watchThemeFile();
  });

  // Dock click, or app brought to front (e.g. by clicking a Teams notification).
  app.on('activate', showMainWindow);
  app.on('did-become-active', () => {
    if (mainWindow && !mainWindow.isVisible()) showMainWindow();
  });

  app.on('before-quit', () => { isQuitting = true; });
  app.on('window-all-closed', () => {
    if (!IS_MAC) app.quit();
  });
}
