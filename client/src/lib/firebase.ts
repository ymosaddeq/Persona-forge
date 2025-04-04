import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult,
  signOut, 
  User as FirebaseUser, 
  browserLocalPersistence, 
  setPersistence
} from "firebase/auth";

// Get the Replit hostname for authorization
const getReplicateCompatibleSettings = () => {
  // Check if we're on Replit
  const isReplit = window.location.hostname.includes('.replit.dev') || 
                  window.location.hostname.includes('.repl.co') || 
                  window.location.hostname.includes('.replit.app');
  
  // Get the full current URL for logging
  const currentUrl = window.location.href;
  console.log("Current application URL:", currentUrl);
  
  // Get the hostname
  const hostname = window.location.hostname;
  console.log("Current hostname:", hostname);
  
  // If we're on Replit, we need to use the current domain
  // Otherwise use the Firebase default domain
  const authDomain = isReplit 
    ? hostname 
    : `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`;
  
  console.log("Using auth domain:", authDomain);
  
  return {
    authDomain,
    isReplit,
    hostname
  };
};

const { authDomain, hostname } = getReplicateCompatibleSettings();

// Display a warning if we detect we're in a Replit environment
if (hostname.includes('.replit.dev') || hostname.includes('.repl.co')) {
  console.warn(`
    IMPORTANT: For Google authentication to work, you must add 
    "${hostname}" to your Firebase Console's authorized domains list.
    Go to: Firebase Console > Authentication > Settings > Authorized domains
  `);
}

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Log the configuration (without sensitive parts)
console.log("Firebase configuration:", {
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket
});

// Initialize Firebase only if it hasn't been initialized yet
let app: ReturnType<typeof initializeApp>;
let auth: ReturnType<typeof getAuth> | null = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Set persistence to LOCAL to remember the user between sessions
  setPersistence(auth, browserLocalPersistence)
    .catch(error => console.error("Error setting persistence:", error));
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export { auth };

// Google provider for authentication
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Sign in with Google using redirect (better for Replit environment)
export async function signInWithGoogle() {
  if (!auth) {
    throw new Error("Firebase auth is not initialized");
  }
  
  try {
    // Log the Firebase config being used (without sensitive values)
    console.log("Starting Google login flow...");
    console.log("Firebase project ID:", import.meta.env.VITE_FIREBASE_PROJECT_ID);
    console.log("Auth domain used:", authDomain);
    
    // Start the redirect flow - this will navigate away from the page
    await signInWithRedirect(auth, googleProvider);
    // The function won't continue past this point until the user is redirected back
    console.log("Redirect initiated"); // This won't execute until after redirect back
  } catch (error) {
    console.error("Google login error:", error);
    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      
      if ('code' in error) {
        const firebaseError = error as { code: string };
        console.error("Firebase error code:", firebaseError.code);
        
        // Provide more specific error messages based on Firebase error codes
        if (firebaseError.code === 'auth/configuration-not-found') {
          // This is a common error when the domain isn't added to Firebase authorized domains
          console.error(`
            ======================================
            CRITICAL FIREBASE CONFIGURATION ERROR
            ======================================
            Your domain "${hostname}" is not authorized in the Firebase Console.
            
            To fix this:
            1. Go to the Firebase Console: https://console.firebase.google.com/
            2. Select your project: "${import.meta.env.VITE_FIREBASE_PROJECT_ID}"
            3. Go to Authentication > Settings > Authorized domains
            4. Add "${hostname}" to the list of authorized domains
            5. Save changes and try again
            ======================================
          `);
          throw new Error(
            "Firebase authentication is not configured for this domain. You need to add this domain to Firebase authorized domains list."
          );
        } else if (firebaseError.code === 'auth/popup-blocked') {
          throw new Error("Popup was blocked by your browser. Please allow popups for this site.");
        } else if (firebaseError.code === 'auth/cancelled-popup-request') {
          throw new Error("Authentication was cancelled. Please try again.");
        } else if (firebaseError.code === 'auth/network-request-failed') {
          throw new Error("Network error. Please check your internet connection and try again.");
        } else if (firebaseError.code === 'auth/invalid-api-key') {
          throw new Error("Invalid Firebase API key. Please check your environment variables.");
        }
      }
    }
    
    // Rethrow the original error if no specific case was matched
    throw error;
  }
}

// Handle the redirect result when the user comes back
export async function handleRedirectResult() {
  if (!auth) {
    console.error("Firebase auth is not initialized");
    return null;
  }
  
  try {
    console.log("Checking for redirect result...");
    const result = await getRedirectResult(auth);
    
    if (!result) {
      console.log("No redirect result found");
      return null; // No redirect result
    }
    
    console.log("Redirect result found, user authenticated with Firebase");
    const user = result.user;
    console.log("Getting ID token for user:", user.email);
    const idToken = await user.getIdToken();
    
    console.log("Sending token to backend for verification");
    // Send token to backend for verification and login
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important for session cookies
      body: JSON.stringify({ token: idToken }),
    });
    
    if (!response.ok) {
      // Try to get the error message
      let errorMessage = "Authentication failed";
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        try {
          errorMessage = await response.text();
        } catch (e2) {
          // If we can't parse JSON or get text, use status code
          errorMessage = `Error ${response.status}: Authentication failed`;
        }
      }
      
      console.error("Server authentication failed:", errorMessage);
      throw new Error(errorMessage);
    }
    
    const userData = await response.json();
    console.log("Server authentication successful, user data:", userData);
    return userData;
  } catch (error) {
    console.error("Error handling redirect result:", error);
    // Display more comprehensive error information
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error;
  }
}

// Sign out
export async function signOutFirebase() {
  if (!auth) {
    console.error("Firebase auth is not initialized");
    return;
  }
  
  try {
    await signOut(auth);
    // Call server-side logout endpoint
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}

// Get current auth user
export function getCurrentUser(): FirebaseUser | null {
  if (!auth) {
    console.error("Firebase auth is not initialized");
    return null;
  }
  return auth.currentUser;
}