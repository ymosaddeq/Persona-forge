// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "",
  authDomain: "persona-forge-72d1f.firebaseapp.com",
  projectId: "persona-forge-72d1f",
  storageBucket: "persona-forge-72d1f.firebasestorage.app",
  messagingSenderId: "411869721406",
  appId: "1:411869721406:web:faf12d61ff8b3be3c1326f",
  measurementId: "G-JPHH6CKNWF",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
