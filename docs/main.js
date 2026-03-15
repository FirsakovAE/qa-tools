// ── Bookmarklet ──
    (function(){
      const baseURL = window.location.origin;
      const code = `
        (function(){
          if(window.__VUE_INSPECTOR_INITIALIZED__) return;
          var b='${baseURL}';
          window.__VUE_INSPECTOR_CONFIG__={baseURL:b};
          window.__VUE_INSPECTOR_INITIALIZED__=true;
          var s=document.createElement('script');
          s.src=b+'/loader.js';
          s.onerror=function(){alert('Vue Inspector: Failed to load from '+b)};
          document.head.appendChild(s);
        })();
      `.replace(/\s+/g, ' ').trim();
      document.getElementById('bookmarklet').href = 'javascript:' + encodeURIComponent(code);
    })();

// ── Fade-in on scroll ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.15 });
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// ── Preview carousel (10s cycle + dot indicators) ──
(function(){
  const carousel = document.getElementById('previewCarousel');
  const dotsContainer = document.getElementById('carouselDots');
  if (!carousel) return;
  const imgs = carousel.querySelectorAll('img');
  if (imgs.length < 2) return;
  const dots = (dotsContainer && dotsContainer.querySelectorAll('.carousel-dot')) || [];
  let idx = 0;
  function goTo(i){
    imgs[idx].classList.remove('active');
    dots[idx] && dots[idx].classList.remove('active');
    idx = (i + imgs.length) % imgs.length;
    imgs[idx].classList.add('active');
    dots[idx] && dots[idx].classList.add('active');
  }
  dots.forEach(function(dot,i){
    dot.addEventListener('click',function(){ goTo(i); });
  });
  setInterval(function(){ goTo(idx + 1); }, 10000);
})();