# Theme Messenger

Thứ tự nạp (khai báo trong `THEMES` ở `src/main.js`): `palettes/<tên>.css` (biến màu `--msgr-*`), `messenger.css` (gắn biến vào Teams), rồi file ghi đè riêng nếu có (`zalo.css`).

## Biến màu trong palette

| Biến | Dùng cho |
|---|---|
| `--msgr-accent` (+ `-hover`, `-pressed`) | Icon, nút, tab đang chọn |
| `--msgr-accent-tint`, `-tint-2` | Hàng chat đang mở, nền nhạt màu chủ đạo |
| `--msgr-mine-bg` / `--msgr-mine-fg` | Bong bóng của mình (gradient cố định theo cửa sổ) |
| `--msgr-theirs-bg` / `--msgr-theirs-fg` | Bong bóng người khác |
| `--msgr-surface`, `-2`, `-3` | Nền app, hover, pressed |
| `--msgr-chat-bg`, `--msgr-chat-bg-image` (+ size/position/repeat) | Nền khung chat |
| `--msgr-composer-bg` | Ô nhập tin |
| `--msgr-fg`, `-2`, `-3` | Chữ chính, phụ, mờ |
| `--msgr-divider`, `--msgr-red` | Đường kẻ, badge thông báo |
| `--msgr-radius` | Bo góc bong bóng (Messenger 18px, Zalo 8px) |
| `--zalo-*` | Chỉ Zalo: màu thanh trái, bóng bong bóng, viền bong bóng của mình |

Chữ trắng trên `--msgr-accent` / `--msgr-mine-bg` nên đạt tương phản ≥ 4.5:1.

## Hook trong DOM Teams (đã kiểm tra trên Teams 2.x, 11/2026)

- Màu toàn app: ghi đè token Fluent (`--colorNeutral*`, `--colorBrand*`, `--theme*`) trên `.fui-FluentProvider`. Ép giao diện sáng kể cả khi Teams để dark mode.
- Bong bóng: `.fui-ChatMyMessage__body`, `.fui-ChatMessage__body`; reply: `[data-tid=quoted-reply-card]`; reaction: `[data-tid=diverse-reaction-pill-button]`, `[data-tid=add-reaction-picker-entry-point-button]`.
- Danh sách chat: `[data-tid=app-layout-area--mid-nav] .fui-TreeItem[data-item-type=chat]`; đang mở: `[data-tabster*="LeftRailSelectedItem"]`.
- Header: `[data-tid=entity-header]`, `[data-tid=chat-title]`, `[data-tid=entity-header-toolbar]`.
- Khung chat: `[data-tid=message-pane-layout]`.
- Ô nhập tin: `[data-tid=ckeditor]`, nút `[data-tid^=sendMessageCommands-]`, khung bọc là `div` chứa cả `simplified-formatting-toolbar` và `ckeditor`.

Thanh icon bên trái (Zalo): ghi đè lại token ngay trên `[data-tid=app-layout-area--nav]` để icon, hover, vạch chọn đều thành trắng.

Không dùng class băm của Griffel (kiểu `.f1abc23`) vì đổi theo mỗi bản build.
