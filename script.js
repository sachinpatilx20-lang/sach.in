/**
 * Sach.in – Premium Link Manager
 * Core Logic with 4-Step Thumbnail Fallback
 */

// --- State Management ---
let links = JSON.parse(localStorage.getItem('sachin_links_v3')) || [];
let searchFilter = '';
let currentMetadata = null;

// --- DOM References ---
const linksGrid = document.getElementById('linksGrid');
const searchInput = document.getElementById('searchInput');
const fab = document.getElementById('fab');
const overlay = document.getElementById('overlay');
const bottomSheet = document.getElementById('bottomSheet');
const linkInput = document.getElementById('linkInput');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const previewContainer = document.getElementById('previewContainer');
const previewImg = document.getElementById('previewImg');
const previewTitle = document.getElementById('previewTitle');
const previewDesc = document.getElementById('previewDesc');
const previewDomain = document.getElementById('previewDomain');
const previewLoader = document.getElementById('previewLoader');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    renderLinks();
    setupEventListeners();
}

function setupEventListeners() {
    // Search
    searchInput.addEventListener('input', debounce(() => {
        searchFilter = searchInput.value.toLowerCase().trim();
        renderLinks();
    }, 300));

    // Sheet Controls
    fab.addEventListener('click', openSheet);
    overlay.addEventListener('click', closeSheet);
    cancelBtn.addEventListener('click', closeSheet);

    // Save
    saveBtn.addEventListener('click', saveLink);

    // URL Input Preview
    linkInput.addEventListener('input', debounce(handleUrlPreview, 800));
}

// --- Thumbnail & Metadata Logic ---

/**
 * STEP 1: Direct Image Detection
 */
function isImageUrl(url) {
    return /\.(jpg|jpeg|png|webp|gif|svg|bmp|ico|avif)$/i.test(url);
}

/**
 * CORE: Multi-step Thumbnail System
 * Returns best possible metadata/thumbnail
 */
async function getThumbnail(url) {
    const domain = extractDomain(url);
    
    // STEP 1: Direct Image Detection
    if (isImageUrl(url)) {
        return {
            title: url.split('/').pop().substring(0, 30) || 'Image Link',
            description: 'Direct image URL detected.',
            thumbnail: url,
            domain: domain,
            url: url
        };
    }

    // STEP 2: Website OpenGraph Preview (Microlink)
    try {
        const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
        const response = await fetch(microlinkUrl);
        const data = await response.json();

        if (data.status === 'success' && data.data.image?.url) {
            return {
                title: data.data.title || url,
                description: data.data.description || 'No description provided.',
                thumbnail: data.data.image.url,
                domain: domain,
                url: url
            };
        }
    } catch (e) {
        console.warn('Microlink failed, moving to Step 3');
    }

    // STEP 3: Website Screenshot Fallback (Thum.io)
    const screenshotUrl = `https://image.thum.io/get/width/800/${url}`;
    
    // We'll test if we can use this screenshot
    // For simplicity in this logic, we provide Step 4 as absolute fallback in the UI onerror
    return {
        title: url,
        description: 'No preview available. Showing site screenshot.',
        thumbnail: screenshotUrl,
        domain: domain,
        url: url,
        favicon: `https://www.google.com/s2/favicons?sz=128&domain=${domain}` // STEP 4 Fallback
    };
}

// --- Link Operations ---

async function handleUrlPreview() {
    const url = linkInput.value.trim();
    if (!isValidUrl(url)) {
        previewContainer.classList.add('hidden');
        saveBtn.disabled = true;
        return;
    }

    previewContainer.classList.remove('hidden');
    previewLoader.classList.add('active');
    saveBtn.disabled = true;

    try {
        const metadata = await getThumbnail(url);
        currentMetadata = metadata;

        previewImg.src = metadata.thumbnail;
        previewTitle.textContent = metadata.title;
        previewDesc.textContent = metadata.description;
        previewDomain.textContent = metadata.domain;
        
        // Handle thumbnail error (triggers Step 4)
        previewImg.onerror = () => {
            previewImg.src = `https://www.google.com/s2/favicons?sz=128&domain=${metadata.domain}`;
            previewImg.onerror = null; // Prevent loops
        };

        saveBtn.disabled = false;
    } catch (error) {
        showToast('Could not fetch link info');
    } finally {
        previewLoader.classList.remove('active');
    }
}

function saveLink() {
    if (!currentMetadata) return;

    const newLink = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        favorite: false,
        ...currentMetadata
    };

    links.unshift(newLink);
    persist();
    renderLinks();
    closeSheet();
    showToast('Link saved beautifully!');
}

function deleteLink(id) {
    if (confirm('Remove this link permanently?')) {
        links = links.filter(l => l.id !== id);
        persist();
        renderLinks();
        showToast('Link removed');
    }
}

function toggleFavorite(id) {
    links = links.map(link => {
        if (link.id === id) {
            return { ...link, favorite: !link.favorite };
        }
        return link;
    });
    persist();
    renderLinks();
}

// --- Rendering ---

function renderLinks() {
    const filtered = links.filter(link => {
        return link.title.toLowerCase().includes(searchFilter) ||
               link.url.toLowerCase().includes(searchFilter) ||
               link.domain.toLowerCase().includes(searchFilter);
    });

    // Pinned favorites first, then chronological
    const sorted = [...filtered].sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return b.timestamp - a.timestamp;
    });

    linksGrid.innerHTML = '';

    if (sorted.length === 0) {
        linksGrid.innerHTML = `<div class="empty-state">
            <p>${searchFilter ? 'No matches found.' : 'No links yet. Start by tapping the + button.'}</p>
        </div>`;
        return;
    }

    sorted.forEach(link => {
        const card = createLinkCard(link);
        linksGrid.appendChild(card);
    });
}

function createLinkCard(link) {
    const card = document.createElement('div');
    card.className = `link-card ${link.favorite ? 'is-favorite' : ''}`;
    
    // Step 4 final fallback built into HTML via onerror
    const faviconUrl = `https://www.google.com/s2/favicons?sz=128&domain=${link.domain}`;

    card.innerHTML = `
        <div class="card-image">
            <img src="${link.thumbnail}" alt="${link.title}" loading="lazy" 
                 onerror="this.src='${faviconUrl}';this.onerror=null;">
        </div>
        <div class="card-content">
            <span class="card-domain">${link.domain}</span>
            <h3 class="card-title">${link.title}</h3>
            <p class="card-desc">${link.description}</p>
            <div class="card-actions">
                <button class="action-btn open" onclick="window.open('${link.url}', '_blank')" title="Open Link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </button>
                <button class="action-btn favorite ${link.favorite ? 'active' : ''}" onclick="toggleFavorite('${link.id}')" title="Favorite">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${link.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
                <button class="action-btn delete" onclick="deleteLink('${link.id}')" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        </div>
    `;
    return card;
}

// --- Utilities ---

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function extractDomain(url) {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch (_) {
        return 'unknown.com';
    }
}

function persist() {
    localStorage.setItem('sachin_links_v3', JSON.stringify(links));
}

function openSheet() {
    overlay.classList.add('active');
    bottomSheet.classList.add('active');
    linkInput.focus();
}

function closeSheet() {
    overlay.classList.remove('active');
    bottomSheet.classList.remove('active');
    linkInput.value = '';
    previewContainer.classList.add('hidden');
    currentMetadata = null;
}

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 3000);
}
