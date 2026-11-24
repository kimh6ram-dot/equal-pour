/* 친구 도전장 (주차하기와 같은 구조): 기록을 링크 해시에 담는다(서버 없음).
 * 토큰 v1.<base64url JSON> = { n: 닉네임, c: 컵 개수, s: 점수 }  →  #battle/v1.xxxx
 * 흐름: 결과 [친구에게 도전장 보내기] → 닉네임 → 링크 공유/복사 → 상대가 링크로 진입 → 도전장 화면 → 같은 컵 개수로 플레이 → 대결 결과(A VS B) */
(function () {
  var C = WS.CONFIG, G, challenge = null, lastResult = null, toastTimer = 0;
  function $(id) { return document.getElementById(id); }

  function enc(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function dec(s) { var b = s.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return JSON.parse(decodeURIComponent(escape(atob(b)))); }

  function makeToken(rec) { return 'v1.' + enc({ n: String(rec.nickname || '').slice(0, 12), c: rec.count, s: rec.score }); }
  function parseToken(t) {
    try {
      if (!t || t.indexOf('v1.') !== 0) return null;
      var d = dec(t.slice(3));
      if (typeof d.s !== 'number' || !isFinite(d.s) || d.s < 0 || d.s > 100) return null;
      var c = Math.round(d.c); if (!(c >= C.minCups && c <= C.maxCups)) return null;
      return { nickname: String(d.n || '친구').slice(0, 12), count: c, score: Math.round(d.s * 10) / 10 };
    } catch (e) { return null; }
  }
  function buildUrl(t) { return location.href.split('#')[0] + '#battle/' + t; }
  function parseHash() { var m = location.hash.match(/^#battle\/(.+)$/); return m ? m[1] : null; }

  function toast(msg) {
    var el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function askNickname() {
    return new Promise(function (resolve) {
      var m = $('modal'), input = $('modalInput'), ok = $('modalOk'), cancel = $('modalCancel');
      m.hidden = false; input.value = ''; setTimeout(function () { try { input.focus(); } catch (e) {} }, 30);
      function done(v) { m.hidden = true; ok.onclick = cancel.onclick = null; input.onkeydown = null; resolve(v); }
      ok.onclick = function () { done((input.value || '').trim() || '친구'); };
      cancel.onclick = function () { done(null); };
      input.onkeydown = function (e) { if (e.key === 'Enter') ok.onclick(); else if (e.key === 'Escape') cancel.onclick(); };
    });
  }

  // 터치 기기는 네이티브 공유, 데스크톱은 클립보드 복사 + 토스트
  async function shareLink(url, text) {
    var touch = window.matchMedia && window.matchMedia('(hover:none) and (pointer:coarse)').matches;
    if (touch && navigator.share) {
      try { await navigator.share({ title: '똑같이 나누세요', text: text, url: url }); return 'shared'; }
      catch (e) { if (e && e.name === 'AbortError') return 'aborted'; }
    }
    try { await navigator.clipboard.writeText(url); return 'copied'; } catch (e) { return 'failed'; }
  }

  async function sendChallenge() {
    if (!lastResult) return;
    var nick = await askNickname(); if (nick == null) return;
    var url = buildUrl(makeToken({ nickname: nick, count: lastResult.count, score: lastResult.score }));
    var how = await shareLink(url, '컵 ' + lastResult.count + '개 ' + lastResult.score.toFixed(1) + '점. 이길 수 있으면 해보세요.');
    if (how === 'copied') toast('도전장 링크를 복사했습니다');
    else if (how === 'failed') window.prompt('도전장 링크를 복사하세요', url);
  }

  // ---- 화면 ----
  function openChallenge(rec) {            // 링크로 진입
    challenge = rec;
    $('chCount').textContent = '컵 ' + rec.count + '개';
    $('chScore').innerHTML = rec.score.toFixed(1) + '<span class="u">점</span>';
    $('chName').textContent = rec.nickname + '의 기록';
    G.showScreen('challenge');
  }
  function startChallenge() { if (challenge) G.start(challenge.count); }

  function onResult(res, count) {          // 게임 종료 → 결과 화면이 뜨기 직전 호출
    lastResult = { score: res.score, count: count };
    $('btnVs').hidden = !(challenge && challenge.count === count);
  }
  function showBattle() {
    if (!challenge || !lastResult) return;
    var a = challenge.score, b = lastResult.score, diff = Math.round((b - a) * 10) / 10;
    $('vsAName').textContent = challenge.nickname; $('vsBName').textContent = '나';
    $('vsAScore').textContent = a.toFixed(1); $('vsBScore').textContent = b.toFixed(1);
    $('vsACount').textContent = $('vsBCount').textContent = '컵 ' + challenge.count + '개';
    $('vsWinner').textContent = diff > 0 ? '이겼습니다. ' + diff.toFixed(1) + '점 차이.' : diff < 0 ? '졌습니다. ' + (-diff).toFixed(1) + '점 부족.' : '무승부. 한 번 더.';
    $('vsA').classList.toggle('win', diff < 0); $('vsB').classList.toggle('win', diff > 0);
    G.showScreen('battle');
  }
  function clear() { challenge = null; $('btnVs').hidden = true; }

  function init() {
    G = WS.game;
    $('btnChallenge').addEventListener('click', function (e) { e.currentTarget.blur(); sendChallenge(); });
    $('btnVs').addEventListener('click', function (e) { e.currentTarget.blur(); showBattle(); });
    $('btnChStart').addEventListener('click', function (e) { e.currentTarget.blur(); startChallenge(); });
    $('btnRematch').addEventListener('click', function (e) { e.currentTarget.blur(); startChallenge(); });
    $('btnVsDetail').addEventListener('click', function (e) { e.currentTarget.blur(); G.showScreen('result'); });
    var t = parseHash(), rec = t && parseToken(t);
    if (rec) openChallenge(rec);
  }

  WS.battle = { init: init, makeToken: makeToken, parseToken: parseToken, buildUrl: buildUrl, parseHash: parseHash, onResult: onResult, clear: clear, openChallenge: openChallenge, current: function () { return challenge; } };
})();
