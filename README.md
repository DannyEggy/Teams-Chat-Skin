# Teams Chat Skin

An unofficial desktop app (Electron) for Microsoft Teams that wraps Teams on the web and restyles it to look like Messenger or Zalo. No admin rights needed: sign in with your work or school account as usual.

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
| `npm run dist:mac` | `Teams Messenger-1.0.0-arm64.dmg` | Apple silicon Macs (M1 and later) |
| `npm run dist:win` | `Teams Messenger Setup 1.0.0.exe` | 64-bit Windows |

The Windows installer can be built on a Mac. The macOS build must be made on a Mac.

The builds are not code-signed, so the first launch shows a warning:

- **macOS**: right-click the app → **Open** → **Open**. If it is still blocked, run `xattr -cr "/Applications/Teams Messenger.app"`.
- **Windows**: SmartScreen shows "Windows protected your PC" → **More info** → **Run anyway**.

## Using the app

Pick a theme in **View → Giao diện**. Your choice is remembered.

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

- **Isolation**: Teams runs in a sandboxed renderer with context isolation and no Node.js access. The app has no preload script and gives the page no access to your files or system.
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
- **Teams updates**: Microsoft changes the Teams DOM often, so parts of a theme can break after an update. Turn the theme off (⌘⇧M), export the DOM outline and adjust the CSS.
- The Windows build has been built and checked on a Mac, but not yet run on a real Windows machine.

## License

[MIT](LICENSE) © 2026 Võ Thanh Danh (DannyEggy).

This project is not affiliated with Microsoft, Meta or Zalo. Their names and trademarks belong to their respective owners.
