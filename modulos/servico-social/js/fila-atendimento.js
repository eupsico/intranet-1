// Arquivo: /modulos/servico-social/js/fila-atendimento.js
// Versão: 4.0 (Suporta Triagem E Reavaliação)

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
let currentAgendamentoData = null; // Para guardar dados do agendamento aberto (reavaliação)

/**
 * Função principal de inicialização da view Fila de Atendimento.
 * Determina se é Triagem ou Reavaliação com base na URL Hash.
 */
export function init(user, userData, trilhaId) {
  // trilhaId é o primeiro parâmetro da URL
  currentUserData = userData; // Salva os dados do usuário logado

  const hashParts = window.location.hash.substring(1).split("/");
  // Exemplo Triagem: #fila-atendimento/paciente123
  // Exemplo Reavaliação: #fila-atendimento/paciente123/reavaliacao/agendamento456
  const isReavaliacao =
    hashParts.length === 4 && hashParts[2] === "reavaliacao";
  const agendamentoId = isReavaliacao ? hashParts[3] : null; // Pega o ID do agendamento se for reavaliação

  const formTitle = document.getElementById("form-title");
  const triagemForm = document.getElementById("triagem-form");
  const reavaliacaoForm = document.getElementById("reavaliacao-ss-form");
  const btnVoltar = document.getElementById("btn-voltar-lista");

  // Ações do botão Voltar
  btnVoltar.addEventListener(
    "click",
    () => (window.location.hash = "#agendamentos-view") // Sempre volta para a view de agendamentos
  );

  // Reseta os formulários para garantir que campos required condicionais estejam desativados
  triagemForm.reset();
  reavaliacaoForm.reset();
  resetConditionalFieldsTriagem(); // Garante que campos da triagem estejam ocultos/não required
  resetConditionalFieldsReavaliacao(); // Garante que campos da reavaliação estejam ocultos/não required

  if (isReavaliacao) {
    // Modo Reavaliação
    formTitle.textContent = "Formulário de Reavaliação";
    triagemForm.style.display = "none";
    reavaliacaoForm.style.display = "block";

    carregarDadosPaciente(trilhaId); // Carrega dados do paciente (coluna esquerda)
    carregarDadosReavaliacao(agendamentoId, trilhaId); // Carrega dados da solicitação (coluna direita, dentro do form)
    setupReavaliacaoFormListeners(agendamentoId, trilhaId); // Prepara listeners do formulário de reavaliação
  } else {
    // Modo Triagem (lógica original)
    formTitle.textContent = "Formulário de Triagem";
    triagemForm.style.display = "block";
    reavaliacaoForm.style.display = "none";

    carregarDadosPaciente(trilhaId); // Carrega dados do paciente (coluna esquerda)
    setupTriagemForm(user, userData, trilhaId); // Inicia a lógica original do formulário de triagem
  }
}

/**
 * Carrega os dados do paciente na coluna da esquerda.
 * Função genérica usada por Triagem e Reavaliação.
 */
