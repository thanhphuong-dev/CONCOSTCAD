# CONCOSTCAD — Kế hoạch phát triển Rust

**Ngày lập:** 27-10-2026  
**Phạm vi:** Xây dựng CONCOSTCAD mới hoàn toàn bằng Rust thành ứng dụng CAD desktop Windows.  
**Tài liệu dự án:** `Cargo.toml`, `Cargo.lock`, `src/main.rs`. Tài liệu legacy đã được dọn khỏi `docs`; các nội dung hữu ích đã được tổng hợp có chọn lọc vào kế hoạch này.

## 1. Tóm tắt điều hành

CONCOSTCAD là dự án mới, không port ứng dụng C# trước đây. Checkout hiện dùng shell desktop Tauri 2 + frontend Vite/JavaScript, model document `acadrust`, file picker và luồng đọc DWG/DXF; các thao tác CAD được nối qua Tauri commands. Code hiện có ribbon/panels, canvas, LINE/ARC/Polyline và một số công cụ sửa bản vẽ. Đây là trạng thái triển khai trong code, chưa phải bằng chứng tương thích trên file DWG thực tế. Sản phẩm đích vẫn là CAD Windows có ribbon/panel kiểu AutoCAD, mở/sửa/lưu DWG/DXF và author/edit LINE–ARC–Polyline; khả năng lưu DWG sau chỉnh sửa là yêu cầu bắt buộc, không phải hạng mục tùy chọn hoặc read-only.

Kế hoạch này xây theo vertical slice: hình học và document core, UI CAD, DXF, rồi DWG read/edit/write; mỗi giai đoạn phải để lại ứng dụng chạy được. Đích 1.0 phải mở bản vẽ DWG/DXF trong phạm vi tương thích công bố, vẽ/sửa LINE–ARC–Polyline, lưu, mở lại và xác minh không âm thầm mất dữ liệu trong phạm vi hỗ trợ.

**Nguồn lực:** Codex là người triển khai chính trong repo; người dùng cung cấp quyết định sản phẩm, bản vẽ mẫu được phép dùng và kiểm tra nghiệm thu khi cần. Roadmap gồm 38 tuần làm việc như kế hoạch mục tiêu; với một người triển khai, rủi ro lớn nhất là engine DWG và UI. Sau PoC DWG tuần 4 sẽ cập nhật ước lượng, nhưng mục tiêu đọc/sửa/lưu DWG vẫn giữ nguyên; nếu cần sẽ điều chỉnh thời gian hoặc chọn engine/thành phần phù hợp, không hạ yêu cầu âm thầm.

## 2. Nguyên tắc sản phẩm và phạm vi 1.0

### Mục tiêu

- Ứng dụng desktop Rust trên Windows; lưu trữ tài liệu và hình học bằng `f64`, đơn vị và quy ước tọa độ được định nghĩa tường minh.
- Vòng đời bản vẽ đáng tin cậy: New/Open/Save/Save As DWG/DXF trong compatibility matrix, hủy tác vụ, thông báo đối tượng không hỗ trợ, lưu staging/atomic và không làm hỏng file nguồn khi lỗi.
- Core 2D độc lập UI: LINE, CIRCLE, ARC, LWPOLYLINE có bulge; layer; selection/snap; transaction; undo/redo; command dispatch.
- UI Windows dùng Tauri 2 + Vite/JavaScript theo lựa chọn sản phẩm đã chốt; có Ribbon theo tab, canvas, command line/nhập tọa độ, document tabs, Properties và Layers panels. Tauri là quyết định hiện hành; không quay lại egui nếu không có quyết định sản phẩm mới.
- DXF subset được mô tả bằng ma trận version/entity có kiểm thử round-trip. DWG chỉ công bố các trường hợp đã kiểm tra bằng file được phép dùng và CAD tham chiếu.
- Có bộ fixture hợp pháp, kiểm thử hồi quy, benchmark có thể chạy lại, log lỗi và quy trình phát hành Windows.
- English mặc định; kiến trúc chuỗi cho phép thêm Vietnamese và Korean khi shell/UI ổn định.

### Ngoài phạm vi cam kết 1.0

Không hứa tương thích đầy đủ AutoCAD, mọi entity/phiên bản DWG, Paper Space/plot hoàn chỉnh, 3D, Visual LISP, mọi chương trình AutoLISP hoặc plugin ABI ổn định thương mại. DWG read/edit/save là bắt buộc trong matrix được hỗ trợ; fidelity ngoài matrix phải được báo rõ trước khi lưu.

## 3. Đánh giá hiện trạng và quy tắc sử dụng tài liệu legacy

### Trạng thái quan sát được trong checkout (27-10-2026)

