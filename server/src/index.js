/**
 * Threadline API — Cloudflare Worker.
 *
 * Keeps the Anthropic and remove.bg keys off the phone. The app never sees
 * either one; it only talks to this worker.
 *
 * Bindings expected (see wrangler.toml):
 *   ANTHROPIC_API_KEY   secret
 *   REMOVEBG_API_KEY    secret
 *   RATE_LIMIT          KV namespace (optional but recommended)
 *   MODEL               var, defaults to claude-sonnet-5
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

const fail = (message, status = 400) => json({ error: message }, status);

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return fail('Use POST.', 405);

    const { pathname } = new URL(request.url);

    const limited = await rateLimit(request, env, pathname);
    if (limited) return limited;

    let body;
    try {
      body = await request.json();
    } catch {
      return fail('Send a JSON body.');
    }

    try {
      switch (pathname) {
        case '/v1/cutout':     return await cutout(body, env);
        case '/v1/tag-photo':  return await tagPhoto(body, env);
        case '/v1/product':    return await product(body, env);
        case '/v1/tag-product':return await tagProduct(body, env);
        case '/v1/find':       return await find(body, env);
        case '/v1/outfit':     return await outfit(body, env);
        case '/v1/gaps':       return await gaps(body, env);
        case '/v1/pack':       return await pack(body, env);
        default:               return fail('No such endpoint.', 404);
      }
    } catch (err) {
      console.error(pathname, err);
      return fail(err.message || 'Something went wrong upstream.', err.status || 502);
    }
  },
};

/* ── rate limiting ───────────────────────────────────────── */
const COST = { '/v1/cutout': 5, '/v1/tag-photo': 3, '/v1/find': 6 };

async function rateLimit(request, env, pathname) {
  if (!env.RATE_LIMIT) return null;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const window = Math.floor(Date.now() / 60000);
  const key = `rl:${ip}:${window}`;
  const used = Number((await env.RATE_LIMIT.get(key)) || 0);
  const cost = COST[pathname] || 1;
  if (used + cost > 60) {
    return fail('Too many requests. Wait a minute and try again.', 429);
  }
  await env.RATE_LIMIT.put(key, String(used + cost), { expirationTtl: 120 });
  return null;
}

/* ── Anthropic helpers ───────────────────────────────────── */
async function claude(env, { system, content, maxTokens = 900, tools, effort }) {
  if (!env.ANTHROPIC_API_KEY) {
    const e = new Error('ANTHROPIC_API_KEY is not set on the worker.');
    e.status = 500;
    throw e;
  }
  const body = {
    model: env.MODEL || 'claude-sonnet-5',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
  };
  if (tools) body.tools = tools;
  if (effort) body.output_config = { effort };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    const e = new Error(`Styling service error (${res.status}).`);
    e.status = res.status === 429 ? 429 : 502;
    console.error('anthropic', res.status, detail.slice(0, 400));
    throw e;
  }

  const data = await res.json();
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

function parseJson(text) {
  const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.search(/[[{]/);
    const end = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(clean.slice(start, end + 1));
      } catch { /* fall through to the friendly error below */ }
    }
    const e = new Error('The model returned something unreadable. Try again.');
    e.status = 502;
    throw e;
  }
}

const CATEGORIES = ['headwear', 'tops', 'innerwear', 'outerwear', 'pants', 'dresses', 'shoes', 'accessories'];
const SEASONS = ['spring', 'summer', 'fall', 'winter'];

const FIELD_SPEC =
  `{"name":string (2-5 words),"brand":string,"category":one of ${JSON.stringify(CATEGORIES)},` +
  `"color":hex string of the garment colour,"colorName":string,"material":string,` +
  `"seasons":array from ${JSON.stringify(SEASONS)},"formality":integer 1-5 where 1 is gym and 5 is black tie,` +
  `"tags":array of 2-3 short lowercase occasion words,"price":number in the item's currency (0 if unknown)}`;

