// Arquivo: /modulos/voluntario/js/detalhes-paciente/conexao-db.js
// Responsável por exportar as funções e objetos do Firebase Firestore.

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
} from "../../../assets/js/firebase-init.js";

// Reexporta tudo para ser usado por outros módulos de 'detalhes-paciente'
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
};
