import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import PersonaEditor from "@/pages/PersonaEditor";
import Chat from "@/pages/Chat";
import { PersonaProvider } from "@/contexts/PersonaContext";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";

function Router() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-auto focus:outline-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/personas/new" component={PersonaEditor} />
              <Route path="/personas/:id/edit" component={PersonaEditor} />
              <Route path="/chat/:id" component={Chat} />
              <Route component={NotFound} />
            </Switch>
          </div>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PersonaProvider>
        <Router />
        <Toaster />
      </PersonaProvider>
    </QueryClientProvider>
  );
}

export default App;
