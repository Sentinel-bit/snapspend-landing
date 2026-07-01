// Mobile menu toggle
const menuBtn = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
menuBtn?.addEventListener('click', () => {
  navLinks?.classList.toggle('open');
  menuBtn.innerHTML = navLinks?.classList.contains('open')
    ? '<span style="transform:rotate(45deg) translate(4px,4px)"></span><span style="opacity:0"></span><span style="transform:rotate(-45deg) translate(4px,-4px)"></span>'
    : '<span></span><span></span><span></span>';
});
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    navLinks?.classList.remove('open');
    menuBtn.innerHTML = '<span></span><span></span><span></span>';
  });
});

// Scroll reveal with IntersectionObserver
const observer = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
);
document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));

// Sticky nav background on scroll + active section highlight
const sections = document.querySelectorAll('section[id], div[id]');
const navAnchors = document.querySelectorAll('.nav-links a');
const sectionObserver = new IntersectionObserver(entries => {
  let activeId = '';
  entries.forEach(e => { if (e.isIntersecting) activeId = e.target.id; });
  if (activeId) {
    navAnchors.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + activeId));
  }
}, { threshold: 0.3, rootMargin: '-70px 0px 0px 0px' });
sections.forEach(s => sectionObserver.observe(s));

window.addEventListener('scroll', () => {
  document.querySelector('.nav')?.classList.toggle('scrolled', window.scrollY > 20);
});

// Smooth scroll offset for fixed nav
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href')?.slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' });
  });
});

// ── Interactive Phone Carousel ──
const SCREEN_NAMES = ['Receipts', 'Analytics', 'AI Coach', 'Budgets', 'Tax Helper', 'Receipt Detail'];
let currentScreen = 0;
let autoTimer = null;

const screenEls = document.querySelectorAll('.mock-screen');
const dots = document.querySelectorAll('.dot');
const labelEl = document.getElementById('phone-screen-label');

function goToScreen(index) {
  if (index === currentScreen && screenEls[currentScreen]?.classList.contains('active')) return;
  const prev = currentScreen;
  screenEls.forEach((el, i) => {
    el.classList.remove('active', 'exit');
    if (i === index) el.classList.add('active');
    else if (i === prev) el.classList.add('exit');
  });
  dots.forEach((d, i) => d.classList.toggle('active', i === index));
  if (labelEl) labelEl.textContent = SCREEN_NAMES[index];
  currentScreen = index;
  resetAutoTimer();
}

function nextScreen() {
  goToScreen((currentScreen + 1) % screenEls.length);
}

function prevScreen() {
  goToScreen((currentScreen - 1 + screenEls.length) % screenEls.length);
}

function resetAutoTimer() {
  clearInterval(autoTimer);
  autoTimer = setInterval(nextScreen, 4000);
}

// Click dots
dots.forEach(d => {
  d.addEventListener('click', () => goToScreen(parseInt(d.dataset.index)));
});

// Click phone screen to advance
document.getElementById('phone-screen')?.addEventListener('click', nextScreen);

// Keyboard arrows
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') nextScreen();
  if (e.key === 'ArrowLeft') prevScreen();
});

// Touch swipe on phone
let touchStartX = 0;
const phoneEl = document.getElementById('phone-screen');
phoneEl?.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
phoneEl?.addEventListener('touchend', e => {
  const diff = e.changedTouches[0].screenX - touchStartX;
  if (Math.abs(diff) > 40) diff > 0 ? prevScreen() : nextScreen();
}, { passive: true });

// Pause on hover
document.querySelector('.phone-frame')?.addEventListener('mouseenter', () => clearInterval(autoTimer));
document.querySelector('.phone-frame')?.addEventListener('mouseleave', resetAutoTimer);

goToScreen(0);

// ── Live clock on phone mockup ──
function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  document.querySelectorAll('.mock-clock').forEach(el => el.textContent = `${h}:${m}`);
}
updateClock();
setInterval(updateClock, 10000);

