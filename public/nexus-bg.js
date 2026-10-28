/**
 * SRB NEXUS — Ultra-High-Performance Neural Constellation Background Engine
 * Optimized for silky-smooth 60-120 FPS on all devices.
 * Zero layout thrashing, batched GPU draw calls, zero shadowBlur raster lag.
 */
(function() {
  function init() {
    const canvas = document.getElementById('nexus-bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles = [];
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 16 : 30;
    const connectionDistance = isMobile ? 85 : 115;
    const connDistSq = connectionDistance * connectionDistance;
    const mouse = { x: -9999, y: -9999, active: false };
    let targetMouseX = -9999;
    let targetMouseY = -9999;
    let currentGlowX = -9999;
    let currentGlowY = -9999;
    let isVisible = true;
    let isScrolling = false;
    let scrollTimeout = null;
    window.addEventListener('scroll', () => {
      isScrolling = true;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { isScrolling = false; }, 120);
    }, { passive: true });

    let animFrameId = null;

    function resize() {
      // Background ambient canvas is locked to 1.0 DPR for max performance and zero GPU fillrate bottlenecks
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();

    const mouseGlow = document.getElementById('nexus-mouse-glow');
    if (mouseGlow) {
      mouseGlow.style.top = '0';
      mouseGlow.style.left = '0';
      mouseGlow.style.transform = 'translate3d(-9999px, -9999px, 0)';
    }

    window.addEventListener('pointermove', (e) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    }, { passive: true });

    window.addEventListener('pointerleave', () => {
      mouse.active = false;
      targetMouseX = -9999;
      targetMouseY = -9999;
      if (mouseGlow) mouseGlow.style.opacity = '0';
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      isVisible = !document.hidden;
      if (isVisible && !animFrameId) {
        animFrameId = requestAnimationFrame(render);
      }
    });

    const colorPalette = [
      { r: 88, g: 101, b: 242 },  // Blurple #5865F2
      { r: 0, g: 229, b: 255 },   // Cyan #00e5ff
      { r: 236, g: 72, b: 153 },  // Magenta #ec4899
      { r: 255, g: 255, b: 255 }  // Star White
    ];

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.55;
        this.vy = (Math.random() - 0.5) * 0.55;
        this.radius = Math.random() * 1.8 + 1.2;
        this.color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        this.alpha = Math.random() * 0.35 + 0.35;
        this.pulseAngle = Math.random() * Math.PI * 2;
        this.pulseSpeed = Math.random() * 0.025 + 0.01;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.pulseAngle += this.pulseSpeed;

        if (this.x < 0) this.x = width;
        else if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        else if (this.y > height) this.y = 0;

        // Interactive cursor repulsion / swirl (fast squared distance check)
        if (mouse.active) {
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 16900 && distSq > 0) { // 130^2
            const dist = Math.sqrt(distSq);
            const force = (130 - dist) / 130;
            this.x += (dx / dist) * force * 1.5;
            this.y += (dy / dist) * force * 1.5;
          }
        }
      }

      draw() {
        const currentAlpha = Math.max(0.18, this.alpha + Math.sin(this.pulseAngle) * 0.18);
        
        // Fast dual-circle glow (no expensive shadowBlur)
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${currentAlpha * 0.25})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${currentAlpha})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    function render() {
      if (!isVisible) {
        animFrameId = null;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Smoothly interpolate mouse glow only when active and moved
      if (mouseGlow && mouse.active && !isScrolling) {
        const dx = targetMouseX - currentGlowX;
        const dy = targetMouseY - currentGlowY;
        if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
          currentGlowX += dx * 0.35;
          currentGlowY += dy * 0.35;
          mouseGlow.style.transform = `translate3d(${(currentGlowX - 250) | 0}px, ${(currentGlowY - 250) | 0}px, 0)`;
          if (mouseGlow.style.opacity !== '1') mouseGlow.style.opacity = '1';
        }
      }

      // 2. Batch constellation lines into a SINGLE stroke call (huge performance gain)
      ctx.beginPath();
      ctx.lineWidth = 0.9;
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < connDistSq) {
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
          }
        }
      }
      ctx.strokeStyle = 'rgba(88, 101, 242, 0.16)';
      ctx.stroke();

      // 3. Batch cursor tether lines into a SINGLE stroke call (yield during scroll)
      if (mouse.active && !isScrolling) {
        const tetherDistSq = 140 * 140;
        ctx.beginPath();
        ctx.lineWidth = 1.1;
        for (let i = 0; i < particles.length; i++) {
          const p1 = particles[i];
          const mdx = p1.x - mouse.x;
          const mdy = p1.y - mouse.y;
          const mdistSq = mdx * mdx + mdy * mdy;
          if (mdistSq < tetherDistSq) {
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouse.x, mouse.y);
          }
        }
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.32)';
        ctx.stroke();
      }

      // 4. Update and draw particle nodes
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }

      animFrameId = requestAnimationFrame(render);
    }

    animFrameId = requestAnimationFrame(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
