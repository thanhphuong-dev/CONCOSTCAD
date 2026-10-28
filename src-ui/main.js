import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { bindViewCube, normalizeRotation, rotationAroundCenter, updateViewCube } from "./view-cube.js";
import { cadShortcut, mountShellEvents } from "./shell-events.js";
import "./style.css";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Rust owns the drawing model. Serialize bridge calls in dispatch order so a
// slower older response cannot overwrite a newer CAD snapshot in the UI.
let backendCommandQueue = Promise.resolve();
function invoke(command, args) {
  const result = backendCommandQueue.then(() => tauriInvoke(command, args));
  backendCommandQueue = result.catch(() => undefined);
  return result;
}

// Crisp CAD toolbar glyphs. Inline SVG keeps the toolbar sharp at Windows display scaling.
const CAD_ICON_PATHS = {
  select: '<path d="M4 3l5 17 3.2-6.1L18 11 4 3z"/><path d="M12.2 14.2l4.2 4.2"/>',
  line: '<path d="M5 19L19 5"/><path d="M5 15v4h4M15 5h4v4"/>',
  arc: '<path d="M5 16a9 9 0 0 1 10-10"/><path d="M5 16h5M15 6v5"/>',
  polyline: '<path d="M4 17l5-11 6 8 5-10"/><circle cx="4" cy="17" r="1"/><circle cx="9" cy="6" r="1"/><circle cx="15" cy="14" r="1"/>',
  circle: '<circle cx="12" cy="12" r="7"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  rectangle: '<rect x="5" y="6" width="14" height="12"/><path d="M5 10h4M15 18h4"/>',
  spline: '<path d="M4 16c3-9 5-9 8-2s5 7 8-2"/><circle cx="4" cy="16" r="1"/><circle cx="12" cy="14" r="1"/><circle cx="20" cy="12" r="1"/>',
  revcloud: '<path d="M5 8c-3 2-1 5 2 4-2 3 1 5 3 3 0 3 4 3 4 0 2 2 5 0 3-3 3 1 5-2 2-4 2-2-1-5-3-3-1-3-5-3-5 0-2-2-5 0-3 3z"/>',
  hatch: '<path d="M5 5h14v14H5zM5 10l5-5M5 16L16 5M10 19L19 10M15 19l4-4"/>',
  text: '<path d="M5 5h14M12 5v14M8 19h8"/>',
  move: '<path d="M12 4v16M4 12h16M12 4l-3 3M12 4l3 3M12 20l-3-3M12 20l3-3M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3"/>',
  copy: '<rect x="7" y="7" width="11" height="11"/><path d="M4 14V4h10"/>',
  rotate: '<path d="M7 7a7 7 0 1 1-1 9"/><path d="M7 3v4H3M17 17l2 1-1 2"/>',
  mirror: '<path d="M12 3v18M5 7l5 5-5 5V7zM19 7l-5 5 5 5V7z"/>',
  fillet: '<path d="M5 18V7a2 2 0 0 1 2-2h11M5 14h5a4 4 0 0 0 4-4V5"/>',
  chamfer: '<path d="M5 18V6h12M5 13h5l7-7"/>',
  trim: '<path d="M5 5l14 14M19 5L5 19M7 7l5 5M17 17l-5-5"/>',
  extend: '<path d="M5 19L19 5M5 12v7h7M12 5h7v7"/>',
  join: '<path d="M4 12h6M14 12h6M10 9l4 3-4 3"/>',
  offset: '<path d="M5 17l7-12 7 12M7 20h10"/>',
  takeoff: '<path d="M5 18V8M10 18V5M15 18v-7M20 18V3M4 20h17"/>',
  explode: '<path d="M12 12l-7-7M12 12l7-7M12 12l7 7M12 12l-7 7M12 3v4M21 12h-4M12 21v-4M3 12h4"/>',
  erase: '<path d="M5 16l8-8 6 6-8 8H5l-2-3 2-3zM11 19h9"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/>',
  dim: '<path d="M5 18V6M19 18V6M5 12h14M8 9l-3 3 3 3M16 9l3 3-3 3"/>',
  dist: '<path d="M4 17L20 7M4 17h5M20 7h-5"/><path d="M8 19l-4-2 2-4M16 5l4 2-2 4"/>',
  area: '<path d="M5 18l2-11 8-3 4 10-7 5-7-1z"/><path d="M8 15l7-6"/>',
  zoom: '<circle cx="10" cy="10" r="6"/><path d="M15 15l5 5M7 10h6M10 7v6"/>',
  open: '<path d="M3 6h7l2 2h9v10H3z"/><path d="M3 6l2 9h14l2-7"/>',
  save: '<path d="M5 4h12l3 3v13H4V4zM8 4v6h8V4M8 20v-6h8v6"/>',
  finish: '<path d="M5 12l4 4 10-10"/>',
  new: '<path d="M5 4h10l4 4v12H5zM15 4v5h5M12 12v6M9 15h6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  zoomIn: '<circle cx="10" cy="10" r="6"/><path d="M15 15l5 5M7 10h6M10 7v6"/>',
  zoomOut: '<circle cx="10" cy="10" r="6"/><path d="M15 15l5 5M7 10h6"/>',
  zoomExtents: '<path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4"/><path d="M9 9h6v6H9z"/>',
  zoom100: '<path d="M5 6h4v12M13 9l2-3h4v12h-6V9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  layer: '<path d="M4 7h16M4 12h16M4 17h16"/><path d="M7 5v4M17 10v4M10 15v4"/>',
  properties: '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  grid: '<path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16"/>',
  snap: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  ortho: '<path d="M5 19V7h12M5 7l4 4M17 7l-4 4"/>',
};

function cadIcon(name) {
  return `<svg class="cad-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${CAD_ICON_PATHS[name] || CAD_ICON_PATHS.select}</svg>`;
}

function applyToolbarIcons() {
  const map = {
    select: "select", line: "line", arc: "arc", polyline: "polyline", circle: "circle", rectangle: "rectangle",
    spline: "spline", revcloud: "revcloud", hatch: "hatch", text: "text", move: "move", copy: "copy",
    rotate: "rotate", mirror: "mirror", fillet: "fillet", chamfer: "chamfer", trim: "trim", extend: "extend",
    join: "join", offset: "offset", dim: "dim", dist: "dist", area: "area",
  };
  $$("[data-tool]").forEach((button) => {
    const name = map[button.dataset.tool];
    if (name) {
      const existing = button.querySelector(".tool-icon");
      if (existing) existing.innerHTML = cadIcon(name);
      else button.innerHTML = cadIcon(name);
    }
  });
  const ids = { offsetBtn: "offset", takeoffRibbonBtn: "takeoff", explodeBtn: "explode", quickExplodeBtn: "explode", eraseBtn: "erase", undoBtn: "undo", redoBtn: "redo", zoomExtents: "zoomExtents", navZoomExtents: "zoomExtents", navZoomIn: "zoomIn", navZoomOut: "zoomOut", ribbonOpen: "open", saveBtn: "save", ribbonStartNew: "new", ribbonStartOpen: "open", finishPolylineBtn: "finish", closePolylineBtn: "close", zoomInBtn: "zoomIn", zoomOutBtn: "zoomOut", zoomResetBtn: "zoom100", ribbonToggleGrid: "grid", ribbonToggleSnap: "snap", ribbonToggleOrtho: "ortho", toggleGridBtn: "grid", toggleSnapBtn: "snap", toggleOrthoBtn: "ortho", showPropertiesPanel: "properties", showLayersPanel: "layer", ribbonAddLayer: "add" };
  Object.entries(ids).forEach(([id, name]) => {
    const button = document.getElementById(id);
    const existing = button?.querySelector(".tool-icon");
    if (existing) existing.innerHTML = cadIcon(name);
    else if (id === "quickExplodeBtn" && button) button.innerHTML = cadIcon(name);
  });
}

// Localization Catalogs (Tuần 23: Localization/Settings)
const supportedLanguages = ["en", "vi", "ko"];
const savedLanguage = localStorage.getItem("concostcad_lang");
let currentLang = supportedLanguages.includes(savedLanguage) ? savedLanguage : "en";

const i18n = {
  vi: {
    brand_sub: "PHIÊN BẢN RUST · 2.0",
    new_btn: "＋ Bản vẽ mới",
    open_btn: "▣ Mở DWG/DXF",
    tab_home: "Home",
    tab_draw: "Draw",
    tab_annotate: "Annotate",
    tab_view: "View",
    space_label: "KHÔNG GIAN MÔ HÌNH 2D · WCS",
    grp_draw: "DRAW",
    grp_modify: "MODIFY",
    grp_layers: "LAYERS",
    grp_annotate: "ANNOTATION",
    grp_view_file: "VIEW & FILE",
    grp_nav: "NAVIGATION",
    grp_aids: "DRAFTING AIDS",
    tool_select: "Chọn",
    tool_line: "Đoạn thẳng",
    tool_arc: "Cung tròn",
    tool_poly: "Đa tuyến",
    tool_circle: "Đường tròn",
    tool_rect: "Hình chữ nhật",
    tool_spline: "Đường cong Spline",
    tool_revcloud: "Đám mây hiệu chỉnh (Revcloud)",
    tool_hatch: "Tô mặt cắt (Hatch)",
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
    grp_annotate: "ANNOTATION",
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
  },
  // Korean is an intentional skeleton locale; missing strings fall back to English.
  ko: {}
};

const t = (key) => i18n[currentLang]?.[key] ?? i18n.en[key] ?? key;

function languageControlLabel() {
  if (currentLang === "vi") return "Đổi ngôn ngữ";
  if (currentLang === "ko") return "언어 변경";
  return "Change language";
}

function cycleLanguage(language) {
  const currentIndex = supportedLanguages.indexOf(language);
  return supportedLanguages[(currentIndex + 1 + supportedLanguages.length) % supportedLanguages.length];
}

function readQuickAccessVisibility() {
  try {
    const stored = JSON.parse(localStorage.getItem("concostcad_quick_access") || "{}");
    return Object.fromEntries(["newBtn", "openBtn", "topSaveBtn", "topUndoBtn", "topRedoBtn"].map((id) => [id, stored[id] !== false]));
  } catch (_) {
    return { newBtn: true, openBtn: true, topSaveBtn: true, topUndoBtn: true, topRedoBtn: true };
  }
}
const quickAccessVisibility = readQuickAccessVisibility();

// Application State
let model = {
  title: "Drawing1",
  dirty: false,
  entityCount: 0,
  currentLayer: "0",
  layers: [{ name: "0", frozen: false, off: false, locked: false }],
  entities: []
};

function getRecentDrawings() {
  try {
    const items = JSON.parse(localStorage.getItem("concostcad_recent_drawings") || "[]");
    return Array.isArray(items) ? items.filter((item) => typeof item === "string") : [];
  } catch (_) {
    return [];
  }
}

function getRecentDrawingPreview(path) {
  try {
    const previews = JSON.parse(localStorage.getItem("concostcad_recent_previews") || "{}");
    return typeof previews?.[path] === "string" ? previews[path] : "";
  } catch (_) {
    return "";
  }
}

function captureRecentDrawingPreview() {
  const source = $("#cadCanvas");
  if (!source || !source.width || !source.height) return "";
  try {
    const preview = document.createElement("canvas");
    preview.width = 320;
    preview.height = 180;
    const ctx = preview.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#101318";
    ctx.fillRect(0, 0, preview.width, preview.height);
    const scale = Math.min(preview.width / source.width, preview.height / source.height);
    const width = source.width * scale;
    const height = source.height * scale;
    ctx.drawImage(source, (preview.width - width) / 2, (preview.height - height) / 2, width, height);
    const webp = preview.toDataURL("image/webp", 0.78);
    return webp.startsWith("data:image/webp") ? webp : preview.toDataURL("image/jpeg", 0.78);
  } catch (_) {
    return "";
  }
}

function rememberRecentDrawing(path) {
  if (!path) return;
  const recent = [path, ...getRecentDrawings().filter((item) => item !== path)].slice(0, 8);
  try {
    localStorage.setItem("concostcad_recent_drawings", JSON.stringify(recent));
    const previews = JSON.parse(localStorage.getItem("concostcad_recent_previews") || "{}");
    const preview = captureRecentDrawingPreview();
    if (preview) previews[path] = preview;
    for (const oldPath of Object.keys(previews)) {
      if (!recent.includes(oldPath)) delete previews[oldPath];
    }
    localStorage.setItem("concostcad_recent_previews", JSON.stringify(previews));
  } catch (_) {
    // Keep the recent file list usable when browser storage is full or unavailable.
  }
}

function ribbonModeLabel(mode = ribbonDisplayMode) {
  const labels = currentLang === "vi"
    ? { expanded: "Ribbon đầy đủ", panels: "Chỉ hiện tên panel", tabs: "Chỉ hiện các tab" }
    : { expanded: "Full ribbon", panels: "Panel titles only", tabs: "Tabs only" };
  return labels[mode];
}

function ribbonModeIcon(mode = ribbonDisplayMode) {
  return mode === "expanded" ? "⌃" : mode === "panels" ? "▱" : "⌄";
}

function readBooleanPreferences(key, defaults) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return { ...defaults };
    return Object.fromEntries(Object.entries(defaults).map(([name, value]) => [
      name,
      typeof stored[name] === "boolean" ? stored[name] : value
    ]));
  } catch (_) {
    return { ...defaults };
  }
}

function persistPalettePreferences() {
  try {
    localStorage.setItem("concostcad_palette_visibility", JSON.stringify(paletteVisibility));
    localStorage.setItem("concostcad_palette_collapsed", JSON.stringify(paletteCollapsed));
  } catch (_) {
    // Workspace preferences are optional; storage failures must not interrupt CAD input.
  }
}

let activeRibbonTab = "home";
const savedRibbonDisplayMode = localStorage.getItem("concostcad_ribbon_display_mode");
let ribbonDisplayMode = ["expanded", "panels", "tabs"].includes(savedRibbonDisplayMode)
  ? savedRibbonDisplayMode
  : (localStorage.getItem("concostcad_ribbon_collapsed") === "true" ? "tabs" : "expanded");
let showStartScreen = true;
let startPage = "recent";
let recentViewMode = "grid";
const paletteVisibility = readBooleanPreferences("concostcad_palette_visibility", { properties: true, layers: true });
const paletteCollapsed = readBooleanPreferences("concostcad_palette_collapsed", { properties: false, layers: false });
const savedPropertiesHeight = Number(localStorage.getItem("concostcad_properties_height"));
let propertiesPanelHeight = Number.isFinite(savedPropertiesHeight) && savedPropertiesHeight >= 150
  ? Math.min(savedPropertiesHeight, 600)
  : 310;
const savedSidepanelsWidth = Number(localStorage.getItem("concostcad_sidepanels_width"));
let sidepanelsWidth = Number.isFinite(savedSidepanelsWidth) && savedSidepanelsWidth >= 220
  ? Math.min(savedSidepanelsWidth, 520)
  : 285;
const savedCommandbarHeight = Number(localStorage.getItem("concostcad_commandbar_height"));
let commandbarHeight = Number.isFinite(savedCommandbarHeight) && savedCommandbarHeight >= 56
  ? Math.min(savedCommandbarHeight, 260)
  : 72;
let closeGuardBound = false;
let menuDismissBound = false;
let shellEvents = null;
let appWindowRef = null;
let windowCloseAllowed = false;
let closeConfirmationPending = false;
let activeTool = "select"; // 'select', 'line', 'arc', 'polyline', 'circle', 'rectangle', 'move', 'copy', 'rotate', 'mirror', 'dist', 'area'
let points = [];
let zoom = 1;
let pan = { x: 0, y: 0 };
let viewRotation = 0;
let world = { x: 0, y: 0 };
let isPanning = false;
let lastPan = null;
let selectedHandles = new Set();

