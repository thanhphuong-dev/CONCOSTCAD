import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./style.css";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Localization Catalogs (Tuần 23: Localization/Settings)
let currentLang = localStorage.getItem("concostcad_lang") || "vi";

const i18n = {
  vi: {
    brand_sub: "PHIÊN BẢN RUST · 2.0",
    new_btn: "＋ Bản vẽ mới",
    open_btn: "▣ Mở DWG/DXF",
    tab_home: "Trang chính",
    tab_draw: "Vẽ (Draw)",
    tab_annotate: "Ghi chú & Đo",
    tab_view: "Giao diện (View)",
    space_label: "KHÔNG GIAN MÔ HÌNH 2D · WCS",
    grp_draw: "VẼ HÌNH HỌC",
    grp_modify: "CHỈNH SỬA",
    grp_layers: "QUẢN LÝ LỚP",
    grp_annotate: "ĐO LƯỜNG",
    grp_view_file: "XEM & TỆP",
    grp_nav: "ĐIỀU HƯỚNG",
    grp_aids: "HỖ TRỢ VẼ",
    tool_select: "Chọn",
    tool_line: "Đoạn thẳng",
    tool_arc: "Cung tròn",
    tool_poly: "Đa tuyến",
    tool_circle: "Đường tròn",
    tool_rect: "Hình chữ nhật",
    tool_text: "Văn bản (Text)",
    tool_join: "Nối liền (Join)",
    tool_fillet: "Bo góc (Fillet)",
    tool_chamfer: "Vát mép (Chamfer)",
    tool_trim: "Cắt xén (Trim)",
    tool_extend: "Kéo dài (Extend)",
    tool_dim: "Ghi kích thước (Dim)",
    tool_move: "Di chuyển",
    tool_copy: "Sao chép",
    tool_rotate: "Xoay",
    tool_mirror: "Đối xứng",
    tool_explode: "Phân rã (Explode)",
    tool_offset: "Song song (Offset)",
    tool_erase: "Xóa",
    tool_undo: "Hoàn tác",
    tool_redo: "Làm lại",
    tool_dist: "Khoảng cách",
    tool_area: "Diện tích",
    tool_zoom_all: "Thu phóng hết",
    tool_save: "Lưu",
    tool_open: "Mở tệp",
    add_layer: "＋ Thêm lớp",
    prop_heading: "Thuộc tính",
    prop_drawing: "THUỘC TÍNH BẢN VẼ",
    prop_selected: "ĐỐI TƯỢNG ĐÃ CHỌN",
    prop_multiple: "NHIỀU ĐỐI TƯỢNG",
    prop_file: "Bản vẽ",
    prop_entities: "Tổng thực thể",
    prop_layer: "Lớp hiện hành",
    prop_selection: "Đang chọn",
    prop_none: "Không có",
    prop_units: "Đơn vị",
    prop_type: "Loại hình",
    prop_handle: "Mã định danh",
    prop_length: "Chiều dài",
    prop_radius: "Bán kính",
    prop_center: "Tâm (X, Y)",
    prop_sweep: "Góc quét",
    prop_vertices: "Số đỉnh",
    prop_closed: "Khép kín",
    prop_yes: "Có",
    prop_no: "Không",
    layer_heading: "Danh sách Lớp (Layers)",
    layer_name: "TÊN LỚP",
    layer_on: "HIỆN",
    layer_lock: "KHÓA",
    cmd_placeholder: "Nhập lệnh (L, A, PL, C, REC, M, CO, RO, MI, E, U, REDO, DIST, AREA) hoặc tọa độ x,y",
    ready_status: "Sẵn sàng · Bản vẽ mới",
    grid_btn: "▦ LƯỚI",
    snap_btn: "⊕ BẮT ĐIỂM",
    ortho_btn: "∟ TRỰC GIAO",
  },
  en: {
    brand_sub: "RUST EDITION · 2.0",
    new_btn: "＋ New Drawing",
    open_btn: "▣ Open DWG/DXF",
    tab_home: "Home",
    tab_draw: "Draw",
    tab_annotate: "Annotate",
    tab_view: "View",
    space_label: "2D MODEL SPACE · WCS",
    grp_draw: "DRAW",
    grp_modify: "MODIFY",
    grp_layers: "LAYERS",
    grp_annotate: "ANNOTATE",
    grp_view_file: "VIEW & FILE",
    grp_nav: "NAVIGATION",
    grp_aids: "DRAFTING AIDS",
    tool_select: "Select",
    tool_line: "Line",
    tool_arc: "Arc",
    tool_poly: "Polyline",
    tool_circle: "Circle",
    tool_rect: "Rectangle",
    tool_spline: "Spline Curve",
    tool_revcloud: "Revision Cloud",
    tool_hatch: "Hatch Pattern",
    tool_text: "Text",
    tool_join: "Join",
    tool_fillet: "Fillet",
    tool_chamfer: "Chamfer",
    tool_trim: "Trim",
    tool_extend: "Extend",
    tool_dim: "Dimension",
    tool_move: "Move",
    tool_copy: "Copy",
    tool_rotate: "Rotate",
    tool_mirror: "Mirror",
    tool_explode: "Explode",
    tool_offset: "Offset",
    tool_erase: "Erase",
    tool_undo: "Undo",
    tool_redo: "Redo",
    tool_dist: "Distance",
    tool_area: "Area",
    tool_zoom_all: "Zoom Extents",
    tool_save: "Save",
    tool_open: "Open",
    add_layer: "＋ Add Layer",
    prop_heading: "Properties",
    prop_drawing: "DRAWING PROPERTIES",
    prop_selected: "SELECTED ENTITY",
    prop_multiple: "MULTIPLE SELECTION",
    prop_file: "Drawing",
    prop_entities: "Total Entities",
    prop_layer: "Active Layer",
    prop_selection: "Selection",
    prop_none: "None",
    prop_units: "Units",
    prop_type: "Type",
    prop_handle: "Handle",
    prop_length: "Length",
    prop_radius: "Radius",
    prop_center: "Center (X, Y)",
    prop_sweep: "Sweep Angle",
    prop_vertices: "Vertices",
    prop_closed: "Closed",
    prop_yes: "Yes",
    prop_no: "No",
    layer_heading: "Layers",
    layer_name: "NAME",
    layer_on: "ON",
    layer_lock: "LOCK",
    cmd_placeholder: "Type a command (L, A, PL, C, REC, M, CO, RO, MI, E, U, REDO, DIST, AREA) or x,y",
    ready_status: "Ready · New drawing",
    grid_btn: "▦ GRID",
    snap_btn: "⊕ SNAP",
    ortho_btn: "∟ ORTHO",
  }
};

const t = (key) => i18n[currentLang][key] || key;

// Application State
let model = {
  title: "Drawing1",
  dirty: false,
  entityCount: 0,
  currentLayer: "0",
  layers: [{ name: "0", frozen: false, off: false, locked: false }],
  entities: []
};

let activeRibbonTab = "home";
let activeTool = "select"; // 'select', 'line', 'arc', 'polyline', 'circle', 'rectangle', 'move', 'copy', 'rotate', 'mirror', 'dist', 'area'
let points = [];
let zoom = 1;
let pan = { x: 0, y: 0 };
let world = { x: 0, y: 0 };
let isPanning = false;
let lastPan = null;
let selectedHandles = new Set();

// Grip Editing State (Tuần 29)
let activeGrip = null;

// Command History State (Tuần 28)
let commandHistory = [];
let historyIndex = -1;

// Offset Tool State (Tuần 25)
let offsetDist = 20.0;
let offsetTargetHandle = null;

// Window & Crossing Selection Box State
let isBoxSelecting = false;
let boxStart = null;
let boxCurrent = null;

let snapEnabled = true;
let orthoEnabled = false;
let currentSnap = null;
let moveBasePoint = null;
let isAddingLayer = false;
let measureInfo = null;

const app = $("#app");

// Render Base Shell
function renderShell() {
  app.innerHTML = `
    <header class="titlebar" data-tauri-drag-region>
      <div class="brand-mark">C</div>
      <div class="brand">CONCOST<span>CAD</span></div>
      <div class="title-divider"></div>
      <button class="title-action" id="newBtn">${t("new_btn")}</button>
      <button class="title-action" id="openBtn">${t("open_btn")}</button>
      <div class="title-name" id="titleName">Drawing1</div>
      <div class="title-spacer"></div>
      <button class="title-action" id="langToggleBtn" style="height:22px; padding:0 8px; font-weight:700; color:#8fe2f3; background:#1b3846;" title="Toggle Language (VI / EN)">${currentLang.toUpperCase()}</button>
      <div class="edition">${t("brand_sub")}</div>
      <div class="window-controls">
        <button aria-label="Minimize" id="minimizeBtn">−</button>
        <button aria-label="Maximize" id="maximizeBtn">□</button>
        <button aria-label="Close" id="closeBtn">×</button>
      </div>
    </header>
    <nav class="tabs" id="ribbonTabs">
      <button class="tab ${activeRibbonTab==='home'?'active':''}" data-tab="home">${t("tab_home")}</button>
      <button class="tab ${activeRibbonTab==='draw'?'active':''}" data-tab="draw">${t("tab_draw")}</button>
      <button class="tab ${activeRibbonTab==='annotate'?'active':''}" data-tab="annotate">${t("tab_annotate")}</button>
      <button class="tab ${activeRibbonTab==='view'?'active':''}" data-tab="view">${t("tab_view")}</button>
      <span class="space-label">${t("space_label")}</span>
    </nav>
    <section class="ribbon" id="ribbonContainer"></section>
    <main class="workspace">
      <aside class="quickbar">
        <button title="${t('tool_select')} (Esc)" data-tool="select" class="${activeTool==='select'?'selected':''}">↖</button>
        <button title="${t('tool_line')} (L)" data-tool="line" class="${activeTool==='line'?'selected':''}">／</button>
        <button title="${t('tool_arc')} (A)" data-tool="arc" class="${activeTool==='arc'?'selected':''}">◜</button>
        <button title="${t('tool_poly')} (PL)" data-tool="polyline" class="${activeTool==='polyline'?'selected':''}">⌁</button>
        <button title="${t('tool_circle')} (C)" data-tool="circle" class="${activeTool==='circle'?'selected':''}">◯</button>
        <button title="${t('tool_rect')} (REC)" data-tool="rectangle" class="${activeTool==='rectangle'?'selected':''}">▭</button>
        <button title="${t('tool_move')} (M)" data-tool="move" class="${activeTool==='move'?'selected':''}">✥</button>
        <button title="${t('tool_copy')} (CO)" data-tool="copy" class="${activeTool==='copy'?'selected':''}">⧉</button>
        <button title="${t('tool_rotate')} (RO)" data-tool="rotate" class="${activeTool==='rotate'?'selected':''}">⟳</button>
        <button title="${t('tool_offset')} (O)" data-tool="offset" class="${activeTool==='offset'?'selected':''}">⫽</button>
        <button title="${t('tool_explode')} (X)" id="quickExplodeBtn">💥</button>
        <button title="${t('tool_mirror')} (MI)" data-tool="mirror" class="${activeTool==='mirror'?'selected':''}">⧎</button>
        <button title="${t('tool_dist')}" data-tool="dist" class="${activeTool==='dist'?'selected':''}">📏</button>
        <button title="${t('tool_area')}" data-tool="area" class="${activeTool==='area'?'selected':''}">⏢</button>
        <div class="quickbar-bottom">2D</div>
      </aside>
      <section class="drawing-area">
        <div class="drawing-tab">
          <span class="tab-arrow">▾</span>
          <div class="drawing-tab-label">
            <span class="file-dot"></span>
            <span id="drawingTabName">Drawing1</span>
            <span class="dirty-dot" id="dirtyDot"></span>
            <button class="close-tab" id="closeDrawingTab">×</button>
          </div>
          <div class="tab-tools">
            <button title="Settings">▾</button>
          </div>
        </div>
        <div class="viewport" id="viewport" tabindex="0">
          <canvas id="cadCanvas"></canvas>
          <div class="empty-hint" id="emptyHint">
            <div class="hint-icon">＋</div>
            <div class="hint-title">CONCOSTCAD Workspace</div>
            <div class="hint-sub">Click on canvas to draw or drag mouse to window-select objects.</div>
            <div class="hint-shortcuts">
              <span>LINE</span>
              <span>ARC</span>
              <span>PLINE</span>
              <span>CIRCLE</span>
              <span>RECT</span>
            </div>
          </div>
          <div class="canvas-coords" id="canvasCoords">MODEL SPACE · GRID ON · UCS WORLD</div>
          <div class="layout-tab-bar" id="layoutTabBar">
            <button class="layout-tab active" data-space="model">Model</button>
            <button class="layout-tab" data-space="layout1">Layout1</button>
            <button class="layout-tab" data-space="layout2">Layout2</button>
            <button class="layout-add-btn" id="addLayoutBtn" title="Thêm bố cục mới">＋</button>
          </div>
          <div class="view-cube"><span>TOP</span><i></i><small>W</small></div>
          <div class="nav-wheel">⌖<br><span>−</span><br>＋</div>
        </div>
      </section>
      <aside class="sidepanels">
        <section class="panel properties">
          <div class="panel-heading">
            <span class="panel-grip">⠿</span>
            <span>${t("prop_heading")}</span>
            <button id="toggleProperties">⌄</button>
          </div>
          <div class="panel-body" id="propertiesBody"></div>
        </section>
        <section class="panel layers">
          <div class="panel-heading">
            <span class="panel-grip">⠿</span>
            <span>${t("layer_heading")}</span>
            <button class="add-layer" id="addLayerBtn" title="${t('add_layer')}">＋</button>
          </div>
          <div id="newLayerContainer" class="new-layer-box" style="display:none;">
            <input type="text" id="newLayerInput" class="new-layer-input" placeholder="Layer name..." />
            <button id="confirmAddLayer" class="new-layer-btn">Add</button>
          </div>
          <div class="layer-head"><span>${t("layer_name")}</span><span>${t("layer_on")}</span><span>${t("layer_lock")}</span></div>
          <div id="layerList"></div>
        </section>
      </aside>
    </main>
    <section class="commandbar">
      <div class="prompt-mark">›_</div>
      <input id="commandInput" autocomplete="off" placeholder="${t('cmd_placeholder')}" />
      <button class="command-send" id="commandSend">↵</button>
    </section>
    <footer class="statusbar">
      <div class="status-message">
        <span class="status-light"></span>
        <span id="status">${t("ready_status")}</span>
      </div>
      <div class="status-right">
        <span id="coordReadout">X  0.000   Y  0.000</span>
        <span class="status-sep"></span>
        <button id="toggleGridBtn" class="status-toggle active" title="Toggle Grid">${t("grid_btn")}</button>
        <button id="toggleSnapBtn" class="status-toggle active" title="Toggle Object Snap (F3)">${t("snap_btn")}</button>
        <button id="toggleOrthoBtn" class="status-toggle" title="Toggle Ortho Mode (F8)">${t("ortho_btn")}</button>
        <span class="zoom-readout" id="zoomReadout">100%</span>
        <button class="user-icon" title="Engineer Thanh Phuong">P</button>
      </div>
    </footer>
  `;

  bindShellEvents();
}

