import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

export function FirebaseConfigAlert() {
  const [hostname, setHostname] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const checkDomain = () => {
      // Get the hostname
      const currentHostname = window.location.hostname;
      setHostname(currentHostname);
      
      // Get the project ID from env vars
      const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      setProjectId(firebaseProjectId);

      // Check if it's a Replit domain
      const isReplitDomain = currentHostname.includes('.replit.dev') || 
                             currentHostname.includes('.repl.co') || 
                             currentHostname.includes('.replit.app');
      
      setShowAlert(isReplitDomain);
    };
    
    checkDomain();
  }, []);

  if (!showAlert) return null;

  return (
    <Alert variant="warning" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Firebase Domain Configuration Required</AlertTitle>
      <AlertDescription className="text-sm">
        <p className="mb-2">
          You need to add <strong>{hostname}</strong> to your Firebase authorized domains list for Google authentication to work.
        </p>
        <ol className="list-decimal pl-4 space-y-1">
          <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Firebase Console</a></li>
          <li>Select the project <strong>{projectId}</strong></li>
          <li>Navigate to Authentication &gt; Settings &gt; Authorized domains</li>
          <li>Click "Add domain" and add <strong>{hostname}</strong></li>
          <li>Save your changes</li>
        </ol>
      </AlertDescription>
    </Alert>
  );
}