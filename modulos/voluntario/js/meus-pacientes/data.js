// Arquivo: /modulos/voluntario/js/meus-pacientes/data.js
// Versão: CORRIGIDA para depuração da tabela vazia

import {
  db,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "../../../../assets/js/firebase-init.js";
import { criarLinhaPacienteTabela } from "./ui.js";

// Variáveis de escopo
let systemConfigs = null;
let dadosDaGrade = {};
let salasPresenciais = [];

// Função loadSystemConfigs (Sem abreviações)
async function loadSystemConfigs() {
  if (systemConfigs) return;
  console.log("data.js: Carregando configurações do sistema...");
  try {
    const configRef = doc(db, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);
    if (docSnap.exists()) {
      systemConfigs = docSnap.data();
      salasPresenciais = systemConfigs.listas?.salasPresenciais || [];
      console.log("data.js: Configurações carregadas:", systemConfigs);
    } else {
      console.warn(
        "data.js: Documento de configurações do sistema não encontrado."
      );
      systemConfigs = { textos: {}, listas: {} }; // Define um objeto vazio para evitar erros
      salasPresenciais = [];
    }
  } catch (error) {
    console.error("data.js: Erro ao carregar configurações do sistema:", error);
    systemConfigs = { textos: {}, listas: {} }; // Define um objeto vazio em caso de erro
    salasPresenciais = [];
  }
}

// Função loadGradeData (Sem abreviações)
async function loadGradeData() {
  console.log("data.js: Carregando dados da grade...");
  try {
    const gradeRef = doc(db, "administrativo", "grades");
    const gradeSnap = await getDoc(gradeRef);
    if (gradeSnap.exists()) {
      dadosDaGrade = gradeSnap.data();
      console.log("data.js: Dados da grade carregados.");
    } else {
      console.warn(
        "data.js: Documento da grade administrativo/grades não encontrado."
      );
      dadosDaGrade = {};
    }
  } catch (error) {
    console.error("data.js: Erro ao carregar dados da grade:", error);
    dadosDaGrade = {};
  }
}

// --- Função carregarMeusPacientes REVISADA ---
async function carregarMeusPacientes(user, tableBody) {
  const emptyState = document.getElementById("empty-state-pacientes");

  if (!tableBody || !emptyState) {
    console.error(
      "data.js: Elementos da tabela (#pacientes-table-body) ou estado vazio (#empty-state-pacientes) não encontrados."
    );
    const mainContainer = document.getElementById("meus-pacientes-view");
    if (mainContainer) {
      mainContainer.innerHTML = `<p class="alert alert-error">Erro interno: Estrutura da tabela não encontrada no HTML.</p>`;
    }
    return;
  }

  tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;"><div class="loading-spinner"></div> Carregando pacientes...</td></tr>`;
  emptyState.style.display = "none";

  try {
    console.log(`data.js: Buscando pacientes para o usuário: ${user.uid}`);

    // Query Plantão
    const queryPlantao = query(
      collection(db, "trilhaPaciente"),
      where("plantaoInfo.profissionalId", "==", user.uid),
      where("status", "==", "em_atendimento_plantao")
    );

    // Query PB (Pacientes onde o profissional está associado E o status do paciente é relevante)
    const queryPb = query(
      collection(db, "trilhaPaciente"),
      where("profissionaisPB_ids", "array-contains", user.uid),
      where("status", "in", [
        "em_atendimento_pb",
        "aguardando_info_horarios",
        "cadastrar_horario_psicomanager",
      ])
    );

    const [plantaoSnapshot, pbSnapshot] = await Promise.all([
      getDocs(queryPlantao),
      getDocs(queryPb),
    ]);

    console.log(
      `data.js: Resultados Plantão: ${plantaoSnapshot.size} encontrados.`
    );
    console.log(
      `data.js: Resultados PB (geral): ${pbSnapshot.size} encontrados.`
    );

    const pacientesMap = new Map();

    // Processa Plantão
    plantaoSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(
        `[Plantão] Encontrado paciente: ${doc.id} - ${data.nomeCompleto}`
      ); // Log simplificado
      // Armazena os dados básicos necessários para a tabela e lógica de status
      pacientesMap.set(doc.id, {
        id: doc.id,
        nomeCompleto: data.nomeCompleto || "[Nome Ausente]", // Fallback
        telefoneCelular: data.telefoneCelular || "N/A", // Fallback
        email: data.email || "N/A", // Fallback
        status: data.status || "desconhecido", // Fallback
        dataNascimento: data.dataNascimento, // Pode ser necessário para ui.js
        atendimentosPB: data.atendimentosPB || [], // Garante que é um array
        meuAtendimentoPB: null, // Será preenchido/sobrescrito se encontrado em PB
      });
    });

    // Processa PB
    pbSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(
        `[PB] Verificando paciente: ${doc.id} - ${data.nomeCompleto}`
      ); // Log simplificado

      // Tenta encontrar o atendimento específico deste profissional NO ARRAY atendimentosPB
      // Independentemente do statusAtendimento, para passar para a UI
      const meuAtendimentoEncontrado =
        data.atendimentosPB?.find((at) => at.profissionalId === user.uid) ||
        null; // Garante null se não encontrar

      console.log(
        `[PB] Atendimento específico para ${user.uid} encontrado?`,
        meuAtendimentoEncontrado ? "Sim" : "Não"
      );

      // Adiciona ou atualiza o paciente no Map. A query já garante a ligação.
      const pacienteExistente = pacientesMap.get(doc.id);
      pacientesMap.set(doc.id, {
        // Usa dados existentes (do plantão) ou os atuais se for a primeira vez
        ...(pacienteExistente || {
          id: doc.id,
          nomeCompleto: data.nomeCompleto || "[Nome Ausente]",
          telefoneCelular: data.telefoneCelular || "N/A",
          email: data.email || "N/A",
          status: data.status || "desconhecido",
          dataNascimento: data.dataNascimento,
          atendimentosPB: data.atendimentosPB || [],
        }),
        // Guarda o atendimento específico encontrado
        meuAtendimentoPB: meuAtendimentoEncontrado,
        // Garante que o status principal (da trilha) está correto (pode ter vindo do plantão antes)
        status: data.status || "desconhecido",
      });
      console.log(`[PB] Paciente ${doc.id} adicionado/atualizado no Map.`);
    });

    const pacientes = Array.from(pacientesMap.values());
    console.log(
      `data.js: Total de pacientes únicos a serem exibidos: ${pacientes.length}`
    ); // Log CRÍTICO

    // Verifica se realmente há pacientes antes de tentar renderizar
    if (pacientes.length === 0) {
      console.log(
        "data.js: Nenhum paciente encontrado para exibir após processamento."
      );
      tableBody.innerHTML = ""; // Limpa o loading
      emptyState.style.display = "block"; // Mostra mensagem de vazio
      return; // Termina a função aqui se não há pacientes
    }

    pacientes.sort((a, b) =>
      (a.nomeCompleto || "").localeCompare(b.nomeCompleto || "")
    );

    // Gera as linhas da tabela (<tr>)
    console.log("data.js: Tentando gerar HTML da tabela...");
    const pacientesHtml = pacientes
      .map((paciente) => {
        try {
          // Log antes de chamar a renderização
          console.log(
            `data.js: Chamando criarLinhaPacienteTabela para ${paciente.id}`
          );
          // Passa o objeto paciente e o atendimento específico encontrado
          return criarLinhaPacienteTabela(paciente, paciente.meuAtendimentoPB);
        } catch (renderError) {
          console.error(
            `data.js: Erro ao renderizar linha para paciente ${paciente.id}:`,
            renderError
          );
          return `<tr><td colspan="4" class="alert alert-error">Erro ao renderizar paciente ${
            paciente.nomeCompleto || paciente.id
          }</td></tr>`; // Fallback
        }
      })
      .join("");

    // Verifica se o HTML foi gerado
    if (!pacientesHtml || pacientesHtml.trim() === "") {
      console.error(
        "data.js: O HTML gerado para a tabela está vazio, embora pacientes tenham sido encontrados."
      );
      tableBody.innerHTML = `<tr><td colspan="4"><p class="alert alert-error">Erro interno ao gerar a lista de pacientes.</p></td></tr>`;
      emptyState.style.display = "none";
    } else {
      emptyState.style.display = "none";
      tableBody.innerHTML = pacientesHtml; // Insere as linhas no tbody
      console.log("data.js: Tabela de pacientes preenchida no HTML.");
    }
  } catch (error) {
    console.error("data.js: Erro crítico em carregarMeusPacientes:", error);
    tableBody.innerHTML = `<tr><td colspan="4"><p class="alert alert-error">Ocorreu um erro ao carregar seus pacientes: ${error.message}</p></td></tr>`;
    emptyState.style.display = "none";
  }
}

// Função principal exportada - Busca o tableBody internamente
export async function initializeMeusPacientes(user, userData) {
  const tableBody = document.getElementById("pacientes-table-body");
  if (!tableBody) {
    console.error(
      "initializeMeusPacientes: Elemento #pacientes-table-body não encontrado."
    );
    // Tenta exibir erro na área principal
    const contentArea = document.getElementById("content-area");
    if (contentArea) {
      contentArea.innerHTML =
        '<p class="alert alert-error">Erro: Falha ao encontrar a estrutura da tabela de pacientes.</p>';
    }
    return;
  }

  await loadSystemConfigs();
  await loadGradeData();
  // Passa tableBody diretamente para carregarMeusPacientes
  await carregarMeusPacientes(user, tableBody);
}
