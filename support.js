// Optional "Support / donate" button — usually a better fit than ads for an indie
// daily game (no approval, no traffic minimums, friendlier UX). DISABLED until you
// set SUPPORT_URL to your donation page. Empty = nothing renders.
//
//   SUPPORT_URL : e.g. 'https://ko-fi.com/yourname', 'https://buymeacoffee.com/you',
//                 'https://paypal.me/you', or a GitHub Sponsors page.
(function () {
  'use strict';
  var SUPPORT_URL = '';
  var SUPPORT_LABEL = '☕ Support';
  if (!SUPPORT_URL) return;

  var a = document.createElement('a');
  a.href = SUPPORT_URL;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = SUPPORT_LABEL;
  // Sit above the ad bar if that's also enabled.
  var bottom = document.getElementById('ad-bar') ? 84 : 14;
  a.style.cssText = 'position:fixed;right:14px;bottom:' + bottom + 'px;z-index:90;background:#e8a000;color:#111;' +
    "font-family:Inter,-apple-system,sans-serif;font-weight:800;font-size:.8rem;padding:9px 14px;border-radius:999px;" +
    'text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.35)';
  document.body.appendChild(a);
})();
