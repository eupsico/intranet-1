// Arquivo: /modulos/voluntario/js/detalhes-paciente/carregador-dados.js
// Contém as funções responsáveis por carregar dados do Firestore.
// Versão: Corrigida (Ordenação híbrida Data String/Timestamp)

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

// --- Funções de Carregamento de Dados ---

/**
 * Carrega os dados do documento principal do paciente.
 * @param {string} pacienteId - O ID do paciente a ser carregado.
 */
export async function carregarDadosPaciente(pacienteId) {
  console.log(">>> Buscando paciente com ID:", pacienteId);
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
    estado.setSystemConfigsGlobal({ textos: {}, listas: {} }); // Define um padrão vazio em caso de erro
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
 * Carrega as sessões da subcoleção do paciente.
 * CORREÇÃO: Removemos o orderBy da query do Firestore para buscar todas as sessões
 * (mesmo as antigas sem o campo 'dataHora') e fazemos a ordenação manualmente no Javascript.
 * Atualiza o estado 'sessoesCarregadas'.
 */
export async function carregarSessoes() {
  let sessoesTemp = []; // Usa uma variável temporária

  try {
    const sessoesRef = collection(
      db,
      "trilhaPaciente",
      estado.pacienteIdGlobal, // Usa o ID do estado
      "sessoes"
    );

    // --- ALTERAÇÃO AQUI: Removemos orderBy("dataHora", "desc") ---
    // Isso evita que sessões antigas (sem dataHora) sejam ignoradas pelo Firestore
    const q = query(sessoesRef);

    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      sessoesTemp.push({ id: doc.id, ...doc.data() }); // Adiciona à lista temporária
    });

    // --- ALTERAÇÃO AQUI: Ordenação manual no cliente ---
    // Garante que misturar sessões com Timestamp e String funcione
    sessoesTemp.sort((a, b) => {
      // Tenta obter data A (Timestamp ou String convertida)
      let dataA = a.dataHora?.toDate
        ? a.dataHora.toDate()
        : new Date(a.data + "T" + (a.horaInicio || "00:00"));

      // Tenta obter data B
      let dataB = b.dataHora?.toDate
        ? b.dataHora.toDate()
        : new Date(b.data + "T" + (b.horaInicio || "00:00"));

      // Trata datas inválidas jogando para o fim (fallback de segurança)
      if (isNaN(dataA.getTime())) dataA = new Date(0);
      if (isNaN(dataB.getTime())) dataB = new Date(0);

      return dataB - dataA; // Decrescente (mais recente primeiro)
    });

    estado.setSessoesCarregadas(sessoesTemp); // Atualiza o estado com a lista completa e ordenada
    console.log(
      "Sessões carregadas e ordenadas no estado:",
      estado.sessoesCarregadas
    );
  } catch (error) {
    console.error("Erro ao carregar sessões:", error);
    estado.setSessoesCarregadas([]); // Limpa o estado em caso de erro
    throw error; // Re-lança o erro para o controlador saber que falhou
  }
}
