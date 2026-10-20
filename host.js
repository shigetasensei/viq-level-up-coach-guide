/* Host zone: turns the event date into due dates for each to-do group. Saved on this device only. */
(function () {
  "use strict";
  var KEY = "levelup-host-date", DAY = 86400000;
  var input = document.getElementById("hostDate"), count = document.getElementById("hostCount");
  if (!input) return;
  var list = document.getElementById("hostList");
  var groups = Array.prototype.slice.call(list.querySelectorAll("fieldset"));

  function get() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function put(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) {} }
  function parse(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function fmt(d) { return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }

  function render() {
    var ev = parse(input.value), today = new Date();
    today.setHours(0, 0, 0, 0);
    groups.forEach(function (g) {
      var due = g.querySelector(".due"), days = +due.dataset.days;
      var open = Array.prototype.some.call(g.querySelectorAll("input[type=checkbox]"), function (b) { return !b.checked; });
      due.className = "due";
      if (!ev) { due.textContent = ""; return; }
      if (days < 0) { due.textContent = "after " + fmt(ev); return; }
      var d = new Date(ev.getFullYear(), ev.getMonth(), ev.getDate() - days);
      due.textContent = (days === 0 ? "on " : "by ") + fmt(d);
      if (d < today && open) { due.classList.add("late"); due.textContent += " · overdue"; }
    });
    if (!ev) { count.textContent = "Pick a date to see due dates."; return; }
    var n = Math.round((ev - today) / DAY);
    count.textContent = n > 1 ? n + " days to go · " + fmt(ev)
      : n === 1 ? "Tomorrow! " + fmt(ev)
      : n === 0 ? "Event day. You've got this."
      : "The event was " + (-n) + (n === -1 ? " day" : " days") + " ago. Time for the thank-yous and the debrief.";
  }

  input.value = get();
  input.addEventListener("change", function () { put(input.value); render(); });
  list.addEventListener("change", render);
  list.addEventListener("click", function (e) { if (e.target.closest(".cl-reset")) setTimeout(render, 0); });
  render();
})();
