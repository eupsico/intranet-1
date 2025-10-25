// Arquivo: /modulos/voluntario/js/detalhes-paciente/carregador-dados.js
// Contém as funções responsáveis por carregar dados do Firestore.

import {
  db,
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  getDocs,
} from "./conexao-db.js"; // Importa do módulo de conexão
import * as estado from "./estado.js"; // Importa o módulo de estado
// Importa a função renderizarSessoes que estará em interface.js
// import { renderizarSessoes } from './interface.js'; // Descomentar quando interface.js for criado

// --- Funções de Carregamento de Dados ---

/**
 * Carrega os dados do documento principal do paciente.
 * @param {string} pacienteId - O ID do paciente a ser carregado.
 */
export async function carregarDadosPaciente(pacienteId) {
  try {
    const docRef = doc(db, "trilhaPaciente", pacienteId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      estado.setPacienteDataGlobal({ id: docSnap.id, ...docSnap.data() }); // Atualiza o estado
      console.log("Dados do paciente carregados:", estado.pacienteDataGlobal);
    } else {
      console.warn(`Paciente com ID ${pacienteId} não encontrado.`);
      estado.setPacienteDataGlobal(null); // Atualiza o estado
    }
  } catch (error) {
    console.error("Erro ao buscar dados do paciente:", error);
    estado.setPacienteDataGlobal(null); // Atualiza o estado em caso de erro
    throw error; // Propaga o erro para o init tratar
  }
}

/**
 * Carrega as configurações gerais do sistema (incluindo listas como salas).
 * Chama internamente a função para carregar a grade.
 */
export async function carregarSystemConfigs() {
  // Evita recarregar se já tiver os dados no estado
  if (estado.systemConfigsGlobal) {
    console.log("Configurações do sistema já estavam carregadas.");
    // Garante que a grade seja carregada mesmo se as configs já existirem
    await loadGradeData();
    return;
  }

  try {
    const configRef = doc(db, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);
    if (docSnap.exists()) {
      estado.setSystemConfigsGlobal(docSnap.data()); // Atualiza o estado (setter atualiza salas tbm)
      console.log(
        "Configurações do sistema carregadas:",
        estado.systemConfigsGlobal
      );
    } else {
      console.warn("Documento de configurações do sistema não encontrado.");
      estado.setSystemConfigsGlobal({ textos: {}, listas: {} }); // Define um padrão vazio
    } // Carrega os dados da grade após carregar as configurações
    await loadGradeData();
  } catch (error) {
    console.error("Erro ao carregar configurações do sistema:", error);
    estado.setSystemConfigsGlobal({ textos: {}, listas: {} }); // Define um padrão vazio em caso de erro // Decide se quer carregar a grade mesmo com erro nas configs ou não // await loadGradeData(); // Opcional: tentar carregar grade mesmo assim
  }
}

/**
 * Carrega os dados da grade administrativa.
 * (Função auxiliar, chamada por carregarSystemConfigs).
 */
export async function loadGradeData() {
  // Evita recarregar se já tiver os dados no estado
  if (Object.keys(estado.dadosDaGradeGlobal).length > 0) {
    console.log("Dados da grade já estavam carregados.");
    return;
  }
  try {
    const gradeRef = doc(db, "administrativo", "grades");
    const gradeSnap = await getDoc(gradeRef);
    if (gradeSnap.exists()) {
      estado.setDadosDaGradeGlobal(gradeSnap.data()); // Atualiza o estado
      console.log("Dados da grade carregados.");
    } else {
      console.warn("Documento da grade não encontrado.");
      estado.setDadosDaGradeGlobal({}); // Define um padrão vazio
    }
  } catch (error) {
    console.error("Erro ao carregar dados da grade:", error);
    estado.setDadosDaGradeGlobal({}); // Define um padrão vazio em caso de erro
  }
}

/**
 * Carrega as sessões da subcoleção do paciente, ordenadas por data descendente.
 * Atualiza o estado 'sessoesCarregadas'.
 */
export async function carregarSessoes() {
  // A manipulação do DOM (loading, placeholder) será movida para interface.js
  // const container = document.getElementById("session-list-container");
  // const loading = document.getElementById("session-list-loading");
  // const placeholder = document.getElementById("session-list-placeholder");

  // if (!container || !loading || !placeholder) {
  //   console.error("Elementos da lista de sessões não encontrados no HTML.");
  //   return;
  // }

  // loading.style.display = "block";
  // placeholder.style.display = "none";
  // container.querySelectorAll(".session-item").forEach((item) => item.remove()); // Limpa lista antiga

  let sessoesTemp = []; // Usa uma variável temporária

  try {
    const sessoesRef = collection(
      db,
      "trilhaPaciente",
      estado.pacienteIdGlobal, // Usa o ID do estado
      "sessoes"
    );
    const q = query(sessoesRef, orderBy("dataHora", "desc"));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      sessoesTemp.push({ id: doc.id, ...doc.data() }); // Adiciona à lista temporária
    });

    estado.setSessoesCarregadas(sessoesTemp); // Atualiza o estado com a lista completa
    console.log("Sessões carregadas no estado:", estado.sessoesCarregadas); // --- A RENDERIZAÇÃO SERÁ CHAMADA PELO CONTROLADOR APÓS O CARREGAMENTO --- // if (estado.sessoesCarregadas.length === 0) { //   // Lógica do placeholder (vai para interface.js) //   // placeholder.style.display = "block"; // } else { //   // A função renderizarSessoes será chamada de fora, //   // passando estado.sessoesCarregadas como argumento. //   // renderizarSessoes(estado.sessoesCarregadas); // Chamada movida // }
  } catch (error) {
    console.error("Erro ao carregar sessões:", error);
    estado.setSessoesCarregadas([]); // Limpa o estado em caso de erro // A exibição do erro na UI será responsabilidade de interface.js ou do controlador // container.innerHTML = `<p class="alert alert-error">Erro ao carregar sessões: ${error.message}</p>`; // placeholder.style.display = "none";
    throw error; // Re-lança o erro para o controlador saber que falhou
  } finally {
    // A lógica de esconder o loading será de interface.js
    // loading.style.display = "none";
  }
}