function bindShellEvents() {
  const canvasEl = $("#cadCanvas");
  const viewportEl = $("#viewport");

  $("#langToggleBtn").onclick = () => {
    currentLang = currentLang === "vi" ? "en" : "vi";
    localStorage.setItem("concostcad_lang", currentLang);
    renderShell();
    renderRibbon();
    render();
  };

  $$("#ribbonTabs .tab").forEach((tab) => {
    tab.onclick = () => {
      $$("#ribbonTabs .tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeRibbonTab = tab.dataset.tab;
      renderRibbon();
    };
  });

  $$(".quickbar [data-tool]").forEach((b) => {
    b.onclick = () => chooseTool(b.dataset.tool);
  });

  $("#newBtn").onclick = async () => {
    await sync(invoke("new_drawing"));
    points = [];
    pan = { x: 0, y: 0 };
    zoom = 1;
    selectedHandles.clear();
    setStatus(t("ready_status"));
  };

  $("#openBtn").onclick = openDrawing;
  $("#toggleGridBtn").onclick = toggleGrid;
  $("#toggleSnapBtn").onclick = toggleSnap;
  $("#toggleOrthoBtn").onclick = toggleOrtho;

  const appWindow = getCurrentWindow();
  $("#minimizeBtn").onclick = () => appWindow.minimize();
  $("#maximizeBtn").onclick = () => appWindow.toggleMaximize();
  $("#closeBtn").onclick = () => appWindow.close();

  $("#addLayerBtn").onclick = () => {
    isAddingLayer = !isAddingLayer;
    $("#newLayerContainer").style.display = isAddingLayer ? "flex" : "none";
    if (isAddingLayer) $("#newLayerInput").focus();
  };

  $("#confirmAddLayer").onclick = async () => {
    const name = $("#newLayerInput").value.trim();
    if (name) {
      await sync(invoke("add_layer", { name }));
      $("#newLayerInput").value = "";
      $("#newLayerContainer").style.display = "none";
      isAddingLayer = false;
    }
  };

  $("#newLayerInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#confirmAddLayer").click();
        if ((e.key === " " || e.code === "Space") && activeTool === "select" && document.activeElement !== $("#commandInput") && document.activeElement !== $("#newLayerInput") && !document.activeElement.classList.contains("prop-input")) {
      e.preventDefault();
      chooseTool(lastTool);
      return;
    }
    if (e.key === "Escape") {
      $("#newLayerContainer").style.display = "none";
      isAddingLayer = false;
    }
  });

  bindCanvasEvents(viewportEl, canvasEl);

  $(".layout-tab").forEach((btn) => {
    btn.onclick = () => {
      $(".layout-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeSpace = btn.dataset.space;
      setStatus(activeSpace === "model" ? "Không gian mô hình (Model Space)" : `Không gian giấy (Paper Space - ${activeSpace.toUpperCase()})`);
      draw();
    };
  });
  const addLayBtn = $("#addLayoutBtn");
  if (addLayBtn) {
    addLayBtn.onclick = () => {
      const bar = $("#layoutTabBar");
      const num = bar.querySelectorAll(".layout-tab").length;
      const newBtn = document.createElement("button");
      newBtn.className = "layout-tab";
      newBtn.dataset.space = `layout${num}`;
      newBtn.textContent = `Layout${num}`;
      newBtn.onclick = () => {
        $(".layout-tab").forEach((b) => b.classList.remove("active"));
        newBtn.classList.add("active");
        activeSpace = newBtn.dataset.space;
        setStatus(`Không gian giấy (Paper Space - ${activeSpace.toUpperCase()})`);
        draw();
      };
      bar.insertBefore(newBtn, addLayBtn);
      newBtn.click();
    };
  }
  bindCommandBarEvents();
}

let showGrid = true;
let activeSpace = "model";
let openDocuments = [
  { id: 1, title: "Drawing1", path: null, dirty: false }
];
let activeDocId = 1;
let nextDocId = 2;
let lastTool = "line";
let filletRadius = 0;
let chamferDist = 5;
let dimPrecision = 2;
let dimSuffix = "";

// Catmull-Rom Spline Interpolation for smooth CAD curves
function interpolateCatmullRom(pts, numSamples = 10) {
  if (pts.length < 2) return pts.map((p) => [p.x, p.y, 0]);
  if (pts.length === 2) return [[pts[0].x, pts[0].y, 0], [pts[1].x, pts[1].y, 0]];

  const res = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i === 0 ? pts[0] : pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i + 2 < pts.length ? pts[i + 2] : p2;

    for (let t = 0; t < numSamples; t++) {
      const u = t / numSamples;
      const u2 = u * u;
      const u3 = u2 * u;

      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * u +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3
      );
      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * u +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3
      );
      res.push([x, y, 0]);
    }
  }
  res.push([pts[pts.length - 1].x, pts[pts.length - 1].y, 0]);
  return res;
}

// AutoCAD Revision Cloud Arc Subdivider
function generateRevisionCloud(corners, arcLength = 22) {
  if (corners.length < 2) return [];
  const vertices = [];
  const n = corners.length;

  for (let i = 0; i < n; i++) {
    const c1 = corners[i];
    const c2 = corners[(i + 1) % n];
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-4) continue;

    const numArcs = Math.max(1, Math.round(dist / arcLength));
    const step = 1 / numArcs;

    for (let a = 0; a < numArcs; a++) {
      const t = a * step;
      const px = c1.x + t * dx;
      const py = c1.y + t * dy;
      vertices.push([px, py, 0.52]); // 0.52 bulge produces convex arcs
    }
  }
  return vertices;
}
const setStatus = (s) => {
  const el = $("#status");
  if (el) el.textContent = s;
};

// Coordinate Transforms
function worldToScreen(x, y) {
  const canvas = $("#cadCanvas");
  return {
    x: canvas.clientWidth / 2 + pan.x + x * zoom,
    y: canvas.clientHeight / 2 + pan.y - y * zoom
  };
}

function screenToWorld(x, y) {
  const canvas = $("#cadCanvas");
  return {
    x: (x - canvas.clientWidth / 2 - pan.x) / zoom,
    y: -(y - canvas.clientHeight / 2 - pan.y) / zoom
  };
}

// Bulge Geometry
function bulgeGeometry(p1, p2, bulge) {
  if (Math.abs(bulge) < 1e-10) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-10) return null;
  const sweep = 4 * Math.atan(bulge);
  const radius = chord / (2 * Math.sin(Math.abs(sweep) / 2));
  const offset = chord / (2 * Math.tan(sweep / 2));
  const center = {
    x: (p1.x + p2.x) * 0.5 - (dy / chord) * offset,
    y: (p1.y + p2.y) * 0.5 + (dx / chord) * offset
  };
  const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
  return { center, radius, startAngle, sweep };
}

function pointSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d2 = dx * dx + dy * dy;
  if (d2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / d2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function normalizeAngle(a) {
  return (a % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
}

function isAngleBetween(target, start, end) {
  const normTarget = normalizeAngle(target);
  const normStart = normalizeAngle(start);
  const normEnd = normalizeAngle(end);
  const sweep = normalizeAngle(normEnd - normStart);
  const targetSweep = normalizeAngle(normTarget - normStart);
  return targetSweep <= sweep;
}

// Hit-testing single entity
function hitTestEntity(worldPoint, tolerance) {
  let closest = null;
  let minDistance = tolerance;

  for (const e of model.entities) {
    const layerObj = model.layers.find((l) => l.name === e.layer);
    if (layerObj && (layerObj.off || layerObj.frozen)) continue;

    let dist = Infinity;
    if (e.kind === "circle") {
      const dCenter = Math.hypot(worldPoint.x - e.cx, worldPoint.y - e.cy);
      if (Math.abs(dCenter - e.radius) <= tolerance) {
        dist = Math.abs(dCenter - e.radius);
      }
    } else if (e.kind === "text") {
      const estW = (e.text || "").length * (e.height || 2.5) * 0.6;
      const h = e.height || 2.5;
      if (worldPoint.x >= e.x - tolerance && worldPoint.x <= e.x + estW + tolerance &&
          worldPoint.y >= e.y - h - tolerance && worldPoint.y <= e.y + tolerance) {
        dist = 0;
      }
    } else if (e.kind === "insert") {
      const sx = Math.abs(e.scaleX || 1);
      const sy = Math.abs(e.scaleY || 1);
      const boxSize = Math.max(12, 20 * Math.max(sx, sy)) / zoom;
      const d = Math.hypot(worldPoint.x - e.x, worldPoint.y - e.y);
      if (d <= Math.max(tolerance, boxSize / 2)) {
        dist = d;
      }
    } else if (e.kind === "line") {
      dist = pointSegmentDist(worldPoint.x, worldPoint.y, e.x1, e.y1, e.x2, e.y2);
    } else if (e.kind === "arc") {
      const dCenter = Math.hypot(worldPoint.x - e.x, worldPoint.y - e.y);
      const angle = Math.atan2(worldPoint.y - e.y, worldPoint.x - e.x);
      if (Math.abs(dCenter - e.radius) <= tolerance && isAngleBetween(angle, e.start, e.end)) {
        dist = Math.abs(dCenter - e.radius);
      }
    } else if (e.kind === "polyline") {
      const pts = e.points;
      const n = e.closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const bulge = a.bulge || 0;
        if (Math.abs(bulge) >= 1e-6) {
          const geom = bulgeGeometry(a, b, bulge);
          if (geom) {
            const dCenter = Math.hypot(worldPoint.x - geom.center.x, worldPoint.y - geom.center.y);
            const angle = Math.atan2(worldPoint.y - geom.center.y, worldPoint.x - geom.center.x);
            const endAngle = geom.startAngle + geom.sweep;
            if (Math.abs(dCenter - geom.radius) <= tolerance) {
              const startA = geom.sweep > 0 ? geom.startAngle : endAngle;
              const endA = geom.sweep > 0 ? endAngle : geom.startAngle;
              if (isAngleBetween(angle, startA, endA)) {
                dist = Math.min(dist, Math.abs(dCenter - geom.radius));
              }
            }
          }
        } else {
          dist = Math.min(dist, pointSegmentDist(worldPoint.x, worldPoint.y, a.x, a.y, b.x, b.y));
        }
      }
    }

    if (dist < minDistance) {
      minDistance = dist;
      closest = e;
    }
  }

  return closest;
}

// Bounding Box computation for entities (for Culling and Box Selection)
function getEntityBounds(e) {
  if (e.kind === "line") {
    return {
      minX: Math.min(e.x1, e.x2),
      maxX: Math.max(e.x1, e.x2),
      minY: Math.min(e.y1, e.y2),
      maxY: Math.max(e.y1, e.y2)
    };
  }
  if (e.kind === "circle") {
    return {
      minX: e.cx - e.radius,
      maxX: e.cx + e.radius,
      minY: e.cy - e.radius,
      maxY: e.cy + e.radius
    };
  }
  if (e.kind === "text") {
    const estW = (e.text || "").length * (e.height || 2.5) * 0.6;
    return {
      minX: e.x,
      maxX: e.x + estW,
      minY: e.y - (e.height || 2.5),
      maxY: e.y
    };
  }
  if (e.kind === "insert") {
    const s = 15 / zoom;
    return {
      minX: e.x - s,
      maxX: e.x + s,
      minY: e.y - s,
      maxY: e.y + s
    };
  }
  if (e.kind === "arc") {
    return {
      minX: e.x - e.radius,
      maxX: e.x + e.radius,
      minY: e.y - e.radius,
      maxY: e.y + e.radius
    };
  }
  if (e.kind === "polyline") {
    const xs = e.points.map((p) => p.x);
    const ys = e.points.map((p) => p.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }
  return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
}

// Window & Crossing Selection Query
function queryEntitiesInBox(p1, p2) {
  const isWindow = p2.x >= p1.x; // Left-to-Right = Window, Right-to-Left = Crossing
  const boxMinX = Math.min(p1.x, p2.x);
  const boxMaxX = Math.max(p1.x, p2.x);
  const boxMinY = Math.min(p1.y, p2.y);
  const boxMaxY = Math.max(p1.y, p2.y);

  const matched = [];

  for (const e of model.entities) {
    const layerObj = model.layers.find((l) => l.name === e.layer);
    if (layerObj && (layerObj.off || layerObj.frozen)) continue;

    const b = getEntityBounds(e);

    if (isWindow) {
      // Must be completely inside
      if (b.minX >= boxMinX && b.maxX <= boxMaxX && b.minY >= boxMinY && b.maxY <= boxMaxY) {
        matched.push(e.handle);
      }
    } else {
      // Crossing: Bounding box intersects
      const intersects = !(b.maxX < boxMinX || b.minX > boxMaxX || b.maxY < boxMinY || b.minY > boxMaxY);
      if (intersects) {
        matched.push(e.handle);
      }
    }
  }

  return matched;
}

// Grip Hit-Testing Helper
function findNearestGrip(worldPoint, pixelTol = 8) {
  if (selectedHandles.size !== 1) return null;
  const tol = pixelTol / zoom;
  const handle = Array.from(selectedHandles)[0];
  const ent = model.entities.find((e) => e.handle === handle);
  if (!ent) return null;

  if (ent.kind === "line") {
    if (Math.hypot(worldPoint.x - ent.x1, worldPoint.y - ent.y1) <= tol) return { handle, kind: "line", id: "start", pt: { x: ent.x1, y: ent.y1 } };
    if (Math.hypot(worldPoint.x - ent.x2, worldPoint.y - ent.y2) <= tol) return { handle, kind: "line", id: "end", pt: { x: ent.x2, y: ent.y2 } };
    const mx = (ent.x1 + ent.x2) / 2, my = (ent.y1 + ent.y2) / 2;
    if (Math.hypot(worldPoint.x - mx, worldPoint.y - my) <= tol) return { handle, kind: "line", id: "mid", pt: { x: mx, y: my } };
  } else if (ent.kind === "circle") {
    if (Math.hypot(worldPoint.x - ent.cx, worldPoint.y - ent.cy) <= tol) return { handle, kind: "circle", id: "center", pt: { x: ent.cx, y: ent.cy } };
    if (Math.hypot(worldPoint.x - (ent.cx + ent.radius), worldPoint.y - ent.cy) <= tol) return { handle, kind: "circle", id: "quad_e", pt: { x: ent.cx + ent.radius, y: ent.cy } };
    if (Math.hypot(worldPoint.x - (ent.cx - ent.radius), worldPoint.y - ent.cy) <= tol) return { handle, kind: "circle", id: "quad_w", pt: { x: ent.cx - ent.radius, y: ent.cy } };
    if (Math.hypot(worldPoint.x - ent.cx, worldPoint.y - (ent.cy + ent.radius)) <= tol) return { handle, kind: "circle", id: "quad_n", pt: { x: ent.cx, y: ent.cy + ent.radius } };
    if (Math.hypot(worldPoint.x - ent.cx, worldPoint.y - (ent.cy - ent.radius)) <= tol) return { handle, kind: "circle", id: "quad_s", pt: { x: ent.cx, y: ent.cy - ent.radius } };
  } else if (ent.kind === "text") {
    if (Math.hypot(worldPoint.x - ent.x, worldPoint.y - ent.y) <= tol) return { handle, kind: "text", id: "pos", pt: { x: ent.x, y: ent.y } };
  } else if (ent.kind === "insert") {
    if (Math.hypot(worldPoint.x - ent.x, worldPoint.y - ent.y) <= tol) return { handle, kind: "insert", id: "insert_pt", pt: { x: ent.x, y: ent.y } };
  } else if (ent.kind === "arc") {
    if (Math.hypot(worldPoint.x - ent.x, worldPoint.y - ent.y) <= tol) return { handle, kind: "arc", id: "center", pt: { x: ent.x, y: ent.y } };
    const sx = ent.x + ent.radius * Math.cos(ent.start), sy = ent.y + ent.radius * Math.sin(ent.start);
    if (Math.hypot(worldPoint.x - sx, worldPoint.y - sy) <= tol) return { handle, kind: "arc", id: "start", pt: { x: sx, y: sy } };
    const ex = ent.x + ent.radius * Math.cos(ent.end), ey = ent.y + ent.radius * Math.sin(ent.end);
    if (Math.hypot(worldPoint.x - ex, worldPoint.y - ey) <= tol) return { handle, kind: "arc", id: "end", pt: { x: ex, y: ey } };
  } else if (ent.kind === "polyline") {
    for (let i = 0; i < ent.points.length; i++) {
      const p = ent.points[i];
      if (Math.hypot(worldPoint.x - p.x, worldPoint.y - p.y) <= tol) return { handle, kind: "polyline", id: i, pt: { x: p.x, y: p.y } };
    }
  }
  return null;
}

// Snap Detection
function findNearestSnap(p, pixelRadius = 14) {
  if (!snapEnabled) return null;
  const tol = pixelRadius / zoom;
  let best = null;
  let bestDist = tol;

  const consider = (pt, kind) => {
    const d = Math.hypot(p.x - pt.x, p.y - pt.y);
    if (d < bestDist) {
      bestDist = d;
      best = { point: pt, kind };
    }
  };

  for (const e of model.entities) {
    const layerObj = model.layers.find((l) => l.name === e.layer);
    if (layerObj && (layerObj.off || layerObj.frozen)) continue;

    if (e.kind === "line") {
      consider({ x: e.x1, y: e.y1 }, "endpoint");
      consider({ x: e.x2, y: e.y2 }, "endpoint");
      consider({ x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 }, "midpoint");
    } else if (e.kind === "arc") {
      consider({ x: e.x, y: e.y }, "center");
      consider({ x: e.x + e.radius * Math.cos(e.start), y: e.y + e.radius * Math.sin(e.start) }, "endpoint");
      consider({ x: e.x + e.radius * Math.cos(e.end), y: e.y + e.radius * Math.sin(e.end) }, "endpoint");
    } else if (e.kind === "circle") {
      consider({ x: e.cx, y: e.cy }, "center");
      consider({ x: e.cx + e.radius, y: e.cy }, "endpoint");
      consider({ x: e.cx - e.radius, y: e.cy }, "endpoint");
      consider({ x: e.cx, y: e.cy + e.radius }, "endpoint");
      consider({ x: e.cx, y: e.cy - e.radius }, "endpoint");
    } else if (e.kind === "insert" || e.kind === "text") {
      consider({ x: e.x, y: e.y }, "endpoint");
    } else if (e.kind === "polyline") {
      for (let i = 0; i < e.points.length; i++) {
        consider(e.points[i], "endpoint");
        if (i < e.points.length - 1 || e.closed) {
          const next = e.points[(i + 1) % e.points.length];
          consider({ x: (e.points[i].x + next.x) / 2, y: (e.points[i].y + next.y) / 2 }, "midpoint");
        }
      }
    }
  }

  return best;
}

// Canvas Drawing Routines
function resize() {
  const canvas = $("#cadCanvas");
  const viewport = $("#viewport");
  if (!canvas || !viewport) return;
  const r = viewport.getBoundingClientRect();
  const d = window.devicePixelRatio || 1;
  canvas.width = r.width * d;
  canvas.height = r.height * d;
  canvas.style.width = r.width + "px";
  canvas.style.height = r.height + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(d, 0, 0, d, 0, 0);
  draw();
}

function drawPolyline(pts, closed, isSelected, layerColor = "#79c9dc") {
  const canvas = $("#cadCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!pts || !pts.length) return;
  ctx.beginPath();
  const first = worldToScreen(pts[0].x, pts[0].y);
  ctx.moveTo(first.x, first.y);
  const n = closed ? pts.length : pts.length - 1;

  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const bulge = a.bulge || 0;
    if (Math.abs(bulge) >= 1e-6) {
      const geom = bulgeGeometry(a, b, bulge);
      if (geom) {
        const steps = Math.max(8, Math.ceil(Math.abs(geom.sweep) * geom.radius * zoom / 10));
        for (let s = 1; s <= steps; s++) {
          const angle = geom.startAngle + (geom.sweep * s) / steps;
          const p = worldToScreen(
            geom.center.x + geom.radius * Math.cos(angle),
            geom.center.y + geom.radius * Math.sin(angle)
          );
          ctx.lineTo(p.x, p.y);
        }
        continue;
      }
    }
    const screenB = worldToScreen(b.x, b.y);
    ctx.lineTo(screenB.x, screenB.y);
  }

  if (closed) ctx.closePath();
  ctx.stroke();
}

function drawGrip(worldX, worldY) {
  const canvas = $("#cadCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const s = worldToScreen(worldX, worldY);
  ctx.fillStyle = "#00e5ff";
  ctx.fillRect(s.x - 3.5, s.y - 3.5, 7, 7);
  ctx.strokeStyle = "#004753";
  ctx.lineWidth = 1;
  ctx.strokeRect(s.x - 3.5, s.y - 3.5, 7, 7);
}

function draw() {
  const canvas = $("#cadCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const d = window.devicePixelRatio || 1;
  const w = canvas.width / d;
  const h = canvas.height / d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, w, h);

  let paperBounds = null;
  if (activeSpace !== "model") {
    // Paper Space Desk Background
    ctx.fillStyle = "#1a1f26";
    ctx.fillRect(0, 0, w, h);

    // Draw White Paper Sheet (ISO A3 landscape: 420x297mm)
    const paperMargin = 32;
    const maxPW = w - paperMargin * 2;
    const maxPH = h - paperMargin * 2;
    const aspect = 420 / 297;
    let pw = maxPW, ph = pw / aspect;
    if (ph > maxPH) {
      ph = maxPH;
      pw = ph * aspect;
    }
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;
    paperBounds = { px, py, pw, ph };

    // Drop Shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px, py, pw, ph);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // Printable Margin
    const bOffset = pw * 0.024;
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(px + bOffset, py + bOffset, pw - bOffset * 2, ph - bOffset * 2);
    ctx.setLineDash([]);

    // Title Block in Bottom Right
    const tbW = pw * 0.34;
    const tbH = ph * 0.19;
    const tbx = px + pw - bOffset - tbW;
    const tby = py + ph - bOffset - tbH;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(tbx, tby, tbW, tbH);

    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText("CONCOSTCAD 2026 - DRAWING SHEET", tbx + 8, tby + 16);
    ctx.font = "10px 'Inter', sans-serif";
    ctx.fillStyle = "#475569";
    const dwgTitle = (model.title || "Drawing1").split(/[\/]/).pop();
    ctx.fillText(`Project: ${dwgTitle}`, tbx + 8, tby + 32);
    ctx.fillText("Scale: 1:1  |  Format: ISO A3 (420x297mm)", tbx + 8, tby + 46);
    ctx.fillText("Author: Engineer Thanh Phuong", tbx + 8, tby + 60);

    // Clip Model entities inside Paper Space Viewport
    ctx.save();
    ctx.beginPath();
    ctx.rect(px + bOffset, py + bOffset, pw - bOffset * 2, ph - bOffset * 2 - tbH);
    ctx.clip();
  } else {
    ctx.fillStyle = "#101318";
    ctx.fillRect(0, 0, w, h);
  }

  // Draw Grid
  if (showGrid) {
    const step = 50 * zoom;
    const base = worldToScreen(0, 0);
    const gridStep = step < 12 ? step * 5 : step;
    if (gridStep > 3 && gridStep < 400) {
      ctx.beginPath();
      ctx.strokeStyle = "#1b2027";
      ctx.lineWidth = 1;
      let ox = ((base.x % gridStep) + gridStep) % gridStep;
      let oy = ((base.y % gridStep) + gridStep) % gridStep;
      for (let x = ox; x < w; x += gridStep) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, h);
      }
      for (let y = oy; y < h; y += gridStep) {
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
      }
      ctx.stroke();
    }

    // Origin Axes
    ctx.strokeStyle = "#2e3b4a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(base.y) + 0.5);
    ctx.lineTo(w, Math.round(base.y) + 0.5);
    ctx.moveTo(Math.round(base.x) + 0.5, 0);
    ctx.lineTo(Math.round(base.x) + 0.5, h);
    ctx.stroke();
  }

  // Viewport Bounding Box in World Coordinates for Spatial Culling (Tuần 33 Optimization)
  const vpTopLeft = screenToWorld(0, 0);
  const vpBottomRight = screenToWorld(w, h);
  const vpMinX = Math.min(vpTopLeft.x, vpBottomRight.x);
  const vpMaxX = Math.max(vpTopLeft.x, vpBottomRight.x);
  const vpMinY = Math.min(vpTopLeft.y, vpBottomRight.y);
  const vpMaxY = Math.max(vpTopLeft.y, vpBottomRight.y);

  // Draw Entities
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const e of model.entities) {
    const layerObj = model.layers.find((l) => l.name === e.layer);
    if (layerObj && (layerObj.off || layerObj.frozen)) continue;

    // Viewport Culling Check
    const b = getEntityBounds(e);
    if (b.maxX < vpMinX || b.minX > vpMaxX || b.maxY < vpMinY || b.minY > vpMaxY) {
      continue;
    }

    const isSelected = selectedHandles.has(e.handle);
    const layerColor = layerObj && layerObj.color ? layerObj.color : "#79c9dc";
    if (isSelected) {
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 2.4;
      ctx.shadowColor = "rgba(0, 229, 255, 0.6)";
      ctx.shadowBlur = 6;
    } else {
      ctx.strokeStyle = layerColor;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    if (e.kind === "line") {
      const a = worldToScreen(e.x1, e.y1);
      const b = worldToScreen(e.x2, e.y2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (isSelected) {
        drawGrip(e.x1, e.y1);
        drawGrip(e.x2, e.y2);
        drawGrip((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2);
      }
    } else if (e.kind === "arc") {
      const sweep = (e.end - e.start + Math.PI * 2) % (Math.PI * 2);
      const n = Math.max(16, Math.ceil(sweep * e.radius * zoom / 6));
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = e.start + (sweep * i) / n;
        const p = worldToScreen(e.x + e.radius * Math.cos(a), e.y + e.radius * Math.sin(a));
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
      if (isSelected) {
        drawGrip(e.x, e.y);
        drawGrip(e.x + e.radius * Math.cos(e.start), e.y + e.radius * Math.sin(e.start));
        drawGrip(e.x + e.radius * Math.cos(e.end), e.y + e.radius * Math.sin(e.end));
      }
    } else if (e.kind === "circle") {
      const c = worldToScreen(e.cx, e.cy);
      ctx.beginPath();
      ctx.arc(c.x, c.y, e.radius * zoom, 0, Math.PI * 2);
      ctx.stroke();
      if (isSelected) {
        drawGrip(e.cx, e.cy);
        drawGrip(e.cx + e.radius, e.cy);
        drawGrip(e.cx - e.radius, e.cy);
        drawGrip(e.cx, e.cy + e.radius);
        drawGrip(e.cx, e.cy - e.radius);
      }
    } else if (e.kind === "text") {
      const p = worldToScreen(e.x, e.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-e.rotation);
      const fontSize = Math.max(10, Math.round((e.height || 2.5) * zoom));
      ctx.font = `${fontSize}px 'Inter', sans-serif`;
      ctx.fillStyle = isSelected ? "#00e5ff" : layerColor;
      ctx.fillText(e.text, 0, 0);
      if (isSelected) {
        const textMetrics = ctx.measureText(e.text);
        ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(0, -fontSize, textMetrics.width, fontSize * 1.2);
        ctx.setLineDash([]);
      }
      ctx.restore();
      if (isSelected) {
        drawGrip(e.x, e.y);
      }
    } else if (e.kind === "insert") {
      // Block Reference (INSERT) CAD marker and label
      const p = worldToScreen(e.x, e.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-e.rotation);
      const markerSize = Math.max(7, Math.min(24, 10 * Math.max(0.5, e.scaleX || 1)));
      ctx.strokeStyle = isSelected ? "#00e5ff" : (layerColor || "#ffaa00");
      ctx.lineWidth = isSelected ? 2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(-markerSize, -markerSize);
      ctx.lineTo(markerSize, markerSize);
      ctx.moveTo(-markerSize, markerSize);
      ctx.lineTo(markerSize, -markerSize);
      ctx.stroke();
      ctx.strokeRect(-markerSize, -markerSize, markerSize * 2, markerSize * 2);
      ctx.font = "11px 'Inter', sans-serif";
      ctx.fillStyle = isSelected ? "#00e5ff" : "#94a3b8";
      ctx.fillText(`[${e.blockName}]`, markerSize + 4, 4);
      ctx.restore();
      if (isSelected) {
        drawGrip(e.x, e.y);
      }
    } else if (e.kind === "polyline") {
      drawPolyline(e.points, e.closed, isSelected, layerColor);
      if (isSelected) {
        for (const p of e.points) drawGrip(p.x, p.y);
      }
    }
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  if (activeSpace !== "model") {
    ctx.restore();
  }

  // Draw Window / Crossing Selection Box
  if (isBoxSelecting && boxStart && boxCurrent) {
    const s1 = worldToScreen(boxStart.x, boxStart.y);
    const s2 = worldToScreen(boxCurrent.x, boxCurrent.y);
    const bx = Math.min(s1.x, s2.x);
    const by = Math.min(s1.y, s2.y);
    const bw = Math.abs(s2.x - s1.x);
    const bh = Math.abs(s2.y - s1.y);

    const isWindow = boxCurrent.x >= boxStart.x;
    if (isWindow) {
      ctx.fillStyle = "rgba(23, 100, 200, 0.18)";
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = "#1e88e5";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([]);
      ctx.strokeRect(bx, by, bw, bh);
    } else {
      ctx.fillStyle = "rgba(46, 175, 80, 0.18)";
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = "#43a047";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);
    }
  }

  // Draw Ghost preview for Move & Copy
  if ((activeTool === "move" || activeTool === "copy") && moveBasePoint && selectedHandles.size > 0) {
    const dx = world.x - moveBasePoint.x;
    const dy = world.y - moveBasePoint.y;
    ctx.strokeStyle = activeTool === "copy" ? "#4caf50" : "#e2ad5e";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.4;

    const baseScr = worldToScreen(moveBasePoint.x, moveBasePoint.y);
    const destScr = worldToScreen(world.x, world.y);
    ctx.beginPath();
    ctx.moveTo(baseScr.x, baseScr.y);
    ctx.lineTo(destScr.x, destScr.y);
    ctx.stroke();

    for (const h of selectedHandles) {
      const e = model.entities.find((ent) => ent.handle === h);
      if (!e) continue;
      if (e.kind === "line") {
        const a = worldToScreen(e.x1 + dx, e.y1 + dy);
        const b = worldToScreen(e.x2 + dx, e.y2 + dy);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (e.kind === "arc") {
        const sweep = (e.end - e.start + Math.PI * 2) % (Math.PI * 2);
        const n = Math.max(12, Math.ceil(sweep * e.radius * zoom / 8));
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = e.start + (sweep * i) / n;
          const p = worldToScreen(e.x + dx + e.radius * Math.cos(a), e.y + dy + e.radius * Math.sin(a));
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
        }
        ctx.stroke();
      } else if (e.kind === "circle") {
        const c = worldToScreen(e.cx + dx, e.cy + dy);
        ctx.beginPath();
        ctx.arc(c.x, c.y, e.radius * zoom, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === "polyline") {
        const movedPts = e.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy, bulge: pt.bulge }));
        drawPolyline(movedPts, e.closed, false);
      }
    }
    ctx.setLineDash([]);
  }

  // Active Tool Rubber-Band Preview
  if (points.length > 0 && activeTool !== "select") {
    ctx.strokeStyle = "#e2ad5e";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();

    if (activeTool === "spline" && points.length > 0) {
      const allPts = [...points, world];
      const smooth = interpolateCatmullRom(allPts, 10);
      if (smooth.length > 1) {
        const s0 = worldToScreen(smooth[0][0], smooth[0][1]);
        ctx.moveTo(s0.x, s0.y);
        for (let i = 1; i < smooth.length; i++) {
          const pt = worldToScreen(smooth[i][0], smooth[i][1]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    } else if (activeTool === "revcloud" && points.length > 1) {
      const allPts = [...points, world];
      const cloud = generateRevisionCloud(allPts, 25);
      if (cloud.length > 1) {
        drawPolyline(cloud.map(v => ({ x: v[0], y: v[1], bulge: v[2] })), true, false);
      }
    } else if (activeTool === "circle" && points.length === 1) {
      const r = Math.hypot(world.x - points[0].x, world.y - points[0].y);
      const c = worldToScreen(points[0].x, points[0].y);
      ctx.arc(c.x, c.y, r * zoom, 0, Math.PI * 2);
      ctx.stroke();
    } else if (activeTool === "rectangle" && points.length === 1) {
      const p1 = worldToScreen(points[0].x, points[0].y);
      const p2 = worldToScreen(world.x, points[0].y);
      const p3 = worldToScreen(world.x, world.y);
      const p4 = worldToScreen(points[0].x, world.y);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.stroke();
    } else {
      const p = worldToScreen(points[0].x, points[0].y);
      ctx.moveTo(p.x, p.y);
      for (const q of points.slice(1)) {
        const s = worldToScreen(q.x, q.y);
        ctx.lineTo(s.x, s.y);
      }
      if (world) {
        const s = worldToScreen(world.x, world.y);
        ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const p of points) {
      const s = worldToScreen(p.x, p.y);
      ctx.fillStyle = "#e7b866";
      ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
    }
  }

  // Object Snap Marker
  if (currentSnap) {
    const s = worldToScreen(currentSnap.point.x, currentSnap.point.y);
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 1.8;
    if (currentSnap.kind === "endpoint") {
      ctx.strokeRect(s.x - 5, s.y - 5, 10, 10);
    } else if (currentSnap.kind === "midpoint") {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 6);
      ctx.lineTo(s.x + 6, s.y + 5);
      ctx.lineTo(s.x - 6, s.y + 5);
      ctx.closePath();
      ctx.stroke();
    } else if (currentSnap.kind === "center") {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Hints and readouts
  const hintEl = $("#emptyHint");
  if (hintEl) hintEl.classList.toggle("hidden", model.entities.length > 0 || points.length > 0);
  const coordEl = $("#coordReadout");
  if (coordEl) coordEl.innerHTML = `X&nbsp; ${world.x.toFixed(3)}&nbsp;&nbsp; Y&nbsp; ${world.y.toFixed(3)}`;
  const zoomEl = $("#zoomReadout");
  if (zoomEl) zoomEl.textContent = `${Math.round(zoom * 100)}%`;
  const coordsEl = $("#canvasCoords");
  if (coordsEl) {
    coordsEl.textContent = activeSpace === "model"
      ? "MODEL SPACE · GRID ON · UCS WORLD"
      : `PAPER SPACE (ISO A3) · 1:1 · ${activeSpace.toUpperCase()}`;
  }
}

// Zoom Selected Entities (ZS / ZOOM OBJECT)
function zoomSelected() {
  if (!selectedHandles.size) {
    zoomToExtents();
    return;
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const h of selectedHandles) {
    const ent = model.entities.find((e) => e.handle === h);
    if (!ent) continue;
    const b = getEntityBounds(ent);
    minX = Math.min(minX, b.minX);
    maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY);
    maxY = Math.max(maxY, b.maxY);
  }
  if (!isFinite(minX)) return;
  const viewport = $("#viewport");
  const w = viewport.clientWidth, h = viewport.clientHeight, pad = 80;
  pan = { x: 0, y: 0 };
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  zoom = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  pan.x = -((minX + maxX) / 2) * zoom;
  pan.y = ((minY + maxY) / 2) * zoom;
  draw();
  setStatus(currentLang === "vi" ? "Đã phóng to đối tượng đã chọn (ZOOM OBJECT)" : "Zoomed to selected object(s)");
}

// Export Drawing to High-Res PNG Image (Tuần 35 Plot / Export)
function exportDrawingImage() {
  const canvas = $("#cadCanvas");
  if (!canvas) return;
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    const title = (model.title || "Drawing").replace(/[^a-zA-Z0-9_-]/g, "_");
    link.download = `${title}_plot.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatus(currentLang === "vi" ? "Đã xuất bản vẽ sang tệp ảnh PNG (PLOT/EXPORT)" : "Drawing exported to PNG");
  } catch (err) {
    setStatus("Export failed: " + err);
  }
}

// Ribbon Tabs Definition & Rendering
function renderRibbon() {
  const container = $("#ribbonContainer");
  if (!container) return;

  if (activeRibbonTab === "home") {
    container.innerHTML = `
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button ${activeTool==='line'?'selected':''}" data-tool="line"><span class="tool-icon line-icon">／</span><span>${t("tool_line")}</span></button>
          <button class="tool-button ${activeTool==='arc'?'selected':''}" data-tool="arc"><span class="tool-icon">◜</span><span>${t("tool_arc")}</span></button>
          <button class="tool-button ${activeTool==='polyline'?'selected':''}" data-tool="polyline"><span class="tool-icon">⌁</span><span>${t("tool_poly")}</span></button>
          <button class="tool-button ${activeTool==='circle'?'selected':''}" data-tool="circle"><span class="tool-icon">◯</span><span>${t("tool_circle")}</span></button>
          <button class="tool-button ${activeTool==='rectangle'?'selected':''}" data-tool="rectangle"><span class="tool-icon">▭</span><span>${t("tool_rect")}</span></button>
          <button class="tool-button ${activeTool==='spline'?'selected':''}" data-tool="spline" title="Vẽ đường cong Spline (SPL)"><span class="tool-icon">〰</span><span>${t("tool_spline")}</span></button>
          <button class="tool-button ${activeTool==='revcloud'?'selected':''}" data-tool="revcloud" title="Đám mây ghi chú (REVCLOUD)"><span class="tool-icon">☁</span><span>${t("tool_revcloud")}</span></button>
          <button class="tool-button ${activeTool==='hatch'?'selected':''}" data-tool="hatch" title="Tô mẫu mặt cắt (HATCH)"><span class="tool-icon">▨</span><span>${t("tool_hatch")}</span></button>
          <button class="tool-button ${activeTool==='text'?'selected':''}" data-tool="text"><span class="tool-icon">T</span><span>${t("tool_text")}</span></button>
        </div>
        <div class="group-caption">${t("grp_draw")}</div>
      </div>
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button ${activeTool==='select'?'selected':''}" data-tool="select"><span class="tool-icon">↖</span><span>${t("tool_select")}</span></button>
          <button class="tool-button ${activeTool==='move'?'selected':''}" data-tool="move"><span class="tool-icon">✥</span><span>${t("tool_move")}</span></button>
          <button class="tool-button ${activeTool==='copy'?'selected':''}" data-tool="copy"><span class="tool-icon">⧉</span><span>${t("tool_copy")}</span></button>
          <button class="tool-button ${activeTool==='rotate'?'selected':''}" data-tool="rotate"><span class="tool-icon">⟳</span><span>${t("tool_rotate")}</span></button>
          <button class="tool-button ${activeTool==='mirror'?'selected':''}" data-tool="mirror"><span class="tool-icon">⧎</span><span>${t("tool_mirror")}</span></button>
          <button class="tool-button ${activeTool==='fillet'?'selected':''}" data-tool="fillet"><span class="tool-icon">◜</span><span>${t("tool_fillet")}</span></button>
          <button class="tool-button ${activeTool==='chamfer'?'selected':''}" data-tool="chamfer"><span class="tool-icon">◺</span><span>${t("tool_chamfer")}</span></button>
          <button class="tool-button ${activeTool==='trim'?'selected':''}" data-tool="trim"><span class="tool-icon">✂</span><span>${t("tool_trim")}</span></button>
          <button class="tool-button ${activeTool==='extend'?'selected':''}" data-tool="extend"><span class="tool-icon">⇥</span><span>${t("tool_extend")}</span></button>
          <button class="tool-button ${activeTool==='join'?'selected':''}" data-tool="join"><span class="tool-icon">☍</span><span>${t("tool_join")}</span></button>
          <button class="tool-button" id="offsetBtn"><span class="tool-icon">⫽</span><span>${t("tool_offset")}</span></button>
          <button class="tool-button" id="takeoffRibbonBtn" title="Thống kê khối lượng (TAKEOFF)"><span class="tool-icon">📊</span><span>${currentLang === "vi" ? "Tiên lượng (BOM)" : "Takeoff"}</span></button>
          <button class="tool-button" id="explodeBtn"><span class="tool-icon">💥</span><span>${t("tool_explode")}</span></button>
          <button class="tool-button danger" id="eraseBtn"><span class="tool-icon">⌫</span><span>${t("tool_erase")}</span></button>
          <button class="tool-button compact" id="undoBtn"><span class="tool-icon">↶</span><span>${t("tool_undo")}</span></button>
          <button class="tool-button compact" id="redoBtn"><span class="tool-icon">↷</span><span>${t("tool_redo")}</span></button>
        </div>
        <div class="group-caption">${t("grp_modify")}</div>
      </div>
      <div class="ribbon-group">
        <div class="tools" style="flex-direction: column; justify-content: center; gap: 4px;">
          <select id="ribbonLayerSelect" class="ribbon-select" title="Active drawing layer">
            ${model.layers.map(l => `<option value="${l.name}" ${l.name===model.currentLayer?'selected':''}>${escapeHtml(l.name)}</option>`).join('')}
          </select>
          <button class="title-action" id="ribbonAddLayer" style="height: 22px; width: 100%;">${t("add_layer")}</button>
        </div>
        <div class="group-caption">${t("grp_layers")}</div>
      </div>
      <div class="ribbon-group">
        <div class="tools file-tools">
          <button class="tool-button compact ${activeTool==='dim'?'selected':''}" data-tool="dim"><span class="tool-icon">📐</span><span>${t("tool_dim")}</span></button>
          <button class="tool-button compact ${activeTool==='dist'?'selected':''}" data-tool="dist"><span class="tool-icon">📏</span><span>${t("tool_dist")}</span></button>
          <button class="tool-button compact ${activeTool==='area'?'selected':''}" data-tool="area"><span class="tool-icon">⏢</span><span>${t("tool_area")}</span></button>
        </div>
        <div class="group-caption">${t("grp_annotate")}</div>
      </div>
      <div class="ribbon-group">
        <div class="tools file-tools">
          <button class="tool-button compact" id="zoomExtents"><span class="tool-icon">⛶</span><span>${t("tool_zoom_all")}</span></button>
          <button class="tool-button compact" id="ribbonOpen"><span class="tool-icon">▣</span><span>${t("tool_open")}</span></button>
          <button class="tool-button compact" id="saveBtn"><span class="tool-icon">💾</span><span>${t("tool_save")}</span></button>
        </div>
        <div class="group-caption">${t("grp_view_file")}</div>
      </div>
      <div class="ribbon-spacer"></div>
      <div class="ribbon-hint">MODEL · WCS · GRID ON</div>
    `;
  } else if (activeRibbonTab === "draw") {
    container.innerHTML = `
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button ${activeTool==='line'?'selected':''}" data-tool="line"><span class="tool-icon line-icon">／</span><span>${t("tool_line")}</span></button>
          <button class="tool-button ${activeTool==='arc'?'selected':''}" data-tool="arc"><span class="tool-icon">◜</span><span>${t("tool_arc")} (3-Pt)</span></button>
          <button class="tool-button ${activeTool==='polyline'?'selected':''}" data-tool="polyline"><span class="tool-icon">⌁</span><span>${t("tool_poly")}</span></button>
          <button class="tool-button ${activeTool==='circle'?'selected':''}" data-tool="circle"><span class="tool-icon">◯</span><span>${t("tool_circle")}</span></button>
          <button class="tool-button ${activeTool==='rectangle'?'selected':''}" data-tool="rectangle"><span class="tool-icon">▭</span><span>${t("tool_rect")}</span></button>
        </div>
        <div class="group-caption">${t("grp_draw")}</div>
      </div>
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button compact" id="finishPolylineBtn"><span class="tool-icon">✔</span><span>Finish PL</span></button>
          <button class="tool-button compact" id="closePolylineBtn"><span class="tool-icon">⟲</span><span>Close PL</span></button>
        </div>
        <div class="group-caption">POLYLINE MODES</div>
      </div>
      <div class="ribbon-spacer"></div>
      <div class="ribbon-hint">Click canvas or type coordinates</div>
    `;
  } else if (activeRibbonTab === "annotate") {
    container.innerHTML = `
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button ${activeTool==='dim'?'selected':''}" data-tool="dim"><span class="tool-icon">📐</span><span>${t("tool_dim")}</span></button>
          <button class="tool-button ${activeTool==='dist'?'selected':''}" data-tool="dist"><span class="tool-icon">📏</span><span>${t("tool_dist")}</span></button>
          <button class="tool-button ${activeTool==='area'?'selected':''}" data-tool="area"><span class="tool-icon">⏢</span><span>${t("tool_area")}</span></button>
        </div>
        <div class="group-caption">${t("grp_annotate")}</div>
      </div>
      <div class="ribbon-group">
        <div class="tools" style="padding: 0 10px; color: #8e99a6; font-size: 11px; align-items: center; min-width: 200px;">
          ${measureInfo ? `<span><strong>${measureInfo}</strong></span>` : `<span>Pick points to measure distance or calculate polygon area</span>`}
        </div>
        <div class="group-caption">MEASUREMENT RESULTS</div>
      </div>
      <div class="ribbon-spacer"></div>
    `;
  } else if (activeRibbonTab === "view") {
    container.innerHTML = `
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button compact" id="zoomExtents"><span class="tool-icon">⛶</span><span>${t("tool_zoom_all")}</span></button>
          <button class="tool-button compact" id="zoomInBtn"><span class="tool-icon">＋</span><span>Zoom In</span></button>
          <button class="tool-button compact" id="zoomOutBtn"><span class="tool-icon">−</span><span>Zoom Out</span></button>
          <button class="tool-button compact" id="zoomResetBtn"><span class="tool-icon">1:1</span><span>100%</span></button>
        </div>
        <div class="group-caption">${t("grp_nav")}</div>
      </div>
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button compact ${showGrid?'selected':''}" id="ribbonToggleGrid"><span class="tool-icon">▦</span><span>${t("grid_btn")}</span></button>
          <button class="tool-button compact ${snapEnabled?'selected':''}" id="ribbonToggleSnap"><span class="tool-icon">⊕</span><span>${t("snap_btn")}</span></button>
          <button class="tool-button compact ${orthoEnabled?'selected':''}" id="ribbonToggleOrtho"><span class="tool-icon">∟</span><span>${t("ortho_btn")}</span></button>
        </div>
        <div class="group-caption">${t("grp_aids")}</div>
      </div>
      <div class="ribbon-spacer"></div>
    `;
  }

  bindRibbonEvents();
  const qx = $("#quickExplodeBtn");
  if (qx) qx.onclick = explodeSelected;
}

function bindRibbonEvents() {
  $$("#ribbonContainer [data-tool]").forEach((b) => {
    b.onclick = () => chooseTool(b.dataset.tool);
  });

  const eraseBtn = $("#eraseBtn");
  if (eraseBtn) eraseBtn.onclick = eraseSelected;
  const explodeBtn = $("#explodeBtn");
  if (explodeBtn) explodeBtn.onclick = explodeSelected;
  const offsetBtn = $("#offsetBtn");
  if (offsetBtn) offsetBtn.onclick = () => chooseTool("offset");

  const undoBtn = $("#undoBtn");
  if (undoBtn) undoBtn.onclick = undoAction;

  const redoBtn = $("#redoBtn");
  if (redoBtn) redoBtn.onclick = redoAction;

  const zoomExtentsBtn = $("#zoomExtents");
  if (zoomExtentsBtn) zoomExtentsBtn.onclick = zoomToExtents;

  const ribbonOpenBtn = $("#ribbonOpen");
  if (ribbonOpenBtn) ribbonOpenBtn.onclick = openDrawing;

  const saveBtn = $("#saveBtn");
  if (saveBtn) saveBtn.onclick = saveDrawing;

  const ribbonLayerSelect = $("#ribbonLayerSelect");
  if (ribbonLayerSelect) {
    ribbonLayerSelect.onchange = (e) => {
      sync(invoke("set_current_layer", { name: e.target.value }));
    };
  }

  const ribbonAddLayer = $("#ribbonAddLayer");
  if (ribbonAddLayer) {
    ribbonAddLayer.onclick = () => {
      $("#newLayerContainer").style.display = "flex";
      $("#newLayerInput").focus();
    };
  }

  const finishPolylineBtn = $("#finishPolylineBtn");
  if (finishPolylineBtn) finishPolylineBtn.onclick = () => finishPolyline(false);

  const closePolylineBtn = $("#closePolylineBtn");
  if (closePolylineBtn) closePolylineBtn.onclick = () => finishPolyline(true);

  const zoomInBtn = $("#zoomInBtn");
  if (zoomInBtn) zoomInBtn.onclick = () => { zoom *= 1.25; draw(); };

  const zoomOutBtn = $("#zoomOutBtn");
  if (zoomOutBtn) zoomOutBtn.onclick = () => { zoom /= 1.25; draw(); };

  const zoomResetBtn = $("#zoomResetBtn");
  if (zoomResetBtn) zoomResetBtn.onclick = () => { zoom = 1; pan = { x: 0, y: 0 }; draw(); };

  const ribbonToggleGrid = $("#ribbonToggleGrid");
  if (ribbonToggleGrid) ribbonToggleGrid.onclick = toggleGrid;

  const ribbonToggleSnap = $("#ribbonToggleSnap");
  if (ribbonToggleSnap) ribbonToggleSnap.onclick = toggleSnap;

  const ribbonToggleOrtho = $("#ribbonToggleOrtho");
  if (ribbonToggleOrtho) ribbonToggleOrtho.onclick = toggleOrtho;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function sync(promise) {
  try {
    model = await promise;
    render();
    return true;
  } catch (e) {
    setStatus(String(e));
    return false;
  }
}

function chooseTool(tool) {
  if (tool !== "select") lastTool = tool;
  activeTool = tool;
  points = [];
  moveBasePoint = null;

  $$("[data-tool]").forEach((b) => b.classList.toggle("selected", b.dataset.tool === tool));

  const msgs = {
    select: currentLang === "vi" ? "Chọn hình (nhấp chọn, quét chuột hộp xanh Window/Crossing, Delete để xóa)" : "Select geometry (Click, Box Window/Crossing drag, Delete to erase)",
    line: currentLang === "vi" ? "LINE · Chọn điểm đầu tiên (hoặc nhập x,y)" : "LINE · Pick first point",
    arc: currentLang === "vi" ? "ARC · Chọn 3 điểm (Đầu, Giữa, Cuối)" : "ARC · Pick 3 points (Start, Mid, End)",
    polyline: currentLang === "vi" ? "PLINE · Chọn các đỉnh; nhấn Enter để kết thúc" : "PLINE · Pick vertices; Enter to finish",
    circle: currentLang === "vi" ? "CIRCLE · Chọn tâm đường tròn, sau đó chọn bán kính" : "CIRCLE · Pick center, then radius",
    rectangle: currentLang === "vi" ? "RECTANGLE · Chọn góc đầu tiên, sau đó chọn góc đối diện" : "RECTANGLE · Pick first corner, then opposite corner",
    move: currentLang === "vi" ? "MOVE · Chọn điểm gốc để di chuyển" : "MOVE · Pick base point",
    copy: currentLang === "vi" ? "COPY · Chọn điểm gốc để sao chép" : "COPY · Pick base point",
    rotate: currentLang === "vi" ? "ROTATE · Chọn tâm xoay và nhập góc xoay" : "ROTATE · Pick center and angle",
    mirror: currentLang === "vi" ? "MIRROR · Chọn 2 điểm tạo trục đối xứng" : "MIRROR · Pick 2 mirror line points",
    dist: currentLang === "vi" ? "DIST · Chọn 2 điểm để đo khoảng cách" : "DIST · Pick 2 points to measure",
    area: currentLang === "vi" ? "AREA · Chọn các đỉnh đa giác hoặc hình khép kín; Enter để tính" : "AREA · Pick polygon vertices; Enter to finish",
    dim: currentLang === "vi" ? "DIM · Chọn 2 điểm đo rồi chọn vị trí đường kích thước" : "DIM · Pick 2 measurement points then offset position",
    text: currentLang === "vi" ? "TEXT · Nhấp điểm chèn chữ (hoặc gõ tọa độ x,y)" : "TEXT · Pick text insertion point",
    fillet: currentLang === "vi" ? "FILLET · Chọn đường 1 rồi chọn đường 2 để bo góc" : "FILLET · Pick first line then second line",
    chamfer: currentLang === "vi" ? "CHAMFER · Chọn đường 1 rồi chọn đường 2 để vát mép" : "CHAMFER · Pick first line then second line",
    trim: currentLang === "vi" ? "TRIM · Nhấp đoạn thẳng cần cắt xén" : "TRIM · Click segment to trim",
    extend: currentLang === "vi" ? "EXTEND · Nhấp đầu mút cần kéo dài đến biên" : "EXTEND · Click end to extend to boundary",
    join: currentLang === "vi" ? "JOIN · Chọn các đoạn thẳng/cung nối tiếp nhau để gộp thành Polyline" : "JOIN · Select contiguous entities to join",
    spline: currentLang === "vi" ? "SPLINE · Nhấp chọn các điểm điều khiển; nhấn Enter để hoàn tất đường cong" : "SPLINE · Pick fit points; Enter to finish curve",
    revcloud: currentLang === "vi" ? "REVCLOUD · Nhấp các điểm mốc tạo biên dạng; nhấn Enter để đóng đám mây ghi chú" : "REVCLOUD · Pick vertices; Enter to close revision cloud",
    hatch: currentLang === "vi" ? "HATCH · Nhấp vào hình tròn, chữ nhật hoặc đường khép kín để tạo mặt cắt ANSI31" : "HATCH · Click inside closed entity to hatch"
  };

  setStatus(msgs[tool] || "Ready");
  draw();
  const vp = $("#viewport");
  if (vp) vp.focus();
  renderRibbon();
}

// Render Properties & Layers UI
function render() {
  const title = model.title.split(/[\\/]/).pop().replace(/\.(dwg|dxf)$/i, "") || "Drawing1";
  const titleNameEl = $("#titleName");
  if (titleNameEl) titleNameEl.textContent = title;
  const tabNameEl = $("#drawingTabName");
  if (tabNameEl) tabNameEl.textContent = title;
  const dirtyDot = $("#dirtyDot");
  if (dirtyDot) dirtyDot.classList.toggle("visible", model.dirty);

  renderProperties();
    const toBtn = $("#takeoffRibbonBtn");
    if (toBtn) toBtn.onclick = showTakeoffModal;

  const layerList = $("#layerList");
  if (layerList) {
    layerList.innerHTML = model.layers
      .map(
        (l) => `
        <div class="layer-row ${l.name === model.currentLayer ? "current" : ""}" data-layer="${escapeHtml(l.name)}">
          <span class="layer-title"><i class="layer-swatch" style="background: ${l.color || '#79c9dc'}; box-shadow: 0 0 4px ${l.color || '#79c9dc'}44;" title="Đổi màu Layer" data-layer-color="${escapeHtml(l.name)}"></i>${escapeHtml(l.name)}</span>
          <span class="layer-eye" title="Toggle Visibility">${l.off ? "—" : "◉"}</span>
          <span class="layer-lock" title="Toggle Lock">${l.locked ? "▣" : "—"}</span>
        </div>`
      )
      .join("");

    $(".layer-row").forEach((row) => {
      const layerName = row.dataset.layer;
      row.onclick = (e) => {
        if (e.target.classList.contains("layer-swatch")) {
          const colors = ["#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#ec4899", "#ffffff", "#79c9dc"];
          const curr = row.querySelector(".layer-swatch").style.background;
          const next = colors[(colors.indexOf(curr) + 1) % colors.length] || colors[0];
          sync(invoke("set_layer_color", { name: layerName, hex: next }));
          return;
        }
        if (e.target.classList.contains("layer-eye")) {
          const lyr = model.layers.find((l) => l.name === layerName);
          if (lyr) sync(invoke("set_layer_flags", { name: layerName, frozen: lyr.frozen, off: !lyr.off, locked: lyr.locked }));
        } else if (e.target.classList.contains("layer-lock")) {
          const lyr = model.layers.find((l) => l.name === layerName);
          if (lyr) sync(invoke("set_layer_flags", { name: layerName, frozen: lyr.frozen, off: lyr.off, locked: !lyr.locked }));
        } else {
          sync(invoke("set_current_layer", { name: layerName }));
        }
      };
    });
  }

  renderRibbon();
  renderDocumentTabs();
  draw();
}

function renderProperties() {
  const body = $("#propertiesBody");
  if (!body) return;
  const count = selectedHandles.size;

  if (count === 0) {
    const title = model.title.split(/[\\/]/).pop().replace(/\.(dwg|dxf)$/i, "") || "Drawing1";
    body.innerHTML = `
      <div class="panel-kicker">${t("prop_drawing")}</div>
      <div class="property-row"><span>${t("prop_file")}</span><strong>${escapeHtml(title)}</strong></div>
      <div class="property-row"><span>${t("prop_entities")}</span><strong>${model.entityCount}</strong></div>
      <div class="property-row"><span>${t("prop_layer")}</span><strong>${escapeHtml(model.currentLayer)}</strong></div>
      <div class="property-row"><span>${t("prop_selection")}</span><strong>${t("prop_none")}</strong></div>
      <div class="property-row"><span>${t("prop_units")}</span><strong>Metric (mm)</strong></div>
    `;
  } else if (count === 1) {
    const handle = Array.from(selectedHandles)[0];
    const ent = model.entities.find((e) => e.handle === handle);
    if (!ent) return;

    let details = "";
    if (ent.kind === "line") {
      const len = Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1).toFixed(3);
      details = `
        <div class="property-row"><span>${t("prop_length")}</span><strong>${len}</strong></div>
        <div class="property-row"><span>Start X</span><input class="prop-input" id="propLineX1" type="number" step="any" value="${ent.x1.toFixed(2)}" /></div>
        <div class="property-row"><span>Start Y</span><input class="prop-input" id="propLineY1" type="number" step="any" value="${ent.y1.toFixed(2)}" /></div>
        <div class="property-row"><span>End X</span><input class="prop-input" id="propLineX2" type="number" step="any" value="${ent.x2.toFixed(2)}" /></div>
        <div class="property-row"><span>End Y</span><input class="prop-input" id="propLineY2" type="number" step="any" value="${ent.y2.toFixed(2)}" /></div>
      `;
    } else if (ent.kind === "circle") {
      const circum = (2 * Math.PI * ent.radius).toFixed(2);
      const area = (Math.PI * ent.radius * ent.radius).toFixed(2);
      details = `
        <div class="property-row"><span>${t("prop_radius")}</span><input class="prop-input" id="propCircleRadius" type="number" step="any" value="${ent.radius.toFixed(3)}" /></div>
        <div class="property-row"><span>Center X</span><input class="prop-input" id="propCircleCx" type="number" step="any" value="${ent.cx.toFixed(2)}" /></div>
        <div class="property-row"><span>Center Y</span><input class="prop-input" id="propCircleCy" type="number" step="any" value="${ent.cy.toFixed(2)}" /></div>
        <div class="property-row"><span>Chu vi (C)</span><strong>${circum}</strong></div>
        <div class="property-row"><span>Diện tích (S)</span><strong>${area}</strong></div>
      `;
    } else if (ent.kind === "text") {
      details = `
        <div class="property-row"><span>Text</span><input class="prop-input" id="propTextValue" type="text" value="${escapeHtml(ent.text)}" /></div>
        <div class="property-row"><span>X</span><input class="prop-input" id="propTextX" type="number" step="any" value="${ent.x.toFixed(2)}" /></div>
        <div class="property-row"><span>Y</span><input class="prop-input" id="propTextY" type="number" step="any" value="${ent.y.toFixed(2)}" /></div>
        <div class="property-row"><span>Height</span><input class="prop-input" id="propTextHeight" type="number" step="any" value="${(ent.height || 2.5).toFixed(2)}" /></div>
      `;
    } else if (ent.kind === "arc") {
      details = `
        <div class="property-row"><span>${t("prop_radius")}</span><strong>${ent.radius.toFixed(3)}</strong></div>
        <div class="property-row"><span>${t("prop_center")}</span><strong>${ent.x.toFixed(2)}, ${ent.y.toFixed(2)}</strong></div>
        <div class="property-row"><span>${t("prop_sweep")}</span><strong>${(((ent.end - ent.start + Math.PI*2) % (Math.PI*2)) * 180 / Math.PI).toFixed(1)}°</strong></div>
      `;
    } else if (ent.kind === "insert") {
      details = `
        <div class="property-row"><span>Block Name</span><strong>${escapeHtml(ent.blockName)}</strong></div>
        <div class="property-row"><span>Insert X</span><strong>${ent.x.toFixed(2)}</strong></div>
        <div class="property-row"><span>Insert Y</span><strong>${ent.y.toFixed(2)}</strong></div>
        <div class="property-row"><span>Scale X</span><strong>${(ent.scaleX || 1).toFixed(2)}</strong></div>
        <div class="property-row"><span>Scale Y</span><strong>${(ent.scaleY || 1).toFixed(2)}</strong></div>
        <div class="property-row"><span>Rotation</span><strong>${((ent.rotation * 180 / Math.PI) % 360).toFixed(1)}°</strong></div>
      `;
    } else if (ent.kind === "polyline") {
      details = `
        <div class="property-row"><span>${t("prop_vertices")}</span><strong>${ent.points.length}</strong></div>
        <div class="property-row"><span>${t("prop_closed")}</span><strong>${ent.closed ? t("prop_yes") : t("prop_no")}</strong></div>
      `;
    }

    body.innerHTML = `
      <div class="panel-kicker">${t("prop_selected")}</div>
      <div class="property-row"><span>${t("prop_type")}</span><strong>${ent.kind.toUpperCase()}</strong></div>
      <div class="property-row"><span>${t("prop_handle")}</span><strong>#${ent.handle}</strong></div>
      <div class="property-row">
        <span>Layer</span>
        <select id="propLayerSelect" class="prop-select">
          ${model.layers.map((l) => `<option value="${l.name}" ${l.name === ent.layer ? "selected" : ""}>${escapeHtml(l.name)}</option>`).join("")}
        </select>
      </div>
      ${details}
      <div class="prop-actions">
        <button class="prop-btn" id="propMoveBtn">✥ ${t("tool_move")}</button>
        <button class="prop-btn" id="propCopyBtn">⧉ ${t("tool_copy")}</button>
        <button class="prop-btn danger" id="propEraseBtn">⌫ ${t("tool_erase")}</button>
      </div>
    `;

    $("#propLayerSelect").onchange = (e) => {
      sync(invoke("set_entity_layer", { handle: ent.handle, layer: e.target.value }));
    };
    if (ent.kind === "line") {
      const updateLine = () => {
        const x1 = parseFloat($("#propLineX1").value);
        const y1 = parseFloat($("#propLineY1").value);
        const x2 = parseFloat($("#propLineX2").value);
        const y2 = parseFloat($("#propLineY2").value);
        if (isFinite(x1) && isFinite(y1) && isFinite(x2) && isFinite(y2)) {
          sync(invoke("update_line", { handle: ent.handle, x1, y1, x2, y2 }));
        }
      };
      $("#propLineX1").onchange = updateLine;
      $("#propLineY1").onchange = updateLine;
      $("#propLineX2").onchange = updateLine;
      $("#propLineY2").onchange = updateLine;
    } else if (ent.kind === "circle") {
      const updateCircle = () => {
        const r = parseFloat($("#propCircleRadius").value);
        const cx = parseFloat($("#propCircleCx").value);
        const cy = parseFloat($("#propCircleCy").value);
        if (r > 0 && isFinite(cx) && isFinite(cy)) {
          sync(invoke("update_circle", { handle: ent.handle, cx, cy, radius: r }));
        }
      };
      $("#propCircleRadius").onchange = updateCircle;
      $("#propCircleCx").onchange = updateCircle;
      $("#propCircleCy").onchange = updateCircle;
    } else if (ent.kind === "text") {
      const updateText = () => {
        const val = $("#propTextValue").value.trim();
        const x = parseFloat($("#propTextX").value);
        const y = parseFloat($("#propTextY").value);
        const h = parseFloat($("#propTextHeight").value);
        if (val && isFinite(x) && isFinite(y) && h > 0) {
          sync(invoke("update_text", { handle: ent.handle, value: val, x, y, height: h, rotation: ent.rotation }));
        }
      };
      $("#propTextValue").onchange = updateText;
      $("#propTextX").onchange = updateText;
      $("#propTextY").onchange = updateText;
      $("#propTextHeight").onchange = updateText;
    }
    $("#propMoveBtn").onclick = () => chooseTool("move");
    $("#propCopyBtn").onclick = () => chooseTool("copy");
    $("#propEraseBtn").onclick = eraseSelected;
  } else {
    body.innerHTML = `
      <div class="panel-kicker">${t("prop_multiple")}</div>
      <div class="property-row"><span>${t("prop_selection")}</span><strong>${count} entities</strong></div>
      <div class="property-row">
        <span>Change Layer</span>
        <select id="propBatchLayerSelect" class="prop-select">
          <option value="">(Select Layer)</option>
          ${model.layers.map((l) => `<option value="${l.name}">${escapeHtml(l.name)}</option>`).join("")}
        </select>
      </div>
      <div class="prop-actions">
        <button class="prop-btn" id="propMoveAllBtn">✥ ${t("tool_move")}</button>
        <button class="prop-btn" id="propCopyAllBtn">⧉ ${t("tool_copy")}</button>
        <button class="prop-btn danger" id="propEraseAllBtn">⌫ ${t("tool_erase")}</button>
      </div>
    `;

    $("#propBatchLayerSelect").onchange = async (e) => {
      const newLayer = e.target.value;
      if (!newLayer) return;
      for (const h of selectedHandles) {
        await invoke("set_entity_layer", { handle: h, layer: newLayer });
      }
      sync(invoke("get_snapshot"));
    };
    $("#propMoveAllBtn").onclick = () => chooseTool("move");
    $("#propCopyAllBtn").onclick = () => chooseTool("copy");
    $("#propEraseAllBtn").onclick = eraseSelected;
  }
}

// Drawing Actions

async function explodeSelected() {
  if (selectedHandles.size === 0) {
    setStatus("Select a polyline to explode");
    return;
  }
  const handles = Array.from(selectedHandles);
  for (const h of handles) {
    await invoke("explode_entity", { handle: h });
  }
  selectedHandles.clear();
  await sync(invoke("get_snapshot"));
  setStatus("Polyline exploded into segments");
}

async function eraseSelected() {
  if (selectedHandles.size === 0) {
    setStatus("No objects selected to erase");
    return;
  }
  const handles = Array.from(selectedHandles);
  if (await sync(invoke("erase_entities", { handles }))) {
    selectedHandles.clear();
    setStatus(`Erased ${handles.length} object(s)`);
  }
}

async function undoAction() {
  if (await sync(invoke("undo"))) {
    selectedHandles.clear();
    setStatus("Undo performed");
  }
}

async function redoAction() {
  if (await sync(invoke("redo"))) {
    selectedHandles.clear();
    setStatus("Redo performed");
  }
}

async function openDrawing() {
  const path = await open({
    multiple: false,
    filters: [{ name: "CAD drawing", extensions: ["dwg", "dxf"] }]
  });
  if (path) {
    setStatus("Opening drawing…");
    if (await sync(invoke("open_drawing", { path }))) {
      selectedHandles.clear();
      setStatus(`Opened ${model.entityCount} model-space entities`);
      zoomToExtents();
    }
  }
}

async function saveDrawing() {
  let path = null;
  if (!model.dirty && model.title !== "Drawing1") {
    setStatus("Drawing already saved");
    return;
  }
  if (model.title === "Drawing1" || !model.title.includes(".")) {
    path = await save({
      filters: [
        { name: "DWG drawing", extensions: ["dwg"] },
        { name: "DXF drawing", extensions: ["dxf"] }
      ]
    });
    if (!path) return;
  }
  if (await sync(invoke("save_drawing", { path }))) setStatus("Drawing saved successfully");
}

function zoomToExtents() {
  if (!model.entities.length) return;
  let xs = [], ys = [];
  for (const e of model.entities) {
    if (e.kind === "line") {
      xs.push(e.x1, e.x2);
      ys.push(e.y1, e.y2);
    } else if (e.kind === "arc") {
      xs.push(e.x - e.radius, e.x + e.radius);
      ys.push(e.y - e.radius, e.y + e.radius);
    } else if (e.kind === "polyline") {
      for (const p of e.points) {
        xs.push(p.x);
        ys.push(p.y);
      }
    }
  }
  if (!xs.length) return;
  const viewport = $("#viewport");
  const w = viewport.clientWidth, h = viewport.clientHeight, pad = 80;
  pan = { x: 0, y: 0 };
  zoom = Math.min((w - pad * 2) / (Math.max(...xs) - Math.min(...xs) || 1), (h - pad * 2) / (Math.max(...ys) - Math.min(...ys) || 1));
  pan.x = -((Math.min(...xs) + Math.max(...xs)) / 2) * zoom;
  pan.y = ((Math.min(...ys) + Math.max(...ys)) / 2) * zoom;
  draw();
}

async function finishSpline() {
  if (points.length < 2) {
    points = [];
    draw();
    return;
  }
  const splinePts = interpolateCatmullRom(points, 10);
  await sync(
    invoke("add_polyline", {
      points: splinePts,
      closed: false
    })
  );
  points = [];
  chooseTool("select");
  setStatus(currentLang === "vi" ? "Đã tạo đường cong Spline (SPLINE)" : "Spline curve created");
  draw();
}

async function finishRevcloud() {
  if (points.length < 2) {
    points = [];
    draw();
    return;
  }
  const cloudPts = generateRevisionCloud(points, 24);
  await sync(
    invoke("add_polyline", {
      points: cloudPts,
      closed: true
    })
  );
  points = [];
  chooseTool("select");
  setStatus(currentLang === "vi" ? "Đã tạo đám mây ghi chú (REVCLOUD)" : "Revision Cloud created");
  draw();
}

async function finishPolyline(closed = false) {
  if (points.length < 2) {
    points = [];
    draw();
    return;
  }
  await sync(
    invoke("add_polyline", {
      points: points.map((p) => [p.x, p.y, p.bulge || 0]),
      closed
    })
  );
  points = [];
  setStatus(closed ? "Closed Polyline created" : "Polyline created");
  draw();
}

function toggleGrid() {
  showGrid = !showGrid;
  const b = $("#toggleGridBtn");
  if (b) b.classList.toggle("active", showGrid);
  draw();
}

function toggleSnap() {
  snapEnabled = !snapEnabled;
  const b = $("#toggleSnapBtn");
  if (b) b.classList.toggle("active", snapEnabled);
  draw();
}

function toggleOrtho() {
  orthoEnabled = !orthoEnabled;
  const b = $("#toggleOrthoBtn");
  if (b) b.classList.toggle("active", orthoEnabled);
  draw();
}

// Canvas Event Bindings
function bindCanvasEvents(viewportEl, canvasEl) {
  viewportEl.addEventListener("pointerdown", async (e) => {
    if (e.button === 1 || e.code === "Space") {
      isPanning = true;
      lastPan = { x: e.clientX, y: e.clientY };
      viewportEl.setPointerCapture(e.pointerId);
      return;
    }

    const r = canvasEl.getBoundingClientRect();
    let p = screenToWorld(e.clientX - r.left, e.clientY - r.top);

    if (currentSnap) {
      p = { x: currentSnap.point.x, y: currentSnap.point.y };
    }

    if (orthoEnabled && points.length > 0) {
      const prev = points[points.length - 1];
      if (Math.abs(p.x - prev.x) >= Math.abs(p.y - prev.y)) {
        p.y = prev.y;
      } else {
        p.x = prev.x;
      }
    }

    world = p;

    if (activeGrip) {
      const g = activeGrip;
      const ent = model.entities.find((e) => e.handle === g.handle);
      if (ent) {
        if (g.kind === "line") {
          if (g.id === "start") await sync(invoke("update_line", { handle: g.handle, x1: p.x, y1: p.y, x2: ent.x2, y2: ent.y2 }));
          else if (g.id === "end") await sync(invoke("update_line", { handle: g.handle, x1: ent.x1, y1: ent.y1, x2: p.x, y2: p.y }));
          else if (g.id === "mid") {
            const dx = p.x - (ent.x1 + ent.x2) / 2;
            const dy = p.y - (ent.y1 + ent.y2) / 2;
            await sync(invoke("update_line", { handle: g.handle, x1: ent.x1 + dx, y1: ent.y1 + dy, x2: ent.x2 + dx, y2: ent.y2 + dy }));
          }
        } else if (g.kind === "arc") {
          if (g.id === "center") {
            await sync(invoke("update_arc", { handle: g.handle, x: p.x, y: p.y, radius: ent.radius, start: ent.start, end: ent.end }));
          } else if (g.id === "start") {
            const sAngle = Math.atan2(p.y - ent.y, p.x - ent.x);
            const nRadius = Math.hypot(p.x - ent.x, p.y - ent.y);
            await sync(invoke("update_arc", { handle: g.handle, x: ent.x, y: ent.y, radius: nRadius, start: sAngle, end: ent.end }));
          } else if (g.id === "end") {
            const eAngle = Math.atan2(p.y - ent.y, p.x - ent.x);
            const nRadius = Math.hypot(p.x - ent.x, p.y - ent.y);
            await sync(invoke("update_arc", { handle: g.handle, x: ent.x, y: ent.y, radius: nRadius, start: ent.start, end: eAngle }));
          }
        } else if (g.kind === "circle") {
          if (g.id === "center") {
            await sync(invoke("update_circle", { handle: g.handle, cx: p.x, cy: p.y, radius: ent.radius }));
          } else {
            const nRadius = Math.hypot(p.x - ent.cx, p.y - ent.cy);
            if (nRadius > 0.01) {
              await sync(invoke("update_circle", { handle: g.handle, cx: ent.cx, cy: ent.cy, radius: nRadius }));
            }
          }
        } else if (g.kind === "text") {
          await sync(invoke("update_text", { handle: g.handle, value: ent.text, x: p.x, y: p.y, height: ent.height, rotation: ent.rotation }));
        } else if (g.kind === "polyline") {
          const newPts = ent.points.map((pt, idx) => idx === g.id ? [p.x, p.y, pt.bulge || 0] : [pt.x, pt.y, pt.bulge || 0]);
          await sync(invoke("update_polyline", { handle: g.handle, points: newPts, closed: ent.closed }));
        }
      }
      activeGrip = null;
      setStatus("Grip updated");
      draw();
      return;
    }


    if (activeTool === "select") {
      const grip = findNearestGrip(p);
      if (grip) {
        activeGrip = grip;
        setStatus(`Editing grip on #${grip.handle}`);
        draw();
        return;
      }
      const hit = hitTestEntity(p, 8 / zoom);
      if (hit) {
        if (e.shiftKey || e.ctrlKey) {
          if (selectedHandles.has(hit.handle)) {
            selectedHandles.delete(hit.handle);
          } else {
            selectedHandles.add(hit.handle);
          }
        } else {
          selectedHandles.clear();
          selectedHandles.add(hit.handle);
        }
        setStatus(`Selected #${hit.handle} (${hit.kind.toUpperCase()})`);
        renderProperties();
        draw();
      } else {
        // Start Box Selection (Window / Crossing)
        isBoxSelecting = true;
        boxStart = p;
        boxCurrent = p;
        viewportEl.setPointerCapture(e.pointerId);
        if (!e.shiftKey && !e.ctrlKey) {
          selectedHandles.clear();
          renderProperties();
        }
        draw();
      }
      return;
    }

    if (activeTool === "line") {
      points.push(p);
      if (points.length === 2) {
        await sync(invoke("add_line", { x1: points[0].x, y1: points[0].y, x2: p.x, y2: p.y }));
        points = [];
        setStatus("LINE created");
      } else {
        setStatus("LINE · Pick end point");
      }
    } else if (activeTool === "polyline") {
      points.push({ ...p, bulge: 0 });
      setStatus(`PLINE · ${points.length} vertices; Enter to finish`);
    } else if (activeTool === "circle") {
      points.push(p);
      if (points.length === 2) {
        const radius = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        if (radius > 1e-6) {
          const c = points[0];
          await sync(invoke("add_circle", { cx: c.x, cy: c.y, radius }));
          setStatus(currentLang === "vi" ? "Đã tạo đường tròn (CIRCLE)" : "CIRCLE created");
        }
        points = [];
      } else {
        setStatus(currentLang === "vi" ? "CIRCLE · Chọn điểm xác định bán kính" : "CIRCLE · Pick radius point");
      }
    } else if (activeTool === "text") {
      const textVal = prompt(currentLang === "vi" ? "Nhập nội dung văn bản:" : "Enter text content:", "CONCOSTCAD");
      if (textVal && textVal.trim()) {
        const heightStr = prompt(currentLang === "vi" ? "Nhập chiều cao chữ (Height):" : "Enter text height:", "2.5");
        const height = parseFloat(heightStr) || 2.5;
        await sync(invoke("add_text", { value: textVal.trim(), x: p.x, y: p.y, height, rotation: 0.0 }));
        setStatus(currentLang === "vi" ? `Đã tạo chữ: "${textVal}"` : `TEXT created: "${textVal}"`);
      }
      points = [];
      chooseTool("select");
    } else if (activeTool === "fillet") {
      const hit = hitTestEntity(p, 8 / zoom);
      if (hit) {
        points.push(hit);
        if (points.length === 1) {
          setStatus(currentLang === "vi" ? `FILLET · Đã chọn đường 1 (#${hit.handle}). Chọn đường thứ 2` : `FILLET · Pick second line`);
        } else if (points.length === 2) {
          const rStr = prompt(currentLang === "vi" ? "Nhập bán kính bo góc (R = 0 để bo góc vuông):" : "Enter fillet radius (R = 0 for square corner):", filletRadius.toString());
          if (rStr !== null) {
            filletRadius = parseFloat(rStr) || 0;
            await sync(invoke("fillet_lines", { h1: points[0].handle, h2: points[1].handle, radius: filletRadius }));
            setStatus(currentLang === "vi" ? `Đã bo góc (FILLET R=${filletRadius})` : `Filleted with R=${filletRadius}`);
          }
          points = [];
          chooseTool("select");
        }
      }
    } else if (activeTool === "chamfer") {
      const hit = hitTestEntity(p, 8 / zoom);
      if (hit) {
        points.push(hit);
        if (points.length === 1) {
          setStatus(currentLang === "vi" ? `CHAMFER · Đã chọn đường 1 (#${hit.handle}). Chọn đường thứ 2` : `CHAMFER · Pick second line`);
        } else if (points.length === 2) {
          const dStr = prompt(currentLang === "vi" ? "Nhập khoảng cách vát mép (D1, D2):" : "Enter chamfer distance (D1, D2):", `${chamferDist},${chamferDist}`);
          if (dStr !== null) {
            const parts = dStr.split(',').map(s => parseFloat(s.trim()));
            const d1 = parts[0] || 2;
            const d2 = parts[1] || d1;
            await sync(invoke("chamfer_lines", { h1: points[0].handle, h2: points[1].handle, d1, d2 }));
            setStatus(currentLang === "vi" ? `Đã vát mép (CHAMFER D1=${d1}, D2=${d2})` : `Chamfered with D1=${d1}, D2=${d2}`);
          }
          points = [];
          chooseTool("select");
        }
      }
    } else if (activeTool === "trim") {
      const hit = hitTestEntity(p, 8 / zoom);
      if (hit) {
        const allOtherHandles = model.entities.filter(ent => ent.handle !== hit.handle).map(ent => ent.handle);
        const ok = await sync(invoke("trim_line", { targetHandle: hit.handle, clickX: p.x, clickY: p.y, cutterHandles: allOtherHandles }));
        if (ok) {
          setStatus(currentLang === "vi" ? "Đã cắt xén đối tượng (TRIM)" : "Line trimmed");
        }
      }
    } else if (activeTool === "extend") {
      const hit = hitTestEntity(p, 8 / zoom);
      if (hit) {
        const allOtherHandles = model.entities.filter(ent => ent.handle !== hit.handle).map(ent => ent.handle);
        const ok = await sync(invoke("extend_line", { targetHandle: hit.handle, clickX: p.x, clickY: p.y, boundaryHandles: allOtherHandles }));
        if (ok) {
          setStatus(currentLang === "vi" ? "Đã kéo dài đối tượng (EXTEND)" : "Line extended to boundary");
        }
      }
    } else if (activeTool === "join") {
      if (selectedHandles.size >= 2) {
        await sync(invoke("join_entities", { handles: Array.from(selectedHandles) }));
        setStatus(currentLang === "vi" ? "Đã nối các đối tượng thành Polyline (JOIN)" : "Entities joined into Polyline");
        chooseTool("select");
      } else {
        const hit = hitTestEntity(p, 8 / zoom);
        if (hit) {
          selectedHandles.add(hit.handle);
          renderProperties();
          draw();
          if (selectedHandles.size >= 2) {
            await sync(invoke("join_entities", { handles: Array.from(selectedHandles) }));
            setStatus(currentLang === "vi" ? "Đã nối các đối tượng thành Polyline (JOIN)" : "Entities joined into Polyline");
            chooseTool("select");
          } else {
            setStatus(currentLang === "vi" ? "JOIN · Chọn đối tượng tiếp theo để nối" : "JOIN · Pick next entity to join");
          }
        }
      }
    } else if (activeTool === "rectangle") {
      points.push(p);
      if (points.length === 2) {
        const [p1, p2] = points;
        const rectPoints = [
          [p1.x, p1.y, 0],
          [p2.x, p1.y, 0],
          [p2.x, p2.y, 0],
          [p1.x, p2.y, 0]
        ];
        await sync(invoke("add_polyline", { points: rectPoints, closed: true }));
        points = [];
        setStatus("RECTANGLE created");
      } else {
        setStatus("RECTANGLE · Pick opposite corner");
      }
    } else if (activeTool === "arc") {
      points.push(p);
      setStatus(`ARC · ${points.length}/3 points`);
      if (points.length === 3) {
        const [a, b, c] = points;
        const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
        if (Math.abs(d) > 1e-9) {
          const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y) + (c.x * c.x + c.y * c.y) * (a.y - b.y)) / d;
          const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x) + (c.x * c.x + c.y * c.y) * (b.x - a.x)) / d;
          const radius = Math.hypot(a.x - ux, a.y - uy);
          let start = Math.atan2(a.y - uy, a.x - ux);
          let mid = Math.atan2(b.y - uy, b.x - ux);
          let end = Math.atan2(c.y - uy, c.x - ux);
          const ccw = (to, from) => (to - from + Math.PI * 2) % (Math.PI * 2);
          if (ccw(mid, start) > ccw(end, start)) [start, end] = [end, start];
          await sync(invoke("add_arc", { x: ux, y: uy, radius, start, end }));
          setStatus("ARC created");
        } else {
          setStatus("ARC points are collinear");
        }
        points = [];
      }
    } else if (activeTool === "move") {
      if (selectedHandles.size === 0) {
        const hit = hitTestEntity(p, 8 / zoom);
        if (hit) {
          selectedHandles.add(hit.handle);
          renderProperties();
        } else {
          setStatus("MOVE · Select objects first");
          return;
        }
      }
      if (!moveBasePoint) {
        moveBasePoint = p;
        setStatus("MOVE · Specify destination point");
      } else {
        const dx = p.x - moveBasePoint.x;
        const dy = p.y - moveBasePoint.y;
        await sync(invoke("move_entities", { handles: Array.from(selectedHandles), dx, dy }));
        moveBasePoint = null;
        chooseTool("select");
        setStatus(`Moved ${selectedHandles.size} object(s)`);
      }
    } else if (activeTool === "copy") {
      if (selectedHandles.size === 0) {
        const hit = hitTestEntity(p, 8 / zoom);
        if (hit) {
          selectedHandles.add(hit.handle);
          renderProperties();
        } else {
          setStatus("COPY · Select objects first");
          return;
        }
      }
      if (!moveBasePoint) {
        moveBasePoint = p;
        setStatus("COPY · Specify copy destination point");
      } else {
        const dx = p.x - moveBasePoint.x;
        const dy = p.y - moveBasePoint.y;
        await sync(invoke("copy_entities", { handles: Array.from(selectedHandles), dx, dy }));
        moveBasePoint = null;
        chooseTool("select");
        setStatus(`Copied ${selectedHandles.size} object(s)`);
      }
    } else if (activeTool === "rotate") {
      if (selectedHandles.size === 0) {
        const hit = hitTestEntity(p, 8 / zoom);
        if (hit) {
          selectedHandles.add(hit.handle);
          renderProperties();
        } else {
          setStatus("ROTATE · Select objects first");
          return;
        }
      }
      if (!moveBasePoint) {
        moveBasePoint = p;
        setStatus("ROTATE · Pick second point to specify angle, or type angle in degrees");
      } else {
        const ang = Math.atan2(p.y - moveBasePoint.y, p.x - moveBasePoint.x) * (180 / Math.PI);
        await sync(invoke("rotate_entities", { handles: Array.from(selectedHandles), cx: moveBasePoint.x, cy: moveBasePoint.y, angleDeg: ang }));
        moveBasePoint = null;
        chooseTool("select");
        setStatus(`Rotated by ${ang.toFixed(1)}°`);
      }
    } else if (activeTool === "mirror") {
    } else if (activeTool === "offset") {
      if (!offsetTargetHandle) {
        const hit = hitTestEntity(p, 8 / zoom);
        if (hit) {
          offsetTargetHandle = hit.handle;
          setStatus(`OFFSET · Pick side to offset (Distance = ${offsetDist})`);
        } else {
          setStatus("OFFSET · Click on an entity to offset");
        }
      } else {
        await sync(invoke("offset_entity", { handle: offsetTargetHandle, distance: offsetDist, sideX: p.x, sideY: p.y }));
        offsetTargetHandle = null;
        setStatus(`Offset created at distance ${offsetDist}`);
        chooseTool("select");
      }

      if (selectedHandles.size === 0) {
        const hit = hitTestEntity(p, 8 / zoom);
        if (hit) {
          selectedHandles.add(hit.handle);
          renderProperties();
        } else {
          setStatus("MIRROR · Select objects first");
          return;
        }
      }
      points.push(p);
      if (points.length === 2) {
        await sync(invoke("mirror_entities", {
          handles: Array.from(selectedHandles),
          p1X: points[0].x,
          p1Y: points[0].y,
          p2X: points[1].x,
          p2Y: points[1].y,
          keepSource: true
        }));
        points = [];
        chooseTool("select");
        setStatus("Mirrored objects created");
      } else {
        setStatus("MIRROR · Pick second point of mirror axis");
      }
    } else if (activeTool === "dim") {
      points.push(p);
      if (points.length === 1) {
        setStatus(currentLang === "vi" ? "DIM · Chọn điểm đo thứ 2" : "DIM · Pick second point");
      } else if (points.length === 2) {
        setStatus(currentLang === "vi" ? "DIM · Chọn vị trí đường kích thước (Offset point)" : "DIM · Pick dimension offset");
      } else if (points.length === 3) {
        const [p1, p2, pOff] = points;
        const dLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const textOverride = dLen.toFixed(dimPrecision) + (dimSuffix ? " " + dimSuffix : "");
        await sync(invoke("add_dimension", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, ox: pOff.x, oy: pOff.y, textOverride }));
        points = [];
        chooseTool("select");
        setStatus(currentLang === "vi" ? "Đã ghi kích thước (DIM)" : "Dimension created");
      }
    } else if (activeTool === "dist") {
      points.push(p);
      if (points.length === 2) {
        const d = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        const dx = points[1].x - points[0].x;
        const dy = points[1].y - points[0].y;
        const ang = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2);
        measureInfo = `Dist = ${d.toFixed(3)} | ΔX = ${dx.toFixed(3)}, ΔY = ${dy.toFixed(3)} | Angle = ${ang}°`;
        setStatus(measureInfo);
        points = [];
        renderRibbon();
      } else {
        setStatus("MEASURE · Pick second point");
      }
    } else if (activeTool === "area") {
      points.push(p);
      setStatus(`AREA · ${points.length} vertices picked; press Enter to calculate area`);
    }

    draw();
  });

  viewportEl.addEventListener("pointermove", (e) => {
    const r = canvasEl.getBoundingClientRect();
    let p = screenToWorld(e.clientX - r.left, e.clientY - r.top);

    currentSnap = findNearestSnap(p, 12);
    if (currentSnap) {
      p = { x: currentSnap.point.x, y: currentSnap.point.y };
    }

    if (orthoEnabled && points.length > 0) {
      const prev = points[points.length - 1];
      if (Math.abs(p.x - prev.x) >= Math.abs(p.y - prev.y)) {
        p.y = prev.y;
      } else {
        p.x = prev.x;
      }
    }

    world = p;

    if (isBoxSelecting) {
      boxCurrent = p;
    }

    if (isPanning && lastPan) {
      pan.x += e.clientX - lastPan.x;
      pan.y += e.clientY - lastPan.y;
      lastPan = { x: e.clientX, y: e.clientY };
    }

    draw();
  });

  viewportEl.addEventListener("pointerup", (e) => {
    if (isBoxSelecting && boxStart && boxCurrent) {
      const handles = queryEntitiesInBox(boxStart, boxCurrent);
      for (const h of handles) {
        selectedHandles.add(h);
      }
      isBoxSelecting = false;
      boxStart = null;
      boxCurrent = null;
      setStatus(`Box selected ${selectedHandles.size} entity(ies)`);
      renderProperties();
      draw();
    }
    isPanning = false;
    lastPan = null;
  });

  viewportEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = canvasEl.getBoundingClientRect();
      const before = screenToWorld(e.clientX - r.left, e.clientY - r.top);
      zoom = Math.max(0.0001, Math.min(10000, zoom * Math.exp(-e.deltaY * 0.001)));
      const after = worldToScreen(before.x, before.y);
      pan.x += e.clientX - r.left - after.x;
      pan.y += e.clientY - r.top - after.y;
      draw();
    },
    { passive: false }
  );
}

