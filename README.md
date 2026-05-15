# iot-expo

Ứng dụng Expo (React Native) cho IoT.

## Biến môi trường

Sao chép `.env.example` thành `.env` (file `.env` đã được gitignore). Chỉ dùng tiền tố `**EXPO_PUBLIC_**` để biến được embed vào bundle.


| Biến                    | Ý nghĩa                                                                         |
| ----------------------- | ------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_DEVICE_ID` | Giá trị mặc định khi chưa ghép nối (sau ghép nối, app dùng `deviceId` trong QR) |
| `EXPO_PUBLIC_APP_NAME`  | Tiêu đề hiển thị trên màn Home                                                  |


Sau khi sửa `.env`, cần **khởi động lại** `npx expo start` (và rebuild native nếu dùng `expo run:ios` / `run:android`).

## Ghép nối bằng QR

Lần đầu mở app (hoặc sau khi bấm **Ghép lại**), màn hình yêu cầu quét **QR chứa JSON** đúng chuẩn.

**Trong QR (JSON):** `v` = 1, `deviceId`, `mqttHost`; tùy chọn `mqttPort` (8883), `mqttUser`, `label`. Có thể thêm `**mqttPass`** hoặc `**mqttPassword**`: nếu có thì app **lưu và vào Home ngay** (không cần nhập tay). Đưa mật khẩu vào QR **rủi ro** nếu QR bị lộ; chỉ dùng khi bạn chấp nhận rủi ro.

Nếu QR **không** có mật khẩu, app hiện bước xác nhận để bạn nhập.

File mẫu: `pairing-qr.example.json`.

Sau khi thêm plugin `expo-camera`, cần **build lại native** (`npx expo prebuild` hoặc `expo run:ios` / `run:android`).

## MQTT trực tiếp (Home)

- App kết nối broker qua **WSS cổng 8884** (`mqtt.js`); firmware ESP32 dùng **TLS TCP 8883** — cùng HiveMQ Cloud.
- Tự subscribe `telemetry` + `status`, publish `relay/cmd` (`auto` / `cut` / `connect`).
- Mật khẩu lưu `expo-secure-store`; profile thiết bị lưu AsyncStorage.



