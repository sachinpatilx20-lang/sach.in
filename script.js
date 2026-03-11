document.addEventListener('DOMContentLoaded', () => {
    const urlInput      = document.getElementById('url-input');
    const linksGrid     = document.getElementById('links-grid');
    const fetchStatus   = document.getElementById('fetch-btn');
    const imgModal      = document.getElementById('image-modal');
    const closeModal    = document.getElementById('close-modal');
    const modalUrlInput = document.getElementById('modal-url-input');
    const modalFetchBtn = document.getElementById('modal-fetch-btn');
    const modalGrid     = document.getElementById('modal-grid');
    const navThumbFinder= document.getElementById('nav-thumb-finder');
    let currentEditIndex = -1;

    loadSavedLinks();

    // Input: auto-save on paste/type
    urlInput.addEventListener('input', debounce(() => {
        const url = urlInput.value.trim();
        if (isValidUrl(url)) autoSaveLink(url);
    }, 600));

    fetchStatus.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (isValidUrl(url)) autoSaveLink(url);
    });

    // Clear All
    document.getElementById('clear-all-btn').addEventListener('click', () => {
        const links = JSON.parse(localStorage.getItem('sach_links') || '[]');
        if (!links.length) return;
        const bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:#1e293b;border:1px solid rgba(255,255,255,0.15);color:#f8fafc;padding:1rem 1.5rem;border-radius:16px;z-index:9999;display:flex;gap:1rem;align-items:center;box-shadow:0 8px 32px rgba(0,0,0,.5);font-size:.9rem;font-family:Inter,sans-serif';
        bar.innerHTML = '<span>Clear <strong>' + links.length + '</strong> link' + (links.length > 1 ? 's' : '') + '?</span>'
            + '<button id="cc" style="background:#ef4444;color:#fff;border:none;padding:.4rem .9rem;border-radius:8px;cursor:pointer;font-weight:600">Clear</button>'
            + '<button id="cx" style="background:rgba(255,255,255,.08);color:#94a3b8;border:none;padding:.4rem .9rem;border-radius:8px;cursor:pointer">Cancel</button>';
        document.body.appendChild(bar);
        document.getElementById('cc').onclick = () => { localStorage.removeItem('sach_links'); loadSavedLinks(); bar.remove(); showToast('✓ Cleared!'); };
        document.getElementById('cx').onclick = () => bar.remove();
        setTimeout(() => bar.isConnected && bar.remove(), 5000);
    });

    // ── Utilities ─────────────────────────────────────────────
    function isValidUrl(s) {
        try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch(_) { return false; }
    }
    function debounce(fn, ms) {
        let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    }
    function host(url) { return new URL(url).hostname; }
    function domainTitle(url) {
        return host(url).replace('www.','').split('.')[0].replace(/^./,c=>c.toUpperCase()) || 'Link';
    }
    function cleanTitle(raw, url) {
        if (!raw) return domainTitle(url);
        return raw
            .replace(/\s*[-–|]\s*(IMDb|YouTube|Wikipedia|Twitter|Facebook|Instagram|Netflix|Amazon|Reddit|GitHub|TikTok|Vimeo|Spotify|Google|Apple|Pinterest|DuckDuckGo).*$/i,'')
            .trim() || domainTitle(url);
    }
    function showToast(msg) {
        const t = document.createElement('div');
        t.style.cssText = 'position:fixed;bottom:2rem;right:2rem;background:var(--primary);color:#fff;padding:.7rem 1.2rem;border-radius:12px;z-index:9998;font-weight:600;font-size:.85rem;font-family:Inter,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.4);animation:cardAppear .3s ease';
        t.textContent = msg; document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }
    function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    // ── Main Save ──────────────────────────────────────────────
    async function autoSaveLink(url) {
        const saved = JSON.parse(localStorage.getItem('sach_links') || '[]');
        if (saved.some(l => l.url === url)) {
            urlInput.value = ''; urlInput.placeholder = 'Already saved!';
            setTimeout(() => urlInput.placeholder = "Paste any link — we'll save it instantly...", 2000);
            return;
        }
        urlInput.disabled = true; urlInput.value = '';
        fetchStatus.innerHTML = '<span class="loading-dots"></span>';
        fetchStatus.style.opacity = '0.7';
        const domain = host(url);

        // Instant skeleton card
        saveToStorage({ url, title: domainTitle(url), description: 'Fetching info...', image: 'https://icon.horse/icon/'+domain, timestamp: Date.now(), isUltraFallback: true, isLoading: true });

        try {
            // Race all sources — whichever responds first with a title wins
            const meta = await Promise.any([
                srcMicrolink(url),    // ✅ confirmed works from file:// (YouTube passed)
                srcIMDb(url),         // ✅ OMDB + Wikidata + Wikipedia — all CORS-open
                srcDuckDuckGo(url),   // ✅ DDG Instant Answer — open CORS
                srcJsonlink(url),     // ✅ free OG extractor
            ]);

            saveToStorage({
                url,
                title:       cleanTitle(meta.title, url),
                description: meta.description || 'Saved from ' + domain,
                image:       meta.image || 'https://icon.horse/icon/'+domain,
                timestamp:   Date.now(),
                isUltraFallback: !meta.image,
                isLoading:   false,
            });
            urlInput.placeholder = 'Saved! ✓';
            autoEnhance(url, meta.image);
        } catch(_) {
            // All failed — keep placeholder but unblock
            const links = JSON.parse(localStorage.getItem('sach_links') || '[]');
            const i = links.findIndex(l => l.url === url);
            if (i > -1) { links[i].isLoading = false; links[i].description = 'Saved from '+domain; localStorage.setItem('sach_links', JSON.stringify(links)); loadSavedLinks(); }
            urlInput.placeholder = 'Saved!';
            autoEnhance(url, 'https://icon.horse/icon/'+domain);
        } finally {
            urlInput.disabled = false;
            fetchStatus.innerHTML = 'Save';
            fetchStatus.style.opacity = '1';
            setTimeout(() => urlInput.placeholder = "Paste any link — we'll save it instantly...", 2500);
        }
    }

    // ── Metadata Sources ───────────────────────────────────────

    // Source A: Microlink — proven open CORS from file:// (YouTube confirmed working)
    async function srcMicrolink(url) {
        const d = await fetch('https://api.microlink.io?url=' + encodeURIComponent(url)).then(r => r.json());
        if (d.status !== 'success' || !d.data.title) throw new Error('ml fail');
        const low = d.data.title.toLowerCase();
        if (low.includes('robot') || low.includes('captcha') || low.includes('just a moment')) throw new Error('blocked');
        return { title: d.data.title, description: d.data.description, image: d.data.image && d.data.image.url || null };
    }

    // Source B: IMDb triple-race (OMDB + Wikidata + Wikipedia) — all open CORS
    async function srcIMDb(url) {
        const m = url.match(/imdb\.com\/title\/(tt\d+)/);
        if (!m) throw new Error('not imdb');
        const id = m[1];

        return Promise.any([

            // B1: OMDB API — free tier, try multiple keys
            (async () => {
                for (const k of ['4f0eedce', 'b9bd48a6', 'a6dbde4c']) {
                    try {
                        const d = await fetch('https://www.omdbapi.com/?i=' + id + '&apikey=' + k + '&plot=short').then(r => r.json());
                        if (d.Response === 'True' && d.Title) {
                            return { title: d.Title, description: d.Plot || null, image: d.Poster && d.Poster !== 'N/A' ? d.Poster.replace('SX300','SX800') : null };
                        }
                    } catch(e) {}
                }
                throw new Error('omdb all failed');
            })(),

            // B2: Wikidata SPARQL — English label by IMDb property P345, fully open CORS
            (async () => {
                const q = 'SELECT ?label ?img WHERE { ?s wdt:P345 "' + id + '" . OPTIONAL { ?s wdt:P18 ?img } . ?s rdfs:label ?label . FILTER(LANGMATCHES(LANG(?label),"en")) } LIMIT 1';
                const d = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q) + '&format=json').then(r => r.json());
                const row = d.results && d.results.bindings && d.results.bindings[0];
                if (!row || !row.label) throw new Error('no wd label');
                return { title: row.label.value, description: null, image: row.img && row.img.value || null };
            })(),

            // B3: Wikipedia search by IMDb ID → get title + thumbnail (origin=* = open CORS)
            (async () => {
                const s = await fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + id + '&srlimit=1&format=json&origin=*').then(r => r.json());
                const pt = s.query && s.query.search && s.query.search[0] && s.query.search[0].title;
                if (!pt) throw new Error('no wiki hit');
                const p = await fetch('https://en.wikipedia.org/w/api.php?action=query&titles=' + encodeURIComponent(pt) + '&prop=pageimages|extracts&pithumbsize=800&exintro&exsentences=2&format=json&origin=*').then(r => r.json());
                const pg = Object.values(p.query && p.query.pages || {})[0];
                if (!pg || !pg.title) throw new Error('no wiki page');
                return { title: pg.title, description: pg.extract ? pg.extract.replace(/<[^>]*>/g,'').slice(0,200) : null, image: pg.thumbnail && pg.thumbnail.source || null };
            })(),

        ]);
    }

    // Source C: DuckDuckGo Instant Answer — truly open CORS, no auth
    async function srcDuckDuckGo(url) {
        const d = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(url) + '&format=json&no_redirect=1&no_html=1').then(r => r.json());
        if (!d.Heading) throw new Error('no heading');
        return { title: d.Heading, description: d.AbstractText || null, image: d.Image ? 'https://duckduckgo.com' + d.Image : null };
    }

    // Source D: jsonlink.io — free OG extractor
    async function srcJsonlink(url) {
        const d = await fetch('https://jsonlink.io/api/extract?url=' + encodeURIComponent(url)).then(r => r.json());
        if (!d.title) throw new Error('no title');
        return { title: d.title, description: d.description || null, image: d.images && d.images[0] || null };
    }

    // ── Background Thumbnail Enhancer ─────────────────────────
    async function autoEnhance(url, currentImage) {
        try {
            const imgs = new Set();
            await Promise.allSettled([
                thumbFromMeta(url, imgs),
                thumbFromIMDb(url, imgs),
                thumbFromOEmbed(url, imgs),
                thumbFromYouTube(url, imgs),
            ]);

            const score = u => {
                if (!u) return 0;
                const l = u.toLowerCase();
                if (l.includes('m.media-amazon.com')) return 5;
                if (l.includes('upload.wikimedia.org')) return 4;
                if (l.match(/\.(jpg|jpeg|png|webp)(\?|$)/)) return 3;
                if (l.includes('icon.horse') || l.includes('favicon')) return 0;
                if (l.includes('screenshot') || l.includes('mshots')) return 1;
                return 2;
            };

            const best = [...imgs].filter(i => i && !i.includes('icon.horse')).sort((a,b) => score(b)-score(a))[0];
            if (best && best !== currentImage) {
                const links = JSON.parse(localStorage.getItem('sach_links') || '[]');
                const i = links.findIndex(l => l.url === url);
                if (i > -1) {
                    links[i].image = best; links[i].isUltraFallback = false;
                    localStorage.setItem('sach_links', JSON.stringify(links));
                    loadSavedLinks();
                }
            }
        } catch(_) {}
    }

    async function thumbFromMeta(url, imgs) {
        try {
            const e = encodeURIComponent(url);
            // Screenshot services load fine as img src
            imgs.add('https://s.wordpress.com/mshots/v1/' + e + '?w=1200&h=630');
            imgs.add('https://api.microlink.io/?url=' + e + '&screenshot=true&meta=false&embed=screenshot.url');
            // corsproxy.io accepts null origin
            const html = await fetch('https://corsproxy.io/?' + e).then(r => r.ok ? r.text() : null);
            if (!html) return;
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const base = new URL(url).origin;
            const res = s => { if (!s || s.startsWith('data:')) return null; if (s.startsWith('http')) return s; if (s.startsWith('//')) return 'https:'+s; return base+'/'+s.replace(/^\//,''); };
            ['meta[property="og:image"]','meta[name="twitter:image"]','meta[itemprop="image"]'].forEach(sel => {
                const r = res(doc.querySelector(sel) && doc.querySelector(sel).getAttribute('content')); if (r) imgs.add(r);
            });
            const skip = /pixel|track|blank|\.svg|placeholder|spacer|1x1/i;
            doc.querySelectorAll('img[src]').forEach(img => {
                const r = res(img.getAttribute('src')); if (r && !skip.test(r)) imgs.add(r);
            });
        } catch(_) {}
    }

    async function thumbFromIMDb(url, imgs) {
        const m = url.match(/imdb\.com\/title\/(tt\d+)/);
        if (!m) return;
        const id = m[1];
        for (const k of ['4f0eedce','b9bd48a6','a6dbde4c']) {
            try {
                const d = await fetch('https://www.omdbapi.com/?i='+id+'&apikey='+k).then(r => r.json());
                if (d.Poster && d.Poster !== 'N/A') {
                    ['SX300','SX600','SX1000'].forEach(sz => imgs.add(d.Poster.replace('SX300',sz)));
                    break;
                }
            } catch(_) {}
        }
        try {
            const s = await fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch='+id+'&srlimit=1&format=json&origin=*').then(r=>r.json());
            const pt = s.query && s.query.search && s.query.search[0] && s.query.search[0].title;
            if (pt) {
                const p = await fetch('https://en.wikipedia.org/w/api.php?action=query&titles='+encodeURIComponent(pt)+'&prop=pageimages&pithumbsize=800&format=json&origin=*').then(r=>r.json());
                const pg = Object.values(p.query && p.query.pages || {})[0];
                if (pg && pg.thumbnail && pg.thumbnail.source) imgs.add(pg.thumbnail.source);
            }
        } catch(_) {}
    }

    async function thumbFromOEmbed(url, imgs) {
        try { const d = await fetch('https://noembed.com/embed?url='+encodeURIComponent(url)).then(r=>r.json()); if (d.thumbnail_url) imgs.add(d.thumbnail_url); } catch(_) {}
    }

    async function thumbFromYouTube(url, imgs) {
        const yt = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        if (yt) ['maxresdefault','hqdefault','sddefault'].forEach(q => imgs.add('https://img.youtube.com/vi/'+yt[1]+'/'+q+'.jpg'));
        const vm = url.match(/vimeo\.com\/(\d+)/);
        if (vm) { try { const d = await fetch('https://vimeo.com/api/oembed.json?url='+encodeURIComponent(url)).then(r=>r.json()); if (d.thumbnail_url) imgs.add(d.thumbnail_url.replace(/_\d+x\d+\.jpg$/,'_1280.jpg')); } catch(_) {} }
    }

    // ── Storage ────────────────────────────────────────────────
    function saveToStorage(link) {
        const links = JSON.parse(localStorage.getItem('sach_links') || '[]');
        const i = links.findIndex(l => l.url === link.url);
        if (i > -1) links[i] = Object.assign({}, links[i], link);
        else links.unshift(link);
        localStorage.setItem('sach_links', JSON.stringify(links));
        loadSavedLinks();
    }

    function loadSavedLinks() {
        const links = JSON.parse(localStorage.getItem('sach_links') || '[]');
        linksGrid.innerHTML = '';
        if (!links.length) {
            linksGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:5rem 2rem;color:var(--text-muted)"><div style="font-size:3rem;margin-bottom:1rem;opacity:.4">🔗</div><div style="font-size:1rem;font-weight:500">Paste any URL above — it saves instantly.</div></div>';
            return;
        }
        links.forEach((link, idx) => {
            const domain = host(link.url);
            const card = document.createElement('div');
            card.className = 'saved-card' + (link.isLoading ? ' is-loading' : '');
            if (link.isLoading) {
                card.innerHTML = '<div class="card-media"></div><div class="saved-info" style="padding:1.25rem 1.4rem 1.4rem"><div class="sk-line sk-title"></div><div class="sk-line sk-desc"></div><div class="sk-line sk-desc2"></div><div class="sk-line sk-foot"></div></div>';
            } else {
                const isPH = link.isUltraFallback || (link.image && link.image.includes('icon.horse'));
                const media = isPH
                    ? '<div class="letter-avatar-box"><div class="letter-avatar" data-letter="'+link.title.charAt(0).toUpperCase()+'"></div><img src="'+link.image+'" class="avatar-icon-overlay" onerror="this.style.display=\'none\'"></div>'
                    : '<img src="'+link.image+'" class="saved-img" loading="lazy" onerror="this.src=\'https://icon.horse/icon/'+domain+'\'">';
                card.innerHTML =
                    '<div class="card-media">'+media+'</div>' +
                    '<div class="saved-info">' +
                        '<h4 contenteditable="true" onblur="updateField('+idx+',\'title\',this.innerText)">'+esc(link.title)+'</h4>' +
                        '<p  contenteditable="true" onblur="updateField('+idx+',\'description\',this.innerText)">'+esc(link.description)+'</p>' +
                        '<div class="saved-footer">' +
                            '<a href="'+link.url+'" target="_blank" rel="noopener noreferrer" class="visit-link">Visit →</a>' +
                            '<button class="thumb-btn" onclick="openThumbFinder('+idx+')">🖼️ Thumbnails</button>' +
                        '</div>' +
                    '</div>';
            }
            linksGrid.appendChild(card);
        });
    }

    // ── Thumbnail Finder Modal ─────────────────────────────────
    window.openThumbFinder = idx => {
        currentEditIndex = idx;
        const links = JSON.parse(localStorage.getItem('sach_links') || '[]');
        modalUrlInput.value = idx >= 0 ? links[idx].url : '';
        modalGrid.innerHTML = '';
        imgModal.style.display = 'block';
        if (modalUrlInput.value) fetchModalThumbnails(modalUrlInput.value);
    };

    navThumbFinder.onclick = e => { e.preventDefault(); openThumbFinder(-1); };
    closeModal.onclick = () => imgModal.style.display = 'none';
    window.onclick = e => { if (e.target === imgModal) imgModal.style.display = 'none'; };
    modalFetchBtn.onclick = () => { const u = modalUrlInput.value.trim(); if (isValidUrl(u)) fetchModalThumbnails(u); };

    async function fetchModalThumbnails(url) {
        modalGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted)"><span class="loading-dots"></span> Gathering thumbnails...</p>';
        const imgs = new Set();
        const domain = host(url);
        await Promise.allSettled([thumbFromMeta(url,imgs), thumbFromIMDb(url,imgs), thumbFromOEmbed(url,imgs), thumbFromYouTube(url,imgs)]);
        const e = encodeURIComponent(url);
        ['https://s.wordpress.com/mshots/v1/'+e+'?w=1200&h=630', 'https://mini.s-shot.ru/1200x630/PNG/1200/'+e, 'https://icon.horse/icon/'+domain].forEach(s=>imgs.add(s));
        modalGrid.innerHTML = '';
        imgs.forEach(imgUrl => {
            const img = document.createElement('img');
            img.src = imgUrl; img.loading = 'lazy';
            img.onclick = () => selectThumb(imgUrl);
            img.onerror = () => img.remove();
            modalGrid.appendChild(img);
        });
        if (!modalGrid.children.length) modalGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted)">No thumbnails found.</p>';
    }

    function selectThumb(imgUrl) {
        if (currentEditIndex >= 0) {
            const links = JSON.parse(localStorage.getItem('sach_links') || '[]');
            links[currentEditIndex].image = imgUrl; links[currentEditIndex].isUltraFallback = false;
            localStorage.setItem('sach_links', JSON.stringify(links)); loadSavedLinks();
            imgModal.style.display = 'none';
        } else {
            navigator.clipboard.writeText(imgUrl).then(() => showToast('✓ Copied!')).catch(() => window.open(imgUrl,'_blank'));
        }
    }

    window.updateField = (idx, field, val) => {
        const links = JSON.parse(localStorage.getItem('sach_links') || '[]');
        if (links[idx]) { links[idx][field] = val; localStorage.setItem('sach_links', JSON.stringify(links)); }
    };
});
