/**
 * Core engine: reads the Century VMS / EPIC source workbook (sheets "BK" and
 * "PurchaseOrderItems") and builds the 3-sheet booking workbook.
 * Primary key = PO - model - ECDD.
 */
import ExcelJS from 'exceljs';

const DEFAULTS = {
  shipMode: 'Ocean',
  freightType: 'CFS/CY',
  incoterms: 'FOB',
  fobPort: 'Chittagong',
  orderType: 'Denim Order',
  fileRef: '',
  grossPerPc: 0.65,
  netPerPc: 0.55,
  cbmPerPc: 0.003,
  skipZeroQty: true,
  // Booking rule: lines sharing the same values in ALL these fields = ONE booking
  bookingFields: ['po', 'model', 'ecdd', 'factory', 'ship'],
  separateWrongCvc: true, // 'Wrong CVC PO' lines go to their own sheet instead of the upload sheet
  respectBkFilter: true, // true = only BK rows visible under the sheet's filter; false = all uploaded rows
  columnOrder: null, // null = default order
};

// field id -> [label, output column letter]
const BOOKING_FIELDS = {
  po: ['PO', 'H'], model: ['model', 'J'], ecdd: ['ECDD', 'R'], asin: ['ASIN', 'I'], windowEnd: ['Window end', 'Q'],
  status: ['PO status', 'T'], vendor: ['Vendor code', 'U'], factory: ['Factory', 'V'], ship: ['Ship', 'W'], cpq: ['Case Pack', 'L'],
};
function bookingKey(l, fields) {
  return fields.map((f) => (l[f] instanceof Date ? iso(l[f]) : String(l[f] ?? ''))).join('|');
}
/** Groups lines of the same booking together (order of first appearance) and numbers bookings 1,2,3…
 *  Every line of a booking carries that booking's number. Returns the booking count. */
function assignBookings(lines, fields) {
  const groups = new Map();
  lines.forEach((l) => {
    const k = bookingKey(l, fields);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(l);
  });
  let n = 0;
  const out = [];
  for (const [k, g] of groups) {
    n++;
    g.forEach((l, i) => { l.bookingKey = k; l.bookingNo = n; l.bookingFirst = i === 0 ? 1 : 0; out.push(l); });
  }
  lines.splice(0, lines.length, ...out);
  return n;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// ---------- helpers ----------
const txt = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString();
    if (v.result !== undefined) return txt(v.result);
    if (v.text !== undefined) return String(v.text).trim();
    if (v.richText) return v.richText.map((r) => r.text).join('').trim();
    return '';
  }
  return String(v).trim();
};
const val = (v) => {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if (v.result !== undefined) return v.result;
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.text !== undefined) return v.text;
    return null;
  }
  return v;
};
const num = (v) => {
  v = val(v);
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const toDate = (v) => {
  v = val(v);
  if (v instanceof Date) return v;
  if (typeof v === 'string' && v.trim()) {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // m/d/yyyy as used by Amazon
    if (m) return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
    const d = new Date(v);
    if (!isNaN(d)) return d;
  }
  return null;
};
const iso = (d) => (d ? d.toISOString().slice(0, 10) : '');
const fmtDate = (d) => {
  if (!d) return '';
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getUTCDate()).padStart(2, '0')}-${M[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function findSheet(wb, name) {
  const n = norm(name);
  return wb.worksheets.find((w) => norm(w.name) === n) || wb.worksheets.find((w) => norm(w.name).includes(n));
}

/** Locate the header row (first row in the first 15 containing all required headers) */
function readTable(ws, required) {
  const req = required.map(norm);
  let headerRow = -1;
  let headers = [];
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const hs = [];
    row.eachCell({ includeEmpty: true }, (c, i) => (hs[i] = txt(c.value)));
    const set = new Set(hs.map(norm));
    if (req.every((q) => set.has(q))) { headerRow = r; headers = hs; break; }
  }
  if (headerRow < 0) throw new Error(`Sheet "${ws.name}": could not find header row with ${required.join(', ')}`);
  const idx = {};
  headers.forEach((h, i) => { if (h && idx[norm(h)] === undefined) idx[norm(h)] = i; });
  const rows = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (!row.hasValues) continue;
    const arr = [];
    for (let i = 1; i < headers.length; i++) arr[i] = val(row.getCell(i).value);
    rows.push({ r, arr, hidden: row.hidden === true });
  }
  const get = (rec, name) => rec.arr[idx[norm(name)]];
  return { headers: headers.slice(1), headerRow, rows, get, idx, nCols: headers.length - 1 };
}

