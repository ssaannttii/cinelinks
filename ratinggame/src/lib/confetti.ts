// Lightweight confetti burst for the rating games — no dependencies, respects
// reduced-motion. Mirrors the vanilla /fx.js used by the other CineLinks games.
const COLORS = ['#e8a000', '#7fd49a', '#f0d878', '#5bbd7a', '#ffffff', '#7aa6e8', '#b58ad6'];

export function confetti(count = 90): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ox = window.innerWidth / 2;
  const oy = window.innerHeight * 0.3;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.style.cssText =
      `position:fixed;top:${oy}px;left:${ox}px;width:8px;height:8px;` +
      `border-radius:${i % 3 === 0 ? '50%' : '2px'};background:${COLORS[i % COLORS.length]};` +
      'pointer-events:none;z-index:9999;will-change:transform,opacity';
    const ang = Math.random() * Math.PI * 2;
    const vel = 4 + Math.random() * 7;
    const vx = Math.cos(ang) * vel;
    let vy = Math.sin(ang) * vel - 7;
    let x = 0, y = 0, rot = Math.random() * 360;
    const t0 = performance.now();
    const dur = 950 + Math.random() * 800;
    const step = (t: number) => {
      const e = t - t0;
      if (e > dur) { p.remove(); return; }
      vy += 0.3; x += vx; y += vy; rot += 9;
      p.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${rot.toFixed(0)}deg)`;
      p.style.opacity = String(Math.max(0, 1 - e / dur));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    document.body.appendChild(p);
  }
}
