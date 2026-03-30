// STATE
let savedUrls = JSON.parse(localStorage.getItem('sachin_urls')) || [];

// DOM ELEMENTS
const addUrlForm = document.getElementById('addUrlForm');
const urlInput = document.getElementById('urlInput');
const addBtn = document.getElementById('addBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const errorMessage = document.getElementById('errorMessage');
const linksGrid = document.getElementById('linksGrid');
const linkCount = document.getElementById('linkCount');
const clearAllBtn = document.getElementById('clearAllBtn');

// SYNC DOM ELEMENTS
const showExportBtn = document.getElementById('showExportBtn');
const showImportBtn = document.getElementById('showImportBtn');
const exportArea = document.getElementById('exportArea');
const importArea = document.getElementById('importArea');
const exportCode = document.getElementById('exportCode');
const importCodeInput = document.getElementById('importCodeInput');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const importSubmitBtn = document.getElementById('importSubmitBtn');
const importError = document.getElementById('importError');

// INITIAL RENDER & START BACKGROUND POLLERS
renderLinks();
backgroundUpdateThumbnails();

// EVENT LISTENERS
urlInput.addEventListener('paste', () => {
    // Autosave immediately when user pastes a link
    setTimeout(() => {
        if (urlInput.value.trim().length > 0) {
            addBtn.click();
        }
    }, 10);
});

addUrlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;

    // Simple URL validation
    try {
        new URL(url);
    } catch {
        showError("Please enter a valid URL including http:// or https://");
        return;
    }

    // Check if duplicate
    if (savedUrls.some(u => u.url === url)) {
        showError("Link is already saved.");
        return;
    }

    setLoading(true);

    try {
        let title = new URL(url).hostname;
        let thumbnail = null;
        let isOriginal = false;

        const originalData = await fetchOriginalThumbnail(url);

        if (originalData.thumbnail) {
            thumbnail = originalData.thumbnail;
            if (originalData.title) title = originalData.title;
            isOriginal = true;
        }

        // Final Fallback: Always guarantee an image! NO screenshots, NO blanks, NO errors.
        if (!thumbnail) {
            let domainName = new URL(url).hostname.replace('www.', '');
            thumbnail = `https://ui-avatars.com/api/?name=${encodeURIComponent(domainName)}&background=222222&color=ffffff&size=512&font-size=0.33&bold=true`;
        }

        const newLink = {
            id: Date.now().toString(),
            url: url,
            title: title,
            thumbnail: thumbnail,
            domain: new URL(url).hostname,
            isOriginalImage: isOriginal
        };

        savedUrls.unshift(newLink);
        saveData();
        renderLinks();
        urlInput.value = '';

        // If we didn't get the original, kick off a background fetch right away
        if (!isOriginal) {
            startBackgroundRetry(newLink.id);
        }

    } catch (err) {
        showError("Network error fixing system: Unable to resolve link.");
    } finally {
        setLoading(false);
    }
});

clearAllBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all saved links?")) {
        savedUrls = [];
        saveData();
        renderLinks();
    }
});

// SYNC TOGGLES & P2P LOGIC
let currentPeer = null;

showExportBtn.addEventListener('click', () => {
    importArea.classList.add('hidden');
    exportArea.classList.toggle('hidden');

    const exportStatus = document.getElementById('exportStatus');

    if (!exportArea.classList.contains('hidden')) {
        if (currentPeer) currentPeer.destroy();

        // Generate Random 6-digit PIN
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        exportCode.value = pin;
        exportStatus.textContent = 'Generating Secure Connection...';

        currentPeer = new Peer('sachin-sync-' + pin);

        currentPeer.on('open', (id) => {
            exportStatus.textContent = 'Ready! Waiting for another device to connect...';
        });

        currentPeer.on('connection', (conn) => {
            exportStatus.textContent = 'Device connected! Syncing...';
            conn.on('open', () => {
                conn.send(JSON.stringify(savedUrls));
                exportStatus.textContent = 'Sync Complete! You can close this window now.';
                setTimeout(() => {
                    exportArea.classList.add('hidden');
                    currentPeer.destroy();
                    currentPeer = null;
                }, 4000);
            });
        });

        currentPeer.on('error', (err) => {
            exportStatus.textContent = 'Connection error. Try clicking generate again.';
            console.error(err);
        });
    } else {
        if (currentPeer) currentPeer.destroy();
    }
});