// Grip Editing State (Tuần 29)
let activeGrip = null;

// Command History State (Tuần 28)
let commandHistory = [];
let historyIndex = -1;
let commandLog = [];

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
  shellEvents?.dispose();
  document.body.classList.remove("resizing-palette", "resizing-palette-width", "resizing-commandbar");
  const recent = getRecentDrawings();
  const shellTitle = showStartScreen
    ? "CONCOSTCAD"
    : ((model.title || "Drawing1").split(/[\\/]/).pop().replace(/\.(dwg|dxf)$/i, "") || "Drawing1");
  const shellStatus = showStartScreen
    ? (currentLang === "vi" ? "Sẵn sàng · Start" : "Ready · Start")
    : t("ready_status");
  const recentMarkup = recent.length
    ? recent.map((path) => {
        const filename = path.split(/[\\/]/).pop();
        const extension = (filename.split(".").pop() || "DWG").toUpperCase();
        const preview = getRecentDrawingPreview(path);
        return `<article class="recent-drawing">
          <button class="recent-open" data-recent-path="${escapeHtml(path)}" title="${escapeHtml(path)}">
            <span class="recent-thumb" aria-hidden="true"><span class="recent-thumb-mark">${escapeHtml(extension)}</span>${preview ? `<img src="${preview}" alt="">` : `<svg viewBox="0 0 160 90"><path d="M28 62h104M42 27v36M118 27v36M42 27h76M53 47h54M68 35v25M93 35v25"/></svg>`}</span>
            <span class="recent-meta"><strong>${escapeHtml(filename)}</strong><small>${escapeHtml(path)}</small></span>
          </button>
          <details class="recent-actions">
            <summary class="recent-more" title="${currentLang === "vi" ? `Tùy chọn ${escapeHtml(filename)}` : `Options for ${escapeHtml(filename)}`}" aria-label="${currentLang === "vi" ? `Tùy chọn ${escapeHtml(filename)}` : `Options for ${escapeHtml(filename)}`}">•••</summary>
            <div class="recent-actions-menu"><button type="button" data-remove-recent="${escapeHtml(path)}">${currentLang === "vi" ? "Xóa khỏi danh sách gần đây" : "Remove from Recent"}</button></div>
          </details>
        </article>`;
      }).join("")
    : `<div class="start-empty"><span class="start-empty-icon" aria-hidden="true">▧</span><strong>${currentLang === "vi" ? "Chưa có bản vẽ gần đây" : "No recent drawings"}</strong><span>${currentLang === "vi" ? "Mở DWG/DXF hoặc tạo bản vẽ mới để bắt đầu." : "Open a DWG/DXF or create a new drawing to get started."}</span><div class="start-empty-actions"><button id="emptyStartNew">${currentLang === "vi" ? "Bản vẽ mới" : "New Drawing"}</button><button id="emptyStartOpen">${currentLang === "vi" ? "Mở tệp..." : "Open File..."}</button></div></div>`;
  const menuRecentMarkup = recent.slice(0, 9).map((path, index) => {
    const filename = path.split(/[\\/]/).pop();
    return `<button class="menu-recent" type="button" data-menu-recent="${escapeHtml(path)}"><span>${index + 1} ${escapeHtml(filename)}</span></button>`;
  }).join("");
  const menuWindowDocs = openDocuments
    .filter((drawing) => !(showStartScreen && drawing.title === "Drawing1" && !drawing.dirty && drawing.path === "Drawing1"))
    .map((drawing) => `<button type="button" data-menu-window-doc="${drawing.id}" class="${drawing.id === activeDocId && !showStartScreen ? "checked" : ""}"><span>${escapeHtml(drawing.title)}</span>${drawing.id === activeDocId && !showStartScreen ? "✓" : ""}</button>`)
    .join("");
  app.innerHTML = `
    <header class="titlebar">
      <img class="brand-mark" src="/CONCOST.ico" alt="CONCOSTCAD" data-tauri-drag-region>
      <div class="title-divider" data-tauri-drag-region></div>
      <div class="top-quick-access" role="toolbar" aria-label="${currentLang === "vi" ? "Truy cập nhanh" : "Quick access"}">
        <button class="quick-access-button" id="newBtn" data-quick-access="newBtn" ${quickAccessVisibility.newBtn ? "" : "hidden"} title="${t("new_btn")}" aria-label="${t("new_btn")}">${cadIcon("new")}</button>
        <button class="quick-access-button" id="openBtn" data-quick-access="openBtn" ${quickAccessVisibility.openBtn ? "" : "hidden"} title="${t("open_btn")}" aria-label="${t("open_btn")}">${cadIcon("open")}</button>
        <span class="quick-access-divider" data-qat-divider="files" ${((quickAccessVisibility.newBtn || quickAccessVisibility.openBtn) && quickAccessVisibility.topSaveBtn) ? "" : "hidden"} aria-hidden="true"></span>
        <button class="quick-access-button" id="topSaveBtn" data-quick-access="topSaveBtn" ${quickAccessVisibility.topSaveBtn ? "" : "hidden"} title="${t("tool_save")}" aria-label="${t("tool_save")}">${cadIcon("save")}</button>
        <span class="quick-access-divider" data-qat-divider="history" ${((quickAccessVisibility.topUndoBtn || quickAccessVisibility.topRedoBtn) && quickAccessVisibility.topSaveBtn) ? "" : "hidden"} aria-hidden="true"></span>
        <button class="quick-access-button" id="topUndoBtn" data-quick-access="topUndoBtn" ${quickAccessVisibility.topUndoBtn ? "" : "hidden"} title="${t("tool_undo")}" aria-label="${t("tool_undo")}">${cadIcon("undo")}</button>
        <button class="quick-access-button" id="topRedoBtn" data-quick-access="topRedoBtn" ${quickAccessVisibility.topRedoBtn ? "" : "hidden"} title="${t("tool_redo")}" aria-label="${t("tool_redo")}">${cadIcon("redo")}</button>
        <details class="app-menu quick-access-customize">
          <summary class="quick-access-caret" title="${currentLang === "vi" ? "Tùy chỉnh thanh truy cập nhanh" : "Customize Quick Access Toolbar"}" aria-label="${currentLang === "vi" ? "Tùy chỉnh thanh truy cập nhanh" : "Customize Quick Access Toolbar"}">⌄</summary>
          <div class="menu-popup quick-access-popup">
            <strong>${currentLang === "vi" ? "Tùy chỉnh thanh truy cập nhanh" : "Customize Quick Access Toolbar"}</strong>
            ${[["newBtn", currentLang === "vi" ? "Bản vẽ mới" : "New Drawing"], ["openBtn", currentLang === "vi" ? "Mở DWG/DXF" : "Open DWG/DXF"], ["topSaveBtn", currentLang === "vi" ? "Lưu" : "Save"], ["topUndoBtn", currentLang === "vi" ? "Hoàn tác" : "Undo"], ["topRedoBtn", currentLang === "vi" ? "Làm lại" : "Redo"]].map(([id, label]) => `<label><input type="checkbox" data-quick-access-toggle="${id}" ${quickAccessVisibility[id] ? "checked" : ""}><span>${label}</span></label>`).join("")}
          </div>
        </details>
      </div>
      <div class="title-name" id="titleName" data-tauri-drag-region>${escapeHtml(shellTitle)}</div>
      <div class="title-spacer" data-tauri-drag-region></div>
      <button class="title-action" id="langToggleBtn" style="height:22px; padding:0 8px; font-weight:700; color:#8fe2f3; background:#1b3846;" title="${languageControlLabel()}" aria-label="${languageControlLabel()}">${currentLang.toUpperCase()}</button>
      <div class="edition" data-tauri-drag-region>${t("brand_sub")}</div>
      <div class="window-controls">
        <button aria-label="Minimize" id="minimizeBtn">−</button>
        <button aria-label="Maximize" id="maximizeBtn">□</button>
        <button aria-label="Close" id="closeBtn">×</button>
      </div>
    </header>
    <nav class="menubar" aria-label="Application menu">
      <details class="app-menu">
        <summary class="menu-trigger">File</summary>
        <div class="menu-popup file-menu-popup">
          <button id="menuNewDrawing"><span>New...</span><kbd>Ctrl+N</kbd></button>
          <button id="menuOpenDrawing"><span>Open...</span><kbd>Ctrl+O</kbd></button>
          <button type="button" disabled><span>Open Sheet Set...</span></button>
          <button type="button" disabled><span>Open File From Cloud...</span></button>
          <button type="button" disabled><span>Sheet Set Manager...</span></button>
          <button type="button" disabled><span>Recover...</span></button>
          <button type="button" disabled><span>Drawing Recovery Manager...</span></button>
          <button type="button" disabled><span>DWG Convert...</span></button>
          <div class="menu-separator"></div>
          <button id="menuFileCloseDrawing" ${showStartScreen ? "disabled" : ""}><span>Close</span></button>
          <button id="menuSaveDrawing" ${showStartScreen ? "disabled" : ""}><span>Save</span><kbd>Ctrl+S</kbd></button>
          <button id="menuSaveAsDrawing" ${showStartScreen ? "disabled" : ""}><span>Save As...</span></button>
          <div class="menu-separator"></div>
          <button type="button" disabled><span>Print</span><kbd>Ctrl+P</kbd></button>
          ${menuRecentMarkup ? `<div class="menu-separator"></div>${menuRecentMarkup}` : ""}
          <div class="menu-separator"></div>
          <button id="menuExit"><span>Exit</span><kbd>Alt+F4</kbd></button>
        </div>
      </details>
      <details class="app-menu">
        <summary class="menu-trigger">Window</summary>
        <div class="menu-popup">
          <button id="menuCloseDrawing" ${showStartScreen ? "disabled" : ""}><span>Close</span></button>
          <button id="menuCloseAllDrawings" ${showStartScreen ? "disabled" : ""}><span>Close All</span></button>
          <div class="menu-separator"></div>
          <button type="button" disabled><span>Cascade</span></button>
          <button type="button" disabled><span>Tile Horizontally</span></button>
          <button type="button" disabled><span>Tile Vertically</span></button>
          <button type="button" disabled><span>Arrange Icons</span></button>
          ${menuWindowDocs ? `<div class="menu-separator"></div>${menuWindowDocs}` : ""}
          <div class="menu-separator"></div>
          <button id="menuToggleProperties" class="${paletteVisibility.properties ? "checked" : ""}"><span>Properties palette</span>${paletteVisibility.properties ? "✓" : ""}</button>
          <button id="menuToggleLayers" class="${paletteVisibility.layers ? "checked" : ""}"><span>Layer palette</span>${paletteVisibility.layers ? "✓" : ""}</button>
        </div>
      </details>
      <details class="app-menu">
        <summary class="menu-trigger">Help</summary>
        <div class="menu-popup">
          <button id="menuHelp">Help CONCOSTCAD</button>
          <button id="menuKeyboardHelp">Keyboard shortcuts...</button>
          <div class="menu-separator"></div>
          <button id="menuAbout">About CONCOSTCAD</button>
        </div>
      </details>
      <span class="menu-bar-spacer" data-tauri-drag-region></span>
    </nav>
    <nav class="tabs" id="ribbonTabs">
      <button class="tab ${activeRibbonTab==='home'?'active':''}" data-tab="home">${t("tab_home")}</button>
      <button class="tab ${activeRibbonTab==='draw'?'active':''}" data-tab="draw">Draw</button>
      <button class="tab ${activeRibbonTab==='annotate'?'active':''}" data-tab="annotate">Annotate</button>
      <button class="tab ${activeRibbonTab==='view'?'active':''}" data-tab="view">View</button>
      <button class="tab ${activeRibbonTab==='manage'?'active':''}" data-tab="manage">Manage</button>
      <button class="tab ${activeRibbonTab==='output'?'active':''}" data-tab="output">Output</button>
      <button class="ribbon-collapse-toggle" id="ribbonCollapseBtn" aria-label="${currentLang === "vi" ? `Chế độ ribbon: ${ribbonModeLabel()}` : `Ribbon display: ${ribbonModeLabel()}`}" aria-expanded="${ribbonDisplayMode === "expanded"}" title="${currentLang === "vi" ? `Chế độ ribbon: ${ribbonModeLabel()} · nhấn để đổi` : `Ribbon display: ${ribbonModeLabel()} · click to cycle`}">${ribbonModeIcon()}</button>
      <span class="space-label">${t("space_label")}</span>
    </nav>
    <section class="ribbon" id="ribbonContainer"></section>
    <div class="drawing-tab" id="documentTabs"></div>
    <main class="workspace">
      <aside class="quickbar">
        <button title="${t('tool_select')} (Esc)" data-tool="select" class="${activeTool==='select'?'selected':''}">↖</button>
        <button title="${t('tool_line')} (L)" data-tool="line" class="${activeTool==='line'?'selected':''}" aria-label="${t('tool_line')} (L)">${cadIcon("line")}</button>
        <button title="${t('tool_arc')} (A)" data-tool="arc" class="${activeTool==='arc'?'selected':''}" aria-label="${t('tool_arc')} (A)">${cadIcon("arc")}</button>
        <button title="${t('tool_poly')} (PL)" data-tool="polyline" class="${activeTool==='polyline'?'selected':''}" aria-label="${t('tool_poly')} (PL)">${cadIcon("polyline")}</button>
        <button title="${t('tool_circle')} (C)" data-tool="circle" class="${activeTool==='circle'?'selected':''}" aria-label="${t('tool_circle')} (C)">${cadIcon("circle")}</button>
        <button title="${t('tool_rect')} (REC)" data-tool="rectangle" class="${activeTool==='rectangle'?'selected':''}" aria-label="${t('tool_rect')} (REC)">${cadIcon("rectangle")}</button>
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
        <div class="viewport" id="viewport" tabindex="0">
          <canvas id="cadCanvas"></canvas>
          <div class="cad-crosshair" id="cadCrosshair" aria-hidden="true" hidden>
            <i class="crosshair-line crosshair-horizontal-before"></i>
            <i class="crosshair-line crosshair-horizontal-after"></i>
            <i class="crosshair-line crosshair-vertical-before"></i>
            <i class="crosshair-line crosshair-vertical-after"></i>
            <i class="crosshair-pickbox"></i>
          </div>
          <div class="ucs-indicator" id="canvasCoords" title="World Coordinate System" aria-label="World Coordinate System">
            <svg viewBox="-32 -11 80 80" aria-hidden="true">
              <path class="ucs-axis-x" d="M8 29H34M29 24l5 5-5 5" />
              <path class="ucs-axis-y" d="M8 29V4M3 9l5-5 5 5" />
              <circle cx="8" cy="29" r="2" />
              <text class="ucs-label-x" x="31" y="21">X</text>
              <text class="ucs-label-y" x="14" y="9">Y</text>
            </svg>
            <span id="canvasSpaceLabel">WCS</span>
          </div>
          <div class="view-cube" id="viewCube" role="group" aria-label="ViewCube · 2D WCS">
            <button class="cube-home cube-action" title="${currentLang === 'vi' ? 'Home · Hướng Bắc và thu phóng toàn bộ' : 'Home · North up and Zoom Extents'}" aria-label="${currentLang === 'vi' ? 'Hướng Bắc và thu phóng toàn bộ' : 'North up and Zoom Extents'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/></svg></button>
            <span class="cube-compass-ring" aria-hidden="true"></span>
            <button class="cube-direction cube-north" data-cube-heading="N" aria-pressed="true" title="North up">N</button>
            <button class="cube-direction cube-east" data-cube-heading="E" title="East up">E</button>
            <button class="cube-direction cube-south" data-cube-heading="S" title="South up">S</button>
            <button class="cube-direction cube-west" data-cube-heading="W" title="West up">W</button>
            <button class="cube-top-face" id="cubeTopButton" title="${currentLang === 'vi' ? 'Nhấp: hướng Bắc · Kéo ngang: xoay · ←/→: 15° · Shift: 45°' : 'Click: North up · Drag horizontally: rotate · ←/→: 15° · Shift: 45°'}" aria-label="${currentLang === 'vi' ? 'Góc nhìn TOP · Kéo hoặc dùng phím mũi tên để xoay' : 'TOP view · Drag or use arrow keys to rotate'}">TOP</button>
            <button class="cube-action cube-turn-left" data-cube-turn="1" title="${currentLang === 'vi' ? 'Xoay trái 90°' : 'Rotate left 90°'}" aria-label="${currentLang === 'vi' ? 'Xoay trái 90°' : 'Rotate left 90°'}">↶</button>
            <output class="cube-angle" aria-label="${currentLang === 'vi' ? 'Góc xoay vùng nhìn' : 'View rotation'}" aria-live="off">0°</output>
            <button class="cube-action cube-turn-right" data-cube-turn="-1" title="${currentLang === 'vi' ? 'Xoay phải 90°' : 'Rotate right 90°'}" aria-label="${currentLang === 'vi' ? 'Xoay phải 90°' : 'Rotate right 90°'}">↷</button>
          </div>
          <div class="nav-wheel" role="toolbar" aria-label="View navigation">
            <button class="nav-control" id="navZoomExtents" title="Zoom Extents" aria-label="Zoom Extents"><span class="tool-icon"></span></button>
            <button class="nav-control" id="navZoomIn" title="Zoom In" aria-label="Zoom In"><span class="tool-icon"></span></button>
            <button class="nav-control" id="navZoomOut" title="Zoom Out" aria-label="Zoom Out"><span class="tool-icon"></span></button>
          </div>
        </div>
        <div class="layout-tab-bar" id="layoutTabBar" role="tablist" aria-label="${currentLang === "vi" ? "Không gian bản vẽ" : "Drawing spaces"}">
          ${getDrawingSpaces(activeDocId).map((space) => `<button class="layout-tab" role="tab" aria-selected="${space === activeSpace}" data-space="${space}">${space === "model" ? "Model" : `Layout${space.slice(6)}`}</button>`).join("")}
          <button class="layout-add-btn" id="addLayoutBtn" title="Thêm bố cục mới">＋</button>
        </div>
      </section>
      <div class="palette-width-splitter" id="paletteWidthSplitter" role="separator" aria-label="Resize docked palettes" aria-orientation="vertical" aria-valuemin="220" aria-valuemax="520" aria-valuenow="${sidepanelsWidth}" tabindex="0" ${!Object.values(paletteVisibility).some(Boolean) ? "hidden" : ""}></div>
      <aside class="sidepanels ${Object.values(paletteVisibility).some(Boolean) ? "" : "empty"}" style="--properties-panel-height: ${propertiesPanelHeight}px; --sidepanels-width: ${sidepanelsWidth}px">
        <section class="panel properties ${paletteVisibility.properties ? "" : "palette-hidden"} ${paletteCollapsed.properties ? "collapsed" : ""}">
          <div class="panel-heading">
            <span class="panel-grip">⠿</span>
            <span>${t("prop_heading")}</span>
            <button class="panel-collapse" id="toggleProperties" title="Collapse Properties" aria-label="Collapse Properties" aria-expanded="${!paletteCollapsed.properties}">${paletteCollapsed.properties ? "›" : "⌄"}</button>
            <button class="panel-close" id="hideProperties" title="Close Properties" aria-label="Close Properties">×</button>
          </div>
          <div class="panel-body" id="propertiesBody"></div>
        </section>
        <div class="palette-splitter" id="paletteSplitter" role="separator" aria-label="Resize Properties palette" aria-orientation="horizontal" aria-valuemin="150" aria-valuemax="600" aria-valuenow="${propertiesPanelHeight}" tabindex="0" ${!paletteVisibility.properties || !paletteVisibility.layers || paletteCollapsed.properties || paletteCollapsed.layers ? "hidden" : ""}></div>
        <section class="panel layers ${paletteVisibility.layers ? "" : "palette-hidden"} ${paletteCollapsed.layers ? "collapsed" : ""}">
          <div class="panel-heading">
            <span class="panel-grip">⠿</span>
            <span>${t("layer_heading")}</span>
            <button class="panel-collapse" id="toggleLayers" title="Collapse Layers" aria-label="Collapse Layers" aria-expanded="${!paletteCollapsed.layers}">${paletteCollapsed.layers ? "›" : "⌄"}</button>
            <button class="add-layer" id="addLayerBtn" title="${t('add_layer')}">＋</button>
            <button class="panel-close" id="hideLayers" title="Close Layers" aria-label="Close Layers">×</button>
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
    <div class="commandbar-splitter" id="commandbarSplitter" role="separator" aria-label="Resize command line" aria-orientation="horizontal" aria-valuemin="56" aria-valuemax="260" aria-valuenow="${commandbarHeight}" tabindex="0"></div>
    <section class="commandbar" style="--commandbar-height: ${commandbarHeight}px">
      <div class="command-history" id="commandHistory" aria-live="polite"></div>
      <div class="command-entry">
        <div class="prompt-mark">Command:</div>
        <input id="commandInput" autocomplete="off" placeholder="${t('cmd_placeholder')}" />
        <button class="command-send" id="commandSend" title="Execute command">↵</button>
      </div>
    </section>
    <footer class="statusbar">
      <div class="status-message">
        <span class="status-light"></span>
        <span id="status">${shellStatus}</span>
      </div>
      <div class="status-right">
        <span id="coordReadout">X  0.000   Y  0.000</span>
        <span class="status-sep"></span>
        <button id="toggleGridBtn" class="status-toggle active" title="Toggle Grid" aria-label="${t("grid_btn")}" aria-pressed="true"><span class="tool-icon" aria-hidden="true"></span><span>GRID</span></button>
        <button id="toggleSnapBtn" class="status-toggle active" title="Toggle Object Snap (F3)" aria-label="${t("snap_btn")}" aria-pressed="true"><span class="tool-icon" aria-hidden="true"></span><span>OSNAP</span></button>
        <button id="toggleOrthoBtn" class="status-toggle" title="Toggle Ortho Mode (F8)" aria-label="${t("ortho_btn")}" aria-pressed="false"><span class="tool-icon" aria-hidden="true"></span><span>ORTHO</span></button>
        <span class="zoom-readout" id="zoomReadout">100%</span>
        <button class="user-icon" title="Engineer Thanh Phuong">P</button>
      </div>
    </footer>
    <section class="start-screen ${showStartScreen ? "" : "hidden"}" id="startScreen">
      <aside class="start-sidebar">
        <div class="start-sidebar-brand"><span class="start-brand-mark">C</span><div><strong>CONCOSTCAD</strong><small>${currentLang === "vi" ? "Không gian bản vẽ" : "Drafting workspace"}</small></div></div>
        <div class="start-sidebar-actions">
          <button class="start-action" id="startOpenBtn"><span class="start-action-icon" aria-hidden="true">▱</span>${currentLang === "vi" ? "Mở tệp..." : "Open..."}</button>
          <button class="start-action" id="startNewBtn"><span class="start-action-icon" aria-hidden="true">＋</span>${currentLang === "vi" ? "Bản vẽ mới" : "New Drawing"}</button>
        </div>
        <div class="start-sidebar-divider"></div>
        <nav class="start-nav" aria-label="${currentLang === "vi" ? "Điều hướng màn hình bắt đầu" : "Start screen navigation"}">
          <button class="start-nav-item ${startPage === "recent" ? "active" : ""}" data-start-page="recent"><span aria-hidden="true">◷</span>${currentLang === "vi" ? "Gần đây" : "Recent"}</button>
          <button class="start-nav-item ${startPage === "learn" ? "active" : ""}" data-start-page="learn"><span aria-hidden="true">ⓘ</span>${currentLang === "vi" ? "Bắt đầu" : "Getting Started"}</button>
        </nav>
        <div class="start-sidebar-footer">DWG · DXF <span>•</span> mm</div>
      </aside>
      <div class="start-main">
        <section class="start-page-content ${startPage === "recent" ? "active" : ""}" data-start-content="recent">
          <div class="start-main-heading"><div><h1>${currentLang === "vi" ? "Gần đây" : "Recent"}</h1><p>${currentLang === "vi" ? "Tiếp tục làm việc với bản vẽ của bạn" : "Continue working on your drawings"}</p></div>
            <div class="recent-view-toggle" role="group" aria-label="${currentLang === "vi" ? "Kiểu hiển thị bản vẽ" : "Drawing view mode"}">
              <button class="${recentViewMode === "list" ? "active" : ""}" data-recent-mode="list" aria-label="${currentLang === "vi" ? "Danh sách" : "List view"}" aria-pressed="${recentViewMode === "list"}">☰</button>
              <button class="${recentViewMode === "grid" ? "active" : ""}" data-recent-mode="grid" aria-label="${currentLang === "vi" ? "Lưới" : "Grid view"}" aria-pressed="${recentViewMode === "grid"}">▦</button>
            </div>
          </div>
          <div class="recent-grid ${recentViewMode === "list" ? "list-view" : ""} ${recent.length ? "" : "empty-grid"}">${recentMarkup}</div>
        </section>
        <section class="start-page-content start-learn ${startPage === "learn" ? "active" : ""}" data-start-content="learn">
          <div class="start-main-heading"><div><h1>${currentLang === "vi" ? "Bắt đầu với CONCOSTCAD" : "Getting Started"}</h1><p>${currentLang === "vi" ? "Các bước cơ bản để bắt đầu một bản vẽ kỹ thuật 2D." : "A few basics to get your 2D drawing started."}</p></div></div>
          <div class="learn-cards">
            <article class="learn-card"><span class="learn-step">01</span><div><h2>${currentLang === "vi" ? "Tạo hoặc mở bản vẽ" : "Create or open a drawing"}</h2><p>${currentLang === "vi" ? "Tạo bản vẽ trống hoặc mở tệp DWG/DXF từ máy tính." : "Start blank or open a DWG/DXF file from your computer."}</p></div><button id="learnNewBtn">${currentLang === "vi" ? "Bản vẽ mới" : "New Drawing"}</button><button id="learnOpenBtn">${currentLang === "vi" ? "Mở tệp" : "Open File"}</button></article>
            <article class="learn-card"><span class="learn-step">02</span><div><h2>${currentLang === "vi" ? "Vẽ hình học" : "Draw geometry"}</h2><p>${currentLang === "vi" ? "Chọn LINE, ARC hoặc PLINE trên thanh công cụ, rồi chỉ điểm trên vùng vẽ." : "Choose LINE, ARC, or PLINE from the ribbon, then specify points on the canvas."}</p></div><span class="learn-command">LINE · ARC · PLINE</span></article>
            <article class="learn-card"><span class="learn-step">03</span><div><h2>${currentLang === "vi" ? "Lưu tệp" : "Save your work"}</h2><p>${currentLang === "vi" ? "Lưu bản vẽ dưới định dạng DWG hoặc DXF." : "Save your drawing as a DWG or DXF file."}</p></div><span class="learn-command">DWG · DXF</span></article>
          </div>
        </section>
      </div>
    </section>
  `;

  applyRibbonDisplayMode();
  renderCommandLog();
  applyToolbarIcons();
  bindShellEvents();
  shellEvents = mountShellEvents({ viewport: $("#viewport"), onResize: resize, onKeyDown: handleGlobalKeyDown });
}