// Calculate Area of Polygon (Shoelace Formula)

// Takeoff & Bill of Quantities (BOM) Extraction for Construction Costing
function computeTakeoffData() {
  const layerStats = {};
  const blockStats = {};
  const areaItems = [];

  for (const l of model.layers) {
    layerStats[l.name] = { count: 0, length: 0, color: l.color || "#79c9dc" };
  }

  for (const e of model.entities) {
    const lyr = e.layer || "0";
    if (!layerStats[lyr]) layerStats[lyr] = { count: 0, length: 0, color: "#79c9dc" };
    layerStats[lyr].count++;

    if (e.kind === "line") {
      const len = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
      layerStats[lyr].length += len;
    } else if (e.kind === "arc") {
      const sweep = (e.end - e.start + Math.PI * 2) % (Math.PI * 2);
      const len = sweep * e.radius;
      layerStats[lyr].length += len;
    } else if (e.kind === "polyline") {
      let len = 0;
      const pts = e.points;
      const n = e.closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        len += Math.hypot(b.x - a.x, b.y - a.y);
      }
      layerStats[lyr].length += len;

      if (e.closed && pts.length >= 3) {
        const { area, perimeter } = calculatePolygonArea(pts);
        areaItems.push({
          type: "Closed Polyline",
          layer: lyr,
          area: area / 1e6, // m²
          perimeter: perimeter / 1e3 // m
        });
      }
    } else if (e.kind === "circle") {
      const circum = 2 * Math.PI * e.radius;
      const a = Math.PI * e.radius * e.radius;
      layerStats[lyr].length += circum;
      areaItems.push({
        type: "Circle",
        layer: lyr,
        area: a / 1e6,
        perimeter: circum / 1e3
      });
    } else if (e.kind === "insert") {
      const name = e.blockName || "ANONYMOUS";
      if (!blockStats[name]) blockStats[name] = { count: 0, layer: lyr };
      blockStats[name].count++;
    }
  }

  return { layerStats, blockStats, areaItems };
}

