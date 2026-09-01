/**
 * AnimePlus — Minimal Splash Screen Controller
 * Calm, clean, and relaxing.
 */
(function () {
  "use strict";

  /* ─── Config ─── */
  var SPLASH_DURATION = 3500;   // 3.5 seconds
  var SHOW_EVERY_PAGE = false;  // false = once per session only
  var SESSION_KEY     = "animePlus_splashSeen";

  /* ─── Skip if already shown this session ─── */
  if (!SHOW_EVERY_PAGE && sessionStorage.getItem(SESSION_KEY)) {
    return;
  }

  /* ─── Detect asset path based on current page location ─── */
  var inViews   = window.location.pathname.indexOf("/views/") !== -1;
  var assetBase = inViews ? "../" : "";
  var LOGO_SRC  = assetBase + "assets/images/\u0644\u0642\u0637\u0629_\u0634\u0627\u0634\u0629_2025-06-14_185723-removebg-preview.png";

  /* ─── Inject CSS immediately ─── */
  if (!document.querySelector('link[href*="splash.css"]')) {
    var link  = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = assetBase + "css/splash.css";
    document.head.insertBefore(link, document.head.firstChild);
  }

  /* ─── Build minimal splash HTML ─── */
  var splashHtml = 
    '<div id="splash-screen" role="dialog" aria-label="Loading AnimePlus">' +
      '<div class="splash-content">' +
        '<img class="splash-logo" src="' + LOGO_SRC + '" alt="AnimePlus Logo" draggable="false" />' +
        '<div class="splash-loader-line"></div>' +
      '</div>' +
    '</div>';

  /* ─── Wait for <body> to exist, then inject ─── */
  function initSplash() {
    if (!document.body) return;

    document.body.insertAdjacentHTML("afterbegin", splashHtml);
    document.body.classList.add("splash-active");

    /* ─── Dismiss splash ─── */
    var dismissed = false;
    function dismissSplash() {
      if (dismissed) return;
      dismissed = true;

      var splash = document.getElementById("splash-screen");
      if (!splash) return;

      setTimeout(function () {
        splash.classList.add("splash-fade-out");
        document.body.classList.remove("splash-active");

        var removed = false;
        function removeSplash() {
          if (!removed && splash.parentNode) {
            splash.parentNode.removeChild(splash);
            removed = true;
          }
        }

        splash.addEventListener("transitionend", removeSplash, { once: true });
        setTimeout(removeSplash, 1500); // fallback
      }, 200);

      sessionStorage.setItem(SESSION_KEY, "1");
    }

    /* ─── Auto dismiss after SPLASH_DURATION ─── */
    var autoTimer = setTimeout(dismissSplash, SPLASH_DURATION);

    /* ─── Also dismiss when page fully loads ─── */
    window.addEventListener("load", function () {
      clearTimeout(autoTimer);
      var elapsed   = typeof performance !== "undefined" ? performance.now() : SPLASH_DURATION;
      // Guarantee it stays for at least 2 seconds so it doesn't flash quickly
      var remaining = Math.max(0, 2000 - elapsed);
      setTimeout(dismissSplash, remaining);
    });

    /* ─── Dismiss on click ─── */
    var splashEl = document.getElementById("splash-screen");
    if (splashEl) {
      splashEl.addEventListener("click", function () {
        clearTimeout(autoTimer);
        dismissSplash();
      });
    }
  }

  /* ─── Run as early as possible ─── */
  if (document.body) {
    initSplash();
  } else {
    document.addEventListener("DOMContentLoaded", initSplash);
  }

})();