import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play, RefreshCw, Clock, CheckCircle2, XCircle, Loader2,
  Plus, Trash2, GitBranch, ThumbsUp, ThumbsDown, AlertCircle,
  Zap, Key, ToggleLeft, ToggleRight, TrendingUp, Database,
  ArrowRight, WifiOff, Globe, Star, Layers, Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  useGetPipelineFunnel,
  useGetDashboardOverview,
  useGetQuarantineReasons,
  useGetPoiByCity,
  useGetPoiByCategory,
} from "@workspace/api-client-react";
import { CHART_COLORS, CHART_COLOR_LIST } from "@/lib/constants";
import { useTheme } from "@/lib/theme-provider";

const API = "/api";

// ── Job types grouped by workflow stage ──────────────────────────────────────
const JOB_STAGES = [
  {
    stage: "Collection",
    color: CHART_COLORS.blue,
    icon: Globe,
    jobs: [
      { value: "collect_osm",           label: "Collect OSM",           desc: "Gather raw POI data from OpenStreetMap", recommended: false },
      { value: "collect_google_places", label: "Collect Google Places", desc: "Discover POIs directly via Google Places Text Search", recommended: false },
    ],
  },
  {
    stage: "Processing",
    color: CHART_COLORS.teal,
    icon: Layers,
    jobs: [
      { value: "bronze_to_silver", label: "Bronze → Silver", desc: "Normalize and score bronze layer records", recommended: false },
      { value: "silver_to_gold",   label: "Silver → Gold",   desc: "Promote quality-gated records; queues borderline POIs for manual review", recommended: false },
      { value: "rebuild_layers",   label: "Rebuild Layers",  desc: "Fast rebuild of Silver + Gold from Bronze (no re-collection)", recommended: false },
      { value: "reconcile",        label: "Reconcile",       desc: "Remove ghost records across Bronze/Silver/Gold", recommended: false },
    ],
  },
  {
    stage: "Enrichment",
    color: CHART_COLORS.green,
    icon: Sparkles,
    jobs: [
      { value: "enrich_google",            label: "Enrich Google",  desc: "Match OSM POIs with Google Places — adds ratings, phone, website", recommended: true },
      { value: "retry_failed_enrichments", label: "Retry Failed",   desc: "Retry enrichment for records that previously had no name match", recommended: false },
    ],
  },
  {
    stage: "Automation",
    color: CHART_COLORS.purple,
    icon: Zap,
    jobs: [
      { value: "nightly_sync",  label: "Nightly Sync",  desc: "Enrich a batch of records then auto-rebuild Silver + Gold layers", recommended: true },
      { value: "full_pipeline", label: "Full Pipeline", desc: "Run all pipeline stages end-to-end", recommended: false },
    ],
  },
];

const ALL_JOBS = JOB_STAGES.flatMap((s) => s.jobs);

const CRON_PRESETS = [
  { label: "Every day at 2 AM",        value: "0 2 * * *" },
  { label: "Every day at midnight",    value: "0 0 * * *" },
  { label: "Every week (Monday 3 AM)", value: "0 3 * * 1" },
  { label: "Every month (1st, 4 AM)",  value: "0 4 1 * *" },
];

