# MA TRẬN TƯƠNG THÍCH ĐỊNH DẠNG & THỰC THỂ CONCOSTCAD 1.0
(CONCOSTCAD 1.0 COMPATIBILITY & ENTITY MATRIX)

Tài liệu công bố chính thức về mức độ tương thích định dạng tệp tin, thực thể hình học, siêu dữ liệu (metadata) và hành vi bảo toàn dữ liệu của CONCOSTCAD phiên bản 1.0.

---

## 1. MA TRẬN ĐỊNH DẠNG TỆP TIN (FILE FORMAT MATRIX)

| Định dạng | Phiên bản AutoCAD | Mở (Read) | Chỉnh sửa (Edit) | Lưu (Save) | Giai đoạn lưu trữ an toàn |
|---|---|---|---|---|---|
| **DXF** | R12 (AC1009) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử (Atomic staging via `.tmp`) |
| **DXF** | 2000/2002 (AC1015) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử |
| **DXF** | 2004/2006 (AC1018) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử |
| **DXF** | 2007/2009 (AC1021) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử |
| **DXF** | 2010/2012 (AC1024) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử |
| **DXF** | 2013/2017 (AC1027) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử |
| **DXF** | 2018+ (AC1032) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử |
| **DWG** | R14 (AC1014) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử bảo toàn |
| **DWG** | 2000 (AC1015) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử bảo toàn |
| **DWG** | 2004 (AC1018) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử bảo toàn |
| **DWG** | 2007 (AC1021) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử bảo toàn |
| **DWG** | 2010 (AC1024) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử bảo toàn |
| **DWG** | 2013 (AC1027) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử bảo toàn |
| **DWG** | 2018+ (AC1032) | Đầy đủ | Đầy đủ | Đầy đủ | Ghi nguyên tử bảo toàn |

---

## 2. MA TRẬN THỰC THỂ HÌNH HỌC (ENTITY MATRIX)

| Thực thể CAD | Hiển thị (Render) | Tạo mới (Create) | Chỉnh sửa trực tiếp (Grip/Props) | Phép biến đổi 2D (Move/Copy/Rot/Mir) | Khứ hồi DWG/DXF (Round-Trip) |
|---|---|---|---|---|---|
| **LINE** | Có (BYLAYER) | Chuột / Tọa độ | Tọa độ điểm đầu/cuối, midpoint | Đầy đủ (Atomic) | Bảo toàn 100% |
| **ARC** | Có (Tessellation mượt) | 3 điểm (Start, Mid, End) | Bán kính, tâm, góc quét | Đầy đủ (Atomic) | Bảo toàn 100% |
| **CIRCLE** | Có (Grip 4 góc phần tư) | Tâm + Bán kính | Tâm, bán kính, chu vi, diện tích | Đầy đủ (Atomic) | Bảo toàn 100% |
| **LWPOLYLINE** | Có (Hỗ trợ đoạn cong bulge) | Chuột liên tiếp / Đóng kín | Từng đỉnh, thêm đỉnh, bulge | Đầy đủ (Atomic) | Bảo toàn 100% |
| **TEXT** | Có (Inter Font sắc nét) | Điểm chèn, chiều cao, góc | Nội dung chữ, chiều cao, góc xoay | Đầy đủ (Atomic) | Bảo toàn 100% |
| **INSERT (Block)** | Có (Marker + Tên Block) | Nhận diện từ file gốc | Tên block, điểm chèn, tỷ lệ, góc | Đầy đủ (Atomic) | Bảo toàn 100% |
| **DIMENSION** | Có (Đường gióng + Tick + Text)| 2 điểm đo + Offset | Tọa độ, độ dời, nội dung đo | Đầy đủ (Atomic) | Bảo toàn 100% |

---

## 3. BẢO TOÀN DỮ LIỆU & HÀNH VI XỬ LÝ ĐỐI TƯỢNG NGOÀI PHẠM VI (LOSS BEHAVIOR)

