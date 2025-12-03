// Arquivo: /modulos/voluntario/js/detalhes-paciente/conexao-db.js
// Responsável por exportar as funções e objetos do Firebase Firestore.

// Arquivo: /modulos/voluntario/js/detalhes-paciente/conexao-db.js
// Versão: 2.0 (Adicionado Storage e ArrayUnion)

import {
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  deleteDoc,
  // --- NOVOS IMPORTS ---
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  arrayUnion,
} from "../../../../assets/js/firebase-init.js";

// Reexporta tudo
export {
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  deleteDoc,
  // --- NOVOS EXPORTS ---
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  arrayUnion,
};
