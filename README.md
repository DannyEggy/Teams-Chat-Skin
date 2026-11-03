# Teams Chat Skin

An unofficial desktop app (Electron) for Microsoft Teams that wraps Teams on the web and restyles it to look like Messenger or Zalo. No admin rights needed: sign in with your work, school or personal Microsoft account as usual.

Themes:

- **Messenger – Love**: lavender chat background with hearts, pink bubbles (default)
- **Messenger – Classic**: white background, blue bubbles
- **Zalo**: blue side rail, flat chat list, light-blue bubbles

## Why this exists

This is a just-for-fun side project: an experiment in vibe coding, built with an AI coding assistant. It is not a commercial product. It is not sold, has no paid version and is not meant to make money. Feel free to try it, fork it and play with the themes.

## Run from source (macOS and Windows)

Requires [Node.js](https://nodejs.org) 18 or later (LTS recommended).

```bash
git clone https://github.com/DannyEggy/Teams-Chat-Skin.git
cd Teams-Chat-Skin
npm install
npm start
```

Sign in once; the session is kept on your machine, outside the project folder.

The commands are the same in Terminal (macOS) and PowerShell or Command Prompt (Windows). `npm start` clears the `ELECTRON_RUN_AS_NODE` variable that VS Code sets in its terminal, so it works from any terminal.

## Build an installer

| Command | Output in `dist/` | For |
|---|---|---|
| `npm run dist:mac` | `Teams Messenger-1.0.0-arm64.dmg` and `-mac.zip` | Apple silicon Macs (M1 and later) |
| `npm run dist:win` | `Teams Messenger Setup 1.0.0.exe` and `Teams Messenger Portable 1.0.0.exe` | 64-bit Windows |
| `npm run dist:portable` | `Teams Messenger Portable 1.0.0.exe` | 64-bit Windows, single file, no install |

The Windows installer can be built on a Mac. The macOS build must be made on a Mac.

The builds are not code-signed, so the first launch shows a warning:

- **macOS**: right-click the app → **Open** → **Open**. If it is still blocked, run `xattr -cr "/Applications/Teams Messenger.app"`.
- **Windows**: SmartScreen shows "Windows protected your PC" → **More info** → **Run anyway**.

## Python version (experimental)

A smaller take on the app lives in [python/teams_messenger.py](python/teams_messenger.py). It uses [pywebview](https://pywebview.flowrl.com) to open Teams in the system web view (WebKit on macOS, WebView2 on Windows) and injects the same theme CSS from `src/theme`. Just for fun; the Electron app above is the full version.

Requires Python 3.9 or later.

```bash
pip3 install -r python/requirements.txt
python3 python/teams_messenger.py
```

On Windows use `pip` and `python` instead. Add `--debug` to open the web inspector.

The menu bar has **Giao diện** (pick a theme, turn it on or off, reload the CSS) and **Tài khoản** (work/school or personal account, reload Teams). Settings are kept in `Teams Messenger (Python)` under `~/Library/Application Support` on macOS or `%APPDATA%` on Windows.

Compared with the Electron app it has no tray icon, unread badge, keyboard shortcuts, screen-share picker or per-site permission rules. On macOS it runs on Safari's engine, so Teams calls and screen sharing may be limited, and passkeys are turned off as in the Electron app. So far it has only been checked on macOS, up to the Microsoft sign-in page; the theme after sign-in and the Windows build are untested.

## Using the app

Pick a theme in **View → Giao diện**. Your choice is remembered.

### Signing in with a personal Microsoft account

Personal accounts (Outlook, Hotmail, Live, or a Gmail address registered as a Microsoft account) use a different Teams site from work and school accounts. The app opens the work/school one by default.

1. Run `npm start`.
2. In the menu bar, choose **View → Loại tài khoản → Cá nhân (Outlook, Hotmail, Live)**. The app switches to `teams.live.com`.
3. Click **Đăng nhập** (Sign in) at the top right and enter your email.
4. On macOS, choose a password, an email or SMS code, or the Microsoft Authenticator app. Passkeys are not available in the app (see [Limitations](#limitations)).

The app remembers the account type. Switch back with **View → Loại tài khoản → Công ty / trường học**.

| Shortcut | Action |
|---|---|
| ⌘R | Reload Teams |
| ⌘⇧M | Turn the theme on or off |
| ⌘⇧R | Reload theme CSS |
| ⌥⌘I | Developer tools |
| ⌘+ / ⌘- / ⌘0 | Zoom in / out / reset |
| ⌘W | Close the window (the app keeps running for notifications) |
| ⌘Q | Quit (macOS) |

On Windows, use Ctrl instead of ⌘. The menu bar is hidden; press **Alt** to show it.

Closing the window does not quit the app, so notifications keep arriving:

- **macOS**: click the Dock icon to bring the window back; press ⌘Q to quit.
- **Windows**: the app stays in the system tray (bottom-right of the taskbar, possibly under the ^ arrow). Click the icon to reopen it; right-click → **Thoát** to quit. The taskbar button flashes on new messages, and the tray tooltip shows the unread count.

The menu labels are in Vietnamese.

## Editing themes

- `src/theme/palettes/*.css`: the colours for each theme.
- `src/theme/messenger.css`: maps those colours onto Teams (bubbles, chat list, composer, header). Shared by every theme.
- `src/theme/zalo.css`: extra Zalo-only rules (blue rail, flat rows, 8px bubbles, flat composer).

When you run from source, saving a CSS file applies it at once, without reloading Teams. Themes apply only to Teams pages, never to sign-in pages.

To add a theme, copy `palettes/love.css` to a new file, change the colours, and add an entry to `THEMES` in `src/main.js` listing its CSS files in load order. See [src/theme/README.md](src/theme/README.md) for the variables and the Teams DOM hooks the themes rely on.

**View → Xuất cấu trúc DOM (ẩn nội dung)** saves `teams-dom-outline.txt` to your Desktop. It contains only tag names, `data-tid`, `role` and class names, with no message content, so it is safe to share when reporting a broken theme.

Installed builds (`.dmg` / `.exe`) bundle the CSS, so rebuild after editing a theme.

## Security

- **Isolation**: Teams runs in a sandboxed renderer with context isolation and no Node.js access. The only preload script turns off passkeys on macOS (see Limitations); it exposes nothing to the page and gives it no access to your files or system.
- **Permissions**: notifications, camera, microphone, clipboard and screen capture are granted only to Microsoft HTTPS pages. Other sites the window reaches (for example a company sign-in page) get nothing.
- **Screen sharing** always asks which screen or window to share (the macOS system picker, or the app's own dialog). Nothing is shared silently.
- **Links** outside Microsoft open in your default browser, not inside the app.
- **Your session** (cookies and tokens) is stored in your user profile: `~/Library/Application Support/Teams Messenger` on macOS, `%APPDATA%\Teams Messenger` on Windows. Anyone who can access your OS account can reuse it, as with any browser. Keep disk encryption (FileVault / BitLocker) on.
- **No telemetry**: the app itself sends nothing anywhere. All network traffic is Teams talking to Microsoft.
- **`npm run dev` is for theme development only.** It opens a Chrome DevTools port on `127.0.0.1:9333`, and any program on your computer can use that port to read and control your Teams session. Use `npm start` for everyday use. Installed builds never open this port.
- **Installed builds** have Electron's `RunAsNode`, `NODE_OPTIONS` and `--inspect` entry points disabled and verify their own app archive at startup, so the app cannot be used to run other code.
- **Downloads**: builds are unsigned. Only install builds from this repository's Releases page, not copies passed around in chat.
- **Updates**: there is no auto-update. Pull and rebuild from time to time to get Electron (Chromium) security fixes.

Found a security problem? Please open an issue on GitHub.

## Limitations

- **Conditional Access**: some organisations only allow sign-in from managed browsers or devices (Intune, Edge with SSO). The app identifies itself as Edge, but sign-in can still be blocked if your organisation checks the device. The app cannot work around that.
- **Passkeys on macOS**: Electron has no passkey / Touch ID prompt on macOS, so the app turns passkeys off there and Microsoft offers other sign-in methods instead: password, a code by email or SMS, or the Microsoft Authenticator app. If your account only has a passkey, add another method at [account.microsoft.com/security](https://account.microsoft.com/security) in a normal browser first.
- **Teams updates**: Microsoft changes the Teams DOM often, so parts of a theme can break after an update. Turn the theme off (⌘⇧M), export the DOM outline and adjust the CSS.
- The Windows build has been built and checked on a Mac, but not yet run on a real Windows machine.

## License

[MIT](LICENSE) © 2026 Võ Thanh Danh (DannyEggy).

This project is not affiliated with Microsoft, Meta or Zalo. Their names and trademarks belong to their respective owners.
