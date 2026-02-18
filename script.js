// ========================================
// Navigation
// ========================================

const nav = document.getElementById('nav');
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.querySelector('.nav-links');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
});

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  navToggle.classList.toggle('active');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('active');
  });
});

// ========================================
// Scroll animations (Intersection Observer)
// ========================================

const observerOptions = {
  root: null,
  rootMargin: '0px 0px -60px 0px',
  threshold: 0.1,
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animationPlayState = 'running';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.timeline-item').forEach(item => {
  item.style.animationPlayState = 'paused';
  observer.observe(item);
});

// ========================================
// Hero canvas — particle star field
// ========================================

const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d');

let width, height;
const stars = [];
const STAR_COUNT = 200;

function resize() {
  width = canvas.width = canvas.offsetWidth;
  height = canvas.height = canvas.offsetHeight;
}

function initStars() {
  stars.length = 0;
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      alpha: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * Math.PI * 2,
    });
  }
}

function drawStars() {
  ctx.clearRect(0, 0, width, height);

  // Draw connections between nearby stars
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const dx = stars[i].x - stars[j].x;
      const dy = stars[i].y - stars[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        const opacity = (1 - dist / 120) * 0.08;
        ctx.beginPath();
        ctx.moveTo(stars[i].x, stars[i].y);
        ctx.lineTo(stars[j].x, stars[j].y);
        ctx.strokeStyle = `rgba(108, 99, 255, ${opacity})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  // Draw stars
  for (const star of stars) {
    star.pulse += 0.01;
    const flicker = Math.sin(star.pulse) * 0.15;
    const a = Math.max(0.1, Math.min(1, star.alpha + flicker));

    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 200, 230, ${a})`;
    ctx.fill();

    // Move
    star.x += star.vx;
    star.y += star.vy;

    // Wrap
    if (star.x < -5) star.x = width + 5;
    if (star.x > width + 5) star.x = -5;
    if (star.y < -5) star.y = height + 5;
    if (star.y > height + 5) star.y = -5;
  }

  requestAnimationFrame(drawStars);
}

resize();
initStars();
drawStars();

window.addEventListener('resize', () => {
  resize();
  initStars();
});
