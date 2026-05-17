import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useGetDashboardOverview, getGetDashboardOverviewQueryKey,
  useGetPoiByCity, getGetPoiByCityQueryKey,
  useGetPoiByCategory, getGetPoiByCategoryQueryKey,
  useGetPipelineFunnel, getGetPipelineFunnelQueryKey,
  useGetQualityDistribution, getGetQualityDistributionQueryKey,
  useGetRatingDistribution, getGetRatingDistributionQueryKey,
  useGetPipelineExecutions, getGetPipelineExecutionsQueryKey,
  useGetQuarantineReasons, getGetQuarantineReasonsQueryKey,
  useGetAnalyticsCityCategoryMatrix, getGetAnalyticsCityCategoryMatrixQueryKey,
} from "@workspace/api-client-react";
import { CSVLink } from "react-csv";
import {
  BarChart, Bar, LabelList,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, ChevronDown, Check, Sun, Moon, Printer, Download,
  Database, MapPin, AlertTriangle, Star, BarChart2, GitBranch,
  ExternalLink, Filter, Activity, TrendingUp, Award,
  Phone, Globe, CheckCircle2,
} from "lucide-react";
import { CHART_COLORS, CHART_COLOR_LIST, formatNumber } from "@/lib/constants";
import { useTheme } from "@/lib/theme-provider";