- `Cargo.toml` khai báo package `CONCOSTCAD`, version `0.1.0`, edition `2024`; dependencies gồm Tauri 2, `tauri-plugin-dialog` và `acadrust` 0.6.7. Giao diện được xây trong `src-ui/`.
- `src/document.rs` là adapter document hiện tại: thêm/sửa/xóa entity, history snapshot, dirty-state, DWG/DXF reader/writer và ghi staging file. `src/main.rs` nối adapter với Tauri commands.
- UI đã có ribbon/panels, command line và canvas; trạng thái từng lệnh cần đối chiếu với code và acceptance evidence, không suy ra tương thích định dạng từ việc nút/lệnh đã tồn tại.
- `cargo check` thành công trên Windows. Chưa có bằng chứng runtime/file round-trip bằng corpus DWG/DXF đại diện hoặc CAD tham chiếu; tính tương thích định dạng vẫn chưa được xác nhận.
- Source C# không thuộc dự án mới. Các tài liệu legacy đã bị xóa theo yêu cầu; nội dung cũ không được xem là code hoặc compatibility promise của CONCOSTCAD Rust.

### Cách dùng tài liệu legacy

1. Đây là sản phẩm mới; không port code C# và không phụ thuộc runtime C#/.NET trong bản phát hành.
2. Tài liệu legacy đã bị xóa theo yêu cầu; kế hoạch này chỉ giữ các bài học rủi ro tổng quát và không tuyên bố những tính năng cũ đã tồn tại trong Rust.
3. Các trạng thái triển khai của sản phẩm mới là `specified`, `implemented`, `verified`; chỉ xác nhận hỗ trợ định dạng sau khi có fixture, test round-trip và CAD tham chiếu.

## 4. Kiến trúc Rust đích

### Workspace Cargo dự kiến

```text
crates/
  concostcad-geometry/   # primitive, transform, tolerance, bounds, intersection
  concostcad-model/      # document, entity IDs, layers, blocks, validation
  concostcad-history/    # transaction, undo/redo, change sets
  concostcad-spatial/    # R-tree/BVH, viewport/pick queries
  concostcad-commands/   # command registry, prompts, state machine, CAD actions
  concostcad-dxf/        # DXF reader/writer và version/entity adapters
  concostcad-dwg/        # facade và adapter DWG; engine thay được
  concostcad-app/        # use cases, file lifecycle, background jobs, settings
  concostcad-ui/         # desktop views, view models/state bindings, input
  concostcad-cli/        # diagnostic/benchmark/fixture commands nếu cần
```

Đây là đề xuất module, không bắt buộc mỗi module phải thành crate ngay. Bắt đầu với ít crate đủ giữ dependency direction rõ, tách khi ranh giới ổn định.

### Quy tắc phụ thuộc

- `geometry`, `model`, `history`, `spatial`, `commands` không phụ thuộc toolkit UI hoặc file dialog.
- `dxf`/`dwg` chuyển qua model DTO/adapter, không sửa UI state và không sở hữu viewport.
- `app` điều phối use case, task nền, tiến trình, cancellation và cảnh báo chuyển đổi.
- `ui` phát action có kiểu và nhận snapshot/event/delta; không nắm parser hay trực tiếp sửa entity.
- Entity có ID ổn định; document mutation đi qua transaction đã validate; đổi nhóm là một history entry.
- Dữ liệu CAD chính xác tách khỏi tessellation/cache hiển thị. Cache keyed theo revision và bị invalidation rõ ràng.
- Xác định ranh giới `Send`/`Sync` và thread ownership trước khi đưa document lớn qua worker; tránh bọc toàn core bằng `Arc<Mutex<_>>` nếu chưa chứng minh cần.

### Quyết định UI hiện hành

Ứng dụng đang dùng Tauri 2 làm Windows desktop shell và Vite/JavaScript cho giao diện CAD. Đây là lựa chọn sản phẩm đã được người dùng chốt; phần còn lại của kế hoạch phải phát triển trên nền này. Rust giữ document model, DWG/DXF I/O và command backend; frontend chịu trách nhiệm Ribbon, canvas, panel và input. Các acceptance gate về startup, WebView2, DPI, resize, keyboard, file dialogs và đóng cửa sổ vẫn áp dụng.

### UI/MVVM

MVVM là ranh giới trách nhiệm, không nhất thiết là framework. Frontend Tauri phát action có kiểu qua invoke/events; Rust command/backend gọi use case và trả snapshot/event. Canvas là projection của model, không sở hữu parser hay file I/O. Đánh giá tiếp theo tập trung vào đúng stack đang dùng: input CAD, DPI, accessibility, localization, testability, packaging, startup và redraw trên Windows.

### Dữ liệu và số học

