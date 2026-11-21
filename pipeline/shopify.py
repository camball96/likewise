"""Fetch and normalise products from public Shopify storefronts (/products.json)."""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

# Identifies us to stores, with a page explaining what we do and how to opt out
UA = "Mozilla/5.0 (compatible; likewise/1.0; +https://lkws.au/for-stores)"
BOT = "likewise"  # the name stores can address in robots.txt
PAGE_SIZE = 250
REQUEST_GAP_S = 1.0  # be polite: at most ~1 request/second per store


def get_json(url: str, retries: int = 3) -> dict:
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(5 * (attempt + 1))
                continue
            raise
        except Exception as e:  # network blips
            last = e
            time.sleep(3 * (attempt + 1))
    raise last  # type: ignore[misc]


# ---------------------------------------------------------------- robots.txt

class Disallowed(Exception):
    """The store's robots.txt doesn't allow us to read its product list."""


def robots_rules(domain: str) -> list[tuple[bool, re.Pattern, int]]:
    """(allow?, pattern, length) rules from the store's robots.txt that apply to us: the group naming
    "likewise" if there is one, otherwise the "*" group. Supports * and $ wildcards like Google does."""
    try:
        req = urllib.request.Request(f"https://{domain}/robots.txt", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            text = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise Disallowed(f"robots.txt returned {e.code}")
        return []  # no robots.txt: everything allowed
    groups: dict[str, list[tuple[bool, str]]] = {}
    agents: list[str] = []
    in_rules = False
    for line in text.splitlines():
        line = line.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        key, value = (x.strip() for x in line.split(":", 1))
        key = key.lower()
        if key == "user-agent":
            if in_rules:
                agents, in_rules = [], False
            agents.append(value.lower())
        elif key in ("allow", "disallow"):
            in_rules = True
            for agent in agents:
                if value:  # an empty Disallow means "allow everything"
                    groups.setdefault(agent, []).append((key == "allow", value))
                else:
                    groups.setdefault(agent, [])
    ours = next((rules for agent, rules in groups.items() if BOT in agent), groups.get("*", []))
    compiled = []
    for allow, path in ours:
        rx = re.escape(path).replace(r"\*", ".*")
        rx = rx[:-2] + "$" if rx.endswith(r"\$") else rx
        compiled.append((allow, re.compile(rx), len(path)))
    return compiled


def allowed(rules: list[tuple[bool, re.Pattern, int]], path: str) -> bool:
    """Most specific (longest) matching rule wins; Allow wins a tie."""
    matches = [(length, allow) for allow, rx, length in rules if rx.match(path)]
    return not matches or max(matches)[1]


def fetch_store(domain: str, max_products: int) -> list[dict]:
    """Newest-first products (Shopify returns products.json ordered by publish date), following the store's
    robots.txt: some stores disallow the ?limit= parameter, so we fall back to Shopify's default page size."""
    rules = robots_rules(domain)
    page_size = next((size for size in (PAGE_SIZE, 30) if allowed(rules, product_list_path(size, 1))), None)
    if page_size is None:
        raise Disallowed("robots.txt disallows /products.json")
    out: list[dict] = []
    page = 1
    while len(out) < max_products:
        path = product_list_path(page_size, page)
        if not allowed(rules, path):
            break
        batch = get_json(f"https://{domain}{path}").get("products", [])
        if not batch:
            break
        out.extend(batch)
        if len(batch) < page_size:
            break
        page += 1
        time.sleep(REQUEST_GAP_S)
    return out[:max_products]


def product_list_path(page_size: int, page: int) -> str:
    return f"/products.json?limit={page_size}&page={page}" if page_size != 30 else f"/products.json?page={page}"


# ---------------------------------------------------------------- classification

EXCLUDE = re.compile(
    r"\b(accessor(?:y|ies)|axx|gift ?cards?|e-?gift|bags?|tote|clutch|purse|wallet|belts?|earrings?|earings?|necklaces?|bracelets?|rings?|"
    r"jewel(?:le)?ry|anklet|hair|scrunchie|claw clip|headband|hats?|caps?|beanie|scarf|sunglasses|socks?|"
    r"shoes?|heels?|boots?|sandals?|flats|sneakers?|slides|mules|loafers|thongs|footwear|"
    r"beauty|fragrance|perfume|candle|homewares?|towel|mug|book|sticker|keyring|phone case|"
    r"toys?|vibrators?|massagers?|lube|lubricant|nipple covers?|pasties|handcuffs?|restraints?|blindfolds?|"
    r"maternity|kids?|girls|baby|"
    r"shipping protection|route|insurance|sample|gift wrap|gift box|warranty|donation)\b",
    re.I,
)
# homewares some fashion stores also sell; always dropped, even if the title sounds like clothing ("Pillowcase Set")
HOMEWARES = re.compile(r"\b(pillow\w*|bedding|sheet sets?|napkins?|placemats?|tea towels?|stationery|kitchen|table linen|cosmetic bags?)\b", re.I)
MENS = re.compile(r"(^|[^a-z])(mens|men's|men|male|him)([^a-z]|$)", re.I)

CATEGORY_RULES: list[tuple[str, re.Pattern]] = [
    ("Dresses",     re.compile(r"\b(dress(es)?|gown|slip dress|maxi dress|midi dress|mini dress)\b", re.I)),
    ("Activewear",  re.compile(r"\b(activewear|active|sports? bras?|leggings?|tights|bike shorts?|biker shorts?|yoga|gym|pilates|workout|training|running|tennis)\b", re.I)),
    ("Lingerie",    re.compile(r"\b(bras?|bralettes?|briefs?|knickers?|undies|underwear|lingerie|intimates?|g-?strings?|thong|suspenders?|garters?)\b", re.I)),
    ("Sleepwear",   re.compile(r"\b(pj|pjs|pyjamas?|pajamas?|sleep\w*|lounge\w*|robe|nightie|nightdress)s?\b", re.I)),
    ("Jumpsuits",   re.compile(r"\b(jumpsuit|playsuit|romper|unitard)s?\b", re.I)),
    ("Sets",        re.compile(r"\b(set|co-?ord|two piece|2 piece|matching)s?\b", re.I)),
    ("Skirts",      re.compile(r"\b(skirt|skort)s?\b", re.I)),
    ("Outerwear",   re.compile(r"\b(jacket|coat|blazer|trench|bomber|puffer|gilet|vest|outerwear|shacket)s?\b", re.I)),
    ("Shorts",      re.compile(r"\bshorts?\b(?!\s*sleeve)|\bjorts\b", re.I)),
    ("Pants",       re.compile(r"\b(pants?|jeans?|trousers?|flares?|culottes?|cargos?|joggers?|trackpants?)\b", re.I)),
    ("Swim",        re.compile(r"\b(swim\w*|bikini|one piece|sarong|kaftan|cover up)s?\b", re.I)),
    ("Knitwear",    re.compile(r"\b(knit\w*|cardigan|cardi|jumper|sweater|pullover|hoodie|sweat\w*)s?\b", re.I)),
    ("Tops",        re.compile(r"\b(tops?|tee|t-shirt|tshirt|shirt|blouse|cami|camisole|bodysuit|corset|bustier|tank|singlet|crop|tube|halter|polo|bodice|vest top|long ?sleeve)s?\b", re.I)),
]
CATEGORIES = [c for c, _ in CATEGORY_RULES]
# swim stores call bikini bottoms "briefs" and tops "bralettes": those stay Swim, not Lingerie
SWIM_PIECE = re.compile(r"\b(swim\w*|bikini (tops?|pants?|bottoms?)|kini)\b", re.I)


def classify(title: str, product_type: str, tags: list[str]) -> str | None:
    """Return a category from title first (most reliable), then product_type. None = unknown."""
    for text in (title, product_type):
        if not text:
            continue
        for cat, rx in CATEGORY_RULES:
            if cat == "Lingerie" and (SWIM_PIECE.search(title or "") or SWIM_PIECE.search(product_type or "")):
                continue
            if rx.search(text):
                return cat
    return None


def is_excluded(title: str, product_type: str, tags: list[str]) -> bool:
    if HOMEWARES.search(title or "") or HOMEWARES.search(product_type or ""):
        return True
    if EXCLUDE.search(product_type or "") or EXCLUDE.search(title or ""):
        # but don't drop e.g. "Bow Tie Dress" style titles that are clearly clothing
        if not (classify(title, "", []) and not EXCLUDE.search(product_type or "")):
            return True
    if MENS.search(product_type or ""):
        return True
    tag_text = " ".join(tags)
    if re.search(r"\b(mens|men's)\b", tag_text, re.I) and not re.search(r"\bwomens?\b|women's", tag_text, re.I):
        return True
    return False


SIZE_TOKEN = re.compile(r"\b(XXS|XS|S|M|L|XL|XXL|2XL|3XL|OS|ONE SIZE|\d{1,2})\b", re.I)


def size_tokens(value: str) -> list[str]:
    v = value.upper().replace("AU ", "").replace("AU", "")
    toks = [t.upper() for t in SIZE_TOKEN.findall(v)]
    return ["OS" if t == "ONE SIZE" else t for t in toks]


def normalise(store: dict, p: dict) -> dict | None:
    title = (p.get("title") or "").strip()
    ptype = (p.get("product_type") or "").strip()
    tags = p.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",")]
    if is_excluded(title, ptype, tags):
        return None
    variants = p.get("variants") or []
    avail = [v for v in variants if v.get("available")]
    if not avail or not p.get("images"):
        return None

    # sizes in stock
    size_pos = None
    for o in p.get("options") or []:
        if "size" in (o.get("name") or "").lower():
            size_pos = o.get("position")
    sizes: list[str] = []
    if size_pos:
        for v in avail:
            for t in size_tokens(str(v.get(f"option{size_pos}") or "")):
                if t not in sizes:
                    sizes.append(t)
    elif len(variants) == 1:
        sizes = ["OS"]

    prices = [float(v["price"]) for v in avail if v.get("price")]
    price = min(prices) if prices else 0.0
    compares = [float(v["compare_at_price"]) for v in avail if v.get("compare_at_price")]
    compare = max(compares) if compares else 0.0
    if compare <= price + 0.5:
        compare = 0.0

    img = p["images"][0]["src"]
    published = p.get("published_at") or p.get("created_at")
    try:
        pub_ts = int(datetime.fromisoformat(published.replace("Z", "+00:00")).timestamp())
    except Exception:
        pub_ts = int(datetime.now(timezone.utc).timestamp())

    return {
        "id": f"{store['key']}:{p['id']}",
        "store": store["key"],
        "title": title,
        "url": f"https://{store['domain']}/products/{p['handle']}",
        "img": img,
        "img2": p["images"][1]["src"] if len(p["images"]) > 1 else None,
        "price": round(price, 2),
        "compare": round(compare, 2),
        "cat": store.get("category") or classify(title, ptype, tags),  # single-category stores (activewear, sleepwear) set this in stores.json
        "sizes": sizes,
        "published": pub_ts,
    }

