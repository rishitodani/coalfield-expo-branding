/**
 * Print King - Coalfield Trade Expo 2026 stall branding registration (backend)
 * Runs as a Google Apps Script web app under contact@printking.in.
 * See SETUP.md for the deployment steps.
 */

const CONFIG = {
  ROOT_FOLDER_NAME: 'Coalfield Trade Expo 2026 - Branding',
  SHEET_NAME: 'Submissions',
  NOTIFY_EMAIL: 'contact@printking.in',
  TIME_ZONE: 'Asia/Kolkata',
  DEADLINE: '2026-11-30T23:59:59+05:30',
  CLOSE_AFTER_DEADLINE: true, // set false to keep accepting submissions after the deadline
  GST_RATE: 18,               // percent - CONFIRM before going live
  MAX_FILE_BYTES: 150 * 1024 * 1024,
  MAX_PAY_BYTES: 10 * 1024 * 1024,
  MAX_FILES: 40,
  CACHE_SECONDS: 21600
};

const PRICES = {
  flex:  { wall: 2250, design: { '3x3': 1500, '6x3': 1500, '9x3': 1500 } },
  vinyl: { wall: 3000, design: { '3x3': 2000, '6x3': 2500, '9x3': 3000 } },
  table: 350
};
const STALLS = { '3x3': { units: 1, tables: 1 }, '6x3': { units: 2, tables: 2 }, '9x3': { units: 3, tables: 3 } };
const PART_LABELS = { left: 'Left wall', back: 'Back wall', right: 'Right wall', table: 'Table vinyl' };
const PART_FOLDERS = { left: '01 Left wall', back: '02 Back wall', right: '03 Right wall', table: '04 Table vinyl', brief: '05 Design brief', payment: '06 Payment' };
const ART_EXT = ['pdf', 'ai', 'cdr', 'psd', 'tif', 'tiff', 'jpg', 'jpeg', 'png', 'eps', 'zip'];
const BRIEF_EXT = ART_EXT.concat(['doc', 'docx', 'txt']);
const PAY_EXT = ['jpg', 'jpeg', 'png', 'pdf', 'webp', 'heic'];
const PAY_MODES = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque', 'Cash', 'Other'];
const HEADERS = ['Submitted at', 'Ref', 'Status', 'Company', 'Contact person', 'Phone', 'Email', 'GSTIN', 'Address',
  'Stall size', 'Method', 'Branding parts', 'Design by Print King', 'Design brief', 'Subtotal', 'GST', 'Total payable',
  'Payment mode', 'Transaction no.', 'Amount paid', 'Drive folder', 'Work status', 'Notes'];
const COL = { REF: 2, STATUS: 3 };

/* ---------- web app entry points ---------- */

