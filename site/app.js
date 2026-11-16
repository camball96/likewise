/* styleit — a personal clothing feed ranked by visual taste.
 *
 * Data (built daily by pipeline/build.py):
 *   data/catalog.json  products, stores, style references, vibe names
 *   data/vectors.bin   int8 image/text embeddings: [items..., references..., vibes...] x dim
 *
 * Everything else (hearts, skips, filters) lives in this browser's localStorage.
 */
(() => {
  "use strict";

  const PAGE = 24;
  const STORE_KEY = "styleit:v1";
  const SIZES = ["XS", "S", "M", "L", "XL", "6", "8", "10", "12", "14"];
  const NEW_DAYS = 7;
  const PRICE_MAX = 500;

  // ------------------------------------------------------------ state
  let cat = null;           // catalog.json
  let items = [];           // [{id, store, title, url, img, price, compare, cat, sizes:Set, published, row}]
  let byId = new Map();
  let dim = 0;
  let vecs = null;          // Float32Array, all rows L2-normalised
  let seedRows = [], vibeRows = [];
  let seedHandles = new Set();

  const prefs = loadPrefs();
  let shown = new Set();        // ids already placed in the current feed
  let recentRows = [];          // rows of recently placed items (for de-duplication)
  let view = "feed";
  let loading = false;
  let exhausted = false;
  let draft = null;             // filter edits in the sheet before applying

  // ------------------------------------------------------------ storage
  function defaultFilters() {
    return { cats: [], sizes: [], price: PRICE_MAX, sale: false, fresh: false, vibes: [], stores: [] };
  }
  function loadPrefs() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { /* private mode etc. */ }
    return {
      likes: p.likes || {},          // id -> {t, item:{...snapshot}, v: base64 int8 vector}
      skips: p.skips || {},          // id -> t
      filters: Object.assign(defaultFilters(), p.filters || {}),
      anchor: null,                  // "more like this" item id (session only)
    };
  }
  function savePrefs() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ likes: prefs.likes, skips: prefs.skips, filters: prefs.filters }));
    } catch (e) { /* storage full / unavailable — keep working in memory */ }
  }

  // ------------------------------------------------------------ helpers
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const handleOf = (url) => { try { const u = new URL(url); return u.host.replace(/^www\./, "") + (u.pathname.match(/\/products\/[^/?#]+/) || [""])[0]; } catch (e) { return url; } };

  function sized(url, w) {
    if (!url) return "";
    if (url.includes("cdn.shopify.com") || url.includes("/cdn/shop/")) return url + (url.includes("?") ? "&" : "?") + "width=" + w;
    return url;
  }
  function money(n, cur) {
    const v = Number.isInteger(n) ? n : n.toFixed(2);
    return (cur && cur !== "AUD" ? cur + " " : "$") + v;
  }

  function dot(a, ai, b, bi) {
    let s = 0;
    for (let k = 0; k < dim; k++) s += a[ai + k] * b[bi + k];
    return s;
  }
  function rowDot(r1, r2) { return dot(vecs, r1 * dim, vecs, r2 * dim); }

  function vecToB64(row) {
    // store a liked item's vector so it still shapes taste after it sells out
    const q = new Int8Array(dim);
    let m = 1e-8;
    for (let k = 0; k < dim; k++) m = Math.max(m, Math.abs(vecs[row * dim + k]));
    for (let k = 0; k < dim; k++) q[k] = Math.round((vecs[row * dim + k] / m) * 127);
    let s = "";
    const u = new Uint8Array(q.buffer);
    for (let k = 0; k < u.length; k++) s += String.fromCharCode(u[k]);
    return btoa(s);
  }
  function b64ToVec(b64) {
    try {
      const s = atob(b64);
      if (s.length !== dim) return null;
      const u = new Uint8Array(dim);
      for (let k = 0; k < dim; k++) u[k] = s.charCodeAt(k);
      const q = new Int8Array(u.buffer), v = new Float32Array(dim);
      let n = 0;
      for (let k = 0; k < dim; k++) { v[k] = q[k]; n += q[k] * q[k]; }
      n = Math.sqrt(n) || 1;
      for (let k = 0; k < dim; k++) v[k] /= n;
      return v;
    } catch (e) { return null; }
  }

  function zscore(arr) {
    let m = 0, s = 0;
    for (const x of arr) m += x;
    m /= arr.length || 1;
    for (const x of arr) s += (x - m) * (x - m);
    s = Math.sqrt(s / (arr.length || 1)) || 1;
    return arr.map((x) => (x - m) / s);
  }

  // ------------------------------------------------------------ load
  async function load() {
    const [c, buf] = await Promise.all([
      fetch("data/catalog.json", { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error("catalog " + r.status); return r.json(); }),
      fetch("data/vectors.bin", { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error("vectors " + r.status); return r.arrayBuffer(); }),
    ]);
    cat = c;
    dim = c.dim;
    const q = new Int8Array(buf);
    const rows = q.length / dim;
    vecs = new Float32Array(q.length);
    for (let r = 0; r < rows; r++) {
      let n = 0;
      for (let k = 0; k < dim; k++) { const x = q[r * dim + k]; n += x * x; }
      n = Math.sqrt(n) || 1;
      for (let k = 0; k < dim; k++) vecs[r * dim + k] = q[r * dim + k] / n;
    }
    const F = Object.fromEntries(c.fields.map((f, i) => [f, i]));
    items = c.items.map((a, i) => ({
      id: a[F.id], store: c.stores[a[F.store]], title: a[F.title], url: a[F.url], img: a[F.img],
      price: a[F.price], compare: a[F.compare], cat: c.categories[a[F.cat]],
      sizes: new Set(a[F.sizes] ? a[F.sizes].split(" ") : []), published: a[F.published], row: i,
      currency: c.currency.length === 1 ? c.currency[0] : "AUD",
    }));
    byId = new Map(items.map((it) => [it.id, it]));
    seedRows = c.seeds.map((_, i) => items.length + i);
    vibeRows = c.vibes.map((_, i) => items.length + c.seeds.length + i);
    seedHandles = new Set(c.seeds.filter((s) => s.url).map((s) => handleOf(s.url)));

    // refresh stored snapshots/vectors for liked items still in the catalogue
    for (const id in prefs.likes) {
      const it = byId.get(id);
      if (it) { prefs.likes[id].item = snapshot(it); if (!prefs.likes[id].v) prefs.likes[id].v = vecToB64(it.row); }
    }
    savePrefs();

    const d = new Date(c.generated * 1000);
    $("status").innerHTML =
      `Updated ${d.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} · ` +
      `${items.length.toLocaleString()} pieces from ${c.stores.filter((s) => s.count).length} Australian stores · ` +
      `<button id="refreshFeed">Shuffle feed</button>`;
    $("refreshFeed").onclick = () => resetFeed(true);
  }

  function snapshot(it) {
    return { title: it.title, url: it.url, img: it.img, price: it.price, compare: it.compare, store: it.store.name, currency: it.currency };
  }

  // ------------------------------------------------------------ taste + ranking
  function passes(it, f) {
    if (prefs.skips[it.id]) return false;
    if (seedHandles.has(handleOf(it.url))) return false;
    if (f.cats.length && !f.cats.includes(it.cat)) return false;
    if (f.stores.length && !f.stores.includes(it.store.key)) return false;
    if (f.price < PRICE_MAX && it.price > f.price) return false;
    if (f.sale && !it.compare) return false;
    if (f.fresh && Date.now() / 1000 - it.published > NEW_DAYS * 86400) return false;
    if (f.sizes.length && it.sizes.size && !it.sizes.has("OS") && !f.sizes.some((s) => it.sizes.has(s))) return false;
    return true;
  }

  function tasteVectors() {
    // positives: style references + hearts (most recent 150); negatives: recent skips that are in the catalogue
    const pos = [], w = [];
    for (const r of seedRows) { pos.push(vecs.subarray(r * dim, (r + 1) * dim)); w.push(1); }
    const likes = Object.entries(prefs.likes).sort((a, b) => b[1].t - a[1].t).slice(0, 150);
    for (const [id, l] of likes) {
      const it = byId.get(id);
      const v = it ? vecs.subarray(it.row * dim, (it.row + 1) * dim) : (l.v ? b64ToVec(l.v) : null);
      if (v) { pos.push(v); w.push(2); } // a heart counts double vs. a reference photo
    }
    const neg = [];
    const skips = Object.entries(prefs.skips).sort((a, b) => b[1] - a[1]).slice(0, 200);
    for (const [id] of skips) { const it = byId.get(id); if (it) neg.push(vecs.subarray(it.row * dim, (it.row + 1) * dim)); }
    const centroid = new Float32Array(dim);
    pos.forEach((v, j) => { for (let k = 0; k < dim; k++) centroid[k] += w[j] * v[k]; });
    let n = 0; for (let k = 0; k < dim; k++) n += centroid[k] * centroid[k];
    n = Math.sqrt(n) || 1; for (let k = 0; k < dim; k++) centroid[k] /= n;
    return { pos, neg, centroid };
  }

  function scoreCandidates(cands) {
    const f = prefs.filters;
    const anchor = prefs.anchor && byId.get(prefs.anchor);
    const { pos, neg, centroid } = tasteVectors();
    const N = cands.length;
    const sC = new Array(N), sK = new Array(N), sN = new Array(N);
    const top = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      const o = cands[i].row * dim;
      sC[i] = dot(vecs, o, centroid, 0);
      // mean of 3 best matches to any single positive: keeps distinct looks alive
      top[0] = top[1] = top[2] = -1;
      for (const p of pos) {
        const s = dot(vecs, o, p, 0);
        if (s > top[2]) { if (s > top[1]) { top[2] = top[1]; if (s > top[0]) { top[1] = top[0]; top[0] = s; } else top[1] = s; } else top[2] = s; }
      }
      sK[i] = pos.length >= 3 ? (top[0] + top[1] + top[2]) / 3 : top[0];
      let m = -1;
      for (const v of neg) { const s = dot(vecs, o, v, 0); if (s > m) m = s; }
      sN[i] = m;
    }
    const zC = zscore(sC), zK = zscore(sK), zN = neg.length ? zscore(sN) : null;
    const score = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      score[i] = 0.45 * zC[i] + 0.55 * zK[i];
      if (zN) score[i] -= 0.45 * Math.max(0, zN[i] - 0.3);
    }
    if (f.vibes.length) {
      const rows = f.vibes.map((name) => vibeRows[cat.vibes.indexOf(name)]).filter((r) => r !== undefined);
      const zV = zscore(cands.map((it) => rows.reduce((a, r) => a + rowDot(it.row, r), 0) / rows.length));
      for (let i = 0; i < N; i++) score[i] = 0.6 * score[i] + 1.0 * zV[i];
    }
    if (anchor) {
      const zA = zscore(cands.map((it) => rowDot(it.row, anchor.row)));
      for (let i = 0; i < N; i++) score[i] = 0.15 * score[i] + 1.0 * zA[i];
    }
    return score;
  }

  function nextPage() {
    const f = prefs.filters;
    const cands = items.filter((it) => !shown.has(it.id) && it.id !== prefs.anchor && passes(it, f));
    if (!cands.length) return [];
    const score = scoreCandidates(cands);
    const order = Array.from(cands.keys()).sort((a, b) => score[b] - score[a]);
    const picked = [];
    const used = new Set();
    let lastStore = null, run = 0;
    const exploring = !prefs.anchor && !f.vibes.length;

    const tooSimilar = (it) => {
      // hide near-identical pieces (same style in another colour) placed recently
      for (const r of recentRows) if (rowDot(it.row, r) > 0.78) return true;
      return false;
    };
    const take = (idx) => {
      const it = cands[idx];
      used.add(idx);
      picked.push(it);
      recentRows.push(it.row);
      if (recentRows.length > 60) recentRows.shift();
      run = it.store.key === lastStore ? run + 1 : 1;
      lastStore = it.store.key;
    };

    let deferred = [];
    for (const idx of order) {
      if (picked.length >= PAGE) break;
      if (exploring && picked.length % 8 === 7 && order.length > 200) {
        // a little exploration so the feed doesn't collapse onto one look
        const lo = Math.min(120, order.length - 1), hi = Math.min(order.length, 700);
        for (let tries = 0; tries < 10; tries++) {
          const j = order[lo + Math.floor(Math.random() * (hi - lo))];
          if (!used.has(j) && !tooSimilar(cands[j])) { take(j); break; }
        }
        if (picked.length >= PAGE) break;
      }
      if (used.has(idx)) continue;
      const it = cands[idx];
      if (tooSimilar(it) || (it.store.key === lastStore && run >= 2)) { deferred.push(idx); continue; }
      take(idx);
    }
    for (const idx of deferred) { if (picked.length >= PAGE) break; if (!used.has(idx)) take(idx); }
    return picked;
  }

  // ------------------------------------------------------------ rendering
  const ICON = {
    heart: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    similar: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>',
  };

  function card(data, opts = {}) {
    const { id, title, url, img, price, compare, storeName, currency, soldout } = data;
    const el = document.createElement("article");
    el.className = "card" + (soldout ? " soldout" : "");
    el.dataset.id = id;
    const liked = !!prefs.likes[id];
    const tag = soldout ? '<span class="tag">May be sold out</span>'
      : compare ? `<span class="tag sale">−${Math.round((1 - price / compare) * 100)}%</span>`
      : opts.fresh ? '<span class="tag">New</span>' : "";
    el.innerHTML = `
      <div class="frame">
      <a class="media" href="${esc(url)}" target="_blank" rel="noopener">
        <img loading="lazy" decoding="async" alt="${esc(title)}"
             src="${esc(sized(img, 540))}"
             srcset="${esc(sized(img, 360))} 360w, ${esc(sized(img, 540))} 540w, ${esc(sized(img, 720))} 720w"
             sizes="(min-width:1240px) 20vw, (min-width:980px) 25vw, (min-width:640px) 33vw, 50vw">
        ${tag}
      </a>
      ${opts.similar !== false && !soldout ? `<button class="similar" data-act="similar" aria-label="More like this">${ICON.similar} Similar</button>` : ""}
      <div class="actions">
        ${opts.skip !== false ? `<button class="skip" data-act="skip" aria-label="Not for me">${ICON.x}</button>` : "<span></span>"}
        <button class="like${liked ? " on" : ""}" data-act="like" aria-label="Save">${ICON.heart}</button>
      </div>
      </div>
      <div class="meta">
        <div class="brand">${esc(storeName)}</div>
        <a class="title" href="${esc(url)}" target="_blank" rel="noopener">${esc(title)}</a>
        <div class="price">${compare ? `<span class="now">${money(price, currency)}</span><s>${money(compare, currency)}</s>` : money(price, currency)}</div>
      </div>`;
    return el;
  }

  const itemData = (it) => ({
    id: it.id, title: it.title, url: it.url, img: it.img, price: it.price, compare: it.compare,
    storeName: it.store.name, currency: it.currency,
  });

  function appendFeed() {
    if (loading || exhausted || view !== "feed") return;
    loading = true;
    const page = nextPage();
    const grid = $("feedGrid");
    const now = Date.now() / 1000;
    for (const it of page) {
      shown.add(it.id);
      grid.appendChild(card(itemData(it), { fresh: now - it.published < NEW_DAYS * 86400 }));
    }
    exhausted = page.length < PAGE;
    $("feedEmpty").hidden = shown.size > 0;
    loading = false;
    // if the page didn't fill the screen, keep going
    requestAnimationFrame(() => {
      if (!exhausted && $("sentinel").getBoundingClientRect().top < innerHeight + 800) appendFeed();
    });
  }

  function resetFeed(scrollTop) {
    shown = new Set();
    recentRows = [];
    exhausted = false;
    $("feedGrid").innerHTML = "";
    if (scrollTop) window.scrollTo({ top: 0 });
    renderActiveBar();
    appendFeed();
  }

  function renderSaved() {
    const grid = $("savedGrid");
    grid.innerHTML = "";
    const likes = Object.entries(prefs.likes).sort((a, b) => b[1].t - a[1].t);
    for (const [id, l] of likes) {
      const it = byId.get(id);
      const data = it ? itemData(it) : { id, ...l.item, storeName: l.item.store, soldout: true };
      grid.appendChild(card(data, { skip: false }));
    }
    $("savedEmpty").hidden = likes.length > 0;
    const refs = cat.seeds.filter((s) => s.img);
    const seen = new Set();
    $("refs").innerHTML = refs.length ? `
      <h2>Your style references</h2>
      <p>The feed starts from these and learns from your hearts and ✕s.</p>
      <div class="strip">${refs.filter((s) => !seen.has(s.url) && seen.add(s.url))
        .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title)}"><img src="${esc(sized(s.img, 200))}" alt="${esc(s.title)}"></a>`).join("")}</div>
      ${likes.length ? '<h2 class="section-title">Saved</h2>' : ""}` : "";
  }

  function updateCounts() {
    const n = Object.keys(prefs.likes).length;
    $("savedCount").textContent = n || "";
    const f = prefs.filters;
    const active = f.cats.length + f.sizes.length + f.vibes.length + f.stores.length + (f.price < PRICE_MAX) + f.sale + f.fresh;
    $("filterBadge").hidden = !active;
    $("filterBadge").textContent = active;
  }

  function renderActiveBar() {
    const bar = $("activeBar");
    const parts = [];
    const anchor = prefs.anchor && byId.get(prefs.anchor);
    if (anchor) {
      parts.push(`<span class="pill"><img src="${esc(sized(anchor.img, 100))}" alt="">More like ${esc(anchor.title)}<button class="x" data-clear="anchor" aria-label="Clear">×</button></span>`);
    }
    for (const v of prefs.filters.vibes) parts.push(`<span class="pill text">${esc(v)}<button class="x" data-clear="vibe" data-v="${esc(v)}" aria-label="Clear">×</button></span>`);
    bar.innerHTML = parts.join("");
    bar.hidden = !parts.length || view !== "feed";
    updateCounts();
  }

  // ------------------------------------------------------------ actions
  let toastTimer = null;
  function toast(msg, undo) {
    const t = $("toast");
    t.innerHTML = `<span>${esc(msg)}</span>` + (undo ? '<button id="undoBtn">Undo</button>' : "");
    t.hidden = false;
    if (undo) $("undoBtn").onclick = () => { undo(); t.hidden = true; };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3500);
  }

  function toggleLike(id, btn) {
    const it = byId.get(id);
    if (prefs.likes[id]) {
      delete prefs.likes[id];
      btn && btn.classList.remove("on");
    } else {
      if (!it) return;
      prefs.likes[id] = { t: Date.now(), item: snapshot(it), v: vecToB64(it.row) };
      delete prefs.skips[id];
      btn && btn.classList.add("on");
    }
    savePrefs();
    updateCounts();
    document.querySelectorAll(`.card[data-id="${CSS.escape(id)}"] .like`).forEach((b) => b.classList.toggle("on", !!prefs.likes[id]));
  }

  function skip(id, el) {
    prefs.skips[id] = Date.now();
    delete prefs.likes[id];
    savePrefs();
    updateCounts();
    el.classList.add("gone");
    const next = el.nextSibling, parent = el.parentNode;
    setTimeout(() => el.remove(), 250);
    toast("Hidden — you'll see less like this", () => {
      delete prefs.skips[id];
      savePrefs();
      el.classList.remove("gone");
      parent.insertBefore(el, next && next.parentNode === parent ? next : null);
    });
  }

  function similar(id) {
    prefs.anchor = id;
    showView("feed");
    resetFeed(true);
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (b) {
      e.preventDefault();
      const el = b.closest(".card");
      const id = el.dataset.id;
      if (b.dataset.act === "like") toggleLike(id, b);
      else if (b.dataset.act === "skip") skip(id, el);
      else if (b.dataset.act === "similar") similar(id);
      return;
    }
    const c = e.target.closest("[data-clear]");
    if (c) {
      if (c.dataset.clear === "anchor") prefs.anchor = null;
      if (c.dataset.clear === "vibe") prefs.filters.vibes = prefs.filters.vibes.filter((v) => v !== c.dataset.v);
      savePrefs();
      resetFeed(true);
    }
  });

  function showView(v) {
    view = v;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === v));
    $("feedView").hidden = v !== "feed";
    $("savedView").hidden = v !== "saved";
    if (v === "saved") renderSaved();
    renderActiveBar();
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => {
    if (t.dataset.view === view && view === "feed") return window.scrollTo({ top: 0, behavior: "smooth" });
    showView(t.dataset.view);
  }));

  // ------------------------------------------------------------ filter sheet
  function chipGroup(el, options, selected, label = (x) => x, key = (x) => x) {
    el.innerHTML = options.map((o) => `<button class="chip${selected.includes(key(o)) ? " on" : ""}" data-k="${esc(key(o))}">${esc(label(o))}</button>`).join("");
    el.onclick = (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      const k = b.dataset.k;
      const i = selected.indexOf(k);
      i >= 0 ? selected.splice(i, 1) : selected.push(k);
      b.classList.toggle("on");
      previewCount();
    };
  }

  function renderSheet() {
    const f = draft;
    chipGroup($("fVibes"), cat.vibes, f.vibes);
    chipGroup($("fCats"), cat.categories, f.cats);
    chipGroup($("fSizes"), SIZES, f.sizes);
    chipGroup($("fStores"), cat.stores.filter((s) => s.count), f.stores, (s) => s.name, (s) => s.key);
    $("fPrice").max = PRICE_MAX;
    $("fPrice").value = f.price;
    $("fSale").checked = f.sale;
    $("fNew").checked = f.fresh;
    priceLabel();
    previewCount();
  }
  function priceLabel() { $("fPriceLabel").textContent = draft.price >= PRICE_MAX ? "· any" : "· up to $" + draft.price; }
  function previewCount() {
    const n = items.reduce((a, it) => a + (passes(it, draft) ? 1 : 0), 0);
    $("applyFilters").textContent = n ? `Show ${n.toLocaleString()} pieces` : "No matches";
  }
  $("fPrice").oninput = (e) => { draft.price = +e.target.value; priceLabel(); previewCount(); };
  $("fSale").onchange = (e) => { draft.sale = e.target.checked; previewCount(); };
  $("fNew").onchange = (e) => { draft.fresh = e.target.checked; previewCount(); };

  function openSheet() {
    $("toast").hidden = true;
    draft = JSON.parse(JSON.stringify(prefs.filters));
    renderSheet();
    $("sheetBackdrop").hidden = false;
    $("sheet").classList.add("open");
    $("sheet").setAttribute("aria-hidden", "false");
  }
  function closeSheet() {
    $("sheet").classList.remove("open");
    $("sheet").setAttribute("aria-hidden", "true");
    $("sheetBackdrop").hidden = true;
  }
  $("filterBtn").onclick = () => (cat ? openSheet() : null);
  $("sheetBackdrop").onclick = closeSheet;
  $("resetFilters").onclick = () => { draft = defaultFilters(); renderSheet(); };
  $("applyFilters").onclick = () => {
    prefs.filters = draft;
    savePrefs();
    closeSheet();
    showView("feed");
    resetFeed(true);
  };
  $("clearFilters").onclick = () => { prefs.filters = defaultFilters(); prefs.anchor = null; savePrefs(); resetFeed(true); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

  // ------------------------------------------------------------ boot
  function skeletons() {
    $("feedGrid").innerHTML = Array.from({ length: 8 }, () => '<article class="card skel"><div class="media"></div><div class="meta"><div class="brand">&nbsp;</div></div></article>').join("");
  }

  skeletons();
  updateCounts();
  load()
    .then(() => {
      $("feedGrid").innerHTML = "";
      new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && appendFeed(), { rootMargin: "1200px 0px" }).observe($("sentinel"));
      resetFeed(false);
    })
    .catch((err) => {
      console.error(err);
      $("feedGrid").innerHTML = "";
      $("status").textContent = "Couldn't load the catalogue yet — has the first build run? (" + err.message + ")";
    });
})();
