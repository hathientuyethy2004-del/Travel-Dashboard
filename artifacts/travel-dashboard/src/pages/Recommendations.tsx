import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  useGetRecommendations, useGetCities, useGetCityHighlights,
  useGetDashboardOverview, useGetPoiByCategory,
} from "@workspace/api-client-react";
import { GetRecommendationsMode } from "@workspace/api-client-react";
import { CSVLink } from "react-csv";
import {
  MapPin, Phone, Globe, Award, Shuffle, Download,
  CheckCircle2, LayoutGrid, Star, Info, Database,
} from "lucide-react";
import { CHART_COLOR_LIST, CHART_COLORS } from "@/lib/constants";
import { useTheme } from "@/lib/theme-provider";

const MODES = [
  {
    value: "best_quality",
    label: "Best Quality",
    icon: Award,
    desc: "Highest data completeness score",
    color: CHART_COLORS.purple,
  },
  {
    value: "top_rated",
    label: "Has Address",
    icon: MapPin,
    desc: "POIs with verified address — navigable",
    color: CHART_COLORS.teal,
  },
  {
    value: "hidden_gems",
    label: "Has Contact",
    icon: Phone,
    desc: "Phone or website available — bookable",
    color: CHART_COLORS.green,
  },
  {
    value: "highly_reviewed",
    label: "Most Complete",
    icon: CheckCircle2,
    desc: "Address + contact info — fully actionable",
    color: CHART_COLORS.blue,
  },
  {
    value: "multi_source",
    label: "Category Mix",
    icon: LayoutGrid,
    desc: "Best POI from each category — diverse",
    color: CHART_COLORS.orange,
  },
  {
    value: "random",
    label: "Discover",
    icon: Shuffle,
    desc: "Random selection — surprise me!",
    color: "#94a3b8",
  },
];