// ---------- load & analyse ----------
async function loadSource(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const wsBK = findSheet(wb, 'BK');
  const wsPO = findSheet(wb, 'PurchaseOrderItems');
  const missing = [];
  if (!wsBK) missing.push('BK');
  if (!wsPO) missing.push('PurchaseOrderItems');
  if (missing.length) throw new Error(`Missing sheet(s): ${missing.join(', ')}. Found: ${wb.worksheets.map((w) => w.name).join(', ')}`);

  const bk = readTable(wsBK, ['PO', 'Model', 'ECDD', 'Ship']);
  const po = readTable(wsPO, ['PO', 'Model', 'ECDD', 'ASIN', 'Accepted quantity']);

  // BK: drop total rows / blanks
  bk.rows = bk.rows.filter((x) => txt(bk.get(x, 'PO')) && toDate(bk.get(x, 'ECDD')));
  po.rows = po.rows.filter((x) => txt(po.get(x, 'PO')) && txt(po.get(x, 'ASIN')));

  const key = (g, rec) => `${txt(g(rec, 'PO'))}|${txt(g(rec, 'Model'))}|${iso(toDate(g(rec, 'ECDD')))}`;
  const poByKey = new Map();
  po.rows.forEach((x) => {
    const k = key(po.get, x);
    if (!poByKey.has(k)) poByKey.set(k, []);
    poByKey.get(k).push(x);
  });

  // Correct-factory -> vendor code map (learned from rows where received CVC factory == correct factory)
  const factoryVendor = {};
  po.rows.forEach((x) => {
    const recv = txt(po.get(x, 'Received PO CVC wise Factory'));
    const corr = txt(po.get(x, 'Correct Factory will be'));
    const ven = txt(po.get(x, 'Vendor'));
    if (recv && corr && recv === corr && ven) factoryVendor[corr] = ven;
  });

  return { wb, bk, po, key, poByKey, factoryVendor };
}

function buildPlan(src, opts) {
  const o = { ...DEFAULTS, ...opts };
  const { bk, po, key, poByKey, factoryVendor } = src;
  const selected = o.ecdds && o.ecdds.length ? new Set(o.ecdds) : null;
  const lines = [];
  const bkUsed = [];
  const warnings = [];
  const keySummary = [];
  const poUsedRows = [];
  let zeroSkipped = 0;

  const bkSorted = [...bk.rows].sort((a, b) => {
    const A = key(bk.get, a), B = key(bk.get, b);
    return A < B ? -1 : A > B ? 1 : 0;
  });

  for (const b of bkSorted) {
    const ecdd = toDate(bk.get(b, 'ECDD'));
    if (o.respectBkFilter && b.hidden) continue;
    if (selected && !selected.has(iso(ecdd))) continue;
    const k = key(bk.get, b);
    const items = poByKey.get(k);
    const poNo = txt(bk.get(b, 'PO'));
    const model = txt(bk.get(b, 'Model'));
    if (!items) {
      warnings.push({ level: 'error', key: k.replace(/\|/g, '-'), msg: 'BK key has no matching rows in PurchaseOrderItems' });
      continue;
    }
    bkUsed.push(b);
    let qty = 0, rowsK = 0;
    for (const it of items) {
      poUsedRows.push(it);
      const q = num(po.get(it, 'Accepted quantity'));
      if (q <= 0 && o.skipZeroQty) { zeroSkipped++; continue; }
      const correct = txt(po.get(it, 'Correct Factory will be')) || txt(po.get(it, 'Received PO CVC wise Factory'));
      const vendor = factoryVendor[correct] || txt(po.get(it, 'Vendor'));
      const status = txt(po.get(it, 'PO Status'));
      lines.push({
        po: poNo, asin: txt(po.get(it, 'ASIN')), model,
        qty: q, cpq: num(po.get(it, 'CPQ')) || num(bk.get(b, 'CPQ')) || 12,
        windowEnd: toDate(po.get(it, 'Window end')) || toDate(bk.get(b, 'Window end')),
        ecdd, status, vendor, factory: correct,
        ship: txt(po.get(it, 'Ship')) || txt(bk.get(b, 'Ship')),
        recvVendor: txt(po.get(it, 'Vendor')), recvFactory: txt(po.get(it, 'Received PO CVC wise Factory')), correctFactory: correct,
        wrongCvc: /wrong/i.test(status), bkVisible: !b.hidden,
      });
      qty += q; rowsK++;
    }
    const bkQty = num(bk.get(b, 'Sum of Accepted quantity'));
    {
      const itemsQty = items.reduce((s, it) => s + num(po.get(it, 'Accepted quantity')), 0);
      if (Math.abs(bkQty - itemsQty) > 0.5)
        warnings.push({ level: 'warn', key: k.replace(/\|/g, '-'), msg: `BK qty ${bkQty} ≠ PurchaseOrderItems qty ${itemsQty}` });
    }
    keySummary.push({ key: k.replace(/\|/g, '-'), po: poNo, model, ecdd: iso(ecdd), asins: rowsK, qty });
  }
  if (zeroSkipped) warnings.push({ level: 'info', key: '', msg: `${zeroSkipped} ASIN row(s) with 0 accepted quantity were excluded` });
  const wrong = new Set(lines.filter((l) => l.wrongCvc).map((l) => `${l.po}-${l.model}`));
  if (wrong.size) warnings.push({ level: 'info', key: '', msg: o.separateWrongCvc ? `${wrong.size} PO-model combinations are "Wrong CVC PO" — moved to the separate "WRONG CVC PO" sheet` : `${wrong.size} PO-model combinations are "Wrong CVC PO" — booked under the corrected factory/vendor` });

  const fields = (o.bookingFields && o.bookingFields.length ? o.bookingFields : DEFAULTS.bookingFields).filter((f) => BOOKING_FIELDS[f]);
  o.bookingFields = fields;
  const wrongLines = o.separateWrongCvc ? lines.filter((l) => l.wrongCvc) : [];
  const mainLines = o.separateWrongCvc ? lines.filter((l) => !l.wrongCvc) : lines;
  const bookings = assignBookings(mainLines, fields);
  const wrongBookings = assignBookings(wrongLines, fields);
  const sum = (ls, f) => ls.reduce((s2, l) => s2 + f(l), 0);
  const stats = {
    bookings,
    pos: new Set(mainLines.map((l) => l.po)).size,
    keys: keySummary.length,
    rows: mainLines.length,
    qty: sum(mainLines, (l) => l.qty),
    cartons: sum(mainLines, (l) => l.qty / l.cpq),
    cbm: sum(mainLines, (l) => l.qty * o.cbmPerPc),
    gross: sum(mainLines, (l) => l.qty * o.grossPerPc),
    wrongCvcRows: lines.filter((l) => l.wrongCvc).length,
    wrongRows: wrongLines.length, wrongBookings, wrongPos: new Set(wrongLines.map((l) => l.po)).size, wrongQty: sum(wrongLines, (l) => l.qty),
    models: new Set(mainLines.map((l) => l.model)).size,
  };
  return { o, lines: mainLines, wrongLines, bkUsed, poUsedRows, warnings, keySummary, stats };
}

