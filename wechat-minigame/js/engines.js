(function () {
  var R = typeof require === 'function';
  var G = R ? require('./gomoku.js') : GH.Gomoku;
  var X = R ? require('./xiangqi.js') : GH.Xiangqi;
  var L = R ? require('./luzhanqi.js') : GH.Luzhanqi;
  var D = R ? require('./doudizhu.js') : GH.Doudizhu;
  var M = R ? require('./mahjong.js') : GH.Mahjong;
  var Z = R ? require('./zhajinhua.js') : GH.Zhajinhua;
  var CH = R ? require('./chess.js') : GH.Chess;
  var HE = R ? require('./holdem.js') : GH.Holdem;
  // seats: 每局座位数; multi: 3/4 人游戏(支持电脑补位、一人离开由电脑托管)
  var SEATS = { gomoku: 2, xiangqi: 2, luzhanqi: 2, doudizhu: 3, mahjong: 4, zhajinhua: 6, chess: 2, holdem: 6 };
  var API = { gomoku: G, xiangqi: X, luzhanqi: L, doudizhu: D, mahjong: M, zhajinhua: Z, chess: CH, holdem: HE, list: ['holdem', 'chess', 'gomoku', 'xiangqi', 'luzhanqi', 'doudizhu', 'mahjong', 'zhajinhua'], SEATS: SEATS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).Engines = API;
})();
