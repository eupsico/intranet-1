// Arquivo: /modulos/servico-social/js/fila-atendimento.js
// --- VERSÃO CORRIGIDA FINAL (Carrega SOLICITAÇÃO para Reavaliação) ---

import {
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp,
} from "../../../assets/js/firebase-init.js";

// Variável de escopo para guardar dados do usuário logado
let currentUserData = null;

/**
 * Função principal de inicialização da view Fila de Atendimento.
 * Determina se é Triagem ou Reavaliação com base na URL Hash.
 */
export function init(user, userData, trilhaId) {
  currentUserData = userData; // Salva os dados do usuário logado

  const hashParts = window.location.hash.substring(1).split("/");
  // Exemplo Triagem: #fila-atendimento/paciente123
  // Exemplo Reavaliação: #fila-atendimento/paciente123/reavaliacao/solicitacao456 (Usa ID da SOLICITAÇÃO)
  const isReavaliacao =
    hashParts.length === 4 && hashParts[2] === "reavaliacao";
  const solicitacaoId = isReavaliacao ? hashParts[3] : null; // Pega o ID da SOLICITAÇÃO

  const formTitle = document.getElementById("form-title");
  const triagemForm = document.getElementById("triagem-form");
  const reavaliacaoForm = document.getElementById("reavaliacao-ss-form");
  const btnVoltar = document.getElementById("btn-voltar-lista");

  // Ações do botão Voltar
  if (btnVoltar) {
    btnVoltar.addEventListener(
      "click",
      () => (window.location.hash = "#agendamentos-view") // Sempre volta para a view de agendamentos
    );
  } else {
    console.warn("Botão 'Voltar' (#btn-voltar-lista) não encontrado.");
  }

  // Verifica se os formulários existem antes de tentar resetar
  if (triagemForm) {
    triagemForm.reset();
    resetConditionalFieldsTriagem(); // Garante que campos da triagem estejam ocultos/não required
  } else {
    console.warn("Formulário de Triagem (#triagem-form) não encontrado.");
  }
  if (reavaliacaoForm) {
    reavaliacaoForm.reset();
    resetConditionalFieldsReavaliacao(); // Garante que campos da reavaliação estejam ocultos/não required
  } else {
    console.warn(
      "Formulário de Reavaliação (#reavaliacao-ss-form) não encontrado."
    );
  }

  if (isReavaliacao) {
    // Modo Reavaliação
    if (formTitle) formTitle.textContent = "Formulário de Reavaliação";
    if (triagemForm) triagemForm.style.display = "none";
    if (reavaliacaoForm) reavaliacaoForm.style.display = "block";

    carregarDadosPaciente(trilhaId); // Carrega dados do paciente (coluna esquerda)
    carregarDadosReavaliacao(solicitacaoId, trilhaId); // Carrega dados da SOLICITAÇÃO (coluna direita)
    setupReavaliacaoFormListeners(solicitacaoId, trilhaId); // Prepara listeners do form de reavaliação
  } else {
    // Modo Triagem (lógica original)
    if (formTitle) formTitle.textContent = "Formulário de Triagem";
    if (triagemForm) triagemForm.style.display = "block";
    if (reavaliacaoForm) reavaliacaoForm.style.display = "none";

    carregarDadosPaciente(trilhaId); // Carrega dados do paciente (coluna esquerda)
    setupTriagemForm(user, userData, trilhaId); // Inicia a lógica original do formulário de triagem
  }
}

/**
 * Carrega os dados do paciente na coluna da esquerda.
 */