/** Lightweight analysis for the UI (ECDD chips, insights, preview) */
async function analyze(buffer) {
  const src = await loadSource(buffer);
  const full = buildPlan(src, { respectBkFilter: false, separateWrongCvc: false }); // everything; each line says whether BK's filter shows it
  const vis = src.bk.rows.filter((b) => !b.hidden), hid = src.bk.rows.filter((b) => b.hidden);
  const uniq = (rows) => [...new Set(rows.map((b) => txt(src.bk.get(b, 'PO Status'))))].filter(Boolean);
  return {
    sheets: src.wb.worksheets.map((w) => ({ name: w.name, rows: w.rowCount })),
    bkRows: src.bk.rows.length, poRows: src.po.rows.length,
    bkInfo: { total: src.bk.rows.length, visible: vis.length, hidden: hid.length, visibleStatuses: uniq(vis), hiddenStatuses: uniq(hid) },
    stats: full.stats, warnings: full.warnings, factoryVendor: src.factoryVendor,
    lines: full.lines.map((l) => ({ po: l.po, asin: l.asin, model: l.model, qty: l.qty, cpq: l.cpq, ecdd: iso(l.ecdd), windowEnd: iso(l.windowEnd), status: l.status, vendor: l.vendor, factory: l.factory, ship: l.ship, wrongCvc: l.wrongCvc, bkVisible: l.bkVisible })),
  };
}