function setRibbonDisplayMode(mode) {
  ribbonDisplayMode = mode;
  localStorage.setItem("concostcad_ribbon_display_mode", ribbonDisplayMode);
  applyRibbonDisplayMode();
}

function applyRibbonDisplayMode() {
  const appRoot = $("#app");
  if (!appRoot) return;
  appRoot.classList.remove("ribbon-mode-expanded", "ribbon-mode-panels", "ribbon-mode-tabs", "ribbon-collapsed");
  appRoot.classList.add(`ribbon-mode-${ribbonDisplayMode}`);
  const button = $("#ribbonCollapseBtn");
  if (button) {
    button.textContent = ribbonModeIcon();
    button.setAttribute("aria-expanded", String(ribbonDisplayMode === "expanded"));
    button.setAttribute("aria-label", currentLang === "vi" ? `Chế độ ribbon: ${ribbonModeLabel()}` : `Ribbon display: ${ribbonModeLabel()}`);
    button.title = currentLang === "vi" ? `Chế độ ribbon: ${ribbonModeLabel()} · nhấn để đổi` : `Ribbon display: ${ribbonModeLabel()} · click to cycle`;
  }
  $$("#ribbonContainer .group-caption").forEach((caption) => {
    if (ribbonDisplayMode === "panels") {
      caption.setAttribute("role", "button");
      caption.tabIndex = 0;
      caption.title = currentLang === "vi" ? "Nhấn để mở ribbon đầy đủ" : "Click to expand the ribbon";
      caption.onclick = () => setRibbonDisplayMode("expanded");
      caption.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setRibbonDisplayMode("expanded");
        }
      };
    } else {
      caption.removeAttribute("role");
      caption.removeAttribute("tabindex");
      caption.removeAttribute("title");
      caption.onclick = null;
      caption.onkeydown = null;
    }
  });
}

