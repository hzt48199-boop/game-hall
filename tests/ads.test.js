const test = require('node:test'), assert = require('node:assert');
const Ads = require('../server/ads');
const mk = () => { let t = Date.UTC(2026, 9, 10, 10, 0, 0); const clock = { now: () => t, adv: ms => { t += ms; } }; return { clock, ads: Ads.create({}, clock.now) }; };

test('ticket + min elapsed time + grant 500', () => {
  const { clock, ads } = mk(); const s = ads.start('p1'); assert.ok(s.ok && s.ticket && s.remaining === 5);
  clock.adv(2000); const early = ads.claim('p1', s.ticket); assert.equal(early.code, 'toosoon');
  clock.adv(3000); const g = ads.claim('p1', s.ticket); assert.ok(g.ok); assert.equal(g.granted, 500); assert.equal(g.remaining, 4);
});
test('ticket is single-use and bound to the player', () => {
  const { clock, ads } = mk(); const s = ads.start('p1'); clock.adv(5100);
  assert.equal(ads.claim('p2', s.ticket).code, 'badticket'); assert.equal(ads.claim('p1', 'nope').code, 'badticket');
  assert.ok(ads.claim('p1', s.ticket).ok); assert.equal(ads.claim('p1', s.ticket).code, 'badticket');
});
test('cooldown between claims', () => {
  const { clock, ads } = mk(); let s = ads.start('p1'); clock.adv(5100); ads.claim('p1', s.ticket);
  const d = ads.start('p1'); assert.equal(d.code, 'cooldown'); assert.ok(d.cooldownMs > 0 && d.cooldownMs <= 60000);
  clock.adv(60000); assert.ok(ads.start('p1').ok);
});
test('daily cap of 5, resets next UTC day', () => {
  const { clock, ads } = mk();
  for (let i = 0; i < 5; i++) { const s = ads.start('p1'); assert.ok(s.ok, 'start ' + i); clock.adv(5100); assert.ok(ads.claim('p1', s.ticket).ok); clock.adv(60000); }
  assert.equal(ads.start('p1').code, 'cap'); assert.equal(ads.status('p1').remaining, 0);
  clock.adv(24 * 3600 * 1000); assert.ok(ads.start('p1').ok); assert.equal(ads.status('p1').remaining, 5);
});
test('expired ticket rejected; second start invalidates the first', () => {
  const { clock, ads } = mk(); const a = ads.start('p1'); const b = ads.start('p1'); clock.adv(5100);
  assert.equal(ads.claim('p1', a.ticket).code, 'badticket'); assert.ok(ads.claim('p1', b.ticket).ok);
  clock.adv(60000); const c = ads.start('p1'); clock.adv(11 * 60 * 1000); assert.equal(ads.claim('p1', c.ticket).code, 'expired');
});
test('per-IP daily cap limits token farming', () => {
  const { clock, ads } = mk(); let ok = 0;
  for (let i = 0; i < 30; i++) { const s = ads.start('farm' + i, '1.2.3.4'); if (!s.ok) continue; clock.adv(5100); if (ads.claim('farm' + i, s.ticket, '1.2.3.4').ok) ok++; }
  assert.equal(ok, 20);
});
