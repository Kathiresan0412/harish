"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { archiveCatalogItem, saveAddon, saveService, saveVehicleType } from "@/app/actions/catalog";
import { Archive, CarFront, Clock3, ImageUp, LoaderCircle, Plus, Sparkles, Wrench } from "lucide-react";

export type CatalogVehicle = { id: string; name: string; sortOrder: number; active: boolean };
export type CatalogPrice = { vehicleType: string; amount: number };
export type CatalogItem = { id: string; name: string; nameTa: string; nameSi: string; description: string; descriptionTa: string; descriptionSi: string; photoUrl: string; durationMinutes: number; prices: CatalogPrice[]; sortOrder: number; active: boolean };

function PhotoUrlField({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Upload failed. Try again.");
      setUrl(result.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return <div className="catalog-full photo-url-field"><label>Photo URL<input name="photoUrl" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Upload an image or paste a hosted URL" /></label><label className="photo-upload-button"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => upload(event.target.files?.[0])} />{uploading ? <><LoaderCircle size={15} className="spin" /> Uploading…</> : <><ImageUp size={15} /> Upload photo</>}<small>JPG, PNG or WebP · max 4 MB</small></label>{error && <span className="upload-error" role="alert">{error}</span>}{url && <Image className="catalog-photo-preview" src={url} alt="Service photo preview" width={400} height={125} unoptimized />}</div>;
}

function PriceFields({ vehicles, prices = [] }: { vehicles: CatalogVehicle[]; prices?: CatalogPrice[] }) {
  const activeVehicles = vehicles.filter((vehicle) => vehicle.active);
  return <div className="catalog-prices">{activeVehicles.map((vehicle) => {
    const price = prices.find((item) => item.vehicleType === vehicle.id)?.amount;
    return <label key={vehicle.id}>{vehicle.name} <span className="money-input"><span>LKR</span><input name={`price_${vehicle.id}`} type="number" min="0" step="0.01" defaultValue={typeof price === "number" ? (price / 100).toFixed(2) : ""} required placeholder="0.00" /></span></label>;
  })}</div>;
}

function CatalogFields({ item, vehicles, kind }: { item?: CatalogItem; vehicles: CatalogVehicle[]; kind: "service" | "addon" }) {
  const action = kind === "service" ? saveService : saveAddon;
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await action(formData);
        setFeedback({ ok: true, text: item ? "Changes saved." : `${kind === "service" ? "Service" : "Add-on"} added.` });
      } catch (error) {
        setFeedback({ ok: false, text: error instanceof Error ? error.message : "Could not save. Please try again." });
      }
    });
  }
  return <form onSubmit={submit} className="catalog-form">
    {item && <input type="hidden" name="id" value={item.id} />}
    <div className="catalog-form-grid">
      <label>Display name<input name="name" required minLength={2} maxLength={80} defaultValue={item?.name ?? ""} placeholder={kind === "service" ? "Exterior hand wash" : "Interior vacuum"} /></label>
      <label>Display name · தமிழ்<input name="nameTa" maxLength={80} defaultValue={item?.nameTa ?? ""} placeholder="Optional Tamil name" /></label>
      <label>Display name · සිංහල<input name="nameSi" maxLength={80} defaultValue={item?.nameSi ?? ""} placeholder="Optional Sinhala name" /></label>
      <label>Duration (minutes)<input name="durationMinutes" type="number" min={kind === "service" ? 1 : 0} max="600" step="1" required defaultValue={item?.durationMinutes ?? (kind === "service" ? 45 : 15)} /></label>
      {kind === "service" && <PhotoUrlField key={item?.id ?? "new-service"} initialUrl={item?.photoUrl ?? ""} />}
      <label className="catalog-full">Description<textarea name="description" rows={2} maxLength={500} defaultValue={item?.description ?? ""} placeholder="What is included?" /></label>
      <label className="catalog-full">Description · தமிழ்<textarea name="descriptionTa" rows={2} maxLength={500} defaultValue={item?.descriptionTa ?? ""} placeholder="Optional Tamil description" /></label>
      <label className="catalog-full">Description · සිංහල<textarea name="descriptionSi" rows={2} maxLength={500} defaultValue={item?.descriptionSi ?? ""} placeholder="Optional Sinhala description" /></label>
      <label>Display order<input name="sortOrder" type="number" min="0" step="1" defaultValue={item?.sortOrder ?? 0} /></label>
      <label>Status<select name="active" defaultValue={item?.active === false ? "false" : "true"}><option value="true">Active · visible publicly</option><option value="false">Inactive · hidden publicly</option></select></label>
    </div>
    <div className="catalog-price-heading"><span>Price by vehicle</span><small>Enter prices in LKR</small></div>
    <PriceFields vehicles={vehicles} prices={item?.prices} />
    {feedback && <p className={`catalog-action-feedback ${feedback.ok ? "success" : "error"}`} role={feedback.ok ? "status" : "alert"}>{feedback.text}</p>}
    <div className="catalog-form-actions"><button className="button" type="submit" disabled={pending}>{pending ? <><LoaderCircle size={15} className="spin" /> Saving…</> : item ? "Save changes" : <><Plus size={15} /> Add {kind}</>}</button></div>
  </form>;
}

