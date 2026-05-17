import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play, RefreshCw, Clock, CheckCircle2, XCircle, Loader2,
  Plus, Trash2, GitBranch, ThumbsUp, ThumbsDown, AlertCircle,
} from "lucide-react";
import { Link } from "wouter";

const API = "/api";

const JOB_TYPES = [
  { value: "collect_osm",               label: "🌍 Collect OSM",                desc: "Collect raw POI data from OpenStreetMap" },
  { value: "collect_google_places",      label: "🗺️ Collect Google Places",      desc: "Discover POIs directly via Google Places Text Search" },
  { value: "enrich_google",             label: "🔍 Enrich Google",              desc: "Enrich OSM POIs with Google Places data (fuzzy name match)" },
  { value: "retry_failed_enrichments",  label: "🔁 Retry Failed Enrichments",   desc: "Retry enrichment for records that previously had no name match" },
  { value: "bronze_to_silver",          label: "🔄 Bronze → Silver",            desc: "Normalize and score bronze layer records" },
  { value: "silver_to_gold",            label: "⭐ Silver → Gold",               desc: "Promote quality-gated records; queues 0.3–0.5 for manual review" },
  { value: "reconcile",                 label: "🧹 Reconcile",                  desc: "Remove ghost records across Bronze/Silver/Gold" },
  { value: "full_pipeline",             label: "🚀 Full Pipeline",               desc: "Run all stages end-to-end" },
];

const CRON_PRESETS = [
  { label: "Every day at 2 AM",         value: "0 2 * * *" },
  { label: "Every day at midnight",     value: "0 0 * * *" },
  { label: "Every week (Monday 3 AM)",  value: "0 3 * * 1" },
  { label: "Every month (1st, 4 AM)",   value: "0 4 1 * *" },
];

function StatusIcon({ status }: { status: string }) {
  if (status === "running")   return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === "failed")    return <XCircle className="w-4 h-4 text-red-500" />;
  return <Clock className="w-4 h-4 text-yellow-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running:   "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    failed:    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    pending:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100"}`}>
      <StatusIcon status={status} /> {status}
    </span>
  );
}

function QualityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.5 ? "text-green-600" : score >= 0.3 ? "text-yellow-600" : "text-red-500";
  return <span className={`text-xs font-mono font-medium ${color}`}>{pct}%</span>;
}