- Tọa độ hình học dùng `f64` theo drawing units của file; không tự đổi sang mm. Góc nội bộ là radian, zero theo +X, dương ngược chiều kim đồng hồ; WCS 2D có Y hướng lên. ARC dùng sweep ngược chiều kim đồng hồ; LWPOLYLINE bulge bằng `tan(sweep/4)`.
- Tách tolerance hình học khỏi tolerance hiển thị: kiểm tra song song line-line dùng `|sin(angle)| <= 1e-12` sau chuẩn hóa hướng; line-circle dùng sai số khoảng cách tương đối `16 * EPSILON`. Không dùng ngưỡng định thức/khoảng cách tuyệt đối phụ thuộc kích thước bản vẽ. Snap/hit-test UI dùng ngưỡng pixel được quy đổi qua zoom.
- Chuẩn hóa world/screen transform, elevation và xử lý ARC có góc đầu/cuối trùng để phân biệt cung rỗng với vòng tròn đầy đủ.
- Từ chối NaN/Inf và kích thước vượt giới hạn parser; định nghĩa tolerance theo scale thay vì một epsilon cố định cho mọi drawing.
- Dùng ID/handle tách biệt khỏi chỉ số vector; lưu rõ thứ tự vẽ khi cần.
- Quyết định identity hiện tại: document ID là workspace/tab ID chỉ sống trong phiên; entity và layer dùng CAD `Handle` từ `acadrust`, không dùng index hoặc tên hiển thị. Clone để edit giữ nguyên handle; entity COPY/MIRROR phải xóa handle nguồn để backend cấp handle mới. Handle truyền qua JSON cần biểu diễn không mất chính xác 64-bit.
- Parser xử lý byte/record có giới hạn; mọi offset/count/length phải kiểm tra trước cấp phát hoặc đọc.

## 5. Chiến lược DWG/DXF và dependency

### DXF

DXF là đường kiểm chứng đầu tiên vì dễ tạo fixture và so sánh ngữ nghĩa. Chốt ASCII/binary, version đích, entity, table/section cần giữ; stream file lớn; xử lý malformed input có giới hạn; giữ dữ liệu không hỗ trợ khi an toàn hoặc phát sinh loss report. Semantic round-trip so sánh entity, thuộc tính, tọa độ, layer, block, units và metadata trong phạm vi mục tiêu.

### DWG

