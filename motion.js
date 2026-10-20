/* Motion + UI layer: header, full-screen menu, level HUD, scroll reveals, marquee, match clock, size envelope. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var html = document.documentElement;
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) gsap.registerPlugin(ScrollTrigger); else html.classList.add("js-fail");
  var G = hasGsap && !reduced;

  /* ================= header ================= */
  var header = $("#siteHeader"), lastY = window.scrollY;
  function onHeaderScroll() {
    var y = window.scrollY;
    header.classList.toggle("scrolled", y > 40);
    if (!document.body.classList.contains("menu-open")) header.classList.toggle("hide", y > lastY + 4 && y > 520 ? true : (y < lastY - 4 ? false : header.classList.contains("hide")));
    lastY = y;
  }
  window.addEventListener("scroll", onHeaderScroll, { passive: true }); onHeaderScroll();

  /* ================= menu ================= */
  var menu = $("#menu"), mbtn = $(".menu-btn"), inertEls = $$("main, .site-footer, .hud, .marquee");
  var lastFocus = null;
  function setMenu(open) {
    menu.classList.toggle("open", open);
    document.body.classList.toggle("menu-open", open);
    mbtn.setAttribute("aria-expanded", open ? "true" : "false");
    $(".ml-t", mbtn).textContent = open ? "Close" : "Menu";
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    inertEls.forEach(function (e) { if (open) e.setAttribute("inert", ""); else e.removeAttribute("inert"); });
    if (open) { lastFocus = document.activeElement; var f = $("a", menu); setTimeout(function () { f && f.focus({ preventScroll: true }); }, 450); header.classList.remove("hide"); }
    else { (lastFocus && lastFocus !== document.body ? lastFocus : mbtn).focus({ preventScroll: true }); }
  }
  if (menu && mbtn) {
    $$(".menu-group li", menu).forEach(function (li, i) { li.firstElementChild.style.setProperty("--i", i); });
    mbtn.addEventListener("click", function () { setMenu(!menu.classList.contains("open")); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("open")) setMenu(false);
      if (e.key === "Tab" && menu.classList.contains("open")) {
        var f = $$("a, button", menu).concat([mbtn]).filter(function (x) { return x.offsetParent !== null || x === mbtn; });
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); mbtn.focus(); }
        else if (!e.shiftKey && document.activeElement === mbtn) { e.preventDefault(); first.focus(); }
      }
    });
    menu.addEventListener("click", function (e) {
      var a = e.target.closest("a"); if (!a) return;
      var href = a.getAttribute("href");
      if (href && href.charAt(0) === "#") {
        e.preventDefault(); setMenu(false);
        var t = $(href); if (t) setTimeout(function () { t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); history.replaceState(null, "", href); }, 380);
      } else { setMenu(false); }
    });
  }

  /* ================= level HUD + progress ================= */
  var ANCH = ["top", "ch-l1", "ch-l2", "ch-l3", "ch-l4"].map(function (id) { return document.getElementById(id); });
  var PTS = [0, 3, 6, 12, 16], CHNAME = ["Brief", "Start", "Play", "Master", "Compete"];
  var hud = $(".hud"), hudFill = $(".hud-fill"), hudBag = $(".hud-bag"), hudPts = $(".hud-pts"), topBar = $(".progress-top i"), hdrCh = $("#hdrChapter");
  var hudLinks = hud ? $$("a", hud) : [], ys = [], docH = 1, vh = 1;
  function measure() {
    vh = window.innerHeight; docH = document.documentElement.scrollHeight;
    ys = ANCH.map(function (el) { return el ? el.getBoundingClientRect().top + window.scrollY - vh * 0.45 : 0; });
    ys[0] = 0;
  }
  var curLvl = -1;
  function onProgress() {
    var s = window.scrollY, i = 0;
    for (var k = 0; k < ys.length; k++) if (s >= ys[k]) i = k;
    var frac = i < ys.length - 1 ? Math.max(0, Math.min(1, (s - ys[i]) / Math.max(1, ys[i + 1] - ys[i]))) : 1;
    var pos = Math.min(1, (i + frac) / (ys.length - 1));
    if (hud) {
      var h = hud.querySelector(".hud-rail").offsetHeight;
      hudFill.style.height = pos * 100 + "%";
      var y = (1 - pos) * h + 8;
      hudBag.style.bottom = "auto"; hudBag.style.top = y + "px";
      hudPts.style.bottom = "auto"; hudPts.style.top = y + "px";
      var pts = Math.round(PTS[i] + (i < 4 ? (PTS[i + 1] - PTS[i]) * frac : 0));
      hudPts.textContent = pts;
    }
    if (hud) hud.classList.toggle("show", s > vh * 0.7);
    if (topBar) topBar.style.transform = "scaleX(" + Math.min(1, s / Math.max(1, docH - vh)) + ")";
    var lvl = i;
    if (lvl !== curLvl) {
      curLvl = lvl;
      hudLinks.forEach(function (a, n) { var L = parseInt(a.dataset.l, 10); if (L === lvl) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); a.classList.toggle("passed", L < lvl); });
      if (hdrCh) hdrCh.innerHTML = "<b>L" + lvl + "</b> " + CHNAME[lvl];
    }
  }
  measure(); onProgress();
  window.addEventListener("scroll", onProgress, { passive: true });
  window.addEventListener("resize", function () { measure(); onProgress(); });
  window.addEventListener("load", function () { measure(); onProgress(); if (hasGsap) ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); onProgress(); if (hasGsap) ScrollTrigger.refresh(); });

  /* ================= marquee ================= */
  var mq = $(".mq-track");
  if (mq) {
    var set = mq.firstElementChild;
    mq.appendChild(set.cloneNode(true)); mq.lastElementChild.setAttribute("aria-hidden", "true");
    if (G) {
      var x = 0, speed = 60, boost = 0, w = 0;
      var measureMq = function () { w = set.getBoundingClientRect().width; };
      measureMq(); window.addEventListener("resize", measureMq);
      var lastS = window.scrollY;
      gsap.ticker.add(function (t, dt) {
        var v = (window.scrollY - lastS); lastS = window.scrollY; boost += (Math.min(40, Math.abs(v)) - boost) * 0.1;
        x -= (speed + boost * 30) * dt / 1000; if (x <= -w) x += w;
        mq.style.transform = "translate3d(" + x + "px,0,0)";
      });
    } else { mq.style.animation = "none"; }
  }

  /* ================= split headings ================= */
  function splitWords(el) {
    if (el.children.length) return;
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    el.setAttribute("aria-label", words.join(" "));
    words.forEach(function (w, i) {
      var o = document.createElement("span"); o.className = "w"; o.setAttribute("aria-hidden", "true");
      o.style.cssText = "display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.12em;margin-bottom:-.12em";
      var n = document.createElement("span"); n.className = "wi"; n.textContent = w; n.style.cssText = "display:inline-block;will-change:transform";
      o.appendChild(n); el.appendChild(o); if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  }

  /* ================= GSAP scenes ================= */
  if (G) {
    html.classList.add("motion");
    // hero parallax out (the entrance itself is pure CSS so text paints immediately)
    if ($(".hero-content")) {
      gsap.to(".hero-content", { yPercent: -14, opacity: 0.0, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 25%", scrub: true } });
      gsap.to(".hero-score", { yPercent: -60, opacity: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "70% top", scrub: true } });
    }

    // headings
    $$("[data-split]").forEach(function (h) {
      splitWords(h);
      gsap.fromTo($$(".wi", h), { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.045, scrollTrigger: { trigger: h, start: "top 86%", once: true } });
    });

    // generic reveals
    $$("[data-reveal]").forEach(function (el) {
      var kind = el.dataset.reveal || "up", from = { opacity: 0, y: 40 };
      if (kind === "fade") from = { opacity: 0 };
      if (kind === "left") from = { opacity: 0, x: -48 };
      if (kind === "scale") from = { opacity: 0, scale: 0.94, y: 24 };
      gsap.fromTo(el, from, { opacity: 1, x: 0, y: 0, scale: 1, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
    });
    $$("[data-stagger]").forEach(function (g) {
      gsap.fromTo(g.children, { opacity: 0, y: 44 }, { opacity: 1, y: 0, duration: 1, ease: "expo.out", stagger: 0.07, scrollTrigger: { trigger: g, start: "top 86%", once: true } });
    });

    // chapter dividers
    $$(".chapter").forEach(function (c) {
      var big = $(".ch-big", c), name = $(".ch-name", c);
      gsap.fromTo(big, { xPercent: 10 }, { xPercent: -12, ease: "none", scrollTrigger: { trigger: c, start: "top bottom", end: "bottom top", scrub: true } });
      gsap.fromTo(name, { yPercent: 105 }, { yPercent: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: c, start: "top 60%", once: true } });
      gsap.fromTo($$(".ch-pts, .ch-top", c), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1, ease: "expo.out", stagger: 0.1, scrollTrigger: { trigger: c, start: "top 60%", once: true } });
    });

    // bean bag grid
    var bg = $$("#bagGrid i");
    if (bg.length) {
      bg.forEach(function (b) { b.style.setProperty("--rot", (Math.random() * 18 - 9).toFixed(1) + "deg"); });
      gsap.fromTo(bg, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: "back.out(2)", stagger: { each: 0.025, from: "random" }, scrollTrigger: { trigger: "#bagGrid", start: "top 85%", once: true } });
    }

    // ladder
    var rungs = $$(".rung");
    if (rungs.length) gsap.fromTo(rungs, { scaleY: 0 }, { scaleY: 1, duration: 1.3, ease: "expo.out", stagger: 0.12, scrollTrigger: { trigger: ".ladder", start: "top 78%", once: true } });

    // roadmap progress
    var road = $(".road-wrap");
    if (road) {
      var fill = $(".road-fill", road), items = $$(".road li", road);
      gsap.to(fill, { height: function () { return road.offsetHeight - 24; }, ease: "none", scrollTrigger: { trigger: road, start: "top 70%", end: "bottom 60%", scrub: true, invalidateOnRefresh: true } });
      items.forEach(function (li) { ScrollTrigger.create({ trigger: li, start: "top 68%", onEnter: function () { li.classList.add("on"); }, onLeaveBack: function () { li.classList.remove("on"); } }); });
    }

    // counters
    $$("[data-count]").forEach(function (el) {
      var to = parseFloat(el.dataset.count), o = { v: 0 };
      ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: function () { gsap.to(o, { v: to, duration: 1.6, ease: "power3.out", onUpdate: function () { el.textContent = Math.round(o.v); } }); } });
    });
  } else {
    // static fallbacks
    $$(".rung").forEach(function (r) { r.style.transform = "none"; });
    $$(".road li").forEach(function (li) { li.classList.add("on"); });
  }

  /* ================= magnetic buttons + cursor ================= */
  if (fine && G) {
    $$(".magnetic").forEach(function (b) {
      b.addEventListener("pointermove", function (e) { var r = b.getBoundingClientRect(); gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.28, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4, ease: "power3.out" }); });
      b.addEventListener("pointerleave", function () { gsap.to(b, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1,.4)" }); });
    });
    var cur = document.createElement("div"); cur.className = "cursor"; cur.setAttribute("aria-hidden", "true"); document.body.appendChild(cur);
    var cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    window.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; cur.classList.add("on"); }, { passive: true });
    document.addEventListener("pointerleave", function () { cur.classList.remove("on"); });
    gsap.ticker.add(function () { cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22; cur.style.transform = "translate3d(" + cx + "px," + cy + "px,0)"; });
    document.addEventListener("pointerover", function (e) {
      var tgt = e.target.closest && e.target.closest("[data-cursor]");
      cur.textContent = tgt ? tgt.getAttribute("data-cursor") : "";
      cur.classList.toggle("label", !!tgt);
      cur.classList.toggle("big", !!e.target.closest("a, button, summary, label, [data-cursor]"));
    });
  }

  /* ================= match clock ================= */
  var clock = $("#matchClock");
  if (clock) {
    var range = $("#clockRange"), face = $("#clockFace"), timeEl = $("#clockTime"), phaseEl = $("#clockPhase"), lineEl = $("#clockLine"), playBtn = $("#clockPlay"), evs = $$(".clock-events li", clock);
    var PH = [
      { n: 1, label: "Driver 1 · driving", line: "Timer running. Driver 1 has the controller; the Loader feeds Bean Bags through the matching-color Load Zone, one at a time." },
      { n: 2, label: "Hand-off window", line: "The controller must change hands now, between 0:35 and 0:25 remaining. After the hand-off, Driver 1 can no longer touch the controls." },
      { n: 3, label: "Driver 2 · driving", line: "Driver 2 drives to the buzzer. A bag released before 0:00 still counts once it comes to rest." },
      { n: 4, label: "Buzzer · everything stops", line: "Robots and drivers stop. Scores are judged visually once everything comes to rest. No video review." }
    ];
    var fmtT = function (s) { return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
    var curPh = 0;
    function setClock(s) {
      s = Math.max(0, Math.min(60, Math.round(s)));
      range.value = s; timeEl.textContent = fmtT(s);
      var p = s > 35 ? 0 : s > 25 ? 1 : s > 0 ? 2 : 3;
      if (p !== curPh || !lineEl.textContent) { curPh = p; face.dataset.phase = PH[p].n === 4 ? 3 : PH[p].n; phaseEl.textContent = PH[p].label; lineEl.textContent = PH[p].line; evs.forEach(function (li, i) { li.classList.toggle("active", i === p); }); }
      range.setAttribute("aria-valuetext", fmtT(s) + " remaining, " + PH[p].label);
    }
    range.addEventListener("input", function () { stopClock(); setClock(+range.value); });
    var timer = null;
    function stopClock() { if (timer) { clearInterval(timer); timer = null; } playBtn.textContent = "Play 3×"; playBtn.setAttribute("aria-pressed", "false"); }
    playBtn.addEventListener("click", function () {
      if (timer) { stopClock(); return; }
      if (+range.value <= 0) setClock(60);
      playBtn.textContent = "Pause"; playBtn.setAttribute("aria-pressed", "true");
      timer = setInterval(function () { var n = +range.value - 1; setClock(n); if (n <= 0) stopClock(); }, 333);
    });
    evs.forEach(function (li) { li.addEventListener("click", function () { stopClock(); setClock(+li.dataset.at); }); li.tabIndex = 0; li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stopClock(); setClock(+li.dataset.at); } }); });
    setClock(60);
  }

  /* ================= size envelope ================= */
  var envBtn = $("#envToggle"), envRect = $("#envRect"), envLen = $("#envLen");
  if (envBtn && envRect) {
    var BASE_Y = 290, PX = 10;
    var setEnv = function (exp, animate) {
      var L = exp ? 24 : 20, attrs = { height: L * PX, y: BASE_Y - L * PX };
      envBtn.setAttribute("aria-pressed", exp ? "true" : "false"); envBtn.textContent = exp ? "Mid-Match · 24″" : "Match start · 20″";
      if (envLen) envLen.textContent = L + "″";
      if (G && animate) gsap.to(envRect, { attr: attrs, duration: 1, ease: "expo.out" }); else { envRect.setAttribute("height", attrs.height); envRect.setAttribute("y", attrs.y); }
    };
    var expanded = false;
    envBtn.addEventListener("click", function () { expanded = !expanded; setEnv(expanded, true); });
    setEnv(false, false);
    if ("IntersectionObserver" in window && !reduced) {
      var done = false;
      new IntersectionObserver(function (en) { if (en[0].isIntersecting && !done) { done = true; setTimeout(function () { expanded = true; setEnv(true, true); }, 1000); } }, { threshold: 0.5 }).observe(envBtn);
    }
  }

  /* ================= animated <details> ================= */
  document.addEventListener("click", function (e) {
    var sum = e.target.closest && e.target.closest("summary");
    if (!sum || reduced || !sum.parentElement || sum.parentElement.tagName !== "DETAILS" || !sum.parentElement.animate) return;
    var d = sum.parentElement;
    if (d.dataset.busy) { e.preventDefault(); return; }
    e.preventDefault();
    d.dataset.busy = "1"; d.style.overflow = "hidden";
    var done = function () { delete d.dataset.busy; d.style.overflow = ""; };
    var ease = "cubic-bezier(.2,.8,.2,1)";
    if (d.open) {
      var from = d.offsetHeight, to = sum.offsetHeight + (parseFloat(getComputedStyle(d).borderTopWidth) || 0) * 2;
      var a = d.animate({ height: [from + "px", to + "px"] }, { duration: 380, easing: ease });
      a.onfinish = function () { d.open = false; done(); }; a.oncancel = done;
    } else {
      var start = d.offsetHeight; d.open = true;
      var end = d.offsetHeight;
      var b = d.animate({ height: [start + "px", end + "px"] }, { duration: 460, easing: ease });
      b.onfinish = done; b.oncancel = done;
    }
  });

  /* ================= page transitions ================= */
  if (!reduced) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || a.target === "_blank" || a.hasAttribute("download")) return;
      var u; try { u = new URL(a.href, location.href); } catch (err) { return; }
      if (u.origin !== location.origin || u.pathname === location.pathname) return;
      e.preventDefault();
      try { sessionStorage.setItem("curtain", "1"); } catch (err) { /* ignore */ }
      html.classList.add("leaving");
      setTimeout(function () { location.href = u.href; }, 560);
    });
    window.addEventListener("pageshow", function (e) { if (e.persisted) html.classList.remove("leaving"); });
  }

  /* ================= reveal safety net ================= */
  setTimeout(function () { if (!html.classList.contains("motion") && !reduced) html.classList.add("js-fail"); }, 3500);
})();
