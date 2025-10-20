// Arquivo: /modulos/servico-social/js/agendamentos-view.js
// Responsável por gerenciar as abas de Triagem e Reavaliação

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc, // Importar doc
  updateDoc, // Importar updateDoc
  Timestamp, // Importar Timestamp
  serverTimestamp, // Importar serverTimestamp
} from "../../../assets/js/firebase-init.js";
import { getUserData } from "../../../assets/js/app.js"; // Supondo que app.js exporta getUserData

let currentUserData = null; // Guardar dados do usuário logado

export function init(user, userData) {
  currentUserData = userData; // Armazena os dados do usuário
  setupTabs();
  loadTriagemData(); // Carrega a aba de triagem por padrão
  addModalEventListeners(); // Adiciona listeners para o modal de reavaliação
}

function setupTabs() {
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  tabLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const tabId = link.dataset.tab;

      // Desativa todos
      tabLinks.forEach((l) => l.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // Ativa o clicado
      link.classList.add("active");
      document.getElementById(tabId).classList.add("active");

      // Carrega os dados da aba correspondente
      if (tabId === "triagem") {
        loadTriagemData();
      } else if (tabId === "reavaliacao") {
        loadReavaliacaoData();
      }
    });
  });
}

// --- Lógica da Aba de Triagem (Adaptada do código anterior) ---
async function loadTriagemData() {
  const tableBody = document.getElementById("triagem-table-body");
  const emptyState = document.getElementById("triagem-empty-state");
  if (!tableBody || !emptyState) return;

  tableBody.innerHTML =
    '<tr><td colspan="8"><div class="loading-spinner"></div></td></tr>'; // Colspan 8
  emptyState.style.display = "none";

  const isAdmin = (currentUserData.funcoes || []).includes("admin");

  try {
    const trilhaRef = collection(db, "trilhaPaciente");
    const queryConstraints = [
      where("status", "==", "triagem_agendada"),
      orderBy("dataTriagem", "asc"), // Ordenar pela data da triagem
      orderBy("horaTriagem", "asc"), // Depois pela hora
    ];

    if (!isAdmin) {
      queryConstraints.push(
        where("assistenteSocialId", "==", currentUserData.uid) // Filtrar pelo ID
      );
    }

    const q = query(trilhaRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tableBody.innerHTML = ""; // Limpa a tabela
      emptyState.style.display = "block"; // Mostra mensagem
      return;
    }

    let rowsHtml = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const dataAgendamento = data.dataTriagem
        ? new Date(data.dataTriagem + "T03:00:00").toLocaleDateString("pt-BR")
        : "Não definida";

      rowsHtml += `
          <tr>
              <td>${data.tipoTriagem || "N/A"}</td>
              <td>${data.nomeCompleto || "N/A"}</td>
              <td>${data.responsavel?.nome || "N/A"}</td>
              <td>${data.telefoneCelular || "N/A"}</td>
              <td>${dataAgendamento}</td>
              <td>${data.horaTriagem || "N/A"}</td>
              <td>${data.assistenteSocialNome || "N/A"}</td>
              <td>
                  <a href="#fila-atendimento/${doc.id}" class="action-button">
                      Preencher Ficha
                  </a>
              </td>
          </tr>
      `;
    });
    tableBody.innerHTML = rowsHtml;
  } catch (error) {
    console.error("Erro ao carregar agendamentos de triagem:", error);
    tableBody.innerHTML = "";
    emptyState.textContent =
      "Ocorreu um erro ao carregar os agendamentos de triagem.";
    emptyState.style.display = "block";
  }
}

