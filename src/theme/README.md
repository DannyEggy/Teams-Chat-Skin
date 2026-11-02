# Themes

Load order (declared in `THEMES` in `src/main.js`): `palettes/<name>.css` (the `--msgr-*` colour variables), then `messenger.css` (maps the variables onto Teams), then any theme-specific overrides (`zalo.css`).

## Palette variables

| Variable | Used for |
|---|---|
| `--msgr-accent` (+ `-hover`, `-pressed`) | Icons, buttons, selected tab |
| `--msgr-accent-tint`, `-tint-2` | Open chat row, light accent surfaces |
| `--msgr-mine-bg` / `--msgr-mine-fg` | Your bubbles (Messenger: gradient fixed to the window) |
| `--msgr-theirs-bg` / `--msgr-theirs-fg` | Other people's bubbles |
| `--msgr-surface`, `-2`, `-3` | App background, hover, pressed |
| `--msgr-chat-bg`, `--msgr-chat-bg-image` (+ size/position/repeat) | Chat pane background |
| `--msgr-composer-bg` | Message box |
| `--msgr-fg`, `-2`, `-3` | Primary, secondary and muted text |
| `--msgr-divider`, `--msgr-red` | Dividers, notification badges |
| `--msgr-radius` | Bubble corner radius (Messenger 18px, Zalo 8px) |
| `--zalo-*` | Zalo only: rail colour, bubble shadow, border on your bubbles |

White text on `--msgr-accent` and on `--msgr-mine-bg` should reach a 4.5:1 contrast ratio.

## Teams DOM hooks (checked against Teams 2.x, November 2026)

- App-wide colours: Fluent UI tokens (`--colorNeutral*`, `--colorBrand*`, `--theme*`) overridden on `.fui-FluentProvider`. This forces a light look even when Teams is in dark mode.
- Bubbles: `.fui-ChatMyMessage__body`, `.fui-ChatMessage__body`. Replies: `[data-tid=quoted-reply-card]`. Reactions: `[data-tid=diverse-reaction-pill-button]`, `[data-tid=add-reaction-picker-entry-point-button]`.
- Chat list: `[data-tid=app-layout-area--mid-nav] .fui-TreeItem[data-item-type=chat]`. Open chat: `[data-tabster*="LeftRailSelectedItem"]`.
- Header: `[data-tid=entity-header]`, `[data-tid=chat-title]`, `[data-tid=entity-header-toolbar]`.
- Chat pane: `[data-tid=message-pane-layout]`.
- Composer: `[data-tid=ckeditor]`, buttons `[data-tid^=sendMessageCommands-]`. The surrounding card is the `div` that contains both `simplified-formatting-toolbar` and `ckeditor`.
- Left rail (Zalo): tokens are re-declared on `[data-tid=app-layout-area--nav]` so icons, hover and the selection indicator all turn white.

Never use Griffel's hashed class names (like `.f1abc23`); they change with every Teams build.
