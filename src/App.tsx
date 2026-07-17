import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Menu,
  X,
  MapPin,
  Star,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Gift,
  CreditCard,
  ExternalLink,
  Tag,
  ArrowRight,
} from "lucide-react";
import type { GalleryItem, SiteData } from "./types";

function getOpenStatus(site: SiteData): { isOpen: boolean; label: string } {
  const wh = site.working_hours;
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const local = new Date(utc + wh.timezone_offset_seconds * 1000);
  const day = local.getDay();
  const mins = local.getHours() * 60 + local.getMinutes();

  if (wh.closed_weekdays.includes(day)) {
    return { isOpen: false, label: "Сегодня выходной" };
  }
  if (mins >= wh.open_from_minutes && mins < wh.open_to_minutes) {
    return { isOpen: true, label: `Открыто до ${wh.hours_label.split("–")[1] ?? "21:00"}` };
  }
  return { isOpen: false, label: "Сейчас закрыто" };
}

function Stars({ n, size = 13 }: { n: number; size?: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < n ? "#B8734A" : "none"}
          className={i < n ? "text-[#B8734A]" : "text-[#3A3530]"}
        />
      ))}
    </span>
  );
}

function amenityIcon(id: string): ReactNode {
  switch (id) {
    case "wifi":
      return <Wifi size={15} />;
    case "parking":
      return "P";
    case "gift":
      return <Gift size={15} />;
    case "promo":
      return <Tag size={15} />;
    case "payment":
      return <CreditCard size={15} />;
    default:
      return null;
  }
}

function mapWidgetSrc(site: SiteData): string {
  const { lon, lat } = site.coordinates;
  const params = new URLSearchParams({
    ll: `${lon},${lat}`,
    z: "16",
    lang: "ru_RU",
    oid: site.org_id,
    pt: `${lon},${lat},pm2rdm`,
  });
  return `https://yandex.ru/map-widget/v1/?${params.toString()}`;
}

function formatDistance(distance?: string): string {
  if (!distance) return "";
  return distance.replace(/\u00a0/g, " ");
}

function formatHaircutPrice(raw: string): string {
  return raw
    .replace(/(\d)\s*[-–—]\s*(\d)/, "$1–$2")
    .replace(/\d{4,}/g, (m) => m.replace(/\B(?=(\d{3})+(?!\d))/g, " "));
}

/** Prefix public asset paths with Vite base (needed for GitHub Pages project sites). */
function assetUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  const base = import.meta.env.BASE_URL || "/";
  const normalized = path.replace(/^\/+/, "");
  return `${base}${normalized}`;
}

