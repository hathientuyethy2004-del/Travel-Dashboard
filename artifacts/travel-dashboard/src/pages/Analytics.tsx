import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetAnalyticsTemporal,
  useGetAnalyticsSources,
  useGetAnalyticsQualityTiers,
  useGetAnalyticsCityCategoryMatrix,
} from "@workspace/api-client-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { CSVLink } from "react-csv";
import { Download } from "lucide-react";
import { CHART_COLORS, CHART_COLOR_LIST } from "@/lib/constants";
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

export default function Analytics() {
  const { isDark } = useTheme();
  const { data: temporal, isLoading: tLoading } = useGetAnalyticsTemporal();
  const { data: sources, isLoading: sLoading } = useGetAnalyticsSources();
  const { data: tiers, isLoading: tiersLoading } = useGetAnalyticsQualityTiers();
  const { data: matrix, isLoading: mLoading } = useGetAnalyticsCityCategoryMatrix();

  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e5e5";
  const tickColor = isDark ? "#98999C" : "#71717a";

  const sourcesData = sources ? [
    { name: "OSM Only", value: sources.osmOnly, fill: CHART_COLORS.orange },
    { name: "Google Only", value: sources.googleOnly, fill: CHART_COLORS.blue },
    { name: "Both", value: sources.both, fill: CHART_COLORS.green },
  ] : [];

  // Build city×category heatmap data
  const cities = [...new Set((matrix ?? []).map((r) => r.city))];
  const categories = [...new Set((matrix ?? []).map((r) => r.category))];
  const matrixMap: Record<string, number> = {};
  (matrix ?? []).forEach((r) => { matrixMap[`${r.city}__${r.category}`] = r.count; });

  const topCityCategory = (matrix ?? []).slice().sort((a, b) => b.count - a.count).slice(0, 15);

  return (
    <div className="px-6 pt-6 pb-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="font-bold text-2xl">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Deep analysis of data pipeline, sources, quality, and spatial coverage</p>
      </div>

      {/* Source breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-1">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">Data Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {sLoading ? <Skeleton className="h-[220px]" /> : (
              <>
                <ResponsiveContainer width="100%" height={160} debounce={0}>
                  <PieChart>
                    <Pie data={sourcesData} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="value" paddingAngle={3}>
                      {sourcesData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {sourcesData.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                        <span className="text-muted-foreground text-xs">{s.name}</span>
                      </div>
                      <span className="font-medium text-xs">{s.value?.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm border-t border-border pt-1.5 mt-1.5">
                    <span className="text-xs text-muted-foreground">Total Bronze</span>
                    <span className="font-medium text-xs">{sources?.total?.toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">Quality Tiers (Gold Layer)</CardTitle>
          </CardHeader>
          <CardContent>
            {tiersLoading ? <Skeleton className="h-[220px]" /> : (
              <ResponsiveContainer width="100%" height={220} debounce={0}>
                <BarChart data={tiers ?? []} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="tier" tick={{ fontSize: 10, fill: tickColor }} />
                  <YAxis tick={{ fontSize: 11, fill: tickColor }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                    {(tiers ?? []).map((_, i) => <Cell key={i} fill={CHART_COLOR_LIST[i % CHART_COLOR_LIST.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Data quality questions answered */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">Platform FAQ</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {[
                { q: "Where does data come from?", a: "OSM Overpass API + Google Places (RapidAPI)" },
                { q: "How is it processed?", a: "Bronze → Silver (normalize) → Gold (dedup + promote)" },
                { q: "Where is it stored?", a: "MongoDB Atlas — smart_travel_platform database" },
                { q: "How is quality scored?", a: "0.3 (OSM) + 0.3 (Google) + rating/5 × 0.2 + address 0.1 + name 0.1" },
                { q: "How are duplicates handled?", a: "Unified u_key dedup across all layers; ghost records removed by reconcile stage" },
                { q: "Is data traceable?", a: "Yes — bronze_ref → silver_ref → gold lineage per record" },
                { q: "Is the pipeline monitored?", a: "Yes — etl_jobs + pipeline_executions collections track every run" },
                { q: "Is it extensible?", a: "Yes — add cities/categories to config and re-run the pipeline" },
                { q: "Is quality enforced?", a: "Yes — quality_score gate at Silver → Gold; low-quality records quarantined" },
                { q: "Is there data lineage?", a: "Yes — data_lineage_edges collection records every promotion" },
              ].map(({ q, a }) => (
                <div key={q} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: CHART_COLORS.teal }} />
                  <div>
                    <p className="text-xs font-medium">{q}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Temporal series */}
      <Card className="mb-4">
        <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Data Collection Timeline (by Layer)</CardTitle>
          {!tLoading && temporal && (
            <CSVLink data={temporal} filename="temporal-series.csv"
              className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
              <Download className="w-3.5 h-3.5" />
            </CSVLink>
          )}
        </CardHeader>
        <CardContent>
          {tLoading ? <Skeleton className="h-[240px] w-full" /> : (temporal?.length ?? 0) === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
              Temporal data not available — dates may not be recorded yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240} debounce={0}>
              <AreaChart data={temporal ?? []} margin={{ left: 0, right: 20 }}>
                <defs>
                  {[["bronze", CHART_COLORS.orange], ["silver", "#94a3b8"], ["gold", "#eab308"]].map(([key, color]) => (
                    <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: tickColor }} />
                <YAxis tick={{ fontSize: 11, fill: tickColor }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(v) => <span style={{ fontSize: 12, color: tickColor }}>{v}</span>} />
                <Area type="monotone" dataKey="bronze" name="Bronze" stroke={CHART_COLORS.orange} fill={`url(#grad-bronze)`} strokeWidth={2} />
                <Area type="monotone" dataKey="silver" name="Silver" stroke="#94a3b8" fill={`url(#grad-silver)`} strokeWidth={2} />
                <Area type="monotone" dataKey="gold" name="Gold" stroke="#eab308" fill={`url(#grad-gold)`} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* City × Category Heatmap */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">POI Coverage — City × Category (Top 15)</CardTitle>
          {!mLoading && matrix && (
            <CSVLink data={topCityCategory} filename="city-category.csv"
              className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] hover:opacity-80"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
              <Download className="w-3.5 h-3.5" />
            </CSVLink>
          )}
        </CardHeader>
        <CardContent>
          {mLoading ? <Skeleton className="h-[200px] w-full" /> : (
            <ResponsiveContainer width="100%" height={240} debounce={0}>
              <BarChart data={topCityCategory} layout="vertical" margin={{ left: 20, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: tickColor }} />
                <YAxis type="category" dataKey="cityName" tick={{ fontSize: 11, fill: tickColor }} width={90}
                  tickFormatter={(v, i) => `${v} / ${topCityCategory[i]?.category ?? ""}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="POI Count" radius={[0, 4, 4, 0]}>
                  {topCityCategory.map((_, i) => <Cell key={i} fill={CHART_COLOR_LIST[i % CHART_COLOR_LIST.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
