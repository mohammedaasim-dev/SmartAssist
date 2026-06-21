import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configured securely based on the sandbox credentials
const firebaseConfig = {
  apiKey: "AIzaSyBSqbnJDyM4H3aalUPRHefFczKkI5_9ugU",
  authDomain: "study-app-23be3.firebaseapp.com",
  projectId: "study-app-23be3",
  storageBucket: "study-app-23be3.firebasestorage.app",
  messagingSenderId: "674350304401",
  appId: "1:674350304401:web:b31d2f78d1da9764064330",
  measurementId: "G-X24ZY2KY0G"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Authentication Providers
export const googleProvider = new GoogleAuthProvider();
export const microsoftProvider = new OAuthProvider("microsoft.com");
