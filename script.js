// --- State Management ---
const AppState = {
    urls: JSON.parse(localStorage.getItem('nexus_pro_urls')) || [],
    filter: 'all',          // 'all', 'favorites', 'unread', or specific category name
    searchQuery: '',
    viewMode: localStorage.getItem('nexus_pro_view') || 'grid', // 'grid' | 'list'
    sortBy: localStorage.getItem('nexus_pro_sort') || 'newest', // 'newest' | 'oldest' | 'a-z' | 'z-a'
    theme: localStorage.getItem('nexus_pro_theme') || 'indigo',
};

// --- DOM Elements ---
const els = {
    // Navigation
    navItems: document.querySelectorAll('.nav-item[data-filter]'),
    collectionList: document.getElementById('collection-list'),
    countAll: document.getElementById('count-all'),
    countFavs: document.getElementById('count-favorites'),
    countUnread: document.getElementById('count-unread'),
    
    // Header & Tools
    globalSearch: document.getElementById('global-search'),
    clearSearchBtn: document.getElementById('clear-search'),
    viewGridBtn: document.getElementById('view-grid'),
    viewListBtn: document.getElementById('view-list'),
    sortBtn: document.getElementById('sort-dropdown-btn'),
    sortMenu: document.getElementById('sort-menu'),
    sortItems: document.querySelectorAll('.dropdown-item[data-sort]'),
    themeBtn: document.getElementById('theme-dropdown-btn'),
    themeMenu: document.getElementById('theme-menu'),
    themeItems: document.querySelectorAll('.dropdown-item[data-theme]'),
    
    // Quick Add
    quickAddForm: document.getElementById('quick-add-form'),
    quickAddInput: document.getElementById('quick-add-input'),
    quickAddBtn: document.getElementById('quick-add-btn'),
    quickAddSpinner: document.getElementById('quick-add-spinner'),
    
    // Content Area
    viewTitle: document.getElementById('current-view-title'),
    viewSubtitle: document.getElementById('current-view-subtitle'),
    quickStats: document.getElementById('quick-stats'),
    linksContainer: document.getElementById('links-container'),
    
    // Modals
    modal: document.getElementById('link-modal'),
    modalTitle: document.getElementById('modal-title'),
    form: document.getElementById('link-form'),
    closeBtns: document.querySelectorAll('.close-modal'),
    openAddBtn: document.getElementById('open-add-modal'),
    
    // QR Modal
    qrModal: document.getElementById('qr-modal'),
    qrImage: document.getElementById('qr-image'),
    qrUrlText: document.getElementById('qr-url-text'),
    closeQrBtn: document.getElementById('close-qr-btn'),
    
    // Form Inputs
    inputId: document.getElementById('link-id'),
    inputUrl: document.getElementById('link-url'),
    autoFetchBtn: document.getElementById('auto-fetch-btn'),
    inputTitle: document.getElementById('link-title'),
    inputCol: document.getElementById('link-collection'),
    inputTags: document.getElementById('link-tags'),
    inputNotes: document.getElementById('link-notes'),
    inputUnread: document.getElementById('link-unread'),
    inputFav: document.getElementById('link-favorite'),
    collectionDatalist: document.getElementById('collection-datalist'),
    
    // Image Inputs
    imagePreviewContainer: document.getElementById('image-preview-container'),
    imagePreview: document.getElementById('image-preview'),
    removeImageBtn: document.getElementById('remove-image-btn'),
    imageUploadActions: document.getElementById('image-upload-actions'),
    inputImageUrl: document.getElementById('link-image-url'),
    triggerFileInput: document.getElementById('trigger-file-input'),
    inputImageFile: document.getElementById('link-image-file'),
    inputImageData: document.getElementById('link-image-data'),
    
    // Import/Export
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    importFile: document.getElementById('import-file'),
    
    // Toasts
    toastContainer: document.getElementById('toast-container')
};

// --- Initialization ---
function init() {
    // Add Dummy Data if completely empty
    if (AppState.urls.length === 0) {
        populateDummyData();
    }
    
    bindEvents();
    applyViewMode();
    applySortVisuals();
    applyTheme(AppState.theme);
    renderApp();
}

// --- Utility & Infrastructure ---
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

