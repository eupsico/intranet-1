// Arquivo: assets/js/firebase-init.js
// Versão: 9.5 (Corrigido - Adiciona exports)

// 1. Importa as funções de inicialização e os serviços
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
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
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

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
const storage = getStorage(app);
const database = getDatabase(app);
const functions = getFunctions(app, "southamerica-east1");

// ✅ 5. TORNA DISPONÍVEL GLOBALMENTE (para módulos que não usam import)
window.db = db;
window.auth = auth;
window.storage = storage;
window.functions = functions;

console.log("✅ Firebase inicializado com sucesso!");
console.log("✅ window.db definido:", !!window.db);
console.log("✅ window.auth definido:", !!window.auth);

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

  // Funções de Storage
  getStorage,

  // Funções de Database
  getDatabase,

  // Funções de Functions
  getFunctions,
  httpsCallable,
};
