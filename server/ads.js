'use strict';
/* Rewarded-ad ticket logic (virtual chips only, no cash value). Pure + clock-injectable so it is unit-testable.
   Flow: start(pid) -> one-time ticket; after the ad, claim(pid, ticket) -> grant AMOUNT chips.
   Rules: ticket single-use, >= MIN_MS between start and claim, ticket expires after TTL_MS,
   COOLDOWN_MS between claims, DAILY_CAP claims per UTC day per player id (and a looser cap per IP key). */
const crypto = require('crypto');
const DEFAULTS = { amount: 500, minMs: 5000, ttlMs: 10 * 60 * 1000, cooldownMs: 60 * 1000, dailyCap: 5, ipDailyCap: 20 };
function create(opts, now) {
  const C = Object.assign({}, DEFAULTS, opts || {}); now = now || Date.now;
  const players = new Map(); // pid -> { day, count, lastClaim, ticket:{id,start} }
  const ips = new Map();     // ip -> { day, count }
  const day = () => new Date(now()).toISOString().slice(0, 10);
  function rec(pid) {
    let r = players.get(pid); const d = day();
    if (!r) { r = { day: d, count: 0, lastClaim: 0, ticket: null }; players.set(pid, r); }
    if (r.day !== d) { r.day = d; r.count = 0; }
    return r;
  }
  function ipRec(ip) { let r = ips.get(ip); const d = day(); if (!r || r.day !== d) { r = { day: d, count: 0 }; ips.set(ip, r); } return r; }
  function status(pid) {
    const r = rec(pid), cd = Math.max(0, r.lastClaim + C.cooldownMs - now());
    return { amount: C.amount, cap: C.dailyCap, remaining: Math.max(0, C.dailyCap - r.count), cooldownMs: r.lastClaim ? cd : 0, minMs: C.minMs };
  }
  function deny(code, pid) { return Object.assign({ ok: false, code }, status(pid)); }
  function start(pid, ip) {
    const r = rec(pid);
    if (r.count >= C.dailyCap) return deny('cap', pid);
    if (ip && ipRec(ip).count >= C.ipDailyCap) return deny('cap', pid);
    if (r.lastClaim && now() < r.lastClaim + C.cooldownMs) return deny('cooldown', pid);
    r.ticket = { id: crypto.randomBytes(16).toString('hex'), start: now() };
    return Object.assign({ ok: true, ticket: r.ticket.id }, status(pid));
  }
  function claim(pid, ticket, ip) {
    const r = rec(pid), tk = r.ticket;
    if (!tk || typeof ticket !== 'string' || tk.id !== ticket) return deny('badticket', pid);
    if (now() - tk.start > C.ttlMs) { r.ticket = null; return deny('expired', pid); }
    if (now() - tk.start < C.minMs) return Object.assign(deny('toosoon', pid), { waitMs: C.minMs - (now() - tk.start) }); // ticket kept: the client may retry after the wait
    r.ticket = null; // single use
    if (r.count >= C.dailyCap) return deny('cap', pid);
    if (r.lastClaim && now() < r.lastClaim + C.cooldownMs) return deny('cooldown', pid);
    if (ip) { const ir = ipRec(ip); if (ir.count >= C.ipDailyCap) return deny('cap', pid); ir.count++; }
    r.count++; r.lastClaim = now();
    return Object.assign({ ok: true, granted: C.amount }, status(pid));
  }
  function prune() { const d = day(); players.forEach((r, k) => { if (r.day !== d && !r.ticket) players.delete(k); }); ips.forEach((r, k) => { if (r.day !== d) ips.delete(k); }); }
  return { start, claim, status, prune, config: C };
}
module.exports = { create, DEFAULTS };
