# CONCOSTCAD — Kế hoạch phát triển Rust

**Ngày lập:** 27-10-2026  
**Phạm vi:** Xây dựng CONCOSTCAD mới hoàn toàn bằng Rust thành ứng dụng CAD desktop Windows.  
**Tài liệu dự án:** `Cargo.toml`, `Cargo.lock`, `src/main.rs`. Tài liệu legacy đã được dọn khỏi `docs`; các nội dung hữu ích đã được tổng hợp có chọn lọc vào kế hoạch này.

## 1. Tóm tắt điều hành

CONCOSTCAD là dự án mới, không port ứng dụng C# trước đây. Hiện repo có shell desktop `eframe`/`egui`, model document `acadrust`, file picker và luồng đọc DWG/DXF ở worker thread; có thể tạo LINE/ARC/Polyline, hiển thị LINE/ARC/LWPOLYLINE, chọn/di chuyển/xóa entity, undo/redo và lưu cùng định dạng. Những lát cắt này compile-check được nhưng chưa có kiểm chứng tương thích trên file DWG/DXF thực tế. Sản phẩm đích vẫn là CAD Windows có ribbon/panel kiểu AutoCAD, mở/sửa/lưu DWG/DXF và author/edit LINE–ARC–Polyline; khả năng lưu DWG sau chỉnh sửa là yêu cầu bắt buộc, không phải hạng mục tùy chọn hoặc read-only.

Kế hoạch này xây theo vertical slice: hình học và document core, UI CAD, DXF, rồi DWG read/edit/write; mỗi giai đoạn phải để lại ứng dụng chạy được. Đích 1.0 phải mở bản vẽ DWG/DXF trong phạm vi tương thích công bố, vẽ/sửa LINE–ARC–Polyline, lưu, mở lại và xác minh không âm thầm mất dữ liệu trong phạm vi hỗ trợ.

**Nguồn lực:** Codex là người triển khai chính trong repo; người dùng cung cấp quyết định sản phẩm, bản vẽ mẫu được phép dùng và kiểm tra nghiệm thu khi cần. Roadmap gồm 38 tuần làm việc như kế hoạch mục tiêu; với một người triển khai, rủi ro lớn nhất là engine DWG và UI. Sau PoC DWG tuần 4 sẽ cập nhật ước lượng, nhưng mục tiêu đọc/sửa/lưu DWG vẫn giữ nguyên; nếu cần sẽ điều chỉnh thời gian hoặc chọn engine/thành phần phù hợp, không hạ yêu cầu âm thầm.

## 2. Nguyên tắc sản phẩm và phạm vi 1.0

### Mục tiêu

- Ứng dụng desktop Rust trên Windows; lưu trữ tài liệu và hình học bằng `f64`, đơn vị và quy ước tọa độ được định nghĩa tường minh.
- Vòng đời bản vẽ đáng tin cậy: New/Open/Save/Save As DWG/DXF trong compatibility matrix, hủy tác vụ, thông báo đối tượng không hỗ trợ, lưu staging/atomic và không làm hỏng file nguồn khi lỗi.
- Core 2D độc lập UI: LINE, CIRCLE, ARC, LWPOLYLINE có bulge; layer; selection/snap; transaction; undo/redo; command dispatch.
- UI Windows có Ribbon theo tab, canvas, command line/nhập tọa độ, document tabs, Properties và Layers panels; shell ban đầu dùng eframe/egui + egui_dock, giữ quyết định qua usability gate tuần 2.
- DXF subset được mô tả bằng ma trận version/entity có kiểm thử round-trip. DWG chỉ công bố các trường hợp đã kiểm tra bằng file được phép dùng và CAD tham chiếu.
- Có bộ fixture hợp pháp, kiểm thử hồi quy, benchmark có thể chạy lại, log lỗi và quy trình phát hành Windows.
- English mặc định; kiến trúc chuỗi cho phép thêm Vietnamese và Korean khi shell/UI ổn định.

### Ngoài phạm vi cam kết 1.0

Không hứa tương thích đầy đủ AutoCAD, mọi entity/phiên bản DWG, Paper Space/plot hoàn chỉnh, 3D, Visual LISP, mọi chương trình AutoLISP hoặc plugin ABI ổn định thương mại. DWG read/edit/save là bắt buộc trong matrix được hỗ trợ; fidelity ngoài matrix phải được báo rõ trước khi lưu.

## 3. Đánh giá hiện trạng và quy tắc sử dụng tài liệu legacy

### Trạng thái quan sát được trong checkout (27-10-2026)

