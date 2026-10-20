/* Field3D: shared Three.js scene for the hero and the scoring lab.
   A stylised, simplified model of the Level Up Goals (not to scale, not the real Field layout). */
window.Field3D = (function () {
  "use strict";
  var THREE = window.THREE;
  if (!THREE) return null;

  var HEX = { red: 0xff3b52, blue: 0x3a74ff, yellow: 0xffc20e };
  var SIDE = { red: 0xd42a40, blue: 0x2a5fe0 };
  var BAG = { w: 5, h: 1.5, d: 4 };
  var STEP = 3, L4Y = 22.6;
  var LEVEL_Z = { 1: 1, 2: -5, 3: -12 };
  var STRIP_D = { 1: 6, 2: 6, 3: 8 };
  var PTS = { 1: 3, 2: 6, 3: 12 };
  var NAME = { red: "Red", blue: "Blue", yellow: "Yellow" };

  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  /* ---------- targets ---------- */
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

  /* ---------- bean bag geometry: a soft, rounded pillow ---------- */
  var bagGeo;
  function bagGeometry() {
    if (bagGeo) return bagGeo;
    var g = new THREE.BoxGeometry(BAG.w, BAG.h, BAG.d, 12, 5, 10);
    var pos = g.attributes.position, nor = g.attributes.normal;
    var hx = BAG.w / 2, hy = BAG.h / 2, hz = BAG.d / 2, r = 0.62;
    var ix = hx - r, iy = hy - r, iz = hz - r;
    var v = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nor, i);
      var cx = Math.max(-ix, Math.min(ix, v.x)), cy = Math.max(-iy, Math.min(iy, v.y)), cz = Math.max(-iz, Math.min(iz, v.z));
      d.set(v.x - cx, v.y - cy, v.z - cz);
      if (d.lengthSq() > 1e-8) { d.normalize(); n.copy(d); d.multiplyScalar(r); }
      v.set(cx + d.x, cy + d.y, cz + d.z);
      var nx = v.x / hx, nz = v.z / hz, bulge = (1 - nx * nx) * (1 - nz * nz) * 0.42;
      if (Math.abs(v.y) > 0.01) v.y += (v.y > 0 ? 1 : -1) * bulge;
      pos.setXYZ(i, v.x, v.y, v.z);
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    bagGeo = g; return g;
  }

  var fabricTex;
  function fabric() {
    if (fabricTex) return fabricTex;
    var cv = document.createElement("canvas"); cv.width = cv.height = 128;
    var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 128, 128);
    for (var i = 0; i < 2600; i++) { var s = 200 + Math.random() * 55; g.fillStyle = "rgb(" + s + "," + s + "," + s + ")"; g.fillRect(Math.random() * 128, Math.random() * 128, 1.4, 1.4); }
    fabricTex = new THREE.CanvasTexture(cv); fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping; fabricTex.repeat.set(2, 2);
    return fabricTex;
  }

  function makeBag(color) {
    var g = new THREE.Group();
    var m = new THREE.Mesh(bagGeometry(), new THREE.MeshStandardMaterial({ color: lin(HEX[color]), roughness: 0.82, metalness: 0, bumpMap: fabric(), bumpScale: 0.35 }));
    m.castShadow = true; m.receiveShadow = true; g.add(m);
    g.userData.body = m;
    return g;
  }

  /* ---------- textures ---------- */
  function gridTexture(lineHex) {
    var cv = document.createElement("canvas"); cv.width = cv.height = 128;
    var g = cv.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = lineHex; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126);
    var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function radialAlpha() {
    var cv = document.createElement("canvas"); cv.width = cv.height = 256;
    var g = cv.getContext("2d"), gr = g.createRadialGradient(128, 128, 20, 128, 128, 126);
    gr.addColorStop(0, "#fff"); gr.addColorStop(0.55, "#9a9a9a"); gr.addColorStop(1, "#000");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(cv);
  }
  function labelTexture(text, fg, bg) {
    var cv = document.createElement("canvas"); cv.width = 256; cv.height = 96;
    var g = cv.getContext("2d");
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 256, 96); }
    g.fillStyle = fg; g.font = "700 64px 'DM Mono', ui-monospace, Menlo, monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 128, 52);
    var t = new THREE.CanvasTexture(cv); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
  }

  /* ---------- scene factory ---------- */
  function create(canvas, o) {
    o = o || {};
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.maxDpr || 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = o.exposure || 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var fogHex = o.fog != null ? o.fog : 0x0b0f1e;
    scene.fog = new THREE.Fog(lin(fogHex), o.fogNear || 90, o.fogFar || 260);
    var camera = new THREE.PerspectiveCamera(o.fov || 36, 1, 1, 600);

    /* lights */
    scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x1a1f38, 0.55));
    var key = new THREE.DirectionalLight(0xfff1dd, 1.5);
    key.position.set(-46, 90, 58); key.castShadow = true;
    key.shadow.mapSize.set(o.shadowSize || 2048, o.shadowSize || 2048);
    var sc = key.shadow.camera; sc.left = -80; sc.right = 80; sc.top = 60; sc.bottom = -60; sc.near = 10; sc.far = 260;
    key.shadow.bias = -0.0004; key.shadow.radius = 4;
    scene.add(key);
    var rimA = new THREE.DirectionalLight(0x5b8bff, 0.9); rimA.position.set(70, 40, -60); scene.add(rimA);
    var rimB = new THREE.DirectionalLight(0xff8a4d, 0.5); rimB.position.set(-70, 30, -50); scene.add(rimB);

    /* ground */
    var gridTex = gridTexture(o.gridLine || "rgba(120,150,255,0.55)");
    gridTex.repeat.set(24, 24);
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(288, 288),
      new THREE.MeshBasicMaterial({ map: gridTex, alphaMap: radialAlpha(), transparent: true, depthWrite: false, opacity: o.gridOpacity != null ? o.gridOpacity : 0.55 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0.02; scene.add(ground);
    var floorFill = new THREE.Mesh(new THREE.CircleGeometry(112, 96), new THREE.MeshBasicMaterial({ color: lin(o.floorFill || 0x10173a), transparent: true, opacity: 0.0, depthWrite: false }));
    floorFill.rotation.x = -Math.PI / 2; floorFill.position.y = 0.0; scene.add(floorFill);
    var shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(220, 160), new THREE.ShadowMaterial({ opacity: 0.55 }));
    shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = 0.04; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);

    var padMeshes = [];

    function stdMat(hex, extra) {
      var o = Object.assign({ roughness: 0.55, metalness: 0.08 }, extra || {});
      o.color = lin(hex); if (typeof o.emissive === "number") o.emissive = lin(o.emissive);
      return new THREE.MeshStandardMaterial(o);
    }
    function box(w, h, d, x, y, z, mats, shadow) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
      m.position.set(x, y, z); m.castShadow = shadow !== false; m.receiveShadow = true; scene.add(m); return m;
    }
    function decal(text, fg, w, h, x, y, z, rotY, rotX) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: labelTexture(text, fg), transparent: true, depthWrite: false }));
      m.position.set(x, y, z); if (rotY) m.rotation.y = rotY; if (rotX) m.rotation.x = rotX; scene.add(m); return m;
    }
    function pad(t, w, h, d, x, y, z) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      m.position.set(x, y, z); m.userData.target = t.id; t.pad = m; scene.add(m); padMeshes.push(m);
    }

    var TOP = 0xc9cfe3;
    targets.forEach(function (t) {
      var side = t.color, hex = side ? SIDE[side] : 0;
      if (t.kind === "floor") {
        box(22, 0.16, 10, t.cx, 0.09, t.cz, stdMat(HEX[side], { transparent: true, opacity: 0.32, roughness: 0.4, emissive: HEX[side], emissiveIntensity: 0.25 }), false);
        [[22, 0.7, 0.7, 0, -5], [22, 0.7, 0.7, 0, 5], [0.7, 0.7, 10, -11, 0], [0.7, 0.7, 10, 11, 0]].forEach(function (b) {
          box(b[0], b[1], b[2], t.cx + b[3], 0.35, t.cz + b[4], stdMat(hex, { emissive: hex, emissiveIntensity: 0.18 }), false);
        });
        pad(t, 22, 0.3, 10, t.cx, 0.2, t.cz);
      } else if (t.kind === "pyr") {
        var n = t.level, d = 20 - (n === 1 ? 0 : n === 2 ? 6 : 12), zBack = -16;
        var mats = [stdMat(hex), stdMat(hex), stdMat(TOP, { roughness: 0.45 }), stdMat(hex), stdMat(hex), stdMat(hex)];
        box(22, STEP, d, t.cx, (n - 1) * STEP + STEP / 2, zBack + d / 2, mats);
        pad(t, 22, 0.3, STRIP_D[n], t.cx, n * STEP + 0.2, t.cz);
        // label on the riser, facing the camera
        var rz = zBack + d + 0.02;
        decal("L" + n, "#f7f4ea", 6.4, 2.4, t.cx + (side === "red" ? -7.5 : 7.5), (n - 1) * STEP + STEP / 2, rz, 0, 0);
      }
    });

    // L4 goal
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, L4Y, 20), stdMat(0x7d86a3, { roughness: 0.35, metalness: 0.5 }));
    pole.position.set(0, L4Y / 2, 0); pole.castShadow = true; scene.add(pole);
    var plat = box(11, 0.6, 9, 0, L4Y - 0.3, 0, stdMat(TOP, { roughness: 0.4 }));
    [[11, 0.9, 0.5, 0, -4.5], [11, 0.9, 0.5, 0, 4.5], [0.5, 0.9, 9, -5.5, 0], [0.5, 0.9, 9, 5.5, 0]].forEach(function (b) {
      box(b[0], b[1], b[2], b[3], L4Y - 0.1, b[4], stdMat(HEX.yellow, { emissive: HEX.yellow, emissiveIntensity: 0.35 }), false);
    });
    pad(byId.l4, 11, 0.3, 9, 0, L4Y + 0.2, 0);
    decal("L4", "#ffc20e", 6.4, 2.4, 0, L4Y - 3.2, 4.6, 0, 0).material.opacity = 0;
    var halo = new THREE.Mesh(new THREE.RingGeometry(6.4, 7.0, 64), new THREE.MeshBasicMaterial({ color: lin(HEX.yellow), transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = L4Y + 0.05; scene.add(halo);

    var bagsGroup = new THREE.Group(); scene.add(bagsGroup);
    var fxGroup = new THREE.Group(); scene.add(fxGroup);

    /* ---------- loop ---------- */
    var cbs = [], raf = 0, running = false, last = 0, W = 1, H = 1, viewShift = { x: 0, y: 0 };
    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      W = w; H = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (viewShift.x || viewShift.y) camera.setViewOffset(w, h, -w * viewShift.x, -h * viewShift.y, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
    function shift(x, y) { viewShift.x = x; viewShift.y = y; resize(); }
    function frame(now) {
      raf = 0; if (!running) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      for (var i = 0; i < cbs.length; i++) cbs[i](now, dt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    function renderOnce() { for (var i = 0; i < cbs.length; i++) cbs[i](performance.now(), 0); renderer.render(scene, camera); }

    function spawnRing(x, y, z, hex) {
      var m = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.7, 48), new THREE.MeshBasicMaterial({ color: lin(hex), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); fxGroup.add(m);
      var t0 = performance.now();
      cbs.push(function ring(now) {
        var k = (now - t0) / 800;
        if (k >= 1) { fxGroup.remove(m); m.geometry.dispose(); m.material.dispose(); var i = cbs.indexOf(ring); if (i > -1) cbs.splice(i, 1); return; }
        var e = 1 - Math.pow(1 - k, 3); m.scale.setScalar(1 + e * 3.2); m.material.opacity = 0.9 * (1 - k);
      });
    }

    var vec = new THREE.Vector3();
    function project(x, y, z) { vec.set(x, y, z).project(camera); return { x: (vec.x * 0.5 + 0.5) * W, y: (-vec.y * 0.5 + 0.5) * H, behind: vec.z > 1 }; }

    return {
      THREE: THREE, renderer: renderer, scene: scene, camera: camera, canvas: canvas,
      targets: targets, byId: byId, padMeshes: padMeshes, bagsGroup: bagsGroup, fxGroup: fxGroup,
      slotPos: slotPos, makeBag: makeBag, resize: resize, shift: shift, start: start, stop: stop, renderOnce: renderOnce,
      onFrame: function (fn) { cbs.push(fn); }, spawnRing: spawnRing, project: project,
      isRunning: function () { return running; }, size: function () { return { w: W, h: H }; }
    };
  }

  return { create: create, targets: targets, byId: byId, HEX: HEX, BAG: BAG, NAME: NAME, slotPos: slotPos, L4Y: L4Y };
})();
