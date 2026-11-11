import { Clock3, Sparkles, Waves } from "lucide-react";
import Image from "next/image";
import { formatLkr, type PublicCatalogItem, type PublicVehicle } from "@/lib/public-catalog";

function PriceList({ item, vehicles }: { item: PublicCatalogItem; vehicles: PublicVehicle[] }) {
  const prices = new Map(item.prices.map((price) => [price.vehicleType, price.amount]));
  return <div className="public-price-list">{vehicles.map((vehicle) => {
    const amount = prices.get(vehicle.id);
    return <div className="public-price-row" key={vehicle.id}><span>{vehicle.name}</span><strong>{typeof amount === "number" ? formatLkr(amount) : "Ask us"}</strong></div>;
  })}</div>;
}

export function PublicServiceCards({ services, vehicles }: { services: PublicCatalogItem[]; vehicles: PublicVehicle[] }) {
  if (!services.length) return <div className="catalog-public-empty"><Waves size={20} /><p>Our service menu is being refreshed. Get in touch and we’ll help you find the right wash.</p></div>;
  return <div className="public-service-grid">{services.map((service, index) => <article className="public-service-card" key={service.id}>
    {service.photoUrl ? <Image className="public-service-photo" src={service.photoUrl} alt={`${service.name} car wash service`} width={640} height={360} unoptimized /> : <div className={`public-service-art service-art-${index % 3}`}><Sparkles size={22} /><span>CARE, MADE SIMPLE</span></div>}
    <div className="public-service-body"><div className="public-service-meta"><span>SERVICE {String(index + 1).padStart(2, "0")}</span><span><Clock3 size={13} /> {service.durationMinutes} min</span></div><h3>{service.name}</h3><p>{service.description || "Careful, friendly attention for your vehicle."}</p><PriceList item={service} vehicles={vehicles} /></div>
  </article>)}</div>;
}

export function PublicAddonList({ addons, vehicles }: { addons: PublicCatalogItem[]; vehicles: PublicVehicle[] }) {
  if (!addons.length) return null;
  return <div className="public-addons"><div className="public-addons-heading"><div className="eyebrow"><Sparkles size={14} /> LITTLE EXTRAS</div><h3>Make it a little more special.</h3><p>Add optional care to your wash.</p></div><div className="public-addon-list">{addons.map((addon) => <article className="public-addon-card" key={addon.id}><div><strong>{addon.name}</strong><p>{addon.description || `Adds about ${addon.durationMinutes} minutes to your visit.`}</p><span><Clock3 size={12} /> +{addon.durationMinutes} min</span></div><div className="addon-prices">{vehicles.map((vehicle) => { const price = addon.prices.find((item) => item.vehicleType === vehicle.id)?.amount; return <p key={vehicle.id}><span>{vehicle.name}</span><strong>{typeof price === "number" ? formatLkr(price) : "Ask us"}</strong></p>; })}</div></article>)}</div></div>;
}
