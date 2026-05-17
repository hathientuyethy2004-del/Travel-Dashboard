import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings as SettingsIcon, MapPin, Tag, Plus, Trash2, RefreshCw, Check } from "lucide-react";

const API = "/api";

interface City {
  code: string;
  name: string;
  nameEn: string;
  lat: number;
  lon: number;
  radius_km: number;
}

interface CategoryTag {
  key: string;
  value: string;
}

interface Category {
  code: string;
  label?: string;
  tags: CategoryTag[];
}

const BLANK_CITY: Omit<City, "code"> = { name: "", nameEn: "", lat: 0, lon: 0, radius_km: 15 };
const BLANK_CAT: Omit<Category, "code"> = { label: "", tags: [{ key: "amenity", value: "" }] };

function SavedTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-green-600 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded">
      <Check className="w-3 h-3" /> Saved
    </span>
  );
}

export default function Settings() {
  const [cities, setCities] = useState<City[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"cities" | "categories">("cities");

  const [savedCity, setSavedCity] = useState<string | null>(null);
  const [savedCat, setSavedCat] = useState<string | null>(null);

  // Add city form
  const [showCityForm, setShowCityForm] = useState(false);
  const [newCity, setNewCity] = useState({ code: "", ...BLANK_CITY });
  const [cityFormBusy, setCityFormBusy] = useState(false);

  // Add category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCat, setNewCat] = useState({ code: "", ...BLANK_CAT });
  const [catFormBusy, setCatFormBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, k] = await Promise.all([
        fetch(`${API}/etl/config/cities`).then((r) => r.json()),
        fetch(`${API}/etl/config/categories`).then((r) => r.json()),
      ]);
      setCities(Array.isArray(c) ? c : []);
      setCats(Array.isArray(k) ? k : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function deleteCity(code: string) {
    if (!confirm(`Remove city "${code}"?`)) return;
    await fetch(`${API}/etl/config/cities/${code}`, { method: "DELETE" });
    setCities((prev) => prev.filter((c) => c.code !== code));
  }

  async function deleteCat(code: string) {
    if (!confirm(`Remove category "${code}"?`)) return;
    await fetch(`${API}/etl/config/categories/${code}`, { method: "DELETE" });
    setCats((prev) => prev.filter((c) => c.code !== code));
  }

  async function saveCity() {
    if (!newCity.code.trim() || !newCity.name.trim()) return;
    setCityFormBusy(true);
    try {
      await fetch(`${API}/etl/config/cities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCity.code.toLowerCase().replace(/\s+/g, "_"),
          name: newCity.name,
          nameEn: newCity.nameEn,
          lat: Number(newCity.lat),
          lon: Number(newCity.lon),
          radius_km: Number(newCity.radius_km),
        }),
      });
      await fetchAll();
      setSavedCity(newCity.code);
      setTimeout(() => setSavedCity(null), 2000);
      setNewCity({ code: "", ...BLANK_CITY });
      setShowCityForm(false);
    } finally {
      setCityFormBusy(false);
    }
  }

  async function saveCat() {
    if (!newCat.code.trim()) return;
    const validTags = newCat.tags.filter((t) => t.key && t.value);
    if (!validTags.length) return;
    setCatFormBusy(true);
    try {
      await fetch(`${API}/etl/config/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCat.code.toLowerCase().replace(/\s+/g, "_"),
          label: newCat.label || newCat.code,
          tags: validTags,
        }),
      });
      await fetchAll();
      setSavedCat(newCat.code);
      setTimeout(() => setSavedCat(null), 2000);
      setNewCat({ code: "", ...BLANK_CAT });
      setShowCatForm(false);
    } finally {
      setCatFormBusy(false);
    }
  }

  return (
    <div className="px-6 pt-6 pb-8 max-w-[900px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0079F2, #0d9488)" }}>
            <SettingsIcon className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-bold text-2xl">Settings</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-11">Manage cities and categories used by the ETL pipeline</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["cities", "categories"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"
            }`}>
            {t === "cities" ? <MapPin className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />}
            {t === "cities" ? `Cities (${cities.length})` : `Categories (${cats.length})`}
          </button>
        ))}
        <button onClick={fetchAll} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-muted hover:bg-muted/80 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* ── Cities ──────────────────────────────────────────────────────────── */}
      {tab === "cities" && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Cities
            </CardTitle>
            <button onClick={() => setShowCityForm((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-primary text-white hover:opacity-90 transition-opacity">
              <Plus className="w-3.5 h-3.5" /> Add City
            </button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {showCityForm && (
              <div className="mb-4 p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                <p className="text-sm font-medium">New City</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Code (e.g. "hanoi")</label>
                    <input value={newCity.code} onChange={(e) => setNewCity((p) => ({ ...p, code: e.target.value }))}
                      placeholder="hanoi" className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Vietnamese Name</label>
                    <input value={newCity.name} onChange={(e) => setNewCity((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Hà Nội" className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">English Name</label>
                    <input value={newCity.nameEn} onChange={(e) => setNewCity((p) => ({ ...p, nameEn: e.target.value }))}
                      placeholder="Hanoi" className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Radius (km)</label>
                    <input type="number" value={newCity.radius_km} onChange={(e) => setNewCity((p) => ({ ...p, radius_km: Number(e.target.value) }))}
                      className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Latitude</label>
                    <input type="number" step="0.0001" value={newCity.lat} onChange={(e) => setNewCity((p) => ({ ...p, lat: Number(e.target.value) }))}
                      className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Longitude</label>
                    <input type="number" step="0.0001" value={newCity.lon} onChange={(e) => setNewCity((p) => ({ ...p, lon: Number(e.target.value) }))}
                      className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={saveCity} disabled={cityFormBusy}
                    className="px-4 py-1.5 rounded bg-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
                    {cityFormBusy ? "Saving…" : "Save City"}
                  </button>
                  <button onClick={() => setShowCityForm(false)} className="px-3 py-1.5 rounded bg-muted text-xs hover:bg-muted/80">Cancel</button>
                  {savedCity && <SavedTag />}
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : cities.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No cities configured.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {["Code", "Name", "Lat", "Lon", "Radius", ""].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-muted-foreground px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cities.map((c) => (
                      <tr key={c.code} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 font-mono text-xs font-medium">{c.code}</td>
                        <td className="px-3 py-2">
                          <div className="text-xs font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.nameEn}</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{c.lat}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{c.lon}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{c.radius_km} km</td>
                        <td className="px-3 py-2">
                          <button onClick={() => deleteCity(c.code)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Categories ─────────────────────────────────────────────────────── */}
      {tab === "categories" && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" /> Categories
            </CardTitle>
            <button onClick={() => setShowCatForm((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-primary text-white hover:opacity-90 transition-opacity">
              <Plus className="w-3.5 h-3.5" /> Add Category
            </button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {showCatForm && (
              <div className="mb-4 p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                <p className="text-sm font-medium">New Category</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Code (e.g. "restaurant")</label>
                    <input value={newCat.code} onChange={(e) => setNewCat((p) => ({ ...p, code: e.target.value }))}
                      placeholder="restaurant" className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Label</label>
                    <input value={newCat.label} onChange={(e) => setNewCat((p) => ({ ...p, label: e.target.value }))}
                      placeholder="Restaurant" className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">OSM Tags</label>
                  <div className="space-y-2">
                    {newCat.tags.map((t, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input value={t.key} onChange={(e) => setNewCat((p) => ({
                          ...p, tags: p.tags.map((tt, ii) => ii === i ? { ...tt, key: e.target.value } : tt)
                        }))} placeholder="amenity" className="w-28 h-7 rounded border border-input bg-background px-2 text-xs" />
                        <span className="text-xs text-muted-foreground">=</span>
                        <input value={t.value} onChange={(e) => setNewCat((p) => ({
                          ...p, tags: p.tags.map((tt, ii) => ii === i ? { ...tt, value: e.target.value } : tt)
                        }))} placeholder="restaurant" className="flex-1 h-7 rounded border border-input bg-background px-2 text-xs" />
                        {newCat.tags.length > 1 && (
                          <button onClick={() => setNewCat((p) => ({ ...p, tags: p.tags.filter((_, ii) => ii !== i) }))}>
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setNewCat((p) => ({ ...p, tags: [...p.tags, { key: "amenity", value: "" }] }))}
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Plus className="w-3 h-3" /> Add tag
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={saveCat} disabled={catFormBusy}
                    className="px-4 py-1.5 rounded bg-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
                    {catFormBusy ? "Saving…" : "Save Category"}
                  </button>
                  <button onClick={() => setShowCatForm(false)} className="px-3 py-1.5 rounded bg-muted text-xs hover:bg-muted/80">Cancel</button>
                  {savedCat && <SavedTag />}
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : cats.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No categories configured.</div>
            ) : (
              <div className="space-y-2">
                {cats.map((c) => (
                  <div key={c.code} className="flex items-start justify-between p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium">{c.code}</span>
                        {c.label && c.label !== c.code && (
                          <span className="text-xs text-muted-foreground">({c.label})</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(c.tags || []).map((t, i) => (
                          <code key={i} className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {t.key}={t.value}
                          </code>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => deleteCat(c.code)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
