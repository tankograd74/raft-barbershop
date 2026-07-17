#!/usr/bin/env node
/**
 * Sync public/data/site.json (+ photos) from the Yandex Maps org card.
 * Usage: npm run sync
 *
 * Org: https://yandex.ru/maps/org/r_a_f_t/84586990378/
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SITE_PATH = path.join(ROOT, "public/data/site.json");
const PHOTOS_DIR = path.join(ROOT, "public/photos");

const ORG_URL = "https://yandex.ru/maps/org/r_a_f_t/84586990378/";
const ORG_ID = "84586990378";

const TAG_MAP = {
  Услуги: "work",
  Внутри: "interior",
  Вход: "entrance",
  Снаружи: "exterior",
  Товары: "products",
  Панорама: "exterior",
};

const CAPTION = {
  work: "Работы",
  interior: "Интерьер",
  entrance: "Вход",
  exterior: "Снаружи",
  products: "Товары",
};

const OPEN_DAY_ALIASES = {
  пн: 1,
  понедельник: 1,
  вт: 2,
  вторник: 2,
  ср: 3,
  среда: 3,
  чт: 4,
  четверг: 4,
  пт: 5,
  пятница: 5,
  сб: 6,
  суббота: 6,
  вс: 0,
  воскресенье: 0,
};

function log(...args) {
  console.log("[sync]", ...args);
}

function diff(before, after, keys) {
  const changes = [];
  for (const key of keys) {
    const a = JSON.stringify(before?.[key] ?? null);
    const b = JSON.stringify(after?.[key] ?? null);
    if (a !== b) changes.push(key);
  }
  return changes;
}

/** Parse Yandex short hours like "вт,ср,пт,сб,вс 11:00–21:00" → closed weekdays + labels */
function normalizeHoursFromText(text, fallback) {
  if (!text || typeof text !== "string") return fallback;

  const cleaned = text.toLowerCase().replace(/\s+/g, " ").trim();
  const hoursMatch = cleaned.match(/(\d{1,2}:\d{2})\s*[–\-—]\s*(\d{1,2}:\d{2})/);
  const from = hoursMatch?.[1] ?? "11:00";
  const to = hoursMatch?.[2] ?? "21:00";

  const daysPart = cleaned.split(/\d{1,2}:\d{2}/)[0] ?? "";
  const tokens = daysPart
    .split(/[,;\s]+/)
    .map((t) => t.replace(/\./g, "").trim())
    .filter(Boolean);

  const openDays = new Set();
  for (const t of tokens) {
    if (OPEN_DAY_ALIASES[t] !== undefined) openDays.add(OPEN_DAY_ALIASES[t]);
  }

  // If we couldn't parse open days, keep fallback (Пн/Чт closed)
  let closedWeekdays;
  if (openDays.size >= 3) {
    closedWeekdays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !openDays.has(d));
  } else {
    closedWeekdays = fallback.closed_weekdays ?? [1, 4];
  }

  const openLabels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const open_days_label = [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => !closedWeekdays.includes(d))
    .map((d) => openLabels[d])
    .join(", ");
  const closed_days_label = closedWeekdays.map((d) => openLabels[d]).join(", ");

  // Build Mon→Sun schedule matching previous site.json order
  const monFirst = [
    "понедельник",
    "вторник",
    "среда",
    "четверг",
    "пятница",
    "суббота",
    "воскресенье",
  ];
  const nameToJs = {
    понедельник: 1,
    вторник: 2,
    среда: 3,
    четверг: 4,
    пятница: 5,
    суббота: 6,
    воскресенье: 0,
  };

  const scheduleOut = monFirst.map((day) => {
    const js = nameToJs[day];
    const closed = closedWeekdays.includes(js);
    return {
      day,
      closed,
      hours: closed ? null : [{ from, to }],
    };
  });

  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);

  return {
    text: cleaned,
    open_days_label,
    closed_days_label,
    hours_label: `${from}–${to}`,
    closed_weekdays: closedWeekdays,
    open_from_minutes: fh * 60 + fm,
    open_to_minutes: th * 60 + tm,
    schedule: scheduleOut,
    timezone_offset_seconds: fallback.timezone_offset_seconds ?? 18000,
  };
}

function displayPhone(tel) {
  const digits = tel.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return tel;
}

