import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings as SettingsIcon, MapPin, Tag, Plus, Trash2, RefreshCw,
  Check, WifiOff, Database, BarChart2,
} from "lucide-react";
import {
  useGetPoiByCity,
  useGetPoiByCategory,
} from "@workspace/api-client-react";
import { CHART_COLORS, CHART_COLOR_LIST, formatCityName } from "@/lib/constants";

const API = "/api";

interface CityConfig {
  code: string;
  name: string;
  nameEn: string;
  lat: number;
  lon: number;
  radius_km: number;
}

interface CategoryTag { key: string; value: string }
interface CategoryConfig {
  code: string;
  label?: string;
  tags: CategoryTag[];
}

const BLANK_CITY: Omit<CityConfig, "code"> = { name: "", nameEn: "", lat: 0, lon: 0, radius_km: 15 };
const BLANK_CAT: Omit<CategoryConfig, "code"> = { label: "", tags: [{ key: "amenity", value: "" }] };

function SavedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-green-600 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded">
      <Check className="w-3 h-3" /> Saved
    </span>
  );
}

export default function Settings() {
  // ── Main API hooks (always works, ETL not required) ──────────────────────
  const { data: cityDbData,  isLoading: citiesDbLoading  } = useGetPoiByCity();
  const { data: catDbData,   isLoading: catsDbLoading    } = useGetPoiByCategory();

  // ── ETL config state (requires ETL service) ─────────────────────────────
  const [etlCities,  setEtlCities]  = useState<CityConfig[]>([]);
  const [etlCats,    setEtlCats]    = useState<CategoryConfig[]>([]);
  const [etlOnline,  setEtlOnline]  = useState(false);
  const [etlLoading, setEtlLoading] = useState(true);
  const [tab,        setTab]        = useState<"cities" | "categories">("cities");

  const [savedCity, setSavedCity] = useState<string | null>(null);
  const [savedCat,  setSavedCat]  = useState<string | null>(null);

  const [showCityForm, setShowCityForm] = useState(false);
  const [newCity, setNewCity] = useState({ code: "", ...BLANK_CITY });
  const [cityFormBusy, setCityFormBusy] = useState(false);

  const [showCatForm, setShowCatForm] = useState(false);
  const [newCat, setNewCat] = useState({ code: "", ...BLANK_CAT });
  const [catFormBusy, setCatFormBusy] = useState(false);

  const fetchEtlConfig = useCallback(async () => {
    setEtlLoading(true);
    try {
      const [c, k] = await Promise.all([
        fetch(`${API}/etl/config/cities`).then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        }),
        fetch(`${API}/etl/config/categories`).then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        }),
      ]);
      setEtlCities(Array.isArray(c) ? c : []);
      setEtlCats(Array.isArray(k) ? k : []);
      setEtlOnline(true);
    } catch {
      setEtlOnline(false);
    } finally {
      setEtlLoading(false);
    }
  }, []);

  useEffect(() => { fetchEtlConfig(); }, [fetchEtlConfig]);

  async function deleteCity(code: string) {
    if (!confirm(`Remove city "${code}" from ETL config?`)) return;
    await fetch(`${API}/etl/config/cities/${code}`, { method: "DELETE" });
    setEtlCities((prev) => prev.filter((c) => c.code !== code));
  }

  async function deleteCat(code: string) {
    if (!confirm(`Remove category "${code}" from ETL config?`)) return;
    await fetch(`${API}/etl/config/categories/${code}`, { method: "DELETE" });
    setEtlCats((prev) => prev.filter((c) => c.code !== code));
  }

  async function saveCity() {
    if (!newCity.code.trim() || !newCity.name.trim()) return;
    setCityFormBusy(true);
    try {
      const r = await fetch(`${API}/etl/config/cities`, {
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
      if (r.status === 401) { alert("Authentication required."); return; }
      await fetchEtlConfig();
      setSavedCity(newCity.code);
      setTimeout(() => setSavedCity(null), 2000);
      setNewCity({ code: "", ...BLANK_CITY });
      setShowCityForm(false);
    } finally { setCityFormBusy(false); }
  }

  async function saveCat() {
    if (!newCat.code.trim()) return;
    const validTags = newCat.tags.filter((t) => t.key && t.value);
    if (!validTags.length) return;
    setCatFormBusy(true);
    try {
      const r = await fetch(`${API}/etl/config/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCat.code.toLowerCase().replace(/\s+/g, "_"),
          label: newCat.label || newCat.code,
          tags: validTags,
        }),
      });
      if (r.status === 401) { alert("Authentication required."); return; }
      await fetchEtlConfig();
      setSavedCat(newCat.code);
      setTimeout(() => setSavedCat(null), 2000);
      setNewCat({ code: "", ...BLANK_CAT });
      setShowCatForm(false);
    } finally { setCatFormBusy(false); }
  }

  // Merge DB counts into ETL config
  const mergedCities = etlCities.map((c) => ({
    ...c,
    poiCount: (cityDbData ?? []).find((d) => d.city === c.code)?.count ?? 0,
  }));

  const mergedCats = etlCats.map((c) => ({
    ...c,
    poiCount: (catDbData ?? []).find((d) => d.category === c.code)?.count ?? 0,
  }));

  const maxCityCount = Math.max(...(cityDbData ?? []).map((c) => c.count), 1);
  const maxCatCount  = Math.max(...(catDbData  ?? []).map((c) => c.count), 1);

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="px-6 pt-6 pb-8 max-w-[1100px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0079F2, #0d9488)" }}>
              <SettingsIcon className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-2xl">Settings</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">
            Collection targets for the ETL pipeline · database snapshot always visible
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            etlOnline
              ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
              : "bg-muted text-muted-foreground"
          }`}>
            {etlOnline ? "● ETL Online" : <><WifiOff className="w-3 h-3" /> ETL Offline</>}
          </div>
          <button
            onClick={fetchEtlConfig}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-muted hover:bg-muted/80 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4">
        {(["cities", "categories"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"
            }`}
          >
            {t === "cities" ? <MapPin className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />}
            {t === "cities"
              ? `Cities (${(cityDbData ?? []).length || etlCities.length})`
              : `Categories (${(catDbData ?? []).length || etlCats.length})`}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === "cities" && (
        <div className="space-y-4">

          {/* Database Snapshot — always visible */}
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Cities in MongoDB
                <span className="ml-auto text-xs text-muted-foreground font-normal">from Gold layer · live</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {(cityDbData ?? []).length} active cities with verified POI data
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {citiesDbLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <div className="space-y-2">
                  {(cityDbData ?? []).map((c, i) => {
                    const barPct = (c.count / maxCityCount) * 100;
                    return (
                      <div key={c.city} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: CHART_COLOR_LIST[i % CHART_COLOR_LIST.length] }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-medium truncate">{formatCityName(c.cityName, c.city)}</span>
                            <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                              {c.count.toLocaleString()} POIs
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${barPct}%`,
                                backgroundColor: CHART_COLOR_LIST[i % CHART_COLOR_LIST.length],
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums shrink-0">
                          {barPct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ETL Collection Configuration */}
          <Card>
            <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  ETL Collection Config
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lat/lon boundaries and radius used during OSM collection
                </p>
              </div>
              {etlOnline && (
                <button
                  onClick={() => setShowCityForm((v) => !v)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-primary text-white hover:opacity-90 transition-opacity shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add City
                </button>
              )}
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {/* ETL offline notice */}
              {!etlOnline && !etlLoading && (
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border mb-3">
                  <WifiOff className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    ETL service is offline. Start the <strong>ETL Service</strong> workflow to view and manage collection configuration.
                  </p>
                </div>
              )}

              {/* Add city form */}
              {etlOnline && showCityForm && (
                <div className="mb-4 p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                  <p className="text-sm font-medium">New City</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Code (e.g. "hue")</label>
                      <input value={newCity.code} onChange={(e) => setNewCity((p) => ({ ...p, code: e.target.value }))}
                        placeholder="hue" className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Local Name</label>
                      <input value={newCity.name} onChange={(e) => setNewCity((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Hue" className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">English Name</label>
                      <input value={newCity.nameEn} onChange={(e) => setNewCity((p) => ({ ...p, nameEn: e.target.value }))}
                        placeholder="Hue" className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
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
                    {savedCity && <SavedBadge />}
                  </div>
                </div>
              )}

              {/* ETL cities table */}
              {etlLoading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : etlOnline && mergedCities.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        {["Code", "Name", "Lat / Lon", "Radius", "POIs in DB", ""].map((h) => (
                          <th key={h} className="text-left text-xs font-medium text-muted-foreground px-3 py-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mergedCities.map((c) => (
                        <tr key={c.code} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2 font-mono text-xs font-medium">{c.code}</td>
                          <td className="px-3 py-2">
                            <div className="text-xs font-medium">{formatCityName(c.nameEn || c.name, c.code)}</div>
                            {c.name && c.name !== c.nameEn && (
                              <div className="text-xs text-muted-foreground">{formatCityName(c.name, c.code)}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                            {c.lat}, {c.lon}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{c.radius_km} km</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-medium tabular-nums ${c.poiCount > 0 ? "text-primary" : "text-muted-foreground"}`}>
                              {c.poiCount > 0 ? c.poiCount.toLocaleString() : "—"}
                            </span>
                          </td>
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
              ) : etlOnline ? (
                <p className="text-center py-8 text-sm text-muted-foreground">No city configs found in ETL service.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === "categories" && (
        <div className="space-y-4">

          {/* Database Snapshot — always visible */}
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Categories in MongoDB
                <span className="ml-auto text-xs text-muted-foreground font-normal">from Gold layer · live</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {(catDbData ?? []).length} active categories across all cities
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {catsDbLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(catDbData ?? []).map((c, i) => {
                    const barPct = (c.count / maxCatCount) * 100;
                    return (
                      <div key={c.category} className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: CHART_COLOR_LIST[i % CHART_COLOR_LIST.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-medium capitalize">{c.category}</span>
                            <span className="text-muted-foreground tabular-nums">{c.count.toLocaleString()}</span>
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${barPct}%`,
                                backgroundColor: CHART_COLOR_LIST[i % CHART_COLOR_LIST.length],
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ETL Category Configuration */}
          <Card>
            <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  ETL Category Config
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  OSM tags used to query OpenStreetMap for each category
                </p>
              </div>
              {etlOnline && (
                <button
                  onClick={() => setShowCatForm((v) => !v)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-primary text-white hover:opacity-90 transition-opacity shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Category
                </button>
              )}
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {/* ETL offline notice */}
              {!etlOnline && !etlLoading && (
                <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border mb-3">
                  <WifiOff className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    ETL service is offline. Start the <strong>ETL Service</strong> workflow to view and manage collection configuration.
                  </p>
                </div>
              )}

              {/* Add category form */}
              {etlOnline && showCatForm && (
                <div className="mb-4 p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                  <p className="text-sm font-medium">New Category</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Code (e.g. "temple")</label>
                      <input value={newCat.code} onChange={(e) => setNewCat((p) => ({ ...p, code: e.target.value }))}
                        placeholder="temple" className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Label</label>
                      <input value={newCat.label} onChange={(e) => setNewCat((p) => ({ ...p, label: e.target.value }))}
                        placeholder="Temple / Pagoda" className="w-full h-8 rounded border border-input bg-background px-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">OSM Tags</label>
                    <div className="space-y-2">
                      {newCat.tags.map((t, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            value={t.key}
                            onChange={(e) => setNewCat((p) => ({ ...p, tags: p.tags.map((tt, ii) => ii === i ? { ...tt, key: e.target.value } : tt) }))}
                            placeholder="amenity"
                            className="w-28 h-7 rounded border border-input bg-background px-2 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">=</span>
                          <input
                            value={t.value}
                            onChange={(e) => setNewCat((p) => ({ ...p, tags: p.tags.map((tt, ii) => ii === i ? { ...tt, value: e.target.value } : tt) }))}
                            placeholder="place_of_worship"
                            className="flex-1 h-7 rounded border border-input bg-background px-2 text-xs"
                          />
                          {newCat.tags.length > 1 && (
                            <button onClick={() => setNewCat((p) => ({ ...p, tags: p.tags.filter((_, ii) => ii !== i) }))}>
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => setNewCat((p) => ({ ...p, tags: [...p.tags, { key: "amenity", value: "" }] }))}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
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
                    {savedCat && <SavedBadge />}
                  </div>
                </div>
              )}

              {/* ETL categories list */}
              {etlLoading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : etlOnline && mergedCats.length > 0 ? (
                <div className="space-y-2">
                  {mergedCats.map((c) => (
                    <div
                      key={c.code}
                      className="flex items-start justify-between p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-medium">{c.code}</span>
                          {c.label && c.label !== c.code && (
                            <span className="text-xs text-muted-foreground">({c.label})</span>
                          )}
                          {c.poiCount > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                              {c.poiCount.toLocaleString()} POIs
                            </span>
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
                      <button
                        onClick={() => deleteCat(c.code)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors flex-shrink-0 ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : etlOnline ? (
                <p className="text-center py-8 text-sm text-muted-foreground">No category configs found in ETL service.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
