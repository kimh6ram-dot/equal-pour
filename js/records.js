/* 컵 개수별 최고 점수 + 마지막으로 입력한 컵 개수 (localStorage). 기존 5단계 기록과 키가 분리되어 있다 */
(function () {
  var K = WS.CONFIG.storage;
  function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function best() { var o = read(K.best); return o && typeof o === 'object' ? o : {}; }
  // 이전 기록이 있고 그보다 높으면 true (해당 컵 개수의 첫 기록은 문구 없이 저장만)
  function save(cupCount, score) {
    var o = best(), prev = o[cupCount];
    var isNew = typeof prev === 'number' && score > prev;
    if (typeof prev !== 'number' || score > prev) { o[cupCount] = score; write(K.best, o); }
    return isNew;
  }
  function lastCups() { var n = read(K.cups); return typeof n === 'number' ? n : null; }
  function saveCups(n) { write(K.cups, n); }
  WS.records = { best: best, save: save, lastCups: lastCups, saveCups: saveCups };
})();