function bindEvents() {
    // Search
    const handleSearch = debounce((e) => {
        AppState.searchQuery = e.target.value.toLowerCase();
        
        if (AppState.searchQuery.length > 0) {
            els.clearSearchBtn.classList.remove('hidden');
        } else {
            els.clearSearchBtn.classList.add('hidden');
        }
        
        renderLinks();
    }, 300);

    els.globalSearch.addEventListener('input', handleSearch);

    els.clearSearchBtn.addEventListener('click', () => {
        els.globalSearch.value = '';
        AppState.searchQuery = '';
        els.clearSearchBtn.classList.add('hidden');
        renderLinks();
    });

    // Keyboard Shortcuts (Cmd/Ctrl + K to search)
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            els.globalSearch.focus();
        }
        // Escape to close modals
        if (e.key === 'Escape' && !els.modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // View Toggles
    els.viewGridBtn.addEventListener('click', () => setViewMode('grid'));
    els.viewListBtn.addEventListener('click', () => setViewMode('list'));

    // Sorting Dropdown Toggles
    els.sortBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        els.themeMenu.classList.add('hidden');
        els.sortMenu.classList.toggle('hidden');
    });

    els.sortItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const sortVal = e.target.getAttribute('data-sort');
            setSortMode(sortVal);
            els.sortMenu.classList.add('hidden');
        });
    });

    // Theme Dropdown
    els.themeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        els.sortMenu.classList.add('hidden');
        els.themeMenu.classList.toggle('hidden');
    });

    els.themeItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const themeVal = e.target.getAttribute('data-theme');
            applyTheme(themeVal);
            els.themeMenu.classList.add('hidden');
        });
    });

    document.addEventListener('click', (e) => {
        if (!els.sortBtn.contains(e.target)) els.sortMenu.classList.add('hidden');
        if (!els.themeBtn.contains(e.target)) els.themeMenu.classList.add('hidden');
    });

    // Navigation Filters
    els.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            els.navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active to closest button if clicking icon inside
            const btn = e.target.closest('button');
            btn.classList.add('active');
            
            AppState.filter = btn.getAttribute('data-filter');
            
            updateHeader();
            renderLinks();
        });
    });

    // Image Input Events
    els.triggerFileInput.addEventListener('click', () => {
        els.inputImageFile.click();
    });

    els.inputImageFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Compress and convert to Base64 to save localStorage space
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const MAX_HEIGHT = 400;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setImagePreview(dataUrl);
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    els.inputImageUrl.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val) {
            setImagePreview(val);
        }
    });

    els.removeImageBtn.addEventListener('click', () => {
        clearImagePreview();
    });

    // Magic Auto-Fetch for Quick Add Input
    els.quickAddForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let urlStr = els.quickAddInput.value.trim();
        if (!urlStr) return;
        
        if (!/^https?:\/\//i.test(urlStr)) {
            urlStr = 'https://' + urlStr;
        }
        
        els.quickAddBtn.classList.add('hidden');
        els.quickAddSpinner.classList.remove('hidden');
        els.quickAddInput.disabled = true;
        
        try {
            const details = await fetchUrlDetails(urlStr);
            let hostname = urlStr;
            try { hostname = new URL(urlStr).hostname; } catch(e) {}
            
            // Fully Auto Save
            const newLink = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                url: urlStr,
                title: details.title || hostname,
                collection: '',
                tags: [],
                notes: details.description || '',
                image: details.image,
                unread: false,
                favorite: false,
                visits: 0,
                created_at: Date.now(),
                updated_at: Date.now()
            };
            AppState.urls.unshift(newLink);
            saveState();
            renderApp();
            showToast('Magic auto-saved successfully!', 'success');
            els.quickAddInput.value = '';
        } catch (err) {
            console.error(err);
            showToast('Failed to auto-fetch. Try adding manually.', 'error');
        } finally {
            els.quickAddBtn.classList.remove('hidden');
            els.quickAddSpinner.classList.add('hidden');
            els.quickAddInput.disabled = false;
            els.quickAddInput.focus();
        }
    });

    // Auto-Fetch Details from URL (Modal)
    els.autoFetchBtn.addEventListener('click', async () => {
        let urlStr = els.inputUrl.value.trim();
        if (!urlStr) {
            showToast('Please enter a URL first', 'error');
            return;
        }
        
        if (!/^https?:\/\//i.test(urlStr)) {
            urlStr = 'https://' + urlStr;
            els.inputUrl.value = urlStr;
        }
        
        try {
            const icon = els.autoFetchBtn.querySelector('i');
            icon.className = 'fa-solid fa-spinner fa-spin';
            els.autoFetchBtn.disabled = true;
            
            const details = await fetchUrlDetails(urlStr);
            
            // Update UI fields
            if (details.title) els.inputTitle.value = details.title.trim();
            if (details.description) els.inputNotes.value = details.description.trim();
            
            if (details.image) {
                setImagePreview(details.image);
            } else {
                setImagePreview(`https://image.thum.io/get/width/600/crop/800/${urlStr}`);
            }
            
            showToast('Auto-fetched details successfully!', 'success');
            
        } catch (error) {
            console.error(error);
            showToast('Could not fetch details automatically.', 'error');
        } finally {
            const icon = els.autoFetchBtn.querySelector('i');
            icon.className = 'fa-solid fa-wand-magic-sparkles';
            els.autoFetchBtn.disabled = false;
        }
    });

    // Modal Operations
    els.openAddBtn.addEventListener('click', () => openModal());
    
    els.closeBtns.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    els.form.addEventListener('submit', handleFormSubmit);

    els.closeQrBtn.addEventListener('click', () => {
        els.qrModal.classList.add('hidden');
    });

    // Click outside modal to close
    els.modal.addEventListener('click', (e) => {
        if (e.target === els.modal) {
            closeModal();
        }
    });
    
    els.qrModal.addEventListener('click', (e) => {
        if (e.target === els.qrModal) {
            els.qrModal.classList.add('hidden');
        }
    });

    // Data Management
    els.exportBtn.addEventListener('click', exportData);
    els.importBtn.addEventListener('click', () => els.importFile.click());
    els.importFile.addEventListener('change', importData);
}