- `Cargo.toml` khai báo package `CONCOSTCAD`, version `0.1.0`, edition `2024`; dependencies gồm `eframe`, `egui_dock`, `rfd` và `acadrust` 0.6.7.
- `src/document.rs` là adapter document hiện tại: thêm/sửa/xóa entity, history snapshot, dirty-state theo ID, DWG/DXF reader/writer và ghi staging file. `src/app.rs` nối adapter vào shell và chạy parse trên worker thread.
- Canvas authoring hiện có LINE, ARC ba điểm, LWPOLYLINE thẳng; có hiển thị/hit-test LINE, ARC, bulge-polyline và thao tác chọn, Move, Erase. Các entity khác được giữ trong model nhưng chưa render/chỉnh sửa qua UI.
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

### Quyết định UI ban đầu

Chọn tạm `eframe/egui 0.36.2` với renderer `glow`, và `egui_dock 0.21.1` cho workspace có thể dock/tab. Các version này khớp dependency API (`egui_dock 0.21.1` dựa trên egui 0.36), build được với Rust toolchain có trong môi trường và cho phép vẽ canvas CAD trực tiếp bằng Rust. egui tự mô tả là không nhắm tới giao diện native mặc định; vì vậy CONCOSTCAD sẽ dùng theme và control riêng cho CAD, không giả vờ là WinUI. Tuần 2 vẫn là cổng đánh giá giao diện chạy thật trên Windows: nếu Ribbon/panels, DPI, keyboard và accessibility không đạt, đổi toolkit trước khi core UI phụ thuộc sâu.

