/**
 * Sach.in – Premium Link Manager
 * Core Application Logic
 */

// State Management
let links = JSON.parse(localStorage.getItem('sachin_links')) || [];
let currentSearch = '';

// DOM Elements
const linksGrid = document.getElementById('linksGrid');
const searchInput = document.getElementById('searchInput');
const fab = document.getElementById('fab');
const overlay = document.getElementById('overlay');
const bottomSheet = document.getElementById('bottomSheet');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const linkInput = document.getElementById('linkInput');
const previewContainer = document.getElementById('previewContainer');
const loadingSpinner = document.getElementById('loadingSpinner');

// Preview Elements
const previewImg = document.getElementById('previewImg');
const previewTitle = document.getElementById('previewTitle');
const previewDesc = document.getElementById('previewDesc');

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    renderLinks();
    setupEventListeners();
});

function setupEventListeners() {
    // Search with debounce
    searchInput.addEventListener('input', debounce(() => {
        currentSearch = searchInput.value.toLowerCase();
        renderLinks();
    }, 300));

    // Bottom Sheet Controls
    fab.addEventListener('click', openSheet);
    overlay.addEventListener('click', closeSheet);
    cancelBtn.addEventListener('click', closeSheet);

    // Link Input Interaction
    linkInput.addEventListener('input', debounce(handleUrlPreview, 600));

    // Save Action
    saveBtn.addEventListener('click', saveLink);
}

// --- Core Functions ---

function renderLinks() {
    const filteredLinks = links.filter(link => {
        return link.title.toLowerCase().includes(currentSearch) ||
               link.url.toLowerCase().includes(currentSearch) ||
               link.domain.toLowerCase().includes(currentSearch);
    });

    // Sort: Favorites first, then newest
    const sortedLinks = [...filteredLinks].sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return b.timestamp - a.timestamp;
    });

    linksGrid.innerHTML = '';

    if (sortedLinks.length === 0) {
        linksGrid.innerHTML = `
            <div class="empty-state">
                <p>${currentSearch ? 'No links match your search.' : 'No links saved yet. Tap the + button to add one.'}</p>
            </div>
        `;
        return;
    }

    sortedLinks.forEach(link => {
        const card = createLinkCard(link);
        linksGrid.appendChild(card);
    });
}

function createLinkCard(link) {
    const div = document.createElement('div');
    div.className = `link-card ${link.favorite ? 'is-favorite' : ''}`;
    div.innerHTML = `
        <div class="card-thumb">
            <img src="${link.thumbnail}" alt="${link.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x225/1a1a1e/ffffff?text=No+Preview'">
        </div>
        <div class="card-content">
            <span class="card-domain">${link.domain}</span>
            <h3 class="card-title">${link.title}</h3>
            <p class="card-desc">${link.description || 'No description available.'}</p>
            <div class="card-actions">
                <button class="action-btn open" onclick="window.open('${link.url}', '_blank')" title="Open Link">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </button>
                <button class="action-btn favorite ${link.favorite ? 'active' : ''}" onclick="toggleFavorite('${link.id}')" title="Mark as Favorite">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${link.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
                <button class="action-btn delete" onclick="deleteLink('${link.id}')" title="Delete Link">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        </div>
    `;
    return div;
}

async function handleUrlPreview() {
    const url = linkInput.value.trim();
    if (!isValidUrl(url)) {
        previewContainer.classList.add('hidden');
        return;
    }

    loadingSpinner.classList.remove('hidden');
    saveBtn.disabled = true;

    try {
        const metadata = await fetchMetadata(url);
        showPreview(metadata);
    } catch (error) {
        console.error('Metadata fetch failed:', error);
        showPreview({
            title: url,
            description: 'Could not fetch metadata.',
            image: getThumbnailFallback(url),
            url: url
        });
    } finally {
        loadingSpinner.classList.add('hidden');
        saveBtn.disabled = false;
    }
}

async function fetchMetadata(url) {
    // Using Microlink API to get rich metadata
    const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status === 'success') {
        const meta = data.data;
        return {
            title: meta.title || url,
            description: meta.description || '',
            image: meta.image?.url || meta.logo?.url || getThumbnailFallback(url),
            url: url,
            domain: meta.publisher || new URL(url).hostname.replace('www.', '')
        };
    }
    throw new Error('Microlink API error');
}

function getThumbnailFallback(url) {
    try {
        const domain = new URL(url).hostname;
        // Check if it's an image link
        if (/\.(jpg|jpeg|png|webp|gif|svg|bmp|ico|avif)$/i.test(url)) {
            return url;
        }
        // Fallback to Google Favicon service with high resolution
        return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
    } catch (e) {
        return 'https://via.placeholder.com/400x225/1a1a1e/ffffff?text=Invalid+URL';
    }
}

function showPreview(data) {
    previewImg.src = data.image;
    previewTitle.textContent = data.title;
    previewDesc.textContent = data.description;
    previewContainer.classList.remove('hidden');
    
    // Store temp metadata for saving
    window.tempMetadata = data;
}

function saveLink() {
    const url = linkInput.value.trim();
    if (!isValidUrl(url)) {
        showToast('Please enter a valid URL');
        return;
    }

    const metadata = window.tempMetadata || {
        title: url,
        description: '',
        image: getThumbnailFallback(url),
        url: url,
        domain: new URL(url).hostname.replace('www.', '')
    };

    const newLink = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        favorite: false,
        ...metadata,
        thumbnail: metadata.image // Ensure consistency
    };

    links.unshift(newLink);
    persistLinks();
    renderLinks();
    closeSheet();
    showToast('Link saved successfully!');
    
    // Reset
    linkInput.value = '';
    previewContainer.classList.add('hidden');
    window.tempMetadata = null;
}

function deleteLink(id) {
    if (confirm('Are you sure you want to delete this link?')) {
        links = links.filter(l => l.id !== id);
        persistLinks();
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
    persistLinks();
    renderLinks();
}

// --- Helpers ---

function persistLinks() {
    localStorage.setItem('sachin_links', JSON.stringify(links));
}

function openSheet() {
    overlay.classList.add('active');
    bottomSheet.classList.add('active');
    linkInput.focus();
}

function closeSheet() {
    overlay.classList.remove('active');
    bottomSheet.classList.remove('active');
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}
