/* Student zone: "That's me" job picker, saved in this browser. */
(function () {
  "use strict";
  var KEY = "levelup-my-roles";
  var rows = Array.prototype.slice.call(document.querySelectorAll("#roleTable tbody tr"));
  var summary = document.getElementById("roleSummary");
  if (!rows.length) return;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  var picked = load();

  function render() {
    rows.forEach(function (tr) {
      var on = picked.indexOf(tr.dataset.role) > -1, b = tr.querySelector(".role-me");
      tr.classList.toggle("mine", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.textContent = on ? "✓ That's me" : "That's me";
      b.setAttribute("aria-label", (on ? "Remove " : "Pick ") + tr.dataset.role);
    });
    summary.textContent = picked.length
      ? "Your jobs: " + picked.join(", ") + ". " + (picked.length > 2 ? "That's a lot, so share some with your team!" : "Nice choice!")
      : "Tap “That's me” on the jobs you want to try. Your picks are saved on this device.";
  }
  rows.forEach(function (tr) {
    tr.querySelector(".role-me").addEventListener("click", function () {
      var i = picked.indexOf(tr.dataset.role);
      if (i > -1) picked.splice(i, 1); else picked.push(tr.dataset.role);
      save(picked); render();
    });
  });
  render();
})();