Tham khảo chính thức: [eframe 0.36.2](https://docs.rs/eframe/0.36.2/eframe/), [egui 0.36](https://docs.rs/egui/0.36.2/egui/), [egui_dock 0.21.1](https://docs.rs/egui_dock/0.21.1/egui_dock/). Cần khóa dependency và rà license/notice trong release process.

### UI/MVVM

MVVM là ranh giới trách nhiệm, không nhất thiết là framework. ViewModel/state reducer nhận action UI, gọi use case và phát state; canvas là projection của model. Tuần 2 so sánh Slint, egui, iced (và native Windows nếu cần) trên Ribbon/panels có thể tùy biến, canvas, command line, docking, DPI, accessibility, localization, testability, packaging, startup và redraw. Prototype phải thể hiện một cửa sổ làm việc CAD có Ribbon, canvas, Properties/Layers panels và command line; chốt theo prototype chạy được và ghi decision record.

### Dữ liệu và số học

- Chuẩn hóa góc (radian nội bộ), chiều cung, trục Y, tọa độ world/screen, elevation và quy ước bulge.
- Từ chối NaN/Inf và kích thước vượt giới hạn parser; định nghĩa tolerance theo scale thay vì một epsilon cố định cho mọi drawing.
- Dùng ID/handle tách biệt khỏi chỉ số vector; lưu rõ thứ tự vẽ khi cần.
- Parser xử lý byte/record có giới hạn; mọi offset/count/length phải kiểm tra trước cấp phát hoặc đọc.

## 5. Chiến lược DWG/DXF và dependency

### DXF

DXF là đường kiểm chứng đầu tiên vì dễ tạo fixture và so sánh ngữ nghĩa. Chốt ASCII/binary, version đích, entity, table/section cần giữ; stream file lớn; xử lý malformed input có giới hạn; giữ dữ liệu không hỗ trợ khi an toàn hoặc phát sinh loss report. Semantic round-trip so sánh entity, thuộc tính, tọa độ, layer, block, units và metadata trong phạm vi mục tiêu.

### DWG

- Giữ adapter `concostcad-dwg` độc lập để có thể thay engine mà không lan dependency vào core.
- Ứng viên đầu tiên đã chọn cho PoC là **[acadrust 0.6.7](https://docs.rs/crate/acadrust/0.6.7)**: thư viện Rust có API đọc/ghi DWG/DXF. Cargo đã resolve và build dependency thành công, nhưng đó mới chỉ xác nhận build, chưa chứng minh file mẫu đọc/sửa/lưu round-trip. Upstream công bố hỗ trợ R12–R2018+; đây không phải compatibility claim cho ứng dụng CONCOSTCAD.
- DWG read/edit/write là điều kiện phát hành; reader và writer phải cùng làm việc trên compatibility matrix được hỗ trợ, hoặc adapter phải giữ object/metadata cần thiết khi sửa.
- Tuần 4 xác nhận acadrust trên corpus được phép: entities, layer, tọa độ, metadata, save/reopen bằng CAD tham chiếu, malformed files, Windows build, hiệu năng và license. Nếu không đáp ứng, đánh giá engine khác hoặc adapter native có ranh giới rõ và cập nhật lịch/capacity. Không đổi yêu cầu thành read-only; không tự xây codec DWG trước khi có RFC kỹ thuật và rà pháp lý.
- Mỗi bản vẽ có báo cáo unsupported/loss trước edited save; không âm thầm bỏ Paper Space, xref, proxy, XDATA/EED, dictionaries, style hoặc block data. Với cấu trúc trong matrix hỗ trợ, round-trip phải bảo toàn semantic data cần thiết.
- File không thay đổi chỉ được byte-copy nếu có fingerprint và kiểm tra file nguồn chưa đổi; không xem byte-copy là khả năng ghi DWG.
- Mỗi claim tương thích phải trỏ tới fixture có provenance, expected output và CAD tham chiếu đã dùng.
- acadrust được cấp phép MPL-2.0; thêm license/third-party notices vào hồ sơ phát hành. Upstream đã đóng các báo cáo malformed-input trong 0.6.3/0.6.4 sau các sửa lỗi, nhưng vẫn phải kiểm tra đúng version đã khóa và xử lý file không tin cậy bằng giới hạn kích thước/cancellation/error boundary ([DWG allocation report](https://github.com/hakanaktt/acadrust/issues/123), [malformed header report](https://github.com/hakanaktt/acadrust/issues/124), [R2018 regression report](https://github.com/hakanaktt/acadrust/issues/134)).

### Quản lý license

Trước khi chọn crate/engine, rà SPDX/license, notice, copyleft obligations, nguồn code port, SBOM, phiên bản cố định và cách phân phối. Giữ attribution MPL-2.0/MIT đang ghi cho acadrust/ACadSharp đến khi dependency bị loại khỏi sản phẩm và artifact test. Không dùng test fixture có nguồn/giấy phép chưa rõ.

## 6. UI, render và hiệu năng

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
| 2 | Xác nhận UI/toolchain | [ ] Chạy shell egui/eframe trên Windows. [ ] Hoàn thiện prototype Ribbon, dock panels, canvas, command line. [ ] Kiểm tra DPI, input CAD, redraw, accessibility, packaging. [ ] ADR xác nhận hoặc thay framework. |
| 3 | Domain/architecture RFC | [ ] Chốt tọa độ, entity ID, units, angle/bulge, ownership. [ ] Chốt transaction/action/event và dependency direction. [ ] Chốt MSRV/toolchain policy, error/logging. [ ] Tạo skeleton workspace nhỏ. |
| 4 | DWG engine decision gate | [ ] PoC acadrust 0.6.7 read/edit/write trên fixtures hợp pháp. [ ] Thử mở bằng CAD tham chiếu sau khi lưu. [ ] Đo mapping, opaque/unsupported preservation, malformed input, Windows build, hiệu năng. [ ] Chốt adapter/license/ma trận; DWG read/edit/save vẫn là yêu cầu bắt buộc. |
| 5 | Build/release foundation | [ ] Workspace Cargo, CI Windows, fmt/lint/test. [ ] App shell Rust khởi động và đóng sạch. [ ] Logging/crash boundary, version metadata. [ ] Artifact debug/release tái lập. |
| 6 | Geometry primitives | [ ] Vec/point/transform/bounds, LINE/CIRCLE/ARC. [ ] Quy ước góc và tolerance thành tài liệu. [ ] Validate finite/degenerate/large coordinate. [ ] Golden/property tests trọng yếu. |
| 7 | Polyline và giao cắt | [ ] LWPOLYLINE bulge, segment, area/length/bounds. [ ] Giao điểm line/circle/arc và khoảng cách. [ ] Tests cho major arc, tangency, đảo chiều và số học biên. [ ] Đối chiếu thuật toán nguồn nếu có. |
| 8 | Document model | [ ] Entity/layer/document IDs ổn định. [ ] Add/replace/remove và invariant. [ ] Block/opaque modeling decision. [ ] Serialization nội bộ debug nếu hữu ích. |
| 9 | Transaction/history | [ ] Edit transaction atomic, rollback. [ ] Undo/redo delta, batch operation. [ ] Test chuỗi ngẫu nhiên và ID/history consistency. [ ] Không để UI sửa model trực tiếp. |
| 10 | Viewport tối thiểu | [ ] World/screen transform, fit, zoom/pan. [ ] Render LINE/CIRCLE/ARC/polyline. [ ] Sai số tessellation theo pixel. [ ] Đo redraw đầu tiên trên fixture. |
| 11 | Index và culling | [ ] Index bounds top-level. [ ] Viewport/pick query. [ ] Oracle brute force cho add/remove/update. [ ] Benchmark build/query và memory. |
| 12 | Selection, snap, layers | [ ] Click/window/crossing selection. [ ] Endpoint/midpoint/center/intersection snap. [ ] Layer visibility/color cơ bản. [ ] UI phản hồi trên fixture mục tiêu. |
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
| 23 | Localization/settings | [ ] Catalog EN mặc định, VI/KO skeleton. [ ] Fallback/thiếu key checks. [ ] Theme/workspace/settings lưu. [ ] Unicode/font smoke tests. |
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
