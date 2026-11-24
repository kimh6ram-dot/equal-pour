/* 컵 개수별 레이아웃 — 메인 미리보기 · 플레이 · 결과 화면(PNG 포함)이 전부 이 함수 하나를 쓴다 */
(function () {
  var C = WS.CONFIG;

  // 열 수 / 게임 영역 최대 가로폭 / 컵 크기 배율 / 줄 사이 간격(컵 간격 단위)
  WS.getLayoutConfig = function (cupCount) {
    if (cupCount <= 19) return { columns: 5, maxWidth: 420, cupScale: 1, rowGap: 0.75 };
    if (cupCount <= 39) return { columns: 8, maxWidth: 620, cupScale: 1, rowGap: 0.75 };
    if (cupCount <= 69) return { columns: 10, maxWidth: 760, cupScale: 0.9, rowGap: 0.65 };
    return { columns: 10, maxWidth: 760, cupScale: 0.85, rowGap: 0.6 };
  };

  // availW: 무대 안쪽(테두리 제외)에 쓸 수 있는 최대 폭(px). 화면이 좁으면 비율을 유지한 채 컵과 간격이 함께 줄어든다 (열 수는 유지)
  WS.computeLayout = function (cupCount, availW) {
    var cfg = WS.getLayoutConfig(cupCount), cols = cfg.columns, m = C.gridMarginPitch;
    var pitch0 = C.basePitch * cfg.cupScale, want = (cols + m) * pitch0;
    var W = Math.max(120, Math.min(want, cfg.maxWidth - 2, availW));
    var pitch = W / (cols + m);
    return { columns: cols, rows: Math.ceil(cupCount / cols), W: W, pitch: pitch, rowGap: cfg.rowGap, maxWidth: cfg.maxWidth, cupScale: cfg.cupScale };
  };

  // 화면에서 쓸 수 있는 무대 폭: 좌우 20px 여백 + 테두리 2px 제외
  WS.availWidth = function () { return document.documentElement.clientWidth - 40 - 2; };
})();
