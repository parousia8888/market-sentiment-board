import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8787;

const DATA_PATH = path.join(__dirname, 'data', 'cache.json');
const UPDATE_MS = 5 * 60 * 1000;

const SECTORS = {
  crypto: 'bitcoin OR ethereum OR crypto OR polymarket',
  macro: 'inflation OR fed OR interest rates OR recession OR CPI',
  tech_ai: 'OpenAI OR NVIDIA OR AI OR semiconductor OR model',
  geopolitics: 'china OR us election OR taiwan OR russia OR middle east'
};

let cache = { updatedAt: null, sectors: {} };

function loadCache() {
  try {
    if (fs.existsSync(DATA_PATH)) cache = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  } catch (e) {
    console.error('cache load failed', e.message);
  }
}

function saveCache() {
  fs.writeFileSync(DATA_PATH, JSON.stringify(cache, null, 2));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 OpenClaw Dashboard' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.json();
}

function toKlineLike(points = []) {
  // Convert tone points to pseudo-OHLC per point interval (visual K-line style)
  return points.map((p, i) => {
    const prev = points[i - 1]?.value ?? p.value;
    const open = Number(prev.toFixed(2));
    const close = Number((p.value ?? 0).toFixed(2));
    const high = Number(Math.max(open, close, open + Math.random() * 0.5).toFixed(2));
    const low = Number(Math.min(open, close, close - Math.random() * 0.5).toFixed(2));
    return { time: p.date, open, high, low, close };
  });
}

function buildHighlights(kline = [], articles = []) {
  const highlights = [];
  for (let i = 1; i < kline.length; i++) {
    const delta = kline[i].close - kline[i - 1].close;
    if (Math.abs(delta) >= 0.8) {
      const picked = articles.slice(0, 3).map(a => ({
        title: a.title,
        source: a.domain || a.sourcecountry || 'unknown',
        url: a.url,
        seen: a.seendate
      }));
      highlights.push({
        time: kline[i].time,
        delta: Number(delta.toFixed(2)),
        reasons: picked
      });
    }
  }
  return highlights.slice(-6);
}

async function refreshSector(name, query) {
  const q = encodeURIComponent(query);
  const toneUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ToneChart&format=json&maxrecords=250`;
  const listUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&format=json&maxrecords=30&sort=DateDesc`;

  const [toneData, listData] = await Promise.all([
    fetchJson(toneUrl).catch(() => ({ tone: [] })),
    fetchJson(listUrl).catch(() => ({ articles: [] }))
  ]);

  const tonePoints = (toneData?.tone || toneData?.timeline || []).map(x => ({
    date: x.date || x.datetime || x.timebin,
    value: Number(x.value ?? x.tone ?? 0)
  })).filter(x => x.date);

  const articles = (listData?.articles || []).map(a => ({
    title: a.title,
    url: a.url,
    domain: a.domain,
    sourcecountry: a.sourcecountry,
    seendate: a.seendate
  }));

  const kline = toKlineLike(tonePoints);
  const sentimentNow = kline.at(-1)?.close ?? 0;
  const sentimentPrev = kline.at(-2)?.close ?? sentimentNow;

  return {
    query,
    sentimentNow,
    change: Number((sentimentNow - sentimentPrev).toFixed(2)),
    kline,
    articles,
    highlights: buildHighlights(kline, articles)
  };
}

async function refreshAll() {
  const next = {};
  for (const [name, query] of Object.entries(SECTORS)) {
    try {
      next[name] = await refreshSector(name, query);
    } catch (e) {
      console.error(`refresh failed for ${name}:`, e.message);
      next[name] = cache.sectors[name] || { error: e.message, kline: [], articles: [], highlights: [] };
    }
  }
  cache = { updatedAt: new Date().toISOString(), sectors: next };
  saveCache();
  console.log('refreshed', cache.updatedAt);
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, updatedAt: cache.updatedAt, updateMinutes: 5 });
});

app.get('/api/data', (req, res) => {
  res.json(cache);
});

loadCache();
refreshAll().catch((e) => console.error('initial refresh failed:', e.message));
setInterval(() => refreshAll().catch((e) => console.error('refresh failed:', e.message)), UPDATE_MS);

app.listen(PORT, () => {
  console.log(`dashboard on http://localhost:${PORT}`);
});