export default function App() {
  const [site, setSite] = useState<SiteData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [revIdx, setRevIdx] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    service: "",
    datetime: "",
    comment: "",
  });

  useEffect(() => {
    fetch(assetUrl("data/site.json"))
      .then((r) => {
        if (!r.ok) throw new Error(`Не удалось загрузить данные (${r.status})`);
        return r.json();
      })
      .then((data: SiteData) => setSite(data))
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 56);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!bookingOpen && lightbox === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [bookingOpen, lightbox]);

  const openStatus = useMemo(() => (site ? getOpenStatus(site) : null), [site]);

  /** Works first, then interior — no entrance/exterior/products. */
  const gallerySlides = useMemo(() => {
    if (!site) return [] as GalleryItem[];
    const work = site.gallery.filter((g) => g.category === "work");
    const interior = site.gallery.filter((g) => g.category === "interior");
    return [...work, ...interior];
  }, [site]);

  useEffect(() => {
    setCarouselIdx(0);
  }, [gallerySlides.length]);

  const ratingDisplay = site ? (Math.round(site.rating.value * 10) / 10).toFixed(1) : "";

  function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!site) return;
    setBookingOpen(false);
    setForm({ name: "", phone: "", service: "", datetime: "", comment: "" });
    window.location.href = `tel:${site.phone.tel}`;
  }

  const prevRev = () => {
    if (!site) return;
    setRevIdx((i) => (i - 1 + site.reviews.length) % site.reviews.length);
  };
  const nextRev = () => {
    if (!site) return;
    setRevIdx((i) => (i + 1) % site.reviews.length);
  };

  const prevSlide = () => {
    if (!gallerySlides.length) return;
    setCarouselIdx((i) => (i - 1 + gallerySlides.length) % gallerySlides.length);
  };
  const nextSlide = () => {
    if (!gallerySlides.length) return;
    setCarouselIdx((i) => (i + 1) % gallerySlides.length);
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#12110F] px-6 text-center">
        <p className="text-[#A79F94] text-sm">{loadError}</p>
      </div>
    );
  }

  if (!site || !openStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#12110F]">
        <p className="text-[#A79F94] text-sm tracking-wide">Загрузка…</p>
      </div>
    );
  }

  const telHref = `tel:${site.phone.tel}`;
  const routeHref = `https://yandex.ru/maps/?rtext=~${site.coordinates.lat},${site.coordinates.lon}&rtt=auto`;
  const stop0 = site.transport.stops[0];
  const metro0 = site.transport.metro[0];

  return (
    <>
      <style>{`
        .font-brand { font-family: 'Unbounded', sans-serif; }

        @keyframes kenBurns {
          from { transform: scale(1.07); }
          to   { transform: scale(1.00); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        .ken-burns { animation: kenBurns 22s ease-out both; }
        .fu1 { animation: fadeUp .75s ease-out .08s both; }
        .fu2 { animation: fadeUp .75s ease-out .22s both; }
        .fu3 { animation: fadeUp .75s ease-out .38s both; }
        .fu4 { animation: fadeUp .75s ease-out .54s both; }

        .gal-img { transition: transform .55s cubic-bezier(.25,.46,.45,.94); }
        .gal-wrap:hover .gal-img { transform: scale(1.035); }

        input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(.5); }
      `}</style>

      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#12110F]/96 backdrop-blur-md border-b border-[rgba(243,238,230,0.07)]"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-6">
          <a
            href="#top"
            className="font-brand text-[15px] font-black text-[#F3EEE6] tracking-[.28em] shrink-0 select-none"
          >
            {site.title}
          </a>

          <nav className="hidden md:flex items-center gap-7">
            {(
              [
                ["#services", "Услуги"],
                ["#gallery", "Атмосфера"],
                ["#reviews", "Отзывы"],
                ["#contacts", "Контакты"],
              ] as const
            ).map(([h, l]) => (
              <a
                key={h}
                href={h}
                className="text-[#A79F94] hover:text-[#F3EEE6] transition-colors text-[13px] tracking-wide font-medium"
              >
                {l}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href={telHref}
              className="text-[#A79F94] hover:text-[#F3EEE6] transition-colors text-[13px] font-medium tracking-wide px-1.5"
            >
              {site.phone.display}
            </a>
          </div>

          <div className="flex md:hidden items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="text-[#F3EEE6] p-1"
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-[#1A1816] border-t border-[rgba(243,238,230,0.07)] px-6 pt-5 pb-6 flex flex-col gap-5">
            {(
              [
                ["#services", "Услуги"],
                ["#gallery", "Атмосфера"],
                ["#reviews", "Отзывы"],
                ["#contacts", "Контакты"],
              ] as const
            ).map(([h, l]) => (
              <a
                key={h}
                href={h}
                onClick={() => setMenuOpen(false)}
                className="text-[#F3EEE6] font-medium text-base tracking-wide"
              >
                {l}
              </a>
            ))}
            <a href={telHref} className="text-[#A79F94] text-sm mt-1">
              {site.phone.display}
            </a>
          </div>
        )}
      </header>

      <section id="top" className="relative h-[100svh] min-h-[640px] overflow-hidden bg-[#0F0E0C]">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={assetUrl(site.hero_image)}
            alt={`Интерьер ${site.title}`}
            className="ken-burns w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F0E0C]/55 via-[#0F0E0C]/20 to-[#0F0E0C]/85" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F0E0C]/65 via-transparent to-transparent" />
        </div>

        <div className="relative h-full flex flex-col justify-end pb-24 md:pb-20 px-6 md:px-12 lg:px-16 max-w-[1320px] mx-auto w-full">
          <div>
            <div className="fu1 mb-4 md:mb-5">
              <span className="font-brand block text-[clamp(48px,12vw,176px)] font-black text-[#F3EEE6] leading-none tracking-[.12em]">
                {site.title}
              </span>
            </div>

            <h1 className="fu2 text-[clamp(17px,2.2vw,22px)] font-semibold text-[#F3EEE6] mb-2.5 leading-snug max-w-[560px]">
              Мужские стрижки с характером в {site.address.locality}
            </h1>

            <p className="fu3 text-[15px] text-[#A79F94] mb-8 max-w-[460px] leading-relaxed">
              Барбершоп на {site.address.street_line}. Мастера, атмосфера и стрижка, к которой
              возвращаются.
            </p>

            <div className="fu4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setBookingOpen(true)}
                className="bg-[#B8734A] hover:bg-[#C47D52] text-[#F3EEE6] font-semibold px-7 py-3.5 text-[15px] tracking-wide transition-colors"
              >
                Записаться
              </button>
              <a
                href={telHref}
                className="flex items-center border border-[rgba(243,238,230,0.28)] hover:border-[rgba(243,238,230,0.55)] text-[#F3EEE6] font-medium px-6 py-3.5 text-[15px] transition-colors"
              >
                Позвонить
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-[#1A1816] border-b border-[rgba(243,238,230,0.07)]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-[#A79F94]">
          <span className="flex items-center gap-1.5">
            <Star size={12} fill="#B8734A" className="text-[#B8734A]" />
            <span className="text-[#F3EEE6] font-semibold">{ratingDisplay}</span>
            <span>
              &nbsp;· {site.rating.review_count} отзывов · Яндекс.Карты
            </span>
          </span>
          <span className="hidden md:block text-[rgba(243,238,230,0.18)]">·</span>
          <span className="flex items-center gap-1.5">
            <MapPin size={12} />
            {site.address.short}
          </span>
        </div>
      </div>

      <section id="services" className="py-20 md:py-28 bg-[#12110F]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <div className="grid md:grid-cols-2 gap-14 md:gap-24 items-start">
            <div>
              <p className="text-[#B8734A] text-[11px] font-semibold tracking-[.22em] uppercase mb-5">
                Услуги и цены
              </p>
              <h2 className="font-brand text-[clamp(26px,4vw,40px)] font-bold text-[#F3EEE6] mb-7 leading-tight">
                Стрижки
                <br />и уход
              </h2>

              <div className="border-l-2 border-[#B8734A] pl-5 mb-10">
                <p className="text-[#A79F94] text-[12px] uppercase tracking-widest mb-1">Мужская стрижка</p>
                <p className="font-brand text-[28px] font-bold text-[#F3EEE6] tabular-nums">
                  {formatHaircutPrice(site.prices.man_haircut)}
                </p>
              </div>

              <div className="divide-y divide-[rgba(243,238,230,0.07)]">
                {site.prices.rows.map((row) => (
                  <div key={row.name} className="flex justify-between items-center py-4 gap-4">
                    <span className="text-[#F3EEE6] text-[15px]">{row.name}</span>
                    <span
                      className={`text-[13px] tabular-nums shrink-0 ${
                        row.muted ? "text-[#A79F94]" : "text-[#B8734A] font-semibold"
                      }`}
                    >
                      {row.price}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setBookingOpen(true)}
                className="mt-8 flex items-center gap-2 bg-[#B8734A] hover:bg-[#C47D52] text-[#F3EEE6] font-semibold px-6 py-3 text-[13px] tracking-wide transition-colors"
              >
                Записаться на стрижку <ArrowRight size={14} />
              </button>
            </div>

            <div className="md:pt-16">
              <p className="text-[#A79F94] text-[14px] leading-relaxed mb-10 max-w-[380px]">
                Точный прайс зависит от мастера и сложности работы — уточняется при записи или по телефону.
              </p>

              <p className="text-[#B8734A] text-[11px] font-semibold tracking-[.22em] uppercase mb-5">
                Удобства
              </p>
              <div className="space-y-5">
                {site.amenities.map((a) => (
                  <div key={a.id} className="flex items-start gap-4">
                    <span className="text-[#B8734A] mt-0.5 shrink-0 w-4 flex items-center justify-center text-[13px] font-bold font-brand">
                      {amenityIcon(a.id)}
                    </span>
                    <div className="leading-snug">
                      <span className="text-[#F3EEE6] text-[14px] font-medium">{a.title}</span>
                      <span className="text-[#A79F94] text-[14px]"> · {a.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="gallery" className="py-20 md:py-28 bg-[#1A1816]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-[#B8734A] text-[11px] font-semibold tracking-[.22em] uppercase mb-4">
                Атмосфера
              </p>
              <h2 className="font-brand text-[clamp(24px,4vw,38px)] font-bold text-[#F3EEE6] leading-tight">
                Место, куда
                <br />
                хочется вернуться
              </h2>
            </div>
            {gallerySlides[carouselIdx] && (
              <p className="text-[#A79F94] text-[12px] tracking-wide uppercase">
                {gallerySlides[carouselIdx].category === "work" ? "Работы" : "Интерьер"}
                <span className="text-[#3A3530] mx-2">·</span>
                <span className="tabular-nums">
                  {carouselIdx + 1} / {gallerySlides.length}
                </span>
              </p>
            )}
          </div>

          {gallerySlides.length > 0 && (
            <div className="relative">
              <div
                className="gal-wrap relative aspect-[4/5] sm:aspect-[16/10] overflow-hidden bg-[#24201C] cursor-pointer"
                onClick={() => setLightbox(carouselIdx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setLightbox(carouselIdx);
                }}
                role="button"
                tabIndex={0}
                aria-label="Открыть фото"
              >
                <img
                  key={gallerySlides[carouselIdx].id}
                  src={assetUrl(gallerySlides[carouselIdx].url)}
                  alt={gallerySlides[carouselIdx].alt}
                  className="gal-img absolute inset-0 w-full h-full object-cover"
                />
              </div>

              <div className="flex items-center justify-between gap-3 mt-5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={prevSlide}
                    className="w-10 h-10 border border-[rgba(243,238,230,0.14)] hover:border-[#B8734A] text-[#A79F94] hover:text-[#B8734A] flex items-center justify-center transition-colors"
                    aria-label="Предыдущее фото"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={nextSlide}
                    className="w-10 h-10 border border-[rgba(243,238,230,0.14)] hover:border-[#B8734A] text-[#A79F94] hover:text-[#B8734A] flex items-center justify-center transition-colors"
                    aria-label="Следующее фото"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="hidden sm:flex flex-wrap gap-1.5 max-w-[60%] justify-end">
                  {gallerySlides.map((slide, idx) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setCarouselIdx(idx)}
                      aria-label={`Фото ${idx + 1}`}
                      className={`h-1.5 transition-all ${
                        idx === carouselIdx
                          ? "w-6 bg-[#B8734A]"
                          : "w-1.5 bg-[rgba(243,238,230,0.18)] hover:bg-[rgba(243,238,230,0.35)]"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="py-20 md:py-28 bg-[#12110F]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <div className="grid md:grid-cols-2 gap-14 md:gap-20 items-center">
            <div>
              <p className="text-[#B8734A] text-[11px] font-semibold tracking-[.22em] uppercase mb-5">
                Почему {site.title}
              </p>
              <h2 className="font-brand text-[clamp(26px,4vw,40px)] font-bold text-[#F3EEE6] mb-5 leading-tight">
                Возвращаются
                <br />
                за мастером
              </h2>
              <p className="text-[#A79F94] text-[15px] leading-relaxed mb-10 max-w-[400px]">
                Наши клиенты возвращаются не потому что удобно. А потому что мастер знает своё дело и помнит,
                как тебе нужно.
              </p>

              <div className="space-y-7">
                {(
                  [
                    ["01", "Сильные барберы и внимание к деталям", "Каждый мастер — специалист. Слушает, советует, делает."],
                    ["02", "Мастерская, а не конвейер", "Спокойная работа без гонки. Твоё время не ограничено."],
                    [
                      "03",
                      "Удобный вход с улицы, парковка рядом",
                      "Никаких торговых центров — отдельный вход с Бажова.",
                    ],
                    [
                      "04",
                      "Сертификаты и предложения для постоянных",
                      "Дисконтная система и подарочные сертификаты.",
                    ],
                  ] as const
                ).map(([num, title, desc]) => (
                  <div key={num} className="flex gap-5">
                    <span className="font-brand text-[11px] text-[#B8734A] font-black tabular-nums mt-0.5 shrink-0">
                      {num}
                    </span>
                    <div>
                      <p className="text-[#F3EEE6] font-semibold text-[15px] mb-1">{title}</p>
                      <p className="text-[#A79F94] text-[13px] leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative aspect-[4/5] overflow-hidden bg-[#24201C]">
              <img
                src={assetUrl(site.why_image)}
                alt="Мастер за работой"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#12110F]/50 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      <section id="reviews" className="py-20 md:py-28 bg-[#1A1816]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-[#B8734A] text-[11px] font-semibold tracking-[.22em] uppercase mb-4">Отзывы</p>
              <div className="flex items-baseline gap-4">
                <span className="font-brand text-[clamp(36px,6vw,56px)] font-black text-[#F3EEE6] leading-none">
                  {ratingDisplay}
                </span>
                <div>
                  <Stars n={Math.round(site.rating.value)} size={13} />
                  <p className="text-[#A79F94] text-[12px] mt-1">
                    {site.rating.review_count} отзывов · Яндекс.Карты
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {site.aspects.map((a) => (
                <span
                  key={a}
                  className="text-[11px] text-[#A79F94] border border-[rgba(243,238,230,0.1)] px-3 py-1.5"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>

          {site.reviews.length > 0 && (
            <>
              <div className="grid md:grid-cols-2 gap-5 mb-7">
                {[site.reviews[revIdx], site.reviews[(revIdx + 1) % site.reviews.length]].map(
                  (rev, i) => (
                    <div
                      key={`${rev.id}-${i}`}
                      className={`bg-[#24201C] p-7 md:p-8 border border-[rgba(243,238,230,0.06)] ${
                        i === 1 ? "hidden md:block" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-5">
                        <div>
                          <p className="text-[#F3EEE6] font-semibold text-[15px]">{rev.name}</p>
                          <span className="text-[11px] text-[#B8734A] font-medium tracking-wide">
                            {rev.aspect}
                          </span>
                        </div>
                        <Stars n={rev.rating} />
                      </div>
                      <p className="text-[#A79F94] text-[14px] leading-relaxed">&ldquo;{rev.text}&rdquo;</p>
                      {rev.response && (
                        <div className="mt-5 pt-5 border-t border-[rgba(243,238,230,0.07)]">
                          <p className="text-[11px] text-[#B8734A] font-semibold mb-1.5 tracking-wide">
                            Ответ {site.title}:
                          </p>
                          <p className="text-[#A79F94] text-[12px] leading-relaxed">{rev.response}</p>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={prevRev}
                  className="w-10 h-10 border border-[rgba(243,238,230,0.14)] hover:border-[#B8734A] text-[#A79F94] hover:text-[#B8734A] flex items-center justify-center transition-colors"
                  aria-label="Предыдущий отзыв"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={nextRev}
                  className="w-10 h-10 border border-[rgba(243,238,230,0.14)] hover:border-[#B8734A] text-[#A79F94] hover:text-[#B8734A] flex items-center justify-center transition-colors"
                  aria-label="Следующий отзыв"
                >
                  <ChevronRight size={16} />
                </button>
                <span className="text-[#A79F94] text-[12px] tabular-nums">
                  {revIdx + 1} / {site.reviews.length}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="py-16 md:py-20 bg-[#24201C] border-y border-[rgba(243,238,230,0.07)]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
            <div className="shrink-0 w-full md:w-80 h-48 border border-[rgba(243,238,230,0.1)] bg-[#1A1816] flex items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#B8734A]/6 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#B8734A]/4 rounded-full blur-2xl" />
              <div className="relative z-10 text-center px-6">
                <span className="font-brand text-xl font-black text-[#F3EEE6] tracking-[.22em] block mb-2">
                  {site.title}
                </span>
                <div className="w-12 h-px bg-[#B8734A]/50 mx-auto mb-2" />
                <span className="text-[#B8734A] text-[10px] font-semibold tracking-[.18em] uppercase">
                  Подарочный сертификат
                </span>
              </div>
            </div>

            <div>
              <h2 className="font-brand text-[clamp(22px,3.5vw,32px)] font-bold text-[#F3EEE6] mb-3 leading-tight">
                Подарок, которым
                <br />
                реально воспользуются
              </h2>
              <p className="text-[#A79F94] text-[14px] leading-relaxed mb-6 max-w-[400px]">
                Сертификат на стрижку или уход — практичный выбор. Номинал и условия — уточняйте по телефону.
              </p>
              <a
                href={telHref}
                className="inline-flex items-center border border-[#B8734A] text-[#B8734A] hover:bg-[#B8734A] hover:text-[#F3EEE6] font-semibold px-6 py-3 text-[13px] tracking-wide transition-all"
              >
                Узнать условия
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="contacts" className="py-20 md:py-28 bg-[#12110F]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <p className="text-[#B8734A] text-[11px] font-semibold tracking-[.22em] uppercase mb-5">Контакты</p>
          <h2 className="font-brand text-[clamp(26px,4vw,40px)] font-bold text-[#F3EEE6] mb-12 leading-tight">
            Мы на {site.address.street_line}
          </h2>

          <div className="grid md:grid-cols-2 gap-12 md:gap-16">
            <div className="space-y-9">
              <div>
                <p className="text-[#A79F94] text-[10px] uppercase tracking-[.2em] mb-2">Телефон</p>
                <a
                  href={telHref}
                  className="font-brand text-[clamp(24px,4vw,36px)] font-bold text-[#F3EEE6] hover:text-[#B8734A] transition-colors leading-none"
                >
                  {site.phone.display}
                </a>
              </div>

              <div>
                <p className="text-[#A79F94] text-[10px] uppercase tracking-[.2em] mb-2">Адрес</p>
                <p className="text-[#F3EEE6] text-[15px]">{site.address.street_line}</p>
                <p className="text-[#A79F94] text-[13px] mt-0.5">{site.address.city_line}</p>
              </div>

              <div>
                <p className="text-[#A79F94] text-[10px] uppercase tracking-[.2em] mb-3">Часы работы</p>
                <div className="mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 ${
                      openStatus.isOpen
                        ? "bg-[#7A8B6F]/15 text-[#7A8B6F]"
                        : "bg-[#8B4A3B]/15 text-[#8B4A3B]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        openStatus.isOpen ? "bg-[#7A8B6F]" : "bg-[#8B4A3B]"
                      }`}
                    />
                    {openStatus.label}
                  </span>
                </div>
                <div className="space-y-2 text-[13px]">
                  <div className="flex gap-5">
                    <span className="text-[#F3EEE6] w-44 shrink-0">{site.working_hours.open_days_label}</span>
                    <span className="text-[#F3EEE6] tabular-nums">{site.working_hours.hours_label}</span>
                  </div>
                  <div className="flex gap-5">
                    <span className="text-[#A79F94] w-44 shrink-0">{site.working_hours.closed_days_label}</span>
                    <span className="text-[#8B4A3B]">Выходной</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[#A79F94] text-[10px] uppercase tracking-[.2em] mb-2">Как добраться</p>
                <div className="space-y-1.5 text-[13px] text-[#A79F94]">
                  {stop0 && (
                    <p>
                      Ост. «{stop0.name}» — ~{formatDistance(stop0.distance)} пешком
                    </p>
                  )}
                  {metro0 && (
                    <p>
                      Метро «{metro0.name}» — ~{formatDistance(metro0.distance)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <a
                  href={telHref}
                  className="flex items-center bg-[#B8734A] hover:bg-[#C47D52] text-[#F3EEE6] font-semibold px-5 py-2.5 text-[13px] tracking-wide transition-colors"
                >
                  Позвонить
                </a>
                <a
                  href={routeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-[rgba(243,238,230,0.18)] hover:border-[rgba(243,238,230,0.4)] text-[#F3EEE6] font-medium px-5 py-2.5 text-[13px] transition-colors"
                >
                  <ExternalLink size={13} />
                  Маршрут
                </a>
                <button
                  type="button"
                  onClick={() => setBookingOpen(true)}
                  className="border border-[rgba(243,238,230,0.18)] hover:border-[rgba(243,238,230,0.4)] text-[#F3EEE6] font-medium px-5 py-2.5 text-[13px] transition-colors"
                >
                  Записаться
                </button>
              </div>
            </div>

            <div className="relative h-80 md:h-full min-h-[340px] overflow-hidden border border-[rgba(243,238,230,0.07)] bg-[#1A1816]">
              <iframe
                src={mapWidgetSrc(site)}
                width="100%"
                height="100%"
                title={`${site.title} на карте`}
                className="w-full h-full grayscale-[30%]"
                loading="lazy"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#0C0B09] border-t border-[rgba(243,238,230,0.07)] py-12 md:py-16 mb-16 md:mb-0">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          <div className="grid md:grid-cols-3 gap-8 md:gap-12 mb-10">
            <div>
              <span className="font-brand text-[15px] font-black text-[#F3EEE6] tracking-[.28em] block mb-2">
                {site.title}
              </span>
              <p className="text-[#A79F94] text-[13px] leading-relaxed">
                Мужской барбершоп
                <br />в {site.address.locality}
              </p>
            </div>
            <div>
              <p className="text-[#A79F94] text-[10px] uppercase tracking-[.2em] mb-3">Контакты</p>
              <a
                href={telHref}
                className="text-[#F3EEE6] text-[13px] block mb-1.5 hover:text-[#B8734A] transition-colors"
              >
                {site.phone.display}
              </a>
              <p className="text-[#A79F94] text-[13px]">{site.address.short}</p>
            </div>
            <div>
              <p className="text-[#A79F94] text-[10px] uppercase tracking-[.2em] mb-3">Режим работы</p>
              <p className="text-[#F3EEE6] text-[13px] mb-1">
                {site.working_hours.open_days_label} · {site.working_hours.hours_label}
              </p>
              <p className="text-[#A79F94] text-[13px]">
                {site.working_hours.closed_days_label} — выходной
              </p>
              <a
                href={site.yandex_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-5 text-[12px] text-[#B8734A] hover:underline"
              >
                Карточка на Яндекс.Картах
              </a>
            </div>
          </div>

          <div className="border-t border-[rgba(243,238,230,0.05)] pt-6">
            <p className="text-[#3A3530] text-[11px] leading-relaxed max-w-[580px]">
              Информация на сайте актуальна по данным публичной карточки Яндекс.Карт
              {site.synced_at
                ? ` (обновлено ${new Date(site.synced_at).toLocaleString("ru-RU")})`
                : ""}
              . Точные цены, акции и запись уточняйте по телефону. Для обновления локально:{" "}
              <code className="text-[#A79F94]">npm run sync</code>.
            </p>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[#1A1816]/97 backdrop-blur border-t border-[rgba(243,238,230,0.1)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2">
        <a
          href={telHref}
          className="flex-1 flex items-center justify-center border border-[rgba(243,238,230,0.18)] text-[#F3EEE6] font-medium py-3 text-[13px]"
        >
          Позвонить
        </a>
        <button
          type="button"
          onClick={() => setBookingOpen(true)}
          className="flex-1 bg-[#B8734A] text-[#F3EEE6] font-semibold py-3 text-[13px] tracking-wide"
        >
          Записаться
        </button>
      </div>

      {bookingOpen && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-6">
          <div
            className="absolute inset-0 bg-black/72 backdrop-blur-sm"
            onClick={() => setBookingOpen(false)}
          />
          <div className="relative w-full md:max-w-[480px] max-h-[min(92dvh,720px)] overflow-y-auto bg-[#1E1B17] border border-[rgba(243,238,230,0.09)] rounded-t-xl md:rounded-none">
            <div className="sticky top-0 z-10 bg-[#1E1B17] flex items-center justify-between px-6 md:px-8 pt-6 pb-4 border-b border-[rgba(243,238,230,0.07)]">
              <div>
                <h3 className="font-brand text-[15px] font-bold text-[#F3EEE6] tracking-widest">Запись</h3>
                <p className="text-[#A79F94] text-[11px] mt-0.5">Откроется звонок для записи</p>
              </div>
              <button
                type="button"
                onClick={() => setBookingOpen(false)}
                className="text-[#A79F94] hover:text-[#F3EEE6] transition-colors"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitForm} className="px-6 md:px-8 py-6 space-y-4 pb-8">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[#A79F94] text-[10px] uppercase tracking-[.18em] block mb-1.5">
                    Имя
                  </span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Иван"
                    className="w-full bg-[#12110F] border border-[rgba(243,238,230,0.1)] focus:border-[#B8734A] text-[#F3EEE6] placeholder-[#3A3530] px-4 py-3 text-[13px] outline-none transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="text-[#A79F94] text-[10px] uppercase tracking-[.18em] block mb-1.5">
                    Телефон
                  </span>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                    placeholder="+7 (___) ___-__-__"
                    className="w-full bg-[#12110F] border border-[rgba(243,238,230,0.1)] focus:border-[#B8734A] text-[#F3EEE6] placeholder-[#3A3530] px-4 py-3 text-[13px] outline-none transition-colors"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-[#A79F94] text-[10px] uppercase tracking-[.18em] block mb-1.5">
                  Услуга
                </span>
                <select
                  value={form.service}
                  onChange={(e) => setForm((s) => ({ ...s, service: e.target.value }))}
                  className="w-full bg-[#12110F] border border-[rgba(243,238,230,0.1)] focus:border-[#B8734A] text-[#F3EEE6] px-4 py-3 text-[13px] outline-none transition-colors appearance-none cursor-pointer"
                >
                  <option value="">Выберите услугу</option>
                  <option>Мужская стрижка</option>
                  <option>Стрижка машинкой</option>
                  <option>Моделирование бороды</option>
                  <option>Комплекс «голова + борода»</option>
                  <option>Укладка / уход</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[#A79F94] text-[10px] uppercase tracking-[.18em] block mb-1.5">
                  Желаемые дата и время
                </span>
                <input
                  type="datetime-local"
                  value={form.datetime}
                  onChange={(e) => setForm((s) => ({ ...s, datetime: e.target.value }))}
                  className="w-full bg-[#12110F] border border-[rgba(243,238,230,0.1)] focus:border-[#B8734A] text-[#F3EEE6] px-4 py-3 text-[13px] outline-none transition-colors [color-scheme:dark]"
                />
              </label>

              <label className="block">
                <span className="text-[#A79F94] text-[10px] uppercase tracking-[.18em] block mb-1.5">
                  Комментарий
                </span>
                <textarea
                  value={form.comment}
                  onChange={(e) => setForm((s) => ({ ...s, comment: e.target.value }))}
                  placeholder="Пожелания, предпочтения..."
                  rows={3}
                  className="w-full bg-[#12110F] border border-[rgba(243,238,230,0.1)] focus:border-[#B8734A] text-[#F3EEE6] placeholder-[#3A3530] px-4 py-3 text-[13px] outline-none transition-colors resize-none"
                />
              </label>

              <button
                type="submit"
                className="w-full bg-[#B8734A] hover:bg-[#C47D52] text-[#F3EEE6] font-semibold py-3.5 text-[13px] tracking-wide transition-colors"
              >
                Позвонить и записаться
              </button>
              <p className="text-center text-[#A79F94] text-[11px]">
                После отправки откроется звонок на {site.phone.display}
              </p>
            </form>
          </div>
        </div>
      )}

      {lightbox !== null && gallerySlides[lightbox] && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-4 md:p-12"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-[#A79F94] hover:text-[#F3EEE6] z-10 p-2"
            onClick={() => setLightbox(null)}
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
          <button
            type="button"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 border border-[rgba(243,238,230,0.18)] flex items-center justify-center text-[#F3EEE6] hover:border-[#B8734A] transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation();
              if (lightbox === null) return;
              const next = (lightbox - 1 + gallerySlides.length) % gallerySlides.length;
              setLightbox(next);
              setCarouselIdx(next);
            }}
            aria-label="Предыдущее фото"
          >
            <ChevronLeft size={17} />
          </button>
          <img
            src={assetUrl(gallerySlides[lightbox].url)}
            alt={gallerySlides[lightbox].alt}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 border border-[rgba(243,238,230,0.18)] flex items-center justify-center text-[#F3EEE6] hover:border-[#B8734A] transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation();
              if (lightbox === null) return;
              const next = (lightbox + 1) % gallerySlides.length;
              setLightbox(next);
              setCarouselIdx(next);
            }}
            aria-label="Следующее фото"
          >
            <ChevronRight size={17} />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[#A79F94] text-[12px] tabular-nums">
            {lightbox + 1} / {gallerySlides.length}
          </p>
        </div>
      )}
    </>
  );
}
