(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- score calculator ---------- */
  var inputs = $$("#calc input[type=number]");
  var totalEl = $("#calcTotal");
  function calc() {
    var total = 0;
    inputs.forEach(function (i) {
      var n = Math.max(0, parseInt(i.value, 10) || 0);
      total += n * Number(i.dataset.pts);
    });
    totalEl.textContent = total;
  }
  inputs.forEach(function (i) { i.addEventListener("input", calc); });
  $("#calcReset").addEventListener("click", function () {
    inputs.forEach(function (i) { i.value = 0; });
    calc();
  });
  $("#calcExample").addEventListener("click", function () {
    [3, 4, 3, 2, 1].forEach(function (v, idx) { inputs[idx].value = v; });
    calc();
    $("#calcNote").textContent = "Example: 3 Floor + 4 L1 + 3 L2 + 2 L3 + 1 L4 = 13 bags. Notice L4 alone is worth as much as 16 Floor Goal bags.";
  });
  calc();

  /* ---------- rules explorer ---------- */
  var RULES = window.RULES, CATS = window.RULE_CATS, BASE = window.RULE_BASE;
  var list = $("#ruleList"), filtersEl = $("#ruleFilters"), search = $("#ruleSearch");
  var countEl = $("#ruleCount"), emptyEl = $("#ruleEmpty");
  var activeCat = "all";
  var catLabel = {};
  CATS.forEach(function (c) { catLabel[c.key] = c.label; });

  function mkBtn(key, label) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = label; b.dataset.cat = key;
    b.setAttribute("aria-pressed", key === activeCat ? "true" : "false");
    b.addEventListener("click", function () {
      activeCat = key;
      $$("button", filtersEl).forEach(function (x) { x.setAttribute("aria-pressed", x.dataset.cat === key ? "true" : "false"); });
      render();
    });
    return b;
  }
  filtersEl.appendChild(mkBtn("all", "All"));
  CATS.forEach(function (c) { filtersEl.appendChild(mkBtn(c.key, c.label)); });

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function hl(text, terms) {
    var frag = document.createDocumentFragment();
    if (!terms.length) { frag.appendChild(document.createTextNode(text)); return frag; }
    var re = new RegExp("(" + terms.map(esc).join("|") + ")", "ig");
    text.split(re).forEach(function (part, i) {
      if (i % 2) { var m = document.createElement("mark"); m.textContent = part; frag.appendChild(m); }
      else if (part) frag.appendChild(document.createTextNode(part));
    });
    return frag;
  }

  function ruleEl(r, terms, open) {
    var d = document.createElement("details");
    d.className = "rule"; d.id = "rule-" + r.id;
    if (open) d.open = true;

    var s = document.createElement("summary");
    var id = document.createElement("span"); id.className = "rid"; id.textContent = r.id;
    var t = document.createElement("span");
    var title = document.createElement("span"); title.className = "rtitle"; title.appendChild(hl(r.title, terms));
    var cat = document.createElement("span"); cat.className = "rcat"; cat.textContent = catLabel[r.cat];
    t.appendChild(title); t.appendChild(cat);
    s.appendChild(id); s.appendChild(t);
    d.appendChild(s);

    var body = document.createElement("div"); body.className = "rbody";
    var p = document.createElement("p"); p.appendChild(hl(r.sum, terms)); body.appendChild(p);
    if (r.coach) {
      var c = document.createElement("p"); c.className = "coach";
      var lab = document.createElement("b"); lab.textContent = "Coach's note";
      c.appendChild(lab); c.appendChild(hl(r.coach, terms)); body.appendChild(c);
    }
    var a = document.createElement("a");
    a.href = BASE + r.id + ".html"; a.rel = "noopener"; a.target = "_blank";
    a.textContent = "Read the official rule " + r.id + " ↗";
    var ap = document.createElement("p"); ap.appendChild(a); body.appendChild(ap);
    d.appendChild(body);
    return d;
  }

  function render() {
    var q = search.value.trim().toLowerCase();
    var terms = q ? q.split(/\s+/).filter(Boolean) : [];
    var out = RULES.filter(function (r) {
      if (activeCat !== "all" && r.cat !== activeCat) return false;
      if (!terms.length) return true;
      var hay = (r.id + " " + r.title + " " + r.sum + " " + (r.coach || "") + " " + (r.tags || "") + " " + catLabel[r.cat]).toLowerCase();
      return terms.every(function (t) { return hay.indexOf(t) !== -1; });
    });
    list.textContent = "";
    var autoOpen = terms.length > 0 && out.length <= 3;
    out.forEach(function (r) { list.appendChild(ruleEl(r, terms, autoOpen)); });
    countEl.textContent = "Showing " + out.length + " of " + RULES.length + " rules";
    emptyEl.hidden = out.length > 0;
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName)) { e.preventDefault(); search.focus(); search.scrollIntoView({ block: "center" }); }
  });
  var timer;
  search.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(render, 80); });
  render();

  // deep-link: #rule-SG6 (or #SG6) scrolls to and opens that rule
  function openFromHash() {
    var m = location.hash.match(/^#(?:rule-)?([A-Za-z]+\d+)$/);
    if (!m) return;
    var id = m[1].toUpperCase();
    var el = document.getElementById("rule-" + id);
    if (!el) {
      search.value = ""; activeCat = "all";
      $$("button", filtersEl).forEach(function (x) { x.setAttribute("aria-pressed", x.dataset.cat === "all" ? "true" : "false"); });
      render();
      el = document.getElementById("rule-" + id);
    }
    if (el) { el.open = true; el.scrollIntoView({ block: "center" }); }
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();

  // make rule references like "SG6" inside cards clickable
  $$(".rule-ref").forEach(function (el) {
    if (el.querySelector("a")) return;
    el.innerHTML = el.textContent.split(/\s*·\s*/).map(function (id) {
      id = id.trim();
      return /^[A-Z]+\d+$/.test(id) ? '<a href="#rule-' + id + '">' + id + "</a>" : id;
    }).join(" · ");
  });
  $$(".ref").forEach(function (el) {
    el.innerHTML = el.textContent.split(/\s*·\s*/).map(function (id) {
      id = id.trim();
      return /^[A-Z]+\d+$/.test(id) ? '<a href="#rule-' + id + '">' + id + "</a>" : id;
    }).join(" · ");
  });
  $$("summary .ref").forEach(function (el) {
    // links inside <summary> would fight with toggling; leave plain text there
    el.textContent = el.textContent;
  });

  /* ---------- tabs (WAI-ARIA tabs pattern) ---------- */
  $$("[data-nbtabs]").forEach(function (root) {
    var tabs = $$('[role="tab"]', root);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab); });
      tab.addEventListener("keydown", function (e) {
        var k = e.key, n = -1;
        if (k === "ArrowRight") n = (i + 1) % tabs.length;
        else if (k === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
        else if (k === "Home") n = 0;
        else if (k === "End") n = tabs.length - 1;
        if (n > -1) { e.preventDefault(); select(tabs[n], true); }
      });
    });
    // deep links such as #notebook-check open that tab
    function fromHash() {
      var m = location.hash.match(/^#notebook-(write|check|sum|honest|score)$/);
      if (m) { select(document.getElementById("nbt-" + m[1])); root.scrollIntoView({ block: "start" }); }
    }
    window.addEventListener("hashchange", fromHash); fromHash();
  });

  /* ---------- version table (status computed from today's date) ---------- */
  var VERSIONS = [
    ["0.1", [2026, 4, 30], [2026, 4, 30], "Initial game release"],
    ["0.2", [2026, 6, 4],  [2026, 6, 11], "Minor typographical and formatting fixes"],
    ["1.0", [2026, 7, 2],  [2026, 7, 9],  "Gameplay or rule changes informed by the Q&A and community"],
    ["1.1", [2026, 8, 6],  [2026, 8, 13], "Clarification / minor update"],
    ["2.0", [2026, 9, 3],  [2026, 9, 10], "Gameplay or rule changes informed by early-season events"],
    ["2.1", [2026, 10, 8], [2026, 10, 15], "Clarification / minor update"],
    ["2.2", [2026, 12, 3], [2026, 12, 10], "Clarification / minor update"],
    ["3.0", [2027, 1, 28], [2027, 2, 4],  "Gameplay or rule changes informed by early-season events"],
    ["4.0", [2027, 3, 25], [2027, 4, 1],  "Changes pertaining specifically to the VEX Robotics World Championship"]
  ];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function toDate(a) { return new Date(a[0], a[1] - 1, a[2]); }
  function fmt(a) { return MON[a[1] - 1] + " " + a[2] + ", " + a[0]; }

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var cur = -1;
  VERSIONS.forEach(function (v, i) { if (toDate(v[2]) <= today) cur = i; });
  var tbody = $("#versionTable tbody");
  VERSIONS.forEach(function (v, i) {
    var tr = document.createElement("tr");
    if (i === cur) tr.className = "current";
    var status = i < cur ? ["Superseded", ""] : i === cur ? ["In effect", "now"] : ["Upcoming", "soon"];
    [["th", "v" + v[0]], ["td", fmt(v[1])], ["td", fmt(v[2])], ["td", v[3]]].forEach(function (c) {
      var cell = document.createElement(c[0]); if (c[0] === "th") cell.scope = "row"; cell.textContent = c[1]; tr.appendChild(cell);
    });
    var td = document.createElement("td"), b = document.createElement("span");
    b.className = "badge " + status[1]; b.textContent = status[0]; td.appendChild(b); tr.appendChild(td);
    tbody.appendChild(tr);
  });

  var st = $("#versionStatusText");
  if (cur >= 0) {
    var next = VERSIONS[cur + 1];
    st.textContent = "Game Manual v" + VERSIONS[cur][0] + " in effect" +
      (next ? " · v" + next[0] + " due " + fmt(next[1]).replace(/, \d{4}$/, "") + " (effective " + fmt(next[2]).replace(/, \d{4}$/, "") + ")" : "");
  }
})();