- **Nguyên tắc không làm hỏng dữ liệu:** Mọi thao tác lưu đều qua tệp tạm (staging file), kiểm tra tính toàn vẹn trước khi thay thế tệp gốc.
- **Opaque Entity Preservation:** Các đối tượng nâng cao (như 3D Solid, Region, Viewport Paper Space) khi đọc từ tệp DWG/DXF được engine `acadrust` duy trì trong cấu trúc bản vẽ và ghi lại nguyên trạng (không bị xóa bỏ âm thầm).
- **Cảnh báo chuyển đổi định dạng (Save As warning):** Khi lưu từ định dạng này sang định dạng khác, phần mềm ngăn chặn thao tác chuyển đổi định dạng nếu có nguy cơ làm mất mát metadata chưa được kiểm chứng.

---

## 4. MA TRẬN LỆNH & PHÍM TẮT (COMMAND & SHORTCUT MATRIX)

| Lệnh chuẩn | Bí danh (Aliases) | Nhóm chức năng | Tác vụ |
|---|---|---|---|
| `LINE` | `L` | Vẽ | Tạo đoạn thẳng |
| `ARC` | `A` | Vẽ | Tạo cung tròn qua 3 điểm |
| `PLINE` | `PL`, `POLYLINE` | Vẽ | Tạo đường đa tuyến (thẳng + cong) |
| `CIRCLE` | `C` | Vẽ | Tạo đường tròn |
| `RECTANGLE` | `REC` | Vẽ | Tạo hình chữ nhật |
| `TEXT` | `DT` | Chú thích | Chèn chữ đơn dòng |
| `DIMLINEAR` | `DLI`, `DAL`, `DIM` | Chú thích | Ghi kích thước thẳng |
| `DIST` | `DI` | Đo lường | Đo khoảng cách & góc |
| `AREA` | `AA` | Đo lường | Đo diện tích & chu vi |
| `MOVE` | `M` | Hiệu chỉnh | Di chuyển đối tượng |
| `COPY` | `CO`, `CP` | Hiệu chỉnh | Sao chép đối tượng |
| `ROTATE` | `RO` | Hiệu chỉnh | Xoay đối tượng quanh tâm |
| `MIRROR` | `MI` | Hiệu chỉnh | Lấy đối xứng qua trục |
| `OFFSET` | `O` | Hiệu chỉnh | Tạo bản sao song song |
| `FILLET` | `F` | Hiệu chỉnh | Bo tròn góc (R=0 góc vuông, R>0 cung tròn) |
| `CHAMFER` | `CHA` | Hiệu chỉnh | Vát mép góc |
| `TRIM` | `TR` | Hiệu chỉnh | Cắt xén đoạn thừa |
| `EXTEND` | `EX` | Hiệu chỉnh | Kéo dài tới biên |
| `JOIN` | `J` | Hiệu chỉnh | Gộp các đoạn thành Polyline |
| `EXPLODE` | `X` | Hiệu chỉnh | Phân rã Polyline thành Line & Arc |
| `ERASE` | `E`, `DELETE` | Hiệu chỉnh | Xóa đối tượng |
| `UNDO` | `U`, `Ctrl+Z` | Lịch sử | Hoàn tác |
| `REDO` | `Ctrl+Y` | Lịch sử | Làm lại |
| `ZOOM EXTENTS` | `ZE` | Vùng nhìn | Phóng to toàn bộ bản vẽ |
| `ZOOM OBJECT` | `ZS`, `ZO` | Vùng nhìn | Phóng to đối tượng đang chọn |
| `MODEL` | `MS` | Không gian | Chuyển sang không gian mô hình 2D (Model Space) |
| `LAYOUT` | `PS`, `PAPER` | Không gian | Chuyển sang không gian giấy in ấn (Paper Space Layout) |
| `TAKEOFF` | `BOM`, `COUNT`, `QUANTITY` | Tiên lượng | Thống kê khối lượng bóc tách dự toán (chiều dài, block, diện tích) xuất CSV |
| `EXPORT` | `PLOT`, `PRINT` | Xuất bản | Xuất ảnh PNG độ nét cao |
| `SPLINE` | `SPL` | Vẽ | Tạo đường cong mượt qua các điểm điều khiển |
| `REVCLOUD` | `CLOUD` | Chú thích | Tạo đám mây ghi chú sửa đổi thiết kế |
| `HATCH` | `H` | Vẽ | Tạo mẫu mặt cắt gạch chéo ANSI31 |
| `DIMSTYLE` | `PRECISION`, `UNITS` | Chú thích | Cài đặt độ chính xác chữ số đo kích thước (0-3 thập phân) |
