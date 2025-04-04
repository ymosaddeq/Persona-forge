import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK
const serviceAccount: ServiceAccount = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : undefined
};

// Initialize the Firebase Admin SDK
const firebaseApp = initializeApp({
  credential: cert(serviceAccount)
});

// Export auth for use in other files
export const auth = getAuth(firebaseApp);

// Function to verify Firebase ID token
export async function verifyFirebaseToken(idToken: string) {
  try {
    console.log("Verifying Firebase token...");
    const decodedToken = await auth.verifyIdToken(idToken);
    console.log("Token verified successfully for user:", decodedToken.email);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      if ('code' in error) {
        console.error("Error code:", (error as any).code);
      }
    }
    return null;
  }
}