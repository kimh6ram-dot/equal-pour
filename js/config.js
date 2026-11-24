/* 물 똑같이 나누기 — 핵심 수치는 전부 여기서 조정 */
window.WS = window.WS || {};
WS.CONFIG = {
  totalWater: 2000,          // ml — 컵 개수와 관계없이 고정
  minCups: 2,
  maxCups: 50,
  defaultCups: 5,
  cupVolume: 4000 / 3,       // ml — 컵 실제 용량은 컵 개수와 무관하게 고정 (2개일 때 컵당 1000ml = 75%, 50개일 때 40ml = 3%). 같은 ml 은 항상 같은 수위
  pourRate: 500,             // ml/s — 따르는 속도는 컵 개수와 무관하게 고정 (물통 2000ml 를 약 4초에 모두 따름)

  bottleMoveSpeed: 280,      // px/s — 기준 무대 폭(moveRefWidth)에서의 물통 이동 속도 (실제 무대 폭에 비례)
  moveRefWidth: 900,
  moveRampMax: 3.5,          // 이동 키를 계속 누르면 최대 이 배수까지 점점 빨라짐 (컵이 100개여도 끝까지 갈 수 있게)
  moveRampSeconds: 1.5,
  // 열 수·가로폭·컵 크기는 컵 개수별로 WS.getLayoutConfig (js/layout.js) 가 정한다
  basePitch: 54.08,           // px — 컵 크기 100% 일 때 컵 간격 (컵 폭 = 간격 × cupWidthOfPitch)
  gridMarginPitch: 0.88,     // 컵 격자 좌우 여백 합 (간격 단위) — 물통이 가장자리 컵에 닿을 여유
  previewRows: 2,            // 메인 미리보기에 그리는 최대 줄 수 (높이 제한)
  sideRoomPitch: 0.35,       // 컵 격자 바깥쪽으로 물통이 더 갈 수 있는 여유 (컵 간격 단위)
  rowMoveSeconds: 0.24,      // 줄 이동(↑/↓ 한 번) 애니메이션 시간 — 이동 중에는 물 공급 중지
  // 레이아웃 비율 (컵 간격 p 기준 배수)
  cupWidthOfPitch: 0.9, bottleHeightOfPitch: 1.4, rowGapOfPitch: 0.75, topPadOfPitch: 0.25, bottomPadOfPitch: 0.3, pourLiftOfPitch: 0.26,

  streamWidthRatio: 0.07,    // 물줄기 굵기 / 컵 폭
  maxDelta: 0.05,            // s — 탭 비활성 등 큰 deltaTime 차단
  pourStartDelay: 0.1,       // s — 누른 뒤 물줄기가 나타나 물이 나오기까지
  tiltSeconds: 0.16,         // s — 물통 기울기 애니메이션
  streamFadeIn: 0.08,        // s
  streamFadeOut: 0.1,        // s — 물줄기 그래픽 사라짐(공급은 즉시 중단)
  settleSeconds: 0.4,        // s — 수면 흔들림 안정
  endHoldSeconds: 0.5,       // s — 물통이 빈 뒤 결과 화면 전환 전 대기

  // 물통 에셋 (교체 시 여기만 수정): src / 이미지 원본 크기 / 내용 영역 crop / 100×220 좌표계 기준 주둥이 x 오프셋 / 내부 물 영역 path
  bottle: {
    src: 'assets/픽셀풍 반투명 물병.png', imgW: 1086, imgH: 1448, crop: [280, 125, 530, 1225],
    spoutX: -24,
    inner: 'M31 8 L70 8 L68 30 L92 62 L92 211 Q92 215 87 215 L13 215 Q8 215 8 211 L8 62 L32 30 Z'
  },

  storage: { cups: 'waterSplit.v2.cups', best: 'waterSplit.v2.best' }   // 기존 5단계 키(waterSplit.best 등)와 분리
};

// 컵 개수에 따른 설정 — 한 판이 시작될 때 한 번만 계산한다
WS.calcSettings = function (cupCount) {
  var C = WS.CONFIG, targetVolume = C.totalWater / cupCount;
  return {
    cupCount: cupCount,
    targetVolume: targetVolume,
    cupCapacity: C.cupVolume,
    pourRate: C.pourRate
  };
};

// 공유 객체 (game / rendering / result 가 같은 것을 본다)
WS.state = {}; WS.view = {}; WS.geo = {}; WS.els = {};
