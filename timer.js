/* Match timer: 60 s, with the calls from the Match rules.
   Teamwork / Driving Skills: hand-off window 0:35 to 0:25 (GG11). Autonomous Skills: no hand-off.
   Stop early records a Skills Stop Time (rounded up, RSC8) or a Match Stop Time (rounded down to even). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var DUR = 60;
  var KEY = "levelup-timer";
  var MODES = {
    team:  { label: "Teamwork Match",    handoff: true,  stop: "match" },
    drive: { label: "Driving Skills",    handoff: true,  stop: "skills" },
    auto:  { label: "Autonomous Skills", handoff: false, stop: "skills" }
  };
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var face = $("#tmFace"), phaseEl = $("#tmPhase"), timeEl = $("#tmTime"), callEl = $("#tmCall"), head = $("#tmHead");
  var bar = $("#tmBar"), ticks = $("#tmTicks"), goBtn = $("#tmGo"), resetBtn = $("#tmReset"), stopBtn = $("#tmStopEarly"), rec = $("#tmRecord");
  var fsBtn = $("#tmFs"), stage = $("#tmStage");
  var opt = { sound: $("#optSound"), voice: $("#optVoice"), haptic: $("#optHaptic"), lead: $("#optLead") };
  var modeBtns = Array.prototype.slice.call(document.querySelectorAll(".tm-modes button"));

  /* ---------- settings ---------- */
  var S = { mode: "team", sound: true, voice: false, haptic: true, lead: true };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved) for (var k in S) if (k in saved) S[k] = saved[k]; } catch (e) { /* ignore */ }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
  ["sound", "voice", "haptic", "lead"].forEach(function (k) {
    opt[k].checked = !!S[k];
    opt[k].addEventListener("change", function () { S[k] = opt[k].checked; persist(); if (k === "voice" && S.voice) speak("Voice calls on"); });
  });

  /* ---------- audio / voice / haptics ---------- */
  var ac = null;
  function audio() {
    if (!ac) { try { var C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } catch (e) { ac = null; } }
    if (ac && ac.state === "suspended") ac.resume();
    return ac;
  }
  function beep(freq, len, vol, delay, type) {
    if (!S.sound) return; var a = audio(); if (!a) return;
    var t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.4, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + len + 0.02);
  }
  function buzz(pattern) { if (S.haptic && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ignore */ } } }
  function speak(text) {
    if (!S.voice || !("speechSynthesis" in window)) return;
    try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = 1.05; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
  }
  var CUES = {
    lead:     function () { beep(660, 0.12, 0.35); buzz(30); },
    go:       function () { beep(990, 0.55, 0.45, 0, "square"); buzz(120); speak("Go"); },
    open:     function () { beep(740, 0.15, 0.4); beep(740, 0.15, 0.4, 0.22); buzz([80, 60, 80]); speak("Hand off now"); },
    deadline: function () { beep(520, 0.7, 0.45, 0, "triangle"); buzz(250); speak("Driver two"); },
    ten:      function () { beep(880, 0.1, 0.35); beep(880, 0.1, 0.35, 0.18); beep(880, 0.1, 0.35, 0.36); buzz([60, 40, 60, 40, 60]); speak("Ten seconds"); },
    end:      function () { beep(300, 1.4, 0.55, 0, "sawtooth"); buzz([400, 100, 400]); speak("Time"); },
    stop:     function () { beep(600, 0.25, 0.35); buzz(60); }
  };

  /* ---------- wake lock (keep the screen on while running) ---------- */
  var lock = null;
  function wake() { if ("wakeLock" in navigator && !lock) { navigator.wakeLock.request("screen").then(function (l) { lock = l; l.addEventListener("release", function () { lock = null; }); }).catch(function () { /* not allowed */ }); } }
  function unwake() { if (lock) { try { lock.release(); } catch (e) { /* ignore */ } lock = null; } }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && st === "running") wake(); });

  /* ---------- state ---------- */
  var st = "idle";            // idle | lead | running | paused | done
  var base = 0, t0 = 0, leadEnd = 0, raf = 0, fired = {}, lastLead = 4, lastText = "";

  function fmt(sec) { return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }
  function m() { return MODES[S.mode]; }
  function elapsed(now) { return st === "running" ? base + (now - t0) / 1000 : base; }
  function remaining(now) { return Math.max(0, DUR - elapsed(now)); }

  function setBarForMode() {
    var h = m().handoff;
    bar.dataset.handoff = h ? "1" : "0";
    ticks.innerHTML = h ? "<span>1:00</span><span>0:35</span><span>0:25</span><span>0:00</span>" : "<span>1:00</span><span>0:10</span><span>0:00</span>";
    ticks.dataset.handoff = h ? "1" : "0";
  }

  function phaseFor(rem) {
    var s = Math.ceil(rem);
    if (st === "idle") return { id: "ready", label: "Ready", call: m().handoff ? "Press Start. Robots stay still until the timer starts." : "Press Start. No controller: the robot runs by itself." };
    if (st === "lead") return { id: "ready", label: "Get ready", call: "Starting in a moment…" };
    if (st === "done") return { id: "done", label: "Time!", call: "Stop everything. Hands off the controllers." };
    if (m().handoff) {
      if (s > 35) return { id: "d1", label: "Driver 1 drives", call: "Driver 1 has the controller. Loader is ready." };
      if (s > 25) return { id: "swap", label: "Hand-off window", call: "Pass the controller now (before 0:25)." };
      if (s > 10) return { id: "d2", label: "Driver 2 drives", call: "Driver 1: hands off the controls." };
      return { id: "final", label: "Final 10 seconds", call: "Release your last bags before 0:00." };
    }
    if (s > 10) return { id: "auto", label: "Autonomous run", call: "Hands off! The robot runs by itself." };
    return { id: "final", label: "Final 10 seconds", call: "Keep hands off. The run ends at 0:00." };
  }

  function render(now) {
    var rem = remaining(now), sec = Math.ceil(rem), p = phaseFor(rem), text;
    if (st === "lead") { var n = Math.max(1, Math.ceil((leadEnd - now) / 1000)); text = String(n); }
    else text = fmt(st === "done" && stopInfo ? stopInfo.display : sec);
    if (text !== lastText) { timeEl.textContent = text; lastText = text; }
    face.dataset.state = st; face.dataset.phase = p.id;
    if (phaseEl.textContent !== p.label) phaseEl.textContent = p.label;
    if (callEl.textContent !== p.call) callEl.textContent = p.call;
    var frac = st === "lead" || st === "idle" ? 0 : 1 - rem / DUR;
    head.style.left = (frac * 100) + "%";
    timeEl.setAttribute("aria-label", (st === "lead" ? "Starting in " + text : fmt(sec)) + ". " + (st === "running" ? "Press to pause" : st === "paused" ? "Press to resume" : st === "done" ? "Press to reset" : "Press to start"));
  }

  function setButtons() {
    goBtn.textContent = st === "running" ? "Pause" : st === "paused" ? "Resume" : st === "done" ? "Again" : st === "lead" ? "Cancel" : "Start";
    goBtn.classList.toggle("is-running", st === "running" || st === "lead");
    stopBtn.disabled = !(st === "running" || st === "paused");
    resetBtn.disabled = st === "idle" && base === 0;
    modeBtns.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.mode === S.mode ? "true" : "false"); });
  }

  /* ---------- loop ---------- */
  function loop(now) {
    raf = 0;
    if (st === "lead") {
      var left = Math.ceil((leadEnd - now) / 1000);
      if (left !== lastLead && left >= 1) { lastLead = left; CUES.lead(); }
      if (now >= leadEnd) { begin(now); }
    } else if (st === "running") {
      var rem = remaining(now), s = Math.ceil(rem);
      if (m().handoff) {
        if (s <= 35 && !fired.open) { fired.open = 1; CUES.open(); }
        if (s <= 25 && !fired.deadline) { fired.deadline = 1; CUES.deadline(); }
      }
      if (s <= 10 && !fired.ten) { fired.ten = 1; CUES.ten(); }
      if (rem <= 0) { finish(); }
    }
    render(now);
    if (st === "lead" || st === "running") raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  /* ---------- actions ---------- */
  var stopInfo = null;
  function begin(now) { st = "running"; t0 = now; base = 0; fired = {}; CUES.go(); wake(); setButtons(); }
  function start() {
    audio();
    if (st === "done") reset();
    if (st === "idle") {
      stopInfo = null; rec.hidden = true;
      if (S.lead) { st = "lead"; leadEnd = performance.now() + 3000; lastLead = 4; }
      else { begin(performance.now()); }
    } else if (st === "paused") { st = "running"; t0 = performance.now(); wake(); }
    setButtons(); kick();
  }
  function pause() { if (st === "running") { base = elapsed(performance.now()); st = "paused"; unwake(); } else if (st === "lead") { reset(); return; } setButtons(); render(performance.now()); }
  function reset() { st = "idle"; base = 0; fired = {}; stopInfo = null; rec.hidden = true; unwake(); try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) { /* ignore */ } setButtons(); render(performance.now()); }
  function finish() { st = "done"; base = DUR; stopInfo = null; unwake(); CUES.end(); setButtons(); if (!reduced) flash(); }
  function stopEarly() {
    if (!(st === "running" || st === "paused")) return;
    var rem = remaining(performance.now()), disp = Math.ceil(rem);
    st = "done"; base = DUR - rem; unwake(); CUES.stop();
    var skills = Math.ceil(rem), match = disp - (disp % 2);
    stopInfo = { display: disp, skills: skills, match: match };
    rec.hidden = false;
    rec.innerHTML = m().stop === "skills"
      ? "<b>Skills Stop Time: " + skills + " s</b><span>Time left, rounded up to the next second. Only a tiebreaker, so it doesn't change your score. Say the signal out loud and tell the Scorekeeper Referee before the run (RSC8).</span>"
      : "<b>Match Stop Time: " + match + " s</b><span>Time left, rounded down to an even number. Only used to break a tie for first place in Finals (GG13, T14).</span>";
    setButtons(); render(performance.now());
  }
  function flash() { face.classList.remove("flash"); void face.offsetWidth; face.classList.add("flash"); }
  function setMode(mode) {
    if (!MODES[mode] || mode === S.mode) return;
    S.mode = mode; persist(); reset(); setBarForMode(); setButtons(); render(performance.now());
  }

  goBtn.addEventListener("click", function () { if (st === "running" || st === "lead") pause(); else start(); });
  timeEl.addEventListener("click", function () { if (st === "running" || st === "lead") pause(); else start(); });
  resetBtn.addEventListener("click", reset);
  stopBtn.addEventListener("click", stopEarly);
  modeBtns.forEach(function (b) { b.addEventListener("click", function () { setMode(b.dataset.mode); }); });

  /* ---------- full screen ---------- */
  if (!document.fullscreenEnabled || !stage.requestFullscreen) { fsBtn.hidden = true; }
  fsBtn.addEventListener("click", function () { if (document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen().catch(function () { /* ignore */ }); });
  document.addEventListener("fullscreenchange", function () { var on = !!document.fullscreenElement; fsBtn.textContent = on ? "Exit full screen" : "Full screen"; fsBtn.setAttribute("aria-label", fsBtn.textContent); stage.classList.toggle("is-fs", on); });

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (document.activeElement || {}).tagName;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    var k = e.key.toLowerCase();
    if (k === " " && tag !== "BUTTON" && tag !== "A") { e.preventDefault(); if (st === "running" || st === "lead") pause(); else start(); }
    else if (k === "r") reset();
    else if (k === "s") stopEarly();
    else if (k === "m") { S.sound = !S.sound; opt.sound.checked = S.sound; persist(); }
    else if (k === "f") fsBtn.click();
    else if (k === "1") setMode("team");
    else if (k === "2") setMode("drive");
    else if (k === "3") setMode("auto");
  });

  /* ---------- init ---------- */
  setBarForMode(); setButtons(); render(performance.now());
  window.__timer = { get state() { return st; }, setMode: setMode, start: start, reset: reset, stopEarly: stopEarly, _seek: function (sec) { /* test hook */ if (st === "running" || st === "paused") { base = DUR - sec; t0 = performance.now(); render(performance.now()); } } };
})();
