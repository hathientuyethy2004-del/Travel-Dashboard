import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetReportSummary } from "@workspace/api-client-react";
import { CSVLink } from "react-csv";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Download, FileText, Calendar, Database, Star, CheckCircle2, AlertTriangle } from "lucide-react";
import { CHART_COLORS, CHART_COLOR_LIST, formatNumber } from "@/lib/constants";
import { useTheme } from "@/lib/theme-provider";

const PERIODS = [
  { value: "weekly",  label: "Weekly",  icon: "7d" },
  { value: "monthly", label: "Monthly", icon: "30d" },
  { value: "yearly",  label: "Yearly",  icon: "1yr" },
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
          <span className="font-medium">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const { isDark } = useTheme();
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const { data: report, isLoading } = useGetReportSummary({ period });

  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e5e5";
  const tickColor = isDark ? "#98999C" : "#71717a";

  const funnelData = report ? [
    { name: "Bronze", value: report.totals.bronze, fill: CHART_COLORS.orange },
    { name: "Silver", value: report.totals.silver, fill: "#94a3b8" },
    { name: "Gold", value: report.totals.gold, fill: "#eab308" },
    { name: "Quarantine", value: report.totals.quarantine, fill: CHART_COLORS.red },
  ] : [];

  const csvData = report ? [
    { section: "Period", period: report.period, since: report.since, generated: report.generatedAt },
    { section: "Totals", bronze: report.totals.bronze, silver: report.totals.silver, gold: report.totals.gold },
    { section: "New This Period", bronze: report.periodStats.newBronze, silver: report.periodStats.newSilver, gold: report.periodStats.newGold },
    { section: "Quality", avgScore: report.quality.avgQualityScore, avgRating: report.quality.avgRating, multiSource: report.quality.multiSourcePois },
  ] : [];

  return (
    <div className="px-6 pt-6 pb-8 max-w-[1400px] mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #795EFF, #0079F2)" }}>
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-2xl">Reports</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">Periodic data platform health reports</p>
          {report && <p className="text-xs text-muted-foreground ml-11 mt-1">Generated: {new Date(report.generatedAt).toLocaleString()} · Since: {report.since}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && report && csvData.length > 0 && (
            <CSVLink data={csvData} filename={`report-${period}-${new Date().toISOString().slice(0, 10)}.csv`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm hover:opacity-80 transition-opacity"
              style={{ backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2", color: isDark ? "#c8c9cc" : "#4b5563" }}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </CSVLink>
          )}
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-6">
        {PERIODS.map(({ value, label, icon }) => (
          <button key={value} onClick={() => setPeriod(value as typeof period)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${period === value ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30"}`}>
            <Calendar className="w-3.5 h-3.5" />
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded ${period === value ? "bg-primary/10" : "bg-muted"}`}>{icon}</span>
          </button>
        ))}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Gold POIs", value: report?.totals.gold, icon: Star, color: "#eab308", new: report?.periodStats.newGold },
          { label: "Bronze Records", value: report?.totals.bronze, icon: Database, color: CHART_COLORS.orange, new: report?.periodStats.newBronze },
          { label: "Avg Quality", value: report?.quality.avgQualityScore, icon: CheckCircle2, color: CHART_COLORS.teal, decimal: true },
          { label: "Quarantined", value: report?.totals.quarantine, icon: AlertTriangle, color: CHART_COLORS.red },
        ].map(({ label, value, icon: Icon, color, new: newCount, decimal }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
              </div>
              {isLoading ? <Skeleton className="h-7 w-20" /> : (
                <>
                  <p className="text-2xl font-bold" style={{ color }}>
                    {decimal ? (value as number)?.toFixed(2) : formatNumber(value as number ?? 0, "compact")}
                  </p>
                  {newCount !== undefined && newCount > 0 && (
                    <p className="text-xs text-green-600 mt-0.5">+{newCount.toLocaleString()} this {period.replace("ly", "")}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Layer funnel */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">Data Layer Totals</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[240px]" /> : (
              <div className="space-y-3">
                {funnelData.map((item) => {
                  const max = funnelData[0]?.value ?? 1;
                  const pct = (item.value / max) * 100;
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: item.fill }}>{item.name}</span>
                        <span className="text-sm text-muted-foreground">{item.value.toLocaleString()}</span>
                      </div>
                      <div className="h-7 rounded-md bg-muted overflow-hidden">
                        <div className="h-full rounded-md" style={{ width: `${pct}%`, backgroundColor: item.fill, opacity: 0.8 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quality tiers */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">Quality Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[240px]" /> : (
              <div className="space-y-2">
                {/* Avg metrics */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Avg Quality Score</p>
                    <p className="text-xl font-bold text-teal-600">{report?.quality.avgQualityScore?.toFixed(3)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Avg Rating</p>
                    <p className="text-xl font-bold text-yellow-500">
                      {(report?.quality.avgRating ?? 0) > 0 ? `★ ${report!.quality.avgRating!.toFixed(2)}` : "N/A"}
                    </p>
                  </div>
                </div>
                {(report?.quality.tiers ?? []).map((tier, i) => (
                  <div key={tier.tier} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLOR_LIST[i % CHART_COLOR_LIST.length] }} />
                      <span className="text-sm">{tier.tier}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded bg-muted overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${(tier.count / (report?.totals.gold || 1)) * 100}%`, backgroundColor: CHART_COLOR_LIST[i % CHART_COLOR_LIST.length] }} />
                      </div>
                      <span className="text-sm font-medium w-16 text-right">{tier.count.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-2 flex justify-between text-xs text-muted-foreground">
                  <span>Multi-source verified:</span>
                  <span className="font-medium text-green-600">{report?.quality.multiSourcePois?.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top cities and categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">Top Cities by Gold POIs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[200px]" /> : (
              <ResponsiveContainer width="100%" height={200} debounce={0}>
                <BarChart data={report?.topCities ?? []} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: tickColor }} />
                  <YAxis type="category" dataKey="cityName" tick={{ fontSize: 11, fill: tickColor }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Gold POIs" fill={CHART_COLORS.blue} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[200px]" /> : (
              <ResponsiveContainer width="100%" height={200} debounce={0}>
                <BarChart data={report?.topCategories ?? []} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: tickColor }} />
                  <YAxis tick={{ fontSize: 11, fill: tickColor }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Gold POIs" radius={[4, 4, 0, 0]}>
                    {(report?.topCategories ?? []).map((_, i) => <Cell key={i} fill={CHART_COLOR_LIST[i % CHART_COLOR_LIST.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent executions */}
      {(report?.recentExecutions?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base">Recent Pipeline Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Pipeline", "Status", "Records", "Started"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(report?.recentExecutions ?? []).map((e, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-xs font-medium">{e.pipelineName as string}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded ${(e.status as string) === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {e.status as string}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs text-green-600">{(e.recordsProcessed as number)?.toLocaleString()}</td>
                      <td className="py-2 text-xs text-muted-foreground">{e.startedAt ? new Date(e.startedAt as string).toLocaleString() : "—"}</td>
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