export default function Pipeline() {
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [schedules, setSchedules] = useState<Record<string, unknown>[]>([]);
  const [etlStatus, setEtlStatus] = useState<Record<string, unknown> | null>(null);
  const [pendingReview, setPendingReview] = useState<Record<string, unknown>[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Record<string, unknown> | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [tab, setTab] = useState<"jobs" | "schedules" | "review">("jobs");

  // Dynamic config from API
  const [citiesList, setCitiesList] = useState<{ code: string; name: string }[]>([]);
  const [catsList, setCatsList] = useState<{ code: string }[]>([]);

  // Trigger form
  const [triggerType, setTriggerType] = useState("collect_osm");
  const [triggerCities, setTriggerCities] = useState<string[]>([]);
  const [triggerCats, setTriggerCats] = useState<string[]>([]);
  const [triggerLimit, setTriggerLimit] = useState(200);

  // Schedule form
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedType, setSchedType] = useState("collect_osm");
  const [schedCron, setSchedCron] = useState("0 2 * * *");
  const [schedLabel, setSchedLabel] = useState("");
  const [schedLimit, setSchedLimit] = useState(500);

  const fetchAll = useCallback(async () => {
    try {
      const [j, s, st, rc] = await Promise.all([
        fetch(`${API}/etl/jobs?limit=30`).then((r) => r.json()),
        fetch(`${API}/etl/schedules`).then((r) => r.json()),
        fetch(`${API}/etl/status`).then((r) => r.json()),
        fetch(`${API}/etl/review/count`).then((r) => r.json()),
      ]);
      setJobs(Array.isArray(j) ? j : []);
      setSchedules(Array.isArray(s) ? s : []);
      setEtlStatus(st);
      setReviewCount((rc as { count?: number })?.count ?? 0);
    } catch {
      // ETL service may be starting
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
    } catch {
      // ignore
    }
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

  useEffect(() => {
    fetchAll();
    fetchConfig();
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll, fetchConfig]);

  useEffect(() => {
    if (tab === "review") fetchReview();
  }, [tab, fetchReview]);

  async function triggerJob() {
    setTriggering(true);
    try {
      const r = await fetch(`${API}/etl/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: triggerType, cities: triggerCities, categories: triggerCats, limit: triggerLimit }),
      });
      const job = await r.json();
      if (r.status === 401) {
        alert("Authentication required to trigger jobs.");
        return;
      }
      setJobs((prev) => [job, ...prev]);
    } catch {
      alert("Failed to trigger job: ETL service may be starting");
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
    } catch {
      alert("Failed to create schedule");
    }
  }

  async function deleteSchedule(id: string) {
    await fetch(`${API}/etl/schedules/${id}`, { method: "DELETE" });
    setSchedules((prev) => prev.filter((s) => (s as Record<string, string>).scheduleId !== id));
  }

  async function deleteJob(id: string) {
    await fetch(`${API}/etl/jobs/${id}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => (j as Record<string, string>).jobId !== id));
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

  const statusSummary = (etlStatus as { jobs?: Record<string, number> } | null)?.jobs;

  return (
    <div className="px-6 pt-6 pb-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0079F2, #0d9488)" }}>
            <GitBranch className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-bold text-2xl">Pipeline Management</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-11">Trigger ETL jobs, track progress, manage schedules, and review borderline POIs</p>
      </div>

      {/* ETL Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Jobs",   key: "total",     color: "#0079F2" },
          { label: "Running",      key: "running",   color: "#0891b2" },
          { label: "Completed",    key: "completed", color: "#009118" },
          { label: "Failed",       key: "failed",    color: "#A60808" },
        ].map(({ label, key, color }) => (
          <Card key={key}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              {jobsLoading ? (
                <Skeleton className="h-7 w-12 mt-0.5" />
              ) : (
                <p className="text-xl font-bold mt-0.5" style={{ color }}>
                  {statusSummary ? (statusSummary[key] ?? 0) : 0}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trigger Panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" /> Trigger Job
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Job Type</label>
              <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {JOB_TYPES.map((jt) => <option key={jt.value} value={jt.value}>{jt.label}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">{JOB_TYPES.find((j) => j.value === triggerType)?.desc}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Cities (optional)</label>
              <div className="flex flex-wrap gap-1">
                {citiesList.map((c) => (
                  <button key={c.code} onClick={() => setTriggerCities((prev) => prev.includes(c.code) ? prev.filter((x) => x !== c.code) : [...prev, c.code])}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${triggerCities.includes(c.code) ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
                    {c.code}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Categories (optional)</label>
              <div className="flex flex-wrap gap-1">
                {catsList.map((c) => (
                  <button key={c.code} onClick={() => setTriggerCats((prev) => prev.includes(c.code) ? prev.filter((x) => x !== c.code) : [...prev, c.code])}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${triggerCats.includes(c.code) ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
                    {c.code}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Limit: {triggerLimit}</label>
              <input type="range" min={50} max={2000} step={50} value={triggerLimit} onChange={(e) => setTriggerLimit(Number(e.target.value))}
                className="w-full" />
            </div>
            <button onClick={triggerJob} disabled={triggering}
              className="w-full h-9 rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #0079F2, #0d9488)" }}>
              {triggering ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</> : <><Play className="w-4 h-4" /> Run Job</>}
            </button>
          </CardContent>
        </Card>

        {/* Jobs / Schedules / Review table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setTab("jobs")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "jobs" ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"}`}>
              Jobs ({jobs.length})
            </button>
            <button onClick={() => setTab("schedules")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "schedules" ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"}`}>
              Schedules ({schedules.length})
            </button>
            <button onClick={() => setTab("review")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "review" ? "bg-amber-500 text-white" : "bg-muted hover:bg-muted/80"}`}>
              <AlertCircle className="w-3.5 h-3.5" />
              Pending Review
              {reviewCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === "review" ? "bg-white text-amber-600" : "bg-amber-500 text-white"}`}>
                  {reviewCount}
                </span>
              )}
            </button>
            <button onClick={() => { fetchAll(); if (tab === "review") fetchReview(); }}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-muted hover:bg-muted/80 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* ── Jobs Tab ───────────────────────────────────────────────────── */}
          {tab === "jobs" && (
            <Card>
              <CardContent className="p-0">
                {jobsLoading ? (
                  <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : jobs.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">No jobs yet. Trigger your first job!</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {["ID", "Type", "Status", "Records", "Started", "Actions"].map((h) => (
                            <th key={h} className="text-left text-xs font-medium text-muted-foreground px-3 py-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map((job: Record<string, unknown>) => (
                          <tr key={job.jobId as string}
                            className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                            onClick={() => setSelectedJob(selectedJob?.jobId === job.jobId ? null : job)}>
                            <td className="px-3 py-2 font-mono text-xs">{job.jobId as string}</td>
                            <td className="px-3 py-2 text-xs">{(job.jobType as string)?.replace(/_/g, " ")}</td>
                            <td className="px-3 py-2"><StatusBadge status={job.status as string} /></td>
                            <td className="px-3 py-2 text-xs text-green-600">{(job.recordsProcessed as number)?.toLocaleString() ?? 0}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {job.startedAt ? new Date(job.startedAt as string).toLocaleTimeString() : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={(e) => { e.stopPropagation(); deleteJob(job.jobId as string); }}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors">
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Schedules Tab ──────────────────────────────────────────────── */}
          {tab === "schedules" && (
            <Card>
              <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Schedules</CardTitle>
                <button onClick={() => setShowScheduleForm((v) => !v)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-primary text-white hover:opacity-90 transition-opacity">
                  <Plus className="w-3.5 h-3.5" /> Add Schedule
                </button>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {showScheduleForm && (
                  <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Job Type</label>
                        <select value={schedType} onChange={(e) => setSchedType(e.target.value)}
                          className="w-full h-8 rounded border border-input bg-background px-2 text-xs">
                          {JOB_TYPES.map((jt) => <option key={jt.value} value={jt.value}>{jt.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Cron Expression</label>
                        <select value={schedCron} onChange={(e) => setSchedCron(e.target.value)}
                          className="w-full h-8 rounded border border-input bg-background px-2 text-xs">
                          {CRON_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{schedCron}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Label (optional)</label>
                        <input value={schedLabel} onChange={(e) => setSchedLabel(e.target.value)} placeholder="My Schedule"
                          className="w-full h-8 rounded border border-input bg-background px-2 text-xs" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Limit</label>
                        <input type="number" value={schedLimit} onChange={(e) => setSchedLimit(Number(e.target.value))}
                          className="w-full h-8 rounded border border-input bg-background px-2 text-xs" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={createSchedule} className="px-3 py-1.5 rounded bg-primary text-white text-xs font-medium hover:opacity-90">Create</button>
                      <button onClick={() => setShowScheduleForm(false)} className="px-3 py-1.5 rounded bg-muted text-xs hover:bg-muted/80">Cancel</button>
                    </div>
                  </div>
                )}
                {schedules.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">No schedules. Add one to automate ETL!</div>
                ) : (
                  <div className="space-y-2">
                    {schedules.map((s: Record<string, unknown>) => (
                      <div key={s.scheduleId as string} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                        <div>
                          <p className="text-sm font-medium">{s.label as string || (s.jobType as string)}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{s.cron as string}</code>
                            <span className="text-xs text-muted-foreground">{(s.jobType as string)?.replace(/_/g, " ")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${s.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {s.enabled ? "active" : "paused"}
                          </span>
                          <button onClick={() => deleteSchedule(s.scheduleId as string)} className="p-1 hover:bg-red-100 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Review Tab ─────────────────────────────────────────────────── */}
          {tab === "review" && (
            <Card>
              <CardHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Pending Review
                  <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-1.5 py-0.5 rounded-full">{reviewCount}</span>
                </CardTitle>
                <button onClick={fetchReview} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </CardHeader>
              <CardContent className="p-0">
                {reviewLoading ? (
                  <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : pendingReview.length === 0 ? (
                  <div className="py-14 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">All clear! No POIs waiting for review.</p>
                    <p className="text-xs text-muted-foreground mt-1">Records with quality score 0.3–0.5 from Silver→Gold will appear here.</p>
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
                        {pendingReview.map((poi: Record<string, unknown>) => (
                          <tr key={poi.u_key as string} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2">
                              <div className="text-xs font-medium max-w-[160px] truncate">{poi.name as string || "—"}</div>
                              {poi.address && <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">{poi.address as string}</div>}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{(poi.city as string)?.replace("_", " ")}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground capitalize">{poi.category as string}</td>
                            <td className="px-3 py-2">
                              <QualityBadge score={poi.quality_score as number ?? 0} />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                {((poi.data_sources as string[]) || []).map((src) => (
                                  <span key={src} className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">{src}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <button title="Approve → Gold" onClick={() => approveReview(poi.u_key as string)}
                                  className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900 transition-colors">
                                  <ThumbsUp className="w-3.5 h-3.5 text-green-600" />
                                </button>
                                <button title="Reject" onClick={() => rejectReview(poi.u_key as string)}
                                  className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-colors">
                                  <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
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
                <CardTitle className="text-sm">Job {selectedJob.jobId as string} — Logs</CardTitle>
                <button onClick={() => setSelectedJob(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="bg-muted/30 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
                  {((selectedJob.logs as { ts: string; level: string; msg: string }[]) || []).length === 0
                    ? <p className="text-muted-foreground">No logs yet...</p>
                    : ((selectedJob.logs as { ts: string; level: string; msg: string }[]) || []).map((log, i) => (
                      <div key={i} className={`flex gap-2 ${log.level === "error" ? "text-red-500" : log.level === "warn" ? "text-yellow-600" : "text-foreground"}`}>
                        <span className="text-muted-foreground shrink-0">{new Date(log.ts).toLocaleTimeString()}</span>
                        <span>{log.msg}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