async function carregarDadosPaciente(trilhaId) {
  const patientDetailsContainer = document.getElementById(
    "patient-details-container"
  );
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
        : "Não informado";
    const formatArray = (arr) =>
      arr && arr.length > 0 ? arr.join(", ") : "N/A";
    const formatCurrency = (value) =>
      value
        ? `R$ ${parseFloat(value).toFixed(2).replace(".", ",")}`
        : "Aguardando definição";

    // Função interna para formatar histórico
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
    patientDetailsContainer.innerHTML = `<p class="error-message">Erro ao carregar dados: ${error.message}</p>`;
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

// --- Lógica Específica do Formulário de Triagem ---

/**
 * Configura os listeners e a lógica do formulário de triagem.
 */
function setupTriagemForm(user, userData, trilhaId) {
  const triagemForm = document.getElementById("triagem-form");
  const statusSelect = document.getElementById("triagem-status");
  const valorContribuicaoInput = document.getElementById("valor-contribuicao");
  const ampliarDisponibilidadeSelect = document.getElementById(
    "ampliar-disponibilidade"
  );
  const novaDisponibilidadeContainer = document.getElementById(
    "nova-disponibilidade-container"
  );

  // Formatação de moeda
  valorContribuicaoInput.addEventListener("input", () =>
    formatarMoeda(valorContribuicaoInput)
  );

  // Mostrar/Esconder campos condicionais da triagem
  statusSelect.addEventListener("change", updateTriagemConditionalFields);

  // Mostrar/Esconder campos de nova disponibilidade
  ampliarDisponibilidadeSelect.addEventListener("change", () => {
    toggleNovaDisponibilidade(
      ampliarDisponibilidadeSelect,
      novaDisponibilidadeContainer
    );
  });

  // Submissão do formulário de triagem
  triagemForm.addEventListener("submit", (e) =>
    handleSalvarTriagem(e, user, userData, trilhaId)
  );

  // Carregar queixa principal no formulário (já que carregarDadosPaciente agora é genérico)
  loadQueixaTriagem(trilhaId);
}

/**
 * Carrega a queixa principal especificamente para o formulário de triagem.
 */
async function loadQueixaTriagem(trilhaId) {
  try {
    const trilhaDocRef = doc(db, "trilhaPaciente", trilhaId);
    const trilhaDoc = await getDoc(trilhaDocRef);
    if (trilhaDoc.exists()) {
      document.getElementById("queixa-paciente").value =
        trilhaDoc.data().motivoBusca || "";
    }
  } catch (error) {
    console.error("Erro ao carregar queixa para formulário de triagem:", error);
  }
}

/**
 * Formata um valor numérico como moeda BRL.
 */
function formatarMoeda(input) {
  let value = input.value.replace(/\D/g, "");
  if (value === "") {
    input.value = "";
    return;
  }
  // Converte para número, divide por 100, formata e remove o "R$" inicial
  value = (parseInt(value, 10) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  input.value = value; // Mantém apenas o número formatado
}

/**
 * Controla a exibição dos campos condicionais no formulário de triagem.
 */
function updateTriagemConditionalFields() {
  const statusSelect = document.getElementById("triagem-status");
  const camposEncaminhado = document.getElementById("campos-encaminhado");
  const camposObservacao = document.getElementById("campos-observacao");
  const valorContribuicaoInput = document.getElementById("valor-contribuicao");
  const criteriosTextarea = document.getElementById("criterios-valor");
  const observacaoTextarea = document.getElementById("observacao-geral");

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

/**
 * Mostra ou esconde a seção de nova disponibilidade na triagem.
 */
function toggleNovaDisponibilidade(selectElement, containerElement) {
  if (selectElement.value === "sim") {
    containerElement.style.display = "block";
    if (containerElement.innerHTML.trim() === "") {
      // Só gera se estiver vazio
      containerElement.innerHTML = `
                <h3 class="form-section-title">Nova Disponibilidade de Horário</h3>
                <div class="form-group">
                    <label>Opção de horário(s) para atendimento:</label>
                    <div class="horarios-options-container">
                        <div><label><input type="checkbox" name="horario" value="manha-semana"> Manhã (Durante a semana)</label></div>
                        <div><label><input type="checkbox" name="horario" value="tarde-semana"> Tarde (Durante a semana)</label></div>
                        <div><label><input type="checkbox" name="horario" value="noite-semana"> Noite (Durante a semana)</label></div>
                        <div><label><input type="checkbox" name="horario" value="manha-sabado"> Manhã (Sábado)</label></div>
                    </div>
                </div>
                <div id="horarios-especificos-container">
                    <div id="container-manha-semana" class="horario-detalhe-container" style="display:none;"></div>
                    <div id="container-tarde-semana" class="horario-detalhe-container" style="display:none;"></div>
                    <div id="container-noite-semana" class="horario-detalhe-container" style="display:none;"></div>
                    <div id="container-manha-sabado" class="horario-detalhe-container" style="display:none;"></div>
                </div>`;

      containerElement
        .querySelectorAll('input[name="horario"]')
        .forEach((checkbox) => {
          checkbox.addEventListener("change", (e) => {
            const periodo = e.target.value;
            const containerHorarios = containerElement.querySelector(
              `#container-${periodo}`
            );
            if (e.target.checked) {
              gerarHorariosEspecificos(periodo, containerHorarios);
              containerHorarios.style.display = "block";
            } else {
              containerHorarios.innerHTML = "";
              containerHorarios.style.display = "none";
            }
          });
        });
    }
  } else {
    containerElement.style.display = "none";
    containerElement.innerHTML = ""; // Limpa para evitar IDs duplicados se abrir de novo
  }
}

/**
 * Gera os checkboxes de horários específicos para a triagem.
 */
function gerarHorariosEspecificos(periodo, container) {
  let horarios = [],
    label = "";
  switch (periodo) {
    case "manha-semana":
      label = "Manhã (Seg-Sex):";
      for (let i = 8; i < 12; i++)
        horarios.push(`${String(i).padStart(2, "0")}:00`);
      break;
    case "tarde-semana":
      label = "Tarde (Seg-Sex):";
      for (let i = 12; i < 18; i++)
        horarios.push(`${String(i).padStart(2, "0")}:00`);
      break;
    case "noite-semana":
      label = "Noite (Seg-Sex):";
      for (let i = 18; i < 21; i++)
        horarios.push(`${String(i).padStart(2, "0")}:00`);
      break; // Ajustado até 20:00
    case "manha-sabado":
      label = "Manhã (Sábado):";
      for (let i = 8; i < 13; i++)
        horarios.push(`${String(i).padStart(2, "0")}:00`);
      break;
  }
  let html = `<label>${label}</label><div class="horario-detalhe-grid">`;
  horarios.forEach((hora) => {
    html += `<div><label><input type="checkbox" name="horario-especifico" value="${periodo}_${hora}"> ${hora}</label></div>`;
  });
  container.innerHTML = html + `</div>`;
}

/**
 * Processa e salva o formulário de triagem.
 */
async function handleSalvarTriagem(evento, user, userData, trilhaId) {
  evento.preventDefault();
  const triagemForm = evento.target;
  const statusSelect = document.getElementById("triagem-status");
  const valorContribuicaoInput = document.getElementById("valor-contribuicao");
  const criteriosTextarea = document.getElementById("criterios-valor");
  const observacaoTextarea = document.getElementById("observacao-geral");
  const ampliarDisponibilidadeSelect = document.getElementById(
    "ampliar-disponibilidade"
  );
  const novaDisponibilidadeContainer = document.getElementById(
    "nova-disponibilidade-container"
  );

  // Validação extra manual
  if (statusSelect.value === "encaminhado") {
    if (
      !valorContribuicaoInput.value ||
      valorContribuicaoInput.value === "R$ 0,00" ||
      !criteriosTextarea.value.trim()
    ) {
      alert(
        'Os campos "Valor da contribuição" (deve ser maior que zero) e "Critérios" são obrigatórios para encaminhamento.'
      );
      return;
    }
  } else if (
    statusSelect.value === "nao_realizada" ||
    statusSelect.value === "desistiu"
  ) {
    if (!observacaoTextarea.value.trim()) {
      alert('O campo "Observação" é obrigatório para este status.');
      return;
    }
  } else if (!statusSelect.value) {
    alert("Selecione o status da triagem.");
    return;
  }

  const saveButton = triagemForm.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  saveButton.textContent = "Salvando...";

  try {
    const trilhaDocRef = doc(db, "trilhaPaciente", trilhaId);
    const status = statusSelect.value;
    let dadosParaSalvar = {
      lastUpdate: serverTimestamp(),
      assistenteSocialTriagem: { uid: user.uid, nome: userData.nome },
    };

    if (status === "encaminhado") {
      // Limpa o valor da contribuição para salvar apenas o número
      const valorNumerico =
        parseFloat(valorContribuicaoInput.value.replace(/\D/g, "")) / 100;
      if (isNaN(valorNumerico) || valorNumerico <= 0) {
        throw new Error("Valor da contribuição inválido.");
      }

      dadosParaSalvar = {
        ...dadosParaSalvar,
        status: "encaminhar_para_plantao",
        valorContribuicao: valorNumerico, // Salva o número
        criteriosValor: criteriosTextarea.value,
        modalidadeAtendimento: document.getElementById("modalidade-atendimento")
          .value,
        preferenciaAtendimento:
          document.getElementById("preferencia-genero").value,
        queixaPrincipal: document.getElementById("queixa-paciente").value,
        // Adiciona o primeiro registro ao histórico
        historicoContribuicao: [
          {
            valor: valorNumerico,
            data: Timestamp.now(), // Usar Timestamp.now() aqui também
            motivo: "Triagem",
            responsavelId: currentUserData.uid,
            responsavelNome: currentUserData.nome,
          },
        ],
      };

      if (ampliarDisponibilidadeSelect.value === "sim") {
        dadosParaSalvar.disponibilidadeGeral = Array.from(
          novaDisponibilidadeContainer.querySelectorAll(
            'input[name="horario"]:checked'
          )
        ).map((cb) => cb.parentElement.textContent.trim());
        dadosParaSalvar.disponibilidadeEspecifica = Array.from(
          novaDisponibilidadeContainer.querySelectorAll(
            'input[name="horario-especifico"]:checked'
          )
        ).map((cb) => cb.value);
      }
    } else if (status === "desistiu") {
      dadosParaSalvar = {
        ...dadosParaSalvar,
        status: "desistencia",
        desistenciaMotivo: `Desistiu na etapa de triagem. Motivo: ${observacaoTextarea.value}`,
      };
    } else {
      // nao_realizada
      dadosParaSalvar.status = "inscricao_documentos"; // Volta para a fila de inscrição
      dadosParaSalvar.statusTriagem = status;
      dadosParaSalvar.observacoesTriagem = observacaoTextarea.value;
    }

    await updateDoc(trilhaDocRef, dadosParaSalvar);
    alert(
      "Ficha de triagem salva com sucesso! O paciente foi atualizado na Trilha do Paciente."
    );
    window.location.hash = "#agendamentos-view";
  } catch (error) {
    console.error("Erro ao salvar a triagem:", error);
    alert("Ocorreu um erro ao salvar a ficha. Tente novamente.");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Salvar Triagem";
  }
}

/**
 * Reseta os campos condicionais da triagem para o estado inicial.
 */
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

  // Desativar required
  document.getElementById("valor-contribuicao").required = false;
  document.getElementById("criterios-valor").required = false;
  document.getElementById("observacao-geral").required = false;
}

// --- Lógica Específica do Formulário de Reavaliação ---

/**
 * Carrega os dados da solicitação de reavaliação e preenche o formulário.
 */
async function carregarDadosReavaliacao(agendamentoId, pacienteId) {
  const loadingInfo = document.getElementById("reavaliacao-loading-info");
  loadingInfo.style.display = "block";

  try {
    const agendamentoRef = doc(db, "agendamentos", agendamentoId);
    const agendamentoSnap = await getDoc(agendamentoRef);

    if (!agendamentoSnap.exists()) {
      throw new Error("Agendamento não encontrado.");
    }
    currentAgendamentoData = {
      id: agendamentoSnap.id,
      ...agendamentoSnap.data(),
    }; // Guarda os dados com ID

    // Preenche informações da solicitação
    document.getElementById("reavaliacao-modal-paciente-nome").textContent =
      currentAgendamentoData.pacienteNome || "-";
    document.getElementById("reavaliacao-modal-profissional-nome").textContent =
      currentAgendamentoData.profissionalNome || "-";
    const valorAtualFormatado = currentAgendamentoData.solicitacaoInfo
      ?.valorContribuicaoAtual
      ? `R$ ${parseFloat(
          currentAgendamentoData.solicitacaoInfo.valorContribuicaoAtual
        )
          .toFixed(2)
          .replace(".", ",")}`
      : "-";
    document.getElementById("reavaliacao-modal-valor-atual").textContent =
      valorAtualFormatado;
    document.getElementById("reavaliacao-modal-motivo").textContent =
      currentAgendamentoData.solicitacaoInfo?.motivoReavaliacao || "-";

    // Preenche IDs nos campos hidden
    document.getElementById("reavaliacao-agendamento-id").value = agendamentoId;
    document.getElementById("reavaliacao-paciente-id-ss").value = pacienteId;
  } catch (error) {
    console.error(
      "Erro ao carregar dados para o formulário de reavaliação:",
      error
    );
    alert(`Erro ao carregar dados: ${error.message}`);
    // Opcional: redirecionar ou mostrar mensagem de erro persistente
  } finally {
    loadingInfo.style.display = "none"; // Esconde o spinner
  }
}

/**
 * Configura os listeners do formulário de reavaliação.
 */
function setupReavaliacaoFormListeners(agendamentoId, pacienteId) {
  const form = document.getElementById("reavaliacao-ss-form");
  const realizadaSelect = form.querySelector("#reavaliacao-realizada");

  // Listener para mostrar/esconder campos e definir 'required'
  realizadaSelect.addEventListener(
    "change",
    updateReavaliacaoConditionalFields
  );

  // Listener para o submit do formulário
  form.addEventListener("submit", (e) =>
    handleSalvarReavaliacaoSS(e, agendamentoId, pacienteId)
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

  // Desativar required
  document.getElementById("reavaliacao-motivo-nao").required = false;
  document.getElementById("reavaliacao-reagendado").required = false;
  document.getElementById("reavaliacao-novo-valor").required = false;
  document.getElementById("reavaliacao-criterios").required = false;
}

/**
 * Salva os dados da reavaliação (Serviço Social).
 * Função movida e CORRIGIDA para usar Timestamp.now() no array.
 */
async function handleSalvarReavaliacaoSS(evento, agendamentoId, pacienteId) {
  evento.preventDefault();
  const form = evento.target;
  const btnSalvar = form.querySelector("#btn-salvar-reavaliacao-ss");
  btnSalvar.disabled = true;
  btnSalvar.textContent = "Salvando...";

  const realizada = form.querySelector("#reavaliacao-realizada").value;

  try {
    const agendamentoRef = doc(db, "agendamentos", agendamentoId);

    let dadosAgendamentoUpdate = {
      status: "",
      resultadoReavaliacao: {
        realizada: realizada === "sim",
        registradoPorId: currentUserData.uid,
        registradoPorNome: currentUserData.nome,
        registradoEm: serverTimestamp(), // OK usar serverTimestamp aqui (objeto/map)
      },
      lastUpdate: serverTimestamp(),
    };

    if (realizada === "sim") {
      const novoValorInput = form.querySelector("#reavaliacao-novo-valor");
      const criterios = form.querySelector("#reavaliacao-criterios").value;
      const novoValor = parseFloat(novoValorInput.value); // Converte para número

      if (isNaN(novoValor) || novoValor <= 0 || !criterios.trim()) {
        // Adicionado trim() para critérios
        throw new Error(
          "Preencha o novo valor (maior que zero) e os critérios."
        );
      }

      dadosAgendamentoUpdate.status = "realizado";
      dadosAgendamentoUpdate.resultadoReavaliacao.novoValorContribuicao =
        novoValor;
      dadosAgendamentoUpdate.resultadoReavaliacao.criteriosDefinicao =
        criterios;

      // --- INÍCIO DA CORREÇÃO DO ERRO ---
      const pacienteRef = doc(db, "trilhaPaciente", pacienteId);
      const pacienteSnap = await getDoc(pacienteRef);
      const pacienteDataAtual = pacienteSnap.exists()
        ? pacienteSnap.data()
        : {};

      const novoRegistroHistorico = {
        valor: novoValor,
        data: Timestamp.now(), // FIX: Usar Timestamp.now() para arrays
        motivo: "Reavaliação",
        responsavelId: currentUserData.uid,
        responsavelNome: currentUserData.nome,
      };

      const novoHistorico = [
        ...(pacienteDataAtual.historicoContribuicao || []),
        novoRegistroHistorico,
      ];

      const dadosPacienteUpdate = {
        valorContribuicao: novoValor,
        historicoContribuicao: novoHistorico,
        lastUpdate: serverTimestamp(),
      };

      // Executa as atualizações em sequência
      await updateDoc(agendamentoRef, dadosAgendamentoUpdate);
      await updateDoc(pacienteRef, dadosPacienteUpdate);
      // --- FIM DA CORREÇÃO DO ERRO ---
    } else if (realizada === "nao") {
      const motivoNao = form.querySelector("#reavaliacao-motivo-nao").value;
      const reagendado = form.querySelector("#reavaliacao-reagendado").value;

      if (!motivoNao.trim() || !reagendado) {
        // Adicionado trim() para motivo
        throw new Error("Preencha o motivo e se foi reagendado.");
      }

      dadosAgendamentoUpdate.resultadoReavaliacao.motivoNaoRealizada =
        motivoNao;
      dadosAgendamentoUpdate.resultadoReavaliacao.foiReagendado =
        reagendado === "sim";
      dadosAgendamentoUpdate.status =
        reagendado === "sim" ? "reagendado" : "ausente";

      await updateDoc(agendamentoRef, dadosAgendamentoUpdate);
    } else {
      throw new Error("Selecione se a reavaliação foi realizada.");
    }

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
