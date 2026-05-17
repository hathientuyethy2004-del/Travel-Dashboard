import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, MapPin, BarChart2, Star, GitBranch, FileText, Menu, X
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/lib/theme-provider";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/pois", label: "POI Explorer", icon: MapPin },
  { path: "/analytics", label: "Analytics", icon: BarChart2 },
  { path: "/recommendations", label: "Recommendations", icon: Star },
  { path: "/pipeline", label: "Pipeline", icon: GitBranch },
  { path: "/reports", label: "Reports", icon: FileText },
];

export function Nav() {
  const [location] = useLocation();
  const { isDark } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:flex items-center gap-1 px-6 py-2 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40 print:hidden">
        <div className="flex items-center gap-2 mr-6">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0079F2, #0d9488)" }}>
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">Smart Travel</span>
        </div>
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = path === "/" ? location === "/" : location.startsWith(path);
          return (
            <Link key={path} href={path}>
              <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Mobile top bar */}
      <nav className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card sticky top-0 z-40 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0079F2, #0d9488)" }}>
            <MapPin className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm">Smart Travel</span>
        </div>
        <button onClick={() => setMobileOpen((o) => !o)} className="p-1.5 rounded hover:bg-muted transition-colors">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>
      {mobileOpen && (
        <div className="md:hidden fixed top-[53px] inset-x-0 z-30 bg-card border-b border-border shadow-lg print:hidden">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = path === "/" ? location === "/" : location.startsWith(path);
            return (
              <Link key={path} href={path}>
                <button onClick={() => setMobileOpen(false)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                  }`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