function bindShellEvents() {
  const canvasEl = $("#cadCanvas");
  const viewportEl = $("#viewport");
  const crosshairEl = $("#cadCrosshair");

  viewportEl?.addEventListener("pointermove", (event) => {
    if (!crosshairEl || event.pointerType === "touch") return;
    const bounds = viewportEl.getBoundingClientRect();
    crosshairEl.style.setProperty("--crosshair-x", `${event.clientX - bounds.left}px`);
    crosshairEl.style.setProperty("--crosshair-y", `${event.clientY - bounds.top}px`);
    crosshairEl.hidden = false;
    viewportEl.classList.add("crosshair-active");
  });
  viewportEl?.addEventListener("pointerleave", () => {
    if (crosshairEl) crosshairEl.hidden = true;
    viewportEl.classList.remove("crosshair-active");
  });

  $("#langToggleBtn").onclick = () => {
    currentLang = cycleLanguage(currentLang);
    localStorage.setItem("concostcad_lang", currentLang);
    renderShell();
    renderRibbon();
    render();
  };

  $$("#ribbonTabs .tab").forEach((tab) => {
    tab.onclick = () => {
      if (ribbonDisplayMode !== "expanded") setRibbonDisplayMode("expanded");
      $$("#ribbonTabs .tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeRibbonTab = tab.dataset.tab;
      renderRibbon();
    };
    tab.ondblclick = () => {
      setRibbonDisplayMode(ribbonDisplayMode === "expanded" ? "tabs" : "expanded");
    };
  });
  $("#ribbonCollapseBtn").onclick = () => {
    const nextMode = ribbonDisplayMode === "expanded" ? "panels" : ribbonDisplayMode === "panels" ? "tabs" : "expanded";
    setRibbonDisplayMode(nextMode);
  };

  $$(".quickbar [data-tool]").forEach((b) => {
    b.onclick = () => chooseTool(b.dataset.tool);
  });

  $("#newBtn").onclick = async () => {
    const reuseEmptyStartDrawing = showStartScreen && hasOnlyEmptyScratchDrawing();
    enterEditor();
    if (!reuseEmptyStartDrawing && await sync(invoke("new_drawing"))) updateActiveDocumentTab();
    points = [];
    pan = { x: 0, y: 0 };
    zoom = 1;
    setViewRotation(0);
    setStatus(t("ready_status"));
  };

  $("#openBtn").onclick = openDrawing;
  $("#topSaveBtn").onclick = saveDrawing;
  $("#topUndoBtn").onclick = undoAction;
  $("#topRedoBtn").onclick = redoAction;
  $("#startNewBtn").onclick = () => $("#newBtn").click();
  $("#startOpenBtn").onclick = openDrawing;
  $("#emptyStartNew")?.addEventListener("click", () => $("#newBtn").click());
  $("#emptyStartOpen")?.addEventListener("click", openDrawing);
  $("#learnNewBtn")?.addEventListener("click", () => $("#newBtn").click());
  $("#learnOpenBtn")?.addEventListener("click", openDrawing);
  $$(".start-nav-item").forEach((button) => {
    button.onclick = () => {
      startPage = button.dataset.startPage;
      $$(".start-nav-item").forEach((item) => item.classList.toggle("active", item === button));
      $$("[data-start-content]").forEach((panel) => panel.classList.toggle("active", panel.dataset.startContent === startPage));
    };
  });
  $$("[data-recent-mode]").forEach((button) => {
    button.onclick = () => {
      recentViewMode = button.dataset.recentMode;
      $$("[data-recent-mode]").forEach((item) => {
        const active = item.dataset.recentMode === recentViewMode;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      $(".recent-grid")?.classList.toggle("list-view", recentViewMode === "list");
    };
  });
  $$(".app-menu").forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (menu.open) $$(".app-menu").forEach((other) => { if (other !== menu) other.open = false; });
    });
  });
  $$(".recent-actions").forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (menu.open) $$(".recent-actions").forEach((other) => { if (other !== menu) other.open = false; });
    });
  });
  $$('[data-quick-access-toggle]').forEach((toggle) => {
    toggle.onchange = () => {
      const id = toggle.dataset.quickAccessToggle;
      quickAccessVisibility[id] = toggle.checked;
      localStorage.setItem("concostcad_quick_access", JSON.stringify(quickAccessVisibility));
      const actionButton = document.getElementById(id);
      if (actionButton) actionButton.hidden = !toggle.checked;
      const hasFileActions = quickAccessVisibility.newBtn || quickAccessVisibility.openBtn;
      const hasHistoryActions = quickAccessVisibility.topUndoBtn || quickAccessVisibility.topRedoBtn;
      const fileDivider = $('[data-qat-divider="files"]');
      const historyDivider = $('[data-qat-divider="history"]');
      if (fileDivider) fileDivider.hidden = !hasFileActions || !quickAccessVisibility.topSaveBtn;
      if (historyDivider) historyDivider.hidden = !quickAccessVisibility.topSaveBtn || !hasHistoryActions;
    };
  });
  const closeMenus = () => $$(".app-menu[open]").forEach((menu) => { menu.open = false; });
  const closeRecentActions = () => $$(".recent-actions[open]").forEach((menu) => { menu.open = false; });
  if (!menuDismissBound) {
    menuDismissBound = true;
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".app-menu")) closeMenus();
      if (!event.target.closest(".recent-actions")) closeRecentActions();
    });
  }
  const menuAction = (id, action) => {
    const button = document.getElementById(id);
    if (button) button.onclick = () => { closeMenus(); action(); };
  };
  syncViewNavigation();
  menuAction("menuNewDrawing", () => $("#newBtn").click());
  menuAction("menuOpenDrawing", openDrawing);
  menuAction("menuSaveDrawing", saveDrawing);
  menuAction("menuSaveAsDrawing", saveDrawingAs);
  menuAction("menuFileCloseDrawing", closeCurrentDrawing);
  menuAction("menuCloseDrawing", closeCurrentDrawing);
  menuAction("menuCloseAllDrawings", async () => {
    for (const drawing of [...openDocuments]) {
      if (!await closeDocumentTab(drawing.id)) break;
    }
  });
  menuAction("menuExit", () => $("#closeBtn").click());
  menuAction("menuToggleProperties", () => setPaletteVisibility("properties", !paletteVisibility.properties));
  menuAction("menuToggleLayers", () => setPaletteVisibility("layers", !paletteVisibility.layers));
  menuAction("menuKeyboardHelp", () => {
    setStatus(currentLang === "vi" ? "L: LINE · PL: PLINE · C: CIRCLE · E: ERASE · Ctrl+S: SAVE · F3: OSNAP · F8: ORTHO" : "L: LINE · PL: PLINE · C: CIRCLE · E: ERASE · Ctrl+S: SAVE · F3: OSNAP · F8: ORTHO");
    $("#commandInput")?.focus();
  });
  menuAction("menuHelp", () => setStatus(currentLang === "vi" ? "Trợ giúp: nhập lệnh ở dòng lệnh phía dưới hoặc chọn công cụ trên ribbon." : "Help: enter commands on the command line or choose a tool from the ribbon."));
  menuAction("menuAbout", () => setStatus("CONCOSTCAD · Rust Edition 2.0 · 2D Drafting"));
  $$("[data-menu-recent]").forEach((button) => {
    button.onclick = () => { closeMenus(); openDrawing(button.dataset.menuRecent); };
  });
  $$("[data-menu-window-doc]").forEach((button) => {
    button.onclick = async () => {
      closeMenus();
      const id = Number(button.dataset.menuWindowDoc);
      if (showStartScreen) enterEditor();
      if (id !== activeDocId) await sync(invoke("switch_drawing", { id }));
    };
  });
  $$(".recent-open").forEach((button) => {
    button.onclick = () => openDrawing(button.dataset.recentPath);
  });
  $$('[data-remove-recent]').forEach((button) => {
    button.onclick = () => {
      const path = button.dataset.removeRecent;
      try {
        localStorage.setItem("concostcad_recent_drawings", JSON.stringify(getRecentDrawings().filter((item) => item !== path)));
        const previews = JSON.parse(localStorage.getItem("concostcad_recent_previews") || "{}");
        if (previews && typeof previews === "object") {
          delete previews[path];
          localStorage.setItem("concostcad_recent_previews", JSON.stringify(previews));
        }
      } catch (_) {
        setStatus(currentLang === "vi" ? "Không thể cập nhật danh sách gần đây" : "Could not update recent drawings");
        return;
      }
      showStartTab();
    };
  });
  $("#toggleGridBtn").onclick = toggleGrid;
  $("#toggleSnapBtn").onclick = toggleSnap;
  $("#toggleOrthoBtn").onclick = toggleOrtho;
  $("#navZoomExtents").onclick = zoomToExtents;
  $("#navZoomIn").onclick = () => { zoom *= 1.25; draw(); };
  $("#navZoomOut").onclick = () => { zoom /= 1.25; draw(); };
  const navControls = $(".nav-wheel");
  for (const name of ["pointerdown", "pointermove", "pointerup", "dblclick", "contextmenu", "wheel"]) {
    navControls.addEventListener(name, (event) => {
      event.stopPropagation();
      if (name === "wheel" || name === "contextmenu") event.preventDefault();
    }, { passive: false });
  }
  navControls.addEventListener("pointerenter", () => {
    crosshairEl.hidden = true;
    viewportEl.classList.remove("crosshair-active");
    currentSnap = null;
    draw();
  });
  bindViewCube($("#viewCube"), {
    getRotation: () => viewRotation,
    setRotation: setViewRotation,
    home: () => {
      setViewRotation(0);
      const visible = model.entities.some((entity) => {
        const layer = model.layers.find((item) => item.name === entity.layer);
        return !layer || (!layer.off && !layer.frozen);
      });
      if (visible) zoomToExtents();
      else { zoom = 1; pan = { x: 0, y: 0 }; draw(); }
    },
    onEnter: () => {
      crosshairEl.hidden = true;
      viewportEl.classList.remove("crosshair-active");
      currentSnap = null;
      draw();
    },
  });
  $("#toggleProperties").onclick = () => togglePaletteCollapsed("properties");
  $("#toggleLayers").onclick = () => togglePaletteCollapsed("layers");
  $("#hideProperties").onclick = () => setPaletteVisibility("properties", false);
  $("#hideLayers").onclick = () => setPaletteVisibility("layers", false);
  bindPaletteSplitter();
  bindPaletteWidthSplitter();
  bindCommandbarSplitter();

  const appWindow = getCurrentWindow();
  appWindowRef = appWindow;
  const requestWindowClose = async () => {
    if (windowCloseAllowed || closeConfirmationPending) return;
    closeConfirmationPending = true;
    try {
      if (openDocuments.some((drawing) => drawing.dirty)) {
        const message = currentLang === "vi"
          ? "Có bản vẽ chưa được lưu. Bạn có muốn đóng mà không lưu không?"
          : "Some drawings have unsaved changes. Close without saving?";
        const confirmed = await ask(message, {
          title: "CONCOSTCAD",
          kind: "warning",
          okLabel: currentLang === "vi" ? "Đóng không lưu" : "Close without saving",
          cancelLabel: currentLang === "vi" ? "Hủy" : "Cancel",
        });
        if (!confirmed) {
          setStatus(t("ready_status"));
          return;
        }
      }
      windowCloseAllowed = true;
      await appWindow.destroy();
    } catch (error) {
      windowCloseAllowed = false;
      console.error("Failed to close the application window", error);
      setStatus(`${currentLang === "vi" ? "Không thể đóng cửa sổ" : "Could not close window"}: ${String(error)}`);
    } finally {
      closeConfirmationPending = false;
    }
  };
  $("#minimizeBtn").onclick = async (event) => {
    event.stopPropagation();
    await appWindow.minimize();
  };
  $("#maximizeBtn").onclick = async (event) => {
    event.stopPropagation();
    await appWindow.toggleMaximize();
  };
  $("#closeBtn").onclick = async (event) => {
    event.stopPropagation();
    setStatus(currentLang === "vi" ? "Đang đóng cửa sổ..." : "Closing window...");
    await requestWindowClose();
  };
  if (!closeGuardBound) {
    closeGuardBound = true;
    appWindow.onCloseRequested((event) => {
      if (windowCloseAllowed || !openDocuments.some((drawing) => drawing.dirty)) return;
      event.preventDefault();
      void requestWindowClose();
    });
  }

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
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) $("#confirmAddLayer").click();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      $("#newLayerContainer").style.display = "none";
      isAddingLayer = false;
      $("#viewport").focus({ preventScroll: true });
    }
  });

  bindCanvasEvents(viewportEl, canvasEl);

  $$(".layout-tab").forEach((btn) => {
    btn.onclick = () => activateDrawingSpace(btn.dataset.space);
  });
  const addLayBtn = $("#addLayoutBtn");
  if (addLayBtn) {
    addLayBtn.onclick = () => {
      const bar = $("#layoutTabBar");
      const spaces = getDrawingSpaces(activeDocId);
      const num = spaces.reduce((max, space) => Math.max(max, Number(space.replace("layout", "")) || 0), 0) + 1;
      const newBtn = document.createElement("button");
      newBtn.className = "layout-tab";
      newBtn.setAttribute("role", "tab");
      newBtn.setAttribute("aria-selected", "false");
      newBtn.dataset.space = `layout${num}`;
      newBtn.textContent = `Layout${num}`;
      spaces.push(newBtn.dataset.space);
      newBtn.onclick = () => activateDrawingSpace(newBtn.dataset.space);
      bar.insertBefore(newBtn, addLayBtn);
      newBtn.click();
    };
  }
  syncActiveLayoutTab();
  bindCommandBarEvents();
}

function hasOnlyEmptyScratchDrawing() {
  return openDocuments.length === 1
    && /^Drawing\d+$/i.test(openDocuments[0].title)
    && model.entityCount === 0
    && !model.dirty
    && !openDocuments[0].dirty;
}

function enterEditor() {
  showStartScreen = false;
  activeRibbonTab = "home";
  $$("#ribbonTabs .tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === activeRibbonTab));
  const start = $("#startScreen");
  if (start) start.remove();
  renderRibbon();
  renderDocumentTabs();
  render();
}

function refreshPalette(name) {
  const panel = $(`.panel.${name}`);
  if (!panel) return;
  panel.classList.toggle("palette-hidden", !paletteVisibility[name]);
  panel.classList.toggle("collapsed", paletteCollapsed[name]);
  const toggle = $(`#toggle${name === "properties" ? "Properties" : "Layers"}`);
  if (toggle) {
    const label = name === "properties" ? "Properties" : "Layers";
    const action = paletteCollapsed[name] ? "Expand" : "Collapse";
    toggle.textContent = paletteCollapsed[name] ? "›" : "⌄";
    toggle.title = `${action} ${label}`;
    toggle.setAttribute("aria-label", `${action} ${label}`);
    toggle.setAttribute("aria-expanded", String(!paletteCollapsed[name]));
  }
  const sidepanels = $(".sidepanels");
  if (sidepanels) sidepanels.classList.toggle("empty", !Object.values(paletteVisibility).some(Boolean));
  const splitter = $("#paletteSplitter");
  if (splitter) splitter.hidden = !paletteVisibility.properties || !paletteVisibility.layers || paletteCollapsed.properties || paletteCollapsed.layers;
  const widthSplitter = $("#paletteWidthSplitter");
  if (widthSplitter) widthSplitter.hidden = !Object.values(paletteVisibility).some(Boolean);
}

function togglePaletteCollapsed(name) {
  paletteCollapsed[name] = !paletteCollapsed[name];
  persistPalettePreferences();
  refreshPalette(name);
}

function setPaletteVisibility(name, visible) {
  paletteVisibility[name] = visible;
  persistPalettePreferences();
  refreshPalette(name);
  renderRibbon();
}

function bindPaletteSplitter() {
  const splitter = $("#paletteSplitter");
  const sidepanels = $(".sidepanels");
  if (!splitter || !sidepanels) return;

  const applyHeight = (nextHeight, persist = false) => {
    const maxHeight = Math.max(150, sidepanels.clientHeight - 150);
    propertiesPanelHeight = Math.round(Math.min(maxHeight, Math.max(150, nextHeight)));
    sidepanels.style.setProperty("--properties-panel-height", `${propertiesPanelHeight}px`);
    splitter.setAttribute("aria-valuenow", String(propertiesPanelHeight));
    if (persist) localStorage.setItem("concostcad_properties_height", String(propertiesPanelHeight));
  };
  applyHeight(propertiesPanelHeight);

  splitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = $(".panel.properties")?.getBoundingClientRect().height ?? propertiesPanelHeight;
    document.body.classList.add("resizing-palette");
    const move = (pointerEvent) => applyHeight(startHeight + pointerEvent.clientY - startY);
    const finish = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      document.body.classList.remove("resizing-palette");
      applyHeight(propertiesPanelHeight, true);
    };
    document.addEventListener("pointermove", move, { signal: shellEvents.signal });
    document.addEventListener("pointerup", finish, { once: true, signal: shellEvents.signal });
    document.addEventListener("pointercancel", finish, { once: true, signal: shellEvents.signal });
  });

  splitter.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    applyHeight(propertiesPanelHeight + (event.key === "ArrowDown" ? 16 : -16), true);
  });
}

