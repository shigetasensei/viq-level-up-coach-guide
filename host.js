/* Host zone: event-date due dates, who-does-what filter, "next up" list, preparation timeline,
   event-day run sheet and lead sheets. Everything is saved on this device only. */
(function () {
  "use strict";
  var DAY = 86400000, KEY = "levelup-host-date", RKEY = "levelup-host-run";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function put(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function parse(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fmt(d) { return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }

  /* ---------- to-do list: dates, filter, next up, timeline ---------- */
  var input = $("#hostDate"), count = $("#hostCount"), list = $("#hostList");
  if (input && list) {
    var groups = $$("fieldset", list);
    var OWN = { all: "everyone", ep: "the Event Partner", sc: "the School contact", hr: "the Head Referee / Judge Advisor", vc: "the Volunteer coordinator" };
    var filter = "all";
    var phaseBar = $("#phaseBar"), nextList = $("#nextList"), nextMeta = $("#nextMeta");

    var labelText = function (l) {
      var s = $("span", l); if (!s) return l.textContent.trim();
      var c = s.cloneNode(true); $$(".own", c).forEach(function (o) { o.remove(); });
      return c.textContent.trim();
    };
    var phaseName = function (g) { return g.querySelector("legend").firstChild.textContent.trim(); };

    function render() {
      var ev = parse(input.value), today = new Date();
      today.setHours(0, 0, 0, 0);
      var overdue = 0, total = 0, done = 0;

      groups.forEach(function (g) {
        var due = g.querySelector(".due"), days = +due.dataset.days;
        var boxes = $$("input[type=checkbox]", g), open = boxes.some(function (b) { return !b.checked; });
        total += boxes.length; done += boxes.filter(function (b) { return b.checked; }).length;
        due.className = "due"; g.dataset.when = "";
        if (!ev) { due.textContent = ""; return; }
        if (days < 0) { due.textContent = "after " + fmt(ev); g.dataset.when = "after " + fmt(ev); return; }
        var d = new Date(ev.getFullYear(), ev.getMonth(), ev.getDate() - days);
        due.textContent = (days === 0 ? "on " : "by ") + fmt(d);
        g.dataset.when = due.textContent;
        if (d < today && open) {
          due.classList.add("late"); due.textContent += " · overdue";
          overdue += boxes.filter(function (b) { return !b.checked && !b.closest("label").hidden; }).length;
        }
      });

      if (!ev) { count.textContent = "Pick a date to see due dates."; }
      else {
        var n = Math.round((ev - today) / DAY);
        count.textContent = n > 1 ? n + " days to go · " + fmt(ev)
          : n === 1 ? "Tomorrow! " + fmt(ev)
          : n === 0 ? "Event day. You've got this."
          : "The event was " + (-n) + (n === -1 ? " day" : " days") + " ago. Time for the thank-yous and the debrief.";
      }

      /* preparation timeline: one step per group, with progress */
      if (phaseBar) {
        var cur = -1;
        groups.forEach(function (g, i) {
          var bx = $$("input[type=checkbox]", g), dn = bx.filter(function (b) { return b.checked; }).length;
          if (cur < 0 && dn < bx.length) cur = i;
        });
        phaseBar.textContent = "";
        groups.forEach(function (g, i) {
          var bx = $$("input[type=checkbox]", g), dn = bx.filter(function (b) { return b.checked; }).length;
          var li = document.createElement("li");
          if (dn === bx.length) li.className = "is-done"; else if (i === cur) li.className = "is-now";
          var b = document.createElement("b"); b.textContent = phaseName(g);
          var w = document.createElement("span"); w.className = "pb-date"; w.textContent = g.dataset.when || "";
          var bar = document.createElement("span"); bar.className = "pb-prog"; bar.setAttribute("aria-hidden", "true");
          var fill = document.createElement("i"); fill.style.width = (bx.length ? dn / bx.length * 100 : 0) + "%"; bar.appendChild(fill);
          var c = document.createElement("span"); c.className = "pb-n"; c.textContent = dn + "/" + bx.length + (i === cur ? " · now" : "");
          [b, w, bar, c].forEach(function (x) { li.appendChild(x); });
          phaseBar.appendChild(li);
        });
      }

      /* next up: the first open items, in order, for the person chosen */
      if (nextList) {
        nextList.textContent = "";
        var shown = 0;
        groups.forEach(function (g) {
          $$("label", g).forEach(function (l) {
            if (shown >= 5 || l.hidden) return;
            var box = $("input", l); if (box.checked) return;
            var li = document.createElement("li");
            var chip = $(".own", l); if (chip) li.appendChild(chip.cloneNode(true));
            li.appendChild(document.createTextNode(" " + labelText(l)));
            var w = document.createElement("small"); w.textContent = g.dataset.when || phaseName(g); li.appendChild(w);
            nextList.appendChild(li); shown++;
          });
        });
        if (!shown) { var li0 = document.createElement("li"); li0.textContent = "Nothing open. Well done!"; nextList.appendChild(li0); }
        nextMeta.textContent = done + " of " + total + " done" + (filter !== "all" ? " · showing " + OWN[filter] : "") + (overdue ? " · " + overdue + " overdue" : "");
      }
    }

    function applyFilter() {
      groups.forEach(function (g) {
        var any = false;
        $$("label", g).forEach(function (l) {
          l.hidden = filter !== "all" && l.dataset.owner !== filter;
          if (!l.hidden) any = true;
        });
        g.hidden = !any;
      });
      render();
    }
    var pick = $("#ownPick");
    if (pick) pick.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-own]"); if (!b) return;
      filter = b.dataset.own;
      $$("button", pick).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      applyFilter();
    });

    input.value = get(KEY);
    input.addEventListener("change", function () { put(KEY, input.value); render(); });
    list.addEventListener("change", render);
    list.addEventListener("click", function (e) { if (e.target.closest(".cl-reset")) setTimeout(render, 0); });
    render();
  }

  /* ---------- event-day run sheet ---------- */
  var body = $("#rsBody"), presetSel = $("#rsPreset"), doorsIn = $("#rsDoors");
  if (body && presetSel && doorsIn) {
    var P = "Event page", S = "Suggested";
    var pre = [[-60, "Volunteers arrive, briefing and role sheets handed out", "Volunteer coordinator", S], [-45, "Final check of Fields, pits and signs", "Field and queue lead", S], [-15, "Check-in desk and inspection ready", "Check-in and inspection leads", S]];
    var RS = {
      iq: { name: "VEX IQ · Level Up · Canadian Academy", doors: "09:30", note: "Times from the event page: doors open and inspection begin at 9:30, matches start at 10:45. The page says the schedule will be updated closer to the date.", rows: pre.concat([
        [0, "Doors open and inspection begins", "Check-in and inspection leads", P], [45, "Drivers' meeting begins", "Head Referee", P], [75, "Teamwork Challenge and Skills Matches begin", "Referees, queuers, scorekeeper", P],
        [220, "Lunch begins", "Volunteer coordinator (breaks)", P], [260, "Matches resume", "Referees, queuers", P], [435, "Finals Matches begin and Skills Matches end", "Head Referee, scorekeeper", P],
        [450, "Award ceremony begins", "Event Partner, Judge Advisor", P], [480, "Clean-up begins", "Everyone", P]]) },
      mbis: { name: "VEX V5 · Override · MBIS", doors: "09:30", note: "Times from the event page. Volunteer check-in runs 9:30 to 10:00, and robot inspections run until 11:30.", rows: pre.concat([
        [0, "Doors open and volunteer check-in begins (to 10:00)", "Volunteer coordinator", P], [30, "Team check-in and robot inspections begin; practice field opens", "Check-in and inspection leads", P], [120, "Drivers and coaches meeting", "Head Referee", P],
        [150, "Practice Matches and Skills Matches begin", "Referees, queuers", P], [210, "Lunch break", "Volunteer coordinator (breaks)", P], [255, "Qualification Matches, Skills Matches and Judges Panel begin", "Head Referee, Judge Advisor", P],
        [360, "Alliance selection", "Tournament Manager lead", P], [390, "Elimination Matches begin", "Head Referee", P], [420, "Award ceremony", "Event Partner, Judge Advisor", P], [450, "Pits close", "Field and queue lead", P], [480, "Venue closes", "Event Partner", P]]) },
      ca5: { name: "VEX V5 · Override · Canadian Academy (tentative)", doors: "08:30", note: "Tentative times from the event page, which says the schedule will be updated. Some times on the page are marked PM and look like typos, so they are shown as morning times.", rows: pre.concat([
        [0, "Doors open", "Check-in and inspection leads", P], [60, "Drivers and coaches meeting", "Head Referee", P], [90, "Opening ceremony", "Event Partner", P], [120, "Practice Matches begin", "Referees, queuers", P], [180, "Lunch break", "Volunteer coordinator (breaks)", P],
        [225, "Qualification Matches begin", "Head Referee", P], [420, "Qualification Matches end", "Head Referee", P], [435, "Alliance selection", "Tournament Manager lead", P], [465, "Elimination Matches begin", "Head Referee", P],
        [495, "Elimination Matches end", "Head Referee", P], [570, "Award ceremony", "Event Partner, Judge Advisor", P], [600, "Clean-up", "Everyone", P]]) }
    };
    RS.mine = { name: "My event", doors: "09:00", note: "Starts from the VEX IQ pattern. Change the doors-open time, then use the times as a starting point and adjust them in your own plan.", rows: RS.iq.rows.map(function (r) { return [r[0], r[1], r[2], r[3] === P ? S : r[3]]; }) };

    var tm = function (min) { var t = ((min % 1440) + 1440) % 1440; return ("0" + Math.floor(t / 60)).slice(-2) + ":" + ("0" + (t % 60)).slice(-2); };
    var toMin = function (v) { var m = /^(\d{1,2}):(\d{2})$/.exec(v); return m ? +m[1] * 60 + +m[2] : 0; };
    var cur = RS[presetSel.value];
    $("#rsTable").classList.add("stackable"); $("#rsTable").parentNode.classList.add("stack-wrap");

    function drawRun() {
      cur = RS[presetSel.value]; var d0 = toMin(doorsIn.value);
      body.textContent = "";
      cur.rows.forEach(function (r) {
        var tr = document.createElement("tr"), th = document.createElement("th");
        th.scope = "row"; th.textContent = tm(d0 + r[0]); tr.appendChild(th);
        [r[1], r[2], r[3]].forEach(function (t, k) {
          var td = document.createElement("td"); td.setAttribute("data-label", ["What happens", "Lead (suggested)", "Source"][k]);
          if (k === 2) { var tg = document.createElement("span"); tg.className = "tag " + (t === S ? "suggested" : "official"); tg.textContent = t === S ? "Suggested" : "Event page"; td.appendChild(tg); }
          else td.textContent = t;
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      $("#rsNote").textContent = cur.note;
      put(RKEY, JSON.stringify({ p: presetSel.value, d: doorsIn.value }));
    }
    var saved = {}; try { saved = JSON.parse(get(RKEY) || "{}"); } catch (e) { saved = {}; }
    if (saved.p && RS[saved.p]) presetSel.value = saved.p;
    doorsIn.value = saved.d || RS[presetSel.value].doors;
    presetSel.addEventListener("change", function () { doorsIn.value = RS[presetSel.value].doors; drawRun(); });
    doorsIn.addEventListener("input", drawRun);
    drawRun();

    var pbtn = $("#rsPrint");
    if (pbtn) pbtn.addEventListener("click", function () {
      var area = document.createElement("div"); area.className = "print-area"; area.setAttribute("aria-hidden", "true");
      var h1 = document.createElement("h1"); h1.textContent = "Event-day run sheet"; area.appendChild(h1);
      var sub = document.createElement("p"); sub.className = "ps"; sub.textContent = cur.name + " · doors open " + doorsIn.value + " · Level Up · The Coach's Field Manual · unofficial guide"; area.appendChild(sub);
      var meta = document.createElement("div"); meta.className = "meta";
      ["Event Partner", "Date", "Version"].forEach(function (t) { var s = document.createElement("span"); s.textContent = t; meta.appendChild(s); }); area.appendChild(meta);
      var tb = $("#rsTable").cloneNode(true); tb.removeAttribute("id"); tb.className = "rs-print"; area.appendChild(tb);
      var f = document.createElement("p"); f.className = "pf"; f.textContent = cur.note + " " + location.href.split("#")[0]; area.appendChild(f);
      document.body.appendChild(area); document.body.classList.add("print-one");
      var done = function () { document.body.classList.remove("print-one"); area.remove(); window.removeEventListener("afterprint", done); };
      window.addEventListener("afterprint", done);
      setTimeout(function () { window.print(); }, 60);
    });
  }

  /* ---------- lead sheets: one at a time ---------- */
  var lpick = $("#leadPick");
  if (lpick) {
    var lbtns = $$("button", lpick), sheets = $$(".lead-sheet");
    var show = function (id) {
      var ok = false;
      sheets.forEach(function (s) { var on = s.id === "lead-" + id; s.hidden = !on; ok = ok || on; });
      if (ok) lbtns.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.lead === id ? "true" : "false"); });
    };
    lbtns.forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.lead); }); });
    var fromHash = function () { var m = /^#lead-(\w+)$/.exec(location.hash); if (m) { show(m[1]); var s = $("#leads"); if (s) s.scrollIntoView({ block: "start" }); } };
    window.addEventListener("hashchange", fromHash); fromHash();
  }
})();
