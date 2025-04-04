import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import PersonaEditor from "@/pages/PersonaEditor";
import Chat from "@/pages/Chat";
import AuthPage from "@/pages/AuthPage";
import { PersonaProvider } from "@/contexts/PersonaContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import { useEffect } from "react";
import { handleRedirectResult } from "./lib/firebase";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-auto focus:outline-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <ProtectedRoute 
        path="/" 
        component={() => (
          <AppLayout>
            <Dashboard />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/personas/new" 
        component={() => (
          <AppLayout>
            <PersonaEditor />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/personas/:id/edit" 
        component={({ params }) => (
          <AppLayout>
            <PersonaEditor />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/chat/:id" 
        component={({ params }) => (
          <AppLayout>
            <Chat />
          </AppLayout>
        )} 
      />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Handle Firebase authentication redirect on app load
  useEffect(() => {
    // Log that we're handling the redirect
    console.log("Checking for Firebase redirect result...");
    
    // This will process any pending Firebase redirect sign-in
    handleRedirectResult()
      .then((user) => {
        if (user) {
          // Successfully signed in and received user data from server
          console.log("User signed in after redirect:", user);
          // Update the user data in React Query cache
          queryClient.setQueryData(["/api/user"], user);
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        } else {
          console.log("No redirect result found or user already authenticated");
        }
      })
      .catch((error) => {
        console.error("Error handling redirect:", error);
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PersonaProvider>
          <Router />
          <Toaster />
        </PersonaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
