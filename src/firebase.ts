import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDdx9OZl5LYagDdOhTXC4_3XsL4Hl2PC5Y",
  authDomain: "jcf-payroll.firebaseapp.com",
  projectId: "jcf-payroll",
  storageBucket: "jcf-payroll.firebasestorage.app",
  messagingSenderId: "317980613193",
  appId: "1:317980613193:web:b94655e6dcb2195a4cbd98",
  measurementId: "G-9SMDVN62VQ",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);