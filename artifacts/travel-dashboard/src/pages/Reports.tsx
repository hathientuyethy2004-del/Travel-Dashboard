import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetReportSummary } from "@workspace/api-client-react";
import { CSVLink } from "react-csv";
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Download, FileText, MapPin, Phone, Globe, Sparkles,
  Star, AlertTriangle, TrendingUp, Database,
} from "lucide-react";
import { CHART_COLORS, CHART_COLOR_LIST } from "@/lib/constants";
import { useTheme } from "@/lib/theme-provider";

const PERIODS = [
  { value: "weekly",  label: "Last 7 days" },
  { value: "monthly", label: "This month"  },
  { value: "yearly",  label: "This year"   },
];

// Quality tier color mapping (best→worst)
const TIER_COLORS: Record<string, string> = {
  "0.8–1.0": "#009118",
  "0.6–0.8": CHART_COLORS.teal,
  "0.4–0.6": CHART_COLORS.blue,
  "0.2–0.4": CHART_COLORS.orange,
  "0.0–0.2": CHART_COLORS.red,
};

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
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

type ReportData = {
  period: string;
  since: string;
  generatedAt: string;
  totals: { bronze: number; silver: number; gold: number; quarantine: number; cities: number };
  coverage?: { withAddress: number; withPhone: number; withWebsite: number; addrPct: number; phonePct: number; websitePct: number };
  quality: {
    avgQualityScore: number;
    avgRating: number;
    multiSourcePois: number;
    tiers: { tier: string; range: string; count: number }[];
  };
  cityStats?: { city: string; cityName: string; total: number; withAddress: number; withPhone: number; addrPct: number; phonePct: number; avgQuality: number }[];
  topCities: { city: string; cityName: string; count: number }[];
  topCategories: { category: string; count: number }[];
  recentExecutions: { pipelineName: string; status: string; startedAt: string; recordsProcessed: number }[];
};

