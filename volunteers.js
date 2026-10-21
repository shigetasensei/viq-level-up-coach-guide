/* Volunteer zone: role-sheet picker (cards and #sheet-... links open a sheet) and a click-to-load YouTube video. */
(function () {
  "use strict";
  /* volunteer role sheets: pick one job at a time; cards and the URL hash can open a sheet */
  var pick = document.getElementById("volPick");
  if (pick) {
    var btns = Array.prototype.slice.call(pick.querySelectorAll("button"));
    var sheets = Array.prototype.slice.call(document.querySelectorAll(".vol-sheet"));
    var show = function (id, scroll) {
      var ok = false;
      sheets.forEach(function (sh) { var on = sh.id === "sheet-" + id; sh.hidden = !on; ok = ok || on; });
      if (!ok) return;
      btns.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.vol === id ? "true" : "false"); });
      if (scroll) document.getElementById("rolesheets").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    btns.forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.vol, false); }); });
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-vol]");
      if (a) { e.preventDefault(); show(a.dataset.vol, true); history.replaceState(null, "", "#sheet-" + a.dataset.vol); }
    });
    var fromHash = function () { var m = /^#sheet-(\w+)$/.exec(location.hash); if (m) show(m[1], true); };
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }

  /* YouTube click-to-load: nothing is requested from YouTube until the viewer presses play */
  Array.prototype.forEach.call(document.querySelectorAll(".video-facade[data-yt]"), function (b) {
    b.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + b.dataset.yt + "?autoplay=1&rel=0";
      f.title = b.dataset.title || "Official game video";
      f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      f.allowFullscreen = true; f.referrerPolicy = "strict-origin-when-cross-origin";
      b.replaceWith(f);
      f.focus();
    });
  });
})();
