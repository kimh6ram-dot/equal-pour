document.addEventListener('DOMContentLoaded', function () {
  WS.game.init();
  WS.menu.init();
  WS.input.init();
  WS.battle.init();   // 도전장 링크(#battle/...)로 열렸으면 도전장 화면
});
