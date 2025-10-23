// Arquivo: /modulos/voluntario/js/meus-pacientes/data.js

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

// Variáveis de escopo mantidas
let systemConfigs = null;
let dadosDaGrade = {};
let salasPresenciais = [];

// Funções loadSystemConfigs e loadGradeData mantidas
async function loadSystemConfigs() {
  // ... (código mantido sem alterações) ...
  if (systemConfigs) return;
  try {
    const configRef = doc(db, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);
    if (docSnap.exists()) {
      systemConfigs = docSnap.data();
      salasPresenciais = systemConfigs.listas?.salasPresenciais || [];
    } else {
      console.warn("Documento de configurações do sistema não encontrado.");
      systemConfigs = { textos: {} };
    }
  } catch (error) {
    console.error("Erro ao carregar configurações do sistema:", error);
    systemConfigs = { textos: {} };
  }
}

async function loadGradeData() {
  // ... (código mantido sem alterações) ...
  try {
    const gradeRef = doc(db, "administrativo", "grades");
    const gradeSnap = await getDoc(gradeRef);
    if (gradeSnap.exists()) {
      dadosDaGrade = gradeSnap.data();
    } else {
      console.warn("Documento da grade administrativo/grades não encontrado."); // Adiciona log
      dadosDaGrade = {};
    }
  } catch (error) {
    console.error("Erro ao carregar dados da grade:", error);
    dadosDaGrade = {};
  }
}

// --- Função carregarMeusPacientes MODIFICADA ---
async function carregarMeusPacientes(user, tableBody) {
  // Recebe tableBody diretamente
  const emptyState = document.getElementById("empty-state-pacientes");

  if (!tableBody || !emptyState) {
    console.error(
      "Elementos da tabela (#pacientes-table-body) ou estado vazio (#empty-state-pacientes) não encontrados."
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
    console.log(`Buscando pacientes para o usuário: ${user.uid}`);

    // Query Plantão (sem alterações)
    const queryPlantao = query(
      collection(db, "trilhaPaciente"),
      where("plantaoInfo.profissionalId", "==", user.uid),
      where("status", "==", "em_atendimento_plantao")
    );

    // Query PB (sem alterações na query em si)
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

    console.log(`Resultados Plantão: ${plantaoSnapshot.size} encontrados.`);
    console.log(`Resultados PB (geral): ${pbSnapshot.size} encontrados.`);

    const pacientesMap = new Map();

    // Processa Plantão (sem alterações)
    plantaoSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`[Plantão] Processando paciente: ${doc.id}`, data);
      pacientesMap.set(doc.id, {
        id: doc.id,
        nomeCompleto: data.nomeCompleto,
        telefoneCelular: data.telefoneCelular,
        email: data.email, // Garante email
        status: data.status, // Usa status principal
        dataNascimento: data.dataNascimento,
        atendimentosPB: data.atendimentosPB, // Inclui array completo
        meuAtendimentoPB: null, // Placeholder
      });
    });

    // Processa PB (LÓGICA AJUSTADA)
    pbSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`[PB] Verificando paciente: ${doc.id}`, data);

      // Tenta encontrar o atendimento específico deste profissional, *independente do statusAtendimento*
      const meuAtendimentoEncontrado = data.atendimentosPB?.find(
        (at) => at.profissionalId === user.uid
      );

      // A query já garante que o user.uid está em profissionaisPB_ids.
      // Adicionamos/atualizamos o paciente no Map, mesmo que meuAtendimentoEncontrado seja undefined
      // ou não esteja 'ativo', pois o profissional está vinculado e o status GERAL do paciente é relevante.
      const pacienteExistente = pacientesMap.get(doc.id);

      // *** AJUSTE PRINCIPAL: Adiciona/Atualiza SEMPRE que a query PB retornar, ***
      // *** passando o atendimento encontrado (mesmo que não ativo) para a UI. ***
      pacientesMap.set(doc.id, {
        // Usa dados existentes (do plantão) ou os atuais se for a primeira vez
        ...(pacienteExistente || {
          id: doc.id,
          nomeCompleto: data.nomeCompleto,
          telefoneCelular: data.telefoneCelular,
          email: data.email,
          status: data.status,
          dataNascimento: data.dataNascimento,
          atendimentosPB: data.atendimentosPB,
        }),
        // Guarda o atendimento específico encontrado (pode ser undefined se algo estranho ocorrer)
        meuAtendimentoPB: meuAtendimentoEncontrado || null,
        // Garante que o status principal (da trilha) está correto
        status: data.status,
      });
      console.log(
        `[PB] Paciente ${doc.id} adicionado/atualizado no Map. Atendimento específico:`,
        meuAtendimentoEncontrado
      );
    });

    const pacientes = Array.from(pacientesMap.values());
    console.log(
      `Total de pacientes únicos a serem exibidos: ${pacientes.length}`
    );

    pacientes.sort((a, b) =>
      (a.nomeCompleto || "").localeCompare(b.nomeCompleto || "")
    );

    const pacientesHtml = pacientes
      .map((paciente) => {
        try {
          // Passa o objeto paciente e o atendimento específico encontrado (pode ser null ou não ativo)
          return criarLinhaPacienteTabela(paciente, paciente.meuAtendimentoPB);
        } catch (renderError) {
          console.error(
            `Erro ao renderizar linha para paciente ${paciente.id}:`,
            renderError
          );
          return `<tr><td colspan="4">Erro ao renderizar paciente ${
            paciente.nomeCompleto || paciente.id
          }</td></tr>`;
        }
      })
      .join("");

    if (pacientesHtml === "") {
      console.log("Nenhum paciente encontrado para exibir após processamento."); // Mensagem mais específica
      tableBody.innerHTML = "";
      emptyState.style.display = "block";
    } else {
      emptyState.style.display = "none";
      tableBody.innerHTML = pacientesHtml;
      console.log("Tabela de pacientes preenchida.");
    }
  } catch (error) {
    console.error("Erro crítico em carregarMeusPacientes:", error);
    tableBody.innerHTML = `<tr><td colspan="4"><p class="alert alert-error">Ocorreu um erro ao carregar seus pacientes: ${error.message}</p></td></tr>`;
    emptyState.style.display = "none";
  }
}

// Função principal exportada - AJUSTADA para passar tableBody
export async function initializeMeusPacientes(
  user,
  userData /* REMOVIDO container */
) {
  // Acha o tableBody aqui ou assume que ele é passado pelo meus-pacientes.js
  const tableBody = document.getElementById("pacientes-table-body");
  if (!tableBody) {
    console.error(
      "initializeMeusPacientes: Elemento #pacientes-table-body não encontrado."
    );
    return;
  }

  await loadSystemConfigs();
  await loadGradeData();
  // Passa tableBody diretamente para carregarMeusPacientes
  await carregarMeusPacientes(user, tableBody);
}
