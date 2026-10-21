/* Shared checklist behavior: saves ticks in this browser and prints one checklist at a time.
   Any element with class "checklist" and a data-store key is picked up automatically. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || "null");
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  function initChecklist(root, key) {
    $$("label", root).forEach(function (lab) {
      var box = lab.querySelector("input"), wrap = document.createElement("span");
      while (box.nextSibling) wrap.appendChild(box.nextSibling);
      lab.appendChild(wrap);
    });
    var boxes = $$("input[type=checkbox]", root);
    var saved = store(key) || {};
    function update() {
      var done = boxes.filter(function (b) { return b.checked; }).length;
      $(".progress i", root).style.width = (boxes.length ? done / boxes.length * 100 : 0) + "%";
      $(".cl-count", root).textContent = done + " of " + boxes.length + " checked";
    }
    boxes.forEach(function (b) {
      b.checked = !!saved[b.dataset.id];
      b.addEventListener("change", function () { saved[b.dataset.id] = b.checked; store(key, saved); update(); });
    });
    $(".cl-reset", root).addEventListener("click", function () {
      boxes.forEach(function (b) { b.checked = false; });
      saved = {}; store(key, saved); update();
    });
    update();
  }

  /* print just one checklist: light palette, blank Team/Date lines, ticks kept */
  function printChecklist(root) {
    var title = ($(".cl-head h3", root) || {}).textContent || "Checklist";
    var area = document.createElement("div");
    area.className = "print-area"; area.setAttribute("aria-hidden", "true");
    var h = document.createElement("h1"); h.textContent = title; area.appendChild(h);
    var sub = document.createElement("p"); sub.className = "ps"; sub.textContent = "Level Up · The Coach's Field Manual · VEX IQ 2026–27 · unofficial guide"; area.appendChild(sub);
    var meta = document.createElement("div"); meta.className = "meta";
    (root.dataset.meta ? root.dataset.meta.split(",") : ["Team", "Date", "Checked by"]).forEach(function (t) { var s = document.createElement("span"); s.textContent = t; meta.appendChild(s); });
    area.appendChild(meta);
    var src = $$("input[type=checkbox]", root);
    $$("fieldset", root).forEach(function (fs) {
      var c = fs.cloneNode(true);
      $$("input[type=checkbox]", c).forEach(function (cb) {
        var o = src.filter(function (b) { return b.dataset.id === cb.dataset.id; })[0];
        cb.removeAttribute("id");
        if (o && o.checked) { cb.setAttribute("checked", ""); cb.checked = true; }
      });
      $$("a", c).forEach(function (a) { a.replaceWith(document.createTextNode(a.textContent)); });
      area.appendChild(c);
    });
    var f = document.createElement("p"); f.className = "pf";
    f.textContent = ($(".cl-count", root) || {}).textContent + " · " + location.href.split("#")[0];
    area.appendChild(f);
    document.body.appendChild(area); document.body.classList.add("print-one");
    var done = function () { document.body.classList.remove("print-one"); area.remove(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(function () { window.print(); }, 60);
  }

  $$(".checklist[data-store]").forEach(function (root) { initChecklist(root, root.dataset.store); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-print]");
    if (b && b.closest(".checklist")) printChecklist(b.closest(".checklist"));
  });
})();
