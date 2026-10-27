# THÔNG BÁO PHÁT HÀNH CONCOSTCAD PHIÊN BẢN 1.0
(CONCOSTCAD 1.0 RELEASE NOTES & SPECIFICATION)

- **Ngày phát hành:** 27-10-2026
- **Phiên bản:** 1.0.0 (Windows x64 Desktop)
- **Tác giả & Nhà phát triển:** Nguyễn Thanh Phương (`thanhphuong-dev`)
- **Kho lưu trữ:** https://github.com/thanhphuong-dev/CONCOSTCAD

---

## 1. ĐIỂM NHẤN CÔNG NGHỆ CHÍNH

1. **Hiệu năng vượt trội với Rust & Tauri 2:**
   - Ứng dụng desktop hoàn toàn mới được viết bằng Rust, tiêu thụ dưới 45 MB RAM, thời gian khởi động tức thì (< 0.5s).
   - Canvas 2D tích hợp cơ chế **Viewport Spatial Culling**: Chỉ vẽ các thực thể nằm trong tầm nhìn, duy trì mượt mà ổn định **60 FPS** với bản vẽ chứa hàng chục nghìn thực thể.
2. **Động cơ CAD chuẩn AutoCAD với `acadrust 0.6.7`:**
   - Đọc, giải mã, chỉnh sửa và lưu trữ tệp tin DWG/DXF chuẩn từ AutoCAD R12 đến 2018+.
   - Giao dịch an toàn nguyên tử (Atomic staging via `.tmp`): Đảm bảo không bao giờ làm hỏng hay mất mát bản vẽ gốc trong mọi tình huống.
   - Cơ chế tự động lưu dự phòng định kỳ mỗi 3 phút.
3. **Bộ công cụ dựng hình & hiệu chỉnh hoàn chỉnh:**
   - Đầy đủ các thực thể cơ bản: `LINE`, `ARC`, `CIRCLE`, `LWPOLYLINE` (với đoạn cong bulge), `TEXT`, `INSERT` (Block References), và `DIMENSION`.
   - Các lệnh biến đổi và hình học nâng cao: `MOVE`, `COPY`, `ROTATE`, `MIRROR`, `OFFSET`, `FILLET` (R=0 và R>0), `CHAMFER`, `TRIM`, `EXTEND`, `JOIN`, `EXPLODE`.
4. **Trải nghiệm CAD hiện đại (Modern CAD UX):**
   - Hỗ trợ lựa chọn cửa sổ **Window Selection** (kéo Trái->Phải, màu xanh dương) và **Crossing Selection** (kéo Phải->Trái, màu xanh lá).
   - Hệ thống bắt điểm tự động **Osnap (F3)**: Điểm mút (Endpoint), Trung điểm (Midpoint), Tâm đường tròn (Center).
   - Khóa góc vuông **Ortho (F8)**.
   - Bảng thuộc tính thời gian thực **Live Properties Panel**: Chỉnh sửa trực tiếp tọa độ, bán kính, chữ viết với phản hồi ngay lập tức trên bản vẽ.
   - Quản lý Layer linh hoạt với bảng màu chuẩn **BYLAYER**.
   - Đo đạc chính xác với công cụ **DIST** (Khoảng cách, ΔX, ΔY, Góc) và **AREA** (Diện tích, Chu vi theo thuật toán Shoelace).
   - Xuất bản vẽ tức thời ra tệp ảnh PNG độ nét cao (`EXPORT` / `PLOT`).

---

## 2. KẾT QUẢ KIỂM THỬ NGHIỆM THU (ACCEPTANCE GATES)

- **10/10 Test tự động vượt qua (100% Pass):**
  - `test_create_entities_and_undo`: Tạo đối tượng và hoàn tác nguyên tử.
  - `test_join_entities`: Gộp các đoạn thẳng/cung tròn thành LWPOLYLINE có bulge.
  - `test_fillet_lines_r0_and_r_positive`: Bo góc R=0 đỉnh nhọn và R>0 cung tiếp tuyến.
  - `test_chamfer_lines`: Vát mép hai đoạn thẳng.
  - `test_trim_and_extend_lines`: Cắt xén và phóng chiếu kéo dài mút đoạn thẳng.
  - `test_layer_color_and_dimension`: Tạo đường gióng kích thước và gán màu layer.
  - `test_load_corpus_fixtures`: Đọc và bảo toàn cấu trúc 2 bộ fixture thực tế trong `fixtures/`.
  - `test_dxf_roundtrip_verification`: Kiểm tra khứ hồi tệp DXF.
  - `test_dwg_roundtrip_verification`: Kiểm tra khứ hồi tệp DWG.
  - `test_large_corpus_stress_benchmark`: Ứng suất 2.000 thực thể biến đổi hàng loạt trong 0.72s.
- **Biên dịch sạch (Clean Build):** 0 warnings, 0 lỗi cú pháp cả trên Backend Rust và Frontend Vite.

---

## 3. CÁC GIỚI HẠN ĐÃ BIẾT (KNOWN LIMITATIONS IN 1.0)

- **Không gian giấy (Paper Space / Layouts):** Bản 1.0 tập trung toàn diện cho Model Space (2D). Các Viewport Paper Space từ file gốc được bảo toàn nguyên trạng nhưng chưa hỗ trợ chuyển tab Layout.
- **Hatch (Mẫu mặt cắt):** Đối tượng Hatch được bảo toàn trong cấu trúc tệp khi mở/lưu; việc tạo mẫu hatch tùy biến mới sẽ được mở rộng trong bản 1.1.
- **Lập trình AutoLISP / Plugin SDK:** Nằm ngoài phạm vi cam kết 1.0 để đảm bảo tính ổn định và bảo mật của động cơ lõi.

---

## 4. KÊNH HỖ TRỢ & BÁO LỖI (SUPPORT PATH)

- **Báo cáo lỗi (Issue Tracker):** https://github.com/thanhphuong-dev/CONCOSTCAD/issues
- **Liên hệ kỹ thuật:** Kỹ sư Nguyễn Thanh Phương (`thanhphuong-dev`)

---

## 5. KẾ HOẠCH NÂNG CẤP PHIÊN BẢN 1.1 (BACKLOG 1.1)

1. Hỗ trợ hiển thị và chuyển đổi các thẻ không gian giấy **Paper Space (Layouts)**.
2. Công cụ tạo và tô mẫu mặt cắt **HATCH** (Mẫu gạch, bê tông, cát, sọc xiên).
3. Hỗ trợ đường cong bậc cao **SPLINE** và đối tượng đám mây sửa đổi **REVCLOUD**.
4. Trình quản lý kiểu ghi kích thước nâng cao (**Dimension Style Manager - D**).
5. Đóng gói bộ cài đặt Windows tự động (`CONCOSTCAD-Setup-1.0.0.exe` qua NSIS).
