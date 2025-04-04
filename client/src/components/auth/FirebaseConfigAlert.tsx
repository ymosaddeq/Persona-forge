import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink } from "lucide-react";
import { Button } from "../ui/button";

export function FirebaseConfigAlert() {
  const hostname = window.location.hostname;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  
  // Only show this for Replit domains
  if (!hostname.includes('.replit.dev') && !hostname.includes('.repl.co') && !hostname.includes('.replit.app')) {
    return null;
  }
  
  const openFirebaseConsole = () => {
    window.open('https://console.firebase.google.com/', '_blank');
  };
  
  return (
    <Alert className="mb-4 bg-amber-50 border-amber-200">
      <AlertTitle className="text-amber-800 font-bold flex items-center">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 mr-2 text-amber-600" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
          />
        </svg>
        Google Login Configuration Required
      </AlertTitle>
      <AlertDescription className="text-amber-700 mt-2">
        <p className="mb-2">
          To use Google login, this domain needs to be added to Firebase&apos;s authorized domains:
        </p>
        <p className="font-mono text-xs mb-3 bg-amber-100 p-2 rounded border border-amber-200">
          {hostname}
        </p>
        <ol className="list-decimal pl-5 mb-3 space-y-1">
          <li>Go to Firebase Console</li>
          <li>Select project: {projectId || 'your project'}</li>
          <li>Go to Authentication → Settings → Authorized domains</li>
          <li>Add this domain to the list</li>
        </ol>
        <Button 
          variant="outline" 
          className="mt-1 text-amber-800 border-amber-300 hover:bg-amber-100"
          onClick={openFirebaseConsole}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open Firebase Console
        </Button>
      </AlertDescription>
    </Alert>
  );
}