// ---------- output column catalogue (order is user-configurable) ----------
// kind: 'v' value, 'f' formula.  w = width, fmt = number format
const COLUMNS = {
  sl: { label: 'SL NO', w: 8 }, date: { label: 'WORKING DATE', w: 14, fmt: 'mm-dd-yy' },
  bserial: { label: 'BOOKING SERIAL', w: 16 }, bcount: { label: 'BOOKING COUNTING', w: 18 },
  shipMode: { label: 'Ship Mode', w: 11 }, freight: { label: 'Freight Type', w: 13 }, incoterms: { label: 'Incoterms', w: 11 },
  fobPort: { label: 'FOB Port', w: 13 }, orderType: { label: 'Order Type', w: 16 }, po: { label: 'PO', w: 12 },
  asin: { label: 'ASIN', w: 14 }, model: { label: 'model', w: 18 }, qty: { label: 'PO Qty', w: 9 }, cpq: { label: 'Case Pack', w: 10 },
  carton: { label: 'Carton Qty', w: 11, fmt: '0.00' }, gross: { label: 'Gross Weight', w: 12, fmt: '0.00' },
  net: { label: 'Net Weight', w: 12, fmt: '0.00' }, cbm: { label: 'CBM', w: 9, fmt: '0.000' },
  windowEnd: { label: 'Window end', w: 13, fmt: 'mm/dd/yyyy' }, ecdd: { label: 'ECDD', w: 13, fmt: 'mm/dd/yyyy' },
  file: { label: 'File', w: 14 }, status: { label: 'PO status', w: 15 }, vendor: { label: 'Ship/Vendor Code', w: 16 },
  factory: { label: 'Factory', w: 11 }, ship: { label: 'Ship', w: 8 },
  correctFactory: { label: 'Correct Factory will be', w: 24 }, action: { label: 'Action', w: 18 },
};
// default order: BOOKING SERIAL = column 3, BOOKING COUNTING = column 4
const DEFAULT_ORDER = ['sl', 'date', 'bserial', 'bcount', 'shipMode', 'freight', 'incoterms', 'fobPort', 'orderType', 'po', 'asin', 'model',
  'qty', 'cpq', 'carton', 'gross', 'net', 'cbm', 'windowEnd', 'ecdd', 'file', 'status', 'vendor', 'factory', 'ship'];
function resolveOrder(order) {
  const seen = new Set();
  const out = (Array.isArray(order) ? order : []).filter((id) => COLUMNS[id] && !seen.has(id) && seen.add(id));
  DEFAULT_ORDER.forEach((id) => { if (!seen.has(id)) out.push(id); });
  return out;
}
const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

// ---------- write workbook ----------
const BRAND = 'FF1F3A5F';

function styleHeader(row, color = BRAND) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = { bottom: { style: 'thin', color: { argb: 'FF9FB3C8' } } };
  });
  row.height = 28;
}

