import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDTWB3W-TJR5XZOkGxFvvwWSMDD78DpnhU",
  authDomain: "frota-control-8fa7c.firebaseapp.com",
  projectId: "frota-control-8fa7c",
  storageBucket: "frota-control-8fa7c.firebasestorage.app",
  messagingSenderId: "90684991145",
  appId: "1:90684991145:web:1ce1114d5fe4002340abb8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