showImportBtn.addEventListener('click', () => {
    exportArea.classList.add('hidden');
    importArea.classList.toggle('hidden');
    importError.classList.add('hidden');
    if (currentPeer) currentPeer.destroy();
});

copyCodeBtn.addEventListener('click', () => {
    exportCode.select();
    document.execCommand('copy');
    const originalText = copyCodeBtn.textContent;
    copyCodeBtn.textContent = '✔';
    setTimeout(() => { copyCodeBtn.textContent = originalText; }, 2000);
});

importSubmitBtn.addEventListener('click', () => {
    const code = importCodeInput.value.trim();
    if (!code || code.length !== 6) return;

    if (currentPeer) currentPeer.destroy();

    const importStatus = document.getElementById('importStatus');
    importStatus.textContent = 'Connecting via secure P2P network...';
    importError.classList.add('hidden');

    currentPeer = new Peer();

    currentPeer.on('open', () => {
        importStatus.textContent = 'Connected to network. Requesting data...';
        const conn = currentPeer.connect('sachin-sync-' + code);

        conn.on('open', () => {
            importStatus.textContent = 'Receiving data...';
        });

        conn.on('data', (data) => {
            try {
                const importedData = JSON.parse(data);
                if (Array.isArray(importedData)) {
                    const existingUrls = new Set(savedUrls.map(u => u.url));
                    const newToAdd = importedData.filter(u => !existingUrls.has(u.url));

                    newToAdd.forEach(link => {
                        if (link.isOriginalImage === undefined) {
                            link.isOriginalImage = !link.thumbnail.includes('ui-avatars.com');
                        }
                    });

                    savedUrls = [...newToAdd, ...savedUrls];
                    saveData();
                    renderLinks();

                    importCodeInput.value = '';
                    importArea.classList.add('hidden');
                    alert(`Successfully imported ${newToAdd.length} new links!`);

                    backgroundUpdateThumbnails();
                    currentPeer.destroy();
                }
            } catch (err) {
                importError.classList.remove('hidden');
                importStatus.textContent = '';
            }
        });

        conn.on('error', () => {
            importError.classList.remove('hidden');
            importStatus.textContent = '';
        });
    });

    currentPeer.on('error', (err) => {
        importError.classList.remove('hidden');
        importStatus.textContent = '';
        console.error(err);
    });
});


// HELPER FUNCTIONS
function saveData() {
    localStorage.setItem('sachin_urls', JSON.stringify(savedUrls));
}

function renderLinks() {
    linkCount.textContent = savedUrls.length;
    linksGrid.innerHTML = '';

    if (savedUrls.length === 0) {
        linksGrid.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1 / -1; text-align: center;">No links saved yet. Paste a URL above to get started!</p>';
        return;
    }

    savedUrls.forEach(link => {
        const card = document.createElement('a');
        card.href = link.url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.className = 'link-card';

        let mediaHtml = '';
        // If the URL or thumbnail is a direct video file, embed a small muted video player as the thumbnail
        if (link.thumbnail.match(/\.(mp4|webm|ogg)($|\?)/i) || link.url.match(/\.(mp4|webm|ogg)($|\?)/i)) {
            const vidUrl = link.thumbnail.match(/\.(mp4|webm|ogg)($|\?)/i) ? link.thumbnail : link.url;
            mediaHtml = `<video src="${vidUrl}" class="link-thumbnail" muted loop onmouseover="this.play()" onmouseout="this.pause()" preload="metadata" style="object-fit: cover; background-color: var(--card-bg);"></video>`;
        } else {
            // Drastically lower bandwidth by physically shrinking heavy Original Images to a fast-loading 400px WEBP thumbnail format
            let optimizedImg = link.thumbnail;
            if (!optimizedImg.includes('ui-avatars.com') && !optimizedImg.includes('google.com/s2/favicons') && optimizedImg.startsWith('http')) {
                optimizedImg = `https://wsrv.nl/?url=${encodeURIComponent(link.thumbnail)}&w=400&output=webp`;
            }

            // 100% Guaranteed no blank images via proxy / robust onerror handler replacing 403s with generated images
            mediaHtml = `<img src="${optimizedImg}" class="link-thumbnail" alt="${link.title} thumbnail" loading="lazy" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${link.domain.replace('www.', '')}&background=222222&color=ffffff&size=512&font-size=0.33&bold=true';">`;
        }

        card.innerHTML = `
            ${mediaHtml}
            <div class="link-details">
                <div class="link-title" title="${link.title}">${link.title}</div>
                <div class="link-domain">${link.domain}</div>
            </div>
            <button class="copy-link-btn" title="Copy Link URL" data-url="${link.url}">&#128279;</button>
            <button class="delete-link-btn" title="Remove Link" data-id="${link.id}">&times;</button>
        `;

        linksGrid.appendChild(card);
    });

    // Attach copy listeners
    document.querySelectorAll('.copy-link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const copyUrl = e.target.getAttribute('data-url');
            navigator.clipboard.writeText(copyUrl).then(() => {
                const origHtml = e.target.innerHTML;
                e.target.innerHTML = '&#10003;';
                setTimeout(() => e.target.innerHTML = origHtml, 1500);
            }).catch(() => alert("Failed to copy."));
        });
    });

    // Attach delete listeners
    document.querySelectorAll('.delete-link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = e.target.getAttribute('data-id');
            savedUrls = savedUrls.filter(u => u.id !== id);
            saveData();
            renderLinks();
        });
    });
}

