'use strict';

// Brand colours for quick links. Two sources, in priority order:
//   1. A curated override map (below) for major brands — used when the
//      favicon colour is misleading, monochrome, or we just want the exact
//      brand hue.
//   2. Automatic extraction from Chrome's LOCAL favicon cache (the `favicon`
//      permission). This reads from the icons Chrome already stored while the
//      user browsed — it makes NO external network request, so the
//      "zero network requests" promise holds.
//
// Each entry is { bg, fg }: bg = pill fill, fg = text/accent.
const BrandColors = (() => {

  const OVERRIDES = {
    // ── Streaming / video ────────────────────────────────────────────────
    'netflix.com':        { bg: '#141414', fg: '#E50914' },
    'youtube.com':        { bg: '#0F0F0F', fg: '#FF0000' },
    'primevideo.com':     { bg: '#0F171E', fg: '#00A8E1' },   // black shell, Prime blue
    'disneyplus.com':     { bg: '#0C1450', fg: '#F9F9F9' },
    'max.com':            { bg: '#0A1428', fg: '#2C7DF7' },
    'hbomax.com':         { bg: '#0A1428', fg: '#2C7DF7' },
    'hulu.com':           { bg: '#0B0C0F', fg: '#1CE783' },
    'paramountplus.com':  { bg: '#0A0F1E', fg: '#0064FF' },
    'peacocktv.com':      { bg: '#000000', fg: '#F5F5F5' },
    'tv.apple.com':       { bg: '#000000', fg: '#F5F5F7' },
    'crunchyroll.com':    { bg: '#0B0B0B', fg: '#F47521' },
    'twitch.tv':          { bg: '#0E0E10', fg: '#9146FF' },
    'vimeo.com':          { bg: '#0D1620', fg: '#1AB7EA' },
    'espn.com':           { bg: '#0A0A0A', fg: '#D50A0A' },
    // ── Music / audio ────────────────────────────────────────────────────
    'spotify.com':        { bg: '#121212', fg: '#1DB954' },
    'music.apple.com':    { bg: '#0B0B0B', fg: '#FA2D48' },
    'soundcloud.com':     { bg: '#0F0F0F', fg: '#FF5500' },
    'tidal.com':          { bg: '#000000', fg: '#F5F5F5' },
    'bandcamp.com':       { bg: '#1A1A1A', fg: '#629AA9' },
    // ── Social ───────────────────────────────────────────────────────────
    'x.com':              { bg: '#000000', fg: '#F5F5F5' },
    'twitter.com':        { bg: '#000000', fg: '#1D9BF0' },
    'facebook.com':       { bg: '#0B0F19', fg: '#1877F2' },
    'instagram.com':      { bg: '#131313', fg: '#E1306C' },
    'linkedin.com':       { bg: '#0A0F14', fg: '#0A85C7' },
    'reddit.com':         { bg: '#0B1416', fg: '#FF4500' },
    'pinterest.com':      { bg: '#111111', fg: '#E60023' },
    'tiktok.com':         { bg: '#010101', fg: '#25F4EE' },
    'snapchat.com':       { bg: '#111111', fg: '#FFFC00' },
    'whatsapp.com':       { bg: '#0B141A', fg: '#25D366' },
    'telegram.org':       { bg: '#0E1621', fg: '#2AABEE' },
    'discord.com':        { bg: '#1A1B24', fg: '#5865F2' },
    'threads.net':        { bg: '#000000', fg: '#F5F5F5' },
    'bsky.app':           { bg: '#0A0F16', fg: '#1185FE' },
    'tumblr.com':         { bg: '#001935', fg: '#E8ECF0' },
    // ── Work / dev ───────────────────────────────────────────────────────
    'github.com':         { bg: '#0D1117', fg: '#E6EDF3' },
    'gitlab.com':         { bg: '#1F1B24', fg: '#FC6D26' },
    'stackoverflow.com':  { bg: '#0D0D0D', fg: '#F48024' },
    'figma.com':          { bg: '#1E1E1E', fg: '#F24E1E' },
    'notion.so':          { bg: '#191919', fg: '#F5F5F5' },
    'slack.com':          { bg: '#1A1D21', fg: '#36C5F0' },
    'dropbox.com':        { bg: '#0B1420', fg: '#0061FF' },
    'trello.com':         { bg: '#172B4D', fg: '#579DFF' },
    'atlassian.com':      { bg: '#0A1938', fg: '#4C9AFF' },
    'vercel.com':         { bg: '#000000', fg: '#F5F5F5' },
    'npmjs.com':          { bg: '#0D0D0D', fg: '#CB3837' },
    'codepen.io':         { bg: '#131417', fg: '#F5F5F5' },
    'replit.com':         { bg: '#0E1525', fg: '#F26207' },
    // ── Google ───────────────────────────────────────────────────────────
    'google.com':         { bg: '#ffffff', fg: '#4285F4' },
    'gmail.com':          { bg: '#1A1A1A', fg: '#EA4335' },
    'mail.google.com':    { bg: '#1A1A1A', fg: '#EA4335' },
    'drive.google.com':   { bg: '#141414', fg: '#1FA463' },
    'docs.google.com':    { bg: '#141414', fg: '#4285F4' },
    'calendar.google.com':{ bg: '#141414', fg: '#4285F4' },
    'meet.google.com':    { bg: '#0A0A0A', fg: '#00A98F' },
    'maps.google.com':    { bg: '#141414', fg: '#34A853' },
    // ── AI ───────────────────────────────────────────────────────────────
    'chatgpt.com':        { bg: '#0D0D0D', fg: '#10A37F' },
    'openai.com':         { bg: '#0D0D0D', fg: '#10A37F' },
    'claude.ai':          { bg: '#1F1B18', fg: '#D97757' },
    'gemini.google.com':  { bg: '#131314', fg: '#4A8CFF' },
    'perplexity.ai':      { bg: '#0A0A0A', fg: '#20B8CD' },
    'huggingface.co':     { bg: '#0A0A0A', fg: '#FFD21E' },
    // ── Shopping ─────────────────────────────────────────────────────────
    'amazon.com':         { bg: '#131A22', fg: '#FF9900' },
    'ebay.com':           { bg: '#111111', fg: '#E53238' },
    'etsy.com':           { bg: '#111111', fg: '#F16521' },
    'walmart.com':        { bg: '#0A1E3F', fg: '#FFC220' },
    'target.com':         { bg: '#0D0D0D', fg: '#CC0000' },
    'bestbuy.com':        { bg: '#0A0A0A', fg: '#FFF200' },
    'aliexpress.com':     { bg: '#111111', fg: '#E62E04' },
    // ── Games ────────────────────────────────────────────────────────────
    'steampowered.com':   { bg: '#171A21', fg: '#66C0F4' },
    'epicgames.com':      { bg: '#121212', fg: '#F5F5F5' },
    'playstation.com':    { bg: '#0A0A0A', fg: '#0070D1' },
    'xbox.com':           { bg: '#0A0A0A', fg: '#107C10' },
    'nintendo.com':       { bg: '#0A0A0A', fg: '#E60012' },
    'roblox.com':         { bg: '#0A0A0A', fg: '#E2231A' },
    // ── Finance ──────────────────────────────────────────────────────────
    'paypal.com':         { bg: '#001F52', fg: '#009CDE' },
    'coinbase.com':       { bg: '#0A0B0D', fg: '#0052FF' },
    'binance.com':        { bg: '#0B0E11', fg: '#F0B90B' },
    'robinhood.com':      { bg: '#0A0A0A', fg: '#00C805' },
    // ── News / reference / misc ──────────────────────────────────────────
    'wikipedia.org':      { bg: '#ffffff', fg: '#202122' },
    'medium.com':         { bg: '#000000', fg: '#F5F5F5' },
    'substack.com':       { bg: '#111111', fg: '#FF6719' },
    'quora.com':          { bg: '#0D0D0D', fg: '#B92B27' },
    'imdb.com':           { bg: '#111111', fg: '#F5C518' },
    'nytimes.com':        { bg: '#000000', fg: '#F5F5F5' },
    'bbc.com':            { bg: '#0A0A0A', fg: '#F5F5F5' },
    'bbc.co.uk':          { bg: '#0A0A0A', fg: '#F5F5F5' },
    'cnn.com':            { bg: '#0A0A0A', fg: '#CC0000' },
    'airbnb.com':         { bg: '#111111', fg: '#FF385C' },
    'booking.com':        { bg: '#001B41', fg: '#4F9BFF' },
    'uber.com':           { bg: '#000000', fg: '#F5F5F5' },
    'doordash.com':       { bg: '#0D0D0D', fg: '#FF3008' },
    'yelp.com':           { bg: '#0D0D0D', fg: '#FF1A1A' },
    'apple.com':          { bg: '#000000', fg: '#F5F5F7' },
    'microsoft.com':      { bg: '#0A0A0A', fg: '#F25022' },
    'yahoo.com':          { bg: '#1D0A3F', fg: '#7B16FF' },
  };

  // Domains with a bundled brand logo under icons/brands/<domain>.svg. These are
  // monochrome single-path marks (Simple Icons, CC0) fetched at build time — so
  // the "zero network requests" promise holds. Having a local copy means the
  // logo shows for curated brands even when Chrome has no cached favicon.
  //
  // Brands whose mark is just a bare letter/monogram (Netflix N, Facebook f,
  // Medium M, X, Tumblr t, Quora Q, Google G) are intentionally left out — a
  // lone letter adds nothing over the text label, so those pills stay text-only.
  const BRAND_LOGOS = new Set([
    'airbnb.com', 'aliexpress.com', 'amazon.com', 'apple.com', 'atlassian.com', 'bandcamp.com',
    'bbc.com', 'binance.com', 'booking.com', 'bsky.app', 'calendar.google.com', 'chatgpt.com',
    'claude.ai', 'cnn.com', 'codepen.io', 'coinbase.com', 'crunchyroll.com', 'discord.com',
    'docs.google.com', 'doordash.com', 'drive.google.com', 'dropbox.com', 'ebay.com', 'epicgames.com',
    'etsy.com', 'figma.com', 'gemini.google.com', 'github.com', 'gitlab.com', 'gmail.com',
    'huggingface.co', 'hulu.com', 'imdb.com', 'instagram.com', 'linkedin.com', 'maps.google.com',
    'meet.google.com', 'music.apple.com', 'notion.so', 'npmjs.com', 'openai.com', 'paramountplus.com',
    'paypal.com', 'perplexity.ai', 'pinterest.com', 'playstation.com', 'reddit.com', 'replit.com',
    'robinhood.com', 'roblox.com', 'slack.com', 'snapchat.com', 'soundcloud.com',
    'spotify.com', 'stackoverflow.com', 'steampowered.com', 'substack.com', 'target.com', 'telegram.org',
    'threads.net',
    'tidal.com', 'tiktok.com', 'trello.com', 'tv.apple.com', 'twitch.tv', 'uber.com',
    'vercel.com', 'vimeo.com', 'walmart.com', 'whatsapp.com', 'wikipedia.org', 'yahoo.com',
    'yelp.com', 'youtube.com',
  ]);

  // Registrable domain (drop www / m). Not a full public-suffix parse, but it
  // matches the map keys well enough for real-world quick links.
  function domainOf(url) {
    try {
      let host = new URL(url).hostname.toLowerCase();
      return host.replace(/^(www\.|m\.)/, '');
    } catch (e) {
      return null;
    }
  }

  // Look up the override map, matching either the full host (mail.google.com)
  // or the last two labels (google.com) so subdomains still resolve.
  function lookup(domain) {
    if (!domain) return null;
    if (OVERRIDES[domain]) return OVERRIDES[domain];
    const parts = domain.split('.');
    if (parts.length > 2) {
      const base = parts.slice(-2).join('.');
      if (OVERRIDES[base]) return OVERRIDES[base];
    }
    return null;
  }

  // Resolve a domain to the domain whose bundled logo we should use, matching
  // either the full host or the last two labels (so subdomains resolve). Returns
  // null when we ship no logo for the site.
  function logoDomain(domain) {
    if (!domain) return null;
    if (BRAND_LOGOS.has(domain)) return domain;
    const parts = domain.split('.');
    if (parts.length > 2) {
      const base = parts.slice(-2).join('.');
      if (BRAND_LOGOS.has(base)) return base;
    }
    return null;
  }

  // Absolute extension URL for a bundled logo (no network request). Absolute so
  // it resolves correctly when used inside a CSS mask, where a relative URL
  // would be resolved against the stylesheet, not the page.
  function logoUrl(domain) {
    const path = 'icons/brands/' + domain + '.svg';
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(path);
    }
    return path;
  }

  // Local favicon URL from Chrome's cache — no network request.
  function faviconUrl(pageUrl, size) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) {
      return null;
    }
    const u = new URL(chrome.runtime.getURL('/_favicon/'));
    u.searchParams.set('pageUrl', pageUrl);
    u.searchParams.set('size', String(size || 32));
    return u.toString();
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    }
    return { s, l };
  }

  // Pick the dominant *vivid* colour from raw RGBA pixel data. Averaging all
  // pixels yields mud; instead we bucket colours and weight each bucket by how
  // saturated it is, so the brand hue wins over background white/black.
  function dominantColor(data) {
    const buckets = {};
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const { s, l } = rgbToHsl(r, g, b);
      // Ignore near-transparent / extreme pixels when weighting toward hue.
      const weight = 1 + s * s * 8;
      const key = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
      const bkt = buckets[key] || (buckets[key] = { r: 0, g: 0, b: 0, w: 0, s: 0, n: 0 });
      bkt.r += r * weight; bkt.g += g * weight; bkt.b += b * weight;
      bkt.w += weight; bkt.s += s; bkt.n += 1;
    }
    let best = null, bestScore = 0;
    for (const key in buckets) {
      const bkt = buckets[key];
      const avgSat = bkt.s / bkt.n;
      const score = bkt.w * (0.3 + avgSat);
      if (score > bestScore) { bestScore = score; best = bkt; }
    }
    if (!best) return null;
    let r = Math.round(best.r / best.w);
    let g = Math.round(best.g / best.w);
    let b = Math.round(best.b / best.w);
    const { s, l } = rgbToHsl(r, g, b);
    // Too grey (monochrome favicon or Chrome's default globe) → give up so the
    // caller keeps the neutral glass pill.
    if (s < 0.18) return null;

    // Match the curated look: a near-black shell tinted by the brand hue, with
    // the vivid brand colour as the accent — rather than a solid brand fill.
    if (l < 0.35) {
      // Dark logo colour → lift it so the accent stays readable on the shell.
      const lift = 0.55 / Math.max(l, 0.12);
      r = Math.min(255, Math.round(r * lift));
      g = Math.min(255, Math.round(g * lift));
      b = Math.min(255, Math.round(b * lift));
    }
    const hex = (rr, gg, bb) =>
      '#' + [rr, gg, bb].map(v => v.toString(16).padStart(2, '0')).join('');
    const fg = hex(r, g, b);
    // Shell = brand hue crushed toward black (~10% of the accent).
    const bg = hex(Math.round(r * 0.1), Math.round(g * 0.1), Math.round(b * 0.1));
    return { bg, fg };
  }

  // Load a page's local favicon into a fixed 32×32 canvas and return its raw
  // RGBA bytes (or null on failure/timeout).
  const ICON_SIZE = 32;
  function loadIconData(pageUrl) {
    return new Promise(resolve => {
      const src = faviconUrl(pageUrl, ICON_SIZE);
      if (!src) { resolve(null); return; }
      let done = false;
      const finish = v => { if (!done) { done = true; resolve(v); } };
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = ICON_SIZE; canvas.height = ICON_SIZE;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, ICON_SIZE, ICON_SIZE);
          finish(ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE).data);
        } catch (e) { finish(null); }
      };
      img.onerror = () => finish(null);
      img.src = src;
      setTimeout(() => finish(null), 3000);
    });
  }

  // Chrome serves a generic grey globe when it has no cached favicon for a
  // site. We fingerprint it once by requesting a bogus URL, then treat any
  // icon that matches it as "blank" so the caller can skip the logo.
  let defaultSigPromise = null;
  function defaultSignature() {
    if (!defaultSigPromise) {
      defaultSigPromise = loadIconData('https://liv-blank-favicon.invalid/');
    }
    return defaultSigPromise;
  }

  function sameIcon(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return sum / a.length < 6;   // near-identical → it's Chrome's default
  }

  // Read a page's favicon and report whether it's the blank/default globe and,
  // if not, the brand colour extracted from it.
  function analyze(pageUrl) {
    return Promise.all([loadIconData(pageUrl), defaultSignature()])
      .then(([data, def]) => {
        if (!data) return { blank: true, colors: null };
        const blank = sameIcon(data, def);
        return { blank, colors: blank ? null : dominantColor(data) };
      });
  }

  // A display name derived from the domain, e.g. "netflix.com" → "Netflix",
  // "mail.google.com" → "Google". Used when a link has no label.
  function siteName(url) {
    const domain = domainOf(url);
    if (!domain) return '';
    const parts = domain.split('.');
    const core = parts.length > 2 ? parts[parts.length - 2] : parts[0];
    return core.charAt(0).toUpperCase() + core.slice(1);
  }

  return { OVERRIDES, domainOf, lookup, analyze, faviconUrl, logoDomain, logoUrl, siteName };
})();
