/* 레이아웃(무대 좌표) + 렌더링. 무대 폭은 고정이고 컵은 한 줄 5개씩 아래로 쌓인다(세로로만 길어짐).
 * 컵·물통·물줄기·충돌 판정은 전부 같은 무대 좌표계(px)를 쓰고, 세로 스크롤은 페이지 스크롤일 뿐이라 판정에 영향이 없다. */
(function () {
  var C = WS.CONFIG, S = WS.state, V = WS.view, G = WS.geo, els = WS.els;
  var parts = [], ctx = null, dpr = 1;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(p) { return p * p * (3 - 2 * p); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function mk(tag, cls, parent) { var d = document.createElement(tag); d.className = cls; parent.appendChild(d); return d; }

  /* ---------- DOM ---------- */
  function build() {
    els.stage = document.getElementById('stage');
    els.world = document.getElementById('world');
    els.layerCups = document.getElementById('layerCups');
    els.fx = document.getElementById('fx');
    els.stream = document.getElementById('stream');
    els.stream2 = document.getElementById('stream2');
    var b = els.bottle = document.getElementById('bottle'), B = C.bottle, href = encodeURI(B.src);
    b.innerHTML =
      '<svg viewBox="0 0 100 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" overflow="visible">' +
      '<defs><clipPath id="bclip"><path d="' + B.inner + '"/></clipPath></defs>' +
      '<svg x="0" y="0" width="100" height="220" viewBox="' + B.crop.join(' ') + '"><image href="' + href + '" xlink:href="' + href + '" x="0" y="0" width="' + B.imgW + '" height="' + B.imgH + '"/></svg>' +
      '<g clip-path="url(#bclip)"><g id="bwater" transform="translate(50,108) translate(0,-100)">' +
      '<rect x="-300" y="0" width="700" height="700" fill="' + WS.cups.WATER + '" fill-opacity="0.66"/>' +
      '<rect x="-300" y="0" width="700" height="3.5" fill="' + WS.cups.SURF + '"/></g></g></svg>';
    els.bwater = b.querySelector('#bwater');
  }

  // 컵 DOM 은 한 번만 만든다 (프레임마다 재생성하지 않음). 메인 미리보기는 최대 previewRows 줄만 그린다
  function buildCups() {
    var st = WS.cups.stage(), N = S.preview ? Math.min(S.cupCount, C.previewRows * WS.getLayoutConfig(S.cupCount).columns) : S.cupCount, i, frag = document.createDocumentFragment();
    els.layerCups.innerHTML = '';
    els.cups = []; els.waterPaths = []; els.surfPaths = [];
    for (i = 0; i < N; i++) {
      var c = mk('div', 'cup', frag); c.innerHTML = WS.cups.markup(st, 'g', i, 0); els.cups.push(c);
      els.waterPaths.push(c.querySelector('#gw' + i)); els.surfPaths.push(c.querySelector('#gs' + i));
    }
    els.layerCups.appendChild(frag);
    V.ratio = []; V.ampOn = []; V.amp = []; for (i = 0; i < N; i++) V.amp.push(0);
    layout();
  }

  /* ---------- 레이아웃 ---------- */
  function layout() {
    var n = els.cups ? els.cups.length : 0;
    if (!n || !S.cupCount) return;
    // 컵 개수별 공통 레이아웃(열 수·가로폭·컵 크기·간격) — 메인/플레이/결과 모두 같은 함수
    var L = WS.computeLayout(S.cupCount, WS.availWidth()), W = Math.round(L.W * 100) / 100, cols = L.columns;
    els.game.style.setProperty('--sw', (W + 2) + 'px');                       // 무대/상단 정보/조작 UI 가 같은 폭·같은 중앙선
    var st = WS.cups.stage(), c = st.crop, oldW = G.W, rows = Math.ceil(n / cols);
    if (!els.stage.clientWidth) return;
    // 모든 치수는 컵 간격 p 의 배수. 컵 크기·가로/세로 간격은 전부 동일, 컵 원본 비율 유지
    var cwp = S.preview ? 0.96 : C.cupWidthOfPitch;                           // 메인 미리보기는 컵 간격을 더 좁게
    var kCupH = cwp * c[3] / c[2];
    var unitsTop = S.preview ? 0.5 : C.bottleHeightOfPitch + C.topPadOfPitch, unitsRow = kCupH + (S.preview ? C.rowGapOfPitch : L.rowGap);
    var unitsH = unitsTop + (rows - 1) * unitsRow + kCupH + C.bottomPadOfPitch;
    var p = L.pitch, H, yOff = 0;
    if (S.preview) {                                                          // 미리보기: 높이 고정(CSS), 그 안에 맞춰 축소
      els.stage.style.height = '';
      H = els.stage.clientHeight;
      p = Math.min(W * 0.95 / cols, H / unitsH);
      if (rows === 1) {                                                       // 한 줄이면 컵 바닥선을 플레이 첫 줄 바닥선과 같은 y 에 (메인 · 플레이 · 결과 높이 통일)
        var base = L.pitch * (C.bottleHeightOfPitch + C.topPadOfPitch + C.cupWidthOfPitch * c[3] / c[2]);
        yOff = Math.max(0, base - (unitsTop + kCupH) * p);
      } else yOff = Math.max(0, (H - unitsH * p) / 2);
    } else {                                                                  // 플레이: 가로폭 고정, 줄 수만큼 세로로 길어짐 (최소 높이 = 메인 미리보기 프레임)
      var minH = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--preview-height')) || 0) - 2;
      H = Math.max(Math.ceil(unitsH * p), minH);
      els.stage.style.height = (H + 2) + 'px';                                // +2 = 위아래 테두리
    }
    G.W = W; G.H = H; G.n = n; G.rows = rows; G.cols = cols; G.pitch = p;
    els.bottle.style.display = S.preview ? 'none' : '';                       // 미리보기엔 물통 없음
    G.s = p * cwp / c[2];                                     // 원본 px → 화면 px
    G.cupW = c[2] * G.s; G.cupH = c[3] * G.s;
    G.bh = C.bottleHeightOfPitch * p; G.bw = G.bh * 100 / 220; G.bs = G.bh / 220;
    G.rowPitch = unitsRow * p; G.rimY0 = yOff + unitsTop * p;
    G.rimY = function (r) { return G.rimY0 + r * G.rowPitch; };               // r: 줄 번호(소수 가능 = 줄 이동 중)
    G.baseY = function (r) { return G.rimY(r) + G.cupH; };                    // 줄의 바닥(컵 바닥)
    G.rimC = function (r) { return G.rimY(r) + (st.rimY - c[1]) * G.s; };
    G.idleY = function (r) { return G.rimY(r) - G.bh - p * 0.05; };
    G.pourY = function (r) { return G.rimY(r) - p * C.pourLiftOfPitch; };
    G.rowOf = function (i) { return Math.floor(i / cols); };
    G.rowStart = function (r) { return r * cols; };
    G.rowEnd = function (r) { return Math.min(n, (r + 1) * cols) - 1; };
    G.cx = function (i) {                                                     // 마지막 줄이 5개 미만이면 가운데 정렬
      var r = Math.floor(i / cols), rc = Math.min(cols, n - r * cols), j = i - r * cols;
      return (W - rc * p) / 2 + (j + 0.5) * p;
    };
    G.gridL = (W - cols * p) / 2; G.gridR = W - G.gridL;
    G.bMin = Math.max(6, G.gridL - p * C.sideRoomPitch);                      // 물통(주둥이) 좌우 이동 범위
    G.bMax = Math.min(W - 6, G.gridR + p * C.sideRoomPitch);
    G.open = st.rimHalf * G.s;
    G.sw = Math.max(2.5, G.cupW * 0.0755);                                    // 물줄기 굵기는 컵 폭에 비례 (컵 크기가 바뀌어도 판정/그래픽 일치)
    G.surfY = function (r, ratio) { return G.rimY(r) + (WS.cups.levelY(st, ratio) - c[1]) * G.s; };
    G.band = function (r) { return { top: G.rimY(r) - G.bh - p * 0.35, bottom: G.baseY(r) + p * 0.35 }; };   // 줄 r 이 보여야 하는 세로 구간

    els.world.style.width = W + 'px'; els.world.style.height = H + 'px';
    els.bottle.style.width = G.bw + 'px'; els.bottle.style.height = G.bh + 'px';
    for (var i = 0; i < n && els.cups[i]; i++) {
      var left = G.cx(i) - (st.cx - c[0]) * G.s;
      els.cups[i].style.cssText = 'left:' + left + 'px;top:' + G.rimY(G.rowOf(i)) + 'px;width:' + G.cupW + 'px;height:' + G.cupH + 'px';
    }
    dpr = Math.min(2, window.devicePixelRatio || 1);
    els.fx.width = Math.round(W * dpr); els.fx.height = Math.round(H * dpr);
    ctx = els.fx.getContext('2d'); V.fxHad = false;

    if (S.needCenter) { S.bottleX = W / 2; S.needCenter = false; }
    else if (oldW && oldW !== W) S.bottleX = S.bottleX / oldW * W;
    S.bottleX = clamp(S.bottleX, G.bMin, G.bMax);
  }

  /* ---------- 렌더 ---------- */
  function emit(x, y, vx, vy, fl) { if (parts.length < 90) parts.push({ x: x, y: y, vx: vx, vy: vy, r: rnd(1.8, 3.2), f: fl }); }
  function clearParticles() { parts.length = 0; }

  function seg(el, x1, x2, y1, y2, op) {
    if (x2 - x1 < 0.5 || y2 <= y1) { el.style.display = 'none'; return; }
    el.style.cssText = 'display:block;opacity:' + op + ';left:' + x1 + 'px;top:' + y1 + 'px;width:' + (x2 - x1) + 'px;height:' + (y2 - y1) + 'px';
  }

  function render(dt) {
    if (!G.W || !isFinite(S.bottleX)) return;
    var i, n = G.n, st = WS.cups.stage(), rp = S.rowPos, row = S.row;

    // 기울기: 위치와 무관하게 항상 왼쪽으로만 (주둥이는 물통의 왼쪽), 좌우 반전 없음. 줄 이동 중에는 세운다
    var tTarget = (S.isPouring && S.phase === 'play' && !S.rowMoving) ? 1 : 0;
    V.tilt += clamp(tTarget - V.tilt, -dt / C.tiltSeconds, dt / C.tiltSeconds);
    var e = ease(V.tilt), s = G.bs;
    var th = -105 * e, rad = th * Math.PI / 180;
    var bx = S.bottleX;                                  // 물줄기 시작 x (주둥이) = 충돌 판정 x
    var lx = C.bottle.spoutX * s;
    var idleY = G.idleY(rp), pourY = G.pourY(rp);
    var pivotX = bx - lx * Math.cos(rad) * e;
    var pivotY = idleY + (pourY - idleY) * e;
    els.bottle.style.transform = 'translate(' + (pivotX - G.bw / 2) + 'px,' + pivotY + 'px) rotate(' + th + 'deg)';

    // 물통 속 물(세계 좌표 기준 수평 유지)
    var r = S.bottleRemaining / S.totalWater;
    var E = 215 * Math.abs(Math.cos(rad)) + 80 * Math.abs(Math.sin(rad));
    var d = (0.5 - r) * E;
    if (r > 0) d = Math.min(d, E / 2 - 4); else d = E;
    els.bwater.setAttribute('transform', 'translate(50,108) rotate(' + (105 * e) + ') translate(0,' + d.toFixed(2) + ')');

    // 물줄기: 컵 입구와 겹친 부분은 수면까지, 나머지는 현재 줄의 바닥까지
    var flowing = S.isPouring && S.phase === 'play' && !S.rowMoving && S.pourHeld >= C.pourStartDelay && S.bottleRemaining > 0;
    V.stream += clamp((flowing ? 1 : 0) - V.stream, -dt / C.streamFadeOut, dt / C.streamFadeIn);
    if (WS.sound) WS.sound.update(V.stream > 0.01 && S.bottleRemaining > 0 ? V.stream : 0);
    var sy = pivotY + lx * Math.sin(rad), floorY = G.baseY(rp);
    if (V.stream > 0.01) {
      var h = WS.game.streamHit(), surfY = floorY;
      if (h.i >= 0) surfY = G.surfY(row, Math.min(1, S.cupVolumes[h.i] / S.cupCapacity));
      if (h.i >= 0) {
        seg(els.stream, h.o1, h.o2, sy, surfY, V.stream);
        if (h.o1 - h.a >= h.b - h.o2) seg(els.stream2, h.a, h.o1, sy, floorY, V.stream); else seg(els.stream2, h.o2, h.b, sy, floorY, V.stream);
      } else { els.stream.style.display = 'none'; seg(els.stream2, h.a, h.b, sy, floorY, V.stream); }
      if (S.supplying) {
        if (h.i >= 0 && h.frac < 1 && Math.random() < dt * 18 * (1 - h.frac)) emit(bx + rnd(-4, 4), surfY, rnd(-70, 70), -rnd(40, 110), floorY);
        if (h.frac < 1 && Math.random() < dt * 70 * (1 - h.frac)) {         // 컵 밖: 바닥에 튀는 물방울
          var sd = Math.random() < 0.5 ? -1 : 1;
          emit(bx + rnd(-3, 3), floorY, sd * rnd(30, 130), -rnd(80, 200), floorY);
        }
      }
    } else { els.stream.style.display = 'none'; els.stream2.style.display = 'none'; }

    // 컵 수위 + 수면 흔들림: 바뀐 컵만 갱신 (100개여도 프레임당 비용 일정)
    V.wave += dt * 9;
    for (i = 0; i < n; i++) {
      var amp = V.amp[i];
      if (S.supplying && i === S.hitCup) amp = 1; else if (amp > 0) amp = Math.max(0, amp - dt / C.settleSeconds);
      V.amp[i] = amp;
      var ratio = Math.min(1, S.cupVolumes[i] / S.cupCapacity);
      if (ratio !== V.ratio[i] || amp > 0 || V.ampOn[i]) {
        WS.cups.applyWater({ body: els.waterPaths[i], surf: els.surfPaths[i] }, st, ratio, V.wave + i, amp);
        V.ratio[i] = ratio; V.ampOn[i] = amp > 0;
      }
    }

    // 용량 초과 물방울
    if (S.overflow && S.hitCup >= 0 && Math.random() < dt * 60) {
      var side = Math.random() < 0.5 ? -1 : 1;
      emit(G.cx(S.hitCup) + side * G.open * 0.95, G.rimC(row), side * rnd(40, 150), -rnd(120, 260), G.baseY(row));
    }
    // 물방울 캔버스: 입자가 있을 때만 지운다 (세로로 긴 무대에서도 프레임 비용 일정)
    if (parts.length || V.fxHad) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, G.W, G.H);
      ctx.fillStyle = 'rgba(120,190,226,0.92)';
      for (i = parts.length - 1; i >= 0; i--) {
        var q = parts[i];
        q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.y > q.f + 3) { parts.splice(i, 1); continue; }
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.2832); ctx.fill();
      }
      V.fxHad = parts.length > 0;
    }
  }

  WS.render = { build: build, buildCups: buildCups, layout: layout, render: render, clearParticles: clearParticles };
})();
