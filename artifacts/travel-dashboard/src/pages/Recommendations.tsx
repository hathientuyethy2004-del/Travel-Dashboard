import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useGetRecommendations, useGetCities, useGetCityHighlights } from "@workspace/api-client-react";
import { CSVLink } from "react-csv";
import { Star, MapPin, Download, ExternalLink, Phone, Globe, Award, Eye, TrendingUp, Sparkles, Shuffle } from "lucide-react";
import { CHART_COLOR_LIST, CHART_COLORS } from "@/lib/constants";
import { useTheme } from "@/lib/theme-provider";

const MODES = [
  { value: "top_rated",       label: "Top Rated",       icon: Star,      desc: "Highest rated POIs (≥5 reviews)" },
  { value: "hidden_gems",     label: "Hidden Gems",      icon: Sparkles,  desc: "High rating but fewer known reviews" },
  { value: "highly_reviewed", label: "Most Reviewed",    icon: Eye,       desc: "Places with the most user reviews" },
  { value: "best_quality",    label: "Best Quality",     icon: Award,     desc: "Highest data quality score" },
  { value: "multi_source",    label: "Multi-Source",     icon: TrendingUp,desc: "POIs verified by both OSM & Google" },
  { value: "random",          label: "Discover",         icon: Shuffle,   desc: "Random selection — surprise me!" },
];

const CATS = ["", "restaurant", "cafe", "bar", "hotel", "attraction", "park", "shopping"];

function QualityDot({ score }: { score: number | null | undefined }) {
  const color = !score ? "#94a3b8" : score >= 0.7 ? CHART_COLORS.green : score >= 0.4 ? CHART_COLORS.orange : CHART_COLORS.red;
  return <span className="inline-flex items-center gap-1 text-xs" style={{ color }}>
    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
    {score != null ? `${(score * 100).toFixed(0)}%` : "—"}
  </span>;
}

export default function Recommendations() {
  const { isDark } = useTheme();
  const [mode, setMode] = useState("top_rated");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(20);

  const { data: citiesData } = useGetCities();
  const { data: recs, isLoading } = useGetRecommendations(
    { mode, city: city || undefined, category: category || undefined, limit },
    { query: { keepPreviousData: true } }
  );
  const { data: highlights, isLoading: hLoading } = useGetCityHighlights();

  const pois = recs?.pois ?? [];

  return (
    <div className="px-6 pt-6 pb-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="font-bold text-2xl">Recommendations</h1>
        <p className="text-muted-foreground text-sm mt-1">Smart POI recommendations from 9,284 gold-layer points of interest</p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {MODES.map(({ value, label, icon: Icon, desc }) => (
          <button key={value} onClick={() => setMode(value)}
            className={`p-3 rounded-xl border-2 text-left transition-all ${mode === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}>
            <Icon className={`w-5 h-5 mb-1.5 ${mode === value ? "text-primary" : "text-muted-foreground"}`} />
            <p className={`text-xs font-medium ${mode === value ? "text-primary" : ""}`}>{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-tight hidden lg:block">{desc}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">City</label>
          <select value={city} onChange={(e) => setCity(e.target.value)}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All Cities</option>
            {(citiesData ?? []).map((c) => <option key={c.cityCode} value={c.cityCode}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm">
            {CATS.map((c) => <option key={c} value={c}>{c ? c.charAt(0).toUpperCase() + c.slice(1) : "All"}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Limit: {limit}</label>
          <input type="range" min={5} max={50} step={5} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-32" />
        </div>
        {!isLoading && pois.length > 0 && (
          <CSVLink data={pois} filename={`recs-${mode}.csv`}
            className="ml-auto flex items-center gap-1.5 h-9 px-3 rounded-md text-sm hover:opacity-80 transition-opacity"
            style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
            <Download className="w-3.5 h-3.5" /> Export
          </CSVLink>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* POI Cards */}
        <div className="xl:col-span-3">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
            </div>
          ) : pois.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No POIs found for this combination. Try changing filters!</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pois.map((poi, idx) => (
                <div key={poi.poiId} className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground font-mono mt-0.5 w-5 shrink-0">{idx + 1}.</span>
                      <div>
                        <p className="font-medium text-sm leading-tight">{poi.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{poi.cityName}</span>
                          <Badge variant="secondary" className="text-xs capitalize h-4 px-1.5">{poi.category}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {poi.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-semibold">{poi.rating.toFixed(1)}</span>
                        </div>
                      )}
                      {poi.reviewCount && <p className="text-xs text-muted-foreground">{poi.reviewCount.toLocaleString()} reviews</p>}
                    </div>
                  </div>

                  {poi.address && (
                    <p className="text-xs text-muted-foreground mb-2 ml-7 truncate">{poi.address}</p>
                  )}

                  <div className="flex items-center gap-3 ml-7">
                    <QualityDot score={poi.qualityScore} />
                    <div className="flex items-center gap-1">
                      {(poi.dataSources ?? []).map((s) => (
                        <span key={s} className={`text-xs px-1.5 py-0.5 rounded ${s === "osm" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{s.toUpperCase()}</span>
                      ))}
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      {poi.phone && <a href={`tel:${poi.phone}`} className="p-1 hover:bg-muted rounded transition-colors"><Phone className="w-3 h-3 text-muted-foreground" /></a>}
                      {poi.website && <a href={poi.website} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-muted rounded transition-colors"><Globe className="w-3 h-3 text-muted-foreground" /></a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* City highlights sidebar */}
        <div className="xl:col-span-1">
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">City Highlights</CardTitle>
              <p className="text-xs text-muted-foreground">Best rated city + top POI</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {hLoading ? <Skeleton className="h-48" /> : (
                <div className="space-y-3">
                  {(highlights ?? []).map((h, i) => (
                    <div key={h.city} className="p-2.5 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: CHART_COLOR_LIST[i % CHART_COLOR_LIST.length] }}>{i + 1}</div>
                          <p className="text-xs font-medium">{h.cityName}</p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-medium">{h.avgRating}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6.5">{h.totalPois} POIs</p>
                      {h.topPoi && (
                        <div className="ml-6.5 mt-1 p-1.5 rounded bg-muted/30">
                          <p className="text-xs font-medium truncate">{h.topPoi.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{h.topPoi.category} · ★{h.topPoi.rating?.toFixed(1)}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
