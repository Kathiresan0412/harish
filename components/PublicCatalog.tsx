"use client";

import { Clock3, Sparkles, Waves } from "lucide-react";
import Image from "next/image";
import type { PublicCatalogItem, PublicVehicle } from "@/lib/public-catalog";
import { formatLkr } from "@/lib/money";
import { useLanguage } from "@/components/LanguageProvider";

const copy = (language: string, en: string, ta: string, si: string) => language === "ta" ? ta : language === "si" ? si : en;

function PriceList({ item, vehicles }: { item: PublicCatalogItem; vehicles: PublicVehicle[] }) {
  const { language } = useLanguage();
  const prices = new Map(item.prices.map((price) => [price.vehicleType, price.amount]));
  return <div className="public-price-list">{vehicles.map((vehicle) => {
    const amount = prices.get(vehicle.id);
    return <div className="public-price-row" key={vehicle.id}><span>{vehicle.name}</span><strong>{typeof amount === "number" ? formatLkr(amount) : copy(language, "Ask us", "எங்களிடம் கேளுங்கள்", "අපෙන් විමසන්න")}</strong></div>;
  })}</div>;
}

export function PublicServiceCards({ services, vehicles }: { services: PublicCatalogItem[]; vehicles: PublicVehicle[] }) {
  const { language } = useLanguage();
  const localizedName = (item: PublicCatalogItem) => language === "ta" ? item.nameTa || item.name : language === "si" ? item.nameSi || item.name : item.name;
  const localizedDescription = (item: PublicCatalogItem) => language === "ta" ? item.descriptionTa || item.description : language === "si" ? item.descriptionSi || item.description : item.description;
  if (!services.length) return <div className="catalog-public-empty"><Waves size={20} /><p>{copy(language, "Our service menu is being refreshed. Get in touch and we’ll help you find the right wash.", "எங்கள் சேவை பட்டியல் புதுப்பிக்கப்படுகிறது. சரியான சேவையைத் தேர்ந்தெடுக்க எங்களைத் தொடர்புகொள்ளுங்கள்.", "අපගේ සේවා ලැයිස්තුව යාවත්කාලීන වෙමින් පවතී. සුදුසු සේවාවක් සඳහා අප හා සම්බන්ධ වන්න.")}</p></div>;
  return <div className="public-service-grid">{services.map((service, index) => <article className="public-service-card" key={service.id}>
    {service.photoUrl ? <Image className="public-service-photo" src={service.photoUrl} alt={`${service.name} car wash service`} width={640} height={360} unoptimized /> : <div className={`public-service-art service-art-${index % 3}`}><Sparkles size={22} /><span>{copy(language, "CARE, MADE SIMPLE", "எளிய பராமரிப்பு", "සරල සත්කාරය")}</span></div>}
    <div className="public-service-body"><div className="public-service-meta"><span>{copy(language, "SERVICE", "சேவை", "සේවාව")} {String(index + 1).padStart(2, "0")}</span><span><Clock3 size={13} /> {service.durationMinutes} min</span></div><h3>{localizedName(service)}</h3><p>{localizedDescription(service) || copy(language, "Careful, friendly attention for your vehicle.", "உங்கள் வாகனத்திற்கு அக்கறையான, நட்பான பராமரிப்பு.", "ඔබේ වාහනයට සැලකිලිමත්, හිතවත් සේවාවක්.")}</p><PriceList item={service} vehicles={vehicles} /></div>
  </article>)}</div>;
}

export function PublicAddonList({ addons, vehicles }: { addons: PublicCatalogItem[]; vehicles: PublicVehicle[] }) {
  const { language } = useLanguage();
  const localizedName = (item: PublicCatalogItem) => language === "ta" ? item.nameTa || item.name : language === "si" ? item.nameSi || item.name : item.name;
  if (!addons.length) return null;
  return <div className="public-addons"><div className="public-addons-heading"><div className="eyebrow"><Sparkles size={14} /> {copy(language, "LITTLE EXTRAS", "கூடுதல் சேவைகள்", "අමතර සේවා")}</div><h3>{copy(language, "Make it a little more special.", "இன்னும் சிறப்பாக்குங்கள்.", "තවත් විශේෂ කරගන්න.")}</h3><p>{copy(language, "Add optional care to your wash.", "உங்கள் சுத்தத்துடன் விருப்பமான பராமரிப்பைச் சேர்க்கவும்.", "ඔබේ සේදීමට කැමති අමතර සත්කාරයක් එක් කරන්න.")}</p></div><div className="public-addon-list">{addons.map((addon) => <article className="public-addon-card" key={addon.id}><div><strong>{localizedName(addon)}</strong><p>{(language === "ta" ? addon.descriptionTa : language === "si" ? addon.descriptionSi : addon.description) || copy(language, `Adds about ${addon.durationMinutes} minutes to your visit.`, `உங்கள் சேவைக்கு சுமார் ${addon.durationMinutes} நிமிடங்கள் சேர்க்கப்படும்.`, `ඔබේ සේවාවට විනාඩි ${addon.durationMinutes}ක් පමණ එක් වේ.`)}</p><span><Clock3 size={12} /> +{addon.durationMinutes} min</span></div><div className="addon-prices">{vehicles.map((vehicle) => { const price = addon.prices.find((item) => item.vehicleType === vehicle.id)?.amount; return <p key={vehicle.id}><span>{vehicle.name}</span><strong>{typeof price === "number" ? formatLkr(price) : copy(language, "Ask us", "எங்களிடம் கேளுங்கள்", "අපෙන් විමසන්න")}</strong></p>; })}</div></article>)}</div></div>;
}
