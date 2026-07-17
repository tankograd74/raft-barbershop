#!/usr/bin/env node
/** Rebuild public/data/site.json from raft_barbershop_data (offline seed). */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const py = `
import json, shutil
from pathlib import Path

base = Path(${JSON.stringify(root)}) / "raft_barbershop_data"
out = Path(${JSON.stringify(root)}) / "public"
(out / "photos").mkdir(parents=True, exist_ok=True)
(out / "data").mkdir(parents=True, exist_ok=True)

for p in (base / "photos").glob("*"):
    shutil.copy2(p, out / "photos" / p.name)

org = json.loads((base / "organization.json").read_text())
contacts = json.loads((base / "contacts.json").read_text())
features = json.loads((base / "features.json").read_text())
reviews_raw = json.loads((base / "reviews.json").read_text())
photos = json.loads((base / "photos_manifest.json").read_text())

TAG_MAP = {"Услуги":"work","Внутри":"interior","Вход":"entrance","Снаружи":"exterior","Товары":"products","Панорама":"exterior"}
CAPTION = {"work":"Работы","interior":"Интерьер","entrance":"Вход","exterior":"Снаружи","products":"Товары"}

closed_js_days = [1, 4]
days = [("понедельник", True),("вторник", False),("среда", False),("четверг", True),("пятница", False),("суббота", False),("воскресенье", False)]
schedule = [{"day": d, "closed": c, "hours": None if c else [{"from":"11:00","to":"21:00"}]} for d,c in days]

gallery = []
for p in photos:
    tags = p.get("tags") or []
    cat = TAG_MAP.get(tags[0], "work") if tags else "work"
    fname = Path(p["local_path"]).name
    gallery.append({
        "id": p["index"],
        "url": f"/photos/{fname}",
        "source_url": p.get("source_url"),
        "category": cat,
        "alt": CAPTION.get(cat, "Фото"),
        "caption": CAPTION.get(cat, "Фото"),
        "tall": p.get("height", 0) > p.get("width", 0),
        "tags": tags,
    })

hero = next((g for g in gallery if g["category"] == "interior"), gallery[0])
why = next((g for g in gallery if g["category"] == "work"), gallery[0])
phone = contacts["phones"][0]
haircut = next((f for f in features["features"] if f["id"] == "man_haircut"), None)

reviews = []
aspects = features.get("review_aspects") or []
for i, r in enumerate(reviews_raw, 1):
    aspect = aspects[min(i - 1, len(aspects) - 1)]["text"] if aspects else "Мастера"
    reviews.append({
        "id": r["id"],
        "name": r["author"]["name"],
        "rating": r["rating"],
        "text": (r.get("text") or "").strip(),
        "aspect": aspect,
        "response": (r.get("business_reply") or {}).get("text") if r.get("business_reply") else None,
        "updated_at": r.get("updated_at"),
        "avatar": r["author"].get("avatar_local_path"),
    })

site = {
    "org_id": org["id"],
    "title": org["title"],
    "category": org["category"]["name"],
    "yandex_maps_url": org["source_url"],
    "synced_at": org.get("parsed_at"),
    "phone": {"display": phone["number"], "tel": phone["value"] if phone["value"].startswith("+") else f"+{phone['value']}"},
    "address": {
        "short": contacts["address"]["short"],
        "street_line": "ул. Бажова, 193",
        "city_line": "Екатеринбург, Свердловская область",
        "full": contacts["address"]["full"],
        "locality": contacts["address"]["composite"]["locality"],
    },
    "coordinates": {"lat": contacts["coordinates"]["lat"], "lon": contacts["coordinates"]["lon"]},
    "rating": org["rating"],
    "working_hours": {
        "text": "вт,ср,пт,сб,вс 11:00–21:00",
        "open_days_label": "Вт, Ср, Пт, Сб, Вс",
        "closed_days_label": "Пн, Чт",
        "hours_label": "11:00–21:00",
        "closed_weekdays": closed_js_days,
        "open_from_minutes": 660,
        "open_to_minutes": 1260,
        "schedule": schedule,
        "timezone_offset_seconds": contacts["working_hours"].get("timezone_offset_seconds", 18000),
    },
    "prices": {
        "man_haircut": haircut["value"] if haircut else "1500–2700 ₽",
        "rows": [
            {"name": "Стрижка машинкой", "price": "от 1 500 ₽", "muted": False},
            {"name": "Моделирование бороды", "price": "уточняется", "muted": True},
            {"name": "Комплекс «голова + борода»", "price": "уточняется", "muted": True},
            {"name": "Укладки / уход", "price": "уточняется", "muted": True},
        ],
    },
    "amenities": [
        {"id": "wifi", "title": "Wi‑Fi", "desc": "Бесплатный интернет"},
        {"id": "parking", "title": "Парковка", "desc": "Рядом с барбершопом"},
        {"id": "gift", "title": "Сертификаты", "desc": "Подарочные сертификаты"},
        {"id": "promo", "title": "Акции и бонусы", "desc": "Дисконтная система"},
        {"id": "payment", "title": "Оплата", "desc": "СБП · Онлайн · Наличные · Банковский перевод"},
    ],
    "aspects": [a["text"] for a in aspects],
    "transport": {
        "stops": [{"name": s["name"], "distance": s.get("distance")} for s in org.get("stops", [])[:3]],
        "metro": [{"name": m["name"], "distance": m.get("distance")} for m in org.get("metro", [])[:2]],
    },
    "gallery": gallery,
    "hero_image": hero["url"],
    "why_image": why["url"],
    "reviews": reviews,
}

(out / "data" / "site.json").write_text(json.dumps(site, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
print("seeded", len(gallery), "photos,", len(reviews), "reviews")
`;

const r = spawnSync("python3", ["-c", py], { stdio: "inherit" });
process.exit(r.status ?? 1);
