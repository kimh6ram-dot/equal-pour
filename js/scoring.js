/* 점수 계산 — 공식은 이 파일만 고치면 된다 */
(function () {
  // 컵별 목표량(총량/컵 수) 대비 RMSE → 상대 오차 → 100점 만점. 흘린 물은 컵에 담긴 양이 줄어들어 이미 반영되므로 별도 페널티 없음
  function calcScore(cupVolumes, totalWater) {
    var n = cupVolumes.length, target = totalWater / n;
    var mse = cupVolumes.reduce(function (s, v) { return s + (v - target) * (v - target); }, 0) / n;
    var error = Math.sqrt(mse), errorRate = error / target;
    var score = Math.max(0, 100 - errorRate * 100);
    return {
      score: Math.round(score * 10) / 10,   // 소수 첫째 자리
      error: error, errorRate: errorRate, target: target,
      volumes: cupVolumes.slice()
    };
  }
  WS.scoring = { calcScore: calcScore };
})();
