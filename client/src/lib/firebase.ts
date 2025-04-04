import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithRedirect, 
  getRedirectResult,
  signOut, 
  User as FirebaseUser 
} from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Google provider for authentication
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Sign in with Google using redirect (better for Replit environment)
export async function signInWithGoogle() {
  try {
    // Log the Firebase config being used (without sensitive values)
    console.log("Firebase project ID:", import.meta.env.VITE_FIREBASE_PROJECT_ID);
    console.log("Auth domain:", `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`);
    
    // Start the redirect flow - this will navigate away from the page
    await signInWithRedirect(auth, googleProvider);
    // The function won't continue past this point until the user is redirected back
  } catch (error) {
    console.error("Google login error:", error);
    throw error;
  }
}

// Handle the redirect result when the user comes back
export async function handleRedirectResult() {
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
  return auth.currentUser;
}