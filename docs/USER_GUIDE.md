# HƯỚNG DẪN SỬ DỤNG CONCOSTCAD (USER MANUAL)

Chào mừng bạn đến với **CONCOSTCAD** – Phần mềm đồ họa kỹ thuật CAD 2D tốc độ cao, hỗ trợ mở, chỉnh sửa và lưu trữ tệp tin DWG/DXF dành cho kỹ sư dự toán, thiết kế xây dựng và cơ khí.

---

## 1. GIAO DIỆN LÀM VIỆC (WORKSPACE OVERVIEW)

- **Thanh tiêu đề (Title Bar):** Tên bản vẽ hiện hành, trạng thái sửa đổi (`*`), nút đổi theme sáng/tối, nút chuyển ngôn ngữ (`EN` / `VI` / `KO`) và điều khiển cửa sổ. Theme và ngôn ngữ được lưu trên máy. Lần chạy đầu dùng EN; chuỗi chưa dịch và catalog KO hiện dùng nội dung EN dự phòng. Vùng vẽ giữ nền tối để các màu layer dễ nhìn.
- **Dải ruy-băng lệnh (Ribbon):** Phân nhóm trực quan theo thẻ:
  - **Home / Vẽ (Draw):** Các công cụ tạo hình học cơ bản (Line, Arc, Polyline, Circle, Rectangle, Text).
  - **Hiệu chỉnh (Modify):** Di chuyển (Move), Sao chép (Copy), Xoay (Rotate), Lấy đối xứng (Mirror), Bo góc (Fillet), Vát mép (Chamfer), Cắt xén (Trim), Kéo dài (Extend), Gộp (Join), Phân rã (Explode).
  - **Đo lường & Chú thích (Annotate):** Ghi kích thước thẳng (Dimlinear), Đo khoảng cách (Dist), Đo diện tích (Area).
  - **Hiển thị (View):** Phóng to toàn bộ (Zoom Extents), Phóng to đối tượng (Zoom Object), Lưới vẽ (Grid).
- **Vùng vẽ (Canvas Viewport):** Không gian mô hình (Model Space) 2D với hệ trục tọa độ UCS và lưới điểm thông minh.
- **Bảng thuộc tính trực tiếp (Live Properties Panel):** Cho phép xem và chỉnh sửa ngay lập tức tọa độ, kích thước, bán kính, góc xoay, lớp (layer) của đối tượng đang chọn.
- **Bảng quản lý lớp (Layers Panel):** Thêm layer, kích hoạt layer hiện hành, bật/tắt hiển thị, khóa chỉnh sửa, và chọn màu hiển thị (BYLAYER).
- **Thanh dòng lệnh (Command Bar):** Nhập lệnh CAD, tọa độ tuyệt đối (`x,y`), tương đối (`@dx,dy`) hoặc cực (`@khoảng_cách<góc`); hỗ trợ số có dấu và dạng thập phân `.5`, `1.`. Dynamic Input và dòng lệnh dùng cùng parser.
- **Thanh trạng thái (Status Bar):** Tọa độ con trỏ thời gian thực, nút chuyển đổi Lưới (Grid), Bắt điểm (Osnap - F3), Chế độ góc vuông (Ortho - F8), Tỷ lệ thu phóng (Zoom %).

---

## 2. THAO TÁC ĐIỀU HƯỚNG & CHUỘT

| Thao tác | Hành động | Phím tắt tương đương |
|---|---|---|
| **Thu phóng (Zoom)** | Lăn con lăn chuột (Mouse Wheel) | `Zoom In` / `Zoom Out` |
| **Xê dịch vùng nhìn (Pan)** | Nhấn giữ chuột giữa và kéo, hoặc giữ Space + chuột trái | `PAN` |
| **Chọn đối tượng (Select)** | Nhấp chuột trái vào đối tượng | Chuột trái |
| **Chọn vùng cửa sổ (Window Selection)** | Kéo chuột từ **Trái sang Phải** (Hộp màu xanh dương nét liền): Chỉ chọn các đối tượng nằm trọn vẹn bên trong | Kéo chuột L -> R |
| **Chọn vùng giao cắt (Crossing Selection)** | Kéo chuột từ **Phải sang Trái** (Hộp màu xanh lá nét đứt): Chọn mọi đối tượng nằm trong hoặc chạm vào biên hộp | Kéo chuột R -> L |
| **Thêm/Bớt chọn (Shift-Select)** | Giữ phím `Shift` khi nhấp chọn để đảo trạng thái chọn đối tượng | `Shift + Click` |
| **Hủy thao tác (Cancel)** | Phím `Escape` | `Esc` |
| **Lặp lại lệnh trước (Repeat)** | Nhấn phím `Space` hoặc `Enter` khi không có lệnh đang chạy | `Space` / `Enter` |

