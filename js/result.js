/* 결과 카드: 자기완결 SVG(#resultCard) → 화면 표시 + PNG 저장. 열 수·컵 크기·간격은 플레이 화면과 같은 WS.computeLayout 을 쓴다.
 * 좌표 단위 = 화면 px (카드 폭 = 플레이 무대 폭). 컵이 많으면 카드가 길어지고 모든 컵이 포함된다 */
(function () {
  var C = WS.CONFIG;
  var FONT = "'Pretendard','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";
  var lastSVG = null, lastName = '', lastH = 0, lastW = 0;

  function t(x, y, size, weight, fill, str, anchor) {
    return '<text x="' + x + '" y="' + y + '" font-family="' + FONT + '" font-size="' + size + '" font-weight="' + weight +
      '" fill="' + fill + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + str + '</text>';
  }

  // 점수대별 한마디 (점수는 소수 첫째 자리 기준)
  function comment(sc) {
    return sc < 60 ? '컵들끼리 단톡방 팠답니다' : sc < 80 ? '컵 차별주의자' : sc < 90 ? '대충 맞긴 했습니다' : sc < 98 ? '혹시 계량기세요?' : '물 나누기 국가대표';
  }

  function columns(n) { return WS.getLayoutConfig(n).columns; }

  function cardSVG(res, N, cap) {
    var st = WS.cups.stage(), c = st.crop, L = WS.computeLayout(N, WS.availWidth()), cols = L.columns, rows = Math.ceil(N / cols);
    var CW = L.W + 2, P = L.pitch;                                            // 카드 폭 = 플레이 무대 폭(테두리 포함)
    var cw = P * C.cupWidthOfPitch, k = cw / c[2], ch = c[3] * k, rowH = ch + P * 0.21;   // 컵 크기 = 플레이 컵 크기, 줄 간격은 촘촘하게
    var cx0 = CW / 2, o = res.newRecord ? 22 : 0, top = 126 + o, H = Math.ceil(top + rows * rowH + 11);
    var s = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + CW + ' ' + H + '" width="' + CW + '" height="' + H + '">';
    s += '<rect width="' + CW + '" height="' + H + '" fill="#fff"/>';
    s += '<defs><clipPath id="cc"><path d="' + st.clip + '"/></clipPath>' +
      '<image id="ci" xlink:href="' + WS.cupImg[1] + '" x="' + c[0] + '" y="' + c[1] + '" width="' + c[2] + '" height="' + c[3] + '"/></defs>';
    // 텍스트 그룹: 컵 개수(12px) → 점수 → 한마디(17px) → (신기록이면 맨 위에 NEW RECORD!) → 컵
    s += t(cx0, 25 + o, 12, 500, '#777', '컵 ' + N + '개', 'middle');
    s += '<text x="' + cx0 + '" y="' + (67.5 + o) + '" text-anchor="middle" font-family="' + FONT + '"><tspan font-size="49" font-weight="800" fill="#000">' + res.score.toFixed(1) + '</tspan><tspan font-size="16" font-weight="800" fill="#000" dx="3">점</tspan></text>';
    s += t(cx0, 93 + o, 17, 800, '#222', comment(res.score), 'middle');
    if (res.newRecord) s += t(cx0, 19, 14, 800, '#E5322D', 'NEW RECORD!', 'middle').replace('<text ', '<text class="nr" ');   // 맨 위 · 화면에서는 확대되며 등장

    var tr = res.target / cap, ty = WS.cups.levelY(st, tr), i, r, j;
    for (r = 0; r < rows; r++) {
      var cnt = Math.min(cols, N - r * cols), x0 = (CW - cnt * P) / 2, base = top + r * rowH + ch;   // 마지막 줄은 가운데 정렬
      for (j = 0; j < cnt; j++) {
        i = r * cols + j;                                                     // 컵 번호 = 데이터 인덱스
        var mid = x0 + P * j + P / 2, left = mid - (st.cx - c[0]) * k, w = WS.cups.waterAttrs(st, Math.min(1, res.volumes[i] / cap), 0, 0);
        s += '<svg x="' + left.toFixed(2) + '" y="' + (base - ch).toFixed(2) + '" width="' + (c[2] * k).toFixed(2) + '" height="' + ch.toFixed(2) + '" viewBox="' + c.join(' ') + '" overflow="visible">' +
          '<use xlink:href="#ci" href="#ci"/><g clip-path="url(#cc)">' +
          '<path d="' + w.d + '" fill="' + WS.cups.WATER + '" fill-opacity="0.66"/>' +
          '<ellipse cx="' + st.cx + '" cy="' + w.cy + '" rx="' + w.rx + '" ry="' + w.ry + '" fill="' + WS.cups.SURF + '" fill-opacity="0.9" stroke="#fff" stroke-opacity="0.9" stroke-width="3" visibility="' + w.vis + '"/></g></svg>';
      }
      // 목표 수위: 얇은 회색 점선 (행마다)
      var yy = base - (c[1] + c[3] - ty) * k;
      s += '<line x1="' + (x0 + (P - cw) / 2 - 3).toFixed(1) + '" y1="' + yy.toFixed(1) + '" x2="' + (x0 + P * (cnt - 1) + (P + cw) / 2 + 3).toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="#999" stroke-width="0.5" stroke-dasharray="1.5 1.5"/>';
    }
    return { svg: s + '</svg>', h: H, w: CW };
  }

  function show(res, N, cap) {
    var card = cardSVG(res, N, cap), el = document.getElementById('resultCard');
    lastSVG = card.svg; lastH = card.h; lastW = card.w;
    lastName = '물똑같이나누기_컵' + N + '개_' + res.score.toFixed(1) + '점.png';
    el.style.width = card.w + 'px';
    el.innerHTML = lastSVG;
  }

  function savePNG() {
    if (!lastSVG) return;
    var img = new Image(), url = URL.createObjectURL(new Blob([lastSVG], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = function () {
      var cv = document.createElement('canvas'), sc = Math.min(Math.max(2, 1440 / lastW), 8000 / lastH);   // 폭 약 1440px 이상, 높이 8000px 이하
      cv.width = Math.round(lastW * sc); cv.height = Math.round(lastH * sc);
      var c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
      c.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) {
        var a = document.createElement('a'), u = URL.createObjectURL(b);
        a.href = u; a.download = lastName;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
      }, 'image/png');
    };
    img.src = url;
  }

  WS.result = { comment: comment, show: show, savePNG: savePNG, cardSVG: cardSVG, columns: columns };
})();