function setLoading(isLoading) {
    if (isLoading) {
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        urlInput.disabled = true;
        addBtn.disabled = true;
        errorMessage.classList.add('hidden');
    } else {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        urlInput.disabled = false;
        addBtn.disabled = false;
    }
}

function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
}

// === BACKGROUND FETCH TOOLING ===

function getScraperFriendlyUrl(url) {
    try {
        // Many social sites aggressively block thumbnail scraping.
        // Hot-swapping to dedicated proxy mirrors guarantees permanent raw OpenGraph metadata!
        const urlObj = new URL(url);
        const host = urlObj.hostname;

        if (host.includes('twitter.com') || host.includes('x.com')) {
            urlObj.hostname = 'vxtwitter.com';
        } else if (host.includes('instagram.com')) {
            urlObj.hostname = 'ddinstagram.com';
        } else if (host.includes('tiktok.com')) {
            urlObj.hostname = 'vxtiktok.com';
        } else if (host.includes('reddit.com')) {
            urlObj.hostname = 'rxddit.com';
        } else if (host.includes('pixiv.net')) {
            urlObj.hostname = 'phixiv.net';
        }

        return urlObj.href;
    } catch {
        return url;
    }
}

async function fetchOriginalThumbnail(url) {
    let title = null;
    let thumbnail = null;

    // Method 0: Direct Video Platform Extraction & Direct Media Files
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    const vimeoMatch = url.match(/vimeo\.com\/(?:.*#|.*\/videos\/)?([0-9]+)/);
    
    if (ytMatch && ytMatch[1]) {
        thumbnail = `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
    } else if (vimeoMatch && vimeoMatch[1]) {
        // Vumbnail is a permanent free API providing high res vimeo posters
        thumbnail = `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
    } else if (url.match(/\.(mp4|webm|ogg)($|\?)/i)) {
        // Direct media links: keep the original video URL to be loaded dynamically as a video tag 
        thumbnail = url;
    } else if (url.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)($|\?)/i)) {
        // Direct image links MUST just use the image directly!
        thumbnail = url;
        title = url.split('/').pop();
    }

    // Upgrade to scraper-safe URLs before attempting metadata rips
    const safeUrl = getScraperFriendlyUrl(url);

    // Method 1: Microlink
    try {
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(safeUrl)}`);
        if (res.ok) {
            const result = await res.json();
            if (result.status === "success") {
                if (!thumbnail && result.data.image?.url) {
                    thumbnail = result.data.image.url;
                }
                if (result.data.title) {
                    title = result.data.title;
                }
            }
        }
    } catch (e) {
        console.warn("Microlink failed:", e);
    }

    // Method 2: AllOrigins Raw HTML Extraction
    if (!thumbnail) {
        try {
            const htmlRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(safeUrl)}`);
            if (htmlRes.ok) {
                const htmlText = await htmlRes.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, "text/html");

                const ogTitle = doc.querySelector('meta[property="og:title"]')?.content;
                const docTitle = doc.querySelector('title')?.innerText;
                if (ogTitle || docTitle) title = ogTitle || docTitle;

                // Heavily Prioritize explicit video thumbnail locations over generic images
                const videoPoster = doc.querySelector('video[poster]')?.getAttribute('poster');
                const ogVideoThumb = doc.querySelector('meta[property="og:video:image"]')?.content;
                const ogImage = doc.querySelector('meta[property="og:image"]')?.content;
                const twImage = doc.querySelector('meta[name="twitter:image"]')?.content;
                const linkImage = doc.querySelector('link[rel="image_src"]')?.href;
                
                // If OpenGraph fails, aggressively search for app icons / high-res favicons generated by the DOM
                const appleIcon = doc.querySelector('link[rel="apple-touch-icon"]')?.href;
                const fluidIcon = doc.querySelector('link[rel="fluid-icon"]')?.href;
                const anyLargeIcon = doc.querySelector('link[rel="icon"][sizes]')?.href;

                let foundImage = videoPoster || ogVideoThumb || twImage || ogImage || linkImage || appleIcon || fluidIcon || anyLargeIcon;

                if (foundImage) {
                    if (!foundImage.startsWith('http')) {
                        foundImage = new URL(foundImage, new URL(safeUrl).origin).href;
                    }
                    thumbnail = foundImage;
                }
            }
        } catch (e) {
            console.warn("AllOrigins fallback failed:", e);
        }
    }

    // Method 2.5: CorsProxy.io Ultimate DOM Scraper (Pure Client-Side proxy that bypasses AllOrigins limits)
    if (!thumbnail) {
        try {
            const corsRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(safeUrl)}`);
            if (corsRes.ok) {
                const htmlText = await corsRes.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, "text/html");

                const ogImage = doc.querySelector('meta[property="og:image"]')?.content;
                const twImage = doc.querySelector('meta[name="twitter:image"]')?.content;
                const appleIcon = doc.querySelector('link[rel="apple-touch-icon"]')?.href;

                let foundImage = ogImage || twImage || appleIcon;
                if (foundImage) {
                    if (!foundImage.startsWith('http')) {
                        foundImage = new URL(foundImage, new URL(safeUrl).origin).href;
                    }
                    thumbnail = foundImage;
                }
            }
        } catch (e) {}
    }

    // Method 3: Google Favicon (Permanent image fallback before resorting to initials)
    if (!thumbnail) {
        try {
            const domain = new URL(url).hostname;
            // Guarantees a physical image response unconditionally
            thumbnail = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
        } catch (e) { }
    }

    return { title, thumbnail };
}

async function backgroundUpdateThumbnails() {
    // Migration: ensure older links have the flag evaluated
    let needsSave = false;
    savedUrls.forEach(link => {
        if (link.isOriginalImage === undefined) {
            link.isOriginalImage = !link.thumbnail.includes('ui-avatars.com');
            needsSave = true;
        }
    });
    if (needsSave) saveData();

    // Loop through missing items and begin retry protocol
    for (let link of savedUrls) {
        if (!link.isOriginalImage) {
            startBackgroundRetry(link.id);
        }
    }
}

async function startBackgroundRetry(linkId) {
    // Delays config: ramp up, then settle at 2 mins forever
    const delays = [5000, 15000, 45000];
    let attempt = 0;

    while (true) {
        let currentDelay = attempt < delays.length ? delays[attempt] : 120000;
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        attempt++;

        // Grab fresh copy inside loop as it might be deleted by user
        const linkIndex = savedUrls.findIndex(u => u.id === linkId);
        if (linkIndex === -1) return; // Deleted by user during interval
        const currentLink = savedUrls[linkIndex];

        if (currentLink.isOriginalImage) return; // Already updated

        const data = await fetchOriginalThumbnail(currentLink.url);

        if (data.thumbnail && !data.thumbnail.includes('ui-avatars.com') && !data.thumbnail.includes('google.com/s2/favicons')) {
            // We found the real image! Update it!
            savedUrls[linkIndex].thumbnail = data.thumbnail;
            if (data.title) savedUrls[linkIndex].title = data.title;
            savedUrls[linkIndex].isOriginalImage = true;

            saveData();
            renderLinks();
            break; // Stop retrying for this link!
        }
    }
}