async function carregarDadosPaciente(trilhaId) {
  const patientDetailsContainer = document.getElementById(
    "patient-details-container"
  );
  if (!patientDetailsContainer) {
    console.error(
      "Container de detalhes do paciente (#patient-details-container) não encontrado."
    );
    return;
  }
  patientDetailsContainer.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const trilhaDocRef = doc(db, "trilhaPaciente", trilhaId);
    const trilhaDoc = await getDoc(trilhaDocRef);

    if (!trilhaDoc.exists()) {
      throw new Error("Paciente não encontrado na trilha com o ID fornecido.");
    }
    const data = trilhaDoc.data();
    const formatDate = (dateStr) =>
      dateStr
        ? new Date(dateStr + "T03:00:00").toLocaleDateString("pt-BR")
        : "N/I";
    const formatArray = (arr) =>
      arr && arr.length > 0 ? arr.join(", ") : "N/A";
    const formatCurrency = (value) =>
      value
        ? `R$ ${parseFloat(value).toFixed(2).replace(".", ",")}`
        : "Aguardando definição";

    const formatHistory = (history) => {
      if (!history || history.length === 0) return "Nenhum histórico.";
      return history
        .map((entry) => {
          const date = entry.data?.toDate
            ? entry.data.toDate().toLocaleDateString("pt-BR")
            : "Data N/A";
          const value = formatCurrency(entry.valor);
          const reason = entry.motivo || "N/A";
          return `<li>${date}: ${value} (${reason})</li>`;
        })
        .join("");
    };

    // Gera o HTML com os dados do paciente
    patientDetailsContainer.innerHTML = `
            <div class="patient-info-group"><strong>Nome:</strong><p>${
              data.nomeCompleto || "N/A"
            }</p></div>
            <div class="patient-info-group"><strong>CPF:</strong><p>${
              data.cpf || "N/A"
            }</p></div>
            <div class="patient-info-group"><strong>Data de Nasc.:</strong><p>${formatDate(
              data.dataNascimento
            )}</p></div>
            <div class="patient-info-group"><strong>Telefone:</strong><p>${
              data.telefoneCelular || "N/A"
            }</p></div>
            <div class="patient-info-group"><strong>Email:</strong><p>${
              data.email || "N/A"
            }</p></div>
            ${
              data.responsavel?.nome
                ? `
            <div class="patient-info-group"><strong>Responsável:</strong><p>${
              data.responsavel.nome
            }</p></div>
            <div class="patient-info-group"><strong>Contato Responsável:</strong><p>${
              data.responsavel.contato || "N/A"
            }</p></div>`
                : ""
            }
            <hr>
            <div class="patient-info-group"><strong>Endereço:</strong><p>${
              data.rua || "N/A"
            }, ${data.numeroCasa || "S/N"} - ${data.bairro || "N/A"}, ${
      data.cidade || "N/A"
    }</p></div>
            <div class="patient-info-group"><strong>CEP:</strong><p>${
              data.cep || "N/A"
            }</p></div>
            <hr>
            <div class="patient-info-group"><strong>Renda Individual:</strong><p>${
              data.rendaMensal || "N/A"
            }</p></div>
            <div class="patient-info-group"><strong>Renda Familiar:</strong><p>${
              data.rendaFamiliar || "N/A"
            }</p></div>
            <div class="patient-info-group"><strong>Moradia:</strong><p>${
              data.casaPropria || "N/A"
            }</p></div>
            <div class="patient-info-group"><strong>Pessoas na Moradia:</strong><p>${
              data.pessoasMoradia || "N/A"
            }</p></div>
            <hr>
            <div class="patient-info-group"><strong>Disponibilidade (Geral):</strong><p>${formatArray(
              data.disponibilidadeGeral
            )}</p></div>
            <div class="patient-info-group"><strong>Disponibilidade (Específica):</strong><p>${formatarDisponibilidadeEspecifica(
              data.disponibilidadeEspecifica
            )}</p></div>
            <div class="patient-info-group"><strong>Motivo da Busca:</strong><p>${
              data.motivoBusca || "N/A"
            }</p></div>
            <hr>
            <div class="patient-info-group"><strong>Valor Contribuição Atual:</strong><p>${formatCurrency(
              data.valorContribuicao
            )}</p></div>
            <div class="patient-info-group"><strong>Histórico Contribuição:</strong><ul>${formatHistory(
              data.historicoContribuicao
            )}</ul></div>
            <div class="patient-info-group"><strong>Queixa Principal (Triagem):</strong><p>${
              data.queixaPrincipal || "Aguardando triagem"
            }</p></div>
        `;
  } catch (error) {
    console.error("Erro ao carregar dados do paciente:", error);
    patientDetailsContainer.innerHTML = `<p class="error-message">Erro ao carregar dados do paciente: ${error.message}</p>`;
  }
}

/**
 * Formata a disponibilidade específica para exibição.
 */
function formatarDisponibilidadeEspecifica(disponibilidade) {
  if (!disponibilidade || disponibilidade.length === 0) {
    return "Nenhum horário detalhado informado.";
  }
  const dias = {
    "manha-semana": { label: "Manhã (Semana)", horarios: [] },
    "tarde-semana": { label: "Tarde (Semana)", horarios: [] },
    "noite-semana": { label: "Noite (Semana)", horarios: [] },
    "manha-sabado": { label: "Manhã (Sábado)", horarios: [] },
  };
  disponibilidade.forEach((item) => {
    const [periodo, hora] = item.split("_");
    if (dias[periodo]) {
      dias[periodo].horarios.push(hora);
    }
  });
  let html = "";
  for (const key in dias) {
    if (dias[key].horarios.length > 0) {
      dias[key].horarios.sort(); // Ordena os horários
      html += `<strong>${dias[key].label}:</strong> ${dias[key].horarios.join(
        ", "
      )}<br>`;
    }
  }
  return html || "Nenhum horário detalhado informado.";
}

