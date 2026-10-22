import { useEffect, useMemo, useRef, useState } from 'react';
import * as core from './core.js';
import Guide from './Guide.jsx';
import './bookingBuilder.css';

const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dlabel = (iso) => {
  if (!iso || typeof iso !== 'string') return '';
  const [y, m, d] = iso.split('-');
  return `${d} ${MONTHS[+m - 1]} ${y}`;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n, l = 2) => String(n).padStart(l, '0');
const DEFAULT_RULE = ['po', 'model', 'ecdd', 'factory', 'ship'];
const COND = [
  ['po', 'PO'],
  ['model', 'model'],
  ['ecdd', 'ECDD'],
  ['asin', 'ASIN'],
  ['windowEnd', 'Window end'],
  ['status', 'PO status'],
  ['vendor', 'Vendor code'],
  ['factory', 'Factory'],
  ['ship', 'Ship'],
  ['cpq', 'Case Pack']
];
const lbl = (f) => COND.find((c) => c[0] === f)?.[1] || f;
const FIELDS = [
  ['shipMode', 'Ship Mode'],
  ['freightType', 'Freight Type'],
  ['incoterms', 'Incoterms'],
  ['fobPort', 'FOB Port'],
  ['orderType', 'Order Type'],
  ['fileRef', 'File (e.g. EG5-10325)'],
  ['grossPerPc', 'Gross wt / pc (kg)', 'number'],
  ['netPerPc', 'Net wt / pc (kg)', 'number'],
  ['cbmPerPc', 'CBM / pc', 'number']
];
const STEPS = [
  [5, 'Read source'],
  [30, 'Match keys'],
  [50, 'Build upload sheet'],
  [60, 'Wrong CVC sheet'],
  [70, 'Copy BK rows'],
  [82, 'Copy PO items'],
  [92, 'Save file']
];
const colLabels = Object.fromEntries(Object.entries(core.COLUMNS).map(([k, v]) => [k, v.label]));

const ls = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      /* ignore */
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch (e) {
      /* ignore */
    }
  }
};
const fmtDur = (ms) => (ms < 60000 ? (ms / 1000).toFixed(2) + ' s' : Math.floor(ms / 60000) + ' min ' + ((ms % 60000) / 1000).toFixed(1) + ' s');
const clockParts = (ms) => [`${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}`, `.${pad(Math.floor(ms % 1000), 3)}`];

