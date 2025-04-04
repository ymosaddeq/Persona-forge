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
  const isReplit = window.location.hostname.includes('.replit.dev') || 
                  window.location.hostname.includes('.repl.co') || 
                  window.location.hostname.includes('.replit.app');
  
  // If we're on Replit, we need to use the current domain
  const authDomain = isReplit 
    ? window.location.hostname 
    : `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`;
  
  console.log("Using auth domain:", authDomain);
  
  return {
    authDomain,
    isReplit
  };
};

const { authDomain } = getReplicateCompatibleSettings();

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
          throw new Error("Firebase authentication is not properly configured for this domain. Please contact support.");
        } else if (firebaseError.code === 'auth/popup-blocked') {
          throw new Error("Popup was blocked by your browser. Please allow popups for this site.");
        } else if (firebaseError.code === 'auth/cancelled-popup-request') {
          throw new Error("Authentication was cancelled. Please try again.");
        } else if (firebaseError.code === 'auth/network-request-failed') {
          throw new Error("Network error. Please check your internet connection and try again.");
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
      const errorText = await response.text();
      console.error("Server authentication failed:", response.status, errorText);
      throw new Error(`Failed to authenticate with server: ${response.status} ${errorText}`);
    }
    
    const userData = await response.json();
    console.log("Server authentication successful");
    return userData;
  } catch (error) {
    console.error("Error handling redirect result:", error);
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