// --- Core Render Cycle ---
function renderApp() {
    updateSidebar();
    updateHeader();
    renderLinks();
}

function updateSidebar() {
    const totalCount = AppState.urls.length;
    const favCount = AppState.urls.filter(u => u.favorite).length;
    const unreadCount = AppState.urls.filter(u => u.unread).length;
    
    els.countAll.textContent = totalCount;
    els.countFavs.textContent = favCount;
    els.countUnread.textContent = unreadCount;
    
    // Extract unique collections
    const collections = [...new Set(AppState.urls.map(u => u.collection).filter(Boolean))].sort();
    
    let html = '';
    let datalistHtml = '';
    
    collections.forEach(col => {
        const count = AppState.urls.filter(u => u.collection === col).length;
        const isActive = AppState.filter === col ? 'active' : '';
        
        html += `
            <li>
                <button class="nav-item ${isActive}" data-collection="${col}">
                    <span class="collection-dot"></span>
                    <span style="flex:1; text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${col}">${col}</span>
                    <span class="count">${count}</span>
                </button>
            </li>
        `;
        datalistHtml += `<option value="${col}">`;
    });
    
    els.collectionList.innerHTML = html;
    els.collectionDatalist.innerHTML = datalistHtml;
    
    // Bind dynamic collection nav items
    document.querySelectorAll('.nav-item[data-collection]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active from all nav items
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            
            const b = e.target.closest('button');
            b.classList.add('active');
            
            AppState.filter = b.getAttribute('data-collection');
            updateHeader();
            renderLinks();
        });
    });
}

function updateHeader() {
    if (AppState.filter === 'all') {
        els.viewTitle.textContent = 'All Links';
        els.viewSubtitle.textContent = 'Manage and organize your saved URLs';
    } else if (AppState.filter === 'favorites') {
        els.viewTitle.innerHTML = '<i class="fa-solid fa-star text-warning me-2"></i> Favorite Links';
        els.viewSubtitle.textContent = 'Your most important resources';
    } else if (AppState.filter === 'unread') {
        els.viewTitle.innerHTML = '<i class="fa-solid fa-inbox text-accent me-2"></i> Read Later';
        els.viewSubtitle.textContent = 'Links you saved to consume later';
    } else {
        els.viewTitle.innerHTML = `<span class="collection-dot me-2"></span> ${AppState.filter}`;
        els.viewSubtitle.textContent = `Collection`;
    }
    
    // Quick Stats
    const total = AppState.urls.length;
    const collectionsCount = new Set(AppState.urls.map(u => u.collection).filter(Boolean)).size;
    
    els.quickStats.innerHTML = `
        <div class="stat-pill"><i class="fa-solid fa-link"></i> ${total} total</div>
        <div class="stat-pill"><i class="fa-solid fa-folder"></i> ${collectionsCount} collections</div>
    `;
}