function ArchiveCatalogForm({ id, kind, label, onSuccess }: { id: string; kind: "service" | "addon"; label: string; onSuccess: (message: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try { await archiveCatalogItem(data); setFeedback({ ok: true, text: `${label} removed.` }); onSuccess(`${label} removed.`); }
      catch (error) { setFeedback({ ok: false, text: error instanceof Error ? error.message : "Could not remove item." }); }
    });
  }
  return <form onSubmit={submit} className="archive-form"><input type="hidden" name="id" value={id} /><input type="hidden" name="kind" value={kind} />{feedback && <span className={`catalog-action-feedback ${feedback.ok ? "success" : "error"}`} role={feedback.ok ? "status" : "alert"}>{feedback.text}</span>}<button type="submit" className="archive-button" disabled={pending}>{pending ? <LoaderCircle size={14} className="spin" /> : <Archive size={14} />} {pending ? "Removing…" : `Remove ${label.toLowerCase()}`}</button></form>;
}

export function CatalogManager({ services, addons, vehicles }: { services: CatalogItem[]; addons: CatalogItem[]; vehicles: CatalogVehicle[] }) {
  const activeVehicleCount = vehicles.filter((vehicle) => vehicle.active).length;
  const [managerFeedback, setManagerFeedback] = useState("");
  return <div className="catalog-manager">
    {managerFeedback && <p className="catalog-action-feedback success" role="status">{managerFeedback}</p>}
    <section className="catalog-section" id="vehicle-types"><div className="catalog-section-heading"><span className="catalog-icon"><CarFront size={18} /></span><div><h2>Vehicle types</h2><p>Set the vehicles customers can book for.</p></div><span className="catalog-count">{vehicles.filter((vehicle) => vehicle.active).length} active</span></div>
      <div className="vehicle-list">{vehicles.map((vehicle) => <form action={saveVehicleType} className="vehicle-row" key={vehicle.id}><input type="hidden" name="id" value={vehicle.id} /><label className="vehicle-name">Vehicle name<input name="name" defaultValue={vehicle.name} required minLength={2} maxLength={40} /></label><label>Order<input name="sortOrder" type="number" min="0" step="1" defaultValue={vehicle.sortOrder} /></label><label>Status<select name="active" defaultValue={vehicle.active ? "true" : "false"} disabled={vehicle.active && activeVehicleCount === 1}><option value="true">Active</option><option value="false">Inactive</option></select></label><button className="quiet-button" type="submit">Save</button></form>)}
        <form action={saveVehicleType} className="vehicle-row new-vehicle-row"><label className="vehicle-name">New vehicle type<input name="name" placeholder="e.g. Pickup" required minLength={2} maxLength={40} /></label><input type="hidden" name="sortOrder" value={vehicles.length} /><input type="hidden" name="active" value="true" /><button className="quiet-button" type="submit"><Plus size={14} /> Add type</button></form>
      </div>
    </section>
    <section className="catalog-section" id="services-list"><div className="catalog-section-heading"><span className="catalog-icon"><Wrench size={18} /></span><div><h2>Services</h2><p>Core washes and detailing customers can book.</p></div><span className="catalog-count">{services.filter((service) => service.active).length} active</span></div>
      <details className="catalog-item new-catalog-item"><summary><span><Plus size={16} /> Add a service</span><small>Set duration and vehicle pricing</small></summary><CatalogFields vehicles={vehicles} kind="service" /></details>
      {services.map((service) => <details className="catalog-item" key={service.id}><summary><span>{service.name}{!service.active && <i className="inactive-badge">Hidden</i>}</span><small><Clock3 size={13} /> {service.durationMinutes} min</small></summary><CatalogFields item={service} vehicles={vehicles} kind="service" /><ArchiveCatalogForm id={service.id} kind="service" onSuccess={setManagerFeedback} label="Service" /></details>)}
      {services.length === 0 && <p className="catalog-empty">Your sample services will appear here after setup.</p>}
    </section>
    <section className="catalog-section" id="addons-list"><div className="catalog-section-heading"><span className="catalog-icon"><Sparkles size={18} /></span><div><h2>Add-ons</h2><p>Optional extras customers can add to a service.</p></div><span className="catalog-count">{addons.filter((addon) => addon.active).length} active</span></div>
      <details className="catalog-item new-catalog-item"><summary><span><Plus size={16} /> Add an add-on</span><small>Optional extra for a booking</small></summary><CatalogFields vehicles={vehicles} kind="addon" /></details>
      {addons.map((addon) => <details className="catalog-item" key={addon.id}><summary><span>{addon.name}{!addon.active && <i className="inactive-badge">Hidden</i>}</span><small><Clock3 size={13} /> +{addon.durationMinutes} min</small></summary><CatalogFields item={addon} vehicles={vehicles} kind="addon" /><ArchiveCatalogForm id={addon.id} kind="addon" onSuccess={setManagerFeedback} label="Add-on" /></details>)}
      {addons.length === 0 && <p className="catalog-empty">No add-ons yet. You can add vacuum, wax, shampoo, or other extras.</p>}
    </section>
    {activeVehicleCount === 0 && <p className="catalog-warning" role="alert">Add or activate a vehicle type before creating services or add-ons.</p>}
  </div>;
}
