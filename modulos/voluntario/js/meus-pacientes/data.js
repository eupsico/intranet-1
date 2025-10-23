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
// Import atualizado de 'criarAccordionPaciente' para 'criarCardPaciente'
import { criarCardPaciente } from "./ui.js";
// Import de 'adicionarEventListenersGerais' removido, pois não é mais necessário.

// Variáveis de escopo do módulo para armazenar os dados carregados
let systemConfigs = null;
let dadosDaGrade = {};
let salasPresenciais = [];

async function loadSystemConfigs() {
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
  // ID do container foi atualizado para 'pacientes-list-container' no HTML
  container.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const queryPlantao = query(
      collection(db, "trilhaPaciente"),
      where("plantaoInfo.profissionalId", "==", user.uid),
      where("status", "==", "em_atendimento_plantao")
    );
    const queryPb = query(
      collection(db, "trilhaPaciente"),
      where("profissionaisPB_ids", "array-contains", user.uid)
    );

    const [plantaoSnapshot, pbSnapshot] = await Promise.all([
      getDocs(queryPlantao),
      getDocs(queryPb),
    ]);

    const pacientes = [];
    plantaoSnapshot.forEach((doc) =>
      pacientes.push({ id: doc.id, ...doc.data() })
    );
    pbSnapshot.forEach((doc) => {
      const pacienteData = { id: doc.id, ...doc.data() };
      const meuAtendimento = pacienteData.atendimentosPB?.find(
        (at) =>
          at.profissionalId === user.uid && at.statusAtendimento === "ativo"
      );
      if (meuAtendimento)
        pacientes.push({ ...pacienteData, meuAtendimentoPB: meuAtendimento });
    });

    pacientes.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto)); // Variável 'accordionsHtml' renomeada para 'pacientesHtml' // Função 'criarAccordionPaciente' atualizada para 'criarCardPaciente'

    const pacientesHtml = pacientes
      .map((paciente) => criarCardPaciente(paciente, paciente.meuAtendimentoPB))
      .join("");

    document.getElementById("empty-state-pacientes").style.display =
      pacientesHtml === "" ? "block" : "none";
    container.innerHTML = pacientesHtml;
  } catch (error) {
    console.error("Erro crítico em carregarMeusPacientes:", error);
    container.innerHTML = `<p class="alert alert-error">Ocorreu um erro ao carregar seus pacientes.</p>`;
  }
}

// Função principal exportada que orquestra o carregamento e a renderização
export async function initializeMeusPacientes(user, userData, container) {
  await loadSystemConfigs();
  await loadGradeData();
  await carregarMeusPacientes(user, container); // A chamada para 'adicionarEventListenersGerais' foi removida. // Os novos 'paciente-card' são links (<a>) e não requerem JS para navegação. // Toda a lógica de eventos (modais, etc.) foi movida para a nova página de detalhes.
}
