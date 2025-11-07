// Arquivo: assets/js/firebase-init.js
// Versão: 9.4 (Corrigido para sintaxe correta de importação de functions)

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
import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js"; // CORREÇÃO: Removido getFunctionsInstance
import { getStorage } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// 2. Sua configuração do Firebase (sem alterações)
const firebaseConfig = {
  apiKey: "AIzaSyDJqPJjDDIGo7uRewh3pw1SQZOpMgQJs5M",
  authDomain: "eupsico-agendamentos-d2048.firebaseapp.com",
  databaseURL: "https://eupsico-agendamentos-d2048-default-rtdb.firebaseio.com",
  projectId: "eupsico-agendamentos-d2048",
  storageBucket: "eupsico-agendamentos-d2048.appspot.com",
  messagingSenderId: "1041518416343",
  appId: "1:1041518416343:web:087006662ffcfa12d7bb92",
};

// 3. Inicializa os serviços do Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app); // Instância de Functions
const storage = getStorage(app);
const rtdb = getDatabase(app);

// 4. Exporta todos os serviços e funções necessárias para os outros módulos
export {
  app,
  auth,
  db,
  functions, // Exporta a instância
  storage,
  rtdb,
  onAuthStateChanged,
  httpsCallable, // Exporta a função callable
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
  getAuth,
};