- Giữ adapter `concostcad-dwg` độc lập để có thể thay engine mà không lan dependency vào core.
- Ứng viên đầu tiên đã chọn cho PoC là **[acadrust 0.6.7](https://docs.rs/crate/acadrust/0.6.7)**: thư viện Rust có API đọc/ghi DWG/DXF. Cargo đã resolve và build dependency thành công, nhưng đó mới chỉ xác nhận build, chưa chứng minh file mẫu đọc/sửa/lưu round-trip. Upstream công bố hỗ trợ R12–R2018+; đây không phải compatibility claim cho ứng dụng CONCOSTCAD.
- DWG read/edit/write là điều kiện phát hành; reader và writer phải cùng làm việc trên compatibility matrix được hỗ trợ, hoặc adapter phải giữ object/metadata cần thiết khi sửa.
- Tuần 4 xác nhận acadrust trên corpus được phép: entities, layer, tọa độ, metadata, save/reopen bằng CAD tham chiếu, malformed files, Windows build, hiệu năng và license. Nếu không đáp ứng, đánh giá engine khác hoặc adapter native có ranh giới rõ và cập nhật lịch/capacity. Không đổi yêu cầu thành read-only; không tự xây codec DWG trước khi có RFC kỹ thuật và rà pháp lý.
- Mỗi bản vẽ có báo cáo unsupported/loss trước edited save; backend phải chặn unknown record thiếu raw data hoặc raw DWG sai version. Không âm thầm bỏ Paper Space, xref, proxy, XDATA/EED, dictionaries, style hoặc block data. Với cấu trúc trong matrix hỗ trợ, round-trip phải bảo toàn semantic data cần thiết.
- File không thay đổi chỉ được byte-copy nếu có fingerprint và kiểm tra file nguồn chưa đổi; không xem byte-copy là khả năng ghi DWG.
- Mỗi claim tương thích phải trỏ tới fixture có provenance, expected output và CAD tham chiếu đã dùng.
- acadrust được cấp phép MPL-2.0; thêm license/third-party notices vào hồ sơ phát hành. Upstream đã đóng các báo cáo malformed-input trong 0.6.3/0.6.4 sau các sửa lỗi, nhưng vẫn phải kiểm tra đúng version đã khóa và xử lý file không tin cậy bằng giới hạn kích thước/cancellation/error boundary ([DWG allocation report](https://github.com/hakanaktt/acadrust/issues/123), [malformed header report](https://github.com/hakanaktt/acadrust/issues/124), [R2018 regression report](https://github.com/hakanaktt/acadrust/issues/134)).

### Bằng chứng cổng DWG hiện tại

- Code có `DwgReader`/`DwgWriter` và save staging; sau khi ghi DWG, code đọc lại file tạm và so sánh entity, object records, layer records cùng semantic inventory của document trước khi thay file đích. Nếu khác, save bị từ chối và file gốc được giữ.
- UI báo trước Unknown entity/object và diagnostic parser thuộc nhóm chưa triển khai/không hỗ trợ/lỗi; lưu chỉ tiếp tục sau khi người dùng xác nhận. Backend chặn trường hợp unknown entity/object thiếu raw payload cho định dạng đích hoặc DWG raw version không khớp version trong document.
- `fixtures/` hiện chỉ có DXF, chưa có corpus DWG hợp pháp; chưa có kết quả mở file được lưu bằng AutoCAD hoặc CAD tham chiếu khác. Vì vậy chưa xác nhận version DWG, entity coverage, metadata/opaque preservation hay khả năng tương tác thực tế.
- Kiểm tra hiện tại là chốt an toàn cấp code, không thay thế semantic corpus. Gate tuần 4 vẫn **chưa đạt** cho đến khi có fixture DWG đại diện và kết quả read/edit/save/reopen từ CAD tham chiếu; không nâng compatibility claim dựa trên việc dependency build được.

### Quản lý license

Trước khi chọn crate/engine, rà SPDX/license, notice, copyleft obligations, nguồn code port, SBOM, phiên bản cố định và cách phân phối. Giữ attribution MPL-2.0/MIT đang ghi cho acadrust/ACadSharp đến khi dependency bị loại khỏi sản phẩm và artifact test. Không dùng test fixture có nguồn/giấy phép chưa rõ.

## 6. UI, render và hiệu năng

### Tiến độ ưu tiên UI — 28-10-2026

Theo yêu cầu ưu tiên UI, công việc hiện tập trung vào tuần 10, 22 và 28 trên shell Tauri hiện có:

- ViewCube 2D đã bổ sung kéo xoay, góc nhìn N/E/S/W, Home, phím mũi tên và WCS đồng bộ. Có kiểm thử tự động và browser smoke; chưa nghiệm thu native với bản vẽ thực.
- Đã sửa vòng đời shell: tháo listener/observer cũ khi đổi ngôn ngữ hoặc mở Start, quan sát lại canvas mới và theo dõi đổi DPI. Đã kiểm tra canvas bám kích thước khi kéo panel sau đổi ngôn ngữ bằng frontend chạy với IPC mô phỏng.
- Đã sửa định tuyến phím: Backspace/Delete và Undo/Redo trong ô Properties không phát lệnh sửa bản vẽ; Ctrl+Shift+Z chỉ Redo; Enter/Space thống nhất luồng chấp nhận/lặp lại lệnh; phím đang nhập IME hoặc auto-repeat không phát lệnh CAD. Test UI được đưa vào CI.
- MDI giữ zoom, pan, góc xoay, không gian Model/Paper, layout và vùng chọn riêng cho từng document tab; handle không còn tồn tại sẽ bị loại khỏi vùng chọn khi khôi phục. Chuyển tab hủy lệnh chờ điểm và thao tác kéo grip đang dở để tránh áp dụng nhầm sang bản vẽ khác; grips của các đối tượng đã chọn xuất hiện lại khi quay về.
- Rà command UX: Enter và nút Finish/Close đều kết thúc PLINE; thiếu đỉnh thì hủy lệnh với thông báo. PLINE/SPLINE/REVCLOUD chỉ xóa preview và thoát công cụ sau khi backend xác nhận tạo thành công; nếu lệnh lỗi, các điểm còn lại để người dùng sửa hoặc thử lại.
- Localization theo roadmap: lần chạy đầu dùng EN; nút ngôn ngữ chuyển EN/VI/KO và lưu lựa chọn. Catalog VI hiện còn thiếu chuỗi nên fallback về EN; KO mới là skeleton fallback. Ribbon mode, quick access, palette visibility/collapse và kích thước workspace được lưu; lựa chọn theme, kiểm tra key thiếu và Unicode/font smoke vẫn còn.
- Chưa đóng các mục nghiệm thu tuần 22/28: công cụ chụp cửa sổ native còn timeout; cần kiểm tra Windows/WebView2, các mức DPI, mở/sửa/lưu fixture và thao tác kéo dài. Browser fixture chỉ xác minh frontend, không chứng minh Rust hoặc DWG.
- Tiếp theo: rà chuỗi thao tác command line theo tuần 28, bổ sung kiểm tra fallback/key thiếu và settings theme/workspace theo tuần 23, rồi tiếp tục nghiệm thu native. Trạng thái lệnh đang chạy được hủy khi chuyển document; command history vẫn dùng chung. Giữ các gate DWG/DXF và phạm vi 1.0 ở các mục khác; chưa đánh dấu hoàn tất dựa trên tiến độ UI.

### Yêu cầu render và hiệu năng

- Canvas render theo viewport; cull trước khi vẽ; pan/zoom không rebuild hình học bất biến.
- Tessellation ARC/bulge theo sai số pixel có giới hạn segment; snap/hit-test dùng hình học chính xác hoặc tolerance có định nghĩa.
- R-tree/BVH và index segment polyline chỉ thêm khi workload cần; giữ brute-force oracle để kiểm chứng.
- Mở/lưu/index nền có progress và cancellation. UI không chờ parser hoặc query toàn bản vẽ đồng bộ.
- Virtualize danh sách entity; tránh phát hàng nghìn thông báo UI cho một lần thay document.
- Baseline Rust phải được đo lại từ đầu: corpus thực, máy chuẩn, build release, cold/warm, p50/p95 từng thao tác, peak memory, frame time và phân bố vertex/block. Không so trực tiếp con số benchmark .NET với Rust.
- Tái sử dụng danh mục benchmark cũ (index, snap, tessellation, cache) như workload gợi ý; ghi rõ harness và allocation metric mới.

## 7. Bảo đảm chất lượng, kiểm thử và báo lỗi

### Cổng kiểm tra kỹ thuật

- Mỗi PR: `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings` theo chính sách nhóm, unit/integration tests phù hợp và build Windows.
- Core: geometry edge cases, transaction atomicity, undo/redo, index-vs-brute-force, command cancellation/state transitions.
- Định dạng: fixtures hợp pháp/golden, malformed/truncated/oversized cases, semantic round-trip, compatibility matrix và báo cáo loss.
- UI: workflow mở/chỉnh/sửa/lưu, DPI/resizing, keyboard/command input, localization và không treo khi load.
- Fuzzing có giới hạn cho parser/geometry adapter; reproducer cho lỗi được lưu làm regression fixture.
- Không yêu cầu 100% coverage làm tiêu chí thay cho chất lượng; theo dõi coverage ở core/format như chỉ báo.

### Nhật ký tuần

Mỗi tuần ghi: mục tiêu, đầu ra/link commit, tiêu chí đạt/chưa đạt, lỗi P0–P3 và owner, test/fixture, benchmark, quyết định, rủi ro/phụ thuộc và mục tiêu tuần kế. Lỗi mất dữ liệu, corrupt file hoặc crash khi mở tài liệu là blocker; không đóng blocker khi chưa có người chịu trách nhiệm và phương án xử lý. Không đưa nội dung nhạy cảm của bản vẽ lên telemetry; fixture chia sẻ phải được phép.

## 8. Lộ trình 38 tuần

| Tuần | Đầu ra | Checklist hoàn thành |
|---:|---|---|
| 1 | Chốt product brief và corpus | [ ] Ghi yêu cầu sản phẩm mới, không port C#. [ ] Xác định workflow mở DWG/DXF → sửa LINE/ARC/Polyline → lưu/mở lại. [ ] Chuẩn bị corpus DWG/DXF hợp pháp và máy Windows chuẩn. [ ] Lập issue/risk log và provenance. |
| 2 | Xác nhận UI/toolchain | [x] Chọn Tauri 2 + Vite theo quyết định sản phẩm. [ ] Kiểm tra DPI, input CAD, redraw, accessibility và packaging trên Windows. [x] Không chuyển ngược về egui khi chưa có quyết định mới. |
| 3 | Domain/architecture RFC | [ ] Chốt tọa độ, entity ID, units, angle/bulge, ownership. [ ] Chốt transaction/action/event và dependency direction. [ ] Chốt MSRV/toolchain policy, error/logging. [ ] Tạo skeleton workspace nhỏ. |
| 4 | DWG engine decision gate | [x] PoC adapter `acadrust` 0.6.7 read/write và staging/read-back guard trong code. [ ] Có fixtures DWG hợp pháp và kiểm tra read/edit/write semantic. [ ] Mở lại bằng CAD tham chiếu. [ ] Đo mapping, opaque/unsupported preservation, malformed input, Windows build, hiệu năng. [ ] Chốt adapter/license/ma trận; DWG read/edit/save vẫn là yêu cầu bắt buộc. **Gate chưa đạt: chưa có corpus DWG/CAD-reference evidence.** |
| 5 | Build/release foundation | [ ] Tách Cargo workspace khi các package boundary ổn định; repo hiện vẫn là một crate. [x] CI Windows cấu hình build/test, `cargo check`, `cargo fmt` và Clippy `-D warnings`; các bước format/lint cũng pass cục bộ. [ ] Xác minh app shell khởi động và đóng sạch trên Windows. [x] Local crash log/panic hook và version metadata đã nối; [ ] kiểm tra runtime log trên Windows. [x] Local release EXE/NSIS/MSI build thành công; [ ] artifact tái lập trong CI. |
| 6 | Geometry primitives | [x] Core LINE/CIRCLE/ARC và kiểm tra finite/degenerate hiện có. [x] Line-line intersection dùng tolerance góc tương đối, độc lập scale tọa độ. [x] Quy ước units, góc, WCS, bulge và tolerance đã ghi ở mục 4. [x] MOVE/COPY/ROTATE/MIRROR kiểm tra geometry sau transform, gồm độ dài LINE, bán kính/extents ARC/CIRCLE và metric/extents LWPOLYLINE. [x] Geometry guard có trên add/edit, DIMENSION, JOIN, FILLET, CHAMFER, TRIM, EXTEND, EXPLODE và OFFSET, tránh scan toàn drawing trên mỗi lệnh. [ ] Audit đầy đủ mọi command/parser/property path. [ ] Golden/property tests trọng yếu. |
| 7 | Polyline và giao cắt | [x] LWPOLYLINE bulge/segment; geometry core tính length, signed area cho polyline đóng, và bounds hình học chính xác gồm cực trị cung. Bounds truyền qua snapshot Tauri để Zoom Extents và window/crossing selection dùng extents đúng. [x] Line-line và line-circle giao cắt dùng kiểm tra số học/tolerance tương đối; TRIM dùng phép chiếu theo vector đơn vị. [x] Giao điểm đường thẳng với cung ARC hữu hạn theo góc quét CCW; TRIM và EXTEND nhận ARC làm biên. [x] Hit-test thao tác click của Tauri gọi Rust core cho LINE/ARC/CIRCLE/LWPOLYLINE; pointer-move không gọi bridge. TEXT pick area xét rotation và min font 10 px nhưng font metrics vẫn gần đúng; INSERT vẫn gần đúng. [ ] Tests cho major arc, tangency, đảo chiều và số học biên. [ ] Đối chiếu thuật toán nguồn nếu có. |
| 8 | Document model | [x] Chốt identity: document ID là workspace ID trong phiên; entity/layer identity dùng CAD `Handle`, tách khỏi index/tên hiển thị. [x] Mọi edit document stage bản sao rồi commit; COPY/MIRROR cấp handle mới và kiểm tra collision với entity nguồn trước khi commit. [x] Giữ BLOCK/INSERT và unknown/opaque records trong `acadrust::CadDocument`; save gate chặn payload unknown không thể bảo toàn. [x] Tauri truyền entity/layer handle dưới dạng chuỗi decimal không mất chính xác 64-bit; layer handle có trong snapshot và là khóa UI của panel/select. [x] Grip edit LWPOLYLINE chỉ thay tọa độ/bulge và giữ width/vertex ID chưa có editor. [x] Invariant guard toàn cục trước save: handle null/trùng giữa layer/entity, layer name trùng, entity layer reference và current-layer name/handle. Guard không quét toàn drawing sau từng edit để tránh chi phí O(N) mỗi lệnh. [ ] Chạy/đối chiếu guard trên corpus DWG/DXF hợp pháp và phân loại input lỗi. [ ] Serialization nội bộ debug nếu hữu ích. |
| 9 | Transaction/history | [x] Các lệnh edit/replace/property trong `DrawingDocument` stage trên bản sao rồi commit geometry/history/dirty state cùng lúc; validation geometry gắn với các command edit. Chỉnh thuộc tính entity không còn phụ thuộc layer hiện hành, chỉ layer của entity phải mở khóa. [x] UI chỉ đọc snapshot và gọi Tauri command cho thao tác document; bridge xếp hàng invoke theo thứ tự gọi để response cũ không ghi đè snapshot mới. [ ] Test chuỗi ngẫu nhiên và ID/history consistency. [ ] Chuyển snapshot history sang delta/batch sau benchmark. |
| 10 | Viewport tối thiểu | [ ] World/screen transform, fit, zoom/pan. [x] Render LINE/CIRCLE/ARC/polyline; tessellation ARC/bulge theo mật độ pixel và chặn tối đa 2.048 đoạn/cung để tránh treo khi zoom lớn. [ ] Đo redraw đầu tiên trên fixture. |
| 11 | Index và culling | [ ] Index bounds top-level. [ ] Viewport/pick query. [ ] Oracle brute force cho add/remove/update. [ ] Benchmark build/query và memory. |
| 12 | Selection, snap, layers | [ ] Click/window/crossing selection. [ ] Endpoint/midpoint/center/intersection snap (code covers straight LINE/polyline, finite ARC/circle, and bulge-arc intersections; runtime/edge acceptance remains). [ ] Layer visibility/color cơ bản. [ ] UI phản hồi trên fixture mục tiêu. |
| 13 | Command system | [ ] Registry/aliases/prompt/cancel/Escape. [ ] Nhập tọa độ absolute/relative và lịch sử lệnh. [ ] State machine test. [ ] Canonical command tách khỏi locale. |
| 14 | Lệnh vẽ/chỉnh sửa MVP | [ ] LINE, ARC, LWPOLYLINE tạo bằng chuột và command line. [ ] Chọn, MOVE, COPY, ROTATE, ERASE cho các entity đích. [ ] Transaction/undo/redo. [ ] Save/reopen DXF test. |
| 15 | DXF reader v1 | [ ] Parser có giới hạn và diagnostics. [ ] Chốt version/entity/layer subset. [ ] Fixture hỏng/truncated/oversized. [ ] Unsupported report và cancellation. |
| 16 | DXF writer v1 | [ ] Writer staging/atomic. [ ] Round-trip semantic diff. [ ] Giữ dữ liệu metadata đã hứa. [ ] CAD tham chiếu mở được fixture kết quả. |
| 17 | File workflow | [ ] Open/Save/Save As, recent/settings tối thiểu. [ ] Worker/progress/cancel. [ ] Lỗi không thay file gốc. [ ] Dirty state và fingerprint policy. |
| 18 | Text/block subset | [ ] TEXT/MTEXT và BLOCK/INSERT nếu matrix cần. [ ] Transform, layer và bounds. [ ] Font/style/format warning rõ. [ ] DXF fixture round-trip. |
| 19 | DWG open/import MVP | [ ] Mở DWG qua engine đã chọn. [ ] Map LINE/ARC/Polyline, layer, units và transforms cần thiết. [ ] Báo cáo entity ngoài phạm vi. [ ] Compare counts/coordinates/bounds với fixture/CAD tham chiếu. |
| 20 | DWG edit model | [ ] Sửa imported LINE/ARC/Polyline mà không mất identity/metadata mục tiêu. [ ] Undo/redo và dirty state. [ ] Bảo toàn object graph/opaque records theo strategy. [ ] Round-trip semantic tests. |
| 21 | DWG save/export MVP | [ ] Lưu DWG đã sửa qua engine/adapter. [ ] Mở lại trong CONCOSTCAD và CAD tham chiếu. [ ] Unsupported/loss report và xác nhận. [ ] Atomic replace, backup/recovery và fault tests. |
| 22 | Ribbon/panel shell chính | [ ] Hoàn thiện Ribbon tabs/panels theo nhóm lệnh hiện có. [ ] Document tabs, Properties/Layers, command line và status bar. [ ] DPI, resize, keyboard và layout. [ ] UX review theo workflow DWG/DXF. |
| 23 | Localization/settings | [x] EN mặc định, VI catalog và KO skeleton; lựa chọn ngôn ngữ lưu. [x] Chuỗi thiếu dùng EN fallback. [x] Ribbon mode, quick access, palette visibility/collapse và kích thước workspace lưu. [ ] Static check key thiếu. [ ] Theme preference. [ ] Unicode/font smoke tests. |
| 24 | Alpha gate | [ ] Open-edit-save-reopen DXF và DWG cho LINE/ARC/Polyline. [ ] Kiểm tra bằng fixtures và CAD tham chiếu. [ ] Không có loss/crash blocker chưa xử lý trong matrix alpha. [ ] Publish alpha matrix/known limitations. |
| 25 | Offset/trim/extend | [ ] Chọn biến thể lệnh theo workflow ưu tiên. [ ] Hình học suy biến và cancel. [ ] Atomic edit/undo. [ ] Regression fixtures. |
| 26 | Fillet/chamfer/join/explode | [ ] Hành vi/phạm vi cụ thể được đặc tả. [ ] Giữ bulge/identity theo rule. [ ] Multi-select atomic. [ ] Hiệu năng và undo test. |
| 27 | Annotation/layer tools | [ ] AREA/DIST, layer CRUD và thuộc tính. [ ] Text editing theo giới hạn. [ ] Styles được hỗ trợ công bố. [ ] Save/reopen round-trip. |
| 28 | Command UX completion | [ ] Command history, prompts, aliases và cancel behavior. [ ] LINE/ARC/Polyline dynamic input/pick flow. [ ] Error messages và selection feedback. [ ] End-to-end workflow regression. |
| 29 | Selection/grips/properties | [ ] Multi-selection cơ bản và grip/vertex editing Polyline. [ ] Properties panel cập nhật theo selection. [ ] Layer controls và visibility. [ ] Undo/redo cho thao tác tương tác. |
| 30 | DWG/DXF coverage expansion | [ ] Ưu tiên layer/table/block data thiết yếu theo corpus. [ ] Tăng version/entity fixtures. [ ] Kiểm thử unsupported preservation/loss. [ ] Cập nhật compatibility matrix. |
| 31 | Drawing robustness | [ ] Parser limits và malformed files. [ ] Cancellation/progress cho file lớn. [ ] Recovery/backup và file locking behavior. [ ] Reproducer cho từng lỗi dữ liệu. |
| 32 | Save fidelity gate | [ ] Round-trip DWG/DXF sau từng nhóm edit. [ ] Compare trong app và CAD tham chiếu. [ ] Không có silent data loss trong supported matrix. [ ] Quyết định phạm vi 1.0 dựa trên evidence. |
| 33 | Render/performance pass | [ ] Profile CPU/allocation/lock contention. [ ] Cache/index invalidation chính xác. [ ] Benchmark corpus và synthetic. [ ] Chỉ tối ưu bottleneck có profile. |
| 34 | Dữ liệu và stress | [ ] Fuzz parser có giới hạn. [ ] Large drawing/vertex/block stress. [ ] Memory/cancel/crash recovery. [ ] Lưu reproducer và regression cases. |
| 35 | Beta nội bộ | [ ] Chạy workflow thực với bản vẽ được duyệt. [ ] Ghi lỗi và loss cases theo severity. [ ] Đo cold/warm open, save, pan/select, RAM. [ ] Chốt compatibility claims có bằng chứng. |
| 36 | Stabilization | [ ] Sửa blocker/high và đóng owner. [ ] Full CI, fixtures, format matrix. [ ] Locale, package, recovery, upgrade. [ ] Known limitations và notices hoàn chỉnh. |
| 37 | Release candidate | [ ] Build sạch trên môi trường CI. [ ] Ký/đóng gói/rollback nếu áp dụng. [ ] User guide, install/uninstall, SBOM/license. [ ] Kiểm tra artifact phát hành độc lập. |
| 38 | Release 1.0 gate | [ ] Đạt acceptance matrix công ty. [ ] Công bố entity/version/command matrix. [ ] Chốt known issues và support path. [ ] Backlog 1.1 dựa trên evidence. |

## 9. Cổng quyết định và điều kiện đổi phạm vi

- **Tuần 1:** khóa product brief: sản phẩm mới bằng Rust, Windows desktop, ribbon/panel, DWG/DXF open-edit-save và LINE/ARC/Polyline.
- **Tuần 2:** nếu toolkit không đạt canvas + command workflow + DPI/accessibility tối thiểu, kéo dài spike hoặc giảm UI scope trước khi khóa kiến trúc.
- **Tuần 4:** nếu phương án DWG đầu tiên không đạt, tiếp tục đánh giá engine/adapter và cập nhật lịch/capacity; không hạ yêu cầu DWG xuống read-only.
- **Tuần 16:** nếu semantic DXF round-trip sai, dừng mở rộng entity cho tới khi parser/model invariants ổn định.
- **Tuần 24:** Alpha mục tiêu phải có DWG/DXF open-edit-save cho LINE/ARC/Polyline; matrix/loss reporting phải rõ ràng.
- **Tuần 34:** nếu hiệu năng không đạt trên corpus, ưu tiên profiling/index/render/memory trước feature mới.
- **Tuần 36–38:** chỉ công bố version/entity/workflow đã kiểm chứng; không dùng ma trận của dependency làm claim sản phẩm.

## 10. Tiêu chí nghiệm thu Rust 1.0

1. Repo sạch build và package Windows từ CI; không phụ thuộc source path cá nhân.
2. Core CAD và format adapter chạy độc lập UI; transaction/undo không làm document ở trạng thái nửa cập nhật.
3. Workflow mở → sửa → lưu → mở lại hoạt động trên corpus được duyệt; lỗi writer không làm hỏng file cũ.
4. Ma trận DXF/DWG công bố ghi rõ phiên bản, entity, metadata, giới hạn và loss behavior; mỗi hàng có fixture/evidence.
5. Không âm thầm bỏ dữ liệu ngoài phạm vi. Unsupported/loss được báo trước khi ghi chuyển đổi; byte-copy nguyên trạng có điều kiện xác minh nguồn.
6. Không còn P0/P1 về crash, mất dữ liệu hoặc file corruption chưa có disposition được product owner chấp thuận.
7. Hiệu năng được đo trên máy và corpus đã định danh; ngưỡng do nhóm chấp nhận sau baseline, không lấy benchmark C# làm ngưỡng Rust.
8. UI, command input, DPI và localization smoke test đạt trên Windows 10/11 được hỗ trợ.
9. License notices/SBOM và hướng dẫn cài đặt đi cùng artifact; dependency DWG được rà soát trước phát hành.
10. DWG editing/saving cho LINE/ARC/Polyline nằm trong claim 1.0 bắt buộc. Paper Space, AutoLISP và plugin SDK có thể được ghi giới hạn hoặc đưa sang giai đoạn sau.

## 11. Rủi ro chính

| ID | Mức | Rủi ro | Giảm thiểu / tín hiệu quyết định |
|---|---|---|---|
| R1 | Rất cao | Engine acadrust 0.6.7 có thể không đạt fidelity, malformed-input safety hoặc corpus DWG mục tiêu. | PoC tuần 4; kiểm tra version đã khóa, đánh giá engine/adapter khác nếu cần, giữ yêu cầu và cập nhật lịch trước khi khóa kiến trúc. |
| R2 | Cao | DWG có nhiều version/entity/metadata hơn phạm vi 1.0. | Chốt matrix theo corpus; báo loss rõ; bảo đảm các loại trong matrix round-trip. |
| R3 | Cao | UI desktop CAD và DWG engine làm phạm vi 38 tuần lớn với một người. | Ưu tiên MVP bắt buộc, defer LISP/plugin/3D; re-estimate sau gate DWG và theo tiến độ thực tế. |
| R4 | Trung bình | Tài liệu legacy không còn trong repo và không phải nguồn code của dự án mới. | Không port hay hứa tương thích kế thừa; chỉ dùng yêu cầu sản phẩm hiện đã chốt và evidence mới. |
| R5 | Trung bình-cao | Toolkit Rust thay đổi hoặc thiếu trải nghiệm CAD desktop chuyên sâu. | Spike nhiều toolkit, ADR và prototype trên Windows trước khi đầu tư UI. |
| R6 | Cao | Tọa độ lớn, bulge, giao cắt và tolerance gây sai hình học hoặc hỏng bản vẽ. | Đặc tả số học, property/oracle tests, fuzz và corpus regression. |
| R7 | Trung bình-cao | Benchmark tổng hợp không đại diện drawing thật. | Thu corpus được phép; đo frame time, peak RAM, p95 và workflow thực. |
| R8 | Trung bình | Plugin native/LISP mở rộng bề mặt lỗi và chạy code tin cậy. | Defer tới sau 1.0 gate; giới hạn thời gian, transaction và trust boundary. |

## 12. Việc đầu tiên sau khi duyệt kế hoạch

1. Dự án Rust đã có skeleton; tạo ứng dụng desktop chạy được và workspace/module nền.
2. Lập corpus DWG/DXF hợp pháp có LINE/ARC/Polyline, version và expected output.
3. Làm spike UI Ribbon/panel và PoC DWG read/edit/write sớm để phát hiện rủi ro engine.
4. Tạo `docs/STATUS_MATRIX.md` trạng thái `specified / implemented / verified / deferred` và liên kết từ kế hoạch.
5. Xác nhận ước lượng 38 tuần sau PoC DWG; giữ nguyên các yêu cầu sản phẩm đã chốt.
