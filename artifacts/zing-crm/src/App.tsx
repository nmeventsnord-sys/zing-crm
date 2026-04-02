import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import AddContact from "@/pages/AddContact";
import ContactsList from "@/pages/ContactsList";
import ContactDetail from "@/pages/ContactDetail";
import QuoteBuilder from "@/pages/QuoteBuilder";
import CreateQuote from "@/pages/CreateQuote";
import QuotesList from "@/pages/QuotesList";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 30000 },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/contacts/add" component={AddContact} />
        <Route path="/contacts/:id/quote" component={QuoteBuilder} />
        <Route path="/contacts/:id" component={ContactDetail} />
        <Route path="/contacts" component={ContactsList} />
        <Route path="/quotes/create" component={CreateQuote} />
        <Route path="/quotes" component={QuotesList} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  useEffect(() => {
    console.log("[ZingCRM] App mounted — checking API health...");
    fetch("/api/health")
      .then(async (res) => {
        const text = await res.text();
        console.log("[ZingCRM] /api/health status:", res.status, "ok:", res.ok, "body:", text);
        if (!res.ok) {
          console.warn("[ZingCRM] API health check failed — PDF will use browser fallback");
        }
      })
      .catch((err) => {
        console.error("[ZingCRM] /api/health fetch error:", err);
        console.warn("[ZingCRM] API unreachable — PDF will use browser fallback");
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