// --- Lógica Específica do Formulário de Triagem (mantida como estava) ---
function setupTriagemForm(user, userData, trilhaId) {
  const triagemForm = document.getElementById("triagem-form");
  if (!triagemForm) return; // Verifica se o form existe
  const statusSelect = document.getElementById("triagem-status");
  const valorContribuicaoInput = document.getElementById("valor-contribuicao");
  const ampliarDisponibilidadeSelect = document.getElementById(
    "ampliar-disponibilidade"
  );
  const novaDisponibilidadeContainer = document.getElementById(
    "nova-disponibilidade-container"
  );

  if (valorContribuicaoInput)
    valorContribuicaoInput.addEventListener("input", () =>
      formatarMoeda(valorContribuicaoInput)
    );
  if (statusSelect)
    statusSelect.addEventListener("change", updateTriagemConditionalFields);
  if (ampliarDisponibilidadeSelect && novaDisponibilidadeContainer)
    ampliarDisponibilidadeSelect.addEventListener("change", () =>
      toggleNovaDisponibilidade(
        ampliarDisponibilidadeSelect,
        novaDisponibilidadeContainer
      )
    );
  triagemForm.addEventListener("submit", (e) =>
    handleSalvarTriagem(e, user, userData, trilhaId)
  );
  loadQueixaTriagem(trilhaId);
}
async function loadQueixaTriagem(trilhaId) {
  try {
    const trilhaDocRef = doc(db, "trilhaPaciente", trilhaId);
    const trilhaDoc = await getDoc(trilhaDocRef);
    if (trilhaDoc.exists()) {
      const queixaInput = document.getElementById("queixa-paciente");
      if (queixaInput) queixaInput.value = trilhaDoc.data().motivoBusca || "";
    }
  } catch (error) {
    console.error("Erro ao carregar queixa para triagem:", error);
  }
}
function formatarMoeda(input) {
  let value = input.value.replace(/\D/g, "");
  if (value === "") {
    input.value = "";
    return;
  }
  value = (parseInt(value, 10) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  input.value = value;
}
function updateTriagemConditionalFields() {
  const statusSelect = document.getElementById("triagem-status");
  const camposEncaminhado = document.getElementById("campos-encaminhado");
  const camposObservacao = document.getElementById("campos-observacao");
  const valorContribuicaoInput = document.getElementById("valor-contribuicao");
  const criteriosTextarea = document.getElementById("criterios-valor");
  const observacaoTextarea = document.getElementById("observacao-geral");
  if (
    !statusSelect ||
    !camposEncaminhado ||
    !camposObservacao ||
    !valorContribuicaoInput ||
    !criteriosTextarea ||
    !observacaoTextarea
  )
    return;
  const selectedValue = statusSelect.value;
  camposEncaminhado.style.display =
    selectedValue === "encaminhado" ? "block" : "none";
  camposObservacao.style.display =
    selectedValue === "nao_realizada" || selectedValue === "desistiu"
      ? "block"
      : "none";
  valorContribuicaoInput.required = selectedValue === "encaminhado";
  criteriosTextarea.required = selectedValue === "encaminhado";
  observacaoTextarea.required =
    selectedValue === "nao_realizada" || selectedValue === "desistiu";
}
function toggleNovaDisponibilidade(selectElement, containerElement) {
  if (selectElement.value === "sim") {
    containerElement.style.display = "block";
    if (containerElement.innerHTML.trim() === "") {
      containerElement.innerHTML = `...`;
      /* Gera o HTML da disponibilidade */ containerElement
        .querySelectorAll('input[name="horario"]')
        .forEach((checkbox) => {
          checkbox.addEventListener("change", (e) => {
            /* Lógica para mostrar/esconder detalhes */
          });
        });
    }
  } else {
    containerElement.style.display = "none";
    containerElement.innerHTML = "";
  }
}
function gerarHorariosEspecificos(periodo, container) {
  /* ... Lógica para gerar checkboxes de hora ... */
}
async function handleSalvarTriagem(evento, user, userData, trilhaId) {
  /* ... Lógica original para salvar triagem ... */
}
function resetConditionalFieldsTriagem() {
  const camposEncaminhado = document.getElementById("campos-encaminhado");
  const camposObservacao = document.getElementById("campos-observacao");
  const novaDisponibilidadeContainer = document.getElementById(
    "nova-disponibilidade-container"
  );
  if (camposEncaminhado) camposEncaminhado.style.display = "none";
  if (camposObservacao) camposObservacao.style.display = "none";
  if (novaDisponibilidadeContainer)
    novaDisponibilidadeContainer.style.display = "none";
  const valorContribuicaoInput = document.getElementById("valor-contribuicao");
  const criteriosTextarea = document.getElementById("criterios-valor");
  const observacaoTextarea = document.getElementById("observacao-geral");
  if (valorContribuicaoInput) valorContribuicaoInput.required = false;
  if (criteriosTextarea) criteriosTextarea.required = false;
  if (observacaoTextarea) observacaoTextarea.required = false;
}

// --- Lógica Específica do Formulário de Reavaliação ---

/**
 * Carrega os dados da SOLICITAÇÃO de reavaliação e preenche o formulário.
 */
async function carregarDadosReavaliacao(solicitacaoId, pacienteId) {
  const loadingInfo = document.getElementById("reavaliacao-loading-info");
  const formReavaliacao = document.getElementById("reavaliacao-ss-form");
  if (!loadingInfo || !formReavaliacao) {
    console.error("Elementos do formulário de reavaliação não encontrados.");
    return;
  }
  loadingInfo.style.display = "block";

  try {
    // Busca dados da SOLICITAÇÃO
    const solicitacaoRef = doc(db, "solicitacoes", solicitacaoId);
    const solicitacaoSnap = await getDoc(solicitacaoRef);
    if (!solicitacaoSnap.exists()) {
      throw new Error("Solicitação de reavaliação não encontrada."); // Mensagem correta
    }
    const solicitacaoData = solicitacaoSnap.data();
    const detalhes = solicitacaoData.detalhes || {};

    // Preenche informações da solicitação no formulário
    const pacienteNomeEl = document.getElementById(
      "reavaliacao-modal-paciente-nome"
    );
    const profissionalNomeEl = document.getElementById(
      "reavaliacao-modal-profissional-nome"
    );
    const valorAtualEl = document.getElementById(
      "reavaliacao-modal-valor-atual"
    );
    const motivoEl = document.getElementById("reavaliacao-modal-motivo");

    if (pacienteNomeEl)
      pacienteNomeEl.textContent = solicitacaoData.pacienteNome || "-";
    if (profissionalNomeEl)
      profissionalNomeEl.textContent = solicitacaoData.solicitanteNome || "-";
    const valorAtualFormatado = detalhes.valorContribuicaoAtual
      ? `R$ ${parseFloat(detalhes.valorContribuicaoAtual)
          .toFixed(2)
          .replace(".", ",")}`
      : "-";
    if (valorAtualEl) valorAtualEl.textContent = valorAtualFormatado;
    if (motivoEl) motivoEl.textContent = detalhes.motivo || "-";

    // Preenche IDs nos campos hidden
    const agendamentoIdInput = document.getElementById(
      "reavaliacao-agendamento-id"
    );
    const solicitacaoIdInput = document.getElementById(
      "reavaliacao-solicitacao-id-ss"
    );
    const pacienteIdInput = document.getElementById(
      "reavaliacao-paciente-id-ss"
    );

    if (agendamentoIdInput) agendamentoIdInput.value = ""; // Não há agendamento PREEXISTENTE
    if (solicitacaoIdInput) solicitacaoIdInput.value = solicitacaoId; // Guarda o ID da solicitação
    if (pacienteIdInput) pacienteIdInput.value = pacienteId; // Confirma o ID do paciente
  } catch (error) {
    console.error(
      "Erro ao carregar dados da solicitação de reavaliação:",
      error
    );
    alert(`Erro ao carregar dados: ${error.message}`);
    formReavaliacao.innerHTML = `<p class="alert alert-error">Não foi possível carregar os dados da solicitação.</p>`; // Mostra erro no form
  } finally {
    loadingInfo.style.display = "none"; // Esconde o spinner
  }
}

/**
 * Configura os listeners do formulário de reavaliação.
 */
function setupReavaliacaoFormListeners(solicitacaoId, pacienteId) {
  const form = document.getElementById("reavaliacao-ss-form");
  if (!form) {
    console.error("Formulário #reavaliacao-ss-form não encontrado.");
    return;
  }
  const realizadaSelect = form.querySelector("#reavaliacao-realizada");

  if (realizadaSelect) {
    realizadaSelect.addEventListener(
      "change",
      updateReavaliacaoConditionalFields
    );
  } else {
    console.warn("Select #reavaliacao-realizada não encontrado.");
  }

  // Passa null para agendamentoId, pois estamos vindo da solicitação
  form.addEventListener("submit", (e) =>
    handleSalvarReavaliacaoSS(e, null, solicitacaoId, pacienteId)
  );
}

/**
 * Controla a exibição dos campos condicionais no formulário de reavaliação.
 */
function updateReavaliacaoConditionalFields() {
  const realizadaSelect = document.getElementById("reavaliacao-realizada");
  const naoRealizadaFields = document.getElementById(
    "reavaliacao-nao-realizada-fields"
  );
  const simRealizadaFields = document.getElementById(
    "reavaliacao-sim-realizada-fields"
  );
  if (!realizadaSelect || !naoRealizadaFields || !simRealizadaFields) return;

  const selecionado = realizadaSelect.value;

  naoRealizadaFields.style.display = "none";
  simRealizadaFields.style.display = "none";
  naoRealizadaFields
    .querySelectorAll("textarea, select")
    .forEach((el) => (el.required = false));
  simRealizadaFields
    .querySelectorAll("input, textarea")
    .forEach((el) => (el.required = false));

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
}

/**
 * Reseta os campos condicionais da reavaliação para o estado inicial.
 */
function resetConditionalFieldsReavaliacao() {
  const naoRealizadaFields = document.getElementById(
    "reavaliacao-nao-realizada-fields"
  );
  const simRealizadaFields = document.getElementById(
    "reavaliacao-sim-realizada-fields"
  );
  if (naoRealizadaFields) naoRealizadaFields.style.display = "none";
  if (simRealizadaFields) simRealizadaFields.style.display = "none";

  const motivoNao = document.getElementById("reavaliacao-motivo-nao");
  const reagendado = document.getElementById("reavaliacao-reagendado");
  const novoValor = document.getElementById("reavaliacao-novo-valor");
  const criterios = document.getElementById("reavaliacao-criterios");
  if (motivoNao) motivoNao.required = false;
  if (reagendado) reagendado.required = false;
  if (novoValor) novoValor.required = false;
  if (criterios) criterios.required = false;
}

/**
 * Salva os dados da reavaliação (Serviço Social). Atualiza a Solicitação e a Trilha.
 */
async function handleSalvarReavaliacaoSS(
  evento,
  agendamentoId,
  solicitacaoId,
  pacienteId
) {
  evento.preventDefault();
  const form = evento.target;
  const btnSalvar = form.querySelector("#btn-salvar-reavaliacao-ss");
  if (!btnSalvar) return;
  btnSalvar.disabled = true;
  btnSalvar.textContent = "Salvando...";

  const realizada = form.querySelector("#reavaliacao-realizada")?.value;

  try {
    const isFromSolicitacao = !!solicitacaoId; // Verifica se viemos de uma solicitação
    const solicitacaoRef = isFromSolicitacao
      ? doc(db, "solicitacoes", solicitacaoId)
      : null;
    // const agendamentoRef = agendamentoId ? doc(db, "agendamentos", agendamentoId) : null; // Referência se fosse de agendamento
    const pacienteRef = doc(db, "trilhaPaciente", pacienteId);

    const pacienteSnap = await getDoc(pacienteRef);
    if (!pacienteSnap.exists())
      throw new Error(`Paciente ${pacienteId} não encontrado.`);
    const pacienteDataAtual = pacienteSnap.data();
    const statusDeRetorno =
      pacienteDataAtual.statusAnteriorReavaliacao || "encaminhar_para_plantao"; // Status para restaurar

    let dadosPacienteUpdate = {
      status: statusDeRetorno,
      statusAnteriorReavaliacao: null,
      lastUpdate: serverTimestamp(),
    };
    let dadosSolicitacaoUpdate = null;
    // let dadosAgendamentoUpdate = null; // Se precisasse atualizar agendamento

    if (realizada === "sim") {
      const novoValorInput = form.querySelector("#reavaliacao-novo-valor");
      const criterios = form.querySelector("#reavaliacao-criterios")?.value;
      // Trata vírgula e ponto para valor
      const valorString = novoValorInput
        ? novoValorInput.value.replace(",", ".")
        : "0";
      const novoValor = parseFloat(valorString);

      if (
        isNaN(novoValor) ||
        novoValor <= 0 ||
        !criterios ||
        !criterios.trim()
      ) {
        throw new Error(
          "Preencha o novo valor (maior que zero) e os critérios."
        );
      }

      const novoRegistroHistorico = {
        valor: novoValor,
        data: Timestamp.now(),
        motivo: "Reavaliação",
        responsavelId: currentUserData.uid,
        responsavelNome: currentUserData.nome,
      };
      const novoHistorico = [
        ...(pacienteDataAtual.historicoContribuicao || []),
        novoRegistroHistorico,
      ];

      // Atualiza paciente com novo valor e histórico
      dadosPacienteUpdate.valorContribuicao = novoValor;
      dadosPacienteUpdate.historicoContribuicao = novoHistorico;

      if (isFromSolicitacao) {
        // Atualiza a SOLICITAÇÃO original para Concluída
        dadosSolicitacaoUpdate = {
          status: "Concluída",
          adminFeedback: {
            // Simula um feedback do SS
            statusFinal: "Concluída",
            mensagemAdmin: `Realizada por ${
              currentUserData.nome
            }. Novo valor: R$ ${novoValor.toFixed(2)}. Critérios: ${criterios}`,
            dataResolucao: serverTimestamp(),
            adminNome: currentUserData.nome,
            adminId: currentUserData.uid,
            novoValorContribuicao: novoValor,
            criteriosDefinicao: criterios,
          },
          lastUpdate: serverTimestamp(),
        };
      }
      // else if (agendamentoRef) { /* Atualizaria agendamento */ }

      // Atualiza Paciente (SEMPRE que for realizada)
      await updateDoc(pacienteRef, dadosPacienteUpdate);
    } else if (realizada === "nao") {
      const motivoNao = form.querySelector("#reavaliacao-motivo-nao")?.value;
      const reagendado = form.querySelector("#reavaliacao-reagendado")?.value;
      if (!motivoNao || !motivoNao.trim() || !reagendado)
        throw new Error("Preencha o motivo e se foi reagendado.");

      if (isFromSolicitacao) {
        // Atualiza a SOLICITAÇÃO original
        dadosSolicitacaoUpdate = {
          status: reagendado === "sim" ? "Pendente" : "NaoRealizada", // Mantém Pendente ou marca como não realizada
          adminFeedback: {
            statusFinal: reagendado === "sim" ? "Pendente" : "NaoRealizada",
            mensagemAdmin: `Não realizada por ${
              currentUserData.nome
            }. Motivo: ${motivoNao}. ${
              reagendado === "sim"
                ? "Necessário reagendar."
                : "Não será reagendada."
            }`,
            dataResolucao: serverTimestamp(),
            adminNome: currentUserData.nome,
            adminId: currentUserData.uid,
            motivoNaoRealizada: motivoNao,
            foiReagendado: reagendado === "sim",
          },
          lastUpdate: serverTimestamp(),
        };

        // Restaura status do paciente SÓ SE NÃO for reagendado
        if (reagendado === "nao") {
          await updateDoc(pacienteRef, dadosPacienteUpdate);
        } else {
          // Se reagendar, paciente continua 'aguardando_reavaliacao' no Firebase (até ser agendado de novo)
          // Apenas atualiza o lastUpdate para refletir a tentativa
          await updateDoc(pacienteRef, { lastUpdate: serverTimestamp() });
          // Importante: A solicitação volta a ser 'Pendente' (feito acima) para reaparecer na lista
        }
      }
      // else if (agendamentoRef) { /* Atualizaria agendamento */ }
    } else {
      throw new Error("Selecione se a reavaliação foi realizada.");
    }

    // Executa a atualização da solicitação, se houver
    if (dadosSolicitacaoUpdate && solicitacaoRef) {
      await updateDoc(solicitacaoRef, dadosSolicitacaoUpdate);
      console.log("Solicitação original atualizada:", solicitacaoId);
    }
    // Executa a atualização do agendamento, se houver
    // if (dadosAgendamentoUpdate && agendamentoRef) { ... }

    alert("Reavaliação salva com sucesso!");
    window.location.hash = "#agendamentos-view"; // Volta para a lista
  } catch (error) {
    console.error("Erro ao salvar reavaliação:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = "Salvar Reavaliação";
  }
}
