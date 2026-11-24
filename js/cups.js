/* 컵 에셋(기본 유리컵) + 내부 물 영역 + 부피→수위 변환.
 * 좌표는 전부 원본 PNG 픽셀 기준. 컵 SVG 는 viewBox = crop(실제 컵이 있는 영역) 이라
 * 화면에서는 크기 한 가지(scale)만 곱하면 이미지/물/충돌 좌표가 모두 일치한다.
 *
 * 각 단계 데이터
 *   crop   : [x, y, w, h]  컵 실루엣 영역 (바닥 기준선 = crop 아랫변)
 *   cx     : 컵 중심 x
 *   rimY   : 입구(만수 = cupCapacity) 수면 중심 y
 *   botY   : 물이 차기 시작하는 내부 바닥 y
 *   prof   : 내부 반폭 [y, half] 목록 (위→아래). 컵 내부 형태를 그대로 따른다.
 * 부피 = ∫ half(y)² dy (원형 단면). 이 누적 테이블로 부피 → 높이를 구한다. */
(function () {
  var ELL = 0.17; // 수면/바닥 타원의 세로:가로 비 (이미지 원근과 맞춤)

  var STAGES = [
    { n: 1, name: '기본 유리컵', file: '1단계.png', W: 1062, H: 1482, crop: [214, 196, 624, 1092], cx: 526, rimY: 285, botY: 1100,
      prof: [[285, 268], [320, 274], [400, 266], [480, 257], [560, 249], [640, 241], [720, 232], [800, 224], [880, 216], [960, 211], [1040, 200], [1100, 190]] }
  ];

  var STEPS = 160;

  function halfAt(st, y) {
    var p = st.prof;
    if (y <= p[0][0]) return p[0][1];
    for (var i = 1; i < p.length; i++) {
      if (y <= p[i][0]) { var a = p[i - 1], b = p[i], t = (y - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; }
    }
    return p[p.length - 1][1];
  }

  // 누적 부피 테이블: cum[k] = botY → y_k 까지의 부피 (rimY 에서 1 로 정규화)
  STAGES.forEach(function (st) {
    st.ys = []; st.cum = [0];
    var i, y, prev;
    for (i = 0; i <= STEPS; i++) st.ys.push(st.botY + (st.rimY - st.botY) * i / STEPS);
    for (i = 1; i <= STEPS; i++) {
      var h0 = halfAt(st, st.ys[i - 1]), h1 = halfAt(st, st.ys[i]);
      st.cum.push(st.cum[i - 1] + (h0 * h0 + h1 * h1) / 2 * Math.abs(st.ys[i] - st.ys[i - 1]));
    }
    var tot = st.cum[STEPS];
    for (i = 0; i <= STEPS; i++) st.cum[i] /= tot;
    st.rimHalf = halfAt(st, st.rimY);          // 입구 반폭 (물줄기 충돌 기준)
    // 물 클립: 컵 안쪽 면 (위쪽은 입구 타원 윗부분까지, 아래는 바닥 타원)
    var cx = st.cx, h0 = st.rimHalf, top = st.rimY - ELL * h0 - 2, hb = halfAt(st, st.botY);
    var d = 'M' + (cx - h0) + ' ' + top + ' L' + (cx - h0) + ' ' + st.rimY, k;
    for (k = 0; k < st.prof.length; k++) d += ' L' + (cx - st.prof[k][1]) + ' ' + st.prof[k][0];
    d += ' A' + hb + ' ' + (ELL * hb) + ' 0 0 0 ' + (cx + hb) + ' ' + st.botY;
    for (k = st.prof.length - 1; k >= 0; k--) d += ' L' + (cx + st.prof[k][1]) + ' ' + st.prof[k][0];
    d += ' L' + (cx + h0) + ' ' + top + ' Z';
    st.clip = d;
    st.href = encodeURI('assets/' + st.file);
  });

  function stage() { return STAGES[0]; }   // 기본 유리컵 1종

  // 부피 비율(0~1, = ml/cupCapacity) → 수면 중심 y (원본 이미지 좌표)
  function levelY(st, ratio) {
    var r = Math.max(0, Math.min(1, ratio)), lo = 0, hi = STEPS;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (st.cum[m] < r) lo = m; else hi = m; }
    var a = st.cum[lo], b = st.cum[hi], t = b > a ? (r - a) / (b - a) : 0;
    return st.ys[lo] + (st.ys[hi] - st.ys[lo]) * t;
  }

  var WATER = '#5fb4e4', SURF = '#bfe6f6';

  // card=true: 결과 카드용(축소·크롭된 data URI 이미지, 외부 파일 참조 불가)
  function markup(st, prefix, i, ratio, card) {
    var id = prefix + i, c = st.crop, img, w = waterAttrs(st, ratio || 0, 0, 0);
    if (card && WS.cupImg && WS.cupImg[st.n]) img = '<image xlink:href="' + WS.cupImg[st.n] + '" x="' + c[0] + '" y="' + c[1] + '" width="' + c[2] + '" height="' + c[3] + '"/>';
    else img = '<image xlink:href="' + st.href + '" x="0" y="0" width="' + st.W + '" height="' + st.H + '"/>';
    return '<svg class="cup-svg" viewBox="' + c.join(' ') + '" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" overflow="visible">' +
      '<defs><clipPath id="' + prefix + 'clip' + i + '"><path d="' + st.clip + '"/></clipPath></defs>' + img +
      '<g clip-path="url(#' + prefix + 'clip' + i + ')">' +
      '<path id="' + prefix + 'w' + i + '" d="' + w.d + '" fill="' + WATER + '" fill-opacity="0.66"/>' +
      '<ellipse id="' + prefix + 's' + i + '" cx="' + st.cx + '" cy="' + w.cy + '" rx="' + w.rx + '" ry="' + w.ry + '" fill="' + SURF + '" fill-opacity="0.9" stroke="#fff" stroke-opacity="0.9" stroke-width="3" visibility="' + w.vis + '"/>' +
      '</g></svg>';
  }

  // 수위 → 물 몸통 path / 수면 타원 속성. 물결(amp)은 수면 타원의 기울기/두께로만 표현 (수위 계산과 무관)
  function waterAttrs(st, ratio, phase, amp) {
    if (ratio <= 0.0005) return { d: '', cy: st.botY, rx: 1, ry: 1, rot: '', vis: 'hidden' };
    var y = levelY(st, ratio), h = halfAt(st, y), c = st.crop;
    return { d: 'M' + c[0] + ' ' + y.toFixed(1) + ' L' + (c[0] + c[2]) + ' ' + y.toFixed(1) + ' L' + (c[0] + c[2]) + ' ' + (c[1] + c[3]) + ' L' + c[0] + ' ' + (c[1] + c[3]) + ' Z',
      cy: y.toFixed(1), rx: h.toFixed(1), ry: (h * ELL * (1 + amp * 0.12 * Math.sin(phase * 1.3))).toFixed(1),
      rot: 'rotate(' + (amp * 2.2 * Math.sin(phase)).toFixed(2) + ' ' + st.cx + ' ' + y.toFixed(1) + ')', vis: 'visible' };
  }
  function applyWater(el, st, ratio, phase, amp) {
    var w = waterAttrs(st, ratio, phase, amp);
    el.body.setAttribute('d', w.d); el.surf.setAttribute('visibility', w.vis);
    if (w.vis === 'hidden') return;
    el.surf.setAttribute('cy', w.cy); el.surf.setAttribute('rx', w.rx); el.surf.setAttribute('ry', w.ry); el.surf.setAttribute('transform', w.rot);
  }

  WS.cups = { stages: STAGES, stage: stage, levelY: levelY, halfAt: halfAt, markup: markup, applyWater: applyWater, waterAttrs: waterAttrs, WATER: WATER, SURF: SURF };
})();