function normaliseFields(f) {
  return {
    name: String(f.name || '').slice(0, 60),
    brand: String(f.brand || '').slice(0, 40),
    category: CATEGORIES.includes(f.category) ? f.category : 'tops',
    color: /^#[0-9a-f]{6}$/i.test(f.color || '') ? f.color : '#8A8A8A',
    colorName: String(f.colorName || '').slice(0, 30),
    material: String(f.material || '').slice(0, 30),
    seasons: Array.isArray(f.seasons) ? f.seasons.filter((s) => SEASONS.includes(s)) : [],
    formality: Math.min(5, Math.max(1, parseInt(f.formality, 10) || 3)),
    tags: Array.isArray(f.tags) ? f.tags.slice(0, 4).map((t) => String(t).slice(0, 20)) : [],
    price: Number(f.price) || 0,
  };
}

/* ── /v1/cutout — real background removal ────────────────── */
async function cutout({ image }, env) {
  if (!image) return fail('No image supplied.');
  if (!env.REMOVEBG_API_KEY) return fail('REMOVEBG_API_KEY is not set on the worker.', 500);

  const form = new FormData();
  form.append('image_file_b64', image);
  form.append('size', 'auto');
  form.append('format', 'png');
  form.append('type', 'product');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': env.REMOVEBG_API_KEY },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('remove.bg', res.status, detail.slice(0, 300));
    if (res.status === 402) return fail('Background removal credits are exhausted.', 402);
    return fail('Background removal failed for that photo.', 502);
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
  }
  return json({ pngBase64: btoa(binary) });
}

/* ── /v1/tag-photo — vision auto-tagging ─────────────────── */
async function tagPhoto({ image, mediaType }, env) {
  if (!image) return fail('No image supplied.');
  const media_type = mediaType === 'image/png' ? 'image/png' : 'image/jpeg';
  const text = await claude(env, {
    system: 'You catalogue clothing for a wardrobe app. You reply with JSON only — no prose, no code fences.',
    maxTokens: 500,
    content: [
      { type: 'image', source: { type: 'base64', media_type, data: image } },
      {
        type: 'text',
        text:
          `Catalogue this garment. Read the actual colour off the image. Leave brand empty unless a logo ` +
          `is legible. Set price to 0.\n\nReply with only this JSON object: ${FIELD_SPEC}`,
      },
    ],
  });
  return json(normaliseFields(parseJson(text)));
}

