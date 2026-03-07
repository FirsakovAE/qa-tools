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
      document.getElementById('bookmarklet').addEventListener('click', function(e) {
        alert('Drag this button to your bookmarks bar,\nthen use it on any page with a Vue application.');
        e.preventDefault();
      });
    })();

// ── GitHub Release ──
async function fetchLatestRelease() {
  try {
    const res = await fetch('https://api.github.com/repos/FirsakovAE/qa-tools/releases/latest');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    if (!data || !data.tag_name) return;

    const version = data.tag_name;
    const date = data.published_at
      ? new Date(data.published_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
      : '';
    const body = data.body || 'No release notes available.';

    // Render release card
    const card = document.getElementById('releaseCard');
    card.innerHTML = `
      <div class="release-header">
        <div>
          <div class="release-version">${version}</div>
          <div class="release-date">${date}</div>
        </div>
        <a id="releaseDownload" class="btn btn-primary btn-sm" href="#" target="_blank" style="display:none">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v8m0 0l-3-3m3 3l3-3M6 15h12"/></svg>
          Download ${version}
        </a>
      </div>
      <div class="release-body">${marked.parse(body)}</div>
    `;

    // Download link
    let dlUrl = null;
    if (data.assets && data.assets.length > 0) {
      const zip = data.assets.find(a => a.name.includes('.zip') || a.name.includes('.crx') || a.name.toLowerCase().includes('extension'));
      dlUrl = zip ? zip.browser_download_url : data.assets[0].browser_download_url;
    } else {
      dlUrl = 'https://github.com/FirsakovAE/qa-tools/archive/refs/tags/' + version + '.zip';
    }

    // Show download buttons
    const relBtn = document.getElementById('releaseDownload');
    if (relBtn) { relBtn.href = dlUrl; relBtn.style.display = 'inline-flex'; }
    const dlLink = document.getElementById('downloadLink');
    if (dlLink) { dlLink.href = dlUrl; dlLink.style.display = 'inline-flex'; }

    // Update CTA buttons (heroCta stays as #installation)
    const ctaDl = document.getElementById('ctaDownload');
    if (ctaDl && dlUrl) { ctaDl.href = dlUrl; ctaDl.target = '_blank'; }
  } catch (err) {
    const card = document.getElementById('releaseCard');
    card.innerHTML = '<div class="release-error">Failed to load release info. Visit <a href="https://github.com/FirsakovAE/qa-tools/releases" target="_blank">GitHub Releases</a> directly.</div>';
  }
}
fetchLatestRelease();

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