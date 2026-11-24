/**
 * РСЯ (Рекламная сеть Яндекса) — только блог.
 * Конфиг: /rsya-config.json (enabled + pageNumber + blockId).
 * Не подключать на money pages.
 */
(function () {
  if (typeof window === "undefined") return;
  var path = (location.pathname || "").replace(/\/+$/, "") || "/";
  var money = { "/": 1, "/salon": 1, "/avtoservis": 1, "/kafe": 1, "/businesses": 1 };
  if (money[path] || !path.startsWith("/blog")) return;

  fetch("/rsya-config.json", { credentials: "omit" })
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (cfg) {
      if (!cfg || !cfg.enabled || !cfg.blockId || !cfg.pageNumber) return;
      var slot =
        document.getElementById(cfg.renderTo || "yandex_rtb_blog") ||
        (function () {
          var el = document.createElement("div");
          el.id = cfg.renderTo || "yandex_rtb_blog";
          el.className = "rsya-slot";
          el.setAttribute("aria-label", "Реклама");
          var footer = document.querySelector(".article-footer");
          if (footer && footer.parentNode) footer.parentNode.insertBefore(el, footer);
          else document.body.appendChild(el);
          return el;
        })();

      window.yaContextCb = window.yaContextCb || [];
      var s = document.createElement("script");
      s.src = "https://yandex.ru/ads/system/context.js";
      s.async = true;
      document.head.appendChild(s);
      slot.hidden = false;
      window.yaContextCb.push(function () {
        try {
          window.Ya.Context.AdvManager.render({
            blockId: cfg.blockId,
            renderTo: slot.id,
            pageNumber: cfg.pageNumber,
          });
        } catch (e) {
          /* ignore */
        }
      });
    })
    .catch(function () {});
})();
