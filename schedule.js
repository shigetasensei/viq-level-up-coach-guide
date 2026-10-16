/* Event schedule planner: generates a practice Qualification schedule (or imports a real one)
   and visualizes it. Illustrative only; real events use Tournament Manager. */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ---------- nav toggle ---------- */
  const nav = $("#nav"), toggle = $(".nav-toggle");
  toggle.addEventListener("click", () => { toggle.setAttribute("aria-expanded", nav.classList.toggle("open")); });

  /* ---------- helpers ---------- */
  function toMin(v) {
    if (!v) return null;
    const m = String(v).trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
    if (!m) return null;
    let h = +m[1];
    const mi = +m[2], ap = m[3] && m[3].toLowerCase();
    if (mi > 59 || h > 24) return null;
    if (ap) { if (h < 1 || h > 12) return null; if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0; }
    return h * 60 + mi;
  }
  function fmt(min) {
    min = Math.round(min);
    const h24 = Math.floor(min / 60) % 24, m = min % 60;
    const ap = h24 >= 12 ? "PM" : "AM", h = h24 % 12 || 12;
    return h + ":" + String(m).padStart(2, "0") + " " + ap;
  }
  function dur(min) { min = Math.round(min); return min >= 60 ? Math.floor(min / 60) + " h " + (min % 60 ? (min % 60) + " min" : "") : min + " min"; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const num = (id, d) => { const v = parseFloat($(id).value); return isNaN(v) ? d : v; };
  function parseTeams(text) {
    const seen = new Set(), out = [];
    String(text || "").split(/[\s,;]+/).forEach(t => { t = t.trim().toUpperCase(); if (t && !seen.has(t)) { seen.add(t); out.push(t); } });
    return out;
  }
  const ruleLink = id => { const a = el("a", null, id); a.href = "index.html#rule-" + id; return a; };

  /* ---------- state / persistence ---------- */
  const FIELDS = ["teams", "importText", "mine", "startTime", "cycle", "fields", "mpt", "lunchStart", "lunchLen", "seed",
    "checkin", "lead", "skOpen", "skClose", "skRun", "skFields", "finN", "finBreak", "awardLen"];
  let source = "gen";
  let mine = new Set();
  let built = null;

  function readState() {
    const s = { src: source };
    FIELDS.forEach(f => { s[f] = $("#" + f).value; });
    return s;
  }
  function writeState(s) {
    FIELDS.forEach(f => { if (s[f] != null) $("#" + f).value = s[f]; });
    setSource(s.src === "imp" ? "imp" : "gen");
  }
  function save() { try { localStorage.setItem("levelup-schedule", JSON.stringify(readState())); } catch (e) { /* private mode */ } }
  function load() {
    try {
      if (location.hash.indexOf("#s=") === 0) {
        const json = decodeURIComponent(escape(atob(location.hash.slice(3).replace(/-/g, "+").replace(/_/g, "/"))));
        return JSON.parse(json);
      }
      return JSON.parse(localStorage.getItem("levelup-schedule") || "null");
    } catch (e) { return null; }
  }
  function shareLink() {
    const s = readState(); if (s.src === "imp") s.teams = "";
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, "-").replace(/\//g, "_");
    return location.origin + location.pathname + "#s=" + b64;
  }

  function setSource(s) {
    source = s;
    $("#srcGen").setAttribute("aria-pressed", s === "gen");
    $("#srcImp").setAttribute("aria-pressed", s === "imp");
    $("#genBox").hidden = s !== "gen"; $("#impBox").hidden = s !== "imp";
    $("#genOnly").hidden = s !== "gen"; $("#mpt").closest("div").style.opacity = s === "gen" ? 1 : .45; $("#mpt").disabled = s !== "gen";
  }
  $("#srcGen").addEventListener("click", () => setSource("gen"));
  $("#srcImp").addEventListener("click", () => setSource("imp"));
  $("#sample").addEventListener("click", () => { $("#teams").value = Array.from({ length: 24 }, (_, i) => "T" + String(i + 1).padStart(2, "0")).join(", "); if (!$("#mine").value) $("#mine").value = "T07"; });
  $("#clearTeams").addEventListener("click", () => { $("#teams").value = ""; });
  $("#reshuffle").addEventListener("click", () => { $("#seed").value = Math.floor(Math.random() * 99999) + 1; $("#setupForm").requestSubmit(); });

  /* ---------- schedule generation ---------- */
  function generate(teams, M, F, cycle, start, lunchStart, lunchLen, seed) {
    const rnd = mulberry32(seed), N = teams.length;
    const seen = {}; teams.forEach(t => { seen[t] = {}; });
    const sur = {}, matches = [];
    for (let r = 0; r < M; r++) {
      let best = null, bestRep = Infinity;
      for (let a = 0; a < 300 && bestRep > 0; a++) {
        const order = shuffle(teams.slice(), rnd), pairs = []; let rep = 0;
        for (let i = 0; i + 1 < N; i += 2) { if (seen[order[i]][order[i + 1]]) rep++; pairs.push([order[i], order[i + 1], null]); }
        if (N % 2) {
          const lone = order[N - 1], others = order.slice(0, N - 1);
          const low = Math.min.apply(null, others.map(t => sur[t] || 0));
          const cands = others.filter(t => (sur[t] || 0) === low);
          const s = cands[Math.floor(rnd() * cands.length)];
          if (seen[lone][s]) rep++; pairs.push([lone, s, s]);
        }
        if (rep < bestRep) { best = pairs; bestRep = rep; }
      }
      best.forEach(p => {
        seen[p[0]][p[1]] = seen[p[1]][p[0]] = true;
        if (p[2]) sur[p[2]] = (sur[p[2]] || 0) + 1;
        matches.push({ round: r, teams: [p[0], p[1]], surrogate: p[2] });
      });
    }
    // order matches into slots, spreading each team's matches out
    const pool = matches.slice(), slots = [], last = {};
    let k = 0;
    while (pool.length) {
      const minRound = Math.min.apply(null, pool.map(m => m.round));
      const cands = pool.filter(m => m.round <= minRound + 1);
      const gapOf = t => (t in last ? k - last[t] : 99);
      cands.forEach(m => { m._sc = Math.min(gapOf(m.teams[0]), gapOf(m.teams[1])) * 10 - m.round * 3 + rnd(); });
      cands.sort((a, b) => b._sc - a._sc);
      const used = new Set(), slot = [];
      for (const c of cands) {
        if (slot.length >= F) break;
        if (used.has(c.teams[0]) || used.has(c.teams[1])) continue;
        slot.push(c); used.add(c.teams[0]); used.add(c.teams[1]);
      }
      slot.forEach(m => { pool.splice(pool.indexOf(m), 1); last[m.teams[0]] = k; last[m.teams[1]] = k; });
      slots.push(slot); k++;
    }
    // times, fields, stations
    let t = start, lunch = null, n = 1;
    const out = [];
    slots.forEach((slot, si) => {
      if (!lunch && lunchLen > 0 && lunchStart != null && t >= lunchStart) { lunch = { start: t, end: t + lunchLen }; t += lunchLen; }
      slot.forEach((m, i) => {
        const swap = rnd() < 0.5, tm = swap ? [m.teams[1], m.teams[0]] : m.teams;
        out.push({ n: n++, slot: si, start: t, end: t + cycle, field: ((i + si) % F) + 1, teams: tm, surrogate: m.surrogate });
      });
      t += cycle;
    });
    out.sort((a, b) => a.start - b.start || a.field - b.field);
    out.forEach((m, i) => { m.n = i + 1; });
    return { matches: out, lunch, end: t };
  }

  function parseImport(text, cycle) {
    const rows = [], errs = [];
    String(text || "").split(/\r?\n/).forEach((line, i) => {
      line = line.trim(); if (!line) return;
      const c = line.split(/[,\t]/).map(x => x.trim());
      if (i === 0 && /match|time/i.test(line) && toMin(c[1]) == null) return;
      if (c.length < 5) { errs.push("Line " + (i + 1) + ": expected 5 columns."); return; }
      const t = toMin(c[1]), f = parseInt((c[2].match(/\d+/) || [])[0], 10);
      if (t == null) { errs.push("Line " + (i + 1) + ": couldn't read the time “" + c[1] + "”."); return; }
      if (!f) { errs.push("Line " + (i + 1) + ": couldn't read the field."); return; }
      const a = c[3].toUpperCase(), b = c[4].toUpperCase();
      if (!a || !b) { errs.push("Line " + (i + 1) + ": missing a team."); return; }
      rows.push({ label: c[0] || "", start: t, end: t + cycle, field: f, teams: [a, b], surrogate: /\*/.test(c[0] + c[3] + c[4]) ? (/\*/.test(c[4]) ? b : a) : null });
    });
    rows.forEach(r => { r.teams = r.teams.map(x => x.replace(/\*/g, "")); if (r.surrogate) r.surrogate = r.surrogate.replace(/\*/g, ""); });
    rows.sort((a, b) => a.start - b.start || a.field - b.field);
    const times = Array.from(new Set(rows.map(r => r.start))).sort((a, b) => a - b);
    rows.forEach((r, i) => { r.n = i + 1; r.slot = times.indexOf(r.start); });
    return { rows, errs };
  }

  /* ---------- analysis ---------- */
  function analyze(matches) {
    const per = {};
    matches.forEach(m => m.teams.forEach((t, idx) => {
      (per[t] = per[t] || []).push({ m, station: idx === 0 ? "R" : "B", partner: m.teams[1 - idx], extra: m.surrogate === t });
    }));
    Object.keys(per).forEach(t => per[t].sort((a, b) => a.m.start - b.m.start));
    const rep = {};
    Object.keys(per).forEach(t => {
      const L = per[t], gaps = [];
      for (let i = 1; i < L.length; i++) gaps.push(L[i].m.start - L[i - 1].m.end);
      rep[t] = {
        counted: L.filter(x => !x.extra).length, extra: L.filter(x => x.extra).length,
        partners: new Set(L.map(x => x.partner)).size, partnerTotal: L.length,
        minGap: gaps.length ? Math.min.apply(null, gaps) : null,
        avgGap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
        b2b: gaps.filter(g => g <= 0).length,
        red: L.filter(x => x.station === "R").length, blue: L.filter(x => x.station === "B").length,
        first: L[0].m.start, last: L[L.length - 1].m.end
      };
    });
    return { per, rep };
  }

  /* ---------- timeline renderer ---------- */
  let detailEl;
  function showDetail(html) { detailEl.textContent = ""; detailEl.appendChild(html); }

  function drawTimeline(root, rows, range, ppm, opts) {
    opts = opts || {};
    root.textContent = "";
    const labelW = opts.labelW || 150, width = Math.max(1, (range.end - range.start) * ppm);
    const wrapEl = el("div", "tl-wrap"), inner = el("div", "tl-inner"); inner.style.width = (labelW + width) + "px";
    const head = el("div", "tl-row tl-head"), hl = el("div", "tl-label"); head.appendChild(hl);
    const ht = el("div", "tl-track"); ht.style.width = width + "px"; ht.style.height = "26px";
    for (let t = Math.ceil(range.start / 30) * 30; t <= range.end; t += 30) {
      const tk = el("span", "tl-tick" + (t % 60 === 0 ? " hour" : ""), t % 60 === 0 ? fmt(t) : "");
      tk.style.left = ((t - range.start) * ppm) + "px"; ht.appendChild(tk);
    }
    head.appendChild(ht); inner.appendChild(head);
    rows.forEach(r => {
      const row = el("div", "tl-row" + (r.mine ? " mine" : ""));
      const lab = el("div", "tl-label", r.label); lab.style.width = labelW + "px"; if (r.sub) { lab.appendChild(el("small", null, r.sub)); }
      const tr = el("div", "tl-track"); tr.style.width = width + "px"; tr.style.backgroundSize = (30 * ppm) + "px 100%";
      if (opts.rowH) tr.style.height = opts.rowH + "px";
      r.blocks.forEach(b => {
        const e = el("button", "blk " + (b.cls || ""), b.text); e.type = "button";
        e.style.left = ((b.start - range.start) * ppm) + "px"; e.style.width = Math.max(4, (b.end - b.start) * ppm - 2) + "px";
        e.title = b.title || b.text; e.setAttribute("aria-label", b.title || b.text);
        e.addEventListener("click", () => { const d = el("div"); d.appendChild(el("b", null, b.title || b.text)); if (b.detail) d.appendChild(el("span", null, " — " + b.detail)); showDetail(d); });
        tr.appendChild(e);
      });
      row.appendChild(lab); row.appendChild(tr); inner.appendChild(row);
    });
    wrapEl.appendChild(inner); root.appendChild(wrapEl);
  }

  /* ---------- build ---------- */
  function build() {
    const msg = $("#formMsg"); msg.textContent = ""; msg.className = "";
    const cycle = num("#cycle", 6), F = Math.max(1, Math.round(num("#fields", 1)));
    const startMin = toMin($("#startTime").value), lunchStart = toMin($("#lunchStart").value), lunchLen = Math.max(0, num("#lunchLen", 0));
    if (startMin == null) return fail("Enter a first-match time.");
    let matches, lunch = null, qualEnd, teams, note = [], seedUsed = Math.max(1, Math.round(num("#seed", 1)));

    if (source === "gen") {
      teams = parseTeams($("#teams").value);
      if (teams.length < 2) return fail("Enter at least two team numbers (or tap “Use 24 sample teams”).");
      const M = Math.max(1, Math.round(num("#mpt", 6)));
      const g = generate(teams, M, F, cycle, startMin, lunchStart, lunchLen, seedUsed);
      matches = g.matches; lunch = g.lunch; qualEnd = g.end;
    } else {
      const p = parseImport($("#importText").value, cycle);
      if (p.errs.length) return fail(p.errs.slice(0, 3).join(" "));
      if (!p.rows.length) return fail("Paste at least one match row.");
      matches = p.rows; qualEnd = Math.max.apply(null, matches.map(m => m.end));
      teams = Array.from(new Set([].concat.apply([], matches.map(m => m.teams)))).sort();
      // detect lunch as the largest gap between consecutive start times
      const st = Array.from(new Set(matches.map(m => m.start))).sort((a, b) => a - b);
      let gp = 0, gi = -1; for (let i = 1; i < st.length; i++) { const g = st[i] - st[i - 1]; if (g > gp) { gp = g; gi = i; } }
      if (gi > 0 && gp >= cycle * 3) lunch = { start: st[gi - 1] + cycle, end: st[gi] };
    }
    mine = new Set(parseTeams($("#mine").value));
    const an = analyze(matches);

    const lead = Math.max(0, num("#lead", 10));
    const finN = Math.max(0, Math.min(Math.round(num("#finN", 5)), Math.floor(teams.length / 2)));
    const finBreak = num("#finBreak", 20), awardLen = num("#awardLen", 30);
    const finStart = qualEnd + finBreak, finEnd = finStart + finN * cycle;
    const awStart = finEnd + 10, awEnd = awStart + awardLen;
    const skOpen = toMin($("#skOpen").value), skClose = toMin($("#skClose").value);
    const checkin = toMin($("#checkin").value);
    const first = Math.min.apply(null, matches.map(m => m.start));

    built = { teams, matches, lunch, qualEnd, an, lead, cycle, F, finN, finStart, finEnd, awStart, awEnd, skOpen, skClose, checkin, first,
      skRun: Math.max(1, num("#skRun", 3)), skFields: Math.max(1, Math.round(num("#skFields", 1))), mpt: source === "gen" ? Math.round(num("#mpt", 6)) : null, src: source };
    save();
    $("#results").hidden = false;
    renderAll();
    msg.textContent = "Schedule built: " + matches.length + " matches.";
    function fail(t) { msg.textContent = t; msg.className = "bad"; $("#results").hidden = built ? false : true; }
  }

  /* ---------- rendering ---------- */
  function renderAll() {
    renderKpis(); renderDayPlan(); renderLanes(); renderMy(); renderBoard(); renderReport();
  }

  function renderKpis() {
    const b = built, R = b.an.rep, ts = Object.keys(R);
    const allGaps = ts.map(t => R[t].avgGap).filter(x => x != null);
    const avg = allGaps.length ? allGaps.reduce((a, c) => a + c, 0) / allGaps.length : 0;
    const b2b = ts.reduce((a, t) => a + R[t].b2b, 0), extra = b.matches.filter(m => m.surrogate).length;
    const data = [
      ["Teams", b.teams.length, b.F + " Teamwork field" + (b.F > 1 ? "s" : "")],
      ["Qualification Matches", b.matches.length, extra ? extra + " extra (don't count)" : (new Set(ts.map(t => R[t].counted)).size === 1 ? "every team plays equally" : "teams play different numbers")],
      ["Qualifying ends", fmt(b.qualEnd), "from " + fmt(b.first)],
      ["Day ends about", fmt(b.awEnd), "after Finals and awards"],
      ["Average rest", dur(avg), "between a team's matches"],
      ["Back-to-back", b2b, b2b ? "matches with no gap" : "none"]
    ];
    const ul = $("#kpis"); ul.textContent = "";
    data.forEach(d => { const li = el("li"); li.appendChild(el("span", null, d[0])); li.appendChild(el("b", null, String(d[1]))); li.appendChild(el("small", null, d[2])); ul.appendChild(li); });

    const w = $("#warns"); w.textContent = "";
    const add = (txt, rule) => { const li = el("li", null, txt + " "); if (rule) li.appendChild(ruleLink(rule)); w.appendChild(li); };
    if (b.src === "gen") {
      if (b.mpt < 6) add("Fewer than 6 Qualification Matches per team: local qualifiers must run at least 6 (8 at a Championship).", "T9");
      else if (b.mpt < 8) add("6–7 matches per team meets the local-qualifier minimum. Championship events need at least 8.", "T9");
      const reps = Object.keys(R).reduce((a, t) => a + (R[t].partnerTotal - R[t].partners), 0) / 2;
      if (b.mpt > b.teams.length - 1) add("With this few teams, repeated partners are unavoidable.");
      else if (reps > 0) add("Some teams meet the same partner twice. Try Reshuffle.");
      if (b.teams.length % 2) add("An odd number of teams means each round has an extra Qualification Match marked * that doesn't count toward ranking.", "T10");
      if (b.F * 2 > b.teams.length) add("There are more fields than this many teams can fill. Some slots will be empty.");
    }
    if (b2b) add(b2b + " back-to-back match" + (b2b > 1 ? "es" : "") + " with no time between them. Real schedules from Tournament Manager may differ.");
    if (b.skOpen != null && b.skClose != null) {
      const cap = Math.floor((b.skClose - b.skOpen) / b.skRun) * b.skFields, need = b.teams.length * 6;
      if (cap < need) add("Skills capacity is about " + cap + " runs but " + need + " are needed (3 Driving + 3 Autonomous Coding per team). Extend the hours or add Skills fields.", "T15");
      else add("Skills capacity is about " + cap + " runs against " + need + " needed (3 Driving + 3 Autonomous Coding per team).", "T15");
    }
    if (b.finN < 5 && b.teams.length >= 10) add("Events that send teams to the World Championship need at least 5 Finals Matches in a division of 10+ teams.", "T13");
  }

  function renderDayPlan() {
    const b = built, lo = Math.min(b.checkin != null ? b.checkin : b.first, b.skOpen != null ? b.skOpen : b.first, b.first) - 10;
    const hi = Math.max(b.awEnd, b.skClose != null ? b.skClose : 0) + 10;
    const q1 = b.lunch ? [{ start: b.first, end: b.lunch.start, text: "Qualification", cls: "plan q" }, { start: b.lunch.end, end: b.qualEnd, text: "Qualification", cls: "plan q" }] : [{ start: b.first, end: b.qualEnd, text: "Qualification Matches", cls: "plan q" }];
    const rows = [
      { label: "Check-in & inspection", blocks: b.checkin != null && b.checkin < b.first ? [{ start: b.checkin, end: b.first, text: "Check-in & inspection", cls: "plan chk", detail: "Robot inspection must pass before any Match (R2)." }] : [] },
      { label: "Teamwork fields", blocks: q1.map(x => Object.assign(x, { title: fmt(x.start) + "–" + fmt(x.end) + " Qualification Matches", detail: b.matches.length + " matches" })).concat(b.lunch ? [{ start: b.lunch.start, end: b.lunch.end, text: "Lunch", cls: "plan lunch", title: "Lunch " + fmt(b.lunch.start) + "–" + fmt(b.lunch.end) }] : [])
        .concat(b.finN ? [{ start: b.finStart, end: b.finEnd, text: "Finals", cls: "plan fin", title: "Finals " + fmt(b.finStart) + "–" + fmt(b.finEnd), detail: b.finN + " Finals Matches, one at a time, lowest-ranked Alliance first (T14)." }] : [])
        .concat(b.awEnd > b.awStart ? [{ start: b.awStart, end: b.awEnd, text: "Awards", cls: "plan aw", title: "Awards " + fmt(b.awStart) + "–" + fmt(b.awEnd) }] : []) },
      { label: "Robot Skills", blocks: b.skOpen != null && b.skClose != null ? [{ start: b.skOpen, end: b.skClose, text: "Skills open (3 Driving + 3 Autonomous per team)", cls: "plan sk", title: "Skills " + fmt(b.skOpen) + "–" + fmt(b.skClose) }] : [] }
    ];
    const avail = ($("#dayPlan").clientWidth || 900) - 150 - 2;
    drawTimeline($("#dayPlan"), rows, { start: lo, end: hi }, Math.max(1.6, Math.min(8, avail / (hi - lo))), { labelW: 150 });
  }

  function matchBlock(t, x) {
    const m = x.m, st = x.station === "R" ? "R" : "B";
    return {
      start: m.start, end: m.end, cls: "q " + (x.station === "R" ? "red" : "blue") + (x.extra ? " extra" : ""),
      text: "Q" + m.n + " · F" + m.field + " · " + st + (x.extra ? " *" : ""),
      title: "Q" + m.n + (x.extra ? "*" : "") + " at " + fmt(m.start) + ", Field " + m.field + ", " + (x.station === "R" ? "red" : "blue") + " Driver Station",
      detail: "with " + x.partner + (x.extra ? ". Extra Qualification Match: doesn't count toward ranking (T10)." : ". Be at the Field by " + fmt(m.start - built.lead) + ".")
    };
  }

  function renderLanes() {
    const b = built, showAll = $("#showAll").checked, ppm = num("#zoom", 18);
    const list = showAll ? b.teams : Array.from(mine).filter(t => b.an.per[t]);
    const root = $("#lanes");
    if (!list.length) { root.textContent = ""; root.appendChild(el("p", "empty", mine.size ? "None of your team numbers appear in this schedule. Check the spelling, or choose “Show every team”." : "Enter your team number in the setup form to see your timeline, or choose “Show every team”.")); return; }
    const rows = [];
    const ctx = [];
    if (b.lunch) ctx.push({ start: b.lunch.start, end: b.lunch.end, text: "Lunch", cls: "plan lunch", title: "Lunch " + fmt(b.lunch.start) + "–" + fmt(b.lunch.end) });
    if (b.skOpen != null) ctx.push({ start: b.skOpen, end: b.skClose, text: "Skills open", cls: "plan sk", title: "Skills " + fmt(b.skOpen) + "–" + fmt(b.skClose) });
    if (b.finN) ctx.push({ start: b.finStart, end: b.finEnd, text: "Finals", cls: "plan fin", title: "Finals " + fmt(b.finStart) + "–" + fmt(b.finEnd) });
    // context row split: skills overlaps others, so give each its own thin row
    ctx.forEach(c => rows.push({ label: c.text, blocks: [c] }));
    list.forEach(t => rows.push({ label: t, mine: mine.has(t), sub: b.an.rep[t].counted + " matches", blocks: b.an.per[t].map(x => matchBlock(t, x)) }));
    const lo = Math.min(b.first, b.skOpen != null ? b.skOpen : b.first) - 10, hi = Math.max(b.awEnd, b.skClose != null ? b.skClose : 0) + 10;
    drawTimeline(root, rows, { start: lo, end: hi }, ppm, { labelW: 150, rowH: showAll ? 30 : 40 });
    const starts = list.filter(t => mine.has(t)).map(t => b.an.per[t][0].m.start);
    const target = starts.length ? Math.min.apply(null, starts) : b.first;
    const sc = $(".tl-wrap", root); if (sc) sc.scrollLeft = Math.max(0, (target - lo - 20) * ppm);
  }

  function renderMy() {
    const b = built, root = $("#myTables"); root.textContent = "";
    const list = Array.from(mine).filter(t => b.an.per[t]);
    if (!list.length) { root.appendChild(el("p", "empty", "Enter your team number in the setup form to see your match list.")); $("#freeWin").textContent = ""; return; }
    list.forEach(t => {
      const r = b.an.rep[t], tbl = el("table", "plain mytbl");
      const cap = el("caption", null, "Team " + t + ": " + r.counted + " matches" + (r.extra ? " + " + r.extra + " extra" : "") + ", " + r.partners + " different partners"); tbl.appendChild(cap);
      const hd = el("tr"); ["Match", "Time", "Field", "Station", "Partner", "At the Field by", "Rest after"].forEach(h => hd.appendChild(el("th", null, h)));
      const th = el("thead"); th.appendChild(hd); tbl.appendChild(th);
      const tb = el("tbody");
      b.an.per[t].forEach((x, i, L) => {
        const tr = el("tr"), gap = i + 1 < L.length ? L[i + 1].m.start - x.m.end : null;
        const cells = ["Q" + x.m.n + (x.extra ? " *" : ""), fmt(x.m.start), "Field " + x.m.field, x.station === "R" ? "Red (Team 1)" : "Blue (Team 2)", x.partner, fmt(x.m.start - b.lead),
          gap == null ? "—" : gap <= 0 ? "None: back-to-back" : dur(gap)];
        cells.forEach((c, ci) => { const td = el(ci === 0 ? "th" : "td", null, c); if (ci === 0) td.scope = "row"; if (ci === 6 && gap != null && gap <= 0) td.className = "warn"; tr.appendChild(td); });
        tb.appendChild(tr);
      });
      tbl.appendChild(tb); const sc = el("div", "table-scroll"); sc.appendChild(tbl); root.appendChild(sc);
    });

    // free windows for skills
    const fw = $("#freeWin"); fw.textContent = "";
    if (b.skOpen == null || b.skClose == null) { fw.appendChild(el("p", "note", "Set the Skills open and close times in the setup form.")); return; }
    list.forEach(t => {
      const busy = b.an.per[t].map(x => [x.m.start - b.lead, x.m.end]);
      if (b.lunch) busy.push([b.lunch.start, b.lunch.end]);
      busy.sort((a, c) => a[0] - c[0]);
      const need = b.skRun + 2, wins = []; let cur = b.skOpen;
      busy.forEach(iv => { if (iv[0] - cur >= need) wins.push([cur, Math.min(iv[0], b.skClose)]); cur = Math.max(cur, iv[1]); });
      if (b.skClose - cur >= need) wins.push([cur, b.skClose]);
      const good = wins.filter(w => w[1] > w[0] && w[1] - w[0] >= need);
      fw.appendChild(el("h4", null, "Team " + t));
      if (!good.length) { fw.appendChild(el("p", "note", "No gaps long enough.")); return; }
      const ul = el("ul", "wins");
      good.forEach(w => { const runs = Math.floor((w[1] - w[0]) / b.skRun); ul.appendChild(el("li", null, fmt(w[0]) + " – " + fmt(w[1]) + " (" + dur(w[1] - w[0]) + ", room for about " + runs + " run" + (runs > 1 ? "s" : "") + ")")); });
      fw.appendChild(ul);
      const total = good.reduce((a, w) => a + Math.floor((w[1] - w[0]) / b.skRun), 0);
      fw.appendChild(el("p", "note", total >= 6 ? "Enough room for all 6 runs (3 Driving + 3 Autonomous) if lines are short." : "Only about " + total + " run" + (total === 1 ? "" : "s") + " fit between matches, so plan to use time after qualifying ends."));
    });
  }

  function renderBoard() {
    const b = built, tbl = $("#boardTbl"), only = $("#onlyMine").checked;
    const cap = $("caption", tbl); tbl.textContent = ""; tbl.appendChild(cap);
    const hd = el("tr"); hd.appendChild(el("th", null, "Time")); for (let f = 1; f <= b.F; f++) hd.appendChild(el("th", null, "Field " + f));
    const th = el("thead"); th.appendChild(hd); tbl.appendChild(th);
    const tb = el("tbody"), bySlot = {};
    b.matches.forEach(m => { (bySlot[m.start] = bySlot[m.start] || []).push(m); });
    const maxField = Math.max(b.F, Math.max.apply(null, b.matches.map(m => m.field)));
    let lunchDone = !b.lunch;
    Object.keys(bySlot).map(Number).sort((a, c) => a - c).forEach(t => {
      if (!lunchDone && t >= b.lunch.end) { const lr = el("tr", "lunchrow"); const c = el("td", null, "Lunch " + fmt(b.lunch.start) + " – " + fmt(b.lunch.end)); c.colSpan = maxField + 1; lr.appendChild(c); tb.appendChild(lr); lunchDone = true; }
      const ms = bySlot[t];
      if (only && !ms.some(m => m.teams.some(x => mine.has(x)))) return;
      const tr = el("tr"); tr.appendChild(el("th", null, fmt(t))); tr.lastChild.scope = "row";
      for (let f = 1; f <= maxField; f++) {
        const m = ms.find(x => x.field === f), td = el("td");
        if (m) {
          const hasMine = m.teams.some(x => mine.has(x)); if (hasMine) td.className = "hasmine";
          td.appendChild(el("span", "mn", "Q" + m.n + (m.surrogate ? "*" : "")));
          m.teams.forEach((x, i) => {
            const bt = el("button", "tm" + (mine.has(x) ? " mine" : ""), (i === 0 ? "R " : "B ") + x + (m.surrogate === x ? "*" : "")); bt.type = "button";
            bt.setAttribute("aria-pressed", mine.has(x)); bt.title = "Highlight " + x;
            bt.addEventListener("click", () => toggleMine(x)); td.appendChild(bt);
          });
        }
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
  }

  function toggleMine(t) {
    if (mine.has(t)) mine.delete(t); else mine.add(t);
    $("#mine").value = Array.from(mine).join(", "); save(); renderLanes(); renderMy(); renderBoard(); renderReport();
  }

  function renderReport() {
    const b = built, tbl = $("#reportTbl"); tbl.textContent = "";
    const hd = el("tr"); ["Team", "Matches", "Extra*", "Different partners", "Shortest rest", "Back-to-back", "Red / Blue", "First match", "Last match"].forEach(h => hd.appendChild(el("th", null, h)));
    const th = el("thead"); th.appendChild(hd); tbl.appendChild(th);
    const tb = el("tbody");
    b.teams.slice().sort((a, c) => a.localeCompare(c, undefined, { numeric: true })).forEach(t => {
      const r = b.an.rep[t]; if (!r) return;
      const tr = el("tr", mine.has(t) ? "mine" : "");
      [t, r.counted, r.extra || "—", r.partners + " of " + r.partnerTotal, r.minGap == null ? "—" : r.minGap <= 0 ? "none" : dur(r.minGap), r.b2b || "—", r.red + " / " + r.blue, fmt(r.first), fmt(r.last)]
        .forEach((v, i) => { const c = el(i === 0 ? "th" : "td", null, String(v)); if (i === 0) c.scope = "row"; tr.appendChild(c); });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
  }

  /* ---------- export ---------- */
  function csv() {
    if (!built) return "";
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    const rows = [["Match", "Time", "Field", "Team 1 (red)", "Team 2 (blue)", "Extra match team"]];
    built.matches.forEach(m => rows.push(["Q" + m.n, fmt(m.start), m.field, m.teams[0], m.teams[1], m.surrogate || ""]));
    return rows.map(r => r.map(q).join(",")).join("\n");
  }
  $("#dlCsv").addEventListener("click", () => {
    if (!built) { $("#formMsg").textContent = "Build a schedule first."; return; }
    const a = el("a"); a.href = URL.createObjectURL(new Blob([csv()], { type: "text/csv" })); a.download = "level-up-practice-schedule.csv";
    document.body.appendChild(a); a.click(); a.remove();
  });
  $("#copyLink").addEventListener("click", () => {
    const url = shareLink(), msg = $("#formMsg"); msg.className = "";
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => { msg.textContent = "Link copied. It contains your settings and team list."; }, () => { msg.textContent = "Copy this link: " + url; });
  });

  /* ---------- wiring ---------- */
  detailEl = $("#detail");
  $("#setupForm").addEventListener("submit", e => { e.preventDefault(); build(); });
  $("#zoom").addEventListener("input", () => built && renderLanes());
  $("#showAll").addEventListener("change", () => built && renderLanes());
  $("#onlyMine").addEventListener("change", () => built && renderBoard());
  $("#mine").addEventListener("change", () => { mine = new Set(parseTeams($("#mine").value)); save(); if (built) { renderLanes(); renderMy(); renderBoard(); renderReport(); } });

  const saved = load();
  if (saved) { writeState(saved); if (parseTeams(saved.teams).length >= 2 || saved.src === "imp") build(); }
  else setSource("gen");
})();
