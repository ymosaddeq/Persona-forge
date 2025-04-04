import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
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

// Sign in with Google using popup
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const idToken = await user.getIdToken();
    
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
      throw new Error('Failed to authenticate with server');
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error signing in with Google:", error);
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