async function generate(buffer, opts, onProgress = () => {}) {
  onProgress(0, 'Starting');
  onProgress(5, 'Reading source workbook');
  const src = await loadSource(buffer);
  onProgress(30, 'Matching PO-model-ECDD keys'); await tick();
  const plan = buildPlan(src, opts);
  const o = plan.o;
  if (!plan.lines.length && !plan.wrongLines.length) throw new Error('No booking rows were produced for the selected ECDD dates.');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'UIC Century VMS Booking Builder';
  wb.created = new Date();

  // ---- Sheet 1 (+ Wrong CVC sheet): upload format ----
  const now = new Date();
  const todaySerial = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
  wb.calcProperties = { fullCalcOnLoad: true };
  const writeUploadSheet = (name, sorted, { recv = false, tableName = 'Table57', head = BRAND, tab = null } = {}) => {
    const order = resolveOrder(o.columnOrder).concat(recv ? ['correctFactory', 'action'] : []);
    const L = {}; order.forEach((id, i) => (L[id] = colLetter(i + 1)));
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }], properties: tab ? { tabColor: { argb: tab } } : {} });
    ws.columns = order.map((id) => ({ width: COLUMNS[id].w }));
    const cellFor = (id, l, i, r) => {
      switch (id) {
        case 'sl': return i + 1;
        case 'date': return { formula: 'TODAY()', result: todaySerial };
        case 'shipMode': return o.shipMode; case 'freight': return o.freightType; case 'incoterms': return o.incoterms;
        case 'fobPort': return o.fobPort; case 'orderType': return o.orderType; case 'file': return o.fileRef;
        case 'po': return l.po; case 'asin': return l.asin; case 'model': return l.model; case 'qty': return l.qty; case 'cpq': return l.cpq;
        case 'carton': return { formula: `${L.qty}${r}/${L.cpq}${r}`, result: l.qty / l.cpq };
        case 'gross': return { formula: `${L.qty}${r}*${o.grossPerPc}`, result: l.qty * o.grossPerPc };
        case 'net': return { formula: `${L.qty}${r}*${o.netPerPc}`, result: l.qty * o.netPerPc };
        case 'cbm': return { formula: `${L.qty}${r}*${o.cbmPerPc}`, result: l.qty * o.cbmPerPc };
        case 'windowEnd': return l.windowEnd; case 'ecdd': return l.ecdd; case 'status': return l.status;
        case 'vendor': return recv ? l.recvVendor : l.vendor; case 'factory': return recv ? l.recvFactory : l.factory; case 'ship': return l.ship;
        case 'correctFactory': return l.correctFactory; case 'action': return 'Need CVC change';
        case 'bcount': {
          const crit = o.bookingFields.map((f) => { const c = L[f]; return `${c}$2:${c}${r},${c}${r}`; }).join(',');
          const X = L.bcount;
          return { formula: `IF(COUNTIFS(${crit})=1,MAX(${X}$1:${X}${r - 1})+1,${X}${r - 1})`, result: l.bookingNo };
        }
        case 'bserial': { const X = L.bcount; return { formula: `IF(${X}${r}<>${X}${r - 1},${X}${r},"")`, result: l.bookingFirst ? l.bookingNo : '' }; }
      }
    };
    const dataRows = sorted.map((l, i) => order.map((id) => cellFor(id, l, i, i + 2)));
    ws.addTable({
      name: tableName, ref: 'A1', headerRow: true, totalsRow: false,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: order.map((id) => ({ name: COLUMNS[id].label, filterButton: true })),
      rows: dataRows,
    });
    sorted.forEach((l, i) => {
      const row = ws.getRow(i + 2);
      order.forEach((id, ci) => {
        const c = row.getCell(ci + 1), sp = COLUMNS[id];
        if (sp.fmt) c.numFmt = sp.fmt;
        if (id === 'status' && l.wrongCvc) c.font = { color: { argb: 'FFC2410C' }, bold: true };
        if (id === 'bcount') { c.alignment = { horizontal: 'center' }; c.font = { bold: true, color: { argb: l.bookingFirst ? 'FF15803D' : 'FF6B7280' } }; }
        if (id === 'bserial') { c.alignment = { horizontal: 'center' }; c.font = { bold: true, color: { argb: 'FF1D4ED8' } }; }
      });
    });
    styleHeader(ws.getRow(1), head);
    return ws;
  };

  onProgress(50, 'Building upload sheet'); await tick();
  writeUploadSheet('UPLOAD FILE FORMAT USER', plan.lines);
  if (plan.wrongLines.length) {
    onProgress(60, 'Separating Wrong CVC POs');
    writeUploadSheet('WRONG CVC PO', plan.wrongLines, { recv: true, tableName: 'WrongCvcTable', head: 'FFC2410C', tab: 'FFF97316' });
  }

  // ---- Sheet 2: BK (filtered) ----
  onProgress(70, 'Copying BK rows'); await tick();
  const w2 = wb.addWorksheet('BK', { views: [{ state: 'frozen', ySplit: 1 }] });
  w2.addRow(src.bk.headers);
  plan.bkUsed.forEach((b) => {
    const arr = src.bk.headers.map((_, i) => {
      const v = b.arr[i + 1];
      return v && typeof v === 'object' && !(v instanceof Date) ? null : v ?? null;
    });
    const row = w2.addRow(arr);
    row.eachCell((c) => { if (c.value instanceof Date) c.numFmt = 'mm/dd/yyyy'; });
  });
  styleHeader(w2.getRow(1), 'FF0F766E');
  w2.columns.forEach((c, i) => (c.width = Math.max(11, Math.min(34, String(src.bk.headers[i] ?? '').length + 4))));
  w2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: src.bk.headers.length } };

  // ---- Sheet 3: PurchaseOrderItems (rows used) ----
  onProgress(82, 'Copying PurchaseOrderItems rows'); await tick();
  const w3 = wb.addWorksheet('PurchaseOrderItems', { views: [{ state: 'frozen', ySplit: 1 }] });
  w3.addRow(src.po.headers);
  plan.poUsedRows.forEach((p) => {
    const arr = src.po.headers.map((_, i) => {
      const v = p.arr[i + 1];
      return v && typeof v === 'object' && !(v instanceof Date) ? null : v ?? null;
    });
    const row = w3.addRow(arr);
    row.eachCell((c) => { if (c.value instanceof Date) c.numFmt = 'mm/dd/yyyy'; });
  });
  styleHeader(w3.getRow(1), 'FF7C3AED');
  w3.columns.forEach((c, i) => (c.width = Math.max(11, Math.min(30, String(src.po.headers[i] ?? '').length + 4))));
  w3.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: src.po.headers.length } };

  onProgress(92, 'Saving file'); await tick();
  const out = await wb.xlsx.writeBuffer();
  onProgress(100, 'Done');
  return { buffer: out, stats: plan.stats, warnings: plan.warnings, keySummary: plan.keySummary };
}

export { analyze, generate, DEFAULTS, BOOKING_FIELDS, COLUMNS, DEFAULT_ORDER, fmtDate };
