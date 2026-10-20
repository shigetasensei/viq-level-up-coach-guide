/* Hero: a scripted loop of Bean Bags landing on the Goals while the score climbs.
   Teaches the headline rules (matching colors, yellow is wild, L4 is yellow only) before a word is read. */
(function () {
  "use strict";
  var canvas = document.getElementById("heroCanvas");
  if (!canvas || !window.Field3D || !window.THREE) return;
  var THREE = window.THREE;
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var F;
  try { F = Field3D.create(canvas, { maxDpr: 1.75, shadowSize: 2048, fog: 0x0a0e1d, fogNear: 110, fogFar: 300, exposure: 1.0 }); }
  catch (e) { canvas.style.display = "none"; return; }

  var scoreEl = document.getElementById("heroScore"), noteEl = document.getElementById("heroNote"), popsEl = document.getElementById("heroPops");
  var camPos = new THREE.Vector3(-6, 24, 98), camTarget = new THREE.Vector3(2, 9, 2);
  var mouse = { x: 0, y: 0, sx: 0, sy: 0 }, scrollK = 0;

  function fit() {
    var s = F.size(); if (!s.w) return;
    var aspect = s.w / s.h, wide = aspect >= 1.15;
    var visW = wide ? 150 : 80, z = visW / (0.65 * aspect);
    z = Math.max(70, Math.min(z, 420));
    camPos.set(-z * 0.04, z * (wide ? 0.3 : 0.4), z);
    camTarget.set(2, wide ? 0 : 6, 2);
    F.scene.fog.near = z * 1.15; F.scene.fog.far = z * 3.1;
    if (wide) F.shift(0.2, 0.01); else F.shift(0, -0.26);
  }
  function onResize() { F.resize(); fit(); if (!F.isRunning()) F.renderOnce(); }
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(canvas); else window.addEventListener("resize", onResize);
  onResize();

  window.addEventListener("pointermove", function (e) { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
  function onScroll() { var h = canvas.parentElement.offsetHeight || 800; scrollK = Math.max(0, Math.min(1, window.scrollY / h)); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- script ---------- */
  var SCRIPT = [
    { t: 1.0, color: "red", target: "pyr-red-1", slot: 0, pts: 3 },
    { t: 1.9, color: "blue", target: "pyr-blue-1", slot: 1, pts: 3 },
    { t: 2.8, color: "red", target: "pyr-red-2", slot: 1, pts: 6 },
    { t: 3.7, color: "blue", target: "pyr-blue-3", slot: 2, pts: 12 },
    { t: 4.7, color: "yellow", target: "l4", slot: 0, pts: 16, note: "Yellow on L4 · only yellow scores here" },
    { t: 6.0, color: "blue", target: "pyr-red-2", slot: 3, reject: true, note: "Blue on red Pyramid · no score" },
    { t: 7.4, color: "red", target: "floor-red", slot: 0, pts: 1 },
    { t: 8.4, color: "yellow", target: "pyr-blue-2", slot: 1, pts: 6, note: "Yellow scores on either color" }
  ];
  var CYCLE = 13.2, FADE_AT = 12.2;
  var live = [], fired = 0, t0 = 0, score = 0, shown = 0, fading = false;

  function pad2(n) { return String(n).padStart(2, "0"); }
  function setScore(n, instant) {
    score = n;
    if (instant) { shown = n; scoreEl.textContent = pad2(n); return; }
  }
  function note(text) { if (noteEl) noteEl.textContent = text || " "; }

  function pop(x, y, z, text, cls) {
    if (!popsEl) return;
    var p = F.project(x, y, z); if (p.behind) return;
    var d = document.createElement("div"); d.className = "pop " + cls; d.textContent = text;
    d.style.left = p.x + "px"; d.style.top = p.y + "px"; popsEl.appendChild(d);
    var a = d.animate([{ opacity: 0, transform: "translate(-50%,-30%) scale(.7)" }, { opacity: 1, transform: "translate(-50%,-90%) scale(1)", offset: 0.25 }, { opacity: 0, transform: "translate(-50%,-170%) scale(1)" }], { duration: 1500, easing: "cubic-bezier(.2,.8,.2,1)" });
    a.onfinish = function () { d.remove(); };
  }

  function ease(k) { return 1 - Math.pow(1 - k, 3); }
  function fire(ev, now) {
    var t = F.byId[ev.target], p = F.slotPos(t, ev.slot), bag = F.makeBag(ev.color);
    var sx = p.x + (Math.random() - 0.5) * 14, sz = p.z - 16 - Math.random() * 8;
    bag.position.set(sx, p.y + 52, sz);
    bag.rotation.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    bag.scale.setScalar(0.001);
    F.bagsGroup.add(bag);
    live.push({ bag: bag, ev: ev, p: p, from: { x: sx, y: p.y + 52, z: sz }, rot: bag.rotation.clone(), t0: now, dur: 0.95, landed: false, slide: null, born: now });
  }

  function land(b, now) {
    b.landed = true; b.landT = now;
    var hex = Field3D.HEX[b.ev.color];
    F.spawnRing(b.p.x, b.p.y - 0.6, b.p.z, hex);
    if (b.ev.reject) {
      pop(b.p.x, b.p.y + 3, b.p.z, "WRONG COLOR · 0", "bad");
      var t = F.byId[b.ev.target];
      b.slide = { t0: now + 380, dur: 650, from: { x: b.p.x, y: b.p.y, z: b.p.z }, to: { x: b.p.x + 6, y: 0.75, z: t.cz + 17 } };
    } else {
      setScore(score + b.ev.pts);
      pop(b.p.x, b.p.y + 4, b.p.z, "+" + b.ev.pts, "good");
    }
    if (b.ev.note) note(b.ev.note);
  }

  function finalState() {
    SCRIPT.forEach(function (ev) {
      if (ev.reject) return;
      var t = F.byId[ev.target], p = F.slotPos(t, ev.slot), bag = F.makeBag(ev.color);
      bag.position.set(p.x, p.y, p.z); bag.rotation.y = ((ev.slot * 37 % 11) - 5) * 0.03; F.bagsGroup.add(bag);
    });
    setScore(SCRIPT.reduce(function (a, e) { return a + (e.reject ? 0 : e.pts); }, 0), true);
    note("Yellow on L4 · only yellow scores here");
  }

  function reset(now) {
    live.forEach(function (b) { F.bagsGroup.remove(b.bag); });
    live = []; fired = 0; t0 = now; fading = false; setScore(0); note("");
  }

  var camNow = new THREE.Vector3(), tgtNow = new THREE.Vector3(), started = false;
  F.onFrame(function (now, dt) {
    if (!started) { started = true; t0 = now; }
    var el = (now - t0) / 1000;
    if (!reduced) {
      while (fired < SCRIPT.length && el >= SCRIPT[fired].t) { fire(SCRIPT[fired], now); fired++; }
      for (var i = 0; i < live.length; i++) {
        var b = live[i], k = Math.min(1, (now - b.t0) / (b.dur * 1000));
        if (!b.landed) {
          var fall = k * k, travel = ease(k);
          b.bag.position.x = b.from.x + (b.p.x - b.from.x) * travel;
          b.bag.position.z = b.from.z + (b.p.z - b.from.z) * travel;
          b.bag.position.y = b.from.y + (b.p.y - b.from.y) * fall;
          b.bag.rotation.x = b.rot.x * (1 - travel); b.bag.rotation.z = b.rot.z * (1 - travel);
          b.bag.rotation.y = b.rot.y * (1 - travel) + ((b.ev.slot * 37 % 11) - 5) * 0.03 * travel;
          b.bag.scale.setScalar(Math.min(1, 0.001 + k * 6));
          if (k >= 1) land(b, now);
        } else {
          var s = (now - b.landT) / 1000;
          if (s < 0.45) { var q = s / 0.45, sq = 1 + Math.sin(q * Math.PI * 2.4) * 0.22 * (1 - q); b.bag.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); } else b.bag.scale.setScalar(1);
          if (b.slide && now > b.slide.t0) {
            var u = Math.min(1, (now - b.slide.t0) / b.slide.dur), uu = ease(u);
            b.bag.position.x = b.slide.from.x + (b.slide.to.x - b.slide.from.x) * uu;
            b.bag.position.z = b.slide.from.z + (b.slide.to.z - b.slide.from.z) * uu;
            b.bag.position.y = b.slide.to.y + (b.slide.from.y - b.slide.to.y) * (1 - u * u) + Math.sin(u * Math.PI) * 3;
            b.bag.rotation.y += dt * 4 * (1 - u);
          }
        }
      }
      if (el > FADE_AT && !fading) { fading = true; live.forEach(function (b) { b.fadeT = now; }); }
      if (fading) { live.forEach(function (b) { var q = Math.min(1, (now - b.fadeT) / 700); b.bag.scale.setScalar(Math.max(0.001, 1 - q)); }); }
      if (el > CYCLE) reset(now);
    }
    // score counter easing
    if (shown !== score) { shown += (score - shown) * Math.min(1, dt * 9); if (Math.abs(score - shown) < 0.4) shown = score; scoreEl.textContent = pad2(Math.round(shown)); }

    // camera: gentle drift + pointer parallax + scroll climb
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 3); mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 3);
    var drift = reduced ? 0 : Math.sin(now / 5200) * 3;
    camNow.set(camPos.x + mouse.sx * 14 + drift, camPos.y + mouse.sy * -7 + scrollK * 26, camPos.z - scrollK * 20);
    tgtNow.set(camTarget.x, camTarget.y + scrollK * 18, camTarget.z);
    F.camera.position.copy(camNow); F.camera.lookAt(tgtNow);
  });

  if (reduced) { finalState(); F.camera.position.copy(camPos); F.camera.lookAt(camTarget); F.renderOnce(); }

  var vis = true, inView = true;
  function sync() { if (reduced) { F.renderOnce(); return; } if (vis && inView) F.start(); else F.stop(); }
  document.addEventListener("visibilitychange", function () { vis = !document.hidden; sync(); });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { inView = en[0].isIntersecting; sync(); }, { threshold: 0.02 }).observe(canvas);
  sync();
  document.documentElement.classList.add("hero-ready");
})();
