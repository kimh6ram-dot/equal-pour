/* 메인 화면: ① 제목+시작하기 → ② 컵 개수 직접 입력 (2~50 정수). 유효할 때만 미리보기를 갱신하고 시작할 수 있다 */
(function () {
  var C = WS.CONFIG, input, btn, msg, HINT = '* 최대 ' + C.maxCups + '개';

  function parse() {
    var v = input.value;
    if (v === '') return { ok: false, text: '' };
    var n = parseInt(v, 10);
    if (n > C.maxCups) return { ok: false, text: '최대 ' + C.maxCups + '개까지 입력할 수 있습니다' };
    if (n < C.minCups) return { ok: false, text: C.minCups + '개 이상 입력하세요' };
    return { ok: true, n: n, text: '' };
  }

  function refresh() {
    var p = parse();
    msg.textContent = p.text || HINT; btn.disabled = !p.ok;
    if (p.ok) {
      WS.records.saveCups(p.n);                            // 마지막 유효 입력 저장
      if (p.n !== WS.game.cups()) WS.game.setCups(p.n);    // 미리보기 갱신 (입력창 값은 건드리지 않음)
    }
  }

  function startIfValid() {
    var p = parse(); if (!p.ok) return;
    WS.records.saveCups(p.n); input.blur(); WS.game.start(p.n);
  }

  function showSetup() { sync(); document.getElementById('game').classList.add('is-setup'); }
  function sync() { input.value = String(WS.game.cups()); msg.textContent = HINT; btn.disabled = false; }

  function init() {
    input = document.getElementById('cupInput'); btn = document.getElementById('btnStart'); msg = document.getElementById('cupMsg');
    sync();
    input.addEventListener('input', function () {
      var clean = input.value.replace(/[^0-9]/g, '');      // 문자·소수점·부호·특수문자는 입력 불가
      if (clean !== input.value) input.value = clean;
      refresh();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); startIfValid(); return; }
      if (e.key.length === 1 && !/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
    });
    input.addEventListener('focus', function () { try { input.select(); } catch (err) {} });
    document.getElementById('btnIntro').addEventListener('click', function (e) { e.currentTarget.blur(); showSetup(); });
    btn.addEventListener('click', function (e) { e.currentTarget.blur(); startIfValid(); });
  }

  WS.menu = { showSetup: showSetup, init: init, sync: sync, parse: parse, startIfValid: startIfValid };
})();