function renderLinks() {
    let filtered = AppState.urls.filter(item => {
        // First generic filter
        if (AppState.filter === 'favorites' && !item.favorite) return false;
        if (AppState.filter === 'unread' && !item.unread) return false;
        if (AppState.filter !== 'all' && AppState.filter !== 'favorites' && AppState.filter !== 'unread' && item.collection !== AppState.filter) return false;
        
        // Then Search
        if (AppState.searchQuery) {
            const q = AppState.searchQuery;
            const hasTags = item.tags && item.tags.some(t => t.toLowerCase().includes(q));
            return (
                item.title.toLowerCase().includes(q) ||
                item.url.toLowerCase().includes(q) ||
                hasTags ||
                (item.notes && item.notes.toLowerCase().includes(q)) ||
                (item.collection && item.collection.toLowerCase().includes(q))
            );
        }
        
        return true;
    });

    // Apply Sorting
    filtered.sort((a, b) => {
        switch (AppState.sortBy) {
            case 'newest': return b.created_at - a.created_at;
            case 'oldest': return a.created_at - b.created_at;
            case 'visits': return (b.visits || 0) - (a.visits || 0);
            case 'a-z': return a.title.localeCompare(b.title);
            case 'z-a': return b.title.localeCompare(a.title);
            default: return 0;
        }
    });

    els.linksContainer.innerHTML = '';

    if (filtered.length === 0) {
        els.linksContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-ghost"></i>
                <h3>It's quiet in here...</h3>
                <p>No links found matching your criteria. Try adding a new link or change your filters.</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach((item) => {
        const hostname = new URL(item.url).hostname;
        const faviconUrl = `https://s2.googleusercontent.com/s2/favicons?domain=${hostname}&sz=64`;
        
        let tagsHtml = '';
        if (item.tags && item.tags.length > 0) {
            tagsHtml = `<div class="tags-container">${item.tags.map(t => `<span class="tag-badge"><i class="fa-solid fa-hashtag"></i> ${t}</span>`).join('')}</div>`;
        }
        
        const card = document.createElement('div');
        card.className = 'link-card';
        card.innerHTML = `
            ${item.unread ? '<div class="unread-indicator" title="Unread"></div>' : ''}
            ${item.image ? `<div class="link-card-image"><img src="${item.image}" alt="Cover Image" onerror="if(!this.dataset.tried){this.dataset.tried=true;this.src='https://image.thum.io/get/width/600/crop/800/' + encodeURIComponent('${item.url}');}else{this.src='https://placehold.co/600x400/1e293b/94a3b8?text=Image+Unavailable';}"></div>` : ''}
            <div class="link-card-content">
                <div class="card-header">
                    <div class="favicon">
                        <img src="${faviconUrl}" alt="" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\'fa-solid fa-globe\\'></i>';">
                    </div>
                    <div class="card-title-group">
                        <h3 class="card-title" title="${item.title}"><a href="${item.url}" target="_blank" rel="noopener noreferrer" class="visit-link" data-id="${item.id}">${item.title}</a></h3>
                        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="card-url visit-link" data-id="${item.id}" title="${item.url}">${hostname} <i class="fa-solid fa-arrow-up-right-from-square ms-1" style="font-size:0.7rem; opacity:0.5;"></i></a>
                    </div>
                </div>
                
                ${item.notes || tagsHtml || item.visits ? `
                <div class="card-body">
                    ${item.notes ? `<p class="card-notes" title="${item.notes.replace(/"/g, '&quot;')}">${item.notes}</p>` : ''}
                    ${item.visits ? `<p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem;"><i class="fa-solid fa-chart-line"></i> ${item.visits} visit${item.visits !== 1 ? 's' : ''}</p>` : ''}
                    ${tagsHtml}
                </div>
                ` : ''}
                
                <div class="card-footer">
                    <div class="card-meta">
                        ${item.collection ? `<span class="category-badge">${item.collection}</span>` : ''}
                        <span class="date-badge">${formatDate(item.created_at)}</span>
                    </div>
                    <div class="card-actions">
                        <button class="action-btn qr-btn" data-url="${item.url}" title="View QR Code">
                            <i class="fa-solid fa-qrcode"></i>
                        </button>
                        <button class="action-btn copy-btn" data-url="${item.url}" title="Copy Link">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                        <button class="action-btn read-btn ${item.unread ? 'active' : ''}" data-id="${item.id}" title="${item.unread ? 'Mark as Read' : 'Mark as Unread'}">
                            <i class="fa-solid fa-${item.unread ? 'envelope' : 'envelope-open'}"></i>
                        </button>
                        <button class="action-btn star-btn ${item.favorite ? 'active' : ''}" data-id="${item.id}" title="${item.favorite ? 'Unfavorite' : 'Favorite'}">
                            <i class="fa-${item.favorite ? 'solid' : 'regular'} fa-star"></i>
                        </button>
                        <button class="action-btn edit-btn" data-id="${item.id}" title="Edit Link">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="action-btn delete-btn" data-id="${item.id}" title="Delete Link">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        fragment.appendChild(card);
    });

    els.linksContainer.appendChild(fragment);

    bindCardActions();
}

function bindCardActions() {
    // Visit Links tracking
    document.querySelectorAll('.visit-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            trackVisit(id);
        });
    });

    document.querySelectorAll('.qr-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            openQrModal(url);
        });
    });

    document.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            toggleFavorite(id);
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            openModal(id);
        });
    });

    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.currentTarget.getAttribute('data-url');
            navigator.clipboard.writeText(url).then(() => {
                showToast('Link copied to clipboard!', 'success');
            }).catch(() => {
                showToast('Failed to copy link', 'error');
            });
        });
    });

    document.querySelectorAll('.read-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            toggleReadStatus(id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            deleteLink(id);
        });
    });
}

// --- Logic Procedures ---
function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = els.inputId.value;
    let urlStr = els.inputUrl.value.trim();
    
    // Format URL
    if (!/^https?:\/\//i.test(urlStr)) {
        urlStr = 'https://' + urlStr;
    }

    try {
        new URL(urlStr); // Validate URL
    } catch (_) {
        showToast('Invalid URL format', 'error');
        return;
    }

    const title = els.inputTitle.value.trim();
    const collection = els.inputCol.value.trim();
    const tagsStr = els.inputTags.value.trim();
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    const notes = els.inputNotes.value.trim();
    const image = els.inputImageData.value; // Retrieved from hidden input
    const unread = els.inputUnread.checked;
    const favorite = els.inputFav.checked;

    if (id) {
        // Edit existing
        const index = AppState.urls.findIndex(u => u.id === id);
        if (index > -1) {
            AppState.urls[index] = {
                ...AppState.urls[index],
                url: urlStr,
                title,
                collection,
                tags,
                notes,
                image,
                unread,
                favorite,
                updated_at: Date.now()
            };
            showToast('Link updated successfully', 'success');
        }
    } else {
        // Create new
        const newLink = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            url: urlStr,
            title,
            collection,
            tags,
            notes,
            image,
            unread,
            favorite,
            visits: 0,
            created_at: Date.now(),
            updated_at: Date.now()
        };
        AppState.urls.unshift(newLink);
        showToast('New link saved!', 'success');
    }

    saveState();
    closeModal();
    renderApp();
}

function toggleFavorite(id) {
    const item = AppState.urls.find(u => u.id === id);
    if (item) {
        item.favorite = !item.favorite;
        saveState();
        renderApp();
        
        if(item.favorite) showToast('Added to Favorites', 'info');
        else showToast('Removed from Favorites', 'info');
    }
}

function deleteLink(id) {
    if (confirm('Are you certain you want to delete this link? This action cannot be undone.')) {
        AppState.urls = AppState.urls.filter(u => u.id !== id);
        saveState();
        renderApp();
        showToast('Link deleted', 'success');
    }
}

function toggleReadStatus(id) {
    const item = AppState.urls.find(u => u.id === id);
    if (item) {
        item.unread = !item.unread;
        saveState();
        renderApp();
        if(item.unread) showToast('Marked as Read Later', 'info');
        else showToast('Marked as Read', 'info');
    }
}

// --- View & Sort State Helpers ---
function setViewMode(mode) {
    AppState.viewMode = mode;
    localStorage.setItem('nexus_pro_view', mode);
    applyViewMode();
}

function applyViewMode() {
    if (AppState.viewMode === 'grid') {
        els.linksContainer.classList.remove('list-view');
        els.linksContainer.classList.add('grid-view');
        els.viewGridBtn.classList.add('active');
        els.viewListBtn.classList.remove('active');
    } else {
        els.linksContainer.classList.remove('grid-view');
        els.linksContainer.classList.add('list-view');
        els.viewListBtn.classList.add('active');
        els.viewGridBtn.classList.remove('active');
    }
}

function setSortMode(mode) {
    AppState.sortBy = mode;
    localStorage.setItem('nexus_pro_sort', mode);
    applySortVisuals();
    renderLinks();
    
    // Display textual sort choice
    const labels = {
        'newest': 'Newest First',
        'oldest': 'Oldest First',
        'visits': 'Most Visited',
        'a-z': 'A-Z',
        'z-a': 'Z-A'
    };
    showToast(`Sorted by ${labels[mode]}`, 'info');
}

function applySortVisuals() {
    els.sortItems.forEach(item => {
        if (item.getAttribute('data-sort') === AppState.sortBy) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function applyTheme(theme) {
    AppState.theme = theme;
    localStorage.setItem('nexus_pro_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update Dropdown visuals
    els.themeItems.forEach(item => {
        if (item.getAttribute('data-theme') === theme) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}


// --- Utility & Infrastructure ---
function openQrModal(url) {
    els.qrModal.classList.remove('hidden');
    els.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=020617&data=${encodeURIComponent(url)}`;
    els.qrUrlText.textContent = url;
}

function trackVisit(id) {
    const item = AppState.urls.find(u => u.id === id);
    if (item) {
        item.visits = (item.visits || 0) + 1;
        saveState();
        // Optionially we don't renderApp immediately so it doesn't shuffle during clicking
    }
}

function openModal(id = null) {
    els.modal.classList.remove('hidden');
    els.form.reset();
    clearImagePreview();
    
    if (id) {
        // Edit mode setup
        els.modalTitle.textContent = 'Edit Link';
        const item = AppState.urls.find(u => u.id === id);
        if (item) {
            els.inputId.value = item.id;
            els.inputUrl.value = item.url;
            els.inputTitle.value = item.title;
            els.inputCol.value = item.collection || '';
            els.inputTags.value = item.tags ? item.tags.join(', ') : '';
            els.inputNotes.value = item.notes || '';
            els.inputUnread.checked = item.unread !== undefined ? item.unread : false;
            els.inputFav.checked = item.favorite || false;
            if (item.image) {
                setImagePreview(item.image);
            }
        }
    } else {
        // Create mode setup
        els.modalTitle.textContent = 'Add New Link';
        els.inputId.value = '';
    }
}

function setImagePreview(src) {
    els.imagePreview.onerror = function() {
        if (!this.dataset.tried) {
            this.dataset.tried = true;
            const urlStr = els.inputUrl.value.trim();
             if(urlStr) {
                  this.src = `https://image.thum.io/get/width/600/crop/800/${encodeURIComponent(urlStr)}`;
             } else {
                  this.src = 'https://placehold.co/600x400/1e293b/94a3b8?text=Image+Unavailable';
             }
        } else {
             this.src = 'https://placehold.co/600x400/1e293b/94a3b8?text=Image+Unavailable';
        }
    };
    els.imagePreview.dataset.tried = '';
    els.imagePreview.src = src;
    els.inputImageData.value = src;
    els.imagePreviewContainer.style.display = 'block';
    els.imageUploadActions.style.display = 'none';
    els.inputImageUrl.value = '';
    els.inputImageFile.value = '';
}

function clearImagePreview() {
    els.imagePreview.src = '';
    els.inputImageData.value = '';
    els.imagePreviewContainer.style.display = 'none';
    els.imageUploadActions.style.display = 'flex';
    els.inputImageUrl.value = '';
    els.inputImageFile.value = '';
}

function closeModal() {
    els.modal.classList.add('hidden');
    els.form.reset();
    clearImagePreview();
}

function saveState() {
    localStorage.setItem('nexus_pro_urls', JSON.stringify(AppState.urls));
}

async function fetchUrlDetails(urlStr) {
    // 1. Check if the URL is directly an image file
    if (urlStr.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i)) {
        let filename = urlStr;
        try { filename = new URL(urlStr).pathname.split('/').pop() || urlStr; } catch(e) {}
        return { title: filename, description: '', image: urlStr };
    }

    try {
        // 2. Extract structured metadata using microlink.io API 
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(urlStr)}`);
        if (!response.ok) throw new Error('API Request Failed');
        
        const json = await response.json();
        const data = json.data || {};
        
        let title = data.title || '';
        let description = data.description || '';
        let image = data.image?.url || data.logo?.url || '';
        
        // 3. Fallback for normal websites that do not have an Open Graph image
        if (!image) {
            image = `https://image.thum.io/get/width/600/crop/800/${urlStr}`;
        }

        return { title, description, image };
    } catch (err) {
        // If the fetching entirely fails, still return a graceful fallback 
        let fallbackTitle = urlStr;
        try { fallbackTitle = new URL(urlStr).hostname; } catch(e) {}
        return { 
            title: fallbackTitle, 
            description: '', 
            image: `https://image.thum.io/get/width/600/crop/800/${urlStr}` 
        };
    }
}