// --- Lógica da Aba de Reavaliação (Nova) ---
async function loadReavaliacaoData() {
  const tableBody = document.getElementById("reavaliacao-table-body");
  const emptyState = document.getElementById("reavaliacao-empty-state");
  if (!tableBody || !emptyState) return;

  tableBody.innerHTML =
    '<tr><td colspan="7"><div class="loading-spinner"></div></td></tr>'; // Colspan 7
  emptyState.style.display = "none";

  const isAdmin = (currentUserData.funcoes || []).includes("admin");

  try {
    const agendamentosRef = collection(db, "agendamentos");
    const queryConstraints = [
      where("tipo", "==", "reavaliacao"),
      where("status", "in", ["agendado", "reagendado"]), // Buscar agendados ou reagendados
      orderBy("dataAgendamento", "asc"), // Ordenar por data/hora do Firebase Timestamp
    ];

    if (!isAdmin) {
      queryConstraints.push(
        where("assistenteSocialId", "==", currentUserData.uid) // Filtrar pelo ID
      );
    }

    const q = query(agendamentosRef, ...queryConstraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tableBody.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    let rowsHtml = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Formatar Timestamp do Firebase para data e hora local
      const dataAgendamento = data.dataAgendamento?.toDate
        ? data.dataAgendamento.toDate().toLocaleDateString("pt-BR")
        : "N/A";
      const horaAgendamento = data.dataAgendamento?.toDate
        ? data.dataAgendamento
            .toDate()
            .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "N/A";
      const statusFormatado = (data.status || "agendado")
        .replace("_", " ")
        .replace(/^\w/, (c) => c.toUpperCase()); // Ex: Agendado, Reagendado

      rowsHtml += `
          <tr data-agendamento-id="${doc.id}" data-paciente-id="${
        data.pacienteId
      }">
              <td>${data.pacienteNome || "N/A"}</td>
              <td>${data.profissionalNome || "N/A"}</td>
              <td>${dataAgendamento}</td>
              <td>${horaAgendamento}</td>
              <td>${data.assistenteSocialNome || "N/A"}</td>
              <td><span class="status-badge status-${
                data.status || "agendado"
              }">${statusFormatado}</span></td>
              <td>
                  <button class="action-button btn-realizar-reavaliacao">
                      Realizar Reavaliação
                  </button>
              </td>
          </tr>
      `;
    });
    tableBody.innerHTML = rowsHtml;

    // Adicionar listener aos botões recém-criados
    addReavaliacaoButtonListeners();
  } catch (error) {
    console.error("Erro ao carregar agendamentos de reavaliação:", error);
    tableBody.innerHTML = "";
    emptyState.textContent =
      "Ocorreu um erro ao carregar os agendamentos de reavaliação.";
    emptyState.style.display = "block";
  }
}

// Adiciona listeners aos botões "Realizar Reavaliação"
function addReavaliacaoButtonListeners() {
  const tableBody = document.getElementById("reavaliacao-table-body");
  tableBody.querySelectorAll(".btn-realizar-reavaliacao").forEach((button) => {
    button.addEventListener("click", (e) => {
      const row = e.target.closest("tr");
      const agendamentoId = row.dataset.agendamentoId;
      const pacienteId = row.dataset.pacienteId;
      abrirModalRealizarReavaliacao(agendamentoId, pacienteId);
    });
  });
}

// --- Lógica do Modal de Reavaliação (Serviço Social) ---

let currentAgendamentoData = null; // Para guardar dados do agendamento aberto no modal

