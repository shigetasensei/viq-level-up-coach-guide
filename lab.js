/* 3D scoring lab: a simplified teaching model of Level Up scoring (rules SC3-SC5).
   Dimensions are exaggerated for readability and the layout is not the real Field. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var wrap = $("#labCanvas");
  if (!wrap) return;
  var THREE = window.THREE;
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- model ---------------- */
  var HEX = { red: 0xd0293c, blue: 0x1f5fbf, yellow: 0xf2b705 };
  var NAME = { red: "Red", blue: "Blue", yellow: "Yellow" };
  var BAG = { w: 5, h: 1.4, d: 4 };
  var STEP = 3, L4Y = 22.6;
  var LEVEL_Z = { 1: 1, 2: -5, 3: -12 };          // centre of each exposed strip
  var STRIP_D = { 1: 6, 2: 6, 3: 8 };
  var PTS = { 1: 3, 2: 6, 3: 12 };

  var targets = [], byId = {};
  function add(t) { targets.push(t); byId[t.id] = t; }
  ["red", "blue"].forEach(function (side) {
    var cx = side === "red" ? -30 : 30, S = NAME[side];
    add({ id: "floor-" + side, label: S + " Floor Goal", group: "Floor Goals", btn: S + " Floor", kind: "floor", color: side, cx: cx, cz: 16, max: 8, pts: 1 });
    [1, 2, 3].forEach(function (n) {
      add({ id: "pyr-" + side + "-" + n, label: S + " Pyramid L" + n, group: S + " Pyramid", btn: "L" + n, kind: "pyr", level: n, color: side, cx: cx, cz: LEVEL_Z[n], y: n * STEP, max: 8, pts: PTS[n] });
    });
  });
  add({ id: "l4", label: "L4 Goal", group: "L4 Goal", btn: "L4", kind: "l4", cx: 0, cz: 0, y: L4Y, max: 6, pts: 16 });

  function slotPos(t, slot, overhang) {
    if (t.kind === "floor") {
      var col = slot % 4, row = Math.floor(slot / 4) % 2;
      return { x: t.cx - 7.5 + col * 5, y: BAG.h / 2, z: overhang ? t.cz + 5 : t.cz - 2 + row * 4 };
    }
    if (t.kind === "pyr") {
      return { x: t.cx - 7.5 + (slot % 4) * 5, y: t.y + BAG.h / 2 + Math.floor(slot / 4) * BAG.h, z: t.cz };
    }
    return { x: (slot % 2 ? 0.5 : -0.5), y: L4Y + BAG.h / 2 + slot * BAG.h, z: 0 };
  }

  var RULE = { floor: "SC3", pyr: "SC4", l4: "SC5" };

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

  /* ---------------- scene ---------------- */
  var renderer, scene, camera, controls, bagsGroup, padGroup, padMeshes = [];
  try {
    if (!THREE || !THREE.OrbitControls) throw new Error("three.js missing");
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    $("#labFallback").hidden = false;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  var canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;";
  wrap.appendChild(canvas);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 1, 400);
  controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.minDistance = 20;
  controls.maxDistance = 150;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7290, 0.5));
  var sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(-40, 80, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  var sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 50; sc.bottom = -50; sc.near = 10; sc.far = 220;
  scene.add(sun);

  var dark = window.matchMedia && matchMedia("(prefers-color-scheme: dark)");
  var floorMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  var gridMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 });
  function theme() {
    var d = dark && dark.matches;
    floorMat.color.set(d ? 0x2a3352 : 0xd9d2c0);
    gridMat.color.set(d ? 0x56628c : 0xa59d86);
  }
  theme();
  if (dark && dark.addEventListener) dark.addEventListener("change", theme);

  var floor = new THREE.Mesh(new THREE.PlaneGeometry(108, 72), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);
  var grid = new THREE.GridHelper(108, 9, 0x000000, 0x000000);
  grid.material = gridMat; grid.scale.z = 72 / 108; grid.position.y = 0.02;
  scene.add(grid);

  function mat(hex, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.7 }, o || {})); }
  var GRAY = 0xb9bcc4;

  function box(w, h, d, x, y, z, mats, shadow) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    m.position.set(x, y, z); m.castShadow = shadow !== false; m.receiveShadow = true;
    scene.add(m); return m;
  }

  function label(text, x, y, z, w) {
    var cv = document.createElement("canvas"); cv.width = 256; cv.height = 80;
    var g = cv.getContext("2d");
    g.fillStyle = "rgba(255,255,255,.94)"; g.strokeStyle = "rgba(20,33,61,.9)"; g.lineWidth = 4;
    g.beginPath(); (g.roundRect ? g.roundRect(4, 4, 248, 72, 16) : g.rect(4, 4, 248, 72)); g.fill(); g.stroke();
    g.fillStyle = "#14213d"; g.font = "700 38px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 128, 42);
    var tex = new THREE.CanvasTexture(cv);
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    s.position.set(x, y, z); s.scale.set(w || 9, (w || 9) * 80 / 256, 1); s.renderOrder = 10;
    scene.add(s); return s;
  }

  function pad(t, w, h, d, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(x, y, z); m.userData.target = t.id; t.pad = m;
    scene.add(m); padMeshes.push(m);
  }

  targets.forEach(function (t) {
    var side = t.color, hex = side ? HEX[side] : 0;
    if (t.kind === "floor") {
      box(22, 0.15, 10, t.cx, 0.08, t.cz, mat(hex, { transparent: true, opacity: 0.38 }), false);
      [[22, 0.5, 0.6, 0, -5], [22, 0.5, 0.6, 0, 5], [0.6, 0.5, 10, -11, 0], [0.6, 0.5, 10, 11, 0]].forEach(function (b) {
        box(b[0], b[1], b[2], t.cx + b[3], 0.3, t.cz + b[4], mat(hex), false);
      });
      pad(t, 22, 0.3, 10, t.cx, 0.2, t.cz);
      label("Floor · 1 pt", t.cx, 5, t.cz + 1, 11);
    } else if (t.kind === "pyr") {
      var n = t.level, depthFull = 20 - (n === 1 ? 0 : n === 2 ? 6 : 12);   // 20, 14, 8
      var zBack = -16, d = depthFull;
      var mats = [mat(hex), mat(hex), mat(GRAY), mat(hex), mat(hex), mat(hex)];
      box(22, STEP, d, t.cx, (n - 1) * STEP + STEP / 2, zBack + d / 2, mats);
      pad(t, 22, 0.3, STRIP_D[n], t.cx, n * STEP + 0.2, t.cz);
      label("L" + n + " · " + t.pts + " pts", t.cx + (side === "red" ? -17 : 17), n * STEP + 1.5, t.cz, 10);
    }
  });

  // L4 goal
  var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, L4Y, 16), mat(0x6b7280));
  pole.position.set(0, L4Y / 2, 0); pole.castShadow = true; scene.add(pole);
  box(11, 0.6, 9, 0, L4Y - 0.3, 0, [mat(GRAY), mat(GRAY), mat(GRAY), mat(GRAY), mat(GRAY), mat(GRAY)]);
  pad(byId.l4, 11, 0.3, 9, 0, L4Y + 0.2, 0);
  label("L4 · 16 pts", 0, L4Y + 7, 0, 10);

  bagsGroup = new THREE.Group(); scene.add(bagsGroup);

  /* ---------------- bags ---------------- */
  var bags = [];            // {color,target,slot,overhang,touching,group,res,anim}
  var bagGeo = new THREE.BoxGeometry(BAG.w, BAG.h, BAG.d);
  var edgeGeo = new THREE.EdgesGeometry(bagGeo);
  var edgeMat = new THREE.LineBasicMaterial({ color: 0x14213d, transparent: true, opacity: 0.55 });

  function makeBagMesh(b) {
    var g = new THREE.Group();
    var m = new THREE.Mesh(bagGeo, mat(HEX[b.color], { roughness: 0.85 }));
    m.castShadow = true; m.receiveShadow = true; g.add(m);
    g.add(new THREE.LineSegments(edgeGeo, edgeMat));
    if (b.touching) {
      var claw = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 5),
        new THREE.MeshStandardMaterial({ color: 0x4b5563, transparent: true, opacity: 0.8 }));
      claw.position.set(BAG.w / 2 + 1.1, 0.9, 0); claw.castShadow = true; g.add(claw);
    }
    return g;
  }

  function placeBag(color, targetId, opts, silent) {
    var t = byId[targetId], used = bags.filter(function (b) { return b.target === targetId; }).length;
    if (used >= t.max) return { full: true };
    var b = { color: color, target: targetId, slot: used, overhang: !!(opts.overhang && t.kind === "floor"), touching: !!opts.touching };
    b.res = evaluate(b);
    b.group = makeBagMesh(b);
    var p = slotPos(t, b.slot, b.overhang);
    b.group.position.set(p.x, p.y, p.z);
    b.group.rotation.y = ((b.slot * 37 % 11) - 5) * 0.02;
    b.anim = reduced || silent ? null : { t0: performance.now(), from: p.y + 12, to: p.y };
    if (b.anim) b.group.position.y = b.anim.from;
    bagsGroup.add(b.group);
    bags.push(b);
    pulse(t);
    return b;
  }

  function removeBag(b) {
    bagsGroup.remove(b.group);
    b.group.traverse(function (o) { if (o.material && o.material !== edgeMat) o.material.dispose(); });
  }
  function clearBags() { bags.forEach(removeBag); bags = []; }

  /* ---------------- camera views ---------------- */
  var V = {
    overview: [[0, 52, 82], [0, 4, 2]],
    floor:    [[0, 34, 58], [0, 0, 14]],
    red:      [[-30, 24, 36], [-30, 5, -4]],
    blue:     [[30, 24, 36], [30, 5, -4]],
    l4:       [[16, 34, 28], [0, 17, 0]]
  };
  var tween = null;
  function flyTo(name) {
    var v = V[name]; if (!v) return;
    var to = { p: new THREE.Vector3().fromArray(v[0]), t: new THREE.Vector3().fromArray(v[1]) };
    if (reduced) { camera.position.copy(to.p); controls.target.copy(to.t); return; }
    tween = { t0: performance.now(), dur: 700, fp: camera.position.clone(), ft: controls.target.clone(), tp: to.p, tt: to.t };
  }
  function viewFor(t) { return t.kind === "floor" ? "floor" : t.kind === "l4" ? "l4" : t.color; }
  camera.position.fromArray(V.overview[0]); controls.target.fromArray(V.overview[1]);

  /* ---------------- hover / click on 3D pads ---------------- */
  var pulses = {}, hoverId = null;
  function pulse(t) { pulses[t.id] = performance.now(); }
  function padOpacity(t, now) {
    var o = 0;
    if (hoverId === t.id) o = 0.3;
    if (pulses[t.id]) { var k = (now - pulses[t.id]) / 700; if (k < 1) o = Math.max(o, 0.5 * (1 - k)); else delete pulses[t.id]; }
    return o;
  }

  var ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), down = null;
  function pick(ev) {
    var r = canvas.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    var hit = ray.intersectObjects(padMeshes)[0];
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
    if (down || quiz.on) { return; }
    var id = pick(e); hoverId = id; canvas.style.cursor = id ? "pointer" : "grab";
  });
  canvas.addEventListener("pointerleave", function () { hoverId = null; });

  /* ---------------- render loop (only while visible) ---------------- */
  function resize() {
    var w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap); else window.addEventListener("resize", resize);
  resize();

  var visible = false, raf = 0;
  function frame(now) {
    raf = 0; if (!visible) return;
    if (tween) {
      var k = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(tween.fp, tween.tp, e);
      controls.target.lerpVectors(tween.ft, tween.tt, e);
      if (k >= 1) tween = null;
    }
    bags.forEach(function (b) {
      if (!b.anim) return;
      var k = Math.min(1, (now - b.anim.t0) / 380), e = 1 - Math.pow(1 - k, 3);
      b.group.position.y = b.anim.from + (b.anim.to - b.anim.from) * e;
      if (k >= 1) b.anim = null;
    });
    targets.forEach(function (t) { t.pad.material.opacity = padOpacity(t, now); });
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); }).observe(wrap);
  } else { visible = true; start(); }

  /* ---------------- UI: sandbox ---------------- */
  var color = "red";
  var picker = $("#bagPicker"), groupsEl = $("#targetGroups");
  var optOver = $("#optOverhang"), optTouch = $("#optTouching");
  var logEl = $("#labLog"), emptyEl = $("#labEmpty"), totalEl = $("#labTotal");

  picker.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    color = b.dataset.color;
    Array.prototype.forEach.call(picker.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
  });

  var order = ["Floor Goals", "Red Pyramid", "Blue Pyramid", "L4 Goal"];
  order.forEach(function (gname) {
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

  function ruleLink(id) {
    var a = document.createElement("a"); a.href = "#rule-" + id; a.textContent = id; return a;
  }

  function renderLog() {
    logEl.textContent = "";
    var total = 0;
    bags.forEach(function (b) {
      total += b.res.pts;
      var li = document.createElement("li"); li.className = b.res.pts ? "ok" : "no";
      var tag = document.createElement("b"); tag.textContent = b.res.pts ? "✓ +" + b.res.pts : "✕ 0";
      var t = byId[b.target];
      var txt = document.createElement("span");
      txt.appendChild(document.createTextNode(" " + NAME[b.color] + " bag on " + t.label + ". " + b.res.why + " "));
      txt.appendChild(ruleLink(b.res.rule));
      li.appendChild(tag); li.appendChild(txt); logEl.appendChild(li);
    });
    totalEl.textContent = total;
    emptyEl.hidden = bags.length > 0;
    emptyEl.textContent = "No Bean Bags yet. Pick a color and drop one on a Goal.";
    logEl.scrollTop = logEl.scrollHeight;
  }

  $("#labUndo").addEventListener("click", function () {
    var b = bags.pop(); if (b) removeBag(b); renderLog();
  });
  $("#labClear").addEventListener("click", function () { clearBags(); renderLog(); });

  Array.prototype.forEach.call(document.querySelectorAll(".lab-views button"), function (b) {
    b.addEventListener("click", function () { flyTo(b.dataset.view); });
  });

  /* ---------------- UI: quiz ---------------- */
  var quiz = { on: false, asked: 0, right: 0, answered: true, cur: null };
  var qEl = $("#quizQ"), aEl = $("#quizAnswers"), fbEl = $("#quizFeedback"), nextEl = $("#quizNext"), qsEl = $("#quizScore");
  var OPTIONS = [0, 1, 3, 6, 12, 16];
  OPTIONS.forEach(function (n) {
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
    var over = t.kind === "floor" && Math.random() < 0.25;
    var touch = Math.random() < 0.15;
    var b = placeBag(c, t.id, { overhang: over, touching: touch }, false);
    quiz.cur = b; quiz.answered = false;
    flyTo(viewFor(t));
    var s = "A " + c + " Bean Bag " + (t.kind === "l4" ? "is resting on the L4 Goal." : t.kind === "floor" ? "is in the " + t.label + "." : "is resting on the " + t.label + " surface.");
    if (over) s += " It hangs over the Goal's border.";
    if (touch) s += " It is still touching a robot when the Match ends.";
    qEl.textContent = s + " How many points does it score?";
    fbEl.hidden = true; nextEl.hidden = true;
    Array.prototype.forEach.call(aEl.children, function (x) { x.disabled = false; x.classList.remove("right", "wrong"); });
  }

  function answer(n, btn) {
    if (quiz.answered) return;
    quiz.answered = true; quiz.asked++;
    var res = quiz.cur.res, ok = n === res.pts;
    if (ok) quiz.right++;
    Array.prototype.forEach.call(aEl.children, function (x) {
      x.disabled = true;
      if (Number(x.dataset.n) === res.pts) x.classList.add("right");
    });
    if (!ok) btn.classList.add("wrong");
    fbEl.hidden = false; fbEl.className = "quiz-feedback " + (ok ? "ok" : "no");
    fbEl.textContent = "";
    var h = document.createElement("b"); h.textContent = (ok ? "Correct: " : "Not quite: ") + res.pts + (res.pts === 1 ? " point. " : " points. ");
    fbEl.appendChild(h); fbEl.appendChild(document.createTextNode(res.why + " ")); fbEl.appendChild(ruleLink(res.rule));
    qsEl.textContent = "Answered " + quiz.asked + " · Correct " + quiz.right;
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
    if (q) { newQuestion(); } else { clearBags(); renderLog(); flyTo("overview"); }
  }
  mS.addEventListener("click", function () { if (quiz.on) setMode(false); });
  mQ.addEventListener("click", function () { if (!quiz.on) setMode(true); });

  renderLog();
  // starter bags so the model isn't empty on first look
  placeBag("yellow", "l4", {}, true);
  placeBag("red", "pyr-red-2", {}, true);
  renderLog();
})();
