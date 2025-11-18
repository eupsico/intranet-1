/**
 * Arquivo: modulos/rh/js/tabs/entrevistas/helpers.js
 * Versão: 1.0.0 (Módulo Refatorado)
 * Data: 05/11/2025
 * Descrição: Funções utilitárias compartilhadas pelos módulos de entrevista.
 */

import {
  auth,
  db,
  doc,
  getDoc,
} from "../../../../../assets/js/firebase-init.js";

/**
 * Helper function para buscar o NOME do usuário logado na coleção 'usuarios'.
 */
export async function getCurrentUserName() {
  try {
    const user = auth.currentUser;
    if (!user) {
      return "rh_system_user (Não autenticado)";
    }
    const userDocRef = doc(db, "usuarios", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      return userData.nome || userData.email || user.uid;
    } else {
      return user.email || user.uid;
    }
  } catch (error) {
    console.error("Erro ao buscar nome do usuário:", error);
    return "rh_system_user (Erro)";
  }
}

/**
 * Helper function para formatar data (CORRIGIDA)
 */
export function formatarDataEnvio(timestamp) {
  if (!timestamp) return "N/A";
  let date;
  try {
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
      // 1. Caso: É um Timestamp "ao vivo" do Firebase
      date = timestamp.toDate();
    } else if (typeof timestamp === "string") {
      // 2. Caso: É uma string ISO
      date = new Date(timestamp);
    } else if (timestamp.seconds && typeof timestamp.seconds === "number") {
      // 3. Caso: É um objeto Timestamp serializado (v9+)
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp._seconds && typeof timestamp._seconds === "number") {
      // 4. Caso: É um objeto Timestamp serializado (Legado)
      date = new Date(timestamp._seconds * 1000);
    } else if (timestamp instanceof Date) {
      // 5. Caso: Já é um objeto Date
      date = timestamp;
    } else if (typeof timestamp === "number") {
      // 6. Caso: É um número Unix
      date = new Date(timestamp * 1000);
    } else {
      console.warn("Formato de data não reconhecido:", timestamp);
      return "N/A";
    }

    if (isNaN(date.getTime())) {
      console.warn("Data inválida após conversão:", timestamp);
      return "Data Inválida";
    }

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("Erro ao formatar data:", error, timestamp);
    return "Erro na data";
  }
}