async function abrirModalRealizarReavaliacao(agendamentoId, pacienteId) {
  const modal = document.getElementById("realizar-reavaliacao-modal");
  const form = document.getElementById("reavaliacao-ss-form");
  form.reset(); // Limpa o formulário
  // Esconde/mostra campos condicionais
  document.getElementById("reavaliacao-nao-realizada-fields").style.display =
    "none";
  document.getElementById("reavaliacao-sim-realizada-fields").style.display =
    "none";

  // Limpa e desativa required dos campos condicionais inicialmente
  document.getElementById("reavaliacao-motivo-nao").required = false;
  document.getElementById("reavaliacao-reagendado").required = false;
  document.getElementById("reavaliacao-novo-valor").required = false;
  document.getElementById("reavaliacao-criterios").required = false;

  // Coloca IDs no formulário
  document.getElementById("reavaliacao-agendamento-id").value = agendamentoId;
  document.getElementById("reavaliacao-paciente-id-ss").value = pacienteId;

  // Mostrar modal e carregar dados
  modal.style.display = "flex";
  const loadingDiv = modal.querySelector(".modal-body fieldset"); // Pega o primeiro fieldset para mostrar loading
  loadingDiv.insertAdjacentHTML(
    "afterbegin",
    '<div class="loading-spinner modal-loading"></div>'
  );

  try {
    // Buscar dados do agendamento
    const agendamentoRef = doc(db, "agendamentos", agendamentoId);
    const agendamentoSnap = await getDoc(agendamentoRef);

    if (!agendamentoSnap.exists()) {
      throw new Error("Agendamento não encontrado.");
    }
    currentAgendamentoData = agendamentoSnap.data(); // Guarda os dados

    // Preencher informações da solicitação no modal
    document.getElementById("reavaliacao-modal-paciente-nome").textContent =
      currentAgendamentoData.pacienteNome || "-";
    document.getElementById("reavaliacao-modal-profissional-nome").textContent =
      currentAgendamentoData.profissionalNome || "-";
    document.getElementById("reavaliacao-modal-valor-atual").textContent =
      currentAgendamentoData.solicitacaoInfo?.valorContribuicaoAtual || "-";
    document.getElementById("reavaliacao-modal-motivo").textContent =
      currentAgendamentoData.solicitacaoInfo?.motivoReavaliacao || "-";
  } catch (error) {
    console.error("Erro ao carregar dados para o modal de reavaliação:", error);
    alert(`Erro ao carregar dados: ${error.message}`);
    modal.style.display = "none"; // Fecha o modal se der erro
  } finally {
    const spinner = modal.querySelector(".modal-loading");
    if (spinner) spinner.remove(); // Remove o spinner
  }
}

// Adiciona listeners aos controles do modal de reavaliação
function addModalEventListeners() {
  const modal = document.getElementById("realizar-reavaliacao-modal");
  if (!modal) return;

  // Listener para o select "Reavaliação realizada?"
  const realizadaSelect = modal.querySelector("#reavaliacao-realizada");
  const naoRealizadaFields = modal.querySelector(
    "#reavaliacao-nao-realizada-fields"
  );
  const simRealizadaFields = modal.querySelector(
    "#reavaliacao-sim-realizada-fields"
  );

  realizadaSelect.addEventListener("change", () => {
    const selecionado = realizadaSelect.value;

    // Esconde ambos os grupos
    naoRealizadaFields.style.display = "none";
    simRealizadaFields.style.display = "none";

    // Desativa required de todos os campos condicionais
    naoRealizadaFields
      .querySelectorAll("textarea, select")
      .forEach((el) => (el.required = false));
    simRealizadaFields
      .querySelectorAll("input, textarea")
      .forEach((el) => (el.required = false));

    // Mostra o grupo correto e ativa required
    if (selecionado === "sim") {
      simRealizadaFields.style.display = "block";
      simRealizadaFields
        .querySelectorAll("input, textarea")
        .forEach((el) => (el.required = true));
    } else if (selecionado === "nao") {
      naoRealizadaFields.style.display = "block";
      naoRealizadaFields
        .querySelectorAll("textarea, select")
        .forEach((el) => (el.required = true));
    }
  });

  // Listener para o botão de submit do formulário
  const form = modal.querySelector("#reavaliacao-ss-form");
  form.addEventListener("submit", handleSalvarReavaliacaoSS);
}

