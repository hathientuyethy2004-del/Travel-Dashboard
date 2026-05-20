import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  useGetPois,
  useGetCities,
  useGetTopRatedPois,
  useGetPoiByCategory,
} from "@workspace/api-client-react";
import { CSVLink } from "react-csv";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Download, Search, Star, MapPin, ExternalLink,
  Phone, Globe, ArrowUpDown, X,
} from "lucide-react";
import { CHART_COLORS, formatCityName } from "@/lib/constants";
import { useTheme } from "@/lib/theme-provider";

const PAGE_SIZE = 20;

function QualityBar({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(score * 100);
  const color = score >= 0.5 ? CHART_COLORS.teal : score >= 0.4 ? CHART_COLORS.orange : CHART_COLORS.red;
  return (
    <div className="flex items-center gap-2 min-w-[88px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-8 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

function ContactCell({ phone, website }: { phone?: string | null; website?: string | null }) {
  const hasPhone = !!phone;
  const hasWebsite = !!website;
  return (
    <div className="flex items-center gap-2.5">
      {hasPhone ? (
        <a href={`tel:${phone}`} title={phone ?? ""}
          className="flex items-center justify-center w-6 h-6 rounded-md bg-green-50 dark:bg-green-900/20 hover:bg-green-100 transition-colors">
          <Phone className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        </a>
      ) : (
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted/50">
          <Phone className="w-3.5 h-3.5 text-muted-foreground/25" />
        </div>
      )}
      {hasWebsite ? (
        <a href={website ?? "#"} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 transition-colors">
          <Globe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        </a>
      ) : (
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted/50">
          <Globe className="w-3.5 h-3.5 text-muted-foreground/25" />
        </div>
      )}
    </div>
  );
}

export default function Pois() {
  const { isDark } = useTheme();
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("quality");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: citiesData } = useGetCities();
  const { data: categoryData } = useGetPoiByCategory();
  const { data: poisData, isLoading, isFetching } = useGetPois({
    city: selectedCity || undefined,
    category: selectedCategory || undefined,
    search: debouncedSearch || undefined,
    sortBy: sortBy || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const { data: topRated } = useGetTopRatedPois({
    city: selectedCity || undefined,
    category: selectedCategory || undefined,
    limit: 5,
  });

  const loading = isLoading || isFetching;
  const pois = poisData?.pois ?? [];
  const total = poisData?.total ?? 0;
  const cities = citiesData ?? [];
  const categories = (categoryData ?? []).map((c) => c.category).sort((a, b) => a.localeCompare(b));
  const top5 = topRated ?? [];

  const pageStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, total);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!(selectedCity || selectedCategory || debouncedSearch);

  function resetFilters() {
    setSelectedCity(""); setSelectedCategory("");
    setSearchQuery(""); setDebouncedSearch(""); setPage(0);
  }

  const activeCity = formatCityName(cities.find((c) => c.cityCode === selectedCity)?.name, selectedCity);

  return (
    <div className="min-h-screen bg-background px-6 pt-8 pb-8">
      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link href="/">
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
            </Link>
            <h1 className="font-bold text-[32px]">POI Explorer</h1>
            <p className="text-muted-foreground text-[14px] mt-1">
              Browse and filter {total > 0 ? total.toLocaleString() : "15,253"} gold-layer points of interest
            </p>
          </div>
          {!loading && pois.length > 0 && (
            <CSVLink data={pois} filename="pois-export.csv"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors hover:opacity-80 print:hidden"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
              <Download className="w-4 h-4" />
              Export CSV
            </CSVLink>
          )}
        </div>

        {/* Filter + Sort Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="w-[180px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">City</label>
                <select value={selectedCity} onChange={(e) => { setSelectedCity(e.target.value); setPage(0); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">All Cities</option>
                  {cities.map((c) => <option key={c.cityCode} value={c.cityCode}>{formatCityName(c.name, c.cityCode)}</option>)}
                </select>
              </div>
              <div className="w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setPage(0); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">All Categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="w-[260px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or address…"
                    className="w-full h-9 rounded-md border border-input bg-background pl-8 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5">
                      <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              </div>
              <div className="w-[150px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort by</label>
                <div className="relative">
                  <ArrowUpDown className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(0); }}
                    className="w-full h-9 rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="quality">Quality ↓</option>
                    <option value="name">Name A–Z</option>
                    <option value="city">City A–Z</option>
                  </select>
                </div>
              </div>
              <div className="flex items-end gap-2 ml-auto">
                {hasFilters && (
                  <button onClick={resetFilters}
                    className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
                <p className="text-xs text-muted-foreground pb-1">
                  {loading ? "Loading…" : total === 0 ? "No results" :
                    `${pageStart.toLocaleString()}–${pageEnd.toLocaleString()} of ${total.toLocaleString()}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="text-sm font-semibold">
                  {top5.length > 0 && top5[0]?.rating ? "Top Rated" : "Top Quality"}
                </CardTitle>
                {hasFilters && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[activeCity, selectedCategory ? selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1) : null, debouncedSearch ? `"${debouncedSearch}"` : null]
                      .filter(Boolean).join(" · ")}
                  </p>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-4">
                  {top5.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : top5.map((p, i) => (
                    <div key={p.poiId} className="flex gap-2.5">
                      <span className="text-xs font-bold text-muted-foreground w-4 mt-0.5 shrink-0">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{p.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <Badge variant="secondary" className="text-[10px] capitalize px-1.5 py-0 h-4">{p.category}</Badge>
                          {p.rating ? (
                            <span className="flex items-center gap-0.5 text-xs text-yellow-500">
                              <Star className="w-3 h-3 fill-yellow-400" />
                              {p.rating.toFixed(1)}
                              {p.reviewCount != null && (
                                <span className="text-muted-foreground ml-0.5">({p.reviewCount.toLocaleString()})</span>
                              )}
                            </span>
                          ) : p.qualityScore != null ? (
                            <span className="text-xs text-muted-foreground">Q: {(p.qualityScore * 100).toFixed(0)}%</span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{formatCityName(p.cityName, p.city)}</p>
                        {p.address && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-start gap-0.5">
                            <MapPin className="w-2.5 h-2.5 mt-0.5 text-teal-500 shrink-0" />
                            {p.address}
                          </p>
                        )}
                        {(p.phone || p.website) && (
                          <div className="flex items-center gap-2 mt-1.5">
                            {p.phone && (
                              <a href={`tel:${p.phone}`}
                                className="flex items-center gap-0.5 text-[11px] text-green-600 dark:text-green-400 hover:underline truncate max-w-[120px]"
                                title={p.phone}>
                                <Phone className="w-2.5 h-2.5 shrink-0" />
                                {p.phone}
                              </a>
                            )}
                            {p.website && (
                              <a href={p.website} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-[11px] text-purple-600 dark:text-purple-400 hover:underline">
                                <Globe className="w-2.5 h-2.5 shrink-0" />
                                website
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Legend card */}
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact column</p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-green-50 dark:bg-green-900/20">
                      <Phone className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <span>Phone on record</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted/50">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground/25" />
                    </div>
                    <span className="text-muted-foreground">No phone data</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-1">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-50 dark:bg-purple-900/20">
                      <Globe className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <span>Website available</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted/50">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground/25" />
                    </div>
                    <span className="text-muted-foreground">No website</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Table */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-10 w-full" />
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : pois.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">No POIs found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {hasFilters ? "Try adjusting your filters or search term" : "No data available"}
                    </p>
                    {hasFilters && (
                      <button onClick={resetFilters}
                        className="mt-3 text-xs text-primary hover:underline">
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {["Name", "City", "Category", "Quality", "Address", "Contact"].map((h) => (
                            <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pois.map((p) => (
                          <tr key={p.poiId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-sm max-w-[200px] truncate leading-tight">{p.name}</p>
                              {p.website && (
                                <a href={p.website} target="_blank" rel="noopener noreferrer"
                                  className="text-[11px] text-primary flex items-center gap-0.5 hover:underline mt-0.5">
                                  <ExternalLink className="w-2.5 h-2.5" /> website
                                </a>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatCityName(p.cityName, p.city)}</td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary" className="text-xs capitalize whitespace-nowrap">{p.category}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <QualityBar score={p.qualityScore} />
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px]">
                              {p.address ? (
                                <span className="flex items-start gap-1">
                                  <MapPin className="w-3 h-3 mt-0.5 text-teal-500 shrink-0" />
                                  <span className="truncate">{p.address}</span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <ContactCell phone={p.phone} website={p.website} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground">
                  {pageStart.toLocaleString()}–{pageEnd.toLocaleString()} of {total.toLocaleString()} · Page {page + 1} of {totalPages.toLocaleString()}
                </span>
                <div className="flex gap-1.5">
                  <button disabled={page === 0} onClick={() => setPage(0)}
                    className="px-2 py-1 rounded border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
                    «
                  </button>
                  <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 rounded border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
                    Prev
                  </button>
                  <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 rounded border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
                    Next
                  </button>
                  <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(totalPages - 1)}
                    className="px-2 py-1 rounded border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