function doGet() {
  return json_({ ok: true, service: 'Print King expo branding portal' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    let out;
    if (req.action === 'init') out = handleInit_(req);
    else if (req.action === 'chunk') out = handleChunk_(req);
    else if (req.action === 'finish') out = handleFinish_(req);
    else throw new Error('Unknown request.');
    return json_(Object.assign({ ok: true }, out));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- pricing (keep identical to index.html) ---------- */

function calcPrice_(sel) {
  const st = STALLS[sel.stall];
  const pr = PRICES[sel.method];
  const lines = [];
  let designNeeded = false;
  const add = function (label, amount) { lines.push({ label: label, amount: amount }); };
  ['left', 'back', 'right'].forEach(function (k) {
    const p = sel.parts[k];
    if (!p.on) return;
    const units = k === 'back' ? st.units : 1;
    add(PART_LABELS[k] + (units > 1 ? ' (' + units * 3 + ' m)' : ''), pr.wall * units);
    if (p.mode === 'design') designNeeded = true;
  });
  if (sel.parts.table.on) {
    const q = sel.parts.table.qty;
    add('Table vinyl x ' + q, PRICES.table * q);
    if (sel.parts.table.mode === 'design') designNeeded = true;
  }
  if (designNeeded) add('Design by Print King (per stall)', pr.design[sel.stall]);
  const subtotal = lines.reduce(function (s, l) { return s + l.amount; }, 0);
  const gst = Math.round(subtotal * CONFIG.GST_RATE) / 100;
  return { lines: lines, subtotal: subtotal, gst: gst, total: subtotal + gst, designNeeded: designNeeded };
}

/* ---------- validation ---------- */

function str_(v, min, max, label) {
  const s = String(v == null ? '' : v).trim();
  if (s.length < min || s.length > max) throw new Error(label + ' is required.');
  return s;
}

function ext_(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

function cleanName_(name) {
  return String(name || 'file').replace(/[\\\/:*?"<>|#%\r\n]/g, '_').trim().slice(0, 120) || 'file';
}

function safeCell_(v) {
  if (typeof v === 'number') return v;
  const s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function checkOpen_() {
  if (CONFIG.CLOSE_AFTER_DEADLINE && new Date() > new Date(CONFIG.DEADLINE)) {
    throw new Error('Registrations are closed. The deadline was 30 November 2026.');
  }
}

function validateCompany_(c) {
  const out = {
    name: str_(c.name, 2, 100, 'Company name'),
    contact: str_(c.contact, 2, 80, 'Contact person'),
    phone: String(c.phone || '').replace(/[^0-9]/g, '').slice(-10),
    email: String(c.email || '').trim(),
    gstin: String(c.gstin || '').trim().toUpperCase(),
    address: str_(c.address, 5, 300, 'Address')
  };
  if (out.phone.length !== 10) throw new Error('Enter a valid 10-digit phone number.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email) || out.email.length > 120) throw new Error('Enter a valid email address.');
  if (out.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(out.gstin)) throw new Error('GSTIN looks incorrect. Leave it blank if you do not have one.');
  return out;
}

function validateSelection_(s) {
  if (!s || !STALLS[s.stall]) throw new Error('Choose a stall size.');
  if (!PRICES[s.method] || s.method === 'table') throw new Error('Choose flex or vinyl.');
  const st = STALLS[s.stall];
  const parts = {};
  let any = false;
  ['left', 'back', 'right', 'table'].forEach(function (k) {
    const p = (s.parts && s.parts[k]) || {};
    const on = p.on === true;
    const o = { on: on, mode: '' };
    if (on) {
      any = true;
      if (p.mode !== 'ready' && p.mode !== 'design') throw new Error('Choose artwork or design for: ' + PART_LABELS[k] + '.');
      o.mode = p.mode;
    }
    if (k === 'table') {
      o.qty = on ? parseInt(p.qty, 10) : 1;
      if (on && !(o.qty >= 1 && o.qty <= st.tables)) throw new Error('Invalid number of tables.');
    }
    parts[k] = o;
  });
  if (!any) throw new Error('Choose at least one part to brand.');
  return { stall: s.stall, method: s.method, parts: parts };
}

function validatePayment_(p, total) {
  const out = {
    mode: String(p.mode || ''),
    txn: str_(p.txn, 4, 40, 'Transaction number'),
    amount: Number(p.amount)
  };
  if (PAY_MODES.indexOf(out.mode) < 0) throw new Error('Choose how you paid.');
  if (Math.abs(out.amount - total) > 0.001) throw new Error('The payment amount does not match the total payable.');
  return out;
}

function validateFiles_(files, sel, designNeeded) {
  if (!Array.isArray(files) || files.length > CONFIG.MAX_FILES) throw new Error('Too many files.');
  const counts = { left: 0, back: 0, right: 0, table: 0, brief: 0, payment: 0 };
  const keys = {};
  const out = files.map(function (f) {
    const part = String(f.part);
    if (!(part in counts)) throw new Error('Unexpected file.');
    const name = cleanName_(f.name);
    const size = Number(f.size);
    const key = String(f.key);
    if (keys[key]) throw new Error('Duplicate file entry.');
    keys[key] = true;
    if (!(size > 0)) throw new Error('A file is empty: ' + name);
    if (part === 'payment') {
      if (PAY_EXT.indexOf(ext_(name)) < 0) throw new Error('Payment proof must be an image or PDF.');
      if (size > CONFIG.MAX_PAY_BYTES) throw new Error('Payment proof is larger than 10 MB.');
    } else {
      const okExt = part === 'brief' ? BRIEF_EXT : ART_EXT;
      if (okExt.indexOf(ext_(name)) < 0) throw new Error('File type not allowed: ' + name);
      if (size > CONFIG.MAX_FILE_BYTES) throw new Error('File is larger than 150 MB: ' + name);
      if (part === 'brief') {
        if (!designNeeded) throw new Error('Design files were not expected.');
      } else {
        const p = sel.parts[part];
        if (!p.on || p.mode !== 'ready') throw new Error('Unexpected artwork file for ' + PART_LABELS[part] + '.');
      }
    }
    counts[part]++;
    return { key: key, part: part, name: name, size: size, mime: String(f.mime || 'application/octet-stream').slice(0, 100) };
  });
  if (counts.payment !== 1) throw new Error('Upload your payment screenshot.');
  ['left', 'back', 'right', 'table'].forEach(function (k) {
    const p = sel.parts[k];
    if (p.on && p.mode === 'ready' && counts[k] < 1) throw new Error('Upload artwork for: ' + PART_LABELS[k] + '.');
  });
  return out;
}

/* ---------- Drive and Sheet helpers ---------- */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) sh = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getRoot_() {
  const it = DriveApp.getFoldersByName(CONFIG.ROOT_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
}

function headerOf_(res, name) {
  const h = res.getAllHeaders();
  const lower = name.toLowerCase();
  for (const k in h) { if (k.toLowerCase() === lower) return h[k]; }
  return null;
}

function createSession_(folder, name, mime) {
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime },
    payload: JSON.stringify({ name: name, parents: [folder.getId()] }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Could not start the upload (' + res.getResponseCode() + ').');
  const loc = headerOf_(res, 'Location');
  if (!loc) throw new Error('Could not start the upload.');
  return loc;
}

function randomId_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function norm_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findDuplicate_(sh, company, txn) {
  const last = sh.getLastRow();
  if (last < 2) return;
  const rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  rows.forEach(function (r) {
    if (r[COL.STATUS - 1] !== 'RECEIVED') return;
    if (norm_(r[19 - 1]) === norm_(txn)) throw new Error('This transaction number has already been submitted.');
    if (norm_(r[4 - 1]) === norm_(company.name) && String(r[6 - 1]).replace(/[^0-9]/g, '').slice(-10) === company.phone) {
      throw new Error('A registration for this company and phone number has already been submitted. It cannot be submitted again or edited. Contact Print King on 6297024220.');
    }
  });
}

/* ---------- actions ---------- */

function handleInit_(req) {
  if (req.website) throw new Error('Submission rejected.');
  checkOpen_();
  const company = validateCompany_(req.company || {});
  const sel = validateSelection_(req.selection);
  const price = calcPrice_(sel);
  const pay = validatePayment_(req.payment || {}, price.total);
  const brief = String(req.brief || '').trim().slice(0, 1000);
  const files = validateFiles_(req.files, sel, price.designNeeded);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let ref, folder, token, uploads;
  try {
    const sh = getSheet_();
    findDuplicate_(sh, company, pay.txn);
    const n = Math.max(sh.getLastRow(), 1);
    ref = 'BR-' + ('000' + n).slice(-3);
    folder = getRoot_().createFolder(ref + ' - ' + cleanName_(company.name).slice(0, 60));
    const subs = {};
    const sub = function (part) { return subs[part] || (subs[part] = folder.createFolder(PART_FOLDERS[part])); };
    token = randomId_();
    uploads = [];
    const cache = CacheService.getScriptCache();
    files.forEach(function (f) {
      const uploadId = randomId_();
      const session = createSession_(sub(f.part), f.name, f.mime);
      cache.put('up_' + uploadId, JSON.stringify({ ref: ref, token: token, session: session, total: f.size }), CONFIG.CACHE_SECONDS);
      uploads.push({ key: f.key, uploadId: uploadId });
    });
    const partsText = Object.keys(PART_LABELS).filter(function (k) { return sel.parts[k].on; }).map(function (k) {
      const p = sel.parts[k];
      return PART_LABELS[k] + (k === 'table' ? ' x' + p.qty : '') + ' (' + (p.mode === 'ready' ? 'own artwork' : 'Print King design') + ')';
    }).join('; ');
    const row = [
      Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'dd MMM yyyy HH:mm'), ref, 'INCOMPLETE',
      company.name, company.contact, company.phone, company.email, company.gstin, company.address,
      stallLabel_(sel.stall), sel.method === 'flex' ? 'Flex on iron frame' : 'Vinyl on boards',
      partsText, price.designNeeded ? 'Yes' : 'No', brief, price.subtotal, price.gst, price.total,
      pay.mode, pay.txn, pay.amount, folder.getUrl(), '', ''
    ].map(safeCell_);
    sh.appendRow(row);
    cache.put('sub_' + ref, JSON.stringify({
      token: token, uploads: uploads.map(function (u) { return u.uploadId; }),
      folderId: folder.getId(), folderUrl: folder.getUrl(), company: company, partsText: partsText,
      stall: sel.stall, method: sel.method, lines: price.lines, subtotal: price.subtotal, gst: price.gst,
      total: price.total, pay: pay, brief: brief
    }), CONFIG.CACHE_SECONDS);
  } finally {
    lock.releaseLock();
  }
  return { ref: ref, token: token, uploads: uploads, total: price.total };
}

function handleChunk_(req) {
  const cache = CacheService.getScriptCache();
  const raw = cache.get('up_' + req.uploadId);
  if (!raw) throw new Error('Upload session expired. Please start again.');
  const up = JSON.parse(raw);
  if (up.ref !== req.ref || up.token !== req.token) throw new Error('Upload not allowed.');
  const bytes = Utilities.base64Decode(req.data);
  const offset = Number(req.offset);
  if (!(offset >= 0) || bytes.length === 0 || offset + bytes.length > up.total) throw new Error('Invalid chunk.');
  const end = offset + bytes.length - 1;
  const res = UrlFetchApp.fetch(up.session, {
    method: 'put',
    contentType: 'application/octet-stream',
    headers: { 'Content-Range': 'bytes ' + offset + '-' + end + '/' + up.total },
    payload: bytes,
    followRedirects: false,
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 200 || code === 201) {
    cache.put('done_' + req.uploadId, '1', CONFIG.CACHE_SECONDS);
    return { next: up.total, done: true };
  }
  if (code === 308) {
    const range = headerOf_(res, 'Range');
    const m = range ? /bytes=0-(\d+)/.exec(range) : null;
    return { next: m ? Number(m[1]) + 1 : 0, done: false };
  }
  throw new Error('Upload failed (' + code + '). Please retry.');
}

function handleFinish_(req) {
  const cache = CacheService.getScriptCache();
  const raw = cache.get('sub_' + req.ref);
  if (!raw) throw new Error('This submission has expired. Please contact Print King on 6297024220.');
  const sub = JSON.parse(raw);
  if (sub.token !== req.token) throw new Error('Not allowed.');
  sub.uploads.forEach(function (id) {
    if (!cache.get('done_' + id)) throw new Error('Some files have not finished uploading.');
  });
  const sh = getSheet_();
  const cell = sh.getRange(1, COL.REF, Math.max(sh.getLastRow(), 1), 1).createTextFinder(req.ref).matchEntireCell(true).matchCase(true).findNext();
  if (!cell) throw new Error('Submission not found.');
  const statusCell = sh.getRange(cell.getRow(), COL.STATUS);
  if (statusCell.getValue() === 'RECEIVED') return { ref: req.ref, total: sub.total };
  statusCell.setValue('RECEIVED');

  const folder = DriveApp.getFolderById(sub.folderId);
  folder.createFile('Registration details.txt', summaryText_(req.ref, sub));
  try { sendEmails_(req.ref, sub); } catch (err) { /* email problems must not fail the submission */ }
  return { ref: req.ref, total: sub.total };
}

/* ---------- summary and email ---------- */

function inr_(n) {
  return 'Rs. ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

function stallLabel_(k) {
  return ({ '3x3': '10 ft x 10 ft', '6x3': '20 ft x 10 ft', '9x3': '30 ft x 10 ft' })[k] || k;
}

function summaryText_(ref, s) {
  const c = s.company;
  const lines = [
    'Coalfield Trade Expo 2026 - stall branding registration', 'Reference: ' + ref, '',
    'Company: ' + c.name, 'Contact person: ' + c.contact, 'Phone: ' + c.phone, 'Email: ' + c.email,
    'GSTIN: ' + (c.gstin || '-'), 'Address: ' + c.address, '',
    'Stall: ' + stallLabel_(s.stall), 'Method: ' + (s.method === 'flex' ? 'Flex on iron frame' : 'Vinyl on boards'),
    'Parts: ' + s.partsText, ''
  ];
  s.lines.forEach(function (l) { lines.push(l.label + ': ' + inr_(l.amount)); });
  lines.push('Subtotal: ' + inr_(s.subtotal), 'GST ' + CONFIG.GST_RATE + '%: ' + inr_(s.gst), 'Total payable: ' + inr_(s.total), '',
    'Payment mode: ' + s.pay.mode, 'Transaction no.: ' + s.pay.txn, 'Amount paid: ' + inr_(s.pay.amount));
  if (s.brief) lines.push('', 'Design brief:', s.brief);
  return lines.join('\n');
}

function sendEmails_(ref, s) {
  const c = s.company;
  const body = '<p>Hello ' + esc_(c.contact) + ',</p>' +
    '<p>We have received the stall branding registration for <b>' + esc_(c.name) + '</b> at Coalfield Trade Expo 2026. Your reference is <b>' + ref + '</b>.</p>' +
    '<p>Parts: ' + esc_(s.partsText) + '<br>Total payable (incl. GST): <b>' + inr_(s.total) + '</b><br>Payment: ' + esc_(s.pay.mode) + ', ref ' + esc_(s.pay.txn) + '</p>' +
    '<p>Our team will verify your payment and artwork. This registration cannot be edited. For any change, call or WhatsApp 6297024220.</p>' +
    '<p>Print King<br>www.printking.in</p>';
  MailApp.sendEmail({ to: c.email, subject: 'Stall branding registration received - ' + ref, htmlBody: body, name: 'Print King', replyTo: CONFIG.NOTIFY_EMAIL });
  MailApp.sendEmail({
    to: CONFIG.NOTIFY_EMAIL, subject: 'New branding registration ' + ref + ' - ' + c.name,
    htmlBody: '<pre>' + esc_(summaryText_(ref, s)) + '</pre><p><a href="' + s.folderUrl + '">Open Drive folder</a></p>', name: 'Print King portal'
  });
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