// Função para salvar os dados da reavaliação (Serviço Social)
async function handleSalvarReavaliacaoSS(evento) {
  evento.preventDefault();
  const form = evento.target;
  const modal = form.closest(".modal-overlay");
  const btnSalvar = modal.querySelector("#btn-salvar-reavaliacao-ss");
  btnSalvar.disabled = true;
  btnSalvar.textContent = "Salvando...";

  const agendamentoId = form.querySelector("#reavaliacao-agendamento-id").value;
  const pacienteId = form.querySelector("#reavaliacao-paciente-id-ss").value;
  const realizada = form.querySelector("#reavaliacao-realizada").value;

  try {
    const agendamentoRef = doc(db, "agendamentos", agendamentoId);
    const pacienteRef = doc(db, "trilhaPaciente", pacienteId);

    let dadosAgendamentoUpdate = {
      status: "", // Será definido abaixo
      resultadoReavaliacao: {
        realizada: realizada === "sim",
        registradoPorId: currentUserData.uid,
        registradoPorNome: currentUserData.nome,
        registradoEm: serverTimestamp(),
      },
      lastUpdate: serverTimestamp(),
    };

    let dadosPacienteUpdate = null; // Só atualiza se a reavaliação foi feita

    if (realizada === "sim") {
      const novoValor = form.querySelector("#reavaliacao-novo-valor").value;
      const criterios = form.querySelector("#reavaliacao-criterios").value;

      if (!novoValor || !criterios) {
        throw new Error("Preencha o novo valor e os critérios.");
      }

      dadosAgendamentoUpdate.status = "realizado";
      dadosAgendamentoUpdate.resultadoReavaliacao.novoValorContribuicao =
        parseFloat(novoValor);
      dadosAgendamentoUpdate.resultadoReavaliacao.criteriosDefinicao =
        criterios;

      // Prepara atualização do paciente
      dadosPacienteUpdate = {
        valorContribuicao: parseFloat(novoValor),
        // Adiciona ao histórico (cria o array se não existir)
        historicoContribuicao: [
          ...(currentAgendamentoData.pacienteDados?.historicoContribuicao ||
            []), // Pega histórico anterior se houver
          {
            valor: parseFloat(novoValor),
            data: serverTimestamp(), // Ou usar a data do agendamento? Usar serverTimestamp por segurança
            motivo: "Reavaliação",
            responsavelId: currentUserData.uid,
            responsavelNome: currentUserData.nome,
          },
        ],
        lastUpdate: serverTimestamp(),
      };
    } else if (realizada === "nao") {
      const motivoNao = form.querySelector("#reavaliacao-motivo-nao").value;
      const reagendado = form.querySelector("#reavaliacao-reagendado").value;

      if (!motivoNao || !reagendado) {
        throw new Error("Preencha o motivo e se foi reagendado.");
      }

      dadosAgendamentoUpdate.resultadoReavaliacao.motivoNaoRealizada =
        motivoNao;
      dadosAgendamentoUpdate.resultadoReavaliacao.foiReagendado =
        reagendado === "sim";

      // Se não foi reagendado, marca como 'ausente', senão como 'reagendado' para manter na lista
      dadosAgendamentoUpdate.status =
        reagendado === "sim" ? "reagendado" : "ausente";
    } else {
      throw new Error("Selecione se a reavaliação foi realizada.");
    }

    // --- Executar Atualizações ---
    // 1. Atualizar o agendamento
    await updateDoc(agendamentoRef, dadosAgendamentoUpdate);

    // 2. Atualizar o paciente (SE necessário)
    if (dadosPacienteUpdate) {
      // Antes de atualizar o paciente, busca os dados atuais dele para pegar o histórico
      const pacienteSnap = await getDoc(pacienteRef);
      if (pacienteSnap.exists()) {
        const pacienteDataAtual = pacienteSnap.data();
        dadosPacienteUpdate.historicoContribuicao = [
          ...(pacienteDataAtual.historicoContribuicao || []),
          dadosPacienteUpdate.historicoContribuicao[
            dadosPacienteUpdate.historicoContribuicao.length - 1
          ], // Pega só o novo item
        ];
        await updateDoc(pacienteRef, dadosPacienteUpdate);
      } else {
        console.warn(
          `Paciente ${pacienteId} não encontrado para atualizar valor de contribuição.`
        );
        // Decide se quer lançar erro ou só avisar
      }
    }

    alert("Reavaliação salva com sucesso!");
    modal.style.display = "none";
    loadReavaliacaoData(); // Recarrega a tabela de reavaliação
  } catch (error) {
    console.error("Erro ao salvar reavaliação:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = "Salvar Reavaliação";
  }
}
