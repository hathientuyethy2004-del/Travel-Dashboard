import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { Nav } from "@/components/Nav";
import Dashboard from "@/pages/Dashboard";
import Pois from "@/pages/Pois";
import Analytics from "@/pages/Analytics";
import Recommendations from "@/pages/Recommendations";
import Pipeline from "@/pages/Pipeline";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <>
      <Nav />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/pois" component={Pois} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/recommendations" component={Recommendations} />
        <Route path="/pipeline" component={Pipeline} />
        <Route path="/reports" component={Reports} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