/* ── page scraping, shared by /v1/product and /v1/find ───── */
// Some retailers block plain server requests, or only add the product image
// via JavaScript after the page loads. When SCRAPER_API_KEY is set, route the
// fetch through ScraperAPI instead — it fetches from a residential IP and can
// render the page's JavaScript, so it also picks up those JS-injected images.
// Without a key configured, this falls back to fetching the page directly.
async function scrapeProduct(url, env, { timeout = 8000 } = {}) {
  const empty = {
    title: '', brand: '', description: '', price: 0, currency: '',
    image: null, url, blocked: true,
  };
  if (!url || !/^https?:\/\//i.test(url)) return empty;

  const viaScraperApi = Boolean(env?.SCRAPER_API_KEY);

  // One fetch-and-parse attempt. `premium` routes through ScraperAPI's
  // residential-IP pool instead of its cheaper datacenter one — it costs far
  // more credits, so it's only worth trying when the cheap attempt failed.
  // Returns null (not `empty`) on any failure so the caller can decide whether
  // to retry, rather than the empty shell short-circuiting that decision.
  const attempt = async (premium) => {
    // ScraperAPI adds its own fetch overhead on top of ours — give it more room
    // than a direct fetch needs, even more so for a slower premium request.
    const effectiveTimeout = viaScraperApi ? Math.max(timeout, premium ? 20000 : 12000) : timeout;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), effectiveTimeout);

    // No `render`: retailers put the product image in a plain <meta og:image>
    // tag for SEO, present in the raw HTML — paying for JS rendering to get it
    // only adds latency for no benefit.
    const fetchUrl = viaScraperApi
      ? `https://api.scraperapi.com/?api_key=${env.SCRAPER_API_KEY}&url=${encodeURIComponent(url)}${premium ? '&premium=true' : ''}`
      : url;

    let page;
    try {
      page = await fetch(fetchUrl, {
        headers: viaScraperApi
          ? {}
          : {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Upgrade-Insecure-Requests': '1',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
            },
        redirect: 'follow',
        signal: ctrl.signal,
        cf: { cacheTtl: 300 },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }

    if (!page.ok) return null;
    // ScraperAPI's own response URL isn't the retailer's page, so keep using the
    // original URL as the base for resolving relative image paths below.
    const baseUrl = viaScraperApi ? url : page.url;

    const found = { meta: {}, ldjson: [] };
    const rewriter = new HTMLRewriter()
      .on('meta', {
        element(el) {
          const key = el.getAttribute('property') || el.getAttribute('name');
          const value = el.getAttribute('content');
          if (key && value) found.meta[key.toLowerCase()] = value;
        },
      })
      .on('script[type="application/ld+json"]', {
        text(chunk) {
          found.buffer = (found.buffer || '') + chunk.text;
          if (chunk.lastInTextNode) {
            found.ldjson.push(found.buffer);
            found.buffer = '';
          }
        },
      });

    try {
      await rewriter.transform(page).arrayBuffer();
    } catch {
      return null;
    }

    let node = null;
    for (const raw of found.ldjson) {
      try {
        const parsed = JSON.parse(raw.trim());
        const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] || [])];
        const hit = nodes.find(
          (n) => n && (n['@type'] === 'Product' || (Array.isArray(n['@type']) && n['@type'].includes('Product')))
        );
        if (hit) { node = hit; break; }
      } catch { /* malformed block, keep looking */ }
    }

    const m = found.meta;
    const offers = node?.offers ? (Array.isArray(node.offers) ? node.offers[0] : node.offers) : null;
    const rawImage =
      (Array.isArray(node?.image) ? node.image[0] : typeof node?.image === 'string' ? node.image : null) ||
      m['og:image'] || m['twitter:image'] || null;

    const title = node?.name || m['og:title'] || m['twitter:title'] || '';
    if (!title) return null;

    let image = null;
    if (rawImage) {
      try { image = new URL(rawImage, baseUrl).toString(); } catch { image = null; }
    }

    return {
      title,
      brand: (typeof node?.brand === 'object' ? node.brand?.name : node?.brand) || m['og:site_name'] || '',
      description: (node?.description || m['og:description'] || m.description || '').slice(0, 600),
      price: Number(offers?.price || m['product:price:amount'] || 0) || 0,
      currency: offers?.priceCurrency || m['product:price:currency'] || '',
      image,
      url: baseUrl,
      blocked: false,
    };
  };

  const cheap = await attempt(false);
  if (cheap) return cheap;

  if (viaScraperApi) {
    const premium = await attempt(true);
    if (premium) return premium;
  }

  return empty;
}

