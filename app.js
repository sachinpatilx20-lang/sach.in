/* ═══════════════════════════════════════════════════════
   Sach.in — Link Manager  |  app.js
   ═══════════════════════════════════════════════════════ */

// ─── State ───────────────────────────────────────────────
let links        = JSON.parse(localStorage.getItem('sachin_links') || '[]');
let currentFilter = 'all';
let searchQuery   = '';
let currentView   = 'links';
let toastTimer    = null;

// ─── DOM refs ────────────────────────────────────────────
const urlInput    = document.getElementById('url-input');
const addBtn      = document.getElementById('add-btn');
const loadingCard = document.getElementById('loading-card');
const loadingUrl  = document.getElementById('loading-url');
const linksList   = document.getElementById('links-list');
const emptyState  = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const clearSearch = document.getElementById('clear-search');
const linkCount   = document.getElementById('link-count');
const sectionLabel = document.getElementById('section-label');
const toast       = document.getElementById('toast');

// ─── Persistence ─────────────────────────────────────────
function save() {
  localStorage.setItem('sachin_links', JSON.stringify(links));
  linkCount.textContent = links.length;
}

// ─── Utility ─────────────────────────────────────────────
function extractDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function detectType(url, data) {
  const domain = extractDomain(url).toLowerCase();
  if (/youtube|vimeo|twitch/.test(domain))                       return 'video';
  if (/twitter|instagram|facebook|linkedin|reddit/.test(domain)) return 'social';
  if (data?.type === 'article' || data?.publisher)               return 'article';
  return 'web';
}

function typeEmoji(type) {
  return { video: '▶', social: '💬', article: '📝', web: '🌐' }[type] || '🌐';
}

// ─── Metadata fetch ──────────────────────────────────────
async function fetchMeta(url) {
  const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error('API error');
  const { status, data } = await res.json();
  if (status !== 'success') throw new Error('No data');
  return {
    title:       data.title || extractDomain(url),
    description: data.description || '',
    image:       data.image?.url || data.logo?.url || null,
    favicon:     data.logo?.url || `https://www.google.com/s2/favicons?domain=${extractDomain(url)}&sz=32`,
    domain:      extractDomain(url),
    type:        detectType(url, data),
  };
}