function bindPaletteWidthSplitter() {
  const splitter = $("#paletteWidthSplitter");
  const sidepanels = $(".sidepanels");
  const workspace = $(".workspace");
  if (!splitter || !sidepanels || !workspace) return;

  const applyWidth = (nextWidth, persist = false) => {
    const maxWidth = Math.max(220, Math.min(520, workspace.clientWidth - 500));
    sidepanelsWidth = Math.round(Math.min(maxWidth, Math.max(220, nextWidth)));
    sidepanels.style.setProperty("--sidepanels-width", `${sidepanelsWidth}px`);
    splitter.setAttribute("aria-valuenow", String(sidepanelsWidth));
    if (persist) localStorage.setItem("concostcad_sidepanels_width", String(sidepanelsWidth));
  };
  applyWidth(sidepanelsWidth);

  splitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidepanels.getBoundingClientRect().width;
    document.body.classList.add("resizing-palette-width");
    const move = (pointerEvent) => applyWidth(startWidth + startX - pointerEvent.clientX);
    const finish = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      document.body.classList.remove("resizing-palette-width");
      applyWidth(sidepanelsWidth, true);
    };
    document.addEventListener("pointermove", move, { signal: shellEvents.signal });
    document.addEventListener("pointerup", finish, { once: true, signal: shellEvents.signal });
    document.addEventListener("pointercancel", finish, { once: true, signal: shellEvents.signal });
  });

  splitter.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    applyWidth(sidepanelsWidth + (event.key === "ArrowLeft" ? 16 : -16), true);
  });
}

function bindCommandbarSplitter() {
  const splitter = $("#commandbarSplitter");
  const commandbar = $(".commandbar");
  const app = $("#app");
  if (!splitter || !commandbar || !app) return;

  const applyHeight = (nextHeight, persist = false) => {
    const maxHeight = Math.max(56, Math.min(260, app.clientHeight - 340));
    commandbarHeight = Math.round(Math.min(maxHeight, Math.max(56, nextHeight)));
    commandbar.style.setProperty("--commandbar-height", `${commandbarHeight}px`);
    splitter.setAttribute("aria-valuenow", String(commandbarHeight));
    if (persist) localStorage.setItem("concostcad_commandbar_height", String(commandbarHeight));
  };
  applyHeight(commandbarHeight);

  splitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = commandbar.getBoundingClientRect().height;
    document.body.classList.add("resizing-commandbar");
    const move = (pointerEvent) => applyHeight(startHeight + startY - pointerEvent.clientY);
    const finish = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      document.body.classList.remove("resizing-commandbar");
      applyHeight(commandbarHeight, true);
    };
    document.addEventListener("pointermove", move, { signal: shellEvents.signal });
    document.addEventListener("pointerup", finish, { once: true, signal: shellEvents.signal });
    document.addEventListener("pointercancel", finish, { once: true, signal: shellEvents.signal });
  });

  splitter.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    applyHeight(commandbarHeight + (event.key === "ArrowUp" ? 16 : -16), true);
  });
}

function showStartTab() {
  showStartScreen = true;
  activeRibbonTab = "home";
  renderShell();
  renderRibbon();
  render();
}

async function closeDocumentTab(id) {
  const drawing = openDocuments.find((document) => document.id === id);
  if (!drawing) return false;
  if (drawing.dirty) {
    const message = currentLang === "vi"
      ? "Bản vẽ chưa được lưu. Đóng bản vẽ không lưu?"
      : "This drawing has unsaved changes. Close without saving?";
    if (!window.confirm(message)) return false;
  }
  const closingLast = openDocuments.length === 1;
  if (!await sync(invoke("close_drawing", { id, discard: true }))) return false;
  drawingViewStates.delete(id);
  drawingLayoutSpaces.delete(id);
  drawingSelections.delete(id);
  if (closingLast) showStartTab();
  setStatus(currentLang === "vi" ? "Đã đóng bản vẽ" : "Drawing closed");
  return true;
}

async function closeCurrentDrawing() {
  return closeDocumentTab(activeDocId);
}

function updateActiveDocumentTab() {
  const active = openDocuments.find((d) => d.id === activeDocId);
  if (!active) return;
  active.title = (model.title || "Drawing1").split(/[\\/]/).pop();
  active.path = model.title;
  active.dirty = Boolean(model.dirty);
  renderDocumentTabs();
}

let showGrid = true;
let activeSpace = "model";
const drawingViewStates = new Map();
const drawingLayoutSpaces = new Map();
const drawingSelections = new Map();
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

function captureActiveDrawingView() {
  return { zoom, pan: { x: pan.x, y: pan.y }, viewRotation, activeSpace };
}

function activateDrawingSpace(space) {
  activeSpace = space;
  syncActiveLayoutTab();
  setStatus(space === "model" ? "Không gian mô hình (Model Space)" : `Không gian giấy (Paper Space - ${space.toUpperCase()})`);
  draw();
}

function getDrawingSpaces(documentId) {
  let spaces = drawingLayoutSpaces.get(documentId);
  if (!spaces) {
    spaces = ["model", "layout1", "layout2"];
    drawingLayoutSpaces.set(documentId, spaces);
  }
  return spaces;
}

