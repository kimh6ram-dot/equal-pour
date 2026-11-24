/* 물 따르는 소리 (졸졸졸): 외부 파일 없이 WebAudio 로 합성. 아주 약한 노이즈 + 짧은 방울 소리 여러 개(가는 물줄기의 졸졸졸)를 물줄기 세기(0~1)에 맞춰 낸다.
 * 브라우저 정책상 첫 터치/키 입력에서 오디오를 연다 */
(function () {
  var ctx = null, master = null, noiseGain = null, level = 0, nextBlip = 0, muted = false, KEY = 'waterSplit.v2.sound', on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) {}

  function prime() {
    if (muted) return;
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) { muted = true; return; }
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.0; master.connect(ctx.destination);
        var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), i, last = 0;
        for (i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.06 * w) / 1.06; d[i] = last * 3.2; }   // 부드러운 갈색 노이즈
        var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 2.5;
        noiseGain = ctx.createGain(); noiseGain.gain.value = 0.06;
        src.connect(bp); bp.connect(noiseGain); noiseGain.connect(master); src.start();
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { muted = true; }
  }

  function blip(t) {                                    // 짧게 올라가는 사인 = 물방울 '졸'
    var o = ctx.createOscillator(), g = ctx.createGain(), f = 600 + Math.random() * 900;
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (1.4 + Math.random() * 0.7), t + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * (0.3 + Math.random() * 0.7), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.08);
  }

  // level: 눈에 보이는 물줄기 세기(0~1). 프레임마다 호출
  function update(lv) {
    if (!ctx || muted) return;
    if (!on) lv = 0;
    level = lv;
    var now = ctx.currentTime;
    master.gain.setTargetAtTime(lv > 0.02 ? 0.1 * lv : 0, now, 0.05);
    if (lv > 0.3 && now >= nextBlip) { blip(now); if (Math.random() < 0.35) blip(now + 0.02 + Math.random() * 0.03); nextBlip = now + 0.05 + Math.random() * 0.12; }
  }

  document.addEventListener('pointerdown', prime, true);
  document.addEventListener('keydown', prime, true);
  document.addEventListener('touchstart', prime, true);

  function setOn(v) { on = !!v; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {} if (!on && ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.02); }

  WS.sound = { setOn: setOn, isOn: function () { return on; }, prime: prime, update: update, level: function () { return level; } };
})();
