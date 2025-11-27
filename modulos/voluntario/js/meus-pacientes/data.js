// Arquivo: /modulos/voluntario/js/meus-pacientes/data.js
// Versão FINAL com queries corretas e logs para diagnóstico (Atualizado para incluir Parcerias)

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

// Função loadSystemConfigs (Completa)
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
      systemConfigs = { textos: {}, listas: {} };
      salasPresenciais = [];
    }
  } catch (error) {
    console.error("data.js: Erro ao carregar configurações do sistema:", error);
    systemConfigs = { textos: {}, listas: {} };
    salasPresenciais = [];
  }
}

// Função loadGradeData (Completa)
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

// --- Função carregarMeusPacientes (Com Queries Corretas e Logs) ---
async function carregarMeusPacientes(user, tableBody) {
  const emptyState = document.getElementById("empty-state-pacientes");

  if (!tableBody || !emptyState) {
    console.error(
      "data.js: Elementos da tabela (#pacientes-table-body) ou estado vazio (#empty-state-pacientes) não encontrados."
    );
    const mainContainer = document.getElementById("meus-pacientes-view");
    if (mainContainer)
      mainContainer.innerHTML = `<p class="alert alert-error">Erro interno: Estrutura da tabela não encontrada no HTML.</p>`;
    return;
  }

  tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;"><div class="loading-spinner"></div> Carregando pacientes...</td></tr>`;
  emptyState.style.display = "none";

  try {
    console.log(`data.js: Buscando pacientes para o usuário: ${user.uid}`);

    // Query Plantão (FINAL)
    const queryPlantao = query(
      collection(db, "trilhaPaciente"),
      where("plantaoInfo.profissionalId", "==", user.uid),
      where("status", "==", "em_atendimento_plantao")
    );
    console.log("data.js: Query Plantão:", queryPlantao); // Log da query

    // Query PB e Parcerias (FINAL - Atualizado)
    const queryPb = query(
      collection(db, "trilhaPaciente"),
      where("profissionaisPB_ids", "array-contains", user.uid),
      where("status", "in", [
        "em_atendimento_pb",
        "aguardando_info_horarios",
        "cadastrar_horario_psicomanager",
        "pacientes_parcerias", // <-- ADICIONADO AQUI
      ])
    );
    console.log("data.js: Query PB/Parcerias:", queryPb); // Log da query

    // Executa as queries
    const [plantaoSnapshot, pbSnapshot] = await Promise.all([
      getDocs(queryPlantao),
      getDocs(queryPb),
    ]);

    console.log(
      `data.js: Resultados Plantão: ${plantaoSnapshot.size} encontrados.`
    );
    console.log(
      `data.js: Resultados PB (com filtro status): ${pbSnapshot.size} encontrados.`
    ); // Log com filtro

    const pacientesMap = new Map();

    // Processa Plantão
    plantaoSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(
        `[Plantão FINAL] Encontrado paciente: ${doc.id} - ${data.nomeCompleto}`
      );
      pacientesMap.set(doc.id, {
        id: doc.id,
        nomeCompleto: data.nomeCompleto || "[Nome Ausente]",
        telefoneCelular: data.telefoneCelular || "N/A",
        email: data.email || "N/A",
        status: data.status || "desconhecido",
        dataNascimento: data.dataNascimento,
        atendimentosPB: data.atendimentosPB || [],
        meuAtendimentoPB: null,
      });
    });

    // Processa PB e Parcerias
    pbSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(
        `[PB/Parceria FINAL] Verificando paciente: ${doc.id} - ${data.nomeCompleto}, Status: ${data.status}`
      );

      const meuAtendimentoEncontrado =
        data.atendimentosPB?.find((at) => at.profissionalId === user.uid) ||
        null;

      console.log(
        `[PB/Parceria FINAL] Atendimento específico para ${user.uid} encontrado?`,
        meuAtendimentoEncontrado ? "Sim" : "Não"
      );

      const pacienteExistente = pacientesMap.get(doc.id);
      pacientesMap.set(doc.id, {
        ...(pacienteExistente || {
          id: doc.id,
          nomeCompleto: data.nomeCompleto || "[Nome Ausente]",
          telefoneCelular: data.telefoneCelular || "N/A",
          email: data.email || "N/A",
          status: data.status || "desconhecido",
          dataNascimento: data.dataNascimento,
          atendimentosPB: data.atendimentosPB || [],
        }),
        meuAtendimentoPB: meuAtendimentoEncontrado,
        status: data.status || "desconhecido",
      });
      console.log(
        `[PB/Parceria FINAL] Paciente ${doc.id} adicionado/atualizado no Map.`
      );
    });

    const pacientes = Array.from(pacientesMap.values());
    console.log(
      `data.js: Total de pacientes únicos a serem exibidos: ${pacientes.length}`
    );

    if (pacientes.length === 0) {
      console.log(
        "data.js: Nenhum paciente encontrado para exibir após processamento final."
      );
      tableBody.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    pacientes.sort((a, b) =>
      (a.nomeCompleto || "").localeCompare(b.nomeCompleto || "")
    );

    console.log("data.js: Tentando gerar HTML da tabela final...");
    const pacientesHtml = pacientes
      .map((paciente) => {
        try {
          console.log(
            `data.js: Chamando criarLinhaPacienteTabela final para ${paciente.id}`
          );
          return criarLinhaPacienteTabela(paciente, paciente.meuAtendimentoPB);
        } catch (renderError) {
          console.error(
            `data.js: Erro ao renderizar linha final para paciente ${paciente.id}:`,
            renderError
          );
          return `<tr><td colspan="4" class="alert alert-error">Erro ao renderizar paciente ${
            paciente.nomeCompleto || paciente.id
          }</td></tr>`;
        }
      })
      .join("");

    if (!pacientesHtml || pacientesHtml.trim() === "") {
      console.error("data.js: O HTML final gerado para a tabela está vazio.");
      tableBody.innerHTML = `<tr><td colspan="4"><p class="alert alert-error">Erro interno ao gerar a lista de pacientes final.</p></td></tr>`;
      emptyState.style.display = "none";
    } else {
      emptyState.style.display = "none";
      tableBody.innerHTML = pacientesHtml;
      console.log("data.js: Tabela de pacientes final preenchida no HTML.");
    }
  } catch (error) {
    console.error("data.js: Erro crítico em carregarMeusPacientes:", error);
    // Tenta exibir o erro do Firestore se disponível
    let errorMsg = error.message;
    if (error.code && error.message.includes("indexes")) {
      errorMsg +=
        " Provável falta de índice no Firestore. Verifique o console do Firebase.";
      // Tenta extrair o link do índice, se o Firebase fornecer
      const indexLinkMatch = error.message.match(/https?:\/\/[^\s]+/);
      if (indexLinkMatch) {
        errorMsg += ` Link sugerido: ${indexLinkMatch[0]}`;
        console.error("Link para criação de índice:", indexLinkMatch[0]);
      }
    }
    tableBody.innerHTML = `<tr><td colspan="4"><p class="alert alert-error">Ocorreu um erro ao carregar seus pacientes: ${errorMsg}</p></td></tr>`;
    emptyState.style.display = "none";
  }
}

// Função principal exportada (mantida)
export async function initializeMeusPacientes(user, userData) {
  console.log(
    "data.js: Iniciando initializeMeusPacientes com user ID:",
    user?.uid
  );
  const tableBody = document.getElementById("pacientes-table-body");
  if (!tableBody) {
    console.error(
      "initializeMeusPacientes: Elemento #pacientes-table-body não encontrado."
    );
    const contentArea = document.getElementById("content-area");
    if (contentArea)
      contentArea.innerHTML =
        '<p class="alert alert-error">Erro: Falha ao encontrar a estrutura da tabela de pacientes.</p>';
    return;
  }
  await loadSystemConfigs();
  await loadGradeData();
  await carregarMeusPacientes(user, tableBody);
}
