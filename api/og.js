// Dynamic Open Graph result-card image (1200×630) for link unfurls. Rendered on
// Vercel's Edge runtime with @vercel/og (satori → raster PNG), so a shared link
// previews the player's actual result instead of one static image.
//
//   /api/og?g=cl&a=Tom%20Hanks&b=Pixar&n=6&k=12      → CineLinks result card
//   /api/og?g=trumps&w=14&l=0                          → Top Trumps win card
//   /api/og?title=...&sub=...                          → generic card
//
// Self-contained: no external images or emoji (which need extra fonts), so the
// only render dependency is @vercel/og's bundled default font.
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const GOLD = '#e8a000';
const BG = '#0d0d0d';

// Tiny hyperscript so we don't need JSX tooling. Returns React-element-shaped
// objects, which is exactly what satori consumes.
function h(type, props, ...children) {
  return { type, props: { ...(props || {}), children: children.length <= 1 ? children[0] : children } };
}
function clamp(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function hexA(hex, a) {
  const h2 = String(hex).replace('#', '');
  const r = parseInt(h2.slice(0, 2), 16), g = parseInt(h2.slice(2, 4), 16), b = parseInt(h2.slice(4, 6), 16);
  return 'rgba(' + (r || 0) + ',' + (g || 0) + ',' + (b || 0) + ',' + a + ')';
}
const RARITY_C = { legendary: '#e8c24a', elite: '#b58ad6', rare: '#7aa6e8', common: '#cfcfcf' };

export default function handler(req) {
  const p = new URL(req.url).searchParams;
  const g = p.get('g') || 'cl';
  const n = p.get('n'), k = p.get('k');
  const a = p.get('a'), b = p.get('b');

  // Collectible-card share: /api/og?g=card&title=Name&r=legendary&n=74&sub=Film&im=/poster.jpg
  if (g === 'card') {
    const rarity = String(p.get('r') || 'common').toLowerCase();
    const rc = RARITY_C[rarity] || RARITY_C.common;
    const name = clamp(p.get('title') || 'CineLinks', 40);
    const no = p.get('n') ? ('#' + String(p.get('n')).replace(/^#/, '')) : '';
    const ty = clamp(p.get('sub') || 'Film', 16);
    const rlabel = rarity.charAt(0).toUpperCase() + rarity.slice(1);
    const imRaw = p.get('im') || '';
    const poster = imRaw ? (/^https?:/i.test(imRaw) ? imRaw : 'https://image.tmdb.org/t/p/w500' + (imRaw.charAt(0) === '/' ? '' : '/') + imRaw) : '';

    const metaRow = [
      h('div', { style: { width: 34, height: 34, background: rc, transform: 'rotate(45deg)', borderRadius: 6 } }),
      h('div', { style: { display: 'flex', color: rc, fontSize: 40, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' } }, rlabel),
      h('div', { style: { display: 'flex', color: '#8a8a8a', fontSize: 34 } }, '·'),
      h('div', { style: { display: 'flex', color: '#c8c8c8', fontSize: 36 } }, ty)
    ];
    if (no) { metaRow.push(h('div', { style: { display: 'flex', color: '#8a8a8a', fontSize: 34 } }, '·')); metaRow.push(h('div', { style: { display: 'flex', color: '#c8c8c8', fontSize: 36 } }, no)); }

    const posterBox = h('div', {
      style: { display: 'flex', width: 360, height: 504, borderRadius: 22, overflow: 'hidden', border: '6px solid ' + rc, boxShadow: '0 20px 60px rgba(0,0,0,0.55)', backgroundColor: '#0a1830', flexShrink: 0 }
    }, poster
      ? h('img', { src: poster, width: 360, height: 504, style: { width: 360, height: 504, objectFit: 'cover' } })
      : h('div', { style: { display: 'flex', width: 360, height: 504, backgroundImage: 'radial-gradient(120% 80% at 50% 0%, ' + hexA(rc, 0.5) + ', #0a1830)' } }));

    const cardImg = h('div', {
      style: {
        width: '1200px', height: '630px', display: 'flex', alignItems: 'center', padding: '72px',
        backgroundColor: BG, color: '#f5f5f5', backgroundImage: 'radial-gradient(900px circle at 82% -12%, ' + hexA(rc, 0.22) + ', transparent 55%)'
      }
    },
      posterBox,
      h('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, marginLeft: 64 } },
        h('div', { style: { display: 'flex', alignItems: 'center', fontSize: 32, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 22 } },
          h('span', { style: { color: '#f5f5f5' } }, 'CINE'), h('span', { style: { color: GOLD } }, 'LINKS')),
        h('div', { style: { display: 'flex', color: '#9a9a9a', fontSize: 26, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 } }, 'Just collected'),
        h('div', { style: { display: 'flex', color: '#ffffff', fontSize: 74, fontWeight: 600, lineHeight: 1.03 } }, name),
        h('div', { style: { display: 'flex', alignItems: 'center', marginTop: 26, gap: 16 } }, ...metaRow),
        h('div', { style: { display: 'flex', marginTop: 40, alignItems: 'center', alignSelf: 'flex-start', background: GOLD, color: '#111', fontSize: 28, fontWeight: 600, padding: '14px 28px', borderRadius: 14 } }, 'Start your collection →')
      )
    );
    return new ImageResponse(cardImg, {
      width: 1200, height: 630,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable' }
    });
  }

  let kicker = "Today's link", main = 'CineLinks', route = '', sub = 'A daily film-connection puzzle';
  if (g === 'trumps') {
    kicker = 'Top Trumps · vs CPU';
    main = (p.get('w') || '0') + ' – ' + (p.get('l') || '0');
    sub = 'Movie card battle';
  } else if (g === 'generic' || p.get('title')) {
    kicker = 'CineLinks';
    main = clamp(p.get('title') || 'CineLinks', 42);
    sub = clamp(p.get('sub') || 'A daily film puzzle', 60);
  } else {
    main = n ? 'Solved in ' + clamp(n, 4) + ' click' + (n === '1' ? '' : 's') : 'CineLinks';
    if (a && b) route = clamp(a, 34) + '  →  ' + clamp(b, 34);
  }

  const tag = (label) => h('div', {
    style: { display: 'flex', alignItems: 'center', background: 'rgba(232,160,0,0.14)', border: '1px solid rgba(232,160,0,0.5)', color: GOLD, fontSize: 26, fontWeight: 600, padding: '10px 22px', borderRadius: 999 }
  }, label);

  const card = h('div', {
    style: {
      width: '1200px', height: '630px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '72px', backgroundColor: BG, color: '#f5f5f5', position: 'relative',
      backgroundImage: 'radial-gradient(900px circle at 80% -10%, rgba(232,160,0,0.18), transparent 55%)'
    }
  },
    // top: wordmark
    h('div', { style: { display: 'flex', alignItems: 'center', fontSize: 36, fontWeight: 600, letterSpacing: '0.04em' } },
      h('span', { style: { color: '#f5f5f5' } }, 'CINE'),
      h('span', { style: { color: GOLD } }, 'LINKS')
    ),
    // middle: kicker + headline + route
    h('div', { style: { display: 'flex', flexDirection: 'column' } },
      h('div', { style: { display: 'flex', color: '#9a9a9a', fontSize: 28, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 } }, kicker),
      h('div', { style: { display: 'flex', color: GOLD, fontSize: 96, fontWeight: 600, lineHeight: 1.02 } }, main),
      route
        ? h('div', { style: { display: 'flex', color: '#f0f0f0', fontSize: 42, fontWeight: 600, marginTop: 22 } }, route)
        : h('div', { style: { display: 'flex', color: '#b8b8b8', fontSize: 34, marginTop: 18 } }, sub)
    ),
    // bottom: streak + CTA
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      h('div', { style: { display: 'flex', alignItems: 'center', color: '#9a9a9a', fontSize: 28 } },
        k ? tag(clamp(k, 4) + '-day streak') : h('div', { style: { display: 'flex' } }, 'cinelinks.vercel.app')
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', background: GOLD, color: '#111', fontSize: 30, fontWeight: 600, padding: '14px 30px', borderRadius: 14 } }, 'Play today →')
    )
  );

  return new ImageResponse(card, {
    width: 1200, height: 630,
    headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable' }
  });
}