// ─── Add link ────────────────────────────────────────────
async function addLink() {
  let url = urlInput.value.trim();
  if (!url) return;
  if (!url.startsWith('http')) url = 'https://' + url;

  try { new URL(url); }
  catch { showToast('Invalid URL', 'error'); return; }

  if (links.find(l => l.url === url)) {
    showToast('Already saved!', 'error');
    return;
  }

  // Show loading state
  loadingUrl.textContent = extractDomain(url);
  loadingCard.classList.add('show');
  addBtn.disabled = true;
  urlInput.value  = '';

  try {
    const meta = await fetchMeta(url);
    const link = buildLink(url, meta);
    links.unshift(link);
    save();
    render();
    showToast('✓ Link saved!', 'success');
  } catch {
    // Graceful fallback — save without preview
    const domain = extractDomain(url);
    const link = buildLink(url, {
      title:       domain,
      description: '',
      image:       null,
      favicon:     `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
      domain,
      type:        'web',
    });
    links.unshift(link);
    save();
    render();
    showToast('Saved (no preview)', 'success');
  } finally {
    loadingCard.classList.remove('show');
    addBtn.disabled = false;
  }
}

function buildLink(url, meta) {
  return {
    id:          Date.now(),
    url,
    title:       meta.title,
    description: meta.description,
    image:       meta.image,
    favicon:     meta.favicon,
    domain:      meta.domain,
    type:        meta.type,
    saved:       new Date().toISOString(),
    starred:     false,
  };
}

// ─── Render ──────────────────────────────────────────────
function getFiltered() {
  let list = [...links];

  if (currentView === 'favorites') list = list.filter(l => l.starred);
  if (currentView === 'recent')    list = list.slice(0, 10);

  if (currentFilter === 'recent')   list = list.slice(0, 8);
  if (currentFilter === 'articles') list = list.filter(l => l.type === 'article');
  if (currentFilter === 'videos')   list = list.filter(l => l.type === 'video');
  if (currentFilter === 'social')   list = list.filter(l => l.type === 'social');

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.domain.toLowerCase().includes(q) ||
      (l.description || '').toLowerCase().includes(q)
    );
  }
  return list;
}

function cardHTML(link) {
  const thumb = link.image
    ? `<img class="card-thumb" src="${escHtml(link.image)}" alt="" loading="lazy"
          onerror="handleThumbError(this, ${link.id})">`
    : `<div class="card-thumb-placeholder">${typeEmoji(link.type)}</div>`;

  const desc = link.description
    ? `<div class="card-desc">${escHtml(link.description)}</div>`
    : '';

  const starLabel = link.starred ? '⭐ Starred' : '☆ Star';
  const starClass = link.starred ? 'card-action starred' : 'card-action';

  return `
    <div class="link-card" id="card-${link.id}">
      ${thumb}
      <div class="card-tag">${typeEmoji(link.type)} ${link.type}</div>
      <div class="card-body">
        <div class="card-site">
          <img class="card-favicon" src="${escHtml(link.favicon)}" alt=""
            onerror="handleFavError(this)">
          <div class="card-favicon-fallback">${link.domain[0].toUpperCase()}</div>
          <div class="card-domain">${escHtml(link.domain)}</div>
          <div class="card-date">${timeAgo(link.saved)}</div>
        </div>
        <div class="card-title">${escHtml(link.title)}</div>
        ${desc}
        <div class="card-actions">
          <button class="card-action open"   onclick="openLink(${link.id})">↗ Open</button>
          <button class="card-action copy"   onclick="copyLink(${link.id})">⧉ Copy</button>
          <button class="${starClass}"        onclick="toggleStar(${link.id})">${starLabel}</button>
          <button class="card-action delete" onclick="deleteLink(${link.id})">✕</button>
        </div>
      </div>
    </div>`;
}

function render() {
  const list = getFiltered();

  if (!list.length) {
    linksList.innerHTML = '';
    emptyState.classList.add('show');
    emptyState.querySelector('.empty-title').textContent =
      searchQuery ? 'No results found' : 'No links yet';
    emptyState.querySelector('.empty-sub').innerHTML = searchQuery
      ? 'Try a different search term'
      : 'Paste any URL above to<br>save it with a rich preview';
    return;
  }

  emptyState.classList.remove('show');
  linksList.innerHTML = list.map(cardHTML).join('');
}

// ─── Image error handlers ─────────────────────────────────
function handleThumbError(img, id) {
  img.remove();
  const card = document.getElementById(`card-${id}`);
  if (!card) return;
  const ph = document.createElement('div');
  ph.className = 'card-thumb-placeholder';
  const link = links.find(l => l.id === id);
  ph.textContent = link ? typeEmoji(link.type) : '🌐';
  card.insertBefore(ph, card.querySelector('.card-body'));
}

function handleFavError(img) {
  img.style.display = 'none';
  const fallback = img.nextElementSibling;
  if (fallback) fallback.style.display = 'flex';
}

// ─── Card actions ─────────────────────────────────────────
function openLink(id) {
  const link = links.find(l => l.id === id);
  if (link) window.open(link.url, '_blank');
}

function copyLink(id) {
  const link = links.find(l => l.id === id);
  if (!link) return;
  navigator.clipboard.writeText(link.url)
    .then(() => showToast('✓ Copied!', 'success'))
    .catch(() => showToast('Copy failed', 'error'));
}

function deleteLink(id) {
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.style.opacity   = '0';
    card.style.transform = 'scale(0.95)';
  }
  setTimeout(() => {
    links = links.filter(l => l.id !== id);
    save();
    render();
  }, 200);
  showToast('Deleted', '');
}

function toggleStar(id) {
  const link = links.find(l => l.id === id);
  if (!link) return;
  link.starred = !link.starred;
  save();
  render();
  showToast(link.starred ? '⭐ Starred!' : 'Unstarred', link.starred ? 'success' : '');
}

// ─── Filters & views ─────────────────────────────────────
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.filter === filter)
  );
  render();
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(n =>
    n.classList.toggle('active', n.dataset.view === view)
  );
  const labels = { links: 'All Links', favorites: 'Starred', recent: 'Recent', settings: 'Settings' };
  sectionLabel.textContent = labels[view] || 'All Links';
  render();
}

// ─── Toast ────────────────────────────────────────────────
function showToast(msg, type) {
  toast.textContent = msg;
  toast.className   = `toast show${type ? ' ' + type : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ─── Event listeners ─────────────────────────────────────
addBtn.addEventListener('click', addLink);

urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') addLink(); });
urlInput.addEventListener('paste',   ()  => setTimeout(addLink, 50));

searchInput.addEventListener('input', e => {
  searchQuery = e.target.value;
  clearSearch.classList.toggle('visible', searchQuery.length > 0);
  render();
});

clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  clearSearch.classList.remove('visible');
  render();
});

document.getElementById('filter-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.filter-tab');
  if (btn) setFilter(btn.dataset.filter);
});

document.querySelector('.bottom-nav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-item');
  if (btn) setView(btn.dataset.view);
});

// ─── Init ─────────────────────────────────────────────────
linkCount.textContent = links.length;

// Seed demo link if empty
if (links.length === 0) {
  links.push({
    id:          Date.now(),
    url:         'https://www.anthropic.com',
    title:       'Anthropic — AI Safety Company',
    description: 'Anthropic is an AI safety company working to build reliable, interpretable, and steerable AI systems.',
    image:       'https://www.anthropic.com/images/index/og.jpg',
    favicon:     'https://www.google.com/s2/favicons?domain=anthropic.com&sz=32',
    domain:      'anthropic.com',
    type:        'web',
    saved:       new Date().toISOString(),
    starred:     false,
  });
  save();
}

render();
