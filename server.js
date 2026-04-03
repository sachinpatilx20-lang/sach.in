const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

// Helper to load/save JSON data
function loadStore() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error('Failed to parse data.json');
    }
  }
  return {};
}

function saveStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

// In-memory cache synced with disk
const shareStoreData = loadStore();
const shareStore = new Map(Object.entries(shareStoreData));

// Helper to generate 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/api/metadata', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Validate URL structure
    let validUrl;
    try {
      validUrl = new URL(url);
    } catch (_) {
      try {
        validUrl = new URL(`https://${url}`);
      } catch (__) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }

    let html = '';
    try {
      const response = await fetch(validUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      if (response.ok) {
        html = await response.text();
      }
    } catch (e) {
      // Ignore fetch errors, we will fallback to just the URL
    }

    let title = validUrl.hostname;
    let image = '';
    let description = '';

    if (html) {
      const $ = cheerio.load(html);
      title = $('meta[property="og:title"]').attr('content') || $('title').text() || validUrl.hostname;
      image = $('meta[property="og:image"]').attr('content') || 
              $('meta[name="twitter:image"]').attr('content') || '';
      description = $('meta[property="og:description"]').attr('content') || 
                    $('meta[name="description"]').attr('content') || '';

      if (image && !image.startsWith('http')) {
        try {
          image = new URL(image, validUrl.origin).toString();
        } catch (_) {}
      }
    }

    res.json({
      title,
      image,
      description,
      url: validUrl.toString()
    });
  } catch (err) {
    console.error('Metadata fetch error:', err);
    // Even if it completely breaks, return a fallback with just the URL
    res.json({ title: req.body.url, image: '', description: '', url: req.body.url });
  }
});

app.post('/api/share', (req, res) => {
  const { links } = req.body;
  if (!Array.isArray(links)) {
    return res.status(400).json({ error: 'Links must be an array' });
  }

  let code;
  do {
    code = generateCode();
  } while (shareStore.has(code));

  shareStore.set(code, {
    links,
    createdAt: Date.now()
  });
  
  saveStore(Object.fromEntries(shareStore));

  res.json({ code });
});

app.get('/api/share/:code', (req, res) => {
  const { code } = req.params;
  if (shareStore.has(code)) {
    const data = shareStore.get(code);
    res.json({ links: data.links });
  } else {
    res.status(404).json({ error: 'Code not found or expired' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
