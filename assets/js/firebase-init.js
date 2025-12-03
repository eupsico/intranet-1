// Arquivo: assets/js/firebase-init.js
// Versão: 9.6 (Atualizado e Padronizado para 9.22.1 para corrigir conflito de versões)

// 1. Importa as funções de inicialização e os serviços
// IMPORTANTE: Todas as URLs foram atualizadas para 9.22.1 para garantir compatibilidade
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

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
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// 2. Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDJqPJjDDIGo7uRewh3pw1SQZOpMgQJs5M",
  authDomain: "eupsico-agendamentos-d2048.firebaseapp.com",
  databaseURL: "https://eupsico-agendamentos-d2048-default-rtdb.firebaseio.com",
  projectId: "eupsico-agendamentos-d2048",
  storageBucket: "eupsico-agendamentos-d2048.appspot.com",
  messagingSenderId: "1041518416343",
  appId: "1:1041518416343:web:087006662ffcfa12d7bb92",
};

// 3. Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// 4. Inicializa os serviços
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Agora funcionará pois o 'app' é da mesma versão
const database = getDatabase(app);
const functions = getFunctions(app, "us-central1");

// ✅ 5. TORNA DISPONÍVEL GLOBALMENTE (para módulos que não usam import)
window.db = db;
window.auth = auth;
window.storage = storage;
window.functions = functions;

console.log("✅ Firebase inicializado com sucesso (v9.22.1)!");

// ✅ 6. EXPORTA TUDO (para módulos que usam import)
export {
  // Instâncias
  app,
  auth,
  db,
  storage,
  database,
  functions,

  // Funções de Auth
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,

  // Funções de Firestore
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

  // Funções de Storage
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,

  // Funções de Database
  getDatabase,

  // Funções de Functions
  getFunctions,
  httpsCallable,
};
