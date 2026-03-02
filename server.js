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

const POS = ['surge','beat','growth','record','bull','approval','win','rally','up','optimism','breakthrough'];
const NEG = ['drop','fall','miss','ban','hack','war','crackdown','loss','down','fear','lawsuit','recession'];
const trCache = new Map();

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

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 OpenClaw Dashboard' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

function scoreTitle(title = '') {
  const t = title.toLowerCase();
  const pos = POS.filter(p => t.includes(p));
  const neg = NEG.filter(n => t.includes(n));
  return { score: pos.length - neg.length, pos, neg };
}

async function translateToZh(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (trCache.has(raw)) return trCache.get(raw);
  try {
    const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(raw.slice(0, 500))}`;
    const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const j = await res.json();
    const out = (j?.[0] || []).map(x => x?.[0] || '').join('') || raw;
    trCache.set(raw, out);
    return out;
  } catch {
    return raw;
  }
}

function parseRssItems(xml = '') {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
  return items.map(item => {
    const get = (tag) => (item.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const desc = get('description');
    const img = desc.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1] || '';
    const snippet = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      title: get('title'),
      url: get('link'),
      pubDate: new Date(get('pubDate') || Date.now()).toISOString(),
      source: get('source') || 'Google News',
      image: img,
      snippet
    };
  }).filter(x => x.title && x.url);
}

async function fetchArticleExcerpt(url, fallback = '') {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 OpenClaw Dashboard' }, redirect: 'follow', signal: ctrl.signal });
    clearTimeout(t);
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 240) || fallback;
  } catch {
    return fallback || '';
  }
}

function toKlineLikeFromArticles(articles = []) {
  const sorted = [...articles].sort((a,b) => new Date(a.pubDate) - new Date(b.pubDate));
  const buckets = new Map();
  for (const a of sorted) {
    const ts = new Date(a.pubDate);
    const min = Math.floor(ts.getUTCMinutes() / 5) * 5;
    ts.setUTCMinutes(min, 0, 0);
    const k = ts.toISOString();
    const prev = buckets.get(k) || [];
    prev.push({ article: a, analysis: scoreTitle(a.title) });
    buckets.set(k, prev);
  }

  let lastClose = 0;
  const out = [];
  for (const [time, vals] of [...buckets.entries()].sort((a,b)=>a[0].localeCompare(b[0]))) {
    const avg = vals.reduce((x,y)=>x+y.analysis.score,0) / vals.length;
    const pos = [...new Set(vals.flatMap(v => v.analysis.pos))];
    const neg = [...new Set(vals.flatMap(v => v.analysis.neg))];
    const open = Number(lastClose.toFixed(2));
    const close = Number((lastClose + avg).toFixed(2));
    const high = Number(Math.max(open, close, open + Math.abs(avg) * 0.6).toFixed(2));
    const low = Number(Math.min(open, close, close - Math.abs(avg) * 0.6).toFixed(2));
    out.push({
      time, open, high, low, close,
      analysis: {
        newsCount: vals.length,
        avgScore: Number(avg.toFixed(2)),
        plus: pos,
        minus: neg,
        sample: vals.slice(0,2).map(v => v.article.titleZh || v.article.title)
      }
    });
    lastClose = close;
  }
  return out.slice(-80);
}

function buildHighlights(kline = [], articles = []) {
  const highlights = [];
  for (let i = 1; i < kline.length; i++) {
    const delta = kline[i].close - kline[i - 1].close;
    if (Math.abs(delta) >= 0.8) {
      const picked = articles.slice(0, 3).map(a => ({
        title: a.titleZh || a.title,
        source: a.domain || a.source || a.sourcecountry || 'unknown',
        url: a.url,
        image: a.image || '',
        content: a.contentZh || a.content || a.snippet || '',
        scoreBasis: scoreTitle(a.title),
        seen: a.seendate || a.pubDate
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
  const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;

  const xml = await fetchText(rssUrl);
  const articles = parseRssItems(xml).slice(0, 80);
  const enriched = await Promise.all(articles.slice(0, 12).map(async (a) => {
    const content = await fetchArticleExcerpt(a.url, a.snippet);
    const [titleZh, contentZh] = await Promise.all([
      translateToZh(a.title),
      translateToZh(content)
    ]);
    return { ...a, content, titleZh, contentZh };
  }));
  const merged = [...enriched, ...articles.slice(12).map(a => ({ ...a, content: a.snippet, titleZh: a.title, contentZh: a.snippet }))];

  const kline = toKlineLikeFromArticles(merged);
  const sentimentNow = kline.at(-1)?.close ?? 0;
  const sentimentPrev = kline.at(-2)?.close ?? sentimentNow;

  return {
    query,
    sentimentNow,
    change: Number((sentimentNow - sentimentPrev).toFixed(2)),
    kline,
    articles: merged,
    highlights: buildHighlights(kline, merged.map(a => ({ ...a, seendate: a.pubDate })))
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
