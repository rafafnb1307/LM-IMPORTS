/* ═══════════════════════════════════════════════════
   NVST Tech — Animated particle background
   Shared across all pages
   ═══════════════════════════════════════════════════ */
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Config — accent colour set per page via data-accent="#rrggbb"
  const raw = canvas.dataset.accent || '109,74,255';
  const [r, g, b] = raw.split(',').map(Number);

  let W, H, particles, mouse = { x: -9999, y: -9999 };

  const CFG = {
    count     : Math.min(90, Math.floor(window.innerWidth / 16)),
    radius    : { min: 1, max: 2.5 },
    speed     : { min: 0.08, max: 0.28 },
    linkDist  : 160,
    mouseForce: 100,
    opacity   : { particle: 0.55, link: 0.12 },
  };

  class Particle {
    constructor() { this.reset(true); }
    reset(init) {
      this.x  = Math.random() * W;
      this.y  = init ? Math.random() * H : -10;
      this.vx = (Math.random() - 0.5) * CFG.speed.max;
      this.vy = (Math.random() * CFG.speed.max + CFG.speed.min) * (Math.random() > 0.5 ? 1 : -1);
      this.r  = CFG.radius.min + Math.random() * (CFG.radius.max - CFG.radius.min);
      this.life   = 0;
      this.maxLife = 220 + Math.random() * 300;
    }
    update() {
      // Mouse repulsion
      const dx = this.x - mouse.x, dy = this.y - mouse.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < CFG.mouseForce) {
        const force = (CFG.mouseForce - dist) / CFG.mouseForce * 0.4;
        this.vx += dx / dist * force;
        this.vy += dy / dist * force;
      }
      // Damping
      this.vx *= 0.995; this.vy *= 0.995;
      this.x += this.vx; this.y += this.vy;
      this.life++;
      // Wrap edges
      if (this.x < -10) this.x = W + 10;
      if (this.x > W + 10) this.x = -10;
      if (this.y < -10) this.y = H + 10;
      if (this.y > H + 10) this.y = -10;
    }
    draw() {
      const fade = Math.min(this.life / 40, (this.maxLife - this.life) / 40, 1);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${CFG.opacity.particle * fade})`;
      ctx.fill();
    }
  }

  function init() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    particles = Array.from({ length: CFG.count }, () => new Particle());
  }

  function drawLinks() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < CFG.linkDist) {
          const alpha = (1 - d / CFG.linkDist) * CFG.opacity.link;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
  }

  let raf;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawLinks();
    particles.forEach(p => { p.update(); p.draw(); });
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => { cancelAnimationFrame(raf); init(); loop(); });
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

  init();
  loop();
})();
