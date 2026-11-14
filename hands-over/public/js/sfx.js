// ============================================================
// MAIN MORTE — Ambiance sonore et voix du présentateur
// Fond de plateau télé, ronflement de néon, public lointain, battement de cœur, bruitages d'épreuves.
// Tout est synthétisé, aucun fichier audio à charger.
// ============================================================
(function () {
  const A = { mode: "babil" };
  let ctx = null, master = null, amb = null, ambGain = null, heartNext = 0, sizzle = null, duckUntil = 0, wantAmb = 0, enabled = () => true;
  try { A.mode = localStorage.getItem("ho.voice") || "babil"; } catch (e) { /* rien */ }
  A.setEnabled = (fn) => { enabled = fn; };
  function ac() {
    if (!enabled()) return null;
    try { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination); } if (ctx.state === "suspended") ctx.resume(); return ctx; } catch (e) { return null; }
  }
  // le navigateur n'autorise le son qu'après un geste
  ["pointerdown", "keydown"].forEach((ev) => window.addEventListener(ev, () => { if (enabled()) ac(); }, { passive: true }));
  function noiseBuf(c, sec) { const n = Math.floor(c.sampleRate * sec); const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  function env(g, t0, a, peak, d) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
  function osc(type, f, t0, dur, vol, slide, dest) { const c = ctx; const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur); env(g, t0, 0.008, vol, dur); o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.05); return o; }
  function burst(t0, dur, vol, type, freq, q) { const c = ctx; const s = c.createBufferSource(); s.buffer = noiseBuf(c, dur + 0.05); const f = c.createBiquadFilter(); f.type = type || "lowpass"; f.frequency.value = freq || 1200; if (q) f.Q.value = q; const g = c.createGain(); env(g, t0, 0.005, vol, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.05); }

  // ---------- fond de plateau ----------
  function buildAmb() {
    const c = ctx; ambGain = c.createGain(); ambGain.gain.value = 0; ambGain.connect(master);
    // ronflement de néon, 100 Hz et ses harmoniques, avec un léger grésillement
    const hum = c.createOscillator(); hum.type = "sawtooth"; hum.frequency.value = 100; const hf = c.createBiquadFilter(); hf.type = "lowpass"; hf.frequency.value = 420; const hg = c.createGain(); hg.gain.value = 0.05; hum.connect(hf); hf.connect(hg); hg.connect(ambGain); hum.start();
    // public lointain, un bruit filtré qui respire
    const crowd = c.createBufferSource(); crowd.buffer = noiseBuf(c, 4); crowd.loop = true; const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = 0.7; const cg = c.createGain(); cg.gain.value = 0.11; crowd.connect(bp); bp.connect(cg); cg.connect(ambGain); crowd.start();
    const lfo = c.createOscillator(); lfo.frequency.value = 0.13; const lg = c.createGain(); lg.gain.value = 0.05; lfo.connect(lg); lg.connect(cg.gain); lfo.start();
    // nappe grave et inquiétante
    const drone = c.createOscillator(); drone.type = "triangle"; drone.frequency.value = 49; const dg = c.createGain(); dg.gain.value = 0.07; drone.connect(dg); dg.connect(ambGain); drone.start();
    const drone2 = c.createOscillator(); drone2.type = "sine"; drone2.frequency.value = 73.6; const dg2 = c.createGain(); dg2.gain.value = 0.035; drone2.connect(dg2); dg2.connect(ambGain); drone2.start();
    amb = { hum, crowd, drone };
  }
  A.ambience = function (level) { wantAmb = level || 0; };
  // silence total, juste avant le verdict
  A.silence = function (ms) { duckUntil = performance.now() + (ms || 1100); };

  // ---------- appelé à chaque image ----------
  // tension de 0 à 1, cœur actif si sa main est en jeu
  A.update = function (o) {
    if (!o) { if (ctx && ambGain) ambGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2); if (sizzle) { try { sizzle.s.stop(); } catch (e) { /* rien */ } sizzle = null; } return; }
    const c = ac(); if (!c) { if (ctx && master) master.gain.value = 0; return; } master.gain.value = 0.9;
    if (!amb) buildAmb(); const now = performance.now(); const quiet = now < duckUntil;
    const target = quiet ? 0 : wantAmb * 0.9; ambGain.gain.setTargetAtTime(target, c.currentTime, quiet ? 0.04 : 0.6);
    const tension = o && o.tension ? o.tension : 0;
    if (o && o.heart && !quiet) {
      const bpm = 64 + tension * 92; const iv = 60 / bpm;
      if (heartNext < c.currentTime) heartNext = c.currentTime + 0.05;
      if (heartNext < c.currentTime + 0.15) { const t0 = heartNext; const v = 0.14 + tension * 0.2; osc("sine", 95, t0, 0.12, v, 48); burst(t0, 0.07, v * 0.9, "lowpass", 280); osc("sine", 85, t0 + 0.17, 0.11, v * 0.7, 45); burst(t0 + 0.17, 0.06, v * 0.6, "lowpass", 260); heartNext += iv; }
    } else heartNext = 0;
    // grésillement de la mèche
    const sz = o && o.sizzle ? o.sizzle : 0;
    if (sz > 0 && !quiet) {
      if (!sizzle) { const s = c.createBufferSource(); s.buffer = noiseBuf(c, 2); s.loop = true; const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 2600; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); sizzle = { s, g, f, crack: 0 }; }
      sizzle.g.gain.setTargetAtTime(0.05 + sz * 0.1, c.currentTime, 0.05); sizzle.f.frequency.setTargetAtTime(2400 + sz * 2600, c.currentTime, 0.1);
      sizzle.crack -= 1 / 60; if (sizzle.crack <= 0) { sizzle.crack = 0.25 - sz * 0.2 + Math.random() * 0.15; burst(c.currentTime, 0.02, 0.12 + sz * 0.15, "highpass", 3000); }
    } else if (sizzle) { try { sizzle.s.stop(); } catch (e) { /* rien */ } sizzle = null; }
  };

  // ---------- bruitages ----------
  const S = {};
  S.bell = (k) => { const f = [523.3, 659.3, 784, 1046.5][k] || 600; const t0 = ctx.currentTime; osc("sine", f, t0, 1.2, 0.18); osc("sine", f * 2.76, t0, 0.5, 0.06); osc("sine", f * 5.4, t0, 0.22, 0.03); };
  S.chop = () => { const t0 = ctx.currentTime; burst(t0, 0.18, 0.5, "lowpass", 900); osc("square", 90, t0, 0.2, 0.25, 40); };
  S.stinger = () => { const t0 = ctx.currentTime; [130.8, 155.6, 185, 207.7].forEach((f, i) => osc("sawtooth", f, t0 + i * 0.03, 1.3, 0.06, f * 0.94)); burst(t0, 0.5, 0.2, "lowpass", 400); };
  S.relief = () => { const t0 = ctx.currentTime; [392, 523, 659].forEach((f, i) => osc("triangle", f, t0 + i * 0.09, 0.4, 0.09)); };
  S.slam = () => { const t0 = ctx.currentTime; burst(t0, 0.25, 0.55, "lowpass", 500); osc("sine", 70, t0, 0.3, 0.4, 35); };
  S.whoosh = () => { const t0 = ctx.currentTime; burst(t0, 0.25, 0.18, "bandpass", 900, 0.8); };
  S.knife = (ok) => { const t0 = ctx.currentTime; if (ok) { osc("square", 1800, t0, 0.04, 0.05, 1200); burst(t0, 0.05, 0.25, "highpass", 2500); } else { burst(t0, 0.25, 0.4, "lowpass", 1400); osc("sawtooth", 300, t0, 0.35, 0.14, 80); } };
  S.tickBeat = (hi) => { osc("triangle", hi ? 1320 : 990, ctx.currentTime, 0.04, 0.05); };
  S.ratchet = () => { const t0 = ctx.currentTime; burst(t0, 0.03, 0.25, "bandpass", 2200, 3); osc("square", 180, t0, 0.03, 0.05); };
  S.crush = () => { const t0 = ctx.currentTime; for (let i = 0; i < 5; i++) burst(t0 + i * 0.03, 0.08, 0.35, "lowpass", 1600 - i * 200); osc("sawtooth", 110, t0, 0.5, 0.2, 40); };
  S.boom = () => { const t0 = ctx.currentTime; burst(t0, 1.4, 0.9, "lowpass", 700); osc("sine", 60, t0, 1.0, 0.6, 28); burst(t0 + 0.05, 0.6, 0.3, "highpass", 1500); };
  S.fizzle = () => { burst(ctx.currentTime, 0.5, 0.12, "highpass", 3500); };
  S.buzz = () => { const t0 = ctx.currentTime; osc("sawtooth", 150, t0, 0.35, 0.18); osc("square", 151.5, t0, 0.35, 0.1); };
  S.pluck = () => { const t0 = ctx.currentTime; osc("triangle", 880, t0, 0.12, 0.1, 1320); osc("triangle", 1320, t0 + 0.07, 0.15, 0.08); };
  S.bite = () => { const t0 = ctx.currentTime; burst(t0, 0.12, 0.5, "lowpass", 2400); osc("sawtooth", 120, t0, 0.3, 0.2, 40); burst(t0 + 0.08, 0.2, 0.3, "lowpass", 900); };
  S.glove = () => { burst(ctx.currentTime, 0.18, 0.14, "bandpass", 1400, 1.2); };
  S.ghost = () => { const t0 = ctx.currentTime; osc("sine", 500, t0, 1.2, 0.08, 180); osc("sine", 520, t0 + 0.1, 1.2, 0.05, 190); };
  S.reveal = () => { const t0 = ctx.currentTime; osc("triangle", 300, t0, 0.15, 0.1, 600); burst(t0, 0.12, 0.12, "highpass", 2000); };
  S.creak = () => { const t0 = ctx.currentTime; osc("sawtooth", 70, t0, 0.6, 0.06, 95); };
  A.fx = function (name, arg) { if (!ac() || !S[name]) return; try { S[name](arg); } catch (e) { /* rien */ } };

  // ---------- la voix du présentateur ----------
  // babil, un charabia de syllabes graves et déformées, ou la voix de synthèse du navigateur, déformée
  const VOW = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [570, 840], [440, 1020], [390, 2300]];
  A.say = function (text, mode) {
    mode = mode || A.mode; if (!text || mode === "muet") return 0;
    if (mode === "voix" && window.speechSynthesis && enabled()) {
      try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "fr-FR"; u.pitch = 0.15; u.rate = 0.88; u.volume = 0.9; const vs = window.speechSynthesis.getVoices().filter((v) => /^fr/i.test(v.lang)); if (vs.length) u.voice = vs[0]; window.speechSynthesis.speak(u); return Math.min(9, 0.6 + text.length * 0.065); } catch (e) { /* on retombe sur le babil */ }
    }
    const c = ac(); if (!c) return 0;
    const words = text.split(/\s+/).filter(Boolean).slice(0, 24); let t0 = c.currentTime + 0.05; const base = 92 + Math.random() * 14;
    words.forEach((w, wi) => {
      const syl = Math.max(1, Math.min(3, Math.round(w.length / 3)));
      for (let s = 0; s < syl; s++) {
        const dur = 0.07 + Math.random() * 0.06; const v = VOW[Math.floor(Math.random() * VOW.length)]; const p = base * (1 + (Math.random() - 0.5) * 0.35) * (wi === words.length - 1 && s === syl - 1 ? 0.8 : 1);
        const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(p, t0); o.frequency.linearRampToValueAtTime(p * (0.85 + Math.random() * 0.3), t0 + dur);
        const g = c.createGain(); env(g, t0, 0.015, 0.7, dur);
        [0, 1].forEach((k) => { const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = v[k] * (0.9 + Math.random() * 0.2); f.Q.value = 4.5; const fg = c.createGain(); fg.gain.value = k ? 0.5 : 1; o.connect(f); f.connect(fg); fg.connect(g); });
        g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05); t0 += dur + 0.02;
      }
      t0 += 0.06 + Math.random() * 0.05;
    });
    return t0 - c.currentTime;
  };
  A.setMode = function (m) { A.mode = m; try { localStorage.setItem("ho.voice", m); } catch (e) { /* rien */ } if (m !== "voix" && window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) { /* rien */ } } };
  window.HOAudio = A;
})();