export default function Reports() {
  const { isDark } = useTheme();
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const { data: rawReport, isLoading } = useGetReportSummary({ period });
  const report = rawReport as ReportData | undefined;

  const tickColor = isDark ? "#98999C" : "#71717a";

  const gold          = report?.totals.gold      ?? 0;
  const quarantine    = report?.totals.quarantine ?? 0;
  const withAddr      = report?.coverage?.withAddress ?? 0;
  const withPhone     = report?.coverage?.withPhone   ?? 0;
  const withWebsite   = report?.coverage?.withWebsite ?? 0;
  const addrPct       = report?.coverage?.addrPct    ?? 0;
  const phonePct      = report?.coverage?.phonePct   ?? 0;
  const websitePct    = report?.coverage?.websitePct ?? 0;
  const avgQuality    = report?.quality.avgQualityScore ?? 0;

  const categoryData = (report?.topCategories ?? []).map((c, i) => ({
    name:  c.category,
    count: c.count,
    fill:  CHART_COLOR_LIST[i % CHART_COLOR_LIST.length],
  }));

  const csvData = report ? [
    { section: "Totals",   gold, quarantine, bronze: report.totals.bronze },
    { section: "Coverage", withAddress: withAddr, withPhone, withWebsite, addrPct, phonePct, websitePct },
    { section: "Quality",  avgQualityScore: avgQuality, avgRating: report.quality.avgRating },
    ...(report.cityStats ?? []).map((c) => ({
      section: "City",
      city: c.cityName, pois: c.total, addrPct: c.addrPct, phonePct: c.phonePct, avgQuality: c.avgQuality,
    })),
  ] : [];

  return (
    <div className="px-6 pt-6 pb-8 max-w-[1400px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #795EFF, #0079F2)" }}>
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-2xl">Platform Report</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">
            {isLoading ? "Loading…" : (
              gold > 0
                ? `${gold.toLocaleString()} verified destinations · ${report?.totals.cities ?? 0} cities · ${report?.topCategories.length ?? 0} categories`
                : "Tourism data platform health report"
            )}
          </p>
          {report && (
            <p className="text-xs text-muted-foreground ml-11 mt-0.5">
              Generated {new Date(report.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {PERIODS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPeriod(value as typeof period)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === value
                    ? "bg-primary text-white"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {!isLoading && report && csvData.length > 0 && (
            <CSVLink
              data={csvData}
              filename={`smart-travel-report-${new Date().toISOString().slice(0, 10)}.csv`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity border border-border"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </CSVLink>
          )}
        </div>
      </div>

      {/* ── Platform Snapshot ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Gold Destinations",  value: gold,        icon: Star,          color: "#d97706", sub: "verified POIs" },
          { label: "Avg Quality Score",  value: avgQuality,  icon: TrendingUp,    color: CHART_COLORS.teal, sub: "pre-enrichment", decimal: true },
          { label: "Quarantined",        value: quarantine,  icon: AlertTriangle, color: CHART_COLORS.red, sub: "borderline quality" },
          { label: "Bronze Records",     value: report?.totals.bronze ?? 0, icon: Database, color: CHART_COLORS.orange, sub: "raw collected" },
        ].map(({ label, value, icon: Icon, color, sub, decimal }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
              </div>
              {isLoading ? <Skeleton className="h-7 w-20" /> : (
                <>
                  <p className="text-2xl font-bold" style={{ color }}>
                    {decimal
                      ? (value as number).toFixed(3)
                      : (value as number).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Destination Readiness ─────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">Destination Readiness</CardTitle>
          <p className="text-xs text-muted-foreground">
            How useful are these {gold.toLocaleString()} POIs for travelers right now? (OSM-only, pre-enrichment)
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading ? <Skeleton className="h-20 w-full" /> : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Navigable",
                  sub:   "Has address — traveler can find it",
                  icon:  MapPin,
                  count: withAddr,
                  pct:   addrPct,
                  color: CHART_COLORS.teal,
                },
                {
                  label: "Contactable",
                  sub:   "Has phone number",
                  icon:  Phone,
                  count: withPhone,
                  pct:   phonePct,
                  color: CHART_COLORS.green,
                },
                {
                  label: "On the Web",
                  sub:   "Has website URL",
                  icon:  Globe,
                  count: withWebsite,
                  pct:   websitePct,
                  color: CHART_COLORS.purple,
                },
                {
                  label: "Enriched",
                  sub:   "Google data — ratings, fuller detail",
                  icon:  Sparkles,
                  count: 0,
                  pct:   0,
                  color: CHART_COLORS.blue,
                  note:  "→ Run Google Enrichment",
                },
              ].map(({ label, sub, icon: Icon, count, pct, color, note }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{sub}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold tabular-nums" style={{ color }}>{pct}%</span>
                    <span className="text-xs text-muted-foreground">{count.toLocaleString()} POIs</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  {note && (
                    <p className="text-[11px] font-medium" style={{ color }}>{note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quality Distribution + Category Breakdown ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Quality Distribution */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">Quality Score Distribution</CardTitle>
            <p className="text-xs text-muted-foreground">
              Gold POIs by quality tier · avg {avgQuality.toFixed(3)} · Google enrichment targets 0.6+
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {isLoading ? <Skeleton className="h-40 w-full" /> : (
              <>
                {(report?.quality.tiers ?? []).map((tier) => {
                  const color = TIER_COLORS[tier.range] ?? CHART_COLORS.blue;
                  const pct   = gold > 0 ? (tier.count / gold) * 100 : 0;
                  return (
                    <div key={tier.tier}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium" style={{ color }}>{tier.tier}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {tier.count.toLocaleString()} · {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 flex justify-between text-xs text-muted-foreground border-t border-border">
                  <span>Multi-source verified:</span>
                  <span className={`font-medium ${(report?.quality.multiSourcePois ?? 0) > 0 ? "text-green-600" : ""}`}>
                    {(report?.quality.multiSourcePois ?? 0).toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  After Google enrichment: expect 40–60% of POIs to move from Low → Fair/Good
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">POIs by Category</CardTitle>
            <p className="text-xs text-muted-foreground">{report?.topCategories.length ?? 0} categories · all Gold POIs</p>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {isLoading ? <Skeleton className="h-[220px] w-full" /> : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryData}
                    layout="vertical"
                    margin={{ left: 4, right: 48, top: 2, bottom: 2 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: tickColor }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: tickColor }}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                    />
                    <Tooltip
                      formatter={(v: number) => [v.toLocaleString(), "Gold POIs"]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: isDark ? "#1e1e2e" : "#fff",
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={14}>
                      {categoryData.map((c, i) => <Cell key={i} fill={c.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── City Coverage Table ───────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm">City Coverage Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">
            Address and phone coverage per city — reflects data depth available to travelers
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["City", "Gold POIs", "Share", "Address Coverage", "Phone Coverage", "Avg Quality"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(report?.cityStats ?? []).map((city, i) => {
                    const share = gold > 0 ? (city.total / gold) * 100 : 0;
                    const qColor = city.avgQuality >= 0.5 ? "text-green-600" : city.avgQuality >= 0.3 ? "text-yellow-600" : "text-red-500";
                    return (
                      <tr key={city.city} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: CHART_COLOR_LIST[i % CHART_COLOR_LIST.length] }}>
                              {i + 1}
                            </div>
                            <span className="text-xs font-medium">{city.cityName || city.city}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-bold tabular-nums">{city.total.toLocaleString()}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary/60" style={{ width: `${share}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground tabular-nums">{share.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${city.addrPct}%`, backgroundColor: CHART_COLORS.teal }} />
                            </div>
                            <span className="text-xs font-medium" style={{ color: CHART_COLORS.teal }}>{city.addrPct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${city.phonePct}%`, backgroundColor: CHART_COLORS.green }} />
                            </div>
                            <span className="text-xs font-medium" style={{ color: CHART_COLORS.green }}>{city.phonePct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-mono font-medium ${qColor}`}>
                            {city.avgQuality.toFixed(3)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent Pipeline Executions ────────────────────────────────────── */}
      {(report?.recentExecutions?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">Recent Pipeline Executions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Pipeline", "Status", "Records", "When"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(report?.recentExecutions ?? []).map((e, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 text-xs font-medium">{e.pipelineName}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          e.status === "completed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                        }`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-green-600 tabular-nums">
                        {(e.recordsProcessed ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {e.startedAt ? new Date(e.startedAt).toLocaleString("vi-VN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