/* ── /v1/product — read a retailer page ──────────────────── */
async function product({ url }, env) {
  if (!url || !/^https?:\/\//i.test(url)) return fail('Send a full http(s) product URL.');
  return json(await scrapeProduct(url, env));
}

/* ── /v1/tag-product — classify scraped text ─────────────── */
async function tagProduct(body, env) {
  const { title, brand, description, price, url } = body;
  if (!title && !url) return fail('Nothing to work from.');
  const text = await claude(env, {
    system: 'You catalogue clothing for a wardrobe app. You reply with JSON only — no prose, no code fences.',
    maxTokens: 500,
    content:
      `Catalogue this product for a user's closet.\n\n` +
      `Title: ${title || '(none)'}\nBrand: ${brand || '(none)'}\nPrice: ${price || 0}\n` +
      `URL: ${url || '(none)'}\nDescription: ${(description || '').slice(0, 500)}\n\n` +
      `Use the words in the title, description and URL slug. Where something is genuinely unknowable, ` +
      `make the typical guess for this kind of product rather than leaving it blank.\n\n` +
      `Reply with only this JSON object: ${FIELD_SPEC}`,
  });
  return json(normaliseFields(parseJson(text)));
}

/* ── /v1/outfit — the stylist ────────────────────────────── */
async function outfit(body, env) {
  const { occasion, profile, weather, closet, feedback, recentlyWorn, avoid } = body;
  if (!Array.isArray(closet) || closet.length < 3) return fail('Not enough clean items to work with.');

  const text = await claude(env, {
    system:
      'You are the stylist inside a wardrobe app. You only ever use items from the list you are given. ' +
      'You reply with JSON only — no prose, no code fences.',
    maxTokens: 700,
    content:
      `Occasion: ${occasion}\n` +
      `Weather: ${weather?.description || 'unknown'}\n` +
      `The wearer's styles: ${(profile?.styles || []).join(', ') || 'unspecified'}\n` +
      `Where they usually show up: ${(profile?.contexts || []).join(', ') || 'unspecified'}\n` +
      (feedback?.length ? `Past reactions: ${JSON.stringify(feedback)}\n` : '') +
      (recentlyWorn?.length ? `Worn in the last few days, avoid if you can: ${JSON.stringify(recentlyWorn)}\n` : '') +
      (avoid?.length ? `Do not repeat this combination — change at least two pieces: ${JSON.stringify(avoid)}\n` : '') +
      `\nAvailable items:\n${JSON.stringify(closet)}\n\n` +
      `Rules: cover top, bottom and shoes, or a dress and shoes. Add outerwear below 16°C or if rain is likely. ` +
      `Accessories and headwear only when they earn their place. Match the occasion's formality and keep the ` +
      `colours coherent.\n\n` +
      `Reply with only: {"name":string (3-4 words, an evocative name for the outfit),` +
      `"itemIds":array of ids taken from the list,"why":string (max 25 words, specific and plain),` +
      `"missing":string (one thing the closet lacks for this occasion, or "")}`,
  });

  const parsed = parseJson(text);
  const valid = new Set(closet.map((i) => i.id));
  return json({
    name: String(parsed.name || 'Today').slice(0, 40),
    itemIds: (parsed.itemIds || []).filter((id) => valid.has(id)),
    why: String(parsed.why || '').slice(0, 200),
    missing: String(parsed.missing || '').slice(0, 120),
  });
}

/* ── /v1/find — describe it, and the web gets searched ───── */
async function find(body, env) {
  const { brand, keywords, design, image } = body;
  if (!keywords && !brand && !image) return fail('Describe the piece first.');

  const described =
    `Brand: ${brand || '(unknown)'}\n` +
    `Description: ${keywords || '(none given)'}\n` +
    `Key design or artwork: ${design || '(none)'}\n`;

  const content = [];
  if (image) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: image },
    });
    content.push({
      type: 'text',
      text:
        `The image shows the garment, or the artwork/graphic printed on it. Read it carefully — ` +
        `any visible text, logo, motif or print is the strongest clue to the exact product.\n\n`,
    });
  }
  content.push({
    type: 'text',
    text:
      `Find this specific clothing item for sale online.\n\n${described}\n` +
      `Search the web. Prefer the brand's own site, then large retailers. Issue your searches together in ` +
      `the same turn rather than one at a time — e.g. the brand's own site, and 1-2 large retailers, all at ` +
      `once — instead of waiting for one search's results before starting the next; you already know enough ` +
      `from the description to pick those queries upfront. If you cannot find the exact piece, return the ` +
      `closest genuine matches you did find — never invent a product or a URL.\n\n` +
      `Reply with ONLY JSON, no prose, no fences:\n` +
      `{"matches":[{"name":string (2-6 words),"brand":string,"price":number (0 if unknown),` +
      `"url":string (the product page you actually found, or ""),"source":string (site name),` +
      `"confidence":"high"|"medium"|"low","category":one of ${JSON.stringify(CATEGORIES)},` +
      `"color":hex of the garment colour,"colorName":string,"material":string,` +
      `"seasons":array from ${JSON.stringify(SEASONS)},"formality":integer 1-5,` +
      `"tags":array of 2-3 short lowercase occasion words}]}\n` +
      `Return at most 4 matches, best first.`,
  });

  const text = await claude(env, {
    system:
      'You identify clothing from descriptions and images, using web search to find the real product. ' +
      'You never fabricate products or URLs. You reply with JSON only — no prose, no code fences.',
    maxTokens: 2000,
    content,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    effort: 'medium',
  });

  const parsed = parseJson(text);
  const matches = (parsed.matches || []).slice(0, 4).map((m) => ({
    ...normaliseFields(m),
    url: typeof m.url === 'string' && /^https?:\/\//.test(m.url) ? m.url : '',
    source: String(m.source || '').slice(0, 40),
    confidence: ['high', 'medium', 'low'].includes(m.confidence) ? m.confidence : 'low',
  }));

  // Visit each product page in parallel for the real photo and the live price.
  // Blocked or slow pages simply come back without one rather than holding up the rest.
  const enriched = await Promise.all(
    matches.map(async (m) => {
      if (!m.url) return { ...m, image: null, verified: false };
      const page = await scrapeProduct(m.url, env, { timeout: 6000 });
      return {
        ...m,
        image: page.image,
        price: page.price || m.price,
        name: page.title ? page.title.slice(0, 70) : m.name,
        brand: m.brand || page.brand,
        verified: !page.blocked,
      };
    })
  );

  return json({ matches: enriched });
}