function QualityBar({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? CHART_COLORS.green : score >= 0.4 ? CHART_COLORS.teal : CHART_COLORS.orange;
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function Recommendations() {
  const { isDark } = useTheme();
  const [mode, setMode] = useState<GetRecommendationsMode>(GetRecommendationsMode.best_quality);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(20);

  const { data: citiesData } = useGetCities();
  const { data: overviewData } = useGetDashboardOverview();
  const { data: categoryData } = useGetPoiByCategory();
  const { data: recs, isLoading } = useGetRecommendations(
    { mode, city: city || undefined, category: category || undefined, limit },
  );
  const { data: highlights, isLoading: hLoading } = useGetCityHighlights();

  const pois = recs?.pois ?? [];
  const activeMode = MODES.find((m) => m.value === mode)!;

  return (
    <div className="px-6 pt-6 pb-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-bold text-2xl">Recommendations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse {overviewData?.goldPois?.toLocaleString() ?? "…"} gold-layer POIs across{" "}
          {overviewData?.cities ?? "…"} Vietnamese cities — filter by completeness, contact, or category
        </p>
      </div>

      {/* OSM data state notice */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 mb-5 text-xs text-amber-800 dark:text-amber-300">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>OSM-only data:</strong> Star ratings &amp; review counts not yet available —
          modes are based on field completeness (address, phone, website) and quality scores.
          Google enrichment will unlock rating-based filtering.
        </span>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
        {MODES.map(({ value, label, icon: Icon, desc, color }) => (
          <button
            key={value}
            onClick={() => setMode(value as GetRecommendationsMode)}
            className={`p-3 rounded-xl border-2 text-left transition-all ${
              mode === value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30 hover:bg-muted/30"
            }`}
          >
            <Icon
              className="w-5 h-5 mb-1.5"
              style={{ color: mode === value ? color : undefined }}
            />
            <p className={`text-xs font-semibold ${mode === value ? "text-primary" : ""}`}>{label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight hidden lg:block">{desc}</p>
          </button>
        ))}
      </div>

      {/* Active mode description */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <activeMode.icon className="w-4 h-4 shrink-0" style={{ color: activeMode.color }} />
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{activeMode.label}:</strong>{" "}
          {activeMode.desc}
          {recs && !isLoading && (
            <span className="ml-2 text-xs">— {recs.count.toLocaleString()} results</span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">City</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-9 w-44 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All Cities</option>
            {(citiesData ?? []).map((c) => (
              <option key={c.cityCode} value={c.cityCode}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All Categories</option>
            {(categoryData ?? []).map((c) => (
              <option key={c.category} value={c.category}>
                {c.category.charAt(0).toUpperCase() + c.category.slice(1)}
                {" "}({c.count.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Limit: {limit}</label>
          <input
            type="range" min={5} max={50} step={5} value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-32"
          />
        </div>
        {!isLoading && pois.length > 0 && (
          <CSVLink
            data={pois}
            filename={`recs-${mode}${city ? `-${city}` : ""}${category ? `-${category}` : ""}.csv`}
            className="ml-auto flex items-center gap-1.5 h-9 px-3 rounded-md text-sm hover:opacity-80 transition-opacity"
            style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}
          >
            <Download className="w-3.5 h-3.5" /> Export
          </CSVLink>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* POI Cards */}
        <div className="xl:col-span-3">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : pois.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No POIs found for this combination. Try changing filters or mode!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pois.map((poi, idx) => (
                <div
                  key={poi.poiId}
                  className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
                >
                  {/* Title row */}
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs text-muted-foreground font-mono mt-0.5 w-5 shrink-0">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">{poi.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">{poi.cityName}</span>
                        <Badge variant="secondary" className="text-xs capitalize h-4 px-1.5">{poi.category}</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  {poi.address ? (
                    <div className="flex items-start gap-1.5 ml-7 mb-2">
                      <MapPin className="w-3 h-3 text-teal-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">{poi.address}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 ml-7 mb-2">
                      <MapPin className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                      <p className="text-xs text-muted-foreground/40 italic">No address</p>
                    </div>
                  )}

                  {/* Footer row */}
                  <div className="flex items-center gap-3 ml-7">
                    <QualityBar score={poi.qualityScore} />

                    {/* Contact chips */}
                    <div className="flex items-center gap-1 ml-auto">
                      {poi.phone ? (
                        <a
                          href={`tel:${poi.phone}`}
                          title={poi.phone}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium transition-colors hover:bg-muted"
                          style={{ color: CHART_COLORS.green }}
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full text-[11px] opacity-25">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                        </span>
                      )}
                      {poi.website ? (
                        <a
                          href={poi.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={poi.website}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium transition-colors hover:bg-muted"
                          style={{ color: CHART_COLORS.purple }}
                        >
                          <Globe className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full text-[11px] opacity-25">
                          <Globe className="w-3 h-3 text-muted-foreground" />
                        </span>
                      )}
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium ml-1"
                        style={{
                          backgroundColor: isDark ? "rgba(249,115,22,0.15)" : "#fff7ed",
                          color: CHART_COLORS.orange,
                        }}
                      >
                        OSM
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* City Overview sidebar */}
        <div className="xl:col-span-1">
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">City Overview</CardTitle>
              <p className="text-xs text-muted-foreground">POI count &amp; data quality per city</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {hLoading ? (
                <Skeleton className="h-64" />
              ) : (
                <div className="space-y-2.5">
                  {(highlights ?? []).map((h, i) => {
                    const qPct = Math.round(h.avgRating * 100);
                    const qColor = h.avgRating >= 0.4 ? CHART_COLORS.teal : CHART_COLORS.orange;
                    return (
                      <div
                        key={h.city}
                        className="p-2.5 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: CHART_COLOR_LIST[i % CHART_COLOR_LIST.length] }}
                          >
                            {i + 1}
                          </div>
                          <p className="text-xs font-semibold truncate flex-1">{h.cityName}</p>
                          <span className="text-xs tabular-nums text-muted-foreground">{h.totalPois.toLocaleString()}</span>
                        </div>

                        {/* Quality bar */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${qPct}%`, backgroundColor: qColor }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums" style={{ color: qColor }}>
                            {qPct}% quality
                          </span>
                        </div>

                        {h.topPoi && (
                          <p className="text-[11px] text-muted-foreground truncate ml-7">
                            <span className="capitalize">{h.topPoi.category}</span>: {h.topPoi.name}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-2 border-t border-border flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Database className="w-3 h-3" />
                    <span>{overviewData?.goldPois?.toLocaleString() ?? "…"} Gold POIs total</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
