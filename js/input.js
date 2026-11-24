/* 입력: PC 키보드 + 모바일/마우스 포인터. 물 따르기·이동 종료 경로를 가능한 한 전부 막는다. */
(function () {
  var G = WS.game, resetHolds = function () {};

  function inGame() { return G.mode() === 'play'; }
  function releaseAll() { resetHolds(); G.releaseAll(); }
  function typing(e) { var t = e.target; return t && t.tagName === 'INPUT'; }
  function isR(k) { return k === 'r' || k === 'R' || k === 'ㄱ'; }

  function init() {
    window.addEventListener('keydown', function (e) {
      if (typing(e)) return;
      var k = e.key;
      if (G.mode() === 'result') {
        if (isR(k) && !e.repeat) { e.preventDefault(); G.restart(); }
        return;
      }
      if (!inGame()) return;
      if (k === ' ' || k === 'Spacebar' || e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) G.startPour();        // 키 반복 이벤트로 물이 늘어나지 않음
      } else if (k === 'ArrowLeft') { e.preventDefault(); G.setMove('L', true); }
      else if (k === 'ArrowRight') { e.preventDefault(); G.setMove('R', true); }
      else if (k === 'ArrowUp') { e.preventDefault(); if (!e.repeat) G.moveRow(-1); }     // 한 번에 한 줄 (키 반복 무시)
      else if (k === 'ArrowDown') { e.preventDefault(); if (!e.repeat) G.moveRow(1); }
      else if (isR(k)) { if (!e.repeat) G.restart(); }
    });
    window.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.code === 'Space') { if (inGame()) e.preventDefault(); G.stopPour(); }
      else if (e.key === 'ArrowLeft') G.setMove('L', false);
      else if (e.key === 'ArrowRight') G.setMove('R', false);
    });

    // 모바일 홀드 버튼 3개: 버튼마다 pointerId 를 따로 관리 → 멀티터치 동시 조작
    function hold(id, onChange) {
      var el = document.getElementById(id), ids = {};
      function count() { return Object.keys(ids).length; }
      function down(e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        var was = count(); ids[e.pointerId] = 1;
        el.classList.add('on'); if (!was) onChange(true);
      }
      function up(e) {
        if (!ids[e.pointerId]) return;
        delete ids[e.pointerId];
        if (!count()) { el.classList.remove('on'); onChange(false); }
      }
      el.addEventListener('pointerdown', down);
      ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach(function (t) { el.addEventListener(t, up); });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      el.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
      return function reset() { ids = {}; el.classList.remove('on'); };
    }
    // 줄 이동 버튼: 누를 때마다 한 줄 (손가락마다 독립 → 다른 버튼과 동시에 눌러도 됨)
    function tap(id, dir) {
      var el = document.getElementById(id);
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault(); el.classList.add('on'); G.moveRow(dir);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { el.addEventListener(t, function () { el.classList.remove('on'); }); });
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      el.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
    }
    tap('btnUp', -1); tap('btnDown', 1);
    var resets = [
      hold('btnLeft', function (on) { G.setMove('L', on); }),
      hold('btnRight', function (on) { G.setMove('R', on); }),
      hold('btnPour', function (on) { if (on) G.startPour(); else G.stopPour(); })
    ];
    resetHolds = function () { resets.forEach(function (r) { r(); }); };

    // 안전장치: 포커스 이탈 / 탭 전환 / 백그라운드
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });
    window.addEventListener('pagehide', releaseAll);

    var bs = document.getElementById('btnSound');
    function paintSound() { var on = WS.sound.isOn(); bs.textContent = '물소리 ' + (on ? 'ON' : 'OFF'); bs.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    paintSound();
    bs.addEventListener('click', function (e) { e.currentTarget.blur(); WS.sound.setOn(!WS.sound.isOn()); paintSound(); });
    document.getElementById('btnRestart').addEventListener('click', function (e) { e.currentTarget.blur(); releaseAll(); G.restart(); });
    document.getElementById('btnRetry').addEventListener('click', function (e) { e.currentTarget.blur(); if (WS.battle) WS.battle.clear(); G.showMenu(); WS.menu.showSetup(); });
    document.getElementById('btnSave').addEventListener('click', function (e) { e.currentTarget.blur(); WS.result.savePNG(); });
  }

  WS.input = { init: init };
})();
