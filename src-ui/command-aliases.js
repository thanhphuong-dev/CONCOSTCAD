const COMMAND_ALIASES = Object.freeze({
  QNEW: "NEW",
  QSAVE: "SAVE",
  CLOSEDFILE: "CLOSE",
  QUIT: "EXIT",
  ZE: "ZOOM_EXTENTS",
  ZOOMEXTENTS: "ZOOM_EXTENTS",
  "ZOOM EXTENTS": "ZOOM_EXTENTS",
  ZS: "ZOOM_SELECTED",
  ZO: "ZOOM_SELECTED",
  "ZOOM SELECTED": "ZOOM_SELECTED",
  "ZOOM OBJECT": "ZOOM_SELECTED",
  PLOT: "EXPORT",
  PRINT: "EXPORT",
  BOM: "TAKEOFF",
  COUNT: "TAKEOFF",
  QUANTITY: "TAKEOFF",
  MS: "MODEL",
  PS: "LAYOUT",
  PAPER: "LAYOUT",
  SPL: "SPLINE",
  CLOUD: "REVCLOUD",
  H: "HATCH",
  DLI: "DIM",
  DIMLINEAR: "DIM",
  DAL: "DIM",
  AA: "AREA",
  DI: "DIST",
  MEASURE: "DIST",
  E: "ERASE",
  DELETE: "ERASE",
  U: "UNDO",
  M: "MOVE",
  CO: "COPY",
  CP: "COPY",
  RO: "ROTATE",
  MI: "MIRROR",
  L: "LINE",
  A: "ARC",
  PL: "PLINE",
  POLYLINE: "PLINE",
  REC: "RECTANGLE",
  RECT: "RECTANGLE",
  X: "EXPLODE",
  O: "OFFSET",
  J: "JOIN",
  F: "FILLET",
  CHA: "CHAMFER",
  TR: "TRIM",
  EX: "EXTEND",
  DT: "TEXT",
  MTEXT: "TEXT",
  DIMSTYLE: "PRECISION",
  UNITS: "PRECISION",
  DYN: "DYNAMIC_INPUT",
  DYNAMICINPUT: "DYNAMIC_INPUT",
  "DYNAMIC INPUT": "DYNAMIC_INPUT",
  CMD: "COMMAND_LINE",
  CMDLINE: "COMMAND_LINE",
  COMMANDLINE: "COMMAND_LINE",
  "COMMAND LINE": "COMMAND_LINE",
  ESC: "CANCEL",
});

export function normalizeCommand(raw, activeTool = "select") {
  const command = String(raw ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!command) return "";

  if (activeTool === "polyline") {
    if (command === "U" || command === "UNDO") return "PLINE_UNDO";
    if (command === "C" || command === "CLOSE") return "PLINE_CLOSE";
  }

  const exactAlias = Object.hasOwn(COMMAND_ALIASES, command) ? COMMAND_ALIASES[command] : null;
  if (exactAlias) return exactAlias;

  const separator = command.indexOf(" ");
  if (separator < 0) return command;
  const head = command.slice(0, separator);
  const tail = command.slice(separator + 1);
  const normalizedHead = Object.hasOwn(COMMAND_ALIASES, head) ? COMMAND_ALIASES[head] : head;
  return `${normalizedHead} ${tail}`;
}