function exportData() {
    const dataStr = JSON.stringify(AppState.urls, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!', 'success');
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target.result);
            if (!Array.isArray(json)) throw new Error('Root must be an array');
            
            const importedCount = json.length;
            
            // Merge logic (avoid exact ID duplicates, otherwise just append)
            json.forEach(importedItem => {
                if (!AppState.urls.some(u => u.id === importedItem.id)) {
                    AppState.urls.push(importedItem);
                }
            });
            
            saveState();
            renderApp();
            showToast(`Successfully imported ${importedCount} links`, 'success');
            
        } catch (err) {
            console.error(err);
            showToast('Invalid JSON file.', 'error');
        }
        
        // Reset file input
        els.importFile.value = '';
    };
    reader.readAsText(file);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-solid fa-circle-info';
    let title = 'Notification';
    
    if (type === 'success') {
        iconClass = 'fa-solid fa-circle-check';
        title = 'Success';
    } else if (type === 'error') {
        iconClass = 'fa-solid fa-circle-exclamation';
        title = 'Error';
    }
    
    toast.innerHTML = `
        <i class="${iconClass} toast-icon"></i>
        <div class="toast-content">
            <h4 class="toast-title">${title}</h4>
            <p class="toast-message">${message}</p>
        </div>
    `;
    
    els.toastContainer.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 4000);
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Very Basic Relative Time
    if (diff < 86400000) { // Less than a day
        return 'Today';
    } else if (diff < 172800000) { // Less than two days
        return 'Yesterday';
    } else {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

// Populate some dummy initial data to show layout effectiveness
function populateDummyData() {
    const defaultData = [
        {
            id: 'id_1',
            url: 'https://news.ycombinator.com',
            title: 'Hacker News',
            collection: 'Reading',
            tags: ['tech', 'startup', 'daily'],
            notes: 'Great site for daily tech news and startup discussions.',
            image: '',
            unread: false,
            favorite: true,
            visits: 12,
            created_at: Date.now() - 100000,
            updated_at: Date.now()
        },
        {
            id: 'id_2',
            url: 'https://dribbble.com',
            title: 'Dribbble - Discover the Worlds Top Designers',
            collection: 'Inspiration',
            tags: ['design', 'ui'],
            notes: 'Always check this before starting UI layout. Check out the glassmorphism tags.',
            image: '',
            unread: true,
            favorite: true,
            visits: 4,
            created_at: Date.now() - 500000,
            updated_at: Date.now()
        },
        {
            id: 'id_3',
            url: 'https://github.com/features/copilot',
            title: 'GitHub Copilot',
            collection: 'Tools',
            tags: ['ai', 'coding'],
            notes: 'AI pair programmer.',
            image: '',
            unread: false,
            favorite: false,
            visits: 2,
            created_at: Date.now() - 900000,
            updated_at: Date.now()
        },
        {
            id: 'id_4',
            url: 'https://unsplash.com/',
            title: 'Unsplash | Beautiful Free Images',
            collection: 'Inspiration',
            tags: ['assets', 'photography'],
            notes: 'Royalty-free placeholder imagery.',
            image: '',
            unread: true,
            favorite: false,
            visits: 0,
            created_at: Date.now() - 1500000,
            updated_at: Date.now()
        }
    ];
    
    AppState.urls = defaultData;
    saveState();
}

// Start App
document.addEventListener('DOMContentLoaded', init);