export default function BookingBuilder() {
  const [tab, setTab] = useState('main');
  const [theme, setTheme] = useState(() => ls.get('bb_theme', 'dark'));
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null); // { name, buffer }
  const [data, setData] = useState(null);
  const [chat, setChat] = useState([]); // { html, cls, typing }
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [respectFilter, setRespectFilter] = useState(() => ls.get('respectFilter', true));
  const [selected, setSelected] = useState(new Set());
  const [settings, setSettings] = useState({ ...core.DEFAULTS });
  const [bookingFields, setBookingFields] = useState(() => {
    const b = ls.get('bookingFields2', null);
    return Array.isArray(b) && b.length ? b : [...DEFAULT_RULE];
  });
  const [colOrder, setColOrder] = useState(() => {
    const o = ls.get('colOrder', null);
    return Array.isArray(o)
      ? [...o.filter((x) => colLabels[x]), ...core.DEFAULT_ORDER.filter((x) => !o.includes(x))]
      : [...core.DEFAULT_ORDER];
  });
  const [toast, setToast] = useState('');
  const [result, setResult] = useState(null); // { name, url, stats }
  const [timer, setTimer] = useState({ open: false, running: false, pct: 0, stage: '', state: 'run', html: '', t0: 0, ms: 0 });
  const fileInput = useRef(null);
  const chatEnd = useRef(null);
  const toastT = useRef(0);
  const dragId = useRef(null);

  useEffect(() => {
    ls.set('bb_theme', theme);
  }, [theme]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: 'end' });
  }, [chat]);

  useEffect(() => {
    ls.set('bookingFields2', bookingFields);
  }, [bookingFields]);

  useEffect(() => {
    ls.set('colOrder', colOrder);
  }, [colOrder]);

  useEffect(() => {
    ls.set('respectFilter', respectFilter);
  }, [respectFilter]);

  useEffect(() => {
    if (!timer.running) return undefined;
    let raf;
    const tickf = () => {
      setTimer((t) => ({ ...t, ms: performance.now() - t.t0 }));
      raf = requestAnimationFrame(tickf);
    };
    raf = requestAnimationFrame(tickf);
    return () => cancelAnimationFrame(raf);
  }, [timer.running]);

  const showToast = (t) => {
    setToast(t);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 2800);
  };

  const say = async (html, cls = '', delay = 350) => {
    setChat((c) => [...c, { typing: true }]);
    await sleep(delay);
    setChat((c) => [...c.slice(0, -1), { html, cls }]);
  };

  // ---------- derived ----------
  const sepOn = settings.separateWrongCvc !== false;
  const mainOf = (l) => (sepOn ? l.filter((x) => !x.wrongCvc) : l);
  const wrongOf = (l) => (sepOn ? l.filter((x) => x.wrongCvc) : []);
  const active = useMemo(
    () => (data ? (respectFilter ? data.lines.filter((l) => l.bkVisible) : data.lines) : []),
    [data, respectFilter]
  );
  const countBookings = (lines) => new Set(lines.map((l) => bookingFields.map((f) => l[f]).join('|'))).size;
  const statsOf = (l) => ({
    pos: new Set(l.map((x) => x.po)).size,
    rows: l.length,
    qty: l.reduce((s, x) => s + x.qty, 0),
    cartons: l.reduce((s, x) => s + x.qty / x.cpq, 0),
    cbm: l.reduce((s, x) => s + x.qty * (settings.cbmPerPc || 0.003), 0)
  });

  const ecddList = useMemo(() => {
    const m = {};
    active.forEach((l) => {
      const e = (m[l.ecdd] ??= { ecdd: l.ecdd, qty: 0, pos: new Set() });
      e.qty += l.qty;
      e.pos.add(l.po);
    });
    return Object.values(m)
      .map((e) => ({ ...e, pos: e.pos.size }))
      .sort((x, y) => (x.ecdd < y.ecdd ? -1 : 1));
  }, [active]);

  // re-select every ECDD whenever the active set of dates changes
  useEffect(() => {
    setSelected(new Set(ecddList.map((e) => e.ecdd)));
  }, [ecddList]);

  const sel = active.filter((l) => selected.has(l.ecdd));
  const selMain = mainOf(sel);
  const selWrong = wrongOf(sel);
  const ruleText = bookingFields.map(lbl).join(' – ');

  // ---------- load ----------
  const load = async (f) => {
    if (busy || !f) return;
    setBusy(true);
    setResult(null);
    const buffer = await f.arrayBuffer();
    setFile({ name: f.name, buffer });
    setData(null);
    setChat([]);
    setStep(2);
    await say('Reading your workbook…', '', 200);
    const t0 = performance.now();
    let d;
    try {
      d = await core.analyze(buffer);
    } catch (e) {
      await say(`<b>Couldn't read this file.</b><br>${e.message}`, 'err');
      setBusy(false);
      return;
    }
    setFile({ name: `${f.name}  ⏱ ${((performance.now() - t0) / 1000).toFixed(1)}s`, buffer });
    const s = d.stats;
    const bi = d.bkInfo;
    const cnt = (lines) => new Set(lines.map((l) => bookingFields.map((k) => l[k]).join('|'))).size;
    const act = respectFilter ? d.lines.filter((l) => l.bkVisible) : d.lines;
    const aMain = act.filter((l) => !l.wrongCvc);
    await say(`Found sheets <b>BK</b> (${d.bkRows} keys) and <b>PurchaseOrderItems</b> (${fmt(d.poRows)} ASIN rows).`);
    if (bi.hidden) {
      await say(
        `The <b>BK sheet has a filter on</b>: only <b>${bi.visible}</b> of ${bi.total} rows are visible (${bi.visibleStatuses.join(', ') || '—'}). I'll use just those — untick <b>Use BK sheet filter</b> to use everything.`,
        'warn'
      );
    }
    await say(
      `Matched every <b>PO-model-ECDD</b> key → <b>${fmt(s.rows)}</b> ASIN lines across <b>${s.pos}</b> POs and <b>${s.models}</b> models (whole file).`,
      'ok'
    );
    await say(
      `Under the current booking rule (<b>${ruleText}</b>) that is <b>${fmt(cnt(aMain))}</b> bookings. You can change the rule in <b>Settings</b>.`,
      'ok'
    );
    await say(
      `Selected data: <b>${fmt(aMain.reduce((a, l) => a + l.qty, 0))}</b> pcs · <b>${fmt(aMain.reduce((a, l) => a + l.qty / l.cpq, 0))}</b> cartons.`
    );
    const fv = Object.entries(d.factoryVendor)
      .map(([k, v]) => `${k} → <b>${v}</b>`)
      .join(', ');
    if (s.wrongCvcRows) {
      await say(
        `<b>${fmt(s.wrongCvcRows)}</b> lines are on “Wrong CVC” POs. I'll move them to a separate <b>WRONG CVC PO</b> sheet${fv ? ' (correct factory: ' + fv + ')' : ''} — change this in Settings.`,
        'warn'
      );
    }
    const bad = d.warnings.filter((w) => w.level !== 'info');
    await say(
      bad.length ? `I found <b>${bad.length}</b> item(s) to review — see the checks panel.` : 'No key mismatches or quantity differences. Ready for your ECDD selection.',
      bad.length ? 'warn' : 'ok'
    );
    setData(d);
    setStep(3);
    setBusy(false);
  };

  const reset = () => {
    setFile(null);
    setData(null);
    setChat([]);
    setStep(1);
    setResult(null);
    setBusy(false);
    setSelected(new Set());
  };
  const toggleEcdd = (e) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(e) ? n.delete(e) : n.add(e);
      return n;
    });
  const setField = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const toggleCond = (f) => {
    if (bookingFields.includes(f)) {
      if (bookingFields.length === 1) return showToast('Keep at least one field');
      setBookingFields(bookingFields.filter((x) => x !== f));
    } else {
      setBookingFields(COND.map((x) => x[0]).filter((x) => x === f || bookingFields.includes(x)));
    }
  };
  const moveCol = (from, to) => {
    if (to < 0 || to >= colOrder.length) return;
    const o = [...colOrder];
    o.splice(to, 0, o.splice(from, 1)[0]);
    setColOrder(o);
  };
  const dropCol = (id) => {
    const d = dragId.current;
    if (!d || d === id) return;
    const o = [...colOrder];
    const from = o.indexOf(d);
    o.splice(from, 1);
    const at = o.indexOf(id);
    o.splice(at + (from < at + 1 ? 1 : 0), 0, d);
    setColOrder(o);
  };

  // ---------- generate ----------
  const timerEnd = (ok, html, ms, extra = {}) =>
    setTimer((t) => ({
      ...t,
      running: false,
      state: ok ? 'ok' : 'err',
      ms,
      pct: ok ? 100 : t.pct,
      html,
      stage: ok ? `Completed in ${fmtDur(ms)}` : `Stopped after ${fmtDur(ms)}`,
      ...extra
    }));

  const generate = async () => {
    if (busy || !file) return;
    setBusy(true);
    setStep(4);
    setResult(null);
    const t0 = performance.now();
    setTimer({ open: true, running: true, pct: 0, stage: 'Starting', state: 'run', html: '', t0, ms: 0 });
    await sleep(30);
    try {
      const r = await core.generate(
        file.buffer,
        {
          ...settings,
          bookingFields,
          columnOrder: colOrder,
          respectBkFilter: respectFilter,
          ecdds: [...selected]
        },
        (pct, msg) => setTimer((t) => ({ ...t, pct, stage: msg + '…' }))
      );
      const d = new Date();
      const name = `CENTURY VMS BOOKING_UIC_${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.xlsx`;
      const url = URL.createObjectURL(
        new Blob([r.buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      const st = r.stats;
      const ms = performance.now() - t0;
      setResult({ name, url, stats: st });
      timerEnd(
        true,
        `<div class="g"><div>Upload sheet bookings <b>${fmt(st.bookings)}</b></div><div>ASIN lines <b>${fmt(
          st.rows
        )}</b></div><div>Quantity <b>${fmt(st.qty)}</b> pcs</div><div>POs <b>${fmt(st.pos)}</b></div>${
          st.wrongRows
            ? `<div style="grid-column:span 2;color:#fb923c">Wrong CVC sheet: <b style="color:#fb923c">${fmt(
                st.wrongBookings
              )}</b> bookings · ${fmt(st.wrongRows)} lines · ${fmt(st.wrongQty)} pcs</div>`
            : ''
        }<div style="grid-column:span 2;color:var(--mu)">${name}</div></div>`,
        ms
      );
      setStep(5);
      await say(
        `Done in <b>${fmt(ms / 1000, 2)} s</b>. Sheets: <b>UPLOAD FILE FORMAT USER</b>${
          st.wrongRows ? ', <b>WRONG CVC PO</b>' : ''
        }, <b>BK</b>, <b>PurchaseOrderItems</b>.`,
        'ok',
        200
      );
    } catch (e) {
      timerEnd(false, `<b>What went wrong</b><br>${e.message}`, performance.now() - t0);
      setStep(3);
    }
    setBusy(false);
  };

  const closeTimer = () => setTimer((t) => ({ ...t, open: false }));
  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ---------- render helpers ----------
  const [tm, tms] = clockParts(timer.ms);
  const curStep = STEPS.reduce((c, [sp], i) => (timer.pct >= sp ? i : c), -1);
  const previewRows = (() => {
    const cnt = {};
    return active
      .filter((r) => selected.has(r.ecdd) && (cnt[r.ecdd] = (cnt[r.ecdd] || 0) + 1) <= 15)
      .filter((r) => mainOf([r]).length);
  })();
  const stats = statsOf(selMain);
  const loaded = !!data;

  return (
    <div className="bb-container" data-theme={theme}>
      <div className="bb-bg">
        <i className="orb o1" />
        <i className="orb o2" />
        <i className="orb o3" />
      </div>

      <header className="bb-header">
        <div className="bb-brand">
          <div className="bb-logo-uic">
            <img src="./uic-logo.png" alt="UIC Commercial" />
          </div>
          <div>
            <h1>Century VMS Booking Builder</h1>
            <p>
              Amazon EPIC · primary key <b>PO – model – ECDD – Factory – Ship</b>
            </p>
          </div>
        </div>

        <div className="bb-steps" style={{ marginLeft: 'auto' }}>
          {[
            [1, '1 Upload'],
            [2, '2 Analyse'],
            [3, '3 Configure'],
            [4, '4 Generate']
          ].map(([n, t]) => (
            <span key={n} className={n < step ? 'done' : n === step ? 'on' : ''}>
              {t}
            </span>
          ))}
        </div>

        <nav className="tabs">
          <button className={tab === 'main' ? 'on' : ''} onClick={() => setTab('main')}>
            Booking
          </button>
          <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
            ⚙ Settings
          </button>
          <button className={tab === 'guide' ? 'on' : ''} onClick={() => setTab('guide')}>
            📖 User Guide
          </button>
        </nav>

        <button
          className="bb-btn-ghost"
          title="Switch theme"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? '☾ Dark' : '☀ Light'}
        </button>
        {file && (
          <button className="bb-btn-ghost" onClick={reset}>
            ↺ New file
          </button>
        )}
      </header>

      {/* TAB 1: MAIN BOOKING WORKSPACE */}
      <main className="bb-main-view" hidden={tab !== 'main'}>
        <section className="bb-col">
          <div
            className={`bb-drop bb-card${over ? ' over' : ''}`}
            hidden={!!file}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const f = e.dataTransfer?.files?.[0];
              if (f) load(f);
            }}
          >
            <div className="pulse" />
            <svg viewBox="0 0 24 24" className="upi">
              <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
            </svg>
            <h2>Drop your SOURCE FILE here</h2>
            <p>
              or <a id="browse">browse</a> — needs sheets <code>BK</code> and <code>PurchaseOrderItems</code>
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xlsm"
              hidden
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (e.target.files?.[0]) load(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </div>

          <div className="bb-card bb-ai" hidden={!file}>
            <div className="aihead">
              <span className="spark">✦</span>
              <b>AI Assistant</b>
              <small>{file?.name}</small>
            </div>
            <div className="bb-chat">
              {chat.map((m, i) =>
                m.typing ? (
                  <div key={i} className="bb-typing">
                    <i />
                    <i />
                    <i />
                  </div>
                ) : (
                  <div key={i} className={`bb-msg ${m.cls}`} dangerouslySetInnerHTML={{ __html: m.html }} />
                )
              )}
              <div ref={chatEnd} />
            </div>
          </div>

          <div className="bb-card" hidden={!loaded}>
            <label className="bb-chk2">
              <input
                type="checkbox"
                checked={respectFilter}
                onChange={(e) => {
                  setRespectFilter(e.target.checked);
                  showToast(e.target.checked ? 'Using BK filtered rows only' : 'Using all uploaded BK rows');
                }}
              />
              <span>
                <b>Use BK sheet filter</b>{' '}
                <small>
                  {data &&
                    (data.bkInfo.hidden
                      ? `Filter found: ${data.bkInfo.visible} of ${data.bkInfo.total} BK rows visible (PO Status: ${
                          data.bkInfo.visibleStatuses.join(', ') || '—'
                        } + any other column filter). Untick to use all ${data.bkInfo.total}.`
                      : 'No filter on the BK sheet — all rows are used.')}
                </small>
              </span>
            </label>
            <h3>
              Select ECDD dates <small>one workbook, any combination</small>
            </h3>
            <div className="bb-chips">
              {ecddList.length ? (
                ecddList.map((e) => {
                  const n = countBookings(mainOf(active.filter((l) => l.ecdd === e.ecdd)));
                  return (
                    <div
                      key={e.ecdd}
                      className={`bb-chip${selected.has(e.ecdd) ? ' on' : ''}`}
                      onClick={() => toggleEcdd(e.ecdd)}
                    >
                      <b>{dlabel(e.ecdd)}</b>
                      <small>{`${n} bookings · ${e.pos} POs · ${fmt(e.qty)} pcs`}</small>
                    </div>
                  );
                })
              ) : (
                <small>No ECDD dates with the current filter.</small>
              )}
            </div>
            <div className="bb-row">
              <button className="bb-link" onClick={() => setSelected(new Set(ecddList.map((e) => e.ecdd)))}>
                Select all
              </button>
              <button className="bb-link" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
            <div className="bb-hint">
              Booking rule: <b>{ruleText}</b>{' '}
              <a className="bb-link" onClick={() => setTab('settings')}>
                change in Settings
              </a>
            </div>
          </div>
        </section>

        <section className="bb-col wide">
          <div className="bb-stats" hidden={!loaded}>
            {[
              ['Bookings', fmt(countBookings(selMain))],
              ['POs', stats.pos],
              ['ASIN lines', fmt(stats.rows)],
              ['Quantity', fmt(stats.qty)],
              ['Cartons', fmt(stats.cartons)],
              ['CBM', fmt(stats.cbm, 1)]
            ].map(([k, v]) => (
              <div className="bb-stat" key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
            {selWrong.length > 0 && (
              <div className="bb-stat bb-statw">
                <span>Wrong CVC → own sheet</span>
                <b>{fmt(countBookings(selWrong))}</b>
                <small style={{ color: 'var(--mu)', display: 'block', fontSize: 11 }}>
                  bookings · {fmt(selWrong.length)} lines · {fmt(statsOf(selWrong).qty)} pcs
                </small>
              </div>
            )}
          </div>

          <div className="bb-card bb-warn" hidden={!loaded}>
            <h3>AI checks</h3>
            {data &&
              (data.warnings.length ? (
                data.warnings.map((w, i) => (
                  <div key={i} className={w.level?.[0] || 'i'}>
                    {w.level === 'error' ? '✖' : w.level === 'warn' ? '⚠' : 'ℹ'}{' '}
                    {w.key ? <b>{w.key} — </b> : null}
                    {w.msg}
                  </div>
                ))
              ) : (
                <div>✔ All keys matched, quantities agree.</div>
              ))}
          </div>

          <div className="bb-card bb-prev" hidden={!loaded}>
            <h3>
              Live preview{' '}
              <small>{`sample of ${previewRows.length} lines of sheet “UPLOAD FILE FORMAT USER”`}</small>
            </h3>
            <div className="bb-tw">
              <table>
                <tbody>
                  <tr>
                    {[
                      'PO',
                      'ASIN',
                      'model',
                      'PO Qty',
                      'Case Pack',
                      'Carton Qty',
                      'Window end',
                      'ECDD',
                      'PO status',
                      'Vendor',
                      'Factory',
                      'Ship'
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.po}</td>
                      <td>{r.asin}</td>
                      <td>{r.model}</td>
                      <td className="n">{r.qty}</td>
                      <td className="n">{r.cpq}</td>
                      <td className="n">{fmt(r.qty / r.cpq, 2)}</td>
                      <td>{r.windowEnd}</td>
                      <td>{r.ecdd}</td>
                      <td className={r.wrongCvc ? 'bad' : ''}>{r.status}</td>
                      <td>{r.vendor}</td>
                      <td>{r.factory}</td>
                      <td>{r.ship}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bb-empty bb-card" hidden={!!file}>
            <div className="bb-ghostgrid" />
            <p>Your booking preview, totals and AI checks will appear here.</p>
          </div>
        </section>
      </main>

      {/* TAB 2: SETTINGS */}
      <section className="bb-settings-view" hidden={tab !== 'settings'}>
        <div className="bb-card">
          <h3>
            Booking condition <small>which fields must be identical to count as ONE booking</small>
          </h3>
          <div className="bb-chips">
            {COND.map(([f, l]) => (
              <div
                key={f}
                className={`bb-chip sm ${bookingFields.includes(f) ? 'on' : ''}`}
                onClick={() => toggleCond(f)}
              >
                <b>{l}</b>
              </div>
            ))}
          </div>
          <div className="bb-live">
            {loaded ? (
              <>
                Rule <b style={{ fontSize: 14 }}>{ruleText}</b> → <b>{fmt(countBookings(selMain))}</b> bookings from{' '}
                {fmt(selMain.length)} ASIN lines
                {selWrong.length > 0 && (
                  <span style={{ color: '#fb923c' }}>
                    {' '}
                    + {fmt(countBookings(selWrong))} Wrong CVC bookings (separate sheet)
                  </span>
                )}
              </>
            ) : (
              'Load a source file to see the live booking count.'
            )}
          </div>
          <p className="bb-note">
            Rows that share the same values in every ticked field are one booking. The output gets a{' '}
            <b>BOOKING COUNTING</b> column: numbered <b>1, 1, 1, 2, 2, 3…</b> — every line of a booking shares its
            number, so the last number = total bookings. A second column <b>BOOKING SERIAL</b> shows plain <b>1, 2, 3…</b>{' '}
            once per booking (blank on repeat lines). Lines of the same booking are kept together.
          </p>
          <div className="bb-row">
            <button className="bb-btn-ghost" onClick={() => setBookingFields([...DEFAULT_RULE])}>
              Reset to PO – model – ECDD – Factory – Ship
            </button>
          </div>
        </div>

        <div className="bb-card">
          <h3>
            Booking defaults <small>(pre-filled from your template)</small>
          </h3>
          <div className="grid">
            {FIELDS.map(([k, l, t]) => (
              <label key={k}>
                {l}
                <input
                  type={t || 'text'}
                  step="any"
                  value={settings[k] ?? ''}
                  onChange={(e) => setField(k, t === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                />
              </label>
            ))}
            <label className="chk">
              <input
                type="checkbox"
                checked={!!settings.skipZeroQty}
                onChange={(e) => setField('skipZeroQty', e.target.checked)}
              />{' '}
              Skip ASIN lines with 0 quantity
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={settings.separateWrongCvc !== false}
                onChange={(e) => setField('separateWrongCvc', e.target.checked)}
              />{' '}
              Move “Wrong CVC PO” lines to a separate sheet (WRONG CVC PO)
            </label>
          </div>
        </div>

        <div className="bb-card bb-wide2">
          <h3>
            Output table columns{' '}
            <small>drag to rearrange · this is the column order of sheet “UPLOAD FILE FORMAT USER”</small>
          </h3>
          <div className="bb-collist">
            {colOrder.map((id, i) => (
              <div
                key={id}
                className={`bb-col-item${id === 'bserial' || id === 'bcount' ? ' hl' : ''}`}
                draggable
                onDragStart={(e) => {
                  dragId.current = id;
                  e.dataTransfer.effectAllowed = 'move';
                  e.currentTarget.classList.add('drag');
                }}
                onDragEnd={(e) => e.currentTarget.classList.remove('drag')}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dropCol(id);
                }}
              >
                <span>{colLabels[id] || id}</span>
                <button title="Move left" onClick={() => moveCol(i, i - 1)}>
                  ◀
                </button>
                <button title="Move right" onClick={() => moveCol(i, i + 1)}>
                  ▶
                </button>
              </div>
            ))}
          </div>
          <div className="bb-row" style={{ marginTop: 12 }}>
            <button
              className="bb-btn-ghost"
              onClick={() => {
                setColOrder([...core.DEFAULT_ORDER]);
                ls.del('colOrder');
              }}
            >
              Reset to default order (BOOKING SERIAL = 3, BOOKING COUNTING = 4)
            </button>
          </div>
        </div>
      </section>

      {/* TAB 3: GUIDE */}
      {tab === 'guide' && <Guide />}

      {/* FOOTER ACTION BAR */}
      <footer className="bb-footer" hidden={!loaded || tab !== 'main'}>
        <div className="sel">
          {result ? (
            <>
              ✔ Downloaded <b>{result.name}</b> · {fmt(result.stats.bookings)} bookings · {fmt(result.stats.rows)} lines
            </>
          ) : selected.size ? (
            <>
              <b>{selected.size}</b> ECDD date(s) selected · <b>{fmt(selMain.reduce((a, l) => a + l.qty, 0))}</b> pcs
              {selWrong.length > 0 && (
                <span style={{ color: '#fb923c' }}>
                  {' '}
                  · Wrong CVC {fmt(selWrong.reduce((a, l) => a + l.qty, 0))} pcs → separate sheet
                </span>
              )}
            </>
          ) : (
            'Select at least one ECDD date'
          )}
        </div>
        <button
          className="bb-btn-primary"
          disabled={!selected.size || busy}
          onClick={generate}
        >
          ✦ Generate Excel
        </button>
        {result && (
          <button className="bb-btn-ghost" onClick={download}>
            Download again
          </button>
        )}
      </footer>

      {/* LIVE CIRCULAR TIMER MODAL OVERLAY */}
      {timer.open && (
        <div className="bb-overlay">
          <div className="bb-tcard" data-state={timer.state}>
            <div className="bb-ringwrap">
              <svg viewBox="0 0 200 200" className="bb-ring">
                <defs>
                  <linearGradient id="bb-rg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="var(--ra)" />
                    <stop offset="1" stopColor="var(--rb)" />
                  </linearGradient>
                </defs>
                <circle cx="100" cy="100" r="88" className="bb-trk" />
                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  className="bb-prg"
                  stroke="url(#bb-rg)"
                  style={{
                    strokeDashoffset:
                      553 * (1 - (timer.state === 'err' ? Math.max(timer.pct, 4) : timer.pct) / 100)
                  }}
                />
                <g className="bb-ticks">
                  {Array.from({ length: 60 }, (_, i) => {
                    const a = (i / 60) * 2 * Math.PI;
                    return (
                      <line
                        key={i}
                        className={i < (timer.pct / 100) * 60 ? 'on' : ''}
                        x1={100 + 98 * Math.cos(a)}
                        y1={100 + 98 * Math.sin(a)}
                        x2={100 + 105 * Math.cos(a)}
                        y2={100 + 105 * Math.sin(a)}
                      />
                    );
                  })}
                </g>
              </svg>
              <div className="bb-tmid">
                <div className="bb-tdig">
                  {tm}
                  <small>{tms}</small>
                </div>
                <div className="bb-tpct">{Math.round(timer.pct)}%</div>
              </div>
              <div className="bb-badge">{timer.state === 'ok' ? '✓' : timer.state === 'err' ? '✕' : ''}</div>
            </div>
            <h2>
              {timer.state === 'ok' ? 'Success' : timer.state === 'err' ? 'Failed' : 'Generating booking workbook…'}
            </h2>
            <p className="bb-tstage">{timer.stage}</p>
            <ul className="bb-tsteps">
              {STEPS.map(([p, l], i) => {
                const done = timer.pct >= 100 || i < curStep;
                return (
                  <li key={p} className={done ? 'done' : i === curStep ? 'cur' : ''}>
                    <i>{done ? '✓' : ''}</i>
                    {l}
                  </li>
                );
              })}
            </ul>
            {timer.html && (
              <div
                className={`bb-tres${timer.state === 'err' ? ' errbox' : ''}`}
                dangerouslySetInnerHTML={{ __html: timer.html }}
              />
            )}
            {timer.state !== 'run' && (
              <div className="bb-tbtns">
                <button className="bb-btn-ghost" onClick={closeTimer}>
                  Close
                </button>
                {timer.state === 'ok' ? (
                  <button className="bb-btn-primary" onClick={download}>
                    Download again
                  </button>
                ) : (
                  <button
                    className="bb-btn-primary"
                    onClick={() => {
                      closeTimer();
                      generate();
                    }}
                  >
                    ↻ Try again
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`bb-toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}