const INTERVAL_OPTIONS = [
  { label: "Every 5 min", ms: 5 * 60 * 1000 },
  { label: "Every 15 min", ms: 15 * 60 * 1000 },
  { label: "Every 1 hour", ms: 60 * 60 * 1000 },
  { label: "Every 24 hours", ms: 24 * 60 * 60 * 1000 },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-sm shadow-lg">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{(p.value ?? 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    paused: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}

type Tab = "analytics" | "pipeline";

export default function Dashboard() {
  const { isDark, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("analytics");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedIntervalMs, setSelectedIntervalMs] = useState(5 * 60 * 1000);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: overview, isLoading: ovLoading, isFetching: ovFetching } = useGetDashboardOverview();
  const { data: poiByCity, isLoading: cityLoading } = useGetPoiByCity();
  const { data: poiByCategory, isLoading: catLoading } = useGetPoiByCategory();
  const { data: funnel, isLoading: funnelLoading } = useGetPipelineFunnel();
  const { data: qualityDist, isLoading: qualLoading } = useGetQualityDistribution();
  useGetRatingDistribution();
  const { data: executions, isLoading: execLoading } = useGetPipelineExecutions();
  const { data: quarantineReasons, isLoading: qrLoading } = useGetQuarantineReasons();
  const { data: matrix } = useGetAnalyticsCityCategoryMatrix();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => handleRefresh(), selectedIntervalMs);
    return () => clearInterval(id);
  }, [autoRefresh, selectedIntervalMs]);

  function handleRefresh() {
    setIsSpinning(true);
    [
      getGetDashboardOverviewQueryKey(), getGetPoiByCityQueryKey(),
      getGetPoiByCategoryQueryKey(), getGetPipelineFunnelQueryKey(),
      getGetQualityDistributionQueryKey(), getGetRatingDistributionQueryKey(),
      getGetPipelineExecutionsQueryKey(), getGetQuarantineReasonsQueryKey(),
      getGetAnalyticsCityCategoryMatrixQueryKey(),
    ].forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
    setLastRefreshed(new Date().toLocaleTimeString());
    setTimeout(() => setIsSpinning(false), 1000);
  }

  const loading = ovLoading || ovFetching;

  // Derived filter options
  const allCities = (poiByCity ?? []).map((c) => ({ value: c.city, label: c.cityName ?? c.city }));
  const allCategories = (poiByCategory ?? []).map((c) => ({ value: c.category, label: c.category }));

  // City chart: when category filter active → show per-city counts for that category using matrix
  const cityChartData = (() => {
    if (filterCategory === "all" || !matrix?.length) return poiByCity ?? [];
    const map: Record<string, { city: string; cityName: string; count: number }> = {};
    matrix.filter((r) => r.category === filterCategory).forEach((r) => {
      if (!map[r.city]) map[r.city] = { city: r.city, cityName: r.cityName ?? r.city, count: 0 };
      map[r.city].count += r.count;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  })();

  // Category chart: when city filter active → show per-category counts for that city using matrix
  const rawCatData = (() => {
    if (filterCity === "all" || !matrix?.length) return poiByCategory ?? [];
    return matrix
      .filter((r) => r.city === filterCity)
      .map((r) => ({ category: r.category, count: r.count }))
      .sort((a, b) => b.count - a.count);
  })();
  const catTotal = rawCatData.reduce((s, d) => s + d.count, 0);
  const catChartData = (() => {
    const main = rawCatData.filter((d) => catTotal === 0 || d.count / catTotal >= 0.03);
    const others = rawCatData.filter((d) => catTotal > 0 && d.count / catTotal < 0.03);
    const otherSum = others.reduce((s, d) => s + d.count, 0);
    return otherSum > 0 ? [...main, { category: "Other", count: otherSum }] : main;
  })();

  const funnelData = funnel ? [
    { name: "Bronze", value: funnel.bronze ?? 0, fill: CHART_COLORS.orange, desc: "Raw collected POIs" },
    { name: "Silver", value: funnel.silver ?? 0, fill: "#94a3b8", desc: "Normalized with quality scores" },
    { name: "Gold", value: funnel.gold ?? 0, fill: "#eab308", desc: "Quality ≥ 0.3 or Google-verified" },
    { name: "Quarantine", value: funnel.quarantine ?? 0, fill: CHART_COLORS.red, desc: "Failed quality rules" },
  ] : [];

  const qualData = qualityDist ?? [];
  const qualIsEmpty = qualData.every((d) => d.count === 0);
  const execData = executions ?? [];
  const qrData = (quarantineReasons ?? []).slice(0, 8);

  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e5e5";
  const tickColor = isDark ? "#98999C" : "#71717a";

  const tabBtnClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
      activeTab === tab
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    }`;

  return (
    <div className="min-h-screen bg-background px-6 pt-8 pb-8">
      <div className="max-w-[1400px] mx-auto">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="pt-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg"
                style={{ background: "linear-gradient(135deg, #0079F2, #0d9488)" }}>
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-bold text-[32px]">Smart Travel Platform</h1>
            </div>
            <p className="text-muted-foreground text-[14px] ml-12">
              {!loading && overview
                ? `${overview.goldPois.toLocaleString()} verified destinations across ${overview.cities} Vietnamese cities`
                : "Discover & analyze verified tourist destinations across Vietnam"}
            </p>
            {lastRefreshed && <p className="text-[12px] text-muted-foreground mt-1 ml-12">Last refresh: {lastRefreshed}</p>}
          </div>
          <div className="flex items-center gap-3 pt-2 print:hidden">
            <Link href="/pois">
              <button className="flex items-center gap-1.5 px-3 h-[26px] rounded-[6px] text-[12px] transition-colors hover:opacity-80"
                style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#0079F2", color: "white" }}>
                <ExternalLink className="w-3.5 h-3.5" />
                Browse POIs
              </button>
            </Link>

            {/* Split Refresh */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center rounded-[6px] overflow-hidden h-[26px] text-[12px]"
                style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
                <button onClick={handleRefresh} disabled={isSpinning}
                  className="flex items-center gap-1 px-2 h-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50">
                  <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <div className="w-px h-4 shrink-0" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" }} />
                <button onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center justify-center px-1.5 h-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              {dropdownOpen && (
                <div className="absolute right-0 top-8 z-50 w-52 rounded-lg border border-border bg-popover p-2 shadow-lg">
                  <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                    <span className="text-xs font-medium">Auto-refresh</span>
                    <button onClick={() => setAutoRefresh((v) => !v)}
                      className={`relative w-8 h-4 rounded-full transition-colors ${autoRefresh ? "bg-primary" : "bg-muted"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${autoRefresh ? "translate-x-4" : ""}`} />
                    </button>
                  </div>
                  {INTERVAL_OPTIONS.map((opt) => (
                    <button key={opt.ms} onClick={() => { setSelectedIntervalMs(opt.ms); setAutoRefresh(true); setDropdownOpen(false); }}
                      className="flex items-center justify-between w-full px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors">
                      {opt.label}
                      {selectedIntervalMs === opt.ms && autoRefresh && <Check className="w-3 h-3 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => window.print()}
              className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setTheme(isDark ? "light" : "dark")}
              className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted mb-6 w-fit print:hidden">
          <button className={tabBtnClass("analytics")} onClick={() => setActiveTab("analytics")}>
            <span className="flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5" />POI Analytics</span>
          </button>
          <button className={tabBtnClass("pipeline")} onClick={() => setActiveTab("pipeline")}>
            <span className="flex items-center gap-2"><Activity className="w-3.5 h-3.5" />Pipeline Monitor</span>
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════
            TAB 1: POI ANALYTICS
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "analytics" && (
          <>
            {/* Global Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-5 print:hidden">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="w-3.5 h-3.5" />
                <span className="font-medium">Filter:</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">City</label>
                <select
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Cities</option>
                  {allCities.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="h-7 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Categories</option>
                  {allCategories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              {(filterCity !== "all" || filterCategory !== "all") && (
                <button
                  onClick={() => { setFilterCity("all"); setFilterCategory("all"); }}
                  className="text-xs text-primary hover:underline">
                  Clear filters
                </button>
              )}
            </div>

            {/* KPI Row — Business */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
              {[
                { label: "Gold POIs", value: overview?.goldPois, icon: Award, color: "#eab308", hint: "Quality ≥ 0.3 or Google-verified" },
                { label: "With Address", value: overview?.withAddress, icon: MapPin, color: CHART_COLORS.teal, hint: "Gold POIs that have address data" },
                { label: "Bronze POIs", value: overview?.bronzePois, icon: Database, color: CHART_COLORS.orange, hint: "All raw collected POIs" },
                { label: "Cities", value: overview?.cities, icon: MapPin, color: CHART_COLORS.blue, hint: undefined },
                { label: "Avg Quality", value: overview?.avgQualityScore, icon: Star, color: CHART_COLORS.purple, decimal: true, hint: "Average quality score across all Gold POIs (0–1)" },
              ].map(({ label, value, icon: Icon, color, decimal, hint }) => (
                <Card key={label} title={hint}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                      </div>
                    </div>
                    {loading ? (
                      <Skeleton className="h-7 w-20" />
                    ) : (
                      <div>
                        <p className="text-2xl font-bold" style={{ color }}>
                          {decimal ? (value as number)?.toFixed(2) : formatNumber(value as number, "compact")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Data Enrichment Insight Strip */}
            {!loading && (overview?.goldPois ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5 px-1">
                {[
                  { label: "Address", value: overview?.withAddress ?? 0, icon: MapPin, color: CHART_COLORS.teal },
                  { label: "Phone", value: overview?.withPhone ?? 0, icon: Phone, color: CHART_COLORS.green },
                  { label: "Website", value: overview?.withWebsite ?? 0, icon: Globe, color: CHART_COLORS.purple },
                ].map(({ label, value, icon: Icon, color }) => {
                  const pct = overview?.goldPois ? ((value / overview.goldPois) * 100).toFixed(1) : "0";
                  return (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                      <span><strong className="text-foreground font-semibold">{pct}%</strong> have {label.toLowerCase()}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <span>{value.toLocaleString()} POIs</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* First-run empty state */}
            {!ovLoading && !ovFetching && (overview?.goldPois ?? 0) === 0 && (overview?.bronzePois ?? 0) === 0 && (
              <div className="mb-6 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-6 flex flex-col sm:flex-row items-center gap-5">
                <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #0079F2, #0d9488)" }}>
                  <GitBranch className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="font-semibold text-base mb-1">Welcome to Smart Travel Platform</h2>
                  <p className="text-sm text-muted-foreground max-w-lg">
                    No POI data yet. Run your first ETL pipeline job to start collecting and analyzing tourist locations.
                  </p>
                </div>
                <Link href="/pipeline">
                  <button className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #0079F2, #0d9488)" }}>
                    <GitBranch className="w-4 h-4" />
                    Go to Pipeline
                  </button>
                </Link>
              </div>
            )}

            {/* POI by Category + Rating Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <Card>
                <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">
                    Gold POIs by Category
                    {filterCity !== "all" && <span className="ml-2 text-xs font-normal text-muted-foreground">({allCities.find(c=>c.value===filterCity)?.label})</span>}
                  </CardTitle>
                  {!catLoading && catChartData.length > 0 && (
                    <CSVLink data={catChartData} filename="poi-by-category.csv"
                      className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80"
                      style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
                      <Download className="w-3.5 h-3.5" />
                    </CSVLink>
                  )}
                </CardHeader>
                <CardContent>
                  {catLoading ? <Skeleton className="w-full h-[280px]" /> : catChartData.length === 0 ? (
                    <div className="h-[280px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <BarChart2 className="w-8 h-8 opacity-30" />
                      <p className="text-sm">No category data</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={280} debounce={0}>
                      <PieChart>
                        <Pie data={catChartData} cx="50%" cy="50%" outerRadius={100} innerRadius={50}
                          dataKey="count" nameKey="category" paddingAngle={2}
                          label={({ name, percent }) => percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ""}
                          labelLine={false}>
                          {catChartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLOR_LIST[i % CHART_COLOR_LIST.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={(v) => <span style={{ fontSize: 12, color: tickColor }}>{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Data Coverage</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Field completeness across {loading ? "…" : formatNumber(overview?.goldPois ?? 0, "compact")} Gold POIs
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  {loading ? <Skeleton className="w-full h-[280px]" /> : (
                    <div className="space-y-5 pt-2">
                      {[
                        { label: "Name", value: overview?.goldPois ?? 0, color: CHART_COLORS.blue, icon: MapPin },
                        { label: "Address", value: overview?.withAddress ?? 0, color: CHART_COLORS.teal, icon: MapPin },
                        { label: "Phone", value: overview?.withPhone ?? 0, color: CHART_COLORS.green, icon: Phone },
                        { label: "Website", value: overview?.withWebsite ?? 0, color: CHART_COLORS.purple, icon: Globe },
                        { label: "Rating", value: 0, color: "#94a3b8", icon: Star, pending: true },
                      ].map(({ label, value, color, icon: FieldIcon, pending }) => {
                        const total = overview?.goldPois ?? 1;
                        const pct = pending ? 0 : Math.min((value / total) * 100, 100);
                        return (
                          <div key={label}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <FieldIcon className="w-3.5 h-3.5" style={{ color }} />
                                <span className="text-sm font-medium">{label}</span>
                                {pending && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                    pending enrichment
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-semibold tabular-nums">{pending ? "—" : value.toLocaleString()}</span>
                                <span className="text-xs text-muted-foreground ml-1.5">{pending ? "0%" : `${pct.toFixed(1)}%`}</span>
                              </div>
                            </div>
                            <div className="h-6 rounded-md bg-muted overflow-hidden">
                              <div className="h-full rounded-md transition-all"
                                style={{ width: `${pct}%`, backgroundColor: color, opacity: pending ? 0.3 : 0.85 }} />
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                        Rating coverage will increase after Google Places enrichment runs
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* POI by City */}
            <Card className="mb-4">
              <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  Gold POIs by City
                  {filterCategory !== "all" && <span className="ml-2 text-xs font-normal text-muted-foreground">({filterCategory})</span>}
                </CardTitle>
                {!cityLoading && cityChartData.length > 0 && (
                  <CSVLink data={cityChartData} filename="poi-by-city.csv"
                    className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80"
                    style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
                    <Download className="w-3.5 h-3.5" />
                  </CSVLink>
                )}
              </CardHeader>
              <CardContent>
                {cityLoading ? <Skeleton className="w-full h-[260px]" /> : cityChartData.length === 0 ? (
                  <div className="h-[260px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <MapPin className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No city data</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(260, cityChartData.length * 32)} debounce={0}>
                    <BarChart data={cityChartData} layout="vertical" margin={{ left: 20, right: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12, fill: tickColor }} />
                      <YAxis type="category" dataKey="cityName" tick={{ fontSize: 12, fill: tickColor }} width={110} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" fill={CHART_COLORS.blue} radius={[0, 4, 4, 0]} name="Gold POIs">
                        <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: tickColor }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 2: PIPELINE MONITOR
        ══════════════════════════════════════════════════════════ */}
        {activeTab === "pipeline" && (
          <>
            {/* KPI Row — Technical */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Bronze (Raw)", value: overview?.bronzePois, icon: Database, color: CHART_COLORS.orange },
                { label: "Silver (Normalized)", value: overview?.silverPois, icon: Database, color: "#94a3b8" },
                { label: "Gold (Quality-filtered)", value: overview?.goldPois, icon: Award, color: "#eab308" },
                { label: "Quarantined", value: overview?.quarantined, icon: AlertTriangle, color: CHART_COLORS.red },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                      </div>
                    </div>
                    {loading ? (
                      <Skeleton className="h-7 w-20" />
                    ) : (
                      <p className="text-2xl font-bold" style={{ color }}>
                        {formatNumber(value as number, "compact")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pipeline Funnel + Quality Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Pipeline Funnel */}
              <Card>
                <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Data Pipeline Funnel</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Gold ⊆ Silver ⊆ Bronze</p>
                  </div>
                  {!funnelLoading && funnelData.length > 0 && (
                    <CSVLink data={funnelData} filename="pipeline-funnel.csv"
                      className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80"
                      style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
                      <Download className="w-3.5 h-3.5" />
                    </CSVLink>
                  )}
                </CardHeader>
                <CardContent className="pt-2">
                  {funnelLoading ? <Skeleton className="w-full h-[300px]" /> : (
                    <div className="space-y-4">
                      {funnelData.map((item, i) => {
                        const bronze = funnelData[0]?.value ?? 1;
                        const pct = Math.min((item.value / bronze) * 100, 100);
                        const prevVal = i > 0 ? funnelData[i - 1].value : null;
                        const retentionPct = prevVal && prevVal > 0
                          ? (item.value / prevVal) * 100
                          : null;
                        return (
                          <div key={item.name}>
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <span className="text-sm font-medium" style={{ color: item.fill }}>{item.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">{item.desc}</span>
                              </div>
                              <span className="text-sm font-semibold tabular-nums">{item.value.toLocaleString()}</span>
                            </div>
                            <div className="h-8 rounded-md bg-muted overflow-hidden relative">
                              <div className="h-full rounded-md transition-all"
                                style={{ width: `${pct}%`, backgroundColor: item.fill, opacity: 0.85 }} />
                              {retentionPct !== null && (
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  {retentionPct.toFixed(1)}% of {funnelData[i - 1].name}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                        Gold threshold: quality score ≥ 0.3 or has Google data
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quality Distribution */}
              <Card>
                <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Quality Score Distribution</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Avg: {loading ? "…" : (overview?.avgQualityScore ?? 0).toFixed(2)} across Gold POIs
                    </p>
                  </div>
                  {!qualLoading && qualData.length > 0 && (
                    <CSVLink data={qualData} filename="quality-distribution.csv"
                      className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80"
                      style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
                      <Download className="w-3.5 h-3.5" />
                    </CSVLink>
                  )}
                </CardHeader>
                <CardContent>
                  {qualLoading ? <Skeleton className="w-full h-[260px]" /> : qualIsEmpty ? (
                    <div className="h-[260px] flex flex-col items-center justify-center gap-3 text-center px-6">
                      <BarChart2 className="w-10 h-10 opacity-20" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">No quality data yet</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Run the pipeline to compute quality scores</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260} debounce={0}>
                      <BarChart data={qualData} margin={{ left: 0, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey="range" tick={{ fontSize: 12, fill: tickColor }} />
                        <YAxis tick={{ fontSize: 12, fill: tickColor }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} name="POIs" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quarantine Reasons */}
            {qrData.length > 0 && (
              <Card className="mb-4">
                <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Quarantine Failure Reasons</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{(overview?.quarantined ?? 0).toLocaleString()} POIs failed quality rules</p>
                  </div>
                  {!qrLoading && (
                    <CSVLink data={qrData} filename="quarantine-reasons.csv"
                      className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80"
                      style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
                      <Download className="w-3.5 h-3.5" />
                    </CSVLink>
                  )}
                </CardHeader>
                <CardContent>
                  {qrLoading ? <Skeleton className="w-full h-[200px]" /> : (
                    <ResponsiveContainer width="100%" height={Math.max(200, qrData.length * 32)} debounce={0}>
                      <BarChart data={qrData} layout="vertical" margin={{ left: 20, right: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12, fill: tickColor }} />
                        <YAxis type="category" dataKey="rule" tick={{ fontSize: 11, fill: tickColor }} width={200} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" fill={CHART_COLORS.red} radius={[0, 4, 4, 0]} name="Count">
                          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: tickColor }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pipeline Executions */}
            <Card>
              <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Recent Pipeline Executions</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Records column shows sync-state total for completed runs
                  </p>
                </div>
                {!execLoading && execData.length > 0 && (
                  <CSVLink data={execData} filename="pipeline-executions.csv"
                    className="print:hidden flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors hover:opacity-80"
                    style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
                    <Download className="w-3.5 h-3.5" />
                  </CSVLink>
                )}
              </CardHeader>
              <CardContent>
                {execLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : execData.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Activity className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No executions recorded yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {["Pipeline", "Status", "Cities", "Categories", "Started", "Records"].map((h) => (
                            <th key={h} className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {execData.map((e) => (
                          <tr key={e.executionId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-2 pr-4 font-medium text-xs max-w-[180px] truncate" title={e.pipelineName}>{e.pipelineName}</td>
                            <td className="py-2 pr-4"><StatusBadge status={e.status} /></td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">{e.cities.join(", ") || "—"}</td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">{e.categories.join(", ") || "all"}</td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">
                              {new Date(e.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td className="py-2 text-xs">
                              <span className={e.recordsProcessed > 0 ? "text-green-600" : "text-muted-foreground"}>
                                {(e.recordsProcessed ?? 0).toLocaleString()}
                              </span>
                              {(e.recordsFailed ?? 0) > 0 && (
                                <span className="text-red-500 ml-1">/ {e.recordsFailed.toLocaleString()} failed</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

      </div>
    </div>
  );
}
