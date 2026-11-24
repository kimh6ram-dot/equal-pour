/* 게임 로직 + 화면 전환. 상태(S)는 데이터, V 는 연출용(rendering.js). 무대 좌표(px)는 rendering.js 의 layout() 이 계산한다.
 * 물통은 좌우 자유 이동(S.bottleX = 무대 px, 주둥이 x) + 줄 이동(S.row). 물줄기가 현재 줄 컵의 입구와 겹친 비율만큼만 컵에 들어간다. */
(function () {
  var C = WS.CONFIG, S = WS.state, V = WS.view, G = WS.geo, els = WS.els;
  var keys = { L: false, R: false }, moveDir = 0, moveT = 0;
  var cupCount = C.defaultCups, last = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- 상태 (한 판이 시작될 때 컵 개수별 설정을 확정) ---------- */
  function initState() {
    var i, k = WS.calcSettings(cupCount);
    S.cupCount = k.cupCount; S.targetVolume = k.targetVolume; S.cupCapacity = k.cupCapacity; S.pourRate = k.pourRate;
    S.totalWater = C.totalWater;
    S.cupVolumes = []; for (i = 0; i < S.cupCount; i++) S.cupVolumes.push(0);
    S.bottleRemaining = S.totalWater;
    S.spilledVolume = 0;          // 컵 밖으로 흘린 물 + 컵 용량 초과분
    S.bottleX = NaN; S.needCenter = true;   // 무대 가로 중앙에서 시작 (layout 이 확정)
    S.row = 0; S.rowPos = 0; S.rowMoving = false;   // 물통이 있는 줄 / 애니메이션 중인 줄 위치(소수)
    S.isPouring = false; S.pourHeld = 0;
    S.phase = 'play';             // play | ending | idle
    S.endTimer = 0;
    S.supplying = false; S.hitCup = -1; S.hitFrac = 0; S.overflow = false;
    S.result = null;
    V.tilt = 0; V.stream = 0; V.wave = 0;
    moveDir = 0; moveT = 0;
    WS.render.clearParticles();
  }

  /* ---------- 입력 대상 함수 ---------- */
  function startPour() {
    if (S.phase !== 'play' || S.isPouring || S.bottleRemaining <= 0) return;
    S.isPouring = true; S.pourHeld = 0;
    els.btnPour && els.btnPour.classList.add('on');
  }
  function stopPour() {
    S.isPouring = false; S.pourHeld = 0;
    els.btnPour && els.btnPour.classList.remove('on');
  }
  function setMove(side, on) { keys[side] = !!on; }       // 'L' | 'R'
  function releaseAll() { keys.L = keys.R = false; stopPour(); }

  // 줄 이동: 한 번에 한 줄. 이동 중에는 물 공급 중지, 가로 위치는 그대로(스냅 없음)
  function moveRow(d) {
    if (S.phase !== 'play' || !G.rows) return;
    var nr = clamp(S.row + d, 0, G.rows - 1);
    if (nr === S.row) return;
    S.row = nr; S.pourHeld = 0;
    scrollToRow(true);
  }

  // 현재 줄이 (고정된 HUD·조작 버튼에 가리지 않고) 화면 가운데에 오도록 페이지를 세로 스크롤. 충돌 판정과는 무관
  function scrollToRow(smooth) {
    if (!G.rows || mode() !== 'play') return;
    var hud = document.querySelector('.hud'), ctl = document.querySelector('.controls');
    var hudH = hud ? hud.offsetHeight : 0, ctlH = ctl ? ctl.offsetHeight : 0, band = G.band(S.row);
    var stageTop = els.stage.getBoundingClientRect().top + window.scrollY;
    var viewH = window.innerHeight - hudH - ctlH;
    var target = stageTop + (band.top + band.bottom) / 2 - (hudH + viewH / 2);
    var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: clamp(target, 0, max), left: 0, behavior: smooth ? 'smooth' : 'auto' });
  }

  /* ---------- 물줄기 ↔ 컵 입구 충돌 (렌더와 같은 무대 좌표, 주둥이 x 기준, 현재 줄의 컵만) ---------- */
  function streamHit() {
    var none = { i: -1, frac: 0, a: 0, b: 0, o1: 0, o2: 0 };
    if (!G.W || !isFinite(S.bottleX)) return none;
    var x = S.bottleX, a = x - G.sw / 2, b = x + G.sw / 2, best = { i: -1, frac: 0, a: a, b: b, o1: 0, o2: 0 };
    if (S.rowMoving) return best;                      // 줄 이동 중에는 어느 컵에도 닿지 않는다
    for (var i = G.rowStart(S.row), i1 = G.rowEnd(S.row); i <= i1; i++) {   // 다른 줄 컵은 후보에서 제외
      var o1 = Math.max(a, G.cx(i) - G.open), o2 = Math.min(b, G.cx(i) + G.open);
      if (o2 - o1 > 0 && (o2 - o1) / G.sw > best.frac) best = { i: i, frac: (o2 - o1) / G.sw, a: a, b: b, o1: o1, o2: o2 };
    }
    return best;
  }

  /* ---------- 물 양 업데이트 (실제 경과 시간 기준) ---------- */
  function updateWater(dt) {
    S.supplying = false; S.overflow = false; S.hitCup = -1; S.hitFrac = 0;
    if (S.phase !== 'play') return;
    var hit = streamHit();
    S.hitCup = hit.i; S.hitFrac = hit.frac;
    if (!S.isPouring) return;
    if (S.rowMoving) { S.pourHeld = 0; return; }       // 줄 이동 중 물 공급 중지 (도착 후 계속 누르고 있으면 다시 시작)
    S.pourHeld += dt;
    var active = Math.min(dt, S.pourHeld - C.pourStartDelay);   // 지연 이후 구간만
    if (active <= 0) return;
    var amount = Math.min(S.pourRate * active, S.bottleRemaining);
    var cupIn = amount * hit.frac, add = 0;
    if (hit.i >= 0) {
      add = Math.min(cupIn, Math.max(0, S.cupCapacity - S.cupVolumes[hit.i]));
      S.cupVolumes[hit.i] += add;
    }
    S.overflow = cupIn - add > 1e-9;
    S.spilledVolume += amount - add;          // 컵 밖 + 초과분 전부 (물통 감소량 = 컵 + 흘림)
    S.bottleRemaining -= amount;
    S.supplying = amount > 0;
    if (S.bottleRemaining <= 1e-6) { S.bottleRemaining = 0; endGame(); }
  }

  function endGame() {
    stopPour();
    S.phase = 'ending'; S.endTimer = 0;
    S.result = WS.scoring.calcScore(S.cupVolumes, S.totalWater);
    S.result.spilled = S.spilledVolume;
    S.result.newRecord = WS.records.save(S.cupCount, S.result.score);
  }

  function update(dt) {
    if (S.phase === 'ending') {
      S.endTimer += dt;
      if (S.endTimer >= C.endHoldSeconds) {
        S.phase = 'idle';
        WS.result.show(S.result, S.cupCount, S.cupCapacity);
        if (WS.battle) WS.battle.onResult(S.result, S.cupCount);
        showScreen('result');
      }
      return;
    }
    if (S.rowPos !== S.row) {                           // 줄 이동 애니메이션
      var rs = dt / C.rowMoveSeconds;
      S.rowPos += clamp(S.row - S.rowPos, -rs, rs);
    }
    S.rowMoving = S.rowPos !== S.row;
    if (S.phase === 'play' && isFinite(S.bottleX)) {
      var mv = (keys.R ? 1 : 0) - (keys.L ? 1 : 0);
      if (mv) {                                        // 계속 누르면 점점 빨라짐 (방향이 바뀌면 처음부터)
        if (mv !== moveDir) { moveDir = mv; moveT = 0; }
        moveT += dt;
        var ramp = 1 + (C.moveRampMax - 1) * Math.min(1, moveT / C.moveRampSeconds);
        S.bottleX = clamp(S.bottleX + mv * C.bottleMoveSpeed * (G.W / C.moveRefWidth) * ramp * dt, G.bMin, G.bMax);
      } else { moveDir = 0; moveT = 0; }
    }
    updateWater(dt);
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    if (!els.game || els.game.hidden) { last = ts; return; }
    var dt = last ? Math.min(C.maxDelta, Math.max(0, (ts - last) / 1000)) : 0;   // 비활성 복귀 시 누적 시간 차단
    last = ts;
    update(dt); WS.render.render(dt);
  }

  /* ---------- 화면 전환 ---------- */
  // 메인 = 실제 게임 화면(물통 + 빈 컵, 물줄기·조작 UI 없음) + 제목 + 컵 개수 입력 + 시작하기
  function mode() {
    var ex = ['result', 'challenge', 'battle'].filter(function (id) { return !document.getElementById(id).hidden; })[0];
    if (ex) return ex;
    return els.game.classList.contains('is-menu') ? 'menu' : 'play';
  }
  function showScreen(name) {
    var ov = name === 'result' || name === 'challenge' || name === 'battle';
    els.game.hidden = ov; ['result', 'challenge', 'battle'].forEach(function (id) { document.getElementById(id).hidden = (id !== name); });
    els.game.classList.toggle('is-menu', name === 'menu'); if (name !== 'menu') els.game.classList.remove('is-setup');
    window.scrollTo(0, 0);                              // 화면이 바뀌면 항상 맨 위에서 시작
    if (!ov) WS.render.layout();
  }
  function setHud() { document.getElementById('hudInfo').textContent = '컵 ' + S.cupCount + '개'; }
  function prepare(n, preview) {
    releaseAll();
    cupCount = clamp(Math.round(n || cupCount), C.minCups, C.maxCups);
    S.preview = !!preview;                              // 메인 미리보기는 입력 개수와 무관하게 항상 같은 그림(컵 5개)
    var real = cupCount; if (S.preview) cupCount = C.defaultCups;
    initState();
    cupCount = real;
    if (S.preview) {                                    // 메인 사진: 컵마다 물이 제각각인 장면 (조작 불가, 컵 개수별 배치만 미리 보여줌)
      var pat = [0.34, 0.82, 0.18, 0.6, 0.46, 0.7, 0.28, 0.52, 0.9, 0.4];
      S.cupVolumes = S.cupVolumes.map(function (v, i) { return pat[i % pat.length] * S.cupCapacity; });
    }
    WS.render.buildCups(); setHud();
  }
  function setCups(n) { cupCount = clamp(Math.round(n || cupCount), C.minCups, C.maxCups); }    // 입력 개수만 기억 — 메인 사진은 바뀌지 않는다
  function showMenu() { prepare(cupCount, true); S.phase = 'idle'; showScreen('menu'); }
  function start(n) { prepare(n, false); showScreen('game'); els.btnPour && els.btnPour.classList.remove('on'); }
  function restart() { start(cupCount); }

  function init() {
    els.game = document.getElementById('game'); els.result = document.getElementById('result');
    els.btnPour = document.getElementById('btnPour');
    WS.render.build();
    cupCount = WS.records.lastCups() || C.defaultCups;
    cupCount = clamp(cupCount, C.minCups, C.maxCups);
    showMenu();
    window.addEventListener('resize', WS.render.layout);
    if (window.ResizeObserver) new ResizeObserver(WS.render.layout).observe(els.stage);
    requestAnimationFrame(frame);
  }

  WS.game = { init: init, start: start, restart: restart, showMenu: showMenu, setCups: setCups, setMove: setMove, moveRow: moveRow, scrollToRow: scrollToRow, releaseAll: releaseAll,
    startPour: startPour, stopPour: stopPour, showScreen: showScreen, mode: mode, streamHit: streamHit, cups: function () { return cupCount; } };
})();
