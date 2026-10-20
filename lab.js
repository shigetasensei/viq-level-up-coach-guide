/* 3D scoring lab: a simplified teaching model of Level Up scoring (rules SC3-SC5).
   Dimensions are exaggerated for readability and the layout is not the real Field. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var wrap = $("#labCanvas");
  if (!wrap) return;
  var THREE = window.THREE, FD = window.Field3D;
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NAME = { red: "Red", blue: "Blue", yellow: "Yellow" };

  var F, controls, canvas;
  try {
    if (!THREE || !THREE.OrbitControls || !FD) throw new Error("three.js missing");
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    wrap.insertBefore(canvas, wrap.firstChild);
    F = FD.create(canvas, { fog: 0x0d1330, fogNear: 100, fogFar: 280, exposure: 1.05, maxDpr: 2, shadowSize: 2048 });
  } catch (e) {
    $("#labFallback").hidden = false;
    return;
  }
  var byId = F.byId, targets = F.targets, camera = F.camera;
  var RULE = { floor: "SC3", pyr: "SC4", l4: "SC5" };

  /* ---------------- scoring logic ---------------- */
  function evaluate(b) {
    var t = byId[b.target], rule = RULE[t.kind], c = b.color;
    if (b.touching) return { pts: 0, why: "It is still touching a robot, and a bag touching a robot never scores.", rule: rule };
    if (t.kind === "floor") {
      if (b.overhang) return { pts: 0, why: "Part of the bag extends past the Goal's boundary. It must be entirely inside.", rule: "SC3" };
      if (c !== "yellow" && c !== t.color) return { pts: 0, why: "A " + c + " bag only scores in a " + c + " Floor Goal. This one is " + t.color + ".", rule: "SC3" };
      return { pts: 1, why: "Entirely inside the Goal, and " + (c === "yellow" ? "yellow scores in either color of Floor Goal." : "its color matches the Goal."), rule: "SC3" };
    }
    if (t.kind === "pyr") {
      if (c !== "yellow" && c !== t.color) return { pts: 0, why: "A " + c + " bag only scores on a " + c + " Pyramid. This one is " + t.color + ".", rule: "SC4" };
      var sup = b.slot >= 4 ? "Supported by the bags below it, which touch L" + t.level + ", and " : "Resting on L" + t.level + ", and ";
      return { pts: t.pts, why: sup + (c === "yellow" ? "yellow scores on either color of Pyramid." : "its color matches the Pyramid."), rule: "SC4" };
    }
    if (c !== "yellow") return { pts: 0, why: "Only yellow Bean Bags score on the L4 Goal.", rule: "SC5" };
    return { pts: 16, why: (b.slot ? "Supported by the bags below it, and yellow." : "Resting on the L4 surface, and yellow."), rule: "SC5" };
  }

  /* ---------------- camera + controls ---------------- */
  controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.04; controls.minDistance = 20; controls.maxDistance = 150;
  var V = {
    overview: [[0, 50, 84], [0, 6, 4]],
    floor: [[0, 34, 58], [0, 0, 14]],
    red: [[-30, 24, 36], [-30, 5, -4]],
    blue: [[30, 24, 36], [30, 5, -4]],
    l4: [[16, 34, 28], [0, 17, 0]]
  };
  var tween = null;
  function flyTo(name) {
    var v = V[name]; if (!v) return;
    var tp = new THREE.Vector3().fromArray(v[0]), tt = new THREE.Vector3().fromArray(v[1]);
    if (reduced) { camera.position.copy(tp); controls.target.copy(tt); return; }
    tween = { t0: performance.now(), dur: 900, fp: camera.position.clone(), ft: controls.target.clone(), tp: tp, tt: tt };
  }
  function viewFor(t) { return t.kind === "floor" ? "floor" : t.kind === "l4" ? "l4" : t.color; }
  camera.position.fromArray(V.overview[0]); controls.target.fromArray(V.overview[1]);

  /* ---------------- bags ---------------- */
  var bags = [];
  function placeBag(color, targetId, opts, silent) {
    var t = byId[targetId], used = bags.filter(function (b) { return b.target === targetId; }).length;
    if (used >= t.max) return { full: true };
    var b = { color: color, target: targetId, slot: used, overhang: !!(opts.overhang && t.kind === "floor"), touching: !!opts.touching };
    b.res = evaluate(b);
    b.group = F.makeBag(color);
    if (b.touching) {
      var claw = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 5), new THREE.MeshStandardMaterial({ color: new THREE.Color(0x5b6478).convertSRGBToLinear(), transparent: true, opacity: 0.85, roughness: 0.5, metalness: 0.4 }));
      claw.position.set(FD.BAG.w / 2 + 1.2, 0.9, 0); claw.castShadow = true; b.group.add(claw);
    }
    var p = F.slotPos(t, b.slot, b.overhang);
    b.group.position.set(p.x, p.y, p.z);
    b.group.rotation.y = ((b.slot * 37 % 11) - 5) * 0.03;
    b.anim = reduced || silent ? null : { t0: performance.now(), from: p.y + 14, to: p.y, p: p };
    if (b.anim) b.group.position.y = b.anim.from;
    F.bagsGroup.add(b.group);
    bags.push(b);
    pulse(t);
    return b;
  }
  function removeBag(b) { F.bagsGroup.remove(b.group); }
  function clearBags() { bags.forEach(removeBag); bags = []; }

  /* ---------------- hover / click on 3D pads ---------------- */
  var pulses = {}, hoverId = null;
  function pulse(t) { pulses[t.id] = performance.now(); }
  function padOpacity(t, now) {
    var o = 0;
    if (hoverId === t.id) o = 0.32;
    if (pulses[t.id]) { var k = (now - pulses[t.id]) / 800; if (k < 1) o = Math.max(o, 0.55 * (1 - k)); else delete pulses[t.id]; }
    return o;
  }
  var ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), down = null;
  function pick(ev) {
    var r = canvas.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    var hit = ray.intersectObjects(F.padMeshes)[0];
    return hit ? hit.object.userData.target : null;
  }
  canvas.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", function (e) {
    if (!down) return;
    var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 5 || quiz.on) return;
    var id = pick(e); if (id) drop(id);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (down || quiz.on) return;
    var id = pick(e); hoverId = id; canvas.style.cursor = id ? "pointer" : "grab";
  });
  canvas.addEventListener("pointerleave", function () { hoverId = null; });

  F.onFrame(function (now) {
    if (tween) {
      var k = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(tween.fp, tween.tp, e);
      controls.target.lerpVectors(tween.ft, tween.tt, e);
      if (k >= 1) tween = null;
    }
    bags.forEach(function (b) {
      if (!b.anim) return;
      var k = Math.min(1, (now - b.anim.t0) / 520), e = k * k;
      b.group.position.y = b.anim.from + (b.anim.to - b.anim.from) * e;
      if (k >= 1) {
        b.anim = null; F.spawnRing(b.group.position.x, 0.2 + (b.group.position.y > 2 ? b.group.position.y - 0.7 : 0), b.group.position.z, FD.HEX[b.color]);
        b.group.scale.set(1.12, 0.78, 1.12); b.squash = now;
      }
      if (b.anim === null && b.squash === undefined) return;
    });
    bags.forEach(function (b) {
      if (b.squash) { var q = (now - b.squash) / 380; if (q >= 1) { b.group.scale.setScalar(1); b.squash = 0; } else { var s = 1 + Math.sin(q * Math.PI * 2.2) * 0.14 * (1 - q); b.group.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); } }
    });
    targets.forEach(function (t) { t.pad.material.opacity = padOpacity(t, now); });
    controls.update();
  });

  /* ---------------- visibility ---------------- */
  function onResize() { F.resize(); if (!F.isRunning()) F.renderOnce(); }
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(wrap); else window.addEventListener("resize", onResize);
  onResize();
  var vis = false;
  function sync() { if (vis && !document.hidden) F.start(); else F.stop(); }
  document.addEventListener("visibilitychange", sync);
  if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { vis = en[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(wrap); else { vis = true; sync(); }

  /* ---------------- UI: sandbox ---------------- */
  var color = "red";
  var picker = $("#bagPicker"), groupsEl = $("#targetGroups");
  var optOver = $("#optOverhang"), optTouch = $("#optTouching");
  var logEl = $("#labLog"), emptyEl = $("#labEmpty"), totalEl = $("#labTotal"), bigEl = $("#labScoreBig");

  picker.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    color = b.dataset.color;
    Array.prototype.forEach.call(picker.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
  });

  ["Floor Goals", "Red Pyramid", "Blue Pyramid", "L4 Goal"].forEach(function (gname) {
    var row = document.createElement("div"); row.className = "tg";
    var lab = document.createElement("span"); lab.textContent = gname; row.appendChild(lab);
    var bs = document.createElement("div");
    targets.filter(function (t) { return t.group === gname; }).forEach(function (t) {
      var b = document.createElement("button"); b.type = "button";
      b.textContent = gname === "Floor Goals" ? t.btn : t.btn + (t.kind === "pyr" ? " · " + t.pts : "");
      b.setAttribute("aria-label", "Drop a bean bag on the " + t.label);
      b.addEventListener("click", function () { drop(t.id); });
      bs.appendChild(b);
    });
    row.appendChild(bs); groupsEl.appendChild(row);
  });

  function drop(id) {
    var r = placeBag(color, id, { overhang: optOver.checked, touching: optTouch.checked });
    if (r.full) { emptyEl.hidden = false; emptyEl.textContent = "That Goal is full in this model (" + byId[id].max + " bags). Try another."; return; }
    renderLog();
  }
  function ruleLink(id) { var a = document.createElement("a"); a.href = "#rule-" + id; a.textContent = id; return a; }

  var shownTotal = 0;
  function setBig(n) {
    if (!bigEl) return;
    var from = shownTotal; shownTotal = n;
    if (reduced) { bigEl.textContent = n; return; }
    var t0 = performance.now();
    (function step(now) { var k = Math.min(1, (now - t0) / 500); bigEl.textContent = Math.round(from + (n - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
  }

  function renderLog() {
    logEl.textContent = "";
    var total = 0;
    bags.forEach(function (b) {
      total += b.res.pts;
      var li = document.createElement("li"); li.className = b.res.pts ? "ok" : "no";
      var tag = document.createElement("b"); tag.textContent = b.res.pts ? "✓ +" + b.res.pts : "✕ 0";
      var t = byId[b.target], txt = document.createElement("span");
      txt.appendChild(document.createTextNode(" " + NAME[b.color] + " bag on " + t.label + ". " + b.res.why + " "));
      txt.appendChild(ruleLink(b.res.rule));
      li.appendChild(tag); li.appendChild(txt); logEl.appendChild(li);
    });
    totalEl.textContent = total; setBig(total);
    emptyEl.hidden = bags.length > 0;
    emptyEl.textContent = "No Bean Bags yet. Pick a color and drop one on a Goal.";
    logEl.scrollTop = logEl.scrollHeight;
  }

  $("#labUndo").addEventListener("click", function () { var b = bags.pop(); if (b) removeBag(b); renderLog(); });
  $("#labClear").addEventListener("click", function () { clearBags(); renderLog(); });
  Array.prototype.forEach.call(document.querySelectorAll(".lab-views button"), function (b) { b.addEventListener("click", function () { flyTo(b.dataset.view); }); });

  /* ---------------- UI: quiz ---------------- */
  var quiz = { on: false, asked: 0, right: 0, answered: true, cur: null };
  var qEl = $("#quizQ"), aEl = $("#quizAnswers"), fbEl = $("#quizFeedback"), nextEl = $("#quizNext"), qsEl = $("#quizScore");
  [0, 1, 3, 6, 12, 16].forEach(function (n) {
    var b = document.createElement("button"); b.type = "button"; b.textContent = n + (n === 1 ? " pt" : " pts"); b.dataset.n = n;
    b.addEventListener("click", function () { answer(n, b); });
    aEl.appendChild(b);
  });
  function rand(a) { return a[Math.floor(Math.random() * a.length)]; }

  function newQuestion() {
    clearBags();
    var t = rand(targets), r = Math.random(), c;
    if (t.kind === "l4") c = r < 0.5 ? "yellow" : rand(["red", "blue"]);
    else c = r < 0.4 ? t.color : r < 0.7 ? "yellow" : (t.color === "red" ? "blue" : "red");
    var over = t.kind === "floor" && Math.random() < 0.25, touch = Math.random() < 0.15;
    var b = placeBag(c, t.id, { overhang: over, touching: touch }, false);
    quiz.cur = b; quiz.answered = false;
    flyTo(viewFor(t));
    var s = "A " + c + " Bean Bag " + (t.kind === "l4" ? "is resting on the L4 Goal." : t.kind === "floor" ? "is in the " + t.label + "." : "is resting on the " + t.label + " surface.");
    if (over) s += " It hangs over the Goal's border.";
    if (touch) s += " It is still touching a robot when the Match ends.";
    qEl.textContent = s + " How many points does it score?";
    fbEl.hidden = true; nextEl.hidden = true;
    totalEl.textContent = 0; setBig(0);
    Array.prototype.forEach.call(aEl.children, function (x) { x.disabled = false; x.classList.remove("right", "wrong"); });
  }

  function answer(n, btn) {
    if (quiz.answered) return;
    quiz.answered = true; quiz.asked++;
    var res = quiz.cur.res, ok = n === res.pts;
    if (ok) quiz.right++;
    Array.prototype.forEach.call(aEl.children, function (x) { x.disabled = true; if (Number(x.dataset.n) === res.pts) x.classList.add("right"); });
    if (!ok) btn.classList.add("wrong");
    fbEl.hidden = false; fbEl.className = "quiz-feedback " + (ok ? "ok" : "no"); fbEl.textContent = "";
    var h = document.createElement("b"); h.textContent = (ok ? "Correct: " : "Not quite: ") + res.pts + (res.pts === 1 ? " point. " : " points. ");
    fbEl.appendChild(h); fbEl.appendChild(document.createTextNode(res.why + " ")); fbEl.appendChild(ruleLink(res.rule));
    qsEl.textContent = "Answered " + quiz.asked + " · Correct " + quiz.right;
    setBig(res.pts);
    nextEl.hidden = false; nextEl.focus();
  }
  nextEl.addEventListener("click", newQuestion);

  /* ---------------- mode switch ---------------- */
  var mS = $("#modeSandbox"), mQ = $("#modeQuiz");
  function setMode(q) {
    quiz.on = q;
    mS.setAttribute("aria-pressed", q ? "false" : "true"); mQ.setAttribute("aria-pressed", q ? "true" : "false");
    $("#labSandbox").hidden = q; $("#labQuiz").hidden = !q;
    canvas.style.cursor = q ? "grab" : "";
    if (q) newQuestion(); else { clearBags(); renderLog(); flyTo("overview"); }
  }
  mS.addEventListener("click", function () { if (quiz.on) setMode(false); });
  mQ.addEventListener("click", function () { if (!quiz.on) setMode(true); });

  renderLog();
  placeBag("yellow", "l4", {}, true);
  placeBag("red", "pyr-red-2", {}, true);
  placeBag("blue", "pyr-blue-1", {}, true);
  renderLog();
})();
