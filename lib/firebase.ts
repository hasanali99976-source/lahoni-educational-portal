import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBOCF2lkmKObohF_SzU5YxnJ0cJj7bneNs",
  authDomain: "tahdheeb-history.firebaseapp.com",
  projectId: "tahdheeb-history",
  storageBucket: "tahdheeb-history.firebasestorage.app",
  messagingSenderId: "644828218895",
  appId: "1:644828218895:web:efaf05fe4c6e06592b057a",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
