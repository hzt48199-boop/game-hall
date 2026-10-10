/* Texas Hold'em AI (virtual chips). Monte-Carlo equity vs random opponent hands, compared with pot odds.
   Level 1: loose / noisy calling station; 2: solid equity player; 3: adds value-bet sizing, semi-bluffs, and stack-aware shoves.
   computeMove(view, seat, level, opts) -> {a, to?} */
(function () {
  var H = (typeof require === 'function') ? require('./holdem.js') : GH.Holdem;
  function equity(s, seat, trials, deadline) {
    var mine = s.hands[seat]; if (!mine) return 0.3;
    var used = {}, i; mine.forEach(function (c) { used[c] = 1; }); s.board.forEach(function (c) { used[c] = 1; });
    var rest = []; for (i = 0; i < 52; i++) if (!used[i]) rest.push(i);
    var opp = 0; for (var p = 1; p <= s.n; p++) if (p !== seat && (s.status[p] === 'active' || s.status[p] === 'allin')) opp++;
    if (!opp) return 1;
    var need = 5 - s.board.length, win = 0, done = 0, len = rest.length;
    for (var t = 0; t < trials; t++) {
      if ((t & 31) === 31 && deadline && Date.now() > deadline) break;
      var k = need + opp * 2; // partial Fisher-Yates
      for (i = 0; i < k; i++) { var j = i + Math.floor(Math.random() * (len - i)), x = rest[i]; rest[i] = rest[j]; rest[j] = x; }
      var board = s.board.concat(rest.slice(0, need)), my = H.evalCards(mine.concat(board)), best = -1, ties = 1, beaten = true;
      for (var o = 0; o < opp; o++) { var sc = H.evalCards([rest[need + o * 2], rest[need + o * 2 + 1]].concat(board)); if (sc > my) { beaten = false; break; } if (sc === my) ties++; }
      if (beaten) win += 1 / ties; done++;
    }
    return done ? win / done : 0.3;
  }
  function computeMove(s, seat, level, opts) {
    opts = opts || {}; var o = H.options(s, seat); if (!o.turn) return null;
    var trials = level === 1 ? 120 : level === 2 ? 300 : 600, eq = equity(s, seat, trials, Date.now() + (opts.timeMs || 250));
    var pot = s.pot, need = o.call, stack = s.stacks[seat], oppN = 0, p;
    for (p = 1; p <= s.n; p++) if (p !== seat && s.status[p] === 'active') oppN++;
    if (level === 1) eq = Math.max(0, Math.min(1, eq + (Math.random() - 0.5) * 0.3));
    var odds = need > 0 ? need / (pot + need) : 0, r = Math.random();
    function raiseBy(frac) {
      if (!o.canRaise) return need > 0 ? { a: 'call' } : { a: 'check' };
      var to = Math.round(s.currentBet + Math.max(s.minRaise, (pot + need) * frac)); to = Math.max(o.raiseMin, Math.min(o.raiseMax, to));
      if (to >= o.raiseMax || (o.raiseMax - to) < s.bb * 2) return { a: 'allin' };
      return { a: 'raise', to: to };
    }
    var committed = need > 0 && need >= stack * 0.4; // calling is a big part of my stack
    if (need === 0) {
      if (level === 1) return eq > 0.7 && r < 0.4 ? raiseBy(0.5) : { a: 'check' };
      if (eq > 0.8) return r < 0.85 ? raiseBy(0.75 + r * 0.3) : { a: 'check' }; // sometimes slow-play
      if (eq > (level === 3 ? 0.58 : 0.64) - 0.04 * Math.max(0, 2 - oppN)) return raiseBy(level === 3 ? 0.5 : 0.4);
      if (level === 3 && oppN <= 2 && r < 0.1 && s.phase !== 'preflop') return raiseBy(0.6); // occasional bluff / probe
      return { a: 'check' };
    }
    var margin = level === 1 ? -0.04 : level === 2 ? 0.05 : 0.03;
    if (eq > 0.85 || (level === 3 && committed && eq > odds + 0.12 && eq > 0.5)) return eq > 0.88 && o.canRaise ? (r < 0.5 ? { a: 'allin' } : raiseBy(1)) : { a: 'call' };
    if (eq > 0.68 + (oppN > 2 ? 0.05 : 0) && level >= 2 && r < 0.6) return raiseBy(0.7);
    if (eq > odds + margin) return { a: 'call' };
    if (level === 3 && need <= s.bb && r < 0.12 && oppN <= 2) return { a: 'call' }; // cheap float
    return { a: 'fold' };
  }
  var API = { computeMove: computeMove, equity: equity };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else (self.GH = self.GH || {}).AIHoldem = API;
})();