function syncActiveLayoutTab() {
  const bar = $("#layoutTabBar");
  const allowedSpaces = getDrawingSpaces(activeDocId);
  const addButton = $("#addLayoutBtn");
  allowedSpaces.forEach((space) => {
    if (bar?.querySelector(`[data-space="${space}"]`)) return;
    const button = document.createElement("button");
    button.className = "layout-tab";
    button.dataset.space = space;
    button.setAttribute("role", "tab");
    button.textContent = space === "model" ? "Model" : `Layout${space.slice(6)}`;
    button.onclick = () => activateDrawingSpace(space);
    bar.insertBefore(button, addButton);
  });
  $$(".layout-tab").forEach((button) => {
    const visible = allowedSpaces.includes(button.dataset.space);
    button.hidden = !visible;
    const active = visible && button.dataset.space === activeSpace;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function restoreDrawingView(documentId) {
  const saved = drawingViewStates.get(documentId);
  zoom = Number.isFinite(saved?.zoom) && saved.zoom > 0 ? saved.zoom : 1;
  pan = Number.isFinite(saved?.pan?.x) && Number.isFinite(saved?.pan?.y)
    ? { x: saved.pan.x, y: saved.pan.y }
    : { x: 0, y: 0 };
  viewRotation = Number.isFinite(saved?.viewRotation) ? saved.viewRotation : 0;
  activeSpace = typeof saved?.activeSpace === "string" ? saved.activeSpace : "model";
  currentSnap = null;
  syncViewNavigation();
  syncActiveLayoutTab();
}

function restoreDrawingSelection(documentId) {
  const saved = drawingSelections.get(documentId) || new Set();
  const availableHandles = new Set((model.entities || []).map((entity) => entity.handle));
  selectedHandles = new Set(Array.from(saved).filter((handle) => availableHandles.has(handle)));
  drawingSelections.set(documentId, new Set(selectedHandles));
}

function cancelInteractionForDrawingSwitch() {
  activeTool = "select";
  points = [];
  moveBasePoint = null;
  activeGrip = null;
  offsetTargetHandle = null;
  isBoxSelecting = false;
  boxStart = null;
  boxCurrent = null;
  isPanning = false;
  lastPan = null;
  currentSnap = null;
  const commandInput = $("#commandInput");
  if (commandInput) commandInput.placeholder = t("cmd_placeholder");
  setStatus(t("ready_status"));
}

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

function logCommand(text, kind = "prompt") {
  if (!text) return;
  commandLog.push({ text, kind });
  if (commandLog.length > 80) commandLog.shift();
  renderCommandLog();
}

function renderCommandLog() {
  const history = $("#commandHistory");
  if (history) {
    history.innerHTML = commandLog.slice(-5).map((entry) => `<div class="command-line ${entry.kind}">${escapeHtml(entry.text)}</div>`).join("");
    history.scrollTop = history.scrollHeight;
  }
}

// Coordinate Transforms
function worldToScreen(x, y) {
  const canvas = $("#cadCanvas");
  const cos = Math.cos(viewRotation), sin = Math.sin(viewRotation);
  const viewX = x * cos - y * sin;
  const viewY = x * sin + y * cos;
  return {
    x: canvas.clientWidth / 2 + pan.x + viewX * zoom,
    y: canvas.clientHeight / 2 + pan.y - viewY * zoom
  };
}

function screenToWorld(x, y) {
  const canvas = $("#cadCanvas");
  const cos = Math.cos(viewRotation), sin = Math.sin(viewRotation);
  const viewX = (x - canvas.clientWidth / 2 - pan.x) / zoom;
  const viewY = -(y - canvas.clientHeight / 2 - pan.y) / zoom;
  return {
    x: viewX * cos + viewY * sin,
    y: -viewX * sin + viewY * cos
  };
}

function syncViewNavigation() {
  updateViewCube($("#viewCube"), viewRotation);
  // Centering the UCS glyph leaves room for every orientation. Text stays upright.
  const svg = $("#canvasCoords svg");
  svg?.querySelectorAll("path, circle").forEach((element) => {
    element.setAttribute("transform", `rotate(${-viewRotation * 180 / Math.PI} 8 29)`);
  });
  svg?.querySelectorAll("text").forEach((element, index) => {
    const a = viewRotation + (index === 0 ? 0 : Math.PI / 2);
    element.setAttribute("x", String(8 + 32 * Math.cos(a)));
    element.setAttribute("y", String(32 - 32 * Math.sin(a)));
  });
}

function setViewRotation(angle) {
  if (!Number.isFinite(angle)) return;
  const nextRotation = normalizeRotation(angle);
  pan = rotationAroundCenter(pan, viewRotation, nextRotation);
  viewRotation = nextRotation;
  currentSnap = null;
  syncViewNavigation();
  draw();
}

function fitWorldBounds(minX, maxX, minY, maxY, padding = 80) {
  const canvas = $("#cadCanvas");
  if (!canvas) return;
  const cos = Math.cos(viewRotation), sin = Math.sin(viewRotation);
  const corners = [
    { x: minX, y: minY }, { x: minX, y: maxY },
    { x: maxX, y: minY }, { x: maxX, y: maxY }
  ].map(({ x, y }) => ({ x: x * cos - y * sin, y: x * sin + y * cos }));
  const left = Math.min(...corners.map((p) => p.x));
  const right = Math.max(...corners.map((p) => p.x));
  const bottom = Math.min(...corners.map((p) => p.y));
  const top = Math.max(...corners.map((p) => p.y));
  const spanX = Math.max(1, right - left);
  const spanY = Math.max(1, top - bottom);
  zoom = Math.max(0.0001, Math.min((canvas.clientWidth - padding * 2) / spanX, (canvas.clientHeight - padding * 2) / spanY));
  pan.x = -((left + right) / 2) * zoom;
  pan.y = ((bottom + top) / 2) * zoom;
}

// Bulge Geometry
const MAX_ARC_TESSELLATION_SEGMENTS = 2048;

function arcTessellationSegments(sweep, radius, targetPixelStep, minimum = 8) {
  if (![sweep, radius, zoom, targetPixelStep].every(Number.isFinite) || targetPixelStep <= 0) {
    return minimum;
  }
  const projectedLength = Math.abs(sweep) * Math.abs(radius) * Math.max(0, zoom);
  if (!Number.isFinite(projectedLength)) return MAX_ARC_TESSELLATION_SEGMENTS;
  return Math.min(
    MAX_ARC_TESSELLATION_SEGMENTS,
    Math.max(minimum, Math.ceil(projectedLength / targetPixelStep))
  );
}

function bulgeGeometry(p1, p2, bulge) {
  if (!Number.isFinite(bulge) || Math.abs(bulge) < 1e-10) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy);
  if (!Number.isFinite(chord) || chord === 0) return null;
  const sweep = 4 * Math.atan(bulge);
  const sinHalfSweep = Math.sin(Math.abs(sweep) / 2);
  const tanHalfSweep = Math.tan(sweep / 2);
  if (Math.abs(sinHalfSweep) <= 1e-12 || Math.abs(tanHalfSweep) <= 1e-12) return null;
  const radius = chord / (2 * sinHalfSweep);
  const offset = chord / (2 * tanHalfSweep);
  const center = {
    x: (p1.x + p2.x) * 0.5 - (dy / chord) * offset,
    y: (p1.y + p2.y) * 0.5 + (dx / chord) * offset
  };
  if (![radius, offset, center.x, center.y].every(Number.isFinite) || radius <= 0) return null;
  const startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
  return { center, radius, startAngle, sweep };
}

// Use Rust geometry as the picking oracle; selection is queried only on click,
// while pointer-move rendering remains local and responsive.
async function hitTestEntity(worldPoint, tolerance) {
  try {
    const handle = await invoke("hit_test_entity", {
      x: worldPoint.x,
      y: worldPoint.y,
      tolerance,
      zoom
    });
    return handle == null ? null : model.entities.find((entity) => entity.handle === handle) || null;
  } catch (error) {
    setStatus(String(error));
    return null;
  }
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
    if (e.bounds && [e.bounds.minX, e.bounds.maxX, e.bounds.minY, e.bounds.maxY].every(Number.isFinite)) {
      return {
        minX: e.bounds.minX,
        maxX: e.bounds.maxX,
        minY: e.bounds.minY,
        maxY: e.bounds.maxY
      };
    }
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
  p1 = worldToScreen(p1.x, p1.y);
  p2 = worldToScreen(p2.x, p2.y);
  const isWindow = p2.x >= p1.x; // Screen Left-to-Right = Window
  const boxMinX = Math.min(p1.x, p2.x);
  const boxMaxX = Math.max(p1.x, p2.x);
  const boxMinY = Math.min(p1.y, p2.y);
  const boxMaxY = Math.max(p1.y, p2.y);

  const matched = [];

  for (const e of model.entities) {
    const layerObj = model.layers.find((l) => l.name === e.layer);
    if (layerObj && (layerObj.off || layerObj.frozen)) continue;

    const worldBounds = getEntityBounds(e);
    const corners = [
      worldToScreen(worldBounds.minX, worldBounds.minY), worldToScreen(worldBounds.minX, worldBounds.maxY),
      worldToScreen(worldBounds.maxX, worldBounds.minY), worldToScreen(worldBounds.maxX, worldBounds.maxY),
    ];
    const b = { minX: Math.min(...corners.map((p) => p.x)), maxX: Math.max(...corners.map((p) => p.x)),
      minY: Math.min(...corners.map((p) => p.y)), maxY: Math.max(...corners.map((p) => p.y)) };

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
function snapAngleOnSweep(angle, start, sweep) {
  const tau = Math.PI * 2;
  const positive = (value) => ((value % tau) + tau) % tau;
  if (Math.abs(sweep) >= tau - 1e-9) return true;
  return sweep >= 0
    ? positive(angle - start) <= sweep + 1e-9
    : positive(start - angle) <= -sweep + 1e-9;
}

function snapLineArcIntersections(segment, arc) {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length === 0) return [];
  const ux = dx / length;
  const uy = dy / length;
  const fx = segment.a.x - arc.center.x;
  const fy = segment.a.y - arc.center.y;
  const alongCenter = -(fx * ux + fy * uy);
  const perpendicular = fx * uy - fy * ux;
  if (![alongCenter, perpendicular].every(Number.isFinite)) return [];
  const radialTolerance = Math.max(arc.radius, Math.abs(perpendicular)) * 16 * Number.EPSILON;
  if (Math.abs(perpendicular) - arc.radius > radialTolerance) return [];
  const ratio = Math.min(1, Math.abs(perpendicular) / arc.radius);
  const halfChord = arc.radius * Math.sqrt(Math.max(0, 1 - ratio * ratio));
  const distances = halfChord <= radialTolerance
    ? [alongCenter]
    : [alongCenter - halfChord, alongCenter + halfChord];
  const points = [];
  for (const along of distances) {
    const t = along / length;
    if (!Number.isFinite(t) || t < -1e-12 || t > 1 + 1e-12) continue;
    const point = { x: segment.a.x + along * ux, y: segment.a.y + along * uy };
    const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
    if ([point.x, point.y].every(Number.isFinite) && snapAngleOnSweep(angle, arc.startAngle, arc.sweep)) {
      points.push(point);
    }
  }
  return points;
}

function snapArcArcIntersections(first, second) {
  const dx = second.center.x - first.center.x;
  const dy = second.center.y - first.center.y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance === 0) return [];
  const scale = Math.max(first.radius, second.radius, distance);
  const tolerance = scale * 16 * Number.EPSILON;
  if (distance > first.radius + second.radius + tolerance
    || distance < Math.abs(first.radius - second.radius) - tolerance) return [];

  const along = (first.radius * first.radius - second.radius * second.radius + distance * distance) / (2 * distance);
  const heightSquared = first.radius * first.radius - along * along;
  const squaredTolerance = Math.max(first.radius * first.radius, along * along) * 32 * Number.EPSILON;
  if (!Number.isFinite(heightSquared) || heightSquared < -squaredTolerance) return [];
  const height = Math.sqrt(Math.max(0, heightSquared));
  const baseX = first.center.x + along * dx / distance;
  const baseY = first.center.y + along * dy / distance;
  const offsetX = -dy * height / distance;
  const offsetY = dx * height / distance;
  const candidates = height <= tolerance
    ? [{ x: baseX, y: baseY }]
    : [{ x: baseX + offsetX, y: baseY + offsetY }, { x: baseX - offsetX, y: baseY - offsetY }];
  return candidates.filter((point) => {
    if (![point.x, point.y].every(Number.isFinite)) return false;
    const firstAngle = Math.atan2(point.y - first.center.y, point.x - first.center.x);
    const secondAngle = Math.atan2(point.y - second.center.y, point.x - second.center.x);
    return snapAngleOnSweep(firstAngle, first.startAngle, first.sweep)
      && snapAngleOnSweep(secondAngle, second.startAngle, second.sweep);
  });
}

function findNearestSnap(p, pixelRadius = 14) {
  if (!snapEnabled) return null;
  const tol = pixelRadius / zoom;
  let best = null;
  let bestDist = tol;
  const nearbySegments = [];

  const consider = (pt, kind) => {
    const d = Math.hypot(p.x - pt.x, p.y - pt.y);
    if (d < bestDist) {
      bestDist = d;
      best = { point: pt, kind };
    }
  };

  const collectLinearSegment = (a, b, owner, segmentIndex) => {
    if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return;
    if (Math.max(a.x, b.x) < p.x - tol || Math.min(a.x, b.x) > p.x + tol
      || Math.max(a.y, b.y) < p.y - tol || Math.min(a.y, b.y) > p.y + tol) return;
    nearbySegments.push({ kind: "line", a, b, owner, segmentIndex });
  };

  const collectArc = (center, radius, startAngle, sweep, owner, segmentIndex) => {
    if (![center.x, center.y, radius, startAngle, sweep].every(Number.isFinite) || radius <= 0) return;
    if (center.x + radius < p.x - tol || center.x - radius > p.x + tol
      || center.y + radius < p.y - tol || center.y - radius > p.y + tol) return;
    nearbySegments.push({ kind: "arc", center, radius, startAngle, sweep, owner, segmentIndex });
  };

  for (const e of model.entities) {
    const layerObj = model.layers.find((l) => l.name === e.layer);
    if (layerObj && (layerObj.off || layerObj.frozen)) continue;

    if (e.kind === "line") {
      consider({ x: e.x1, y: e.y1 }, "endpoint");
      consider({ x: e.x2, y: e.y2 }, "endpoint");
      consider({ x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 }, "midpoint");
      collectLinearSegment({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }, e.handle, 0);
    } else if (e.kind === "arc") {
      consider({ x: e.x, y: e.y }, "center");
      consider({ x: e.x + e.radius * Math.cos(e.start), y: e.y + e.radius * Math.sin(e.start) }, "endpoint");
      consider({ x: e.x + e.radius * Math.cos(e.end), y: e.y + e.radius * Math.sin(e.end) }, "endpoint");
      collectArc({ x: e.x, y: e.y }, e.radius, e.start, ((e.end - e.start) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2), e.handle, 0);
    } else if (e.kind === "circle") {
      consider({ x: e.cx, y: e.cy }, "center");
      consider({ x: e.cx + e.radius, y: e.cy }, "endpoint");
      consider({ x: e.cx - e.radius, y: e.cy }, "endpoint");
      consider({ x: e.cx, y: e.cy + e.radius }, "endpoint");
      consider({ x: e.cx, y: e.cy - e.radius }, "endpoint");
      collectArc({ x: e.cx, y: e.cy }, e.radius, 0, Math.PI * 2, e.handle, 0);
    } else if (e.kind === "insert" || e.kind === "text") {
      consider({ x: e.x, y: e.y }, "endpoint");
    } else if (e.kind === "polyline") {
      for (let i = 0; i < e.points.length; i++) {
        consider(e.points[i], "endpoint");
        if (i < e.points.length - 1 || e.closed) {
          const next = e.points[(i + 1) % e.points.length];
          const bulge = e.points[i].bulge || 0;
          if (Math.abs(bulge) >= 1e-10) {
            const arc = bulgeGeometry(e.points[i], next, bulge);
            if (arc) {
              const angle = arc.startAngle + arc.sweep / 2;
              consider({
                x: arc.center.x + arc.radius * Math.cos(angle),
                y: arc.center.y + arc.radius * Math.sin(angle)
              }, "midpoint");
              collectArc(arc.center, arc.radius, arc.startAngle, arc.sweep, e.handle, i);
            }
          } else {
            consider({ x: (e.points[i].x + next.x) / 2, y: (e.points[i].y + next.y) / 2 }, "midpoint");
            collectLinearSegment(e.points[i], next, e.handle, i);
          }
        }
      }
    }
  }

  // Intersection snap is evaluated only for primitives near the cursor;
  // this avoids an all-entities pair scan on every pointer move.
  for (let i = 0; i < nearbySegments.length; i++) {
    const first = nearbySegments[i];

    for (let j = i + 1; j < nearbySegments.length; j++) {
      const second = nearbySegments[j];
      if (first.owner === second.owner && Math.abs(first.segmentIndex - second.segmentIndex) <= 1) continue;
      let intersections = [];
      if (first.kind === "line" && second.kind === "line") {
        const rx = first.b.x - first.a.x;
        const ry = first.b.y - first.a.y;
        const sx = second.b.x - second.a.x;
        const sy = second.b.y - second.a.y;
        const rLength = Math.hypot(rx, ry);
        const sLength = Math.hypot(sx, sy);
        if (!Number.isFinite(rLength) || !Number.isFinite(sLength) || rLength === 0 || sLength === 0) continue;
        const ux = rx / rLength;
        const uy = ry / rLength;
        const vx = sx / sLength;
        const vy = sy / sLength;
        const sinAngle = ux * vy - uy * vx;
        if (!Number.isFinite(sinAngle) || Math.abs(sinAngle) <= 1e-12) continue;
        const qx = second.a.x - first.a.x;
        const qy = second.a.y - first.a.y;
        const alongFirst = (qx * vy - qy * vx) / sinAngle;
        const alongSecond = (qx * uy - qy * ux) / sinAngle;
        const t = alongFirst / rLength;
        const u = alongSecond / sLength;
        if (![t, u, alongFirst].every(Number.isFinite) || t < 0 || t > 1 || u < 0 || u > 1) continue;
        intersections = [{ x: first.a.x + alongFirst * ux, y: first.a.y + alongFirst * uy }];
      } else if (first.kind === "line") {
        intersections = snapLineArcIntersections(first, second);
      } else if (second.kind === "line") {
        intersections = snapLineArcIntersections(second, first);
      } else {
        intersections = snapArcArcIntersections(first, second);
      }
      for (const intersection of intersections) {
        consider(intersection, "intersection");
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
        const steps = arcTessellationSegments(geom.sweep, geom.radius, 10, 8);
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
    const corners = [screenToWorld(0, 0), screenToWorld(w, 0), screenToWorld(0, h), screenToWorld(w, h)];
    const minX = Math.min(...corners.map((p) => p.x)), maxX = Math.max(...corners.map((p) => p.x));
    const minY = Math.min(...corners.map((p) => p.y)), maxY = Math.max(...corners.map((p) => p.y));
    let gridStep = 50;
    while (gridStep * zoom < 12) gridStep *= 5;
    ctx.save();
    ctx.translate(w / 2 + pan.x, h / 2 + pan.y);
    ctx.rotate(-viewRotation);
    ctx.scale(zoom, -zoom);
    if (gridStep * zoom <= 400) {
      ctx.beginPath();
      ctx.strokeStyle = "#1b2027";
      ctx.lineWidth = 1 / zoom;
      const startX = Math.floor(minX / gridStep) * gridStep;
      const startY = Math.floor(minY / gridStep) * gridStep;
      for (let x = startX; x <= maxX; x += gridStep) {
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
      }
      for (let y = startY; y <= maxY; y += gridStep) {
        ctx.moveTo(minX, y);
        ctx.lineTo(maxX, y);
      }
      ctx.stroke();
    }

    // Keep the WCS axes attached to their world directions as the view rotates.
    ctx.lineWidth = 1.2 / zoom;
    ctx.strokeStyle = "#704646";
    ctx.beginPath();
    ctx.moveTo(minX, 0);
    ctx.lineTo(maxX, 0);
    ctx.stroke();
    ctx.strokeStyle = "#416a55";
    ctx.beginPath();
    ctx.moveTo(0, minY);
    ctx.lineTo(0, maxY);
    ctx.stroke();
    ctx.restore();
  }

  // Viewport Bounding Box in World Coordinates for Spatial Culling (Tuần 33 Optimization)
  const viewportCorners = [screenToWorld(0, 0), screenToWorld(w, 0), screenToWorld(0, h), screenToWorld(w, h)];
  const vpMinX = Math.min(...viewportCorners.map((p) => p.x));
  const vpMaxX = Math.max(...viewportCorners.map((p) => p.x));
  const vpMinY = Math.min(...viewportCorners.map((p) => p.y));
  const vpMaxY = Math.max(...viewportCorners.map((p) => p.y));

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
      const n = arcTessellationSegments(sweep, e.radius, 6, 16);
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
      ctx.rotate(-(e.rotation + viewRotation));
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
      ctx.rotate(-(e.rotation + viewRotation));
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

    const isWindow = s2.x >= s1.x;
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
        const n = arcTessellationSegments(sweep, e.radius, 8, 12);
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
    } else if (currentSnap.kind === "intersection") {
      ctx.beginPath();
      ctx.moveTo(s.x - 5, s.y - 5);
      ctx.lineTo(s.x + 5, s.y + 5);
      ctx.moveTo(s.x - 5, s.y + 5);
      ctx.lineTo(s.x + 5, s.y - 5);
      ctx.stroke();
    }
  }

  // Canvas readouts
  const coordEl = $("#coordReadout");
  if (coordEl) coordEl.innerHTML = `X&nbsp; ${world.x.toFixed(3)}&nbsp;&nbsp; Y&nbsp; ${world.y.toFixed(3)}`;
  const zoomEl = $("#zoomReadout");
  if (zoomEl) zoomEl.textContent = `${Math.round(zoom * 100)}%`;
  const spaceLabel = $("#canvasSpaceLabel");
  if (spaceLabel) spaceLabel.textContent = activeSpace === "model" ? "WCS" : activeSpace.toUpperCase();
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
  fitWorldBounds(minX, maxX, minY, maxY);
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
      <div class="ribbon-group ribbon-home-draw-panel">
        <div class="tools ribbon-home-draw-tools">
          <button class="tool-button ribbon-home-large ${activeTool==='line'?'selected':''}" data-tool="line" title="${t("tool_line")} (LINE)"><span class="tool-icon"></span><span class="ribbon-command-label">Line</span></button>
          <button class="tool-button ribbon-home-large ${activeTool==='polyline'?'selected':''}" data-tool="polyline" title="${t("tool_poly")} (PLINE)"><span class="tool-icon"></span><span class="ribbon-command-label">Polyline</span></button>
          <button class="tool-button ribbon-home-large ${activeTool==='circle'?'selected':''}" data-tool="circle" title="${t("tool_circle")} (CIRCLE)"><span class="tool-icon"></span><span class="ribbon-command-label">Circle</span></button>
          <button class="tool-button ribbon-home-large ${activeTool==='arc'?'selected':''}" data-tool="arc" title="${t("tool_arc")} (ARC)"><span class="tool-icon"></span><span class="ribbon-command-label">Arc</span></button>
          <div class="ribbon-home-draw-stack">
            <button class="tool-button ribbon-home-small ${activeTool==='rectangle'?'selected':''}" data-tool="rectangle" title="${t("tool_rect")} (RECTANG)"><span class="tool-icon"></span><span class="ribbon-command-label">Rectangle</span></button>
            <button class="tool-button ribbon-home-small ${activeTool==='hatch'?'selected':''}" data-tool="hatch" title="${t("tool_hatch")} (HATCH)"><span class="tool-icon"></span><span class="ribbon-command-label">Hatch</span></button>
            <button class="tool-button ribbon-home-small ${activeTool==='spline'?'selected':''}" data-tool="spline" title="${t("tool_spline")} (SPLINE)"><span class="tool-icon"></span><span class="ribbon-command-label">Spline</span></button>
            <button class="tool-button ribbon-home-small ${activeTool==='revcloud'?'selected':''}" data-tool="revcloud" title="${t("tool_revcloud")} (REVCLOUD)"><span class="tool-icon"></span><span class="ribbon-command-label">Revcloud</span></button>
          </div>
        </div>
        <div class="group-caption">${t("grp_draw")}</div>
      </div>
      <div class="ribbon-group ribbon-home-modify-panel">
        <div class="tools ribbon-home-modify-tools">
          <button class="tool-button ribbon-home-modify ${activeTool==='move'?'selected':''}" data-tool="move" title="${t("tool_move")} (MOVE)"><span class="tool-icon"></span><span class="ribbon-command-label">Move</span></button>
          <button class="tool-button ribbon-home-modify ${activeTool==='copy'?'selected':''}" data-tool="copy" title="${t("tool_copy")} (COPY)"><span class="tool-icon"></span><span class="ribbon-command-label">Copy</span></button>
          <button class="tool-button ribbon-home-modify ${activeTool==='rotate'?'selected':''}" data-tool="rotate" title="${t("tool_rotate")} (ROTATE)"><span class="tool-icon"></span><span class="ribbon-command-label">Rotate</span></button>
          <button class="tool-button ribbon-home-modify ${activeTool==='mirror'?'selected':''}" data-tool="mirror" title="${t("tool_mirror")} (MIRROR)"><span class="tool-icon"></span><span class="ribbon-command-label">Mirror</span></button>
          <button class="tool-button ribbon-home-modify ${activeTool==='trim'?'selected':''}" data-tool="trim" title="${t("tool_trim")} (TRIM)"><span class="tool-icon"></span><span class="ribbon-command-label">Trim</span></button>
          <button class="tool-button ribbon-home-modify ${activeTool==='extend'?'selected':''}" data-tool="extend" title="${t("tool_extend")} (EXTEND)"><span class="tool-icon"></span><span class="ribbon-command-label">Extend</span></button>
          <button class="tool-button ribbon-home-modify" id="offsetBtn" title="${t("tool_offset")} (OFFSET)"><span class="tool-icon"></span><span class="ribbon-command-label">Offset</span></button>
          <button class="tool-button ribbon-home-modify" id="eraseBtn" title="${t("tool_erase")} (ERASE)"><span class="tool-icon"></span><span class="ribbon-command-label">Erase</span></button>
          <button class="tool-button ribbon-home-modify ${activeTool==='fillet'?'selected':''}" data-tool="fillet" title="${t("tool_fillet")} (FILLET)"><span class="tool-icon"></span><span class="ribbon-command-label">Fillet</span></button>
          <button class="tool-button ribbon-home-modify ${activeTool==='chamfer'?'selected':''}" data-tool="chamfer" title="${t("tool_chamfer")} (CHAMFER)"><span class="tool-icon"></span><span class="ribbon-command-label">Chamfer</span></button>
        </div>
        <div class="group-caption">${t("grp_modify")}</div>
      </div>
      <div class="ribbon-group ribbon-home-annotation-panel">
        <div class="tools ribbon-home-annotation-tools">
          <button class="tool-button ribbon-home-large ${activeTool==='text'?'selected':''}" data-tool="text" title="${t("tool_text")} (TEXT)"><span class="tool-icon"></span><span class="ribbon-command-label">Text</span></button>
          <button class="tool-button ribbon-home-large ${activeTool==='dim'?'selected':''}" data-tool="dim" title="${t("tool_dim")} (DIM)"><span class="tool-icon"></span><span class="ribbon-command-label">Dimension</span></button>
        </div>
        <div class="group-caption">${t("grp_annotate")}</div>
      </div>
      <div class="ribbon-group ribbon-home-layers-panel">
        <div class="tools ribbon-home-layers-tools">
          <label class="ribbon-field-label" for="ribbonLayerSelect">${currentLang === "vi" ? "Lớp hiện hành" : "Current Layer"}</label>
          <select id="ribbonLayerSelect" class="ribbon-select" title="Active drawing layer">
            ${model.layers.map(l => `<option value="${escapeHtml(l.handle)}" ${l.name===model.currentLayer?'selected':''}>${escapeHtml(l.name)}</option>`).join('')}
          </select>
          <div class="ribbon-home-layer-actions">
            <button class="tool-button ribbon-home-layer-add ribbon-home-layer-add-icon" id="ribbonAddLayer" aria-label="${t("add_layer")}" title="${t("add_layer")}"><span class="tool-icon"></span></button>
            <button class="tool-button ribbon-home-layer-add" id="showLayersPanel" aria-pressed="${paletteVisibility.layers}" title="Toggle Layers palette"><span class="tool-icon"></span><span class="ribbon-command-label">Layers</span></button>
          </div>
        </div>
        <div class="group-caption">${t("grp_layers")}</div>
      </div>
      <div class="ribbon-group ribbon-home-properties-panel">
        <div class="tools ribbon-home-properties-tools">
          <label class="ribbon-home-color-control" for="ribbonLayerColor">
            <span>${currentLang === "vi" ? "Màu lớp hiện hành" : "Current Layer Color"}</span>
            <input type="color" id="ribbonLayerColor" value="${model.layers.find((layer) => layer.name === model.currentLayer)?.color || "#79c9dc"}" aria-label="${currentLang === "vi" ? "Màu lớp hiện hành" : "Current Layer Color"}" ${showStartScreen ? "disabled" : ""}>
            <strong>${currentLang === "vi" ? "Theo lớp" : "ByLayer"}</strong>
          </label>
          <button class="tool-button ribbon-home-properties-toggle ${paletteVisibility.properties ? 'selected' : ''}" id="showPropertiesPanel" aria-pressed="${paletteVisibility.properties}" title="Toggle Properties palette"><span class="tool-icon"></span><span class="ribbon-command-label">Properties</span></button>
        </div>
        <div class="group-caption">PROPERTIES</div>
      </div>
      <div class="ribbon-group ribbon-home-utilities-panel">
        <div class="tools ribbon-home-utilities-tools">
          <button class="tool-button ribbon-home-small ${activeTool==='dist'?'selected':''}" data-tool="dist" title="${t("tool_dist")} (DIST)"><span class="tool-icon"></span><span class="ribbon-command-label">Distance</span></button>
          <button class="tool-button ribbon-home-small ${activeTool==='area'?'selected':''}" data-tool="area" title="${t("tool_area")} (AREA)"><span class="tool-icon"></span><span class="ribbon-command-label">Area</span></button>
          <button class="tool-button ribbon-home-small" id="takeoffRibbonBtn" title="${currentLang === "vi" ? "Thống kê khối lượng" : "Quantity takeoff"} (TAKEOFF)"><span class="tool-icon"></span><span class="ribbon-command-label">${currentLang === "vi" ? "Thống kê" : "Takeoff"}</span></button>
        </div>
        <div class="group-caption">UTILITIES</div>
      </div>
      <div class="ribbon-group ribbon-home-view-panel">
        <div class="tools ribbon-home-view-tools">
          <button class="tool-button ribbon-home-small" id="zoomExtents" title="${t("tool_zoom_all")}"><span class="tool-icon"></span><span class="ribbon-command-label">Extents</span></button>
          <button class="tool-button ribbon-home-small" id="zoomInBtn" title="Zoom In"><span class="tool-icon"></span><span class="ribbon-command-label">Zoom In</span></button>
          <button class="tool-button ribbon-home-small" id="zoomOutBtn" title="Zoom Out"><span class="tool-icon"></span><span class="ribbon-command-label">Zoom Out</span></button>
          <button class="tool-button ribbon-home-small" id="zoomResetBtn" title="Zoom to 100%"><span class="tool-icon"></span><span class="ribbon-command-label">100%</span></button>
        </div>
        <div class="group-caption">VIEW</div>
      </div>
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
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button compact ${activeTool==='spline'?'selected':''}" data-tool="spline" title="Vẽ đường cong Spline (SPL)"><span class="tool-icon">〰</span><span>${t("tool_spline")}</span></button>
          <button class="tool-button compact ${activeTool==='revcloud'?'selected':''}" data-tool="revcloud" title="Đám mây ghi chú (REVCLOUD)"><span class="tool-icon">☁</span><span>${t("tool_revcloud")}</span></button>
          <button class="tool-button compact ${activeTool==='hatch'?'selected':''}" data-tool="hatch" title="Tô mẫu mặt cắt (HATCH)"><span class="tool-icon">▨</span><span>${t("tool_hatch")}</span></button>
        </div>
        <div class="group-caption">${currentLang === "vi" ? "HÌNH HỌC KHÁC" : "MORE GEOMETRY"}</div>
      </div>
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button compact ${activeTool==='fillet'?'selected':''}" data-tool="fillet"><span class="tool-icon">◜</span><span>${t("tool_fillet")}</span></button>
          <button class="tool-button compact ${activeTool==='chamfer'?'selected':''}" data-tool="chamfer"><span class="tool-icon">◺</span><span>${t("tool_chamfer")}</span></button>
          <button class="tool-button compact ${activeTool==='join'?'selected':''}" data-tool="join"><span class="tool-icon">☍</span><span>${t("tool_join")}</span></button>
          <button class="tool-button compact" id="takeoffRibbonBtn" title="Thống kê khối lượng (TAKEOFF)"><span class="tool-icon">📊</span><span>${currentLang === "vi" ? "BOM" : "Takeoff"}</span></button>
          <button class="tool-button compact" id="explodeBtn"><span class="tool-icon">💥</span><span>${t("tool_explode")}</span></button>
        </div>
        <div class="group-caption">${currentLang === "vi" ? "CHỈNH SỬA KHÁC" : "MORE MODIFY"}</div>
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
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button compact ${paletteVisibility.properties ? 'selected' : ''}" id="showPropertiesPanel" aria-pressed="${paletteVisibility.properties}" title="Toggle Properties palette"><span class="tool-icon">▤</span><span>Properties</span></button>
          <button class="tool-button compact ${paletteVisibility.layers ? 'selected' : ''}" id="showLayersPanel" aria-pressed="${paletteVisibility.layers}" title="Toggle Layers palette"><span class="tool-icon">▧</span><span>Layers</span></button>
        </div>
        <div class="group-caption">PALETTES</div>
      </div>
      <div class="ribbon-spacer"></div>
    `;
  } else if (activeRibbonTab === "manage") {
    container.innerHTML = `
      <div class="ribbon-group">
        <div class="tools ribbon-manage-layer-tools">
          <label class="ribbon-field-label" for="ribbonLayerSelect">${currentLang === "vi" ? "Lớp hiện hành" : "Current Layer"}</label>
          <select id="ribbonLayerSelect" class="ribbon-select" title="Active drawing layer">
            ${model.layers.map(l => `<option value="${escapeHtml(l.handle)}" ${l.name===model.currentLayer?'selected':''}>${escapeHtml(l.name)}</option>`).join('')}
          </select>
          <button class="title-action" id="ribbonAddLayer"><span class="tool-icon"></span><span>${t("add_layer")}</span></button>
        </div>
        <div class="group-caption">${t("grp_layers")}</div>
      </div>
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button compact ${paletteVisibility.layers ? 'selected' : ''}" id="showLayersPanel" aria-pressed="${paletteVisibility.layers}" title="Toggle Layers palette"><span class="tool-icon">▧</span><span class="ribbon-command-label">Layers</span></button>
          <button class="tool-button compact ${paletteVisibility.properties ? 'selected' : ''}" id="showPropertiesPanel" aria-pressed="${paletteVisibility.properties}" title="Toggle Properties palette"><span class="tool-icon">▤</span><span class="ribbon-command-label">Properties</span></button>
        </div>
        <div class="group-caption">PALETTES</div>
      </div>
      <div class="ribbon-spacer"></div>
    `;
  } else if (activeRibbonTab === "output") {
    container.innerHTML = `
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button" id="outputSaveBtn" title="Save drawing (Ctrl+S)"><span class="tool-icon">▣</span><span class="ribbon-command-label">Save</span></button>
          <button class="tool-button" id="outputExportPng" title="Export drawing as PNG"><span class="tool-icon">▧</span><span class="ribbon-command-label">PNG</span></button>
        </div>
        <div class="group-caption">${currentLang === "vi" ? "LƯU VÀ XUẤT" : "SAVE & EXPORT"}</div>
      </div>
      <div class="ribbon-group">
        <div class="tools">
          <button class="tool-button" id="outputTakeoffBtn" title="${currentLang === "vi" ? "Thống kê khối lượng" : "Quantity takeoff"}"><span class="tool-icon">▥</span><span class="ribbon-command-label">${currentLang === "vi" ? "Thống kê" : "Takeoff"}</span></button>
        </div>
        <div class="group-caption">${currentLang === "vi" ? "THỐNG KÊ" : "QUANTITIES"}</div>
      </div>
      <div class="ribbon-spacer"></div>
    `;
  }

  if (showStartScreen) {
    container.querySelectorAll("button, select, input").forEach((control) => {
      if (control.id !== "ribbonOpen") control.disabled = true;
    });
  }

  applyToolbarIcons();
  bindRibbonEvents();
  applyRibbonDisplayMode();
  const startNew = $("#ribbonStartNew");
  if (startNew) startNew.onclick = () => $("#newBtn").click();
  const startOpen = $("#ribbonStartOpen");
  if (startOpen) startOpen.onclick = openDrawing;
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
      const layer = model.layers.find((item) => item.handle === e.target.value);
      if (layer) sync(invoke("set_current_layer", { name: layer.name }));
    };
  }
  const ribbonLayerColor = $("#ribbonLayerColor");
  if (ribbonLayerColor) {
    ribbonLayerColor.onchange = (e) => {
      sync(invoke("set_layer_color", { name: model.currentLayer, hex: e.target.value }));
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

  const showPropertiesPanel = $("#showPropertiesPanel");
  if (showPropertiesPanel) showPropertiesPanel.onclick = () => setPaletteVisibility("properties", !paletteVisibility.properties);
  const showLayersPanel = $("#showLayersPanel");
  if (showLayersPanel) showLayersPanel.onclick = () => setPaletteVisibility("layers", !paletteVisibility.layers);

  const outputSaveBtn = $("#outputSaveBtn");
  if (outputSaveBtn) outputSaveBtn.onclick = saveDrawing;
  const outputExportPng = $("#outputExportPng");
  if (outputExportPng) outputExportPng.onclick = exportDrawingImage;
  const outputTakeoffBtn = $("#outputTakeoffBtn");
  if (outputTakeoffBtn) outputTakeoffBtn.onclick = showTakeoffModal;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function sync(promise) {
  const previousDocumentId = activeDocId;
  const previousView = captureActiveDrawingView();
  const previousSelection = new Set(selectedHandles);
  try {
    model = await promise;
    if (Array.isArray(model.documents)) {
      openDocuments = model.documents.map((drawing) => ({
        id: drawing.id,
        title: drawing.title,
        path: drawing.title,
        dirty: drawing.dirty
      }));
      if (previousDocumentId !== model.documentId) {
        if (previousDocumentId != null) {
          drawingViewStates.set(previousDocumentId, previousView);
          drawingSelections.set(previousDocumentId, previousSelection);
        }
        activeDocId = model.documentId;
        restoreDrawingView(activeDocId);
        restoreDrawingSelection(activeDocId);
        cancelInteractionForDrawingSwitch();
      } else {
        activeDocId = model.documentId;
        drawingViewStates.set(activeDocId, captureActiveDrawingView());
        drawingSelections.set(activeDocId, new Set(selectedHandles));
      }
    }
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
  if (tool !== "select") logCommand(msgs[tool] || tool.toUpperCase());
  const commandInput = $("#commandInput");
  if (commandInput) {
    commandInput.placeholder = tool === "select"
      ? t("cmd_placeholder")
      : `${tool.toUpperCase()} · ${msgs[tool] || "Enter value or pick a point"}`;
  }
  draw();
  const vp = $("#viewport");
  if (vp) vp.focus();
  renderRibbon();
}

// Render Properties & Layers UI
function render() {
  const title = model.title.split(/[\\/]/).pop().replace(/\.(dwg|dxf)$/i, "") || "Drawing1";
  const titleNameEl = $("#titleName");
  if (titleNameEl) titleNameEl.textContent = showStartScreen ? "CONCOSTCAD" : title;
  ["topSaveBtn", "topUndoBtn", "topRedoBtn"].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.disabled = showStartScreen;
  });
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
        <div class="layer-row ${l.name === model.currentLayer ? "current" : ""}" data-layer-handle="${escapeHtml(l.handle)}">
          <span class="layer-title"><i class="layer-swatch" style="background: ${l.color || '#79c9dc'}; box-shadow: 0 0 4px ${l.color || '#79c9dc'}44;" title="Đổi màu Layer" data-layer-color="${escapeHtml(l.name)}"></i>${escapeHtml(l.name)}</span>
          <span class="layer-eye" title="Toggle Visibility">${l.off ? "—" : "◉"}</span>
          <span class="layer-lock" title="Toggle Lock">${l.locked ? "▣" : "—"}</span>
        </div>`
      )
      .join("");

    $$(".layer-row").forEach((row) => {
      const layer = model.layers.find((item) => item.handle === row.dataset.layerHandle);
      if (!layer) return;
      const layerName = layer.name;
      row.onclick = (e) => {
        if (e.target.classList.contains("layer-swatch")) {
          const colors = ["#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#ec4899", "#ffffff", "#79c9dc"];
          const curr = row.querySelector(".layer-swatch").style.background;
          const next = colors[(colors.indexOf(curr) + 1) % colors.length] || colors[0];
          sync(invoke("set_layer_color", { name: layerName, hex: next }));
          return;
        }
        if (e.target.classList.contains("layer-eye")) {
          const lyr = layer;
          if (lyr) sync(invoke("set_layer_flags", { name: layerName, frozen: lyr.frozen, off: !lyr.off, locked: lyr.locked }));
        } else if (e.target.classList.contains("layer-lock")) {
          const lyr = layer;
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

async function saveWithWarnings(path) {
  let warnings;
  try {
    warnings = await invoke("save_warnings", { path });
  } catch (e) {
    setStatus(String(e));
    return false;
  }
  if (warnings.length > 0) {
    const heading = currentLang === "vi"
      ? "Bản vẽ có nội dung chưa được hỗ trợ đầy đủ. Một số dữ liệu có thể không được giữ nguyên khi lưu:\n\n"
      : "This drawing contains content that is not fully supported. Some data may not be preserved when saving:\n\n";
    const details = warnings.slice(0, 20).map((warning, index) => `${index + 1}. ${warning}`).join("\n");
    const remaining = warnings.length > 20
      ? (currentLang === "vi" ? `\n… và ${warnings.length - 20} cảnh báo khác.` : `\n… and ${warnings.length - 20} more warning(s).`)
      : "";
    const question = currentLang === "vi"
      ? "\n\nBạn có muốn tiếp tục lưu?"
      : "\n\nContinue saving?";
    if (!window.confirm(`${heading}${details}${remaining}${question}`)) return false;
  }
  return sync(invoke("save_drawing", {
    path,
    acknowledgeWarnings: warnings.length > 0
  }));
}

async function openDrawing(selectedPath = null) {
  const path = selectedPath || await open({
    multiple: false,
    filters: [{ name: "CAD drawing", extensions: ["dwg", "dxf"] }]
  });
  if (path) {
    const scratchDrawingId = showStartScreen && hasOnlyEmptyScratchDrawing() ? activeDocId : null;
    enterEditor();
    setStatus("Opening drawing…");
    if (await sync(invoke("open_drawing", { path }))) {
      if (scratchDrawingId !== null) {
        await sync(invoke("close_drawing", { id: scratchDrawingId, discard: true }));
      }
      updateActiveDocumentTab();
      selectedHandles.clear();
      setStatus(`Opened ${model.entityCount} model-space entities`);
      zoomToExtents();
      rememberRecentDrawing(path);
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
  if (await saveWithWarnings(path)) {
    const savedPath = path || model.title;
    if (savedPath && savedPath !== "Drawing1") rememberRecentDrawing(savedPath);
    setStatus("Drawing saved successfully");
  }
}

async function saveDrawingAs() {
  const path = await save({
    defaultPath: model.title && model.title !== "Drawing1" ? model.title : undefined,
    filters: [
      { name: "DWG drawing", extensions: ["dwg"] },
      { name: "DXF drawing", extensions: ["dxf"] }
    ]
  });
  if (!path) return;
  if (await saveWithWarnings(path)) {
    rememberRecentDrawing(path);
    setStatus("Drawing saved successfully");
  }
}

function zoomToExtents() {
  if (!model.entities.length) return;
  const visible = model.entities.filter((e) => {
    const layer = model.layers.find((item) => item.name === e.layer);
    return !layer || (!layer.off && !layer.frozen);
  });
  if (!visible.length) return;
  const bounds = visible.map(getEntityBounds);
  fitWorldBounds(
    Math.min(...bounds.map((b) => b.minX)), Math.max(...bounds.map((b) => b.maxX)),
    Math.min(...bounds.map((b) => b.minY)), Math.max(...bounds.map((b) => b.maxY))
  );
  draw();
}

async function finishSpline() {
  if (points.length < 2) {
    points = [];
    chooseTool("select");
    setStatus(currentLang === "vi" ? "Đã hủy SPLINE: cần ít nhất 2 điểm" : "SPLINE canceled: at least 2 points are required");
    draw();
    return false;
  }
  const splinePts = interpolateCatmullRom(points, 10);
  if (!await sync(
    invoke("add_polyline", {
      points: splinePts,
      closed: false
    })
  )) return false;
  points = [];
  chooseTool("select");
  setStatus(currentLang === "vi" ? "Đã tạo đường cong Spline (SPLINE)" : "Spline curve created");
  draw();
  return true;
}

async function finishRevcloud() {
  if (points.length < 2) {
    points = [];
    chooseTool("select");
    setStatus(currentLang === "vi" ? "Đã hủy REVCLOUD: cần ít nhất 2 điểm" : "REVCLOUD canceled: at least 2 points are required");
    draw();
    return false;
  }
  const cloudPts = generateRevisionCloud(points, 24);
  if (!await sync(
    invoke("add_polyline", {
      points: cloudPts,
      closed: true
    })
  )) return false;
  points = [];
  chooseTool("select");
  setStatus(currentLang === "vi" ? "Đã tạo đám mây ghi chú (REVCLOUD)" : "Revision Cloud created");
  draw();
  return true;
}

async function finishPolyline(closed = false) {
  if (points.length < 2) {
    points = [];
    chooseTool("select");
    setStatus(currentLang === "vi" ? "Đã hủy PLINE: cần ít nhất 2 đỉnh" : "PLINE canceled: at least 2 vertices are required");
    draw();
    return false;
  }
  if (!await sync(
    invoke("add_polyline", {
      points: points.map((p) => [p.x, p.y, p.bulge || 0]),
      closed
    })
  )) return false;
  points = [];
  chooseTool("select");
  setStatus(currentLang === "vi"
    ? (closed ? "Đã tạo PLINE khép kín" : "Đã tạo PLINE")
    : (closed ? "Closed Polyline created" : "Polyline created"));
  draw();
  return true;
}

function undoPolylineVertex() {
  if (activeTool !== "polyline" || points.length === 0) return false;
  points.pop();
  setStatus(points.length
    ? `PLINE · ${points.length} vertices; Specify next point or [Undo/Close]`
    : "PLINE · Specify first point");
  draw();
  return true;
}

async function acceptCurrentCommand() {
  if (activeTool === "select") {
    chooseTool(lastTool);
  } else if (activeTool === "line" && points.length > 0) {
    points = [];
    chooseTool("select");
    setStatus("LINE finished");
  } else if (activeTool === "polyline") {
    await finishPolyline(false);
  } else if (activeTool === "spline") {
    await finishSpline();
  } else if (activeTool === "revcloud") {
    await finishRevcloud();
  } else if (activeTool === "area" && points.length >= 3) {
    const res = calculatePolygonArea(points);
    measureInfo = `Area = ${res.area.toFixed(2)} mm² (${(res.area / 1e6).toFixed(4)} m²) | Perimeter = ${res.perimeter.toFixed(2)} mm`;
    points = [];
    setStatus(measureInfo);
    renderRibbon();
    draw();
  }
}

function toggleGrid() {
  showGrid = !showGrid;
  const b = $("#toggleGridBtn");
  if (b) {
    b.classList.toggle("active", showGrid);
    b.setAttribute("aria-pressed", String(showGrid));
  }
  draw();
}

function toggleSnap() {
  snapEnabled = !snapEnabled;
  const b = $("#toggleSnapBtn");
  if (b) {
    b.classList.toggle("active", snapEnabled);
    b.setAttribute("aria-pressed", String(snapEnabled));
  }
  draw();
}

function toggleOrtho() {
  orthoEnabled = !orthoEnabled;
  const b = $("#toggleOrthoBtn");
  if (b) {
    b.classList.toggle("active", orthoEnabled);
    b.setAttribute("aria-pressed", String(orthoEnabled));
  }
  draw();
}

// Canvas Event Bindings
function bindCanvasEvents(viewportEl, canvasEl) {
  viewportEl.addEventListener("pointerdown", async (e) => {
    viewportEl.focus({ preventScroll: true });
    if (e.button === 2) {
      e.preventDefault();
      await acceptCurrentCommand();
      return;
    }
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
      const hit = await hitTestEntity(p, 8 / zoom);
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
        // AutoCAD LINE stays active: the previous endpoint becomes the next start point.
        points = [p];
        setStatus("LINE · Specify next point or press Enter to finish");
      } else {
        setStatus("LINE · Specify next point");
      }
    } else if (activeTool === "polyline") {
      points.push({ ...p, bulge: 0 });
      setStatus(`PLINE · ${points.length} vertices; Specify next point or [Undo/Close]`);
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
      const hit = await hitTestEntity(p, 8 / zoom);
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
      const hit = await hitTestEntity(p, 8 / zoom);
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
      const hit = await hitTestEntity(p, 8 / zoom);
      if (hit) {
        const allOtherHandles = model.entities.filter(ent => ent.handle !== hit.handle).map(ent => ent.handle);
        const ok = await sync(invoke("trim_line", { targetHandle: hit.handle, clickX: p.x, clickY: p.y, cutterHandles: allOtherHandles }));
        if (ok) {
          setStatus(currentLang === "vi" ? "Đã cắt xén đối tượng (TRIM)" : "Line trimmed");
        }
      }
    } else if (activeTool === "extend") {
      const hit = await hitTestEntity(p, 8 / zoom);
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
        const hit = await hitTestEntity(p, 8 / zoom);
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
        const hit = await hitTestEntity(p, 8 / zoom);
        if (hit) {
          selectedHandles.add(hit.handle);
          renderProperties();
          setStatus("MOVE · Objects selected; pick base point");
          draw();
          return;
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
        const hit = await hitTestEntity(p, 8 / zoom);
        if (hit) {
          selectedHandles.add(hit.handle);
          renderProperties();
          setStatus("COPY · Objects selected; pick base point");
          draw();
          return;
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
        const hit = await hitTestEntity(p, 8 / zoom);
        if (hit) {
          selectedHandles.add(hit.handle);
          renderProperties();
          setStatus("ROTATE · Objects selected; pick base point");
          draw();
          return;
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
      if (selectedHandles.size === 0) {
        const hit = await hitTestEntity(p, 8 / zoom);
        if (hit) {
          selectedHandles.add(hit.handle);
          renderProperties();
          setStatus("MIRROR · Object selected; pick first axis point");
          draw();
          return;
        }
        setStatus("MIRROR · Select objects first");
        return;
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
    } else if (activeTool === "offset") {
      if (!offsetTargetHandle) {
        const hit = await hitTestEntity(p, 8 / zoom);
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
        await sync(invoke("add_dimension", {
          request: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, ox: pOff.x, oy: pOff.y, textOverride }
        }));
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

  viewportEl.addEventListener("contextmenu", (e) => e.preventDefault());

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
function cancelCurrentCommand() {
  points = [];
  moveBasePoint = null;
  activeGrip = null;
  offsetTargetHandle = null;
  currentSnap = null;
  isBoxSelecting = false;
  boxStart = null;
  boxCurrent = null;
  isPanning = false;
  lastPan = null;
  chooseTool("select");
  setStatus(currentLang === "vi" ? "Đã hủy lệnh" : "Cancelled");
}

function handleGlobalKeyDown(event) {
  const action = cadShortcut(event, !showStartScreen);
  if (!action) return;
  event.preventDefault();
  const actions = {
    new: () => $("#newBtn")?.click(),
    open: openDrawing,
    save: saveDrawing,
    saveAs: saveDrawingAs,
    undo: undoAction,
    redo: redoAction,
    erase: eraseSelected,
    cancel: cancelCurrentCommand,
    snap: toggleSnap,
    ortho: toggleOrtho,
    accept: acceptCurrentCommand,
  };
  void actions[action]();
}

function bindCommandBarEvents() {
  const cmdInput = $("#commandInput");
  if (cmdInput) {
    cmdInput.addEventListener("keydown", async (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (["Enter", "Escape", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.repeat && (e.key === "Enter" || e.key === "Escape")) return;

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
          logCommand(`> ${raw}`, "input");
          if (commandHistory.length > 50) commandHistory.shift();
          historyIndex = -1;
        }
        e.currentTarget.value = "";
        if (!raw) {
          await acceptCurrentCommand();
          return;
        }

        const cmd = raw.toUpperCase();
        if (activeTool === "polyline" && (cmd === "U" || cmd === "UNDO") && undoPolylineVertex()) return;
        if (activeTool === "polyline" && (cmd === "C" || cmd === "CLOSE")) { finishPolyline(true); return; }
        if (cmd === "START") { showStartTab(); return; }
        if (cmd === "NEW" || cmd === "QNEW") { $("#newBtn")?.click(); return; }
        if (cmd === "OPEN") { openDrawing(); return; }
        if (cmd === "SAVE" || cmd === "QSAVE") { saveDrawing(); return; }
        if (cmd === "CLOSE" || cmd === "CLOSEDFILE") { closeCurrentDrawing(); return; }
        if (cmd === "QUIT" || cmd === "EXIT") { appWindowRef?.close(); return; }
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
        cancelCurrentCommand();
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
      points = [p];
      setStatus("LINE · Specify next point or press Enter to finish");
    }
  } else if (activeTool === "polyline") {
    points.push({ ...p, bulge: 0 });
    setStatus(`PLINE · ${points.length} vertices; Specify next point or [Undo/Close]`);
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
renderRibbon();
render();
const revealWindowAfterInitialization = async () => {
  const appWindow = getCurrentWindow();
  try {
    await sync(invoke("get_snapshot"));
    // A hidden WebView may suspend animation frames. render()/resize() already
    // prepare the shell synchronously; show it before waiting on any paint.
  } finally {
    await appWindow.show();
    await appWindow.setFocus();
  }
};
revealWindowAfterInitialization();

// Background autosave timer (Tuần 31: Drawing robustness)
setInterval(async () => {
  if (openDocuments.some((drawing) => drawing.dirty)) {
    try {
      const paths = await invoke("autosave_drawings");
      if (paths.length) {
        localStorage.setItem("concostcad_autosave_ts", Date.now().toString());
        setStatus(currentLang === "vi" ? `Đã lưu ${paths.length} bản sao dự phòng trong CONCOSTCAD/Autosave` : `Saved ${paths.length} backup(s) in CONCOSTCAD/Autosave`);
      }
    } catch (error) {
      setStatus(String(error));
    }
  }
}, 180000);


function renderDocumentTabs() {
  const container = $("#documentTabs");
  if (!container) return;

  // The backend keeps one empty active document so commands always have a
  // workspace. Keep that implementation detail out of the Start tab strip;
  // it becomes visible when the user explicitly starts drawing.
  const visibleDocuments = showStartScreen && hasOnlyEmptyScratchDrawing()
    ? []
    : openDocuments;
  const tabsHtml = visibleDocuments.map((d) => `
    <div class="doc-tab ${!showStartScreen && d.id === activeDocId ? 'active' : ''}" data-doc-id="${d.id}">
      <span class="file-dot"></span>
      <span class="doc-title">${escapeHtml(d.title)}</span>
      <span class="dirty-dot ${d.dirty ? 'visible' : ''}"></span>
      <button type="button" class="close-tab" data-close-id="${d.id}" title="${currentLang === "vi" ? "Đóng bản vẽ" : "Close drawing"}" aria-label="${currentLang === "vi" ? "Đóng bản vẽ" : "Close drawing"}">×</button>
    </div>
  `).join("");

  container.innerHTML = `
    <button class="doc-tab start-doc-tab ${showStartScreen ? 'active' : ''}" id="startDocumentTab">Start</button>
    ${tabsHtml}
    <button class="add-tab-btn" id="addDocTabBtn" title="Bản vẽ mới (New Drawing)">＋</button>
  `;

  const startTab = $("#startDocumentTab");
  if (startTab) startTab.onclick = () => {
    if (!showStartScreen) showStartTab();
  };

  $$(".doc-tab[data-doc-id]").forEach((tab) => {
    const id = parseInt(tab.dataset.docId, 10);
    tab.onclick = async (e) => {
      if (e.target.classList.contains("close-tab")) return;
      if (showStartScreen) enterEditor();
      if (id !== activeDocId) {
        await sync(invoke("switch_drawing", { id }));
      }
    };
  });

  $$(".close-tab").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.closeId, 10);
      await closeDocumentTab(id);
    };
  });

  const addBtn = $("#addDocTabBtn");
  if (addBtn) {
    addBtn.onclick = async () => {
      if (showStartScreen) {
        $("#newBtn").click();
        return;
      }
      if (await sync(invoke("new_drawing"))) {
        setStatus(currentLang === "vi" ? `Đã tạo bản vẽ mới (${model.title})` : `New drawing created (${model.title})`);
      }
    };
  }
}