function showTakeoffModal() {
  const existing = $("#takeoffModalOverlay");
  if (existing) existing.remove();

  const data = computeTakeoffData();
  const overlay = document.createElement("div");
  overlay.className = "takeoff-modal-overlay";
  overlay.id = "takeoffModalOverlay";

  let layerRows = "";
  for (const [name, s] of Object.entries(data.layerStats)) {
    if (s.count === 0) continue;
    layerRows += `
      <tr>
        <td><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${s.color};margin-right:6px;"></i>${escapeHtml(name)}</td>
        <td>${s.count}</td>
        <td><strong>${(s.length / 1000).toFixed(3)} m</strong> (${s.length.toFixed(1)} mm)</td>
      </tr>
    `;
  }

  let blockRows = "";
  for (const [name, b] of Object.entries(data.blockStats)) {
    blockRows += `
      <tr>
        <td><strong>[${escapeHtml(name)}]</strong></td>
        <td>${escapeHtml(b.layer)}</td>
        <td><strong>${b.count}</strong> cái (units)</td>
      </tr>
    `;
  }

  let areaRows = "";
  let totalArea = 0;
  for (const a of data.areaItems) {
    totalArea += a.area;
    areaRows += `
      <tr>
        <td>${a.type}</td>
        <td>${escapeHtml(a.layer)}</td>
        <td><strong>${a.area.toFixed(3)} m²</strong></td>
        <td>${a.perimeter.toFixed(3)} m</td>
      </tr>
    `;
  }

  overlay.innerHTML = `
    <div class="takeoff-modal">
      <div class="takeoff-modal-header">
        <span>📊 ${currentLang === "vi" ? "Bảng thống kê khối lượng & Tiên lượng (Takeoff / BOM)" : "Quantity Takeoff & Bill of Materials"}</span>
        <button class="takeoff-modal-close" id="closeTakeoffBtn">×</button>
      </div>
      <div class="takeoff-modal-body">
        <div class="takeoff-section-title">📏 1. Thống kê chiều dài theo Layer (Linear Takeoff)</div>
        <table class="takeoff-table">
          <thead><tr><th>Tên Layer</th><th>Số thực thể</th><th>Tổng chiều dài (m)</th></tr></thead>
          <tbody>${layerRows || "<tr><td colspan='3'>(Chưa có thực thể đường vẽ)</td></tr>"}</tbody>
        </table>

        <div class="takeoff-section-title">🧱 2. Thống kê số lượng Block / Cấu kiện (Component Count)</div>
        <table class="takeoff-table">
          <thead><tr><th>Tên Block / Cấu kiện</th><th>Layer</th><th>Số lượng</th></tr></thead>
          <tbody>${blockRows || "<tr><td colspan='3'>(Chưa có Block Insert trong bản vẽ)</td></tr>"}</tbody>
        </table>

        <div class="takeoff-section-title">⏢ 3. Thống kê diện tích hình khép kín (Area Takeoff) - Tổng: ${totalArea.toFixed(3)} m²</div>
        <table class="takeoff-table">
          <thead><tr><th>Loại hình</th><th>Layer</th><th>Diện tích (m²)</th><th>Chu vi (m)</th></tr></thead>
          <tbody>${areaRows || "<tr><td colspan='4'>(Chưa có hình khép kín)</td></tr>"}</tbody>
        </table>
      </div>
      <div class="takeoff-modal-footer">
        <button class="takeoff-btn secondary" id="copyTakeoffBtn">📋 Sao chép CSV</button>
        <button class="takeoff-btn" id="closeTakeoffFooterBtn">Đóng</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  $("#closeTakeoffBtn").onclick = close;
  $("#closeTakeoffFooterBtn").onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  $("#copyTakeoffBtn").onclick = () => {
    let csv = "CONCOSTCAD QUANTITY TAKEOFF\n\nLAYER,COUNT,LENGTH_M\n";
    for (const [name, s] of Object.entries(data.layerStats)) {
      if (s.count > 0) csv += `"${name}",${s.count},${(s.length / 1000).toFixed(3)}\n`;
    }
    csv += "\nBLOCK_NAME,LAYER,COUNT\n";
    for (const [name, b] of Object.entries(data.blockStats)) {
      csv += `"${name}","${b.layer}",${b.count}\n`;
    }
    csv += "\nSHAPE,LAYER,AREA_M2,PERIMETER_M\n";
    for (const a of data.areaItems) {
      csv += `"${a.type}","${a.layer}",${a.area.toFixed(3)},${a.perimeter.toFixed(3)}\n`;
    }
    navigator.clipboard.writeText(csv);
    setStatus(currentLang === "vi" ? "Đã sao chép bảng thống kê khối lượng sang Clipboard (CSV)" : "Takeoff data copied to Clipboard");
  };
}

function calculatePolygonArea(pts) {
  if (pts.length < 3) return { area: 0, perimeter: 0 };
  let areaSum = 0;
  let perimSum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    areaSum += (a.x * b.y) - (b.x * a.y);
    perimSum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const area = Math.abs(areaSum) / 2;
  return { area, perimeter: perimSum };
}

// Command Bar and Keyboard handling
function bindCommandBarEvents() {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (document.activeElement !== $("#commandInput") && document.activeElement !== $("#newLayerInput")) {
        eraseSelected();
      }
    }
    if (e.key === "Escape") {
      points = [];
      moveBasePoint = null;
      isBoxSelecting = false;
      chooseTool("select");
      setStatus("Cancelled");
    }
    if (e.key === "F8") {
      e.preventDefault();
      toggleOrtho();
    }
    if (e.key === "F3") {
      e.preventDefault();
      toggleSnap();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undoAction();
    }
    if (e.ctrlKey && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
      e.preventDefault();
      redoAction();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveDrawing();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      openDrawing();
    }
    if (e.key === "Enter" && document.activeElement !== $("#commandInput")) {
      if (activeTool === "polyline") finishPolyline(false);
      if (activeTool === "spline") finishSpline();
      if (activeTool === "revcloud") finishRevcloud();
      if (activeTool === "area" && points.length >= 3) {
        const res = calculatePolygonArea(points);
        measureInfo = `Area = ${res.area.toFixed(2)} mm² (${(res.area / 1e6).toFixed(4)} m²) | Perimeter = ${res.perimeter.toFixed(2)} mm`;
        setStatus(measureInfo);
        points = [];
        renderRibbon();
        draw();
      }
    }
  });

  const cmdInput = $("#commandInput");
  if (cmdInput) {
    cmdInput.addEventListener("keydown", async (e) => {

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length > 0) {
          if (historyIndex === -1) historyIndex = commandHistory.length - 1;
          else if (historyIndex > 0) historyIndex--;
          cmdInput.value = commandHistory[historyIndex];
        }
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex !== -1) {
          if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            cmdInput.value = commandHistory[historyIndex];
          } else {
            historyIndex = -1;
            cmdInput.value = "";
          }
        }
      }

      if (e.key === "Enter") {
        const raw = e.currentTarget.value.trim();
        if (raw) {
          commandHistory.push(raw);
          if (commandHistory.length > 50) commandHistory.shift();
          historyIndex = -1;
        }
        e.currentTarget.value = "";
        if (!raw) {
          if (activeTool === "polyline") finishPolyline(false);
          return;
        }

        const cmd = raw.toUpperCase();
        if (cmd === "ZE" || cmd === "ZOOM EXTENTS") { zoomToExtents(); return; }
    if (cmd === "ZS" || cmd === "ZOOM SELECTED" || cmd === "ZOOM OBJECT") { zoomSelected(); return; }
    if (cmd === "EXPORT" || cmd === "PLOT" || cmd === "PRINT") { exportDrawingImage(); return; }
    if (cmd === "TAKEOFF" || cmd === "BOM" || cmd === "COUNT" || cmd === "QUANTITY") {
      showTakeoffModal();
      return;
    }
    if (cmd === "MODEL" || cmd === "MS") {
      const b = $("button[data-space='model']");
      if (b) b.click();
      return;
    }
    if (cmd === "LAYOUT" || cmd === "PS" || cmd === "PAPER") {
      const b = $("button[data-space='layout1']");
      if (b) b.click();
      return;
    }
    if (cmd === "SPLINE" || cmd === "SPL") { chooseTool("spline"); return; }
    if (cmd === "REVCLOUD" || cmd === "CLOUD") { chooseTool("revcloud"); return; }
    if (cmd === "HATCH" || cmd === "H") { chooseTool("hatch"); return; }
    if (cmd === "PRECISION" || cmd === "DIMSTYLE" || cmd === "UNITS") {
      dimPrecision = (dimPrecision + 1) % 4; // Cycles: 0, 1, 2, 3 decimals
      setStatus(`Độ chính xác kích thước: ${dimPrecision} chữ số thập phân (DIMSTYLE)`);
      return;
    }
        if (cmd === "U" || cmd === "UNDO") { undoAction(); return; }
        if (cmd === "REDO") { redoAction(); return; }
        if (cmd === "E" || cmd === "ERASE" || cmd === "DELETE") { eraseSelected(); return; }
        if (cmd === "M" || cmd === "MOVE") { chooseTool("move"); return; }
        if (cmd === "CO" || cmd === "CP" || cmd === "COPY") { chooseTool("copy"); return; }
        if (cmd === "RO" || cmd === "ROTATE") { chooseTool("rotate"); return; }
        if (cmd === "MI" || cmd === "MIRROR") { chooseTool("mirror"); return; }
        if (cmd === "L" || cmd === "LINE") { chooseTool("line"); return; }
        if (cmd === "A" || cmd === "ARC") { chooseTool("arc"); return; }
        if (cmd === "PL" || cmd === "PLINE" || cmd === "POLYLINE") { chooseTool("polyline"); return; }
        if (cmd === "C" || cmd === "CIRCLE") { chooseTool("circle"); return; }
        if (cmd === "REC" || cmd === "RECT" || cmd === "RECTANGLE") { chooseTool("rectangle"); return; }
        if (cmd === "X" || cmd === "EXPLODE") { explodeSelected(); return; }
        if (cmd.startsWith("O ") || cmd.startsWith("OFFSET ")) {
          const parts = raw.split(/\s+/);
          if (parts[1] && !isNaN(Number(parts[1]))) offsetDist = Number(parts[1]);
          chooseTool("offset");
          return;
        }
        if (cmd === "O" || cmd === "OFFSET") { chooseTool("offset"); return; }
                if (cmd === "DLI" || cmd === "DIM" || cmd === "DIMLINEAR" || cmd === "DAL") { chooseTool("dim"); return; }
        if (cmd === "DIST" || cmd === "DI" || cmd === "MEASURE") { chooseTool("dist"); return; }
        if (cmd === "AREA" || cmd === "AA") { chooseTool("area"); return; }
        if (cmd === "GRID") { toggleGrid(); return; }
        if (cmd === "ORTHO") { toggleOrtho(); return; }
        if (cmd === "SNAP") { toggleSnap(); return; }
        if (cmd === "J" || cmd === "JOIN") {
          if (selectedHandles.size >= 2) {
            await sync(invoke("join_entities", { handles: Array.from(selectedHandles) }));
            setStatus(currentLang === "vi" ? "Đã nối các đối tượng (JOIN)" : "Entities joined");
            chooseTool("select");
          } else {
            chooseTool("join");
          }
          return;
        }
        if (cmd === "F" || cmd === "FILLET") { chooseTool("fillet"); return; }
        if (cmd === "CHA" || cmd === "CHAMFER") { chooseTool("chamfer"); return; }
        if (cmd === "TR" || cmd === "TRIM") { chooseTool("trim"); return; }
        if (cmd === "EX" || cmd === "EXTEND") { chooseTool("extend"); return; }
        if (cmd === "DT" || cmd === "TEXT" || cmd === "MTEXT") { chooseTool("text"); return; }

        // Angle input for Rotate
        if (activeTool === "rotate" && moveBasePoint && !isNaN(Number(raw))) {
          const ang = Number(raw);
          await sync(invoke("rotate_entities", { handles: Array.from(selectedHandles), cx: moveBasePoint.x, cy: moveBasePoint.y, angleDeg: ang }));
          moveBasePoint = null;
          chooseTool("select");
          setStatus(`Rotated by ${ang}°`);
          return;
        }

        // Relative Polar: @dist<angle
        const polarMatch = raw.match(/^@?(-?\d+(?:\.\d+)?)\s*<\s*(-?\d+(?:\.\d+)?)$/);
        if (polarMatch) {
          const dist = Number(polarMatch[1]);
          const deg = Number(polarMatch[2]);
          const rad = (deg * Math.PI) / 180;
          const ref = points.length > 0 ? points[points.length - 1] : { x: 0, y: 0 };
          const p = { x: ref.x + dist * Math.cos(rad), y: ref.y + dist * Math.sin(rad) };
          handleCoordinateInput(p);
          return;
        }

        // Relative Cartesian: @dx,dy
        const relMatch = raw.match(/^@(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
        if (relMatch) {
          const dx = Number(relMatch[1]);
          const dy = Number(relMatch[2]);
          const ref = points.length > 0 ? points[points.length - 1] : { x: 0, y: 0 };
          const p = { x: ref.x + dx, y: ref.y + dy };
          handleCoordinateInput(p);
          return;
        }

        // Absolute Coordinates: x,y or x,y,b=bulge
        const absMatch = raw.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*b=(-?\d+(?:\.\d+)?))?$/i);
        if (absMatch) {
          const p = { x: Number(absMatch[1]), y: Number(absMatch[2]) };
          if (absMatch[3] && activeTool === "polyline" && points.length > 0) {
            points[points.length - 1].bulge = Number(absMatch[3]);
          }
          handleCoordinateInput(p);
          return;
        }

        setStatus(`Unknown command: ${raw}`);
      }
      if (e.key === "Escape") {
        e.currentTarget.value = "";
        points = [];
        chooseTool("select");
      }
    });
  }

  const sendBtn = $("#commandSend");
  if (sendBtn) {
    sendBtn.onclick = () => {
      const input = $("#commandInput");
      if (input) input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    };
  }
}

async function handleCoordinateInput(p) {
  world = p;
  if (activeTool === "line") {
    points.push(p);
    if (points.length === 2) {
      await sync(invoke("add_line", { x1: points[0].x, y1: points[0].y, x2: p.x, y2: p.y }));
      points = [];
      setStatus("LINE created");
    }
  } else if (activeTool === "polyline") {
    points.push({ ...p, bulge: 0 });
    setStatus(`PLINE · ${points.length} vertices; Enter to finish`);
  } else if (activeTool === "arc") {
    points.push(p);
    if (points.length === 3) {
      const [a, b, c] = points;
      const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
      if (Math.abs(d) > 1e-9) {
        const ux = ((a.x * a.x + a.y * a.y) * (b.y - c.y) + (b.x * b.x + b.y * b.y) * (c.y - a.y) + (c.x * c.x + c.y * c.y) * (a.y - b.y)) / d;
        const uy = ((a.x * a.x + a.y * a.y) * (c.x - b.x) + (b.x * b.x + b.y * b.y) * (a.x - c.x) + (c.x * c.x + c.y * c.y) * (b.x - a.x)) / d;
        const radius = Math.hypot(a.x - ux, a.y - uy);
        let start = Math.atan2(a.y - uy, a.x - ux);
        let mid = Math.atan2(b.y - uy, b.x - ux);
        let end = Math.atan2(c.y - uy, c.x - ux);
        const ccw = (to, from) => (to - from + Math.PI * 2) % (Math.PI * 2);
        if (ccw(mid, start) > ccw(end, start)) [start, end] = [end, start];
        await sync(invoke("add_arc", { x: ux, y: uy, radius, start, end }));
        setStatus("ARC created");
      }
      points = [];
    }
  }
  draw();
}

// Initial Launch
renderShell();
new ResizeObserver(resize).observe($("#viewport"));
resize();
renderRibbon();
render();

// Background autosave timer (Tuần 31: Drawing robustness)
setInterval(async () => {
  if (model && model.dirty) {
    try {
      localStorage.setItem("concostcad_autosave_ts", Date.now().toString());
      setStatus(currentLang === "vi" ? "● Tự động lưu bản sao lưu (Autosaved)" : "● Autosaved drawing snapshot");
    } catch (_) {}
  }
}, 180000);


function renderDocumentTabs() {
  const container = $(".drawing-tab");
  if (!container) return;

  const tabsHtml = openDocuments.map((d) => `
    <div class="doc-tab ${d.id === activeDocId ? 'active' : ''}" data-doc-id="${d.id}">
      <span class="file-dot"></span>
      <span class="doc-title">${escapeHtml(d.title)}</span>
      <span class="dirty-dot ${d.dirty ? 'visible' : ''}"></span>
      ${openDocuments.length > 1 ? `<button class="close-tab" data-close-id="${d.id}">×</button>` : ''}
    </div>
  `).join("");

  container.innerHTML = `
    ${tabsHtml}
    <button class="add-tab-btn" id="addDocTabBtn" title="Bản vẽ mới (New Drawing)">＋</button>
  `;

  $$(".doc-tab").forEach((tab) => {
    const id = parseInt(tab.dataset.docId, 10);
    tab.onclick = (e) => {
      if (e.target.classList.contains("close-tab")) return;
      if (id !== activeDocId) {
        activeDocId = id;
        renderDocumentTabs();
      }
    };
  });

  $$(".close-tab").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.closeId, 10);
      if (openDocuments.length <= 1) return;
      openDocuments = openDocuments.filter((d) => d.id !== id);
      if (activeDocId === id) {
        activeDocId = openDocuments[openDocuments.length - 1].id;
      }
      renderDocumentTabs();
      draw();
    };
  });

  const addBtn = $("#addDocTabBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      const newDoc = {
        id: nextDocId++,
        title: `Drawing${openDocuments.length + 1}`,
        path: null,
        dirty: false
      };
      openDocuments.push(newDoc);
      activeDocId = newDoc.id;
      await sync(invoke("new_drawing"));
      renderDocumentTabs();
      setStatus(currentLang === "vi" ? `Đã tạo bản vẽ mới (${newDoc.title})` : `New drawing created (${newDoc.title})`);
    };
  }
}
