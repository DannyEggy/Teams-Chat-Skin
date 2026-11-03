"""Teams Messenger, Python edition.

A small pywebview take on the Electron app: opens Teams on the web and injects
the same Messenger / Zalo theme CSS from src/theme. Just for fun; the Electron
app in src/ has more features (tray, unread badge, screen-share picker, ...).

Run:  pip install -r python/requirements.txt
      python python/teams_messenger.py
"""

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import webview
from webview.menu import Menu, MenuAction, MenuSeparator

IS_MAC = sys.platform == 'darwin'
IS_WIN = sys.platform == 'win32'

# Theme CSS is shared with the Electron app. A PyInstaller build bundles it
# next to the script (sys._MEIPASS); a source checkout reads it from src/theme.
BUNDLE_DIR = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent.parent))
THEME_DIR = BUNDLE_DIR / 'theme' if hasattr(sys, '_MEIPASS') else BUNDLE_DIR / 'src' / 'theme'

# Work/school accounts and personal Microsoft accounts use different Teams sites.
ACCOUNTS = {
    'work': ('Công ty / trường học', 'https://teams.microsoft.com/v2/'),
    'personal': ('Cá nhân (Outlook, Hotmail, Live)', 'https://teams.live.com/v2/'),
}
# Each look is a stack of CSS files from src/theme, injected in order.
THEMES = {
    'love': ('Messenger – Love (hồng/tím)', ['palettes/love.css', 'messenger.css']),
    'classic': ('Messenger – Classic (xanh)', ['palettes/classic.css', 'messenger.css']),
    'zalo': ('Zalo', ['palettes/zalo.css', 'messenger.css', 'zalo.css']),
}
TEAMS_HOSTS = {'teams.microsoft.com', 'teams.cloud.microsoft', 'teams.live.com'}

# WKWebView's default user agent has no browser name, so Teams calls it
# unsupported; present it as the Safari it really is. WebView2 on Windows
# already reports itself as Edge.
USER_AGENT = (
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
    '(KHTML, like Gecko) Version/18.0 Safari/605.1.15'
) if IS_MAC else None


def data_dir():
    if IS_WIN:
        base = Path(os.environ.get('APPDATA', Path.home()))
    elif IS_MAC:
        base = Path.home() / 'Library' / 'Application Support'
    else:
        base = Path(os.environ.get('XDG_CONFIG_HOME', Path.home() / '.config'))
    return base / 'Teams Messenger (Python)'


DATA_DIR = data_dir()
SETTINGS_PATH = DATA_DIR / 'settings.json'
DEFAULT_SETTINGS = {'themeEnabled': True, 'palette': 'love', 'account': 'work', 'width': 1200, 'height': 800}


def load_settings():
    try:
        return {**DEFAULT_SETTINGS, **json.loads(SETTINGS_PATH.read_text('utf-8'))}
    except (OSError, ValueError):
        return dict(DEFAULT_SETTINGS)


settings = load_settings()


def save_settings():
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        SETTINGS_PATH.write_text(json.dumps(settings, indent=2), 'utf-8')
    except OSError as err:
        print('[settings] save failed:', err)


def teams_url():
    return ACCOUNTS.get(settings['account'], ACCOUNTS['work'])[1]


# ---------------------------------------------------------------------------
# Theme CSS injection
# ---------------------------------------------------------------------------

def read_theme_css():
    files = THEMES.get(settings['palette'], THEMES['love'])[1]
    try:
        return '\n'.join((THEME_DIR / f).read_text('utf-8') for f in files)
    except OSError as err:
        print(f'[theme] {err}, skipping')
        return None


def is_teams_page(url):
    return bool(url) and urlparse(url).hostname in TEAMS_HOSTS


# Teams' Content Security Policy blocks eval() and inline <style> tags, so the
# script goes through run_js (native, no eval) and the CSS through a
# constructable stylesheet, which the policy does not cover.
SET_THEME_JS = """
(() => {
  const css = %s;
  let sheet = window.__teamsMessengerTheme;
  if (!sheet) {
    sheet = window.__teamsMessengerTheme = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }
  sheet.replaceSync(css);
})();
"""


def apply_theme(window):
    """Insert, replace or clear the theme stylesheet to match the settings."""
    css = read_theme_css() if settings['themeEnabled'] else None
    # Only theme Teams itself, not the Microsoft / company login pages.
    if css is None or not is_teams_page(window.get_current_url()):
        css = ''
    window.run_js(SET_THEME_JS % json.dumps(css))


# WKWebView in an app without the passkey entitlement never shows a passkey
# prompt, so the Microsoft sign-in page hangs on "Trying to sign you in".
# Make WebAuthn report "unavailable" before any page script runs, so the page
# offers password / email code / Authenticator instead (same as preload.js).
PASSKEY_STUB_JS = """
(() => {
  const fail = () => Promise.reject(
    new DOMException('Passkeys are not supported in this app.', 'NotAllowedError'));
  if (window.PublicKeyCredential) {
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = () => Promise.resolve(false);
    PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(false);
  }
  if (navigator.credentials) {
    navigator.credentials.get = fail;
    navigator.credentials.create = fail;
  }
})();
"""


def disable_passkeys(window):
    """Runs on the main thread right before the first page load (macOS only)."""
    import WebKit
    from webview.platforms.cocoa import BrowserView

    script = WebKit.WKUserScript.alloc().initWithSource_injectionTime_forMainFrameOnly_(
        PASSKEY_STUB_JS, WebKit.WKUserScriptInjectionTimeAtDocumentStart, False)
    wk = BrowserView.instances[window.uid].webview
    wk.configuration().userContentController().addUserScript_(script)


# ---------------------------------------------------------------------------
# Menu actions
# ---------------------------------------------------------------------------

def set_palette(window, palette):
    settings['palette'] = palette
    settings['themeEnabled'] = True
    save_settings()
    apply_theme(window)


def toggle_theme(window):
    settings['themeEnabled'] = not settings['themeEnabled']
    save_settings()
    apply_theme(window)


def set_account(window, account):
    settings['account'] = account
    save_settings()
    window.load_url(teams_url())


def build_menu(window):
    themes = [MenuAction(label, lambda p=pid: set_palette(window, p)) for pid, (label, _) in THEMES.items()]
    accounts = [MenuAction(label, lambda a=aid: set_account(window, a)) for aid, (label, _) in ACCOUNTS.items()]
    return [
        Menu('Giao diện', [
            *themes,
            MenuSeparator(),
            MenuAction('Bật / tắt theme', lambda: toggle_theme(window)),
            MenuAction('Tải lại CSS theme', lambda: apply_theme(window)),
        ]),
        Menu('Tài khoản', [
            *accounts,
            MenuSeparator(),
            MenuAction('Tải lại Teams', lambda: window.load_url(teams_url())),
        ]),
    ]


def on_closing(window):
    settings['width'], settings['height'] = window.width, window.height
    save_settings()


def main():
    window = webview.create_window(
        'Teams Messenger',
        teams_url(),
        width=settings['width'],
        height=settings['height'],
        min_size=(480, 360),
        text_select=True,
        zoomable=True,
    )
    if IS_MAC:
        window.events.before_show += lambda: disable_passkeys(window)
    window.events.loaded += lambda: apply_theme(window)
    window.events.closing += lambda: on_closing(window)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    webview.start(
        menu=build_menu(window),
        user_agent=USER_AGENT,
        # Keep cookies so the Teams sign-in survives restarts.
        private_mode=False,
        storage_path=str(DATA_DIR / 'webview'),
        debug='--debug' in sys.argv,
    )


if __name__ == '__main__':
    main()
