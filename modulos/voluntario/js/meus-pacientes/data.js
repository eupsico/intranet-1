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
  // 'container' agora é a div.table-section
  const tableBody = document.getElementById("pacientes-table-body"); // Seleciona o tbody
  const emptyState = document.getElementById("empty-state-pacientes");

  if (!tableBody || !emptyState) {
    console.error("Elementos da tabela ou estado vazio não encontrados.");
    container.innerHTML = `<p class="alert alert-error">Erro interno: Estrutura da tabela não encontrada.</p>`;
    return;
  }

  tableBody.innerHTML = `<tr><td colspan="4"><div class="loading-spinner"></div></td></tr>`; // Colspan 4 para as colunas
  emptyState.style.display = "none";

  try {
    const queryPlantao = query(
      collection(db, "trilhaPaciente"),
      where("plantaoInfo.profissionalId", "==", user.uid),
      where("status", "==", "em_atendimento_plantao")
    );
    const queryPb = query(
      collection(db, "trilhaPaciente"),
      where("profissionaisPB_ids", "array-contains", user.uid),
      // Adicionar filtro para status PB se necessário (ex: apenas ativos)
      where("status", "in", [
        "em_atendimento_pb",
        "aguardando_info_horarios",
        "cadastrar_horario_psicomanager",
      ]) // Inclui status relevantes PB
    );

    const [plantaoSnapshot, pbSnapshot] = await Promise.all([
      getDocs(queryPlantao),
      getDocs(queryPb),
    ]);

    const pacientesMap = new Map(); // Usar Map para evitar duplicados se estiver em plantão e PB

    plantaoSnapshot.forEach((doc) => {
      // Certifica-se de incluir email e status
      const data = doc.data();
      pacientesMap.set(doc.id, {
        id: doc.id,
        nomeCompleto: data.nomeCompleto,
        telefoneCelular: data.telefoneCelular,
        email: data.email, // Garante que email está incluído
        status: data.status, // Garante que status está incluído
        dataNascimento: data.dataNascimento, // Necessário para status badge (ex: aguardando contrato)
        // Incluir outros campos se ui.js precisar (como atendimentosPB para o status Aguardando Contrato)
        atendimentosPB: data.atendimentosPB,
        // meuAtendimentoPB será definido abaixo se encontrado
      });
    });

    pbSnapshot.forEach((doc) => {
      const data = doc.data();
      const meuAtendimento = data.atendimentosPB?.find(
        (at) =>
          at.profissionalId === user.uid && at.statusAtendimento === "ativo"
      );

      if (meuAtendimento) {
        // Atualiza ou adiciona o paciente no Map
        const pacienteExistente = pacientesMap.get(doc.id);
        pacientesMap.set(doc.id, {
          ...(pacienteExistente || {
            // Usa dados existentes ou os atuais se for a primeira vez
            id: doc.id,
            nomeCompleto: data.nomeCompleto,
            telefoneCelular: data.telefoneCelular,
            email: data.email,
            status: data.status, // Usa o status principal da trilha
            dataNascimento: data.dataNascimento,
            atendimentosPB: data.atendimentosPB, // Garante que atendimentosPB esteja presente
          }),
          meuAtendimentoPB: meuAtendimento, // Adiciona/atualiza o atendimento específico
          // Garante que o status principal está correto, mesmo que plantao tenha sido adicionado antes
          status: data.status,
        });
      } else if (!pacientesMap.has(doc.id)) {
        // Se o voluntário está em profissionaisPB_ids mas NÃO tem atendimento ATIVO com ele
        // E ele não veio do plantão, talvez não devesse listar? Ou listar com status diferente?
        // Por ora, vamos seguir a lógica original e só adicionar se tiver atendimento ATIVO.
        console.log(
          `Paciente ${doc.id} (${data.nomeCompleto}) encontrado em PB, mas sem atendimento ativo para ${user.uid}. Não será listado.`
        );
      }
    });

    const pacientes = Array.from(pacientesMap.values()); // Converte Map para Array
    pacientes.sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto));

    // Gera as linhas da tabela (<tr>)
    const pacientesHtml = pacientes
      .map((paciente) =>
        criarLinhaPacienteTabela(paciente, paciente.meuAtendimentoPB)
      ) // Passa meuAtendimentoPB
      .join("");

    emptyState.style.display = pacientesHtml === "" ? "block" : "none";
    tableBody.innerHTML = pacientesHtml; // Insere as linhas no tbody
  } catch (error) {
    console.error("Erro crítico em carregarMeusPacientes:", error);
    tableBody.innerHTML = `<tr><td colspan="4"><p class="alert alert-error">Ocorreu um erro ao carregar seus pacientes.</p></td></tr>`;
    emptyState.style.display = "none";
  }
}

// Função principal exportada mantida
export async function initializeMeusPacientes(user, userData, container) {
  await loadSystemConfigs();
  await loadGradeData();
  await carregarMeusPacientes(user, container);
}
