import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  runTransaction,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgIL1m6WvO9H23EJ1RUxd_gzAiVnnnWEo",
  authDomain: "janken-game-69aa6.firebaseapp.com",
  projectId: "janken-game-69aa6",
  storageBucket: "janken-game-69aa6.firebasestorage.app",
  messagingSenderId: "676529713314",
  appId: "1:676529713314:web:3e127ae463d68a250a27fb",
  measurementId: "G-BK85KK19FG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
  db, doc, getDoc, setDoc, runTransaction, onSnapshot,
  collection, addDoc, query, orderBy, limit, serverTimestamp
};
