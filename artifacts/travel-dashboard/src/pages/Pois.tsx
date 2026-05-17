import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useGetPois,
  useGetCities,
  useGetTopRatedPois,
} from "@workspace/api-client-react";
import { CSVLink } from "react-csv";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Search, Star, MapPin, ExternalLink } from "lucide-react";
import { CHART_COLORS } from "@/lib/constants";
import { useTheme } from "@/lib/theme-provider";

const CATEGORIES = ["restaurant", "attraction", "hotel", "cafe", "shopping", "entertainment", "park"];
const PAGE_SIZE = 20;

function StarRating({ rating }: { rating: number | null | undefined }) {
  if (!rating) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

function QualityBar({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = (score * 100).toFixed(0);
  const color = score >= 0.7 ? CHART_COLORS.green : score >= 0.4 ? CHART_COLORS.orange : CHART_COLORS.red;
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

export default function Pois() {
  const { isDark } = useTheme();
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);

  const { data: citiesData } = useGetCities();
  const { data: poisData, isLoading, isFetching } = useGetPois(
    { city: selectedCity || undefined, category: selectedCategory || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }
  );
  const { data: topRated } = useGetTopRatedPois(
    { city: selectedCity || undefined, category: selectedCategory || undefined, limit: 5 }
  );

  const loading = isLoading || isFetching;
  const pois = poisData?.pois ?? [];
  const total = poisData?.total ?? 0;
  const cities = citiesData ?? [];
  const top5 = topRated ?? [];

  const filtered = useMemo(() => {
    if (!searchQuery) return pois;
    const q = searchQuery.toLowerCase();
    return pois.filter((p) => p.name.toLowerCase().includes(q) || (p.address ?? "").toLowerCase().includes(q));
  }, [pois, searchQuery]);

  function handleFilter() {
    setPage(0);
  }

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
            <p className="text-muted-foreground text-[14px] mt-1">Browse and filter {total.toLocaleString()} gold-layer points of interest</p>
          </div>
          {!loading && filtered.length > 0 && (
            <CSVLink data={filtered} filename="pois-export.csv"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors hover:opacity-80 print:hidden"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
              <Download className="w-4 h-4" />
              Export CSV
            </CSVLink>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="w-[200px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">City</label>
                <select value={selectedCity} onChange={(e) => { setSelectedCity(e.target.value); handleFilter(); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">All Cities</option>
                  {cities.map((c) => <option key={c.cityCode} value={c.cityCode}>{c.name}</option>)}
                </select>
              </div>
              <div className="w-[180px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); handleFilter(); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">All Categories</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="w-[240px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or address..."
                    className="w-full h-9 rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {loading ? "Loading..." : `${filtered.length} of ${total.toLocaleString()} shown`}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Top Rated Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="text-base">
                  {top5.length > 0 && top5[0]?.rating ? "Top Rated" : "Top Quality"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-3">
                  {top5.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Loading best POIs…</p>
                  ) : top5.map((p, i) => (
                    <div key={p.poiId} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-4 mt-0.5">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {p.rating ? (
                            <>
                              <StarRating rating={p.rating} />
                              {p.reviewCount && (
                                <span className="text-xs text-muted-foreground">({p.reviewCount.toLocaleString()})</span>
                              )}
                            </>
                          ) : p.qualityScore != null ? (
                            <span className="text-xs text-muted-foreground">Quality {(p.qualityScore * 100).toFixed(0)}%</span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{p.cityName}</p>
                      </div>
                    </div>
                  ))}
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
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <MapPin className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">No POIs found</p>
                    <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {["Name", "City", "Category", "Rating", "Reviews", "Quality", "Address"].map((h) => (
                            <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((p) => (
                          <tr key={p.poiId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-sm max-w-[180px] truncate">{p.name}</p>
                                {p.website && (
                                  <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-0.5 hover:underline">
                                    <ExternalLink className="w-2.5 h-2.5" /> website
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{p.cityName}</td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary" className="text-xs capitalize">{p.category}</Badge>
                            </td>
                            <td className="px-4 py-3"><StarRating rating={p.rating} /></td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {p.reviewCount ? p.reviewCount.toLocaleString() : "—"}
                            </td>
                            <td className="px-4 py-3"><QualityBar score={p.qualityScore} /></td>
                            <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{p.address ?? "—"}</td>
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
              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <span>Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
                <div className="flex gap-2">
                  <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors">
                    Previous
                  </button>
                  <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors">
                    Next
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