const QUARANTINE_LABELS: Record<string, string> = {
  completeness_below_threshold: "Incomplete data",
  invalid_longitude:            "Invalid longitude",
  invalid_latitude:             "Invalid latitude",
  trust_score_below_threshold:  "Low trust score",
  quality_score_below_threshold:"Low quality score",
  missing_name_and_google:      "No name (no Google)",
  source_conflict_detected:     "Source conflict",
};

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  if (status === "running")   return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === "failed")    return <XCircle className="w-4 h-4 text-red-500" />;
  return <Clock className="w-4 h-4 text-yellow-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    running:   "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    failed:    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    pending:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls[status] ?? "bg-muted"}`}>
      <StatusIcon status={status} /> {status}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Pipeline() {
  const { isDark } = useTheme();

  // Non-ETL hooks — always available from MongoDB via main API
  // Auto-refresh handled globally via QueryClient (3 min interval)
  const { data: funnel, isLoading: funnelLoading } = useGetPipelineFunnel();
  const { data: overview } = useGetDashboardOverview();
  const { data: qReasons } = useGetQuarantineReasons();
  const { data: poiByCity }     = useGetPoiByCity();
  const { data: poiByCategory } = useGetPoiByCategory();

  // ETL-specific state (needs ETL service)
  const [jobs,          setJobs]          = useState<Record<string, unknown>[]>([]);
  const [schedules,     setSchedules]     = useState<Record<string, unknown>[]>([]);
  const [etlStatus,     setEtlStatus]     = useState<Record<string, unknown> | null>(null);
  const [etlOnline,     setEtlOnline]     = useState(false);
  const [pendingReview, setPendingReview] = useState<Record<string, unknown>[]>([]);
  const [reviewCount,   setReviewCount]   = useState(0);
  const [jobsLoading,   setJobsLoading]   = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [selectedJob,   setSelectedJob]   = useState<Record<string, unknown> | null>(null);
  const [triggering,    setTriggering]    = useState(false);
  const [tab,           setTab]           = useState<"jobs" | "schedules" | "review">("jobs");

  const [citiesList, setCitiesList] = useState<{ code: string; name: string }[]>([]);
  const [catsList,   setCatsList]   = useState<{ code: string }[]>([]);

  // Trigger form state
  const [triggerType,   setTriggerType]   = useState("nightly_sync");
  const [triggerCities, setTriggerCities] = useState<string[]>([]);
  const [triggerCats,   setTriggerCats]   = useState<string[]>([]);
  const [triggerLimit,  setTriggerLimit]  = useState(200);

  // Schedule form state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedType,  setSchedType]  = useState("nightly_sync");
  const [schedCron,  setSchedCron]  = useState("0 2 * * *");
  const [schedLabel, setSchedLabel] = useState("");
  const [schedLimit, setSchedLimit] = useState(500);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [j, s, st, rc] = await Promise.all([
        fetch(`${API}/etl/jobs?limit=30`).then((r) => r.json()),
        fetch(`${API}/etl/schedules`).then((r) => r.json()),
        fetch(`${API}/etl/status`).then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        }),
        fetch(`${API}/etl/review/count`).then((r) => r.json()),
      ]);
      setJobs(Array.isArray(j) ? j : []);
      setSchedules(Array.isArray(s) ? s : []);
      setEtlStatus(st);
      setEtlOnline(true);
      setReviewCount((rc as { count?: number })?.count ?? 0);
    } catch {
      setEtlOnline(false);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const [cities, cats] = await Promise.all([
        fetch(`${API}/etl/config/cities`).then((r) => r.json()),
        fetch(`${API}/etl/config/categories`).then((r) => r.json()),
      ]);
      setCitiesList(Array.isArray(cities) ? cities : []);
      setCatsList(Array.isArray(cats) ? cats : []);
    } catch {}
  }, []);

  const fetchReview = useCallback(async () => {
    setReviewLoading(true);
    try {
      const data = await fetch(`${API}/etl/review?limit=50`).then((r) => r.json());
      setPendingReview(Array.isArray(data) ? data : []);
    } finally {
      setReviewLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAll();
    fetchConfig();
  }, [fetchAll, fetchConfig]);

  // Adaptive polling: 5s when ETL online (jobs change fast), 30s when offline (just checking)
  useEffect(() => {
    const interval = etlOnline ? 5000 : 30000;
    const id = setInterval(fetchAll, interval);
    return () => clearInterval(id);
  }, [fetchAll, etlOnline]);

  useEffect(() => {
    if (tab === "review") fetchReview();
  }, [tab, fetchReview]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function triggerJob() {
    setTriggering(true);
    try {
      const r = await fetch(`${API}/etl/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: triggerType, cities: triggerCities, categories: triggerCats, limit: triggerLimit }),
      });
      if (r.status === 401) { alert("Authentication required to trigger jobs."); return; }
      if (!r.ok) { alert("Failed to trigger job — ETL service may be offline."); return; }
      const job = await r.json();
      setJobs((prev) => [job, ...prev]);
      setTab("jobs");
    } catch {
      alert("Failed to trigger job — ETL service may be offline.");
    } finally {
      setTriggering(false);
    }
  }

  async function createSchedule() {
    try {
      const r = await fetch(`${API}/etl/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: schedType, cron: schedCron, label: schedLabel, limit: schedLimit }),
      });
      if (r.status === 401) { alert("Authentication required."); return; }
      const s = await r.json();
      setSchedules((prev) => [s, ...prev]);
      setShowScheduleForm(false);
    } catch { alert("Failed to create schedule"); }
  }

  async function deleteSchedule(id: string) {
    await fetch(`${API}/etl/schedules/${id}`, { method: "DELETE" });
    setSchedules((prev) => prev.filter((s) => (s as Record<string, string>).scheduleId !== id));
  }

  async function toggleSchedule(id: string, currently: boolean) {
    const enabled = !currently;
    await fetch(`${API}/etl/schedules/${id}/toggle?enabled=${enabled}`, { method: "PATCH" });
    setSchedules((prev) => prev.map((s) =>
      (s as Record<string, unknown>).scheduleId === id ? { ...s, enabled } : s
    ));
  }

  async function runScheduleNow(s: Record<string, unknown>) {
    setTriggering(true);
    try {
      const r = await fetch(`${API}/etl/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: s.jobType, cities: s.cities || [], categories: s.categories || [], limit: s.limit || 500 }),
      });
      const job = await r.json();
      setJobs((prev) => [job, ...prev]);
      setTab("jobs");
    } catch { alert("Failed to trigger job"); }
    finally { setTriggering(false); }
  }

  async function deleteJob(id: string) {
    await fetch(`${API}/etl/jobs/${id}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => (j as Record<string, string>).jobId !== id));
  }

  async function quickSetupAutomation() {
    try {
      const presets = [
        { jobType: "nightly_sync",  cron: "0 2 * * *",   label: "Daily Enrichment",      limit: 500  },
        { jobType: "full_pipeline", cron: "0 3 * * 1",   label: "Weekly Full Pipeline",  limit: 1000 },
      ];
      const results = await Promise.all(presets.map((p) =>
        fetch(`${API}/etl/schedules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        }).then((r) => r.json())
      ));
      setSchedules(results);
      setTab("schedules");
    } catch { alert("Failed to create automation schedules"); }
  }

  async function approveReview(uKey: string) {
    const r = await fetch(`${API}/etl/review/${uKey}/approve`, { method: "POST" });
    if (r.status === 401) { alert("Authentication required."); return; }
    setPendingReview((prev) => prev.filter((p) => p.u_key !== uKey));
    setReviewCount((c) => Math.max(0, c - 1));
  }

  async function rejectReview(uKey: string) {
    const r = await fetch(`${API}/etl/review/${uKey}/reject`, { method: "POST" });
    if (r.status === 401) { alert("Authentication required."); return; }
    setPendingReview((prev) => prev.filter((p) => p.u_key !== uKey));
    setReviewCount((c) => Math.max(0, c - 1));
  }

  // ── Derived stats ───────────────────────────────────────────────────────────
  const st = etlStatus as {
    jobs?: Record<string, number>;
    apiKeys?: { total: number; available: number; exhausted: number };
    enrichment?: { total: number; enriched: number; pct: number; remaining: number };
    schedules?: { total: number; active: number };
  } | null;
  const keyStatus    = st?.apiKeys;
  const enrichStatus = st?.enrichment;

  const bronzeCount     = funnel?.bronze     ?? 0;
  const silverCount     = funnel?.silver     ?? 0;
  const goldCount       = funnel?.gold       ?? 0;
  const quarantineCount = funnel?.quarantine ?? 0;
  const rejectedCount   = Math.max(0, bronzeCount - goldCount - quarantineCount);
  const promotionRate   = bronzeCount > 0 ? Math.round((goldCount       / bronzeCount) * 100) : 0;
  const quarantineRate  = bronzeCount > 0 ? Math.round((quarantineCount / bronzeCount) * 100) : 0;
  const enrichedPct     = enrichStatus?.pct ?? 0;
  const withAddr        = overview?.withAddress ?? 0;
  const withPhone       = overview?.withPhone   ?? 0;
  const withWebsite     = overview?.withWebsite ?? 0;
  const addrPct  = goldCount > 0 ? Math.round((withAddr    / goldCount) * 100) : 0;
  const phonePct = goldCount > 0 ? Math.round((withPhone   / goldCount) * 100) : 0;
  const webPct   = goldCount > 0 ? Math.round((withWebsite / goldCount) * 100) : 0;

  const quarantineChartData = (qReasons ?? []).map((r) => ({
    name:  QUARANTINE_LABELS[r.rule] ?? r.rule,
    count: r.count,
  }));

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="px-6 pt-6 pb-8 max-w-[1400px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0079F2, #0d9488)" }}>
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-bold text-2xl">Pipeline Management</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">
            {bronzeCount > 0
              ? `${bronzeCount.toLocaleString()} records collected · ${goldCount.toLocaleString()} Gold POIs · ${promotionRate}% promotion rate · ${quarantineCount.toLocaleString()} quarantined`
              : "Trigger ETL jobs, track progress, manage schedules, and review borderline POIs"}
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 ${
          etlOnline
            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
            : "bg-muted text-muted-foreground"
        }`}>
          {etlOnline
            ? <><Zap className="w-3.5 h-3.5 text-green-600" /> ETL Online</>
            : <><WifiOff className="w-3.5 h-3.5" /> ETL Offline</>}
        </div>
      </div>

      {/* ── Pipeline Stages ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Flow diagram */}
        <Card className="lg:col-span-2">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">Data Pipeline Flow</CardTitle>
            <p className="text-xs text-muted-foreground">Collection to Gold — live counts from MongoDB</p>
          </CardHeader>
          <CardContent className="px-4 pb-5">
            {funnelLoading ? <Skeleton className="h-28 w-full" /> : (
              <div className="space-y-3">
                {/* Main flow */}
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { label: "OSM Collected", count: bronzeCount, Icon: Globe,    color: CHART_COLORS.blue,   sub: "Raw records",      pct: null      },
                    { label: "Bronze Layer",   count: bronzeCount, Icon: Database, color: "#b45309",           sub: "Normalized",       pct: 100       },
                    { label: "Silver Layer",   count: silverCount, Icon: Layers,   color: "#64748b",           sub: "Scored & merged",  pct: bronzeCount > 0 ? Math.round(silverCount / bronzeCount * 100) : 0 },
                    { label: "Gold Master",    count: goldCount,   Icon: Star,     color: "#d97706",           sub: `${promotionRate}% promoted`, pct: promotionRate },
                  ].map((s, i, arr) => (
                    <div key={s.label} className="flex items-center">
                      <div className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border border-border min-w-[115px] text-center">
                        <div className="flex items-center gap-1.5">
                          <s.Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                          <span className="text-[11px] font-medium">{s.label}</span>
                        </div>
                        <span className="text-xl font-bold tabular-nums" style={{ color: s.color }}>
                          {s.count.toLocaleString()}
                        </span>
                        <p className="text-[10px] text-muted-foreground">{s.sub}</p>
                      </div>
                      {i < arr.length - 1 && (
                        <ArrowRight className="w-4 h-4 mx-1 text-muted-foreground/50 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Silver→Gold breakdown */}
                {goldCount > 0 && (
                  <div className="flex items-center gap-3 pl-1 pt-1">
                    <div className="w-px h-6 border-l-2 border-dashed border-border ml-[calc(3*120px+3*24px-8px)] shrink-0" />
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                        {goldCount.toLocaleString()} promoted ({promotionRate}%)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        {quarantineCount.toLocaleString()} quarantined ({quarantineRate}%)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                        {rejectedCount.toLocaleString()} rejected ({bronzeCount > 0 ? Math.round(rejectedCount / bronzeCount * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enrichment progress / opportunity */}
        <Card className={enrichedPct === 0 && !funnelLoading ? "border-blue-200 dark:border-blue-800/50" : ""}>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              Google Enrichment
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">
                  {enrichStatus
                    ? `${enrichStatus.enriched.toLocaleString()} / ${enrichStatus.total.toLocaleString()}`
                    : `0 / ${goldCount.toLocaleString()}`
                  } enriched
                </span>
                <span className="font-medium" style={{ color: CHART_COLORS.blue }}>{enrichedPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${enrichedPct === 0 ? 0 : Math.max(enrichedPct, 2)}%`,
                    background: "linear-gradient(90deg, #0079F2, #0d9488)",
                  }}
                />
              </div>
            </div>

            {enrichedPct === 0 && goldCount > 0 && (
              <div className="space-y-1.5 mb-3">
                <p className="text-xs font-medium">Enrichment unlocks:</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1.5"><Star className="w-3 h-3 text-yellow-500" /> Star ratings &amp; review counts</p>
                  <p className="flex items-center gap-1.5"><span className="w-3 h-3 text-green-500 font-bold text-center">☎</span> Phone coverage: 14% → ~60%</p>
                  <p className="flex items-center gap-1.5"><Globe className="w-3 h-3 text-purple-500" /> Quality scores up to 0.9+</p>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 pt-1 font-medium">
                  → Run "Nightly Sync" or "Enrich Google" to start
                </p>
              </div>
            )}

            {keyStatus && (
              <div className="flex items-center gap-2 text-xs border-t border-border pt-2.5">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-muted-foreground">API keys today:</span>
                <span className={`font-medium ml-auto ${keyStatus.available > 0 ? "text-green-600" : "text-red-500"}`}>
                  {keyStatus.available} / {keyStatus.total}
                </span>
              </div>
            )}
            {!keyStatus && (
              <p className="text-xs text-muted-foreground border-t border-border pt-2">
                Start ETL service to view API key status
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Coverage + Quarantine ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* Field coverage */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">Gold Layer — Field Coverage</CardTitle>
            <p className="text-xs text-muted-foreground">
              {goldCount.toLocaleString()} Gold POIs · OSM-only (pre-enrichment)
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {[
              { label: "Name",    count: goldCount, pct: 100,      color: CHART_COLORS.blue   },
              { label: "Address", count: withAddr,  pct: addrPct,  color: CHART_COLORS.teal   },
              { label: "Phone",   count: withPhone, pct: phonePct, color: CHART_COLORS.green  },
              { label: "Website", count: withWebsite, pct: webPct, color: CHART_COLORS.purple },
            ].map(({ label, count, pct, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {count.toLocaleString()} · <span style={{ color }}>{pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1.5 border-t border-border">
              After Google enrichment: phone ~60% · website ~30% · quality scores up to 0.9+
            </p>
          </CardContent>
        </Card>

        {/* Quarantine breakdown */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Quarantine Breakdown
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                {quarantineCount.toLocaleString()} records
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Records failing quality gates during Silver → Gold</p>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {!quarantineChartData.length ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No quarantine data available</p>
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={quarantineChartData}
                    layout="vertical"
                    margin={{ left: 0, right: 40, top: 2, bottom: 2 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={130}
                    />
                    <Tooltip
                      formatter={(v: number) => [v.toLocaleString(), "Records"]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: isDark ? "#1e1e2e" : "#fff",
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={14}>
                      {quarantineChartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLOR_LIST[i % CHART_COLOR_LIST.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── ETL Offline Banner ───────────────────────────────────────────────── */}
      {!etlOnline && !jobsLoading && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border bg-muted/30 mb-4">
          <WifiOff className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">ETL service is offline</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The ETL service is a separate Python process. Start it from the{" "}
              <strong>ETL Service</strong> workflow to trigger jobs, view history, and manage schedules.
              The pipeline health data above is always available directly from MongoDB.
            </p>
          </div>
        </div>
      )}

      {/* ── Quick Automation Setup (ETL online, no schedules yet) ────────────── */}
      {etlOnline && !jobsLoading && schedules.length === 0 && (
        <Card className="mb-4 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #10b981, #0d9488)" }}>
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Set up automatic pipeline</p>
                  <p className="text-xs text-muted-foreground">No schedules yet — run enrichment &amp; rebuild automatically</p>
                </div>
              </div>
              <div className="flex-1 flex flex-wrap items-center gap-3 sm:justify-end">
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Daily Enrichment — Nightly Sync at 02:00
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
                    Weekly Full Pipeline — Monday at 03:00
                  </span>
                </div>
                <button
                  onClick={quickSetupAutomation}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 shrink-0"
                  style={{ background: "linear-gradient(135deg, #10b981, #0d9488)" }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Set up automation
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Enrichment progress banner (when ETL online) ────────────────────── */}
      {etlOnline && enrichStatus && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-6 items-start">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Google Enrichment in Progress</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {enrichStatus.enriched.toLocaleString()} / {enrichStatus.total.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${enrichStatus.pct}%`, background: "linear-gradient(90deg, #0079F2, #0d9488)" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {enrichStatus.pct}% complete · {enrichStatus.remaining.toLocaleString()} records remaining
                </p>
              </div>
              {keyStatus && (
                <div className="min-w-[140px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-medium">API Keys Today</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-green-600">{keyStatus.available}</span>
                    <span className="text-xs text-muted-foreground">/ {keyStatus.total} available</span>
                  </div>
                  {keyStatus.exhausted > 0 && (
                    <p className="text-xs text-red-500 mt-0.5">{keyStatus.exhausted} exhausted today</p>
                  )}
                </div>
              )}
              <div className="min-w-[130px]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-medium">Auto Schedules</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-emerald-600">{st?.schedules?.active ?? 0}</span>
                  <span className="text-xs text-muted-foreground">/ {st?.schedules?.total ?? 0} active</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">running automatically</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Job Stats (when ETL online) ──────────────────────────────────────── */}
      {etlOnline && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Total Jobs",  key: "total",     color: CHART_COLORS.blue  },
            { label: "Running",     key: "running",   color: "#0891b2"          },
            { label: "Completed",   key: "completed", color: CHART_COLORS.green },
            { label: "Failed",      key: "failed",    color: CHART_COLORS.red   },
          ].map(({ label, key, color }) => (
            <Card key={key}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                {jobsLoading
                  ? <Skeleton className="h-7 w-12 mt-0.5" />
                  : <p className="text-xl font-bold mt-0.5" style={{ color }}>
                      {(st?.jobs?.[key] ?? 0)}
                    </p>
                }
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Main layout: Trigger + Activity ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Trigger Panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" /> Trigger Job
            </CardTitle>
            {!etlOnline && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                <WifiOff className="w-3 h-3" /> ETL service offline — jobs won't start
              </p>
            )}
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Grouped job selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Job Type</label>
              <div className="space-y-3">
                {JOB_STAGES.map(({ stage, color, icon: StageIcon, jobs }) => (
                  <div key={stage}>
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      <StageIcon className="w-3 h-3" style={{ color }} /> {stage}
                    </p>
                    <div className="space-y-0.5 pl-1">
                      {jobs.map((job) => (
                        <button
                          key={job.value}
                          onClick={() => setTriggerType(job.value)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between gap-2 ${
                            triggerType === job.value
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted/50 text-foreground"
                          }`}
                        >
                          <span>{job.label}</span>
                          {job.recommended && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                              style={{
                                backgroundColor: isDark ? "rgba(0,121,242,0.2)" : "#dbeafe",
                                color: CHART_COLORS.blue,
                              }}
                            >
                              ★ Recommended
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 min-h-[2rem]">
                {ALL_JOBS.find((j) => j.value === triggerType)?.desc}
              </p>
            </div>

            {/* Cities — ETL config when online, DB-derived fallback when offline */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Cities (optional)</label>
              {(() => {
                const etlCities = citiesList.length > 0
                  ? citiesList.map((c) => ({ code: c.code, name: c.name ?? c.code }))
                  : (poiByCity ?? []).map((c) => ({ code: c.city, name: c.cityName ?? c.city }));
                return etlCities.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Loading cities…</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {etlCities.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => setTriggerCities((prev) =>
                          prev.includes(c.code) ? prev.filter((x) => x !== c.code) : [...prev, c.code]
                        )}
                        className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                          triggerCities.includes(c.code)
                            ? "bg-primary text-white border-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Categories — ETL config when online, DB-derived fallback when offline */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Categories (optional)</label>
              {(() => {
                const etlCats = catsList.length > 0
                  ? catsList.map((c) => c.code)
                  : (poiByCategory ?? []).map((c) => c.category);
                return etlCats.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Loading categories…</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {etlCats.map((code) => (
                      <button
                        key={code}
                        onClick={() => setTriggerCats((prev) =>
                          prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]
                        )}
                        className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                          triggerCats.includes(code)
                            ? "bg-primary text-white border-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Limit */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Limit: {triggerLimit.toLocaleString()}
              </label>
              <input
                type="range" min={50} max={2000} step={50} value={triggerLimit}
                onChange={(e) => setTriggerLimit(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <button
              onClick={triggerJob}
              disabled={triggering || !etlOnline}
              className="w-full h-9 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #0079F2, #0d9488)" }}
            >
              {triggering
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
                : <><Play className="w-4 h-4" /> Run Job</>
              }
            </button>
          </CardContent>
        </Card>

        {/* Activity: Jobs / Schedules / Review ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Tab bar */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTab("jobs")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "jobs" ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"}`}
            >
              Jobs ({jobs.length})
            </button>
            <button
              onClick={() => setTab("schedules")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "schedules" ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"}`}
            >
              Schedules ({schedules.length})
            </button>
            <button
              onClick={() => setTab("review")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "review" ? "bg-amber-500 text-white" : "bg-muted hover:bg-muted/80"}`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Pending Review
              {reviewCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === "review" ? "bg-white text-amber-600" : "bg-amber-500 text-white"}`}>
                  {reviewCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { fetchAll(); if (tab === "review") fetchReview(); }}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-muted hover:bg-muted/80 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* ── Jobs Tab ──────────────────────────────────────────────────────── */}
          {tab === "jobs" && (
            <Card>
              <CardContent className="p-0">
                {!etlOnline ? (
                  <div className="py-14 text-center">
                    <WifiOff className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">ETL service is offline</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Start the <strong>ETL Service</strong> workflow to view and trigger jobs
                    </p>
                  </div>
                ) : jobsLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    No jobs yet — trigger your first job from the panel on the left!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {["#", "Type", "Status", "Processed", "Duration", "Actions"].map((h) => (
                            <th key={h} className="text-left text-xs font-medium text-muted-foreground px-3 py-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map((job: Record<string, unknown>, idx: number) => {
                          const start = job.startedAt   ? new Date(job.startedAt   as string) : null;
                          const end   = job.completedAt ? new Date(job.completedAt as string) : null;
                          const ms    = start && end ? end.getTime() - start.getTime() : null;
                          const dur   = ms != null
                            ? ms > 60000 ? `${Math.round(ms / 60000)}m` : `${Math.round(ms / 1000)}s`
                            : job.status === "running" ? "Running…" : "—";
                          return (
                            <tr
                              key={job.jobId as string}
                              className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                              onClick={() => setSelectedJob(selectedJob?.jobId === job.jobId ? null : job)}
                            >
                              <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">#{jobs.length - idx}</td>
                              <td className="px-3 py-2 text-xs font-medium capitalize">{(job.jobType as string)?.replace(/_/g, " ")}</td>
                              <td className="px-3 py-2"><StatusBadge status={job.status as string} /></td>
                              <td className="px-3 py-2 text-xs text-green-600 tabular-nums">
                                {((job.recordsProcessed as number) ?? 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{dur}</td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteJob(job.jobId as string); }}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </button>
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
          )}

          {/* ── Schedules Tab ─────────────────────────────────────────────────── */}
          {tab === "schedules" && (
            <Card>
              <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Schedules</CardTitle>
                <button
                  onClick={() => setShowScheduleForm((v) => !v)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-primary text-white hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Schedule
                </button>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {showScheduleForm && (
                  <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Job Type</label>
                        <select
                          value={schedType}
                          onChange={(e) => setSchedType(e.target.value)}
                          className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                        >
                          {ALL_JOBS.map((jt) => (
                            <option key={jt.value} value={jt.value}>{jt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Cron Expression</label>
                        <select
                          value={schedCron}
                          onChange={(e) => setSchedCron(e.target.value)}
                          className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                        >
                          {CRON_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{schedCron}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Label (optional)</label>
                        <input
                          value={schedLabel}
                          onChange={(e) => setSchedLabel(e.target.value)}
                          placeholder="e.g. Daily Enrichment"
                          className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Limit</label>
                        <input
                          type="number"
                          value={schedLimit}
                          onChange={(e) => setSchedLimit(Number(e.target.value))}
                          className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={createSchedule} className="px-3 py-1.5 rounded bg-primary text-white text-xs font-medium hover:opacity-90">Create</button>
                      <button onClick={() => setShowScheduleForm(false)} className="px-3 py-1.5 rounded bg-muted text-xs hover:bg-muted/80">Cancel</button>
                    </div>
                  </div>
                )}
                {schedules.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    No schedules yet — automate your ETL pipeline!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {schedules.map((s: Record<string, unknown>) => {
                      const isEnabled = !!s.enabled;
                      const lastRun   = s.lastRun ? new Date(s.lastRun as string).toLocaleString("vi-VN") : "Never";
                      return (
                        <div
                          key={s.scheduleId as string}
                          className={`p-3 rounded-lg border transition-colors ${
                            isEnabled
                              ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                              : "border-border bg-muted/10"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium">
                                  {s.label as string || (s.jobType as string)?.replace(/_/g, " ")}
                                </p>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                  isEnabled
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                }`}>
                                  {isEnabled ? "● active" : "○ paused"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                                  {s.cron as string}
                                </code>
                                <span className="text-xs text-muted-foreground capitalize">
                                  {(s.jobType as string)?.replace(/_/g, " ")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  · limit {(s.limit as number)?.toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">Last run: {lastRun}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => runScheduleNow(s)}
                                disabled={triggering}
                                title="Run now"
                                className="flex items-center gap-1 px-2 py-1.5 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                              >
                                <Play className="w-3 h-3" /> Run
                              </button>
                              <button
                                onClick={() => toggleSchedule(s.scheduleId as string, isEnabled)}
                                title={isEnabled ? "Pause schedule" : "Enable schedule"}
                                className={`p-1.5 rounded transition-colors ${
                                  isEnabled
                                    ? "text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900"
                                    : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                }`}
                              >
                                {isEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                              </button>
                              <button
                                onClick={() => deleteSchedule(s.scheduleId as string)}
                                title="Delete schedule"
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Review Tab ────────────────────────────────────────────────────── */}
          {tab === "review" && (
            <Card>
              <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Pending Review
                  <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                    {reviewCount}
                  </span>
                </CardTitle>
                <button
                  onClick={fetchReview}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </CardHeader>
              <CardContent className="p-0">
                {reviewLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : pendingReview.length === 0 ? (
                  <div className="py-14 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">All clear! No POIs waiting for review.</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                      During Silver→Gold, records with quality score 0.3–0.5 are queued here for manual approval or rejection.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {["Name", "City", "Category", "Score", "Sources", "Actions"].map((h) => (
                            <th key={h} className="text-left text-xs font-medium text-muted-foreground px-3 py-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingReview.map((poi: Record<string, unknown>) => {
                          const score = (poi.quality_score as number) ?? 0;
                          const scoreColor = score >= 0.5 ? "text-green-600" : score >= 0.3 ? "text-yellow-600" : "text-red-500";
                          return (
                            <tr key={poi.u_key as string} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                              <td className="px-3 py-2">
                                <div className="text-xs font-medium max-w-[160px] truncate">{poi.name as string || "—"}</div>
                                {!!poi.address && (
                                  <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">{String(poi.address)}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground capitalize">
                                {(poi.city as string)?.replace("_", " ")}
                              </td>
                              <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{poi.category as string}</td>
                              <td className="px-3 py-2">
                                <span className={`text-xs font-mono font-medium ${scoreColor}`}>
                                  {Math.round(score * 100)}%
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex gap-1">
                                  {((poi.data_sources as string[]) || []).map((src) => (
                                    <span key={src} className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
                                      {src}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex gap-1">
                                  <button
                                    title="Approve → Gold"
                                    onClick={() => approveReview(poi.u_key as string)}
                                    className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
                                  >
                                    <ThumbsUp className="w-3.5 h-3.5 text-green-600" />
                                  </button>
                                  <button
                                    title="Reject"
                                    onClick={() => rejectReview(poi.u_key as string)}
                                    className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                                  >
                                    <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
                                  </button>
                                </div>
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
          )}

          {/* Job detail drawer */}
          {selectedJob && tab === "jobs" && (
            <Card>
              <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">
                  Job #{jobs.length - jobs.findIndex((j) => j.jobId === selectedJob.jobId)} — Logs
                </CardTitle>
                <button onClick={() => setSelectedJob(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  Close
                </button>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="bg-muted/30 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
                  {((selectedJob.logs as { ts: string; level: string; msg: string }[]) || []).length === 0 ? (
                    <p className="text-muted-foreground">No logs yet…</p>
                  ) : (
                    (selectedJob.logs as { ts: string; level: string; msg: string }[]).map((log, i) => (
                      <div key={i} className={`flex gap-2 ${log.level === "error" ? "text-red-500" : log.level === "warn" ? "text-yellow-600" : "text-foreground"}`}>
                        <span className="text-muted-foreground shrink-0">{new Date(log.ts).toLocaleTimeString()}</span>
                        <span>{log.msg}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
