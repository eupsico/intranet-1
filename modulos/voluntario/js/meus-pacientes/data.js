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
    // Exibe erro dentro do container principal se a estrutura básica faltar
    const mainContainer = document.getElementById("meus-pacientes-view"); // Acha o container principal
    if (mainContainer) {
      mainContainer.innerHTML = `<p class="alert alert-error">Erro interno: Estrutura da tabela não encontrada no HTML.</p>`;
    }
    return;
  }

  tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;"><div class="loading-spinner"></div> Carregando pacientes...</td></tr>`; // Colspan 4 para as colunas
  emptyState.style.display = "none";

  try {
    console.log(`Buscando pacientes para o usuário: ${user.uid}`); // Log para depuração

    // Query para pacientes em Plantão com este profissional
    const queryPlantao = query(
      collection(db, "trilhaPaciente"),
      where("plantaoInfo.profissionalId", "==", user.uid),
      where("status", "==", "em_atendimento_plantao")
    );

    // Query para pacientes em PB onde este profissional está listado
    const queryPb = query(
      collection(db, "trilhaPaciente"),
      where("profissionaisPB_ids", "array-contains", user.uid),
      // Filtra apenas status relevantes onde o profissional ainda está ativo no PB
      where("status", "in", [
        "em_atendimento_pb",
        "aguardando_info_horarios",
        "cadastrar_horario_psicomanager",
      ])
    );

    // Executa as queries em paralelo
    const [plantaoSnapshot, pbSnapshot] = await Promise.all([
      getDocs(queryPlantao),
      getDocs(queryPb),
    ]);

    console.log(`Resultados Plantão: ${plantaoSnapshot.size} encontrados.`);
    console.log(`Resultados PB (geral): ${pbSnapshot.size} encontrados.`);

    const pacientesMap = new Map(); // Usar Map para evitar duplicados

    // Processa resultados do Plantão
    plantaoSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`Paciente Plantão encontrado: ${doc.id}`, data); // Log detalhado
      pacientesMap.set(doc.id, {
        id: doc.id,
        nomeCompleto: data.nomeCompleto,
        telefoneCelular: data.telefoneCelular,
        email: data.email,
        status: data.status,
        dataNascimento: data.dataNascimento,
        atendimentosPB: data.atendimentosPB, // Inclui para lógica de status
        meuAtendimentoPB: null, // Será preenchido se encontrado na query PB
      });
    });

    // Processa resultados do PB
    pbSnapshot.forEach((doc) => {
      const data = doc.data();
      // Encontra o atendimento ESPECÍFICO deste profissional que está ATIVO
      const meuAtendimento = data.atendimentosPB?.find(
        (at) =>
          at.profissionalId === user.uid && at.statusAtendimento === "ativo"
      );

      // Adiciona/Atualiza no Map APENAS se encontrou um atendimento ativo para este profissional
      if (meuAtendimento) {
        console.log(
          `Paciente PB encontrado com atendimento ativo: ${doc.id}`,
          data
        ); // Log detalhado
        const pacienteExistente = pacientesMap.get(doc.id);
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
          meuAtendimentoPB: meuAtendimento, // Adiciona/atualiza o atendimento específico
          status: data.status, // Garante que o status principal está correto
        });
      } else {
        // Log se o profissional está em profissionaisPB_ids mas não tem atendimento ativo
        console.log(
          `Paciente PB encontrado (${doc.id}, ${data.nomeCompleto}), mas SEM atendimento ATIVO para ${user.uid}. Verificando se já está no Map via Plantão.`
        );
        // Se ele já veio do plantão, não faz nada aqui, mantém os dados do plantão.
        // Se ele NÃO veio do plantão E NÃO tem atendimento ativo, ele não será adicionado/atualizado pelo PB.
      }
    });

    const pacientes = Array.from(pacientesMap.values()); // Converte Map para Array
    console.log(
      `Total de pacientes únicos a serem exibidos: ${pacientes.length}`
    );

    pacientes.sort((a, b) =>
      (a.nomeCompleto || "").localeCompare(b.nomeCompleto || "")
    ); // Ordena por nome

    // Gera as linhas da tabela (<tr>)
    const pacientesHtml = pacientes
      .map((paciente) => {
        try {
          // Passa o objeto paciente completo e o atendimentoPB específico (pode ser null)
          return criarLinhaPacienteTabela(paciente, paciente.meuAtendimentoPB);
        } catch (renderError) {
          console.error(
            `Erro ao renderizar linha para paciente ${paciente.id}:`,
            renderError
          );
          return `<tr><td colspan="4">Erro ao renderizar paciente ${
            paciente.nomeCompleto || paciente.id
          }</td></tr>`; // Fallback em caso de erro
        }
      })
      .join("");

    // Exibe estado vazio ou a tabela preenchida
    if (pacientesHtml === "") {
      console.log("Nenhum paciente encontrado para exibir.");
      tableBody.innerHTML = ""; // Limpa o loading
      emptyState.style.display = "block"; // Mostra mensagem de vazio
    } else {
      emptyState.style.display = "none"; // Esconde mensagem de vazio
      tableBody.innerHTML = pacientesHtml; // Insere as linhas no tbody
      console.log("Tabela de pacientes preenchida.");
    }
  } catch (error) {
    console.error("Erro crítico em carregarMeusPacientes:", error);
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
