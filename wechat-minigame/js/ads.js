/* AdProvider abstraction for the "Watch ad, get chips" feature (virtual chips only, no cash value).
   A provider is { name, placeholder:boolean, show(ctx): Promise<boolean> }  - resolve true ONLY when the ad was fully watched
   (reward earned), false on skip / no fill / error. ctx = { minMs }. The server independently enforces ticket, timing,
   cooldown and daily cap, so a provider cannot mint chips by itself.
   Selecting a provider: GH_CONFIG.adProvider (web/js/config.js) = 'placeholder' (default) or the name of a registered provider.
   See README "Plugging in a real ad network". */
(function () {
  var Ads = { providers: {}, state: null, onChange: null, name: 'placeholder' };
  function changed() { if (Ads.onChange) Ads.onChange(); }
  /* Placeholder: the app draws a labelled "Ad placeholder" panel from Ads.state; the claim button calls Ads.finish(true). */
  Ads.register = function (p) { if (p && p.name && typeof p.show === 'function') Ads.providers[p.name] = p; };
  Ads.register({
    name: 'placeholder', placeholder: true,
    show: function (ctx) {
      return new Promise(function (resolve) {
        Ads.state = { start: Date.now(), ms: (ctx && ctx.minMs) || 5000, resolve: resolve }; changed();
      });
    }
  });
  Ads.use = function (name) { if (Ads.providers[name]) Ads.name = name; return Ads.name; };
  Ads.current = function () { return Ads.providers[Ads.name] || Ads.providers.placeholder; };
  Ads.isPlaceholder = function () { return !!Ads.current().placeholder; };
  Ads.left = function () { var s = Ads.state; return s ? Math.max(0, s.ms - (Date.now() - s.start)) : 0; };
  Ads.finish = function (ok) { var s = Ads.state; if (!s) return; if (ok && Ads.left() > 0) return; Ads.state = null; s.resolve(!!ok); changed(); };
  Ads.show = function (ctx) {
    var p = Ads.current();
    return Promise.resolve().then(function () { return p.show(ctx || {}); }).then(function (r) { return r === true; }, function () { return false; });
  };
  var cfg = (typeof self !== 'undefined' && self.GH_CONFIG) || (typeof GH_CONFIG !== 'undefined' && GH_CONFIG) || {};
  if (cfg.adProvider) Ads.use(cfg.adProvider);
  if (typeof module !== 'undefined' && module.exports) module.exports = Ads; else (self.GH = self.GH || {}).Ads = Ads;
})();
