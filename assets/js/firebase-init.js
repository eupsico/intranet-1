// Arquivo: assets/js/firebase-init.js
// Versão: 10.8.0 (Padronizada para corrigir erro de Auth)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  arrayUnion,
  deleteField,
  onSnapshot,
  serverTimestamp,
  documentId,
  Timestamp,
  setDoc,
  writeBatch,
  FieldValue,
  arrayRemove,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJqPJjDDIGo7uRewh3pw1SQZOpMgQJs5M",
  authDomain: "eupsico-agendamentos-d2048.firebaseapp.com",
  databaseURL: "https://eupsico-agendamentos-d2048-default-rtdb.firebaseio.com",
  projectId: "eupsico-agendamentos-d2048",
  storageBucket: "eupsico-agendamentos-d2048.appspot.com",
  messagingSenderId: "1041518416343",
  appId: "1:1041518416343:web:087006662ffcfa12d7bb92",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const database = getDatabase(app);
const functions = getFunctions(app, "us-central1");

window.db = db;
window.auth = auth;
window.storage = storage;
window.functions = functions;

console.log("✅ Firebase v10.8.0 inicializado.");

export {
  app,
  auth,
  db,
  storage,
  database,
  functions,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  arrayUnion,
  deleteField,
  onSnapshot,
  serverTimestamp,
  documentId,
  Timestamp,
  setDoc,
  writeBatch,
  FieldValue,
  arrayRemove,
  runTransaction,
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  getDatabase,
  getFunctions,
  httpsCallable,
};