// ── Device Toggle (Phone / Tablet) ──
const deviceBtns = document.querySelectorAll('.device-btn');
const phoneFrame = document.querySelector('.phone-frame');
deviceBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    deviceBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    phoneFrame?.classList.toggle('tablet', btn.dataset.device === 'tablet');
  });
});

// ── Load releases from GitHub Releases API ──
async function loadReleases() {
  const container = document.getElementById('releases-list');
  const badge = document.getElementById('version-badge');
  const downloadsEl = document.getElementById('total-downloads');
  if (!container) return;

  // Check session cache first (1hr TTL)
  const cached = sessionStorage.getItem('snapspend_releases');
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 3600000) {
        renderReleases(data, container, badge, downloadsEl);
        return;
      }
    } catch {}
  }

  let releases;
  let fromCache = false;

  // Try GitHub API
  try {
    const res = await fetch('https://api.github.com/repos/Sentinel-bit/snapspend/releases');
    if (!res.ok) {
      if (res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0') {
        throw new Error('rate_limited');
      }
      throw new Error('API error');
    }
    releases = await res.json();
  } catch (err) {
    if (err.message === 'rate_limited') {
      container.innerHTML = '<div class="loading">API rate limit reached. Showing cached data when available.</div>';
    }
    // Fallback to static releases.json
    try {
      const fallbackRes = await fetch('releases/releases.json');
      if (!fallbackRes.ok) throw new Error();
      const fallback = await fallbackRes.json();
      releases = fallback.map(r => ({
        tag_name: 'v' + r.version,
        published_at: r.date + 'T00:00:00Z',
        body: r.notes,
        assets: [{
          name: r.download.split('/').pop(),
          browser_download_url: r.download,
          size: 0,
          download_count: 0,
        }],
      }));
      fromCache = true;
    } catch {
      container.innerHTML = '<div class="loading">Unable to load releases.</div>';
      return;
    }
  }

  if (!releases || releases.length === 0) {
    container.innerHTML = '<div class="loading">No releases yet. Coming soon!</div>';
    if (badge) badge.textContent = 'v0.0.0';
    return;
  }

  // Cache API response
  if (!fromCache) {
    try {
      sessionStorage.setItem('snapspend_releases', JSON.stringify({ data: releases, timestamp: Date.now() }));
    } catch {}
  }

  renderReleases(releases, container, badge, downloadsEl);
}

function renderReleases(releases, container, badge, downloadsEl) {
  const latest = releases[0];

  // Update hero badge
  if (badge) badge.textContent = latest.tag_name;

  // Calculate total downloads across all releases
  let totalDl = 0;
  releases.forEach(r => {
    (r.assets || []).forEach(a => { totalDl += a.download_count || 0; });
  });
  if (downloadsEl) {
    if (totalDl > 0) {
      downloadsEl.textContent = totalDl >= 1000
        ? (totalDl / 1000).toFixed(totalDl >= 10000 ? 0 : 1) + 'k'
        : String(totalDl);
    } else {
      downloadsEl.textContent = '1k+';
    }
  }

  // Render release list
  container.innerHTML = releases.map(r => {
    const apk = r.assets?.find(a => a.name && a.name.endsWith('.apk'));
    const dlCount = r.assets?.reduce((s, a) => s + (a.download_count || 0), 0) || 0;
    return `
      <div class="release-item" data-reveal>
        <div class="release-version">${r.tag_name}</div>
        <div class="release-meta">
          <div class="release-date">${new Date(r.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div class="release-notes">${(r.body || '').split('\n')[0]}</div>
          ${dlCount > 0 ? `<div class="release-dl-count">${dlCount.toLocaleString()} downloads</div>` : ''}
        </div>
        ${apk && apk.browser_download_url
          ? `<a href="${apk.browser_download_url}" class="release-dl" download>Download APK${apk.size > 0 ? ' (' + (apk.size / 1048576).toFixed(1) + ' MB)' : ''}</a>`
          : '<span class="release-dl" style="opacity:.4">Store Only</span>'}
      </div>
    `;
  }).join('');

  document.querySelectorAll('#releases-list [data-reveal]').forEach(el => observer.observe(el));
}

loadReleases();
