# Ma trận tương thích định dạng & thực thể CONCOSTCAD

Đây là ma trận trạng thái phát triển, chưa phải cam kết tương thích CONCOSTCAD 1.0. Chỉ nâng một hàng lên **Đã xác minh** khi có fixture hợp pháp, so sánh semantic round-trip và kết quả mở bằng CAD tham chiếu.

---

## 1. MA TRẬN ĐỊNH DẠNG TỆP TIN (FILE FORMAT MATRIX)

| Định dạng | Phiên bản | Đọc trong code | Chỉnh sửa trong code | Ghi trong code | Bằng chứng tương thích |
|---|---|---|---|---|---|
| DXF | R12 (AC1009) | Có API reader | Model hiện có thể sửa | Có API writer + staging | Chưa xác minh theo version |
| DXF | 2000/2002 (AC1015) | Có API reader | Model hiện có thể sửa | Có API writer + staging | Chưa xác minh theo version |
| DXF | 2004/2006 (AC1018) | Có API reader | Model hiện có thể sửa | Có API writer + staging | Chưa xác minh theo version |
| DXF | 2007/2009 (AC1021) | Có API reader | Model hiện có thể sửa | Có API writer + staging | Chưa xác minh theo version |
| DXF | 2010/2012 (AC1024) | Có API reader | Model hiện có thể sửa | Có API writer + staging | Chưa xác minh theo version |
| DXF | 2013/2017 (AC1027) | Có API reader | Model hiện có thể sửa | Có API writer + staging | Chưa xác minh theo version |
| DXF | 2018+ (AC1032) | Có API reader | Model hiện có thể sửa | Có API writer + staging | Chưa xác minh theo version |
| DWG | R14–R2018+ | Có API `DwgReader` | Model hiện có thể sửa | Có API `DwgWriter` + staging/read-back guard | Chưa có corpus DWG và CAD tham chiếu; mọi version chưa xác minh |

---

## 2. MA TRẬN THỰC THỂ HÌNH HỌC (ENTITY MATRIX)

| Thực thể CAD | Hiển thị (Render) | Tạo mới (Create) | Chỉnh sửa trực tiếp (Grip/Props) | Phép biến đổi 2D (Move/Copy/Rot/Mir) | Khứ hồi DWG/DXF (Round-Trip) |
|---|---|---|---|---|---|
| **LINE** | Implemented | Chuột / Tọa độ | Tọa độ đầu/cuối | Implemented | Chưa xác minh trên DWG mẫu/CAD tham chiếu |
| **ARC** | Implemented | 3 điểm | Tâm, bán kính, góc | Implemented | Chưa xác minh trên DWG mẫu/CAD tham chiếu |
| **CIRCLE** | Implemented | Tâm + bán kính | Tâm, bán kính | Implemented | Chưa xác minh trên DWG mẫu/CAD tham chiếu |
| **LWPOLYLINE** | Implemented, gồm bulge | Chuột / command line | Model có vertex/bulge | Implemented | Chưa xác minh trên DWG mẫu/CAD tham chiếu |
| **TEXT / INSERT / DIMENSION** | Implemented một phần | Theo các command hiện có | Theo entity subset | Một phần | Chưa xác minh theo version/entity |

---

## 3. BẢO TOÀN DỮ LIỆU & HÀNH VI XỬ LÝ ĐỐI TƯỢNG NGOÀI PHẠM VI (LOSS BEHAVIOR)

- **Nguyên tắc không làm hỏng dữ liệu:** Mọi thao tác lưu đều qua tệp tạm (staging file), kiểm tra tính toàn vẹn trước khi thay thế tệp gốc.
- **Opaque entity/object:** Trước khi lưu, giao diện liệt kê Unknown entity/object và diagnostic `NotImplemented`/`NotSupported`/`Error`, yêu cầu xác nhận. Backend chặn lưu nếu thiếu raw data cho định dạng đích hoặc DWG raw version không trùng version đích. File staging phải qua semantic-inventory read-back trước khi thay file nguồn. Việc bảo toàn thực tế của 3D Solid, Region, viewport, XDATA/EED và object graph vẫn chưa được xác minh bằng fixture.
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
