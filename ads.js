// Optional bottom ad banner (monetisation). DISABLED until you fill both values
// below with your Google AdSense details. While empty this file does nothing —
// no banner, no external script, no layout shift.
//
//   AD_CLIENT : your AdSense publisher id, e.g. 'ca-pub-1234567890123456'
//   AD_SLOT   : a display ad-unit id from your AdSense dashboard, e.g. '1234567890'
//
// AdSense requires an approved account; create the site + ad unit there first.
(function () {
  'use strict';
  var AD_CLIENT = '';
  var AD_SLOT = '';
  if (!AD_CLIENT || !AD_SLOT) return;

  var bar = document.createElement('div');
  bar.id = 'ad-bar';
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:80;display:flex;justify-content:center;align-items:center;min-height:60px;background:rgba(13,13,13,.92);backdrop-filter:blur(6px);border-top:1px solid rgba(255,255,255,.08)';

  var ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.style.cssText = 'display:inline-block;width:320px;height:50px';
  ins.setAttribute('data-ad-client', AD_CLIENT);
  ins.setAttribute('data-ad-slot', AD_SLOT);
  bar.appendChild(ins);
  document.body.appendChild(bar);
  document.body.style.paddingBottom = '72px';

  var s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + AD_CLIENT;
  document.head.appendChild(s);
  (window.adsbygoogle = window.adsbygoogle || []).push({});
})();