Khi đang sửa ô Properties, tên lớp hoặc dòng lệnh, Backspace/Delete và Ctrl+Z/Ctrl+Y dành cho nội dung ô nhập. Nhấp vùng vẽ để đưa focus về canvas trước khi dùng phím xóa hoặc Undo/Redo đối tượng. Ctrl+Shift+Z thực hiện Redo; Ctrl+Shift+S mở Save As. Enter/Space trên nút giao diện kích hoạt nút đó. Phím Enter đang dùng để hoàn tất nhập tiếng Việt/IME không được xem là lệnh CAD.

---

## 3. DANH MỤC LỆNH CAD CHUẨN

### A. Lệnh tạo hình học (Draw)
- **LINE (`L`):** Vẽ đoạn thẳng qua 2 điểm hoặc chuỗi đoạn thẳng liên tiếp.
- **ARC (`A`):** Vẽ cung tròn đi qua 3 điểm (Điểm đầu, điểm giữa, điểm cuối).
- **PLINE / POLYLINE (`PL`):** Vẽ đường đa tuyến liên tục gồm nhiều đoạn thẳng và đoạn cong (bulge arc). Nhấn Enter để kết thúc hoặc gõ `C` để khép kín (Close).
- **CIRCLE (`C`):** Vẽ đường tròn bằng cách chọn tâm và bán kính (hoặc nhập bán kính).
- **RECTANGLE (`REC`):** Vẽ hình chữ nhật qua 2 điểm góc đối diện.
- **TEXT (`DT` / `TEXT`):** Chèn chữ đơn dòng (Single-line text) với chiều cao và góc xoay mong muốn.

### B. Lệnh hiệu chỉnh (Modify)
- **MOVE (`M`):** Di chuyển các đối tượng đã chọn theo điểm gốc (base point) và điểm đích.
- **COPY (`CO` / `CP`):** Sao chép đối tượng theo độ dời vec-tơ.
- **ROTATE (`RO`):** Xoay đối tượng quanh điểm tâm với góc độ nhập vào (độ).
- **MIRROR (`MI`):** Lấy đối xứng đối tượng qua trục tạo bởi 2 điểm.
- **OFFSET (`O`):** Tạo bản sao song song với khoảng cách xác định về phía nhấp chuột.
- **FILLET (`F`):** Bo tròn góc giao giữa 2 đoạn thẳng:
  - Bán kính `R = 0`: Cắt xén hoặc kéo dài 2 đoạn thẳng để gặp nhau tại đỉnh nhọn vuông vức.
  - Bán kính `R > 0`: Tự động cắt 2 đoạn thẳng và chèn cung tròn tiếp xúc mượt mà.
- **CHAMFER (`CHA`):** Vát mép góc giữa 2 đoạn thẳng theo khoảng cách vát d1, d2.
- **TRIM (`TR`):** Nhấp vào đoạn thẳng để cắt bỏ phần vượt qua biên giao cắt của các đối tượng khác.
- **EXTEND (`EX`):** Nhấp vào đầu mút đoạn thẳng để phóng chiếu kéo dài tới đường biên gần nhất.
- **JOIN (`J`):** Gộp các đoạn thẳng, cung tròn nối tiếp nhau thành một đường `LWPOLYLINE` duy nhất.
- **EXPLODE (`X`):** Phân rã đa tuyến Polyline thành các đoạn Line và Arc độc lập.
- **ERASE (`E` / phím `Delete`):** Xóa các đối tượng đang chọn.
- **UNDO (`Ctrl+Z` / `U`):** Hoàn tác bước chỉnh sửa vừa thực hiện.
- **REDO (`Ctrl+Y` / `REDO`):** Làm lại bước chỉnh sửa đã hoàn tác.

### C. Lệnh đo lường & Ghi kích thước (Dimension & Measure)
- **DIMLINEAR (`DLI` / `DAL` / `DIM`):** Tạo đường gióng kích thước tuyến tính:
  - Chọn điểm đo thứ nhất và thứ hai.
  - Chọn vị trí đặt đường kích thước (offset).
  - Phần mềm tự động tạo 2 đường gióng (extension lines), đường kích thước với vạch chéo kiến trúc 45°, và chữ số đo lường chính xác đặt ở tâm.
- **DIST (`DI`):** Đo khoảng cách thực, độ dời trục ΔX, ΔY và góc nghiêng giữa 2 điểm.
- **AREA (`AA`):** Tính diện tích và chu vi đa giác hoặc hình khép kín theo thuật toán Shoelace.

