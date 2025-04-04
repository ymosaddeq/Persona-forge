import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { SiGoogle } from "react-icons/si";
import { Loader2 } from "lucide-react";

export function GoogleLoginButton({ className }: { className?: string }) {
  const { googleLoginMutation } = useAuth();
  
  const handleGoogleLogin = () => {
    googleLoginMutation.mutate();
  };
  
  return (
    <Button 
      type="button"
      variant="outline"
      className={`w-full ${className || ''}`}
      onClick={handleGoogleLogin}
      disabled={googleLoginMutation.isPending}
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