function telNormalize(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

async function downloadPhoto(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`photo ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buf);
  return buf.length;
}

function pickHero(gallery) {
  return (
    gallery.find((g) => g.category === "interior") ??
    gallery.find((g) => g.category === "work") ??
    gallery[0]
  );
}

function pickWhy(gallery) {
  return gallery.find((g) => g.category === "work") ?? gallery[0];
}

async function scrapeOrg() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ru-RU",
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  /** @type {any[]} */
  const jsonBodies = [];
  page.on("response", async (response) => {
    try {
      const ct = response.headers()["content-type"] || "";
      if (!ct.includes("json") && !ct.includes("javascript")) return;
      const url = response.url();
      if (!/maps|sprav|business|org|altay|reviews|photos/i.test(url)) return;
      const body = await response.json().catch(() => null);
      if (body) jsonBodies.push({ url, body });
    } catch {
      /* ignore */
    }
  });

  log("opening", ORG_URL);
  await page.goto(ORG_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);

  const captcha = await page.locator(".CheckboxCaptcha, .SmartCaptcha, form[action*='captcha']").count();
  if (captcha > 0) {
    await browser.close();
    throw new Error("Yandex captcha detected — run again later or with headed browser");
  }

  const dom = await page.evaluate(() => {
    const text = (sel) => {
      const el = document.querySelector(sel);
      return el?.textContent?.replace(/\s+/g, " ").trim() || null;
    };
    const phoneHref =
      document.querySelector('a[href^="tel:"]')?.getAttribute("href")?.replace(/^tel:/, "") || null;
    const title =
      text("h1.orgpage-header-view__header") ||
      text(".card-title-view__title") ||
      text("h1");
    const address =
      text(".business-contacts-view__address") ||
      text(".orgpage-header-view__address") ||
      text(".card-address-view");
    const hours =
      text(".business-working-status-view") ||
      text("[class*='working-time']") ||
      text("[class*='WorkingHours']");
    const rating =
      text(".business-rating-badge-view__rating-text") ||
      text(".business-header-rating-view__text");
    // collect possible hours from meta / nearby labels
    let hoursText = null;
    const all = Array.from(document.querySelectorAll("*"));
    for (const el of all) {
      const t = el.textContent?.trim() || "";
      if (/^(пн|вт|ср|чт|пт|сб|вс)[а-я.,\s]*\d{1,2}:\d{2}/i.test(t) && t.length < 80) {
        hoursText = t;
        break;
      }
    }
    return { title, address, phoneHref, hours, hoursText, rating, href: location.href };
  });

  // Try to find rich org payload in intercepted JSON
  let orgPayload = null;
  let photosPayload = [];
  let reviewsPayload = [];

  for (const { body } of jsonBodies) {
    const stack = [body];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object") continue;
      if (Array.isArray(cur)) {
        for (const item of cur) stack.push(item);
        continue;
      }
      const id = String(cur.id ?? cur.oid ?? cur.organizationId ?? "");
      if (
        (id === ORG_ID || cur.seoname === "r_a_f_t") &&
        (cur.title || cur.name || cur.address)
      ) {
        orgPayload = cur;
      }
      if (Array.isArray(cur.photos) && cur.photos.length && cur.photos[0]?.urlTemplate) {
        photosPayload = cur.photos;
      }
      if (
        Array.isArray(cur.items) &&
        cur.items[0]?.author &&
        (cur.items[0]?.text || cur.items[0]?.review)
      ) {
        reviewsPayload = cur.items;
      }
      for (const v of Object.values(cur)) {
        if (v && typeof v === "object") stack.push(v);
      }
    }
  }

  await browser.close();

  return { dom, orgPayload, photosPayload, reviewsPayload, jsonCount: jsonBodies.length };
}

function streetLineFromAddress(address) {
  if (!address) return "ул. Бажова, 193";
  const cleaned = address.replace(/\s+/g, " ").trim();

  // "Екатеринбург, ул. Бажова, 193" or "ул. Бажова, 193, Екатеринбург"
  const streetMatch = cleaned.match(
    /((?:ул\.|улица)\s*[^,]+),\s*(\d+[а-яa-z]?)/i,
  );
  if (streetMatch) {
    const street = streetMatch[1].replace(/^улица\s+/i, "ул. ").trim();
    return `${street}, ${streetMatch[2]}`;
  }

  const parts = cleaned.split(",").map((s) => s.trim());
  if (parts.length >= 2 && /ул\.|улица/i.test(parts[0])) {
    return `${parts[0]}, ${parts[1]}`;
  }
  return cleaned;
}

function cityLineFromAddress(address, fallback) {
  if (!address) return fallback;
  if (/екатеринбург/i.test(address)) {
    return "Екатеринбург, Свердловская область";
  }
  return fallback;
}

function shortAddress(streetLine, locality) {
  return `${streetLine}, ${locality}`;
}

async function main() {
  const prevRaw = await fs.readFile(SITE_PATH, "utf8");
  const prev = JSON.parse(prevRaw);

  let scraped;
  try {
    scraped = await scrapeOrg();
  } catch (err) {
    console.error("[sync] ERROR:", err.message || err);
    process.exit(1);
  }

  log("dom title:", scraped.dom.title);
  log("json packets:", scraped.jsonCount);
  log("org payload:", scraped.orgPayload ? "yes" : "no");

  const next = structuredClone(prev);
  next.synced_at = new Date().toISOString();
  next.org_id = ORG_ID;
  next.yandex_maps_url = ORG_URL;

  if (scraped.dom.title) next.title = scraped.dom.title.trim();

  const phoneRaw =
    scraped.dom.phoneHref ||
    scraped.orgPayload?.phones?.[0]?.number ||
    scraped.orgPayload?.phones?.[0]?.value ||
    prev.phone.tel;
  if (phoneRaw) {
    const tel = telNormalize(phoneRaw);
    next.phone = { tel, display: displayPhone(tel) };
  }

  const addressShort =
    scraped.dom.address ||
    scraped.orgPayload?.address?.formatted ||
    scraped.orgPayload?.fullAddress ||
    prev.address.short;
  if (addressShort) {
    const street_line = streetLineFromAddress(addressShort);
    const locality = prev.address.locality || "Екатеринбург";
    next.address = {
      ...prev.address,
      short: shortAddress(street_line, locality),
      street_line,
      city_line: cityLineFromAddress(addressShort, prev.address.city_line),
      full: scraped.orgPayload?.address?.fullAddress || prev.address.full,
      locality,
    };
  }

  const coords =
    scraped.orgPayload?.coordinates ||
    scraped.orgPayload?.geo ||
    null;
  if (coords) {
    const lon = coords.lon ?? coords.longitude ?? coords[0];
    const lat = coords.lat ?? coords.latitude ?? coords[1];
    if (typeof lon === "number" && typeof lat === "number") {
      next.coordinates = { lon, lat };
    }
  }

  const hoursText =
    scraped.dom.hoursText ||
    scraped.orgPayload?.workingTimeText ||
    scraped.orgPayload?.working_hours?.text ||
    scraped.dom.hours ||
    prev.working_hours.text;
  next.working_hours = normalizeHoursFromText(hoursText, prev.working_hours);

  // Rating from DOM like "4,7" or payload
  let ratingValue = prev.rating.value;
  const ratingDom = scraped.dom.rating?.match(/(\d+[.,]\d+|\d+)/);
  if (ratingDom) ratingValue = parseFloat(ratingDom[1].replace(",", "."));
  if (scraped.orgPayload?.rating?.value != null) {
    ratingValue = Number(scraped.orgPayload.rating.value);
  }
  next.rating = {
    ...prev.rating,
    value: ratingValue,
    review_count:
      scraped.orgPayload?.rating?.reviewCount ??
      scraped.orgPayload?.rating?.review_count ??
      prev.rating.review_count,
    rating_count:
      scraped.orgPayload?.rating?.ratingCount ??
      scraped.orgPayload?.rating?.rating_count ??
      prev.rating.rating_count,
  };

  // Photos
  await fs.mkdir(PHOTOS_DIR, { recursive: true });
  let newPhotos = 0;
  if (scraped.photosPayload.length) {
    const gallery = [];
    let idx = 1;
    for (const ph of scraped.photosPayload) {
      const template = ph.urlTemplate || ph.url || "";
      const url = template.replace("%s", "XXXL").replace("{size}", "XXXL");
      if (!url.startsWith("http")) continue;
      const hash = createHash("md5").update(url).digest("hex").slice(0, 12);
      const fname = `${String(idx).padStart(2, "0")}_${hash}.jpg`;
      const dest = path.join(PHOTOS_DIR, fname);
      try {
        await downloadPhoto(url, dest);
        newPhotos += 1;
      } catch (e) {
        log("photo skip", fname, e.message);
        continue;
      }
      const tags = (ph.tags || []).map((t) => t.name || t).filter(Boolean);
      const cat = TAG_MAP[tags[0]] || "work";
      gallery.push({
        id: idx,
        url: `/photos/${fname}`,
        source_url: url,
        category: cat,
        alt: CAPTION[cat] || "Фото",
        caption: CAPTION[cat] || "Фото",
        tall: true,
        tags,
      });
      idx += 1;
    }
    if (gallery.length) {
      next.gallery = gallery;
      next.hero_image = pickHero(gallery).url;
      next.why_image = pickWhy(gallery).url;
    }
  }

  // Reviews (optional enrichment)
  if (scraped.reviewsPayload.length) {
    next.reviews = scraped.reviewsPayload.slice(0, 40).map((r, i) => ({
      id: String(r.reviewId || r.id || i),
      name: r.author?.name || r.authorName || "Гость",
      rating: Number(r.rating || r.score || 5),
      text: String(r.text || r.review || "").trim(),
      aspect: prev.aspects?.[i % (prev.aspects?.length || 1)] || "Мастера",
      response: r.businessAnswer?.text || r.reply?.text || null,
      updated_at: r.updatedTime || r.time || null,
    }));
    next.rating.review_count = Math.max(next.rating.review_count, next.reviews.length);
  }

  const changes = diff(prev, next, [
    "title",
    "phone",
    "address",
    "coordinates",
    "working_hours",
    "rating",
    "gallery",
    "reviews",
    "hero_image",
    "why_image",
  ]);

  await fs.writeFile(SITE_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");

  log("written", SITE_PATH);
  log("changes:", changes.length ? changes.join(", ") : "(none)");
  log("new photos downloaded:", newPhotos);
  log("hours:", next.working_hours.open_days_label, "/", next.working_hours.closed_days_label, "off");
  log("address:", next.address.short);
  log("phone:", next.phone.display);
  log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
