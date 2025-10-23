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
// Import atualizado para 'criarLinhaPacienteTabela'
import { criarLinhaPacienteTabela } from "./ui.js";

// Variáveis de escopo mantidas
let systemConfigs = null;
let dadosDaGrade = {};
let salasPresenciais = [];

// Funções loadSystemConfigs e loadGradeData mantidas como antes...
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
    }
  } catch (error) {
    console.error("Erro ao carregar dados da grade:", error);
  }
}

async function carregarMeusPacientes(user, container) {
  // 'container' é a div.table-section
  const tableBody = document.getElementById("pacientes-table-body"); // Seleciona o tbody
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

  tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;"><div class="loading-spinner"></div> Carregando pacientes...</td></tr>`; // Colspan 4
  emptyState.style.display = "none";

  try {
    console.log(`Buscando pacientes para o usuário: ${user.uid}`); // Log

    const queryPlantao = query(
      collection(db, "trilhaPaciente"),
      where("plantaoInfo.profissionalId", "==", user.uid),
      where("status", "==", "em_atendimento_plantao")
    );
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

    console.log(`Resultados Plantão: ${plantaoSnapshot.size} encontrados.`); // Log
    console.log(`Resultados PB (geral): ${pbSnapshot.size} encontrados.`); // Log

    const pacientesMap = new Map();

    plantaoSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`Paciente Plantão encontrado: ${doc.id}`, data); // Log
      pacientesMap.set(doc.id, {
        id: doc.id,
        nomeCompleto: data.nomeCompleto,
        telefoneCelular: data.telefoneCelular,
        email: data.email,
        status: data.status,
        dataNascimento: data.dataNascimento,
        atendimentosPB: data.atendimentosPB,
        meuAtendimentoPB: null,
      });
    });

    pbSnapshot.forEach((doc) => {
      const data = doc.data();
      const meuAtendimento = data.atendimentosPB?.find(
        (at) =>
          at.profissionalId === user.uid && at.statusAtendimento === "ativo"
      );

      if (meuAtendimento) {
        console.log(
          `Paciente PB encontrado com atendimento ativo: ${doc.id}`,
          data
        ); // Log
        const pacienteExistente = pacientesMap.get(doc.id);
        pacientesMap.set(doc.id, {
          ...(pacienteExistente || {
            id: doc.id,
            nomeCompleto: data.nomeCompleto,
            telefoneCelular: data.telefoneCelular,
            email: data.email,
            status: data.status,
            dataNascimento: data.dataNascimento,
            atendimentosPB: data.atendimentosPB,
          }),
          meuAtendimentoPB: meuAtendimento,
          status: data.status,
        });
      } else {
        console.log(
          `Paciente PB encontrado (${doc.id}, ${data.nomeCompleto}), mas SEM atendimento ATIVO para ${user.uid}. Verificando se já está no Map via Plantão.`
        ); // Log
      }
    });

    const pacientes = Array.from(pacientesMap.values());
    console.log(
      `Total de pacientes únicos a serem exibidos: ${pacientes.length}`
    ); // Log

    pacientes.sort((a, b) =>
      (a.nomeCompleto || "").localeCompare(b.nomeCompleto || "")
    );

    const pacientesHtml = pacientes
      .map((paciente) => {
        try {
          return criarLinhaPacienteTabela(paciente, paciente.meuAtendimentoPB);
        } catch (renderError) {
          console.error(
            `Erro ao renderizar linha para paciente ${paciente.id}:`,
            renderError
          ); // Log de erro
          return `<tr><td colspan="4">Erro ao renderizar paciente ${
            paciente.nomeCompleto || paciente.id
          }</td></tr>`;
        }
      })
      .join("");

    if (pacientesHtml === "") {
      console.log("Nenhum paciente encontrado para exibir."); // Log
      tableBody.innerHTML = "";
      emptyState.style.display = "block";
    } else {
      emptyState.style.display = "none";
      tableBody.innerHTML = pacientesHtml;
      console.log("Tabela de pacientes preenchida."); // Log
    }
  } catch (error) {
    console.error("Erro crítico em carregarMeusPacientes:", error); // Log de erro
    tableBody.innerHTML = `<tr><td colspan="4"><p class="alert alert-error">Ocorreu um erro ao carregar seus pacientes: ${error.message}</p></td></tr>`;
    emptyState.style.display = "none";
  }
}

// Função principal exportada mantida
export async function initializeMeusPacientes(user, userData, container) {
  await loadSystemConfigs();
  await loadGradeData();
  // Passa o container (div.table-section) para a função carregar
  await carregarMeusPacientes(user, container);
}