/* ── /v1/gaps — wardrobe audit ───────────────────────────── */
async function gaps({ profile, closet }, env) {
  if (!Array.isArray(closet) || !closet.length) return fail('The closet is empty.');
  const text = await claude(env, {
    system: 'You audit wardrobes. You reply with JSON only — no prose, no code fences.',
    maxTokens: 600,
    content:
      `Styles: ${(profile?.styles || []).join(', ') || 'unspecified'}. ` +
      `Settings: ${(profile?.contexts || []).join(', ') || 'unspecified'}.\n` +
      `Closet: ${JSON.stringify(closet)}\n\n` +
      `Name the three gaps that would unlock the most new outfits. Be concrete about colour and formality. ` +
      `Reply with only: {"gaps":[{"gap":string (max 8 words),"why":string (max 18 words)}]}`,
  });
  const parsed = parseJson(text);
  return json({ gaps: (parsed.gaps || []).slice(0, 3) });
}

/* ── /v1/pack — trip packing list ────────────────────────── */
async function pack({ closet, destination, days, forecast, occasions }, env) {
  if (!Array.isArray(closet) || !closet.length) return fail('The closet is empty.');
  const text = await claude(env, {
    system: 'You build capsule packing lists. You reply with JSON only — no prose, no code fences.',
    maxTokens: 800,
    content:
      `Trip: ${days} days in ${destination}.\n` +
      `Forecast: high ${forecast?.high}°C, low ${forecast?.low}°C, ${forecast?.wetDays || 0} likely wet days.\n` +
      `Planned occasions: ${(occasions || []).join(', ') || 'general travel'}\n` +
      `Closet: ${JSON.stringify(closet)}\n\n` +
      `Pick the smallest set that mixes into a full trip's worth of outfits. Favour items that work more than one way.\n` +
      `Reply with only: {"itemIds":array of ids,"notes":string (max 30 words),"buy":array of up to 2 short strings for anything missing}`,
  });
  const parsed = parseJson(text);
  const valid = new Set(closet.map((i) => i.id));
  return json({
    itemIds: (parsed.itemIds || []).filter((id) => valid.has(id)),
    notes: String(parsed.notes || '').slice(0, 200),
    buy: (parsed.buy || []).slice(0, 2),
  });
}
