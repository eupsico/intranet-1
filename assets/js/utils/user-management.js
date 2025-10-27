// assets/js/utils/user-management.js

// Importa as funções de inicialização do Firebase
// O caminho é relativo de assets/js/utils/ para assets/js/firebase-init.js
import { db, collection, getDocs, query, where } from "../firebase-init.js";

const USUARIOS_COLLECTION = "usuarios";
const usuariosCollection = collection(db, USUARIOS_COLLECTION);

/**
 * Busca todos os colaboradores com status 'ativo'.
 * @returns {Promise<Array<Object>>} Uma lista de objetos de usuário ativos, incluindo o ID.
 */
export async function fetchActiveEmployees() {
  console.log("Buscando colaboradores ativos...");
  try {
    // Cria uma query para buscar usuários onde o campo 'status' é igual a 'ativo'
    const q = query(usuariosCollection, where("status", "==", "ativo"));
    const snapshot = await getDocs(q);

    const activeEmployees = [];
    snapshot.forEach((doc) => {
      activeEmployees.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(`Encontrados ${activeEmployees.length} colaboradores ativos.`);
    return activeEmployees;
  } catch (error) {
    console.error(
      "Erro ao buscar colaboradores ativos (fetchActiveEmployees):",
      error
    );
    // Em caso de falha, retorna um array vazio
    return [];
  }
}

/**
 * Busca usuários com base em um cargo ou função específica.
 * Pode ser usada para buscar Gestores (para aprovação de vagas) ou TI (para solicitações).
 * @param {string} role O valor do campo 'role' (ou outro campo que defina a função) a ser buscado.
 * @returns {Promise<Array<Object>>} Uma lista de objetos de usuário com a função especificada.
 */
export async function fetchUsersByRole(role) {
  if (!role) {
    console.warn("Função (role) não especificada para busca.");
    return [];
  }

  console.log(`Buscando usuários com a função: ${role}...`);
  try {
    // CORREÇÃO FINAL: Usa 'funcoes' (campo do banco) e 'array-contains'
    // para buscar 'gestor' dentro do array de funções do usuário.
    const q = query(
      usuariosCollection,
      where("funcoes", "array-contains", role)
    );
    const snapshot = await getDocs(q);

    const usersByRole = [];
    snapshot.forEach((doc) => {
      usersByRole.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(
      `Encontrados ${usersByRole.length} usuários para a função: ${role}.`
    );
    return usersByRole;
  } catch (error) {
    console.error(`Erro ao buscar usuários por função (${role}):`, error);
    return [];
  }
}
