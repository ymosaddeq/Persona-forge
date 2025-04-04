import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { SiGoogle } from "react-icons/si";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function GoogleLoginButton({ className }: { className?: string }) {
  const { googleLoginMutation, handleGoogleLogin } = useAuth();
  const { toast } = useToast();
  const [isReadyForAuth, setIsReadyForAuth] = useState(false);
  
  // Check if Firebase is properly configured
  useEffect(() => {
    const checkFirebaseConfig = () => {
      // Check required environment variables
      const viteFirebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const viteFirebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      const viteFirebaseAppId = import.meta.env.VITE_FIREBASE_APP_ID;
      
      if (!viteFirebaseApiKey || !viteFirebaseProjectId || !viteFirebaseAppId) {
        toast({
          title: "Firebase configuration issue",
          description: "Missing Firebase environment variables. Please check your configuration.",
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    };
    
    setIsReadyForAuth(checkFirebaseConfig());
  }, [toast]);
  
  const handleClick = () => {
    if (!isReadyForAuth) {
      toast({
        title: "Google Sign-In Unavailable",
        description: "Firebase configuration is incomplete. Please add the required environment variables.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      handleGoogleLogin();
    } catch (error) {
      console.error("Error starting Google login:", error);
      toast({
        title: "Google Sign-In Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Button 
      type="button"
      variant="outline"
      className={`w-full ${className || ''}`}
      onClick={handleClick}
      disabled={googleLoginMutation.isPending || !isReadyForAuth}
    >
      {googleLoginMutation.isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting with Google...
        </>
      ) : (
        <>
          <SiGoogle className="mr-2 h-4 w-4" />
          Continue with Google
        </>
      )}
    </Button>
  );
}