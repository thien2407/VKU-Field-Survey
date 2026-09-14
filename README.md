# 🏛️ VKU Field Survey - Hệ Thống Khảo Sát Thực Địa & Thu Thập Dữ Liệu Ngoại Tuyến

> **Dự án nhỏ 1: Khảo sát thực địa VKU - Thu thập dữ liệu ngoại tuyến (PWA & Capacitor iOS)**  
> **Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn (VKU) - Đại học Đà Nẵng**  
> 🌐 **Trải nghiệm trực tiếp (PWA iOS & Web)**: [https://quyens.github.io/VKU-Field-Survy/](https://quyens.github.io/VKU-Field-Survy/)

---

## 🌟 Giới thiệu

**VKU Field Survey** là ứng dụng di động lai (Hybrid Mobile App & PWA) phục vụ công tác thanh tra, kiểm kê và thu thập dữ liệu hiện trạng cơ sở vật chất khuôn viên Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn (VKU).

Ứng dụng được thiết kế theo kiến trúc **100% Offline-First**, cho phép cán bộ kiểm tra và sinh viên khảo sát hoạt động liên tục trong điều kiện mất sóng di động hoặc không có Wi-Fi trong các tầng hầm, phòng thí nghiệm, sân bãi.

---

## 🚀 Mục tiêu Học tập & Tính năng Cốt lõi

### 1. 📴 Hoạt động Ngoại tuyến 100% (Cache-First Service Worker)
- Cài đặt độc lập dạng **PWA Standalone** với Web App Manifest chuẩn.
- **Service Worker (`sw.js`)** áp dụng chiến lược **Cache-First** cho toàn bộ App Shell, fonts, CSS, JS bundles, giúp ứng dụng mở ngay tức thì dù không có mạng.
- Tích hợp **Background Sync API** (`vku-sync-queue`) tự động kích hoạt tiến trình đồng bộ ngầm khi thiết bị kết nối mạng trở lại.

### 2. 💾 Lưu trữ Bản nháp & Dữ liệu Cục bộ (IndexedDB)
- Quản lý 4 Object Stores an toàn trong client database:
  - `drafts`: Tự động lưu nháp form kiểm tra sau mỗi 600ms, chống mất dữ liệu khi ứng dụng bị tắt đột ngột.
  - `surveys`: Lưu trữ vĩnh viễn các phiếu khảo sát trên máy.
  - `syncQueue`: Hàng đợi các tác vụ mutation (`CREATE`, `UPDATE`, `DELETE`) chờ đồng bộ.
  - `settings`: Lưu tùy chọn và thông tin cán bộ khảo sát.

### 3. 🔄 Hàng đợi Đồng bộ Tự động (Offline Sync Queue Coordinator)
- Tự động phát hiện trạng thái mạng (`online` / `offline`) theo thời gian thực.
- Khi có mạng: Điều phối gửi tuần tự dữ liệu trong `syncQueue` lên máy chủ VKU (tích hợp Mock Server API với cơ chế khử trùng lặp và tính độ trễ thực tế).
- Nút bấm thủ công **"Đồng bộ ngay bây giờ"** và **"Dọn mục đã đồng bộ"**.
- Huy hiệu (Badge) đếm số lượng phiếu chờ gửi ngay trên thanh điều hướng.

### 4. 📱 Tích hợp Phần cứng Capacitor Native (Camera & GPS)
- **Cầu nối Camera (`@capacitor/camera`)**: Tự động mở camera gốc iOS với giao diện toàn màn hình, hỗ trợ nén ảnh client-side trước khi ghi vào IndexedDB. Fallback mượt mà sang HTML5 File Camera trên web.
- **Cầu nối Định vị GPS (`@capacitor/geolocation`)**: Thu nhận tọa độ chính xác cao (vĩ độ, kinh độ, độ sai số mét), tự động áp dụng công thức Haversine tính toán khoảng cách đến tòa nhà VKU gần nhất (Khu A, Khu B, Khu C, Thư viện, KTX...).

### 5. 🗺️ Sơ đồ Khuôn viên VKU Tương tác Trực quan
- Bản đồ vector chi tiết khuôn viên VKU: Khu A (Hiệu bộ), Khu B (CNTT & Lab AI), Khu C (KTMT), Thư viện số, Ký túc xá, Nhà đa năng, Căn tin, Cổng chính Nam Kỳ Khởi Nghĩa.
- Hiển thị trực quan các điểm kiểm tra bằng ghim màu:
  - 🟢 **Bình thường** (Ổn định)
  - 🟡 **Bảo trì nhẹ** (Cần sửa chữa)
  - 🔴 **Cấp bách** (Hỏng nặng / Khẩn cấp)

### 6. 🍎 Tối ưu hóa Trải nghiệm iOS & Xcode (Capacitor 8 SPM)
- **Chuẩn Apple Swift Package Manager (SPM)**: Loại bỏ hoàn toàn CocoaPods cũ, không phụ thuộc Ruby/gem, mở và build trực tiếp bằng Xcode.
- **Xử lý Safe Area & Dynamic Island**: Thụt lề an toàn phía trên tránh tai thỏ / Dynamic Island của iPhone 15, 16, 17 Pro.
- **iOS Bottom Tab Bar**: Thanh điều hướng 4 tab cố định ở đáy màn hình chuẩn iOS UITabBar.
- **Icon độ nét cao 1024x1024**: Biểu tượng ứng dụng VKU đồng bộ trên cả Xcode AppIcon và Safari HomeScreen.

---

## 📁 Cấu trúc Thư mục

```text
Field Survey/
├── ios/                          # Thư mục dự án iOS Native (Xcode)
│   └── App/
│       ├── App.xcodeproj         # File dự án mở trực tiếp trong Xcode
│       ├── CapApp-SPM/           # Quản lý Package.swift qua Apple SPM
│       └── App/
│           ├── Info.plist        # Cấu hình quyền Camera, Photos, GPS
│           └── Assets.xcassets/  # AppIcon 1024x1024 & Splash Screen
├── src/
│   ├── components/
│   │   ├── Header.ts             # Header thương hiệu, Live Network Status, Quick Sync
│   │   ├── SurveyForm.ts         # Form khảo sát cơ sở, Auto-save nháp, Camera, GPS
│   │   ├── SurveyList.ts         # Danh sách phiếu, bộ lọc trạng thái, tìm kiếm, xuất JSON
│   │   ├── CampusMap.ts          # Bản đồ vector khuôn viên VKU & ghim tọa độ thực tế
│   │   └── SyncModal.ts          # Quản lý hàng đợi đồng bộ và dữ liệu máy chủ
│   ├── data/
│   │   └── campusData.ts         # Tọa độ GPS các tòa nhà và danh mục thiết bị VKU
│   ├── db/
│   │   └── indexedDB.ts          # Lớp lưu trữ client-side IndexedDB 4 stores
│   ├── services/
│   │   ├── hardwareService.ts    # Cầu nối Camera & GPS (Capacitor + Web Fallback)
│   │   ├── syncService.ts        # Điều phối hàng đợi đồng bộ hóa ngoại tuyến
│   │   ├── mockServer.ts         # API máy chủ VKU giả lập lưu trữ persistent
│   │   └── notificationService.ts# Hệ thống thông báo Toast & âm thanh phản hồi
│   ├── types/
│   │   └── survey.ts             # Định nghĩa cấu trúc kiểu TypeScript
│   ├── index.css                 # Hệ thống thiết kế VKU Navy & Orange, Glassmorphism
│   └── main.ts                   # Khởi tạo App, Service Worker và Router điều hướng
├── public/
│   ├── manifest.json             # Web App Manifest PWA Standalone
│   ├── sw.js                     # Service Worker Cache-First & Offline Sync
│   ├── apple-touch-icon.png      # Icon chuẩn Apple iOS (180x180)
│   └── icons/                    # Icons PNG & SVG độ phân giải cao
├── capacitor.config.ts           # Cấu hình Capacitor Bridge cho iOS
├── package.json                  # Dependencies & Scripts
├── tsconfig.json                 # Cấu hình TypeScript
└── vite.config.ts                # Cấu hình Vite Build
```

---

## 🛠️ Yêu cầu Hệ thống (Prerequisites)

- **Node.js**: Phiên bản `>= 22.0.0` (LTS khuyến nghị)
- **npm**: Phiên bản `>= 10.0.0`
- **macOS & Xcode**: Phiên bản Xcode mới nhất (khuyến nghị Xcode 15/16/26) để build ứng dụng iOS Simulator hoặc thiết bị iPhone thật.

---

## ⚙️ Hướng dẫn Cài đặt & Khởi chạy

### 1. Cài đặt Dependencies
```bash
# Cài đặt các thư viện cần thiết
npm install
```

### 2. Chạy ứng dụng Web / PWA trên máy
```bash
# Khởi chạy máy chủ Vite Development:
npm run dev
```
Truy cập trình duyệt tại: `http://localhost:5173/` (hoặc mở trên iPhone trong cùng mạng Wi-Fi qua địa chỉ IP LAN hiển thị trên terminal).

### 3. Biên dịch Web & Đồng bộ vào iOS
```bash
# Build gói tối ưu và đồng bộ tự động vào iOS project:
npm run build && npm run cap:sync
```

### 4. Mở và Chạy ứng dụng trên Xcode (iOS)
```bash
# Mở trực tiếp dự án trong Xcode:
npm run cap:ios
# hoặc:
npx cap open ios
```

Trong giao diện **Xcode**:
1. Chọn scheme **App**.
2. Chọn máy ảo iOS Simulator (ví dụ: **iPhone 16 / iPhone 17 Pro**) hoặc cắm iPhone thật.
3. Nhấn **Cmd + R** (hoặc nút **Play ▶**) để Build & Run ứng dụng.

---

## 📤 Hướng dẫn Đẩy Dự án lên GitHub (Git & GitHub)

Nếu bạn vừa tạo mới một Repository trên GitHub (ví dụ: `https://github.com/<username>/vku-field-survey.git`), thực hiện các lệnh sau trong Terminal để đẩy toàn bộ mã nguồn lên:

```bash
# 1. Thêm toàn bộ các tệp vào Git staging
git add -A

# 2. Tạo commit đầu tiên
git commit -m "feat: complete VKU Field Survey PWA & Capacitor iOS offline-first app"

# 3. Đặt nhánh chính là main
git branch -M main

# 4. Thêm địa chỉ kho lưu trữ từ xa
git remote add origin https://github.com/Quyens/VKU-Field-Survy.git

# 5. Đẩy mã nguồn lên nhánh main
git push -u origin main
```

> **Lưu ý**: Nếu kho GitHub tạo sẵn đã có sẵn file README hoặc LICENSE từ trước, bạn có thể chạy:
> ```bash
> git pull origin main --rebase
> git push -u origin main
> ```

---

## 🧪 Kịch bản Kiểm thử Tính năng Ngoại tuyến (Offline Test)

1. **Kiểm tra Auto-save Bản nháp**:
   - Mở form "Khảo sát", chọn Tòa nhà Khu A, nhập một số thông tin nhưng **chưa nhấn Gửi**.
   - Tắt ứng dụng hoặc F5 / tải lại trang.
   - Mọi thông tin đã nhập sẽ được khôi phục nguyên vẹn từ IndexedDB `drafts`.

2. **Kiểm tra Thu thập Ngoại tuyến (Offline Mode)**:
   - Trên trình duyệt, mở **DevTools (F12) > tab Network > chọn Offline** (hoặc bật Chế độ máy bay trên iPhone).
   - Điền đầy đủ thông tin phiếu kiểm tra, bấm "Lấy GPS", chụp ảnh và bấm **"Lưu & Gửi Báo Cáo Khảo Sát"**.
   - Ứng dụng hiển thị thông báo: *"Đã lưu phiếu vào IndexedDB (Chế độ Ngoại tuyến)"*.
   - Chuyển sang tab **"Danh sách"** hoặc **"Đồng bộ"**: Phiếu hiển thị với trạng thái `⏳ Chờ đồng bộ`.

3. **Kiểm tra Tự động Đồng bộ (Auto Background Sync)**:
   - Chuyển mạng từ **Offline** về lại **Online** (hoặc tắt Chế độ máy bay).
   - Hệ thống lập tức kích hoạt `syncService`, tự động duyệt hàng đợi FIFO gửi lên máy chủ VKU.
   - Trạng thái phiếu tự động chuyển thành `✓ Đã đồng bộ` kèm âm thanh phản hồi thành công.

---

## 👨‍💻 Tác giả & Bản quyền

- **Người thực hiện**: Võ Ngọc Thiện
- **Đơn vị**: Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn (VKU) - Đại học Đà Nẵng
- **Mã nguồn**: Phát hành theo giấy phép [MIT License](LICENSE).