### D. Lệnh điều khiển vùng nhìn & Xuất bản vẽ (View & Export)
- **ViewCube 2D (góc trên bên phải):** Nhấp N/E/S/W để đưa hướng đó lên trên. Nhấp mặt TOP để trở về hướng Bắc, giữ nguyên tâm nhìn và độ thu phóng. Kéo ngang mặt TOP hoặc vòng la bàn để xoay góc nhìn liên tục; thả chuột để giữ góc, nhấn Escape trong khi kéo để trở về góc ban đầu. Các nút ↶/↷ xoay vùng nhìn 90°. Nút Home (hình ngôi nhà) đưa hướng Bắc lên trên và thu phóng vừa các đối tượng đang hiển thị; bản vẽ trống trở về tâm gốc và zoom 1:1. Khi mặt TOP có focus, dùng ←/→ để xoay 15°, Shift + ←/→ để xoay 45°, phím Home để về hướng Bắc. La bàn, số đo góc và biểu tượng trục WCS cập nhật theo góc nhìn. Đây là điều khiển góc nhìn trên mặt phẳng XY, không sửa tọa độ đối tượng hoặc tạo lịch sử Undo.
- **Dynamic Input (F12):** Bật/tắt prompt, tọa độ và ô nhập cạnh con trỏ. Khi đã đặt điểm, bảng còn hiển thị chiều dài/góc đoạn hiện tại; với CIRCLE hiển thị bán kính và với RECTANGLE hiển thị ΔX/ΔY. Khi viewport đang focus, con trỏ ở vùng vẽ và có lệnh đang chạy, có thể gõ trực tiếp mà không cần nhấp ô trước; cũng có thể nhấp vào ô để sửa nội dung. Bản nháp được đồng bộ tức thời với Dòng lệnh, nên có thể chuyển vùng nhập bằng Ctrl+9 mà không mất nội dung. Enter gửi lệnh/tọa độ qua cùng parser của dòng lệnh; LINE/PLINE nhận chiều dài theo hướng con trỏ, còn CIRCLE nhận bán kính.
- **Command Line (Ctrl+9):** Ẩn/hiện dòng lệnh; trạng thái hiển thị được lưu. Có thể bật lại bằng Ctrl+9 hoặc nút Command Line trong tab View. Dùng ↑/↓ để duyệt tối đa 50 lệnh đã nhập; nhấn một dòng lệnh trong lịch sử để nạp lại vào ô nhập. Lịch sử lệnh được giữ qua lần khởi động tiếp theo.
- **Alias lệnh:** Lệnh không phân biệt chữ hoa/thường. Một số alias bổ sung: `QNEW`/`QSAVE`, `ZE`/`ZOOM EXTENTS`, `ZS`/`ZO`/`ZOOM OBJECT`, `PLOT`/`PRINT`, `DYN`/`DYNAMIC INPUT`, `CMDLINE`/`COMMAND LINE`, `CANCEL`/`ESC` và `HELP`. `U` gọi UNDO; khi PLINE đang chạy, `U` lùi một đỉnh và `C` khép kín đa tuyến.
- **ZOOM EXTENTS (`ZE`):** Tự động thu phóng và căn chỉnh toàn bộ hình vẽ vừa vặn màn hình.
- **ZOOM OBJECT (`ZS` / `ZO`):** Thu phóng vừa vặn các đối tượng đang được chọn.
- **PLOT / EXPORT (`EXPORT` / `PLOT` / `PRINT`):** Xuất toàn bộ bản vẽ hiện hành sang tệp tin ảnh PNG độ nét cao để in ấn, gửi duyệt hoặc lập hồ sơ báo cáo.

---

## 4. QUẢN LÝ BẢN VẼ & AN TOÀN DỮ LIỆU

1. **Mở tệp DWG/DXF:** Nhấp biểu tượng `📂` (Open) trên thanh công cụ hoặc gõ lệnh `OPEN`. Hỗ trợ các bản vẽ từ AutoCAD R12 đến AutoCAD 2018+.
2. **Lưu tệp an toàn (Atomic Staging):** Nhấp `💾` (Save) hoặc nhấn `Ctrl+S`. CONCOSTCAD lưu bản vẽ qua giai đoạn tệp tạm trung gian trước khi ghi đè, đảm bảo không bao giờ làm hỏng hay mất mát bản vẽ gốc ngay cả khi có sự cố mất điện đột ngột.
3. **Tự động lưu (Autosave):** Bản vẽ có chỉnh sửa (dirty) được tự động lưu dự phòng định kỳ mỗi 3 phút.
4. **Document tabs:** Mỗi bản vẽ giữ góc nhìn, mức zoom, vùng pan, Model/Paper space, Layout đã thêm và các đối tượng đang chọn khi chuyển giữa các tab. Layout riêng của bản vẽ khác được ẩn cho tới khi quay lại tab đó. Lệnh đang chờ điểm và thao tác kéo grip bị hủy khi đổi bản vẽ; đối tượng đang chọn và grip của chúng được khôi phục khi quay lại.
5. **Workspace:** Chế độ Ribbon, thanh truy cập nhanh, trạng thái hiện/thu gọn của Properties và Layers, cùng kích thước các panel được lưu trên máy và khôi phục ở lần mở sau.
