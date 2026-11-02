# Teams Messenger

App desktop (Electron) không chính thức, bọc Microsoft Teams bản web, kèm giao diện kiểu Messenger và Zalo. Không cần quyền admin, chỉ cần đăng nhập tài khoản công ty như bình thường.

## Chạy từ mã nguồn (macOS và Windows)

Cần [Node.js](https://nodejs.org) bản 18 trở lên (khuyên dùng bản LTS).

```bash
git clone https://github.com/DannyEggy/Teams-Chat-Skin.git
cd Teams-Chat-Skin
npm install
npm start
```

Đăng nhập một lần là được, phiên đăng nhập được lưu lại trên máy (không nằm trong thư mục code).

Lệnh giống nhau trên macOS (Terminal) và Windows (PowerShell / Command Prompt). `npm start` tự bỏ biến `ELECTRON_RUN_AS_NODE` mà VS Code hay bật sẵn, nên chạy từ terminal nào cũng được.

## Build ra file cài

| Lệnh | Kết quả trong `dist/` | Cho máy |
|---|---|---|
| `npm run dist:mac` | `Teams Messenger-1.0.0-arm64.dmg` | Mac chip Apple (M1 trở lên) |
| `npm run dist:win` | `Teams Messenger Setup 1.0.0.exe` | Windows 64-bit |

Build bản Windows chạy được ngay trên Mac. Bản Mac thì phải build trên Mac.

App chưa ký số, nên lần đầu mở:
- **macOS**: chuột phải vào app → **Open** → **Open**. Vẫn bị chặn thì chạy `xattr -cr "/Applications/Teams Messenger.app"`.
- **Windows**: SmartScreen báo "Windows protected your PC" → **More info** → **Run anyway**.

## Phím tắt

Trên Windows thay ⌘ bằng Ctrl. Thanh menu trên Windows bị ẩn, nhấn **Alt** để hiện.

| Phím | Chức năng |
|---|---|
| ⌘R | Reload Teams |
| ⌘⇧M | Bật/tắt theme |
| ⌘⇧R | Reload theme CSS |
| ⌥⌘I | DevTools |
| ⌘+ / ⌘- / ⌘0 | Phóng to / thu nhỏ / về mặc định |
| ⌘W | Đóng cửa sổ (app vẫn chạy ngầm để nhận thông báo) |
| ⌘Q | Thoát hẳn (macOS) |

**Đóng cửa sổ không thoát app**, để vẫn nhận thông báo:
- **macOS**: bấm icon trên Dock để mở lại, ⌘Q để thoát hẳn.
- **Windows**: app nằm ở khay hệ thống (góc phải taskbar, có thể nằm trong mũi tên ^). Bấm icon để mở lại, chuột phải → **Thoát** để thoát hẳn. Có tin mới thì nút trên taskbar nháy, rê chuột lên icon ở khay để xem số tin chưa đọc.

Menu **View → Xuất cấu trúc DOM (ẩn nội dung)** lưu file `teams-dom-outline.txt` ra Desktop. File này chỉ chứa tên thẻ, `data-tid`, `role` và `class`, không có nội dung tin nhắn, nên gửi cho người làm theme thoải mái.

## Sửa theme

Chọn giao diện trong menu **View → Giao diện**: **Messenger – Love** (hồng/tím, nền trái tim, mặc định), **Messenger – Classic** (xanh) hoặc **Zalo**.

- `src/theme/palettes/*.css`: bộ màu của từng giao diện.
- `src/theme/messenger.css`: phần gắn màu vào giao diện Teams (bong bóng, danh sách chat, ô nhập tin...), dùng chung cho mọi giao diện.
- `src/theme/zalo.css`: phần ghi đè riêng cho Zalo (thanh trái xanh, hàng chat phẳng, bong bóng bo 8px, ô nhập tin phẳng).

Khi chạy bằng `npm start` hoặc `npm run dev`, lưu file CSS là app tự áp theme mới ngay, không cần reload Teams. Theme chỉ áp lên trang Teams, không áp lên trang đăng nhập. Bật/tắt bằng ⌘⇧M; lựa chọn bật/tắt và bộ màu được nhớ cho lần mở sau.

Muốn thêm giao diện: copy `palettes/love.css` thành file mới, đổi màu, rồi thêm một dòng vào `THEMES` trong `src/main.js` (liệt kê các file CSS theo thứ tự nạp).

`npm run dev` mở thêm cổng debug Chrome (chỉ trên `127.0.0.1:9333`) để công cụ bên ngoài đọc cấu trúc trang và chụp màn hình khi chỉnh theme. Dùng hằng ngày thì chạy `npm start`, không mở cổng này.

Bản đã build (`.dmg` / `.exe`) đóng gói sẵn CSS bên trong. Sửa theme xong thì phải build lại.

## Lưu ý

- **Conditional Access**: một số công ty chỉ cho đăng nhập từ trình duyệt hoặc thiết bị được quản lý (Intune, Edge có SSO...). App này giả user agent là Edge, nhưng nếu policy kiểm tra thiết bị thì vẫn có thể bị chặn đăng nhập. Gặp trường hợp này thì app chịu, không lách được.
- **Teams đổi giao diện**: Microsoft cập nhật DOM/class của Teams khá thường xuyên. Sau một bản cập nhật, theme có thể bị lệch hoặc hỏng một phần. Khi đó tắt theme (⌘⇧M), xuất lại cấu trúc DOM rồi sửa CSS.
- Link ngoài (không phải Microsoft) sẽ mở bằng trình duyệt mặc định.
- Bản Windows mới build và kiểm tra trên Mac, chưa chạy thử trên máy Windows thật.

## License

[MIT](LICENSE) © 2026 Võ Thanh Danh (DannyEggy). Dự án không liên kết với Microsoft, Meta hay Zalo; các tên này thuộc về chủ sở hữu tương ứng.
