import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetAnalyticsCityCategoryMatrix,
  useGetPipelineFunnel,
  useGetQualityDistribution,
  useGetDashboardOverview,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { CSVLink } from "react-csv";
import { Download, MapPin, Phone, Globe, Star, Database, AlertTriangle } from "lucide-react";
import { CHART_COLORS, CHART_COLOR_LIST, formatNumber } from "@/lib/constants";
import { useTheme } from "@/lib/theme-provider";

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-sm shadow-lg">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

const QUALITY_COLORS: Record<string, string> = {
  "0.0-0.2": CHART_COLORS.red,
  "0.2-0.4": CHART_COLORS.orange,
  "0.4-0.6": "#eab308",
  "0.6-0.8": CHART_COLORS.teal,
  "0.8-1.0": CHART_COLORS.green,
};

export default function Analytics() {
  const { isDark } = useTheme();
  const { data: funnel, isLoading: funnelLoading } = useGetPipelineFunnel();
  const { data: qualDist, isLoading: qualLoading } = useGetQualityDistribution();
  const { data: overview, isLoading: ovLoading } = useGetDashboardOverview();
  const { data: matrix, isLoading: mLoading } = useGetAnalyticsCityCategoryMatrix();

  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e5e5";
  const tickColor = isDark ? "#98999C" : "#71717a";

  // Pipeline funnel data
  const funnelData = funnel ? [
    { name: "Bronze", value: funnel.bronze ?? 0, fill: CHART_COLORS.orange, desc: "Raw collected POIs" },
    { name: "Silver", value: funnel.silver ?? 0, fill: "#94a3b8", desc: "Normalized + quality scored" },
    { name: "Gold", value: funnel.gold ?? 0, fill: "#eab308", desc: "Quality ≥ 0.3, deduped" },
    { name: "Quarantine", value: funnel.quarantine ?? 0, fill: CHART_COLORS.red, desc: "Failed quality rules" },
  ] : [];
  const bronzeTotal = funnel?.bronze ?? 1;

  // Quality distribution — drop zero-count buckets for cleaner chart
  const qualData = (qualDist ?? []).filter((d) => d.count > 0);
  const qualTotal = qualData.reduce((s, d) => s + d.count, 0);

  // Field coverage from overview
  const gold = overview?.goldPois ?? 0;
  const coverageFields = overview ? [
    { label: "Has Address", value: overview.withAddress, icon: MapPin, color: CHART_COLORS.teal },
    { label: "Has Phone", value: overview.withPhone, icon: Phone, color: CHART_COLORS.green },
    { label: "Has Website", value: overview.withWebsite, icon: Globe, color: CHART_COLORS.purple },
    {
      label: "Has Rating",
      value: (qualDist ?? []).reduce((s, d) => s + d.count, 0) > 0
        ? Math.round((overview.avgRating > 0 ? gold * 0.1 : 0))
        : 0,
      icon: Star,
      color: "#eab308",
    },
  ] : [];

  // City totals from matrix
  const cityTotals = (() => {
    const map: Record<string, { cityName: string; count: number }> = {};
    (matrix ?? []).forEach((r) => {
      if (!map[r.city]) map[r.city] = { cityName: r.cityName ?? r.city, count: 0 };
      map[r.city].count += r.count;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  })();

  // Top city×category pairs
  const topCityCategory = (matrix ?? []).slice().sort((a, b) => b.count - a.count).slice(0, 12);

  return (
    <div className="px-6 pt-6 pb-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="font-bold text-2xl">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pipeline health, quality scores, field coverage, and spatial distribution
        </p>
      </div>

      {/* ── Row 1: Pipeline Funnel · Quality Distribution · Field Coverage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Pipeline Funnel */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">Pipeline Funnel</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Data flow from collection to Gold layer</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {funnelLoading ? <Skeleton className="h-[200px]" /> : (
              <div className="space-y-3 mt-1">
                {funnelData.map((stage) => {
                  const pct = bronzeTotal > 0 ? (stage.value / bronzeTotal) * 100 : 0;
                  return (
                    <div key={stage.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.fill }} />
                          <span className="text-sm font-medium">{stage.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                          <span className="text-sm font-semibold tabular-nums">{stage.value.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: stage.fill }} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{stage.desc}</p>
                    </div>
                  );
                })}
                {funnel && (
                  <div className="pt-2 mt-1 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>Bronze → Gold retention</span>
                    <span className="font-semibold text-foreground">
                      {bronzeTotal > 0 ? (((funnel.gold ?? 0) / bronzeTotal) * 100).toFixed(1) : "0"}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quality Score Distribution */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">Quality Score Distribution</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Gold POIs scored 0–1 by completeness &amp; source</p>
          </CardHeader>
          <CardContent>
            {qualLoading ? <Skeleton className="h-[200px]" /> : qualData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">No quality data yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={170} debounce={0}>
                  <BarChart data={qualData} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: tickColor }} />
                    <YAxis tick={{ fontSize: 11, fill: tickColor }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="POIs" radius={[4, 4, 0, 0]}>
                      {qualData.map((d) => (
                        <Cell key={d.range} fill={QUALITY_COLORS[d.range] ?? CHART_COLORS.blue} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {qualData.map((d) => {
                    const pct = qualTotal > 0 ? ((d.count / qualTotal) * 100).toFixed(0) : "0";
                    return (
                      <div key={d.range} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: QUALITY_COLORS[d.range] ?? CHART_COLORS.blue }} />
                          <span className="text-muted-foreground">Score {d.range}</span>
                        </div>
                        <span className="font-medium">{d.count.toLocaleString()} <span className="text-muted-foreground">({pct}%)</span></span>
                      </div>
                    );
                  })}
                  <div className="pt-1.5 mt-1 border-t border-border flex justify-between text-xs text-muted-foreground">
                    <span>Avg quality score</span>
                    <span className="font-semibold text-foreground">
                      {ovLoading ? "…" : (overview?.avgQualityScore ?? 0).toFixed(3)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Field Coverage */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">Field Coverage</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Completeness across {ovLoading ? "…" : formatNumber(gold, "compact")} Gold POIs
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {ovLoading ? <Skeleton className="h-[200px]" /> : (
              <div className="space-y-4 mt-1">
                {[
                  { label: "Has Address", value: overview?.withAddress ?? 0, icon: MapPin, color: CHART_COLORS.teal },
                  { label: "Has Phone", value: overview?.withPhone ?? 0, icon: Phone, color: CHART_COLORS.green },
                  { label: "Has Website", value: overview?.withWebsite ?? 0, icon: Globe, color: CHART_COLORS.purple },
                ].map(({ label, value, icon: Icon, color }) => {
                  const pct = gold > 0 ? (value / gold) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                          <span className="text-sm font-medium">{label}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
                          <span className="text-xs text-muted-foreground ml-1.5">{value.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}

                {/* Missing data callout */}
                <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-xs font-medium">OSM-only data</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        No Google Places enrichment yet. Running the enrichment pipeline will boost address, phone &amp; website coverage significantly.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3 h-3" />
                    <span>No-contact POIs</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {(gold - (overview?.withPhone ?? 0) - (overview?.withWebsite ?? 0) + Math.min(overview?.withPhone ?? 0, overview?.withWebsite ?? 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: POIs by City ── */}
      <Card className="mb-4">
        <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Gold POIs by City</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Total quality-approved POIs per Vietnamese city</p>
          </div>
          {!mLoading && cityTotals.length > 0 && (
            <CSVLink data={cityTotals} filename="pois-by-city.csv"
              className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] hover:opacity-80"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
              <Download className="w-3.5 h-3.5" />
            </CSVLink>
          )}
        </CardHeader>
        <CardContent>
          {mLoading ? <Skeleton className="h-[280px] w-full" /> : cityTotals.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">No city data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280} debounce={0}>
              <BarChart data={cityTotals} layout="vertical" margin={{ left: 10, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: tickColor }} />
                <YAxis type="category" dataKey="cityName" tick={{ fontSize: 12, fill: tickColor }} width={110} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Gold POIs" radius={[0, 4, 4, 0]}>
                  {cityTotals.map((_, i) => (
                    <Cell key={i} fill={CHART_COLOR_LIST[i % CHART_COLOR_LIST.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Row 3: City × Category Top 12 ── */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Top City × Category Combos</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Highest POI-count city/category pairs</p>
          </div>
          {!mLoading && topCityCategory.length > 0 && (
            <CSVLink data={topCityCategory} filename="city-category.csv"
              className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] hover:opacity-80"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
              <Download className="w-3.5 h-3.5" />
            </CSVLink>
          )}
        </CardHeader>
        <CardContent>
          {mLoading ? <Skeleton className="h-[260px] w-full" /> : (
            <ResponsiveContainer width="100%" height={260} debounce={0}>
              <BarChart data={topCityCategory} layout="vertical" margin={{ left: 10, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: tickColor }} />
                <YAxis
                  type="category"
                  dataKey="cityName"
                  tick={{ fontSize: 11, fill: tickColor }}
                  width={115}
                  tickFormatter={(v, i) => `${v} / ${topCityCategory[i]?.category ?? ""}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="POI Count" radius={[0, 4, 4, 0]}>
                  {topCityCategory.map((_, i) => (
                    <Cell key={i} fill={CHART_COLOR_LIST[i % CHART_COLOR_LIST.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
