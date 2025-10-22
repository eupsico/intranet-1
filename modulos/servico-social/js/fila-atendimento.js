// Arquivo: /modulos/servico-social/js/fila-atendimento.js
// --- VERSÃO CORRIGIDA (Garante carregamento dos campos condicionais) ---

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
 */
export function init(user, userData, trilhaId) {
  currentUserData = userData;

  const hashParts = window.location.hash.substring(1).split("/");
  const isReavaliacao = hashParts.length >= 3 && hashParts[2] === "reavaliacao";
  const solicitacaoId = isReavaliacao ? hashParts[3] : null;

  const formTitle = document.getElementById("form-title");
  const triagemForm = document.getElementById("triagem-form");
  const reavaliacaoForm = document.getElementById("reavaliacao-ss-form");
  const btnVoltar = document.getElementById("btn-voltar-lista");

  if (btnVoltar) {
    // Remove listener antigo para evitar duplicação se init for chamado novamente
    const oldVoltarListener = btnVoltar._clickListener;
    if (oldVoltarListener)
      btnVoltar.removeEventListener("click", oldVoltarListener);
    // Adiciona novo listener
    const newVoltarListener = () =>
      (window.location.hash = "#agendamentos-view");
    btnVoltar.addEventListener("click", newVoltarListener);
    btnVoltar._clickListener = newVoltarListener; // Guarda referência
  } else {
    console.warn("Botão 'Voltar' (#btn-voltar-lista) não encontrado.");
  }

  // Reseta forms
  if (triagemForm) {
    triagemForm.reset();
    resetConditionalFieldsTriagem();
  } else {
    console.warn("Formulário de Triagem (#triagem-form) não encontrado.");
  }
  if (reavaliacaoForm) {
    reavaliacaoForm.reset();
    resetConditionalFieldsReavaliacao();
  } else {
    console.warn(
      "Formulário de Reavaliação (#reavaliacao-ss-form) não encontrado."
    );
  }

  if (isReavaliacao) {
    if (formTitle) formTitle.textContent = "Formulário de Reavaliação";
    if (triagemForm) triagemForm.style.display = "none";
    if (reavaliacaoForm) reavaliacaoForm.style.display = "block";
    carregarDadosPaciente(trilhaId);
    carregarDadosReavaliacao(solicitacaoId, trilhaId);
    // Garante que o form existe antes de adicionar listeners
    if (reavaliacaoForm) {
      setupReavaliacaoFormListeners(solicitacaoId, trilhaId);
    }
  } else {
    if (formTitle) formTitle.textContent = "Formulário de Triagem";
    if (triagemForm) triagemForm.style.display = "block";
    if (reavaliacaoForm) reavaliacaoForm.style.display = "none";
    carregarDadosPaciente(trilhaId);
    // Garante que o form existe antes de adicionar listeners
    if (triagemForm) {
      setupTriagemForm(user, userData, trilhaId);
    }
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
    console.error("#patient-details-container não encontrado.");
    return;
  }
  patientDetailsContainer.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const trilhaDocRef = doc(db, "trilhaPaciente", trilhaId);
    const trilhaDoc = await getDoc(trilhaDocRef);
    if (!trilhaDoc.exists()) {
      throw new Error("Paciente não encontrado na trilha.");
    }
    const data = trilhaDoc.data();
    // Funções de formatação
    const formatDate = (dateStr) =>
      dateStr
        ? new Date(dateStr + "T03:00:00").toLocaleDateString("pt-BR")
        : "N/I";
    const formatArray = (arr) =>
      arr && arr.length > 0 ? arr.join(", ") : "N/A";
    const formatCurrency = (value) =>
      value != null
        ? `R$ ${parseFloat(value).toFixed(2).replace(".", ",")}`
        : "Aguardando"; // Trata 0
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

    // Renderiza detalhes do paciente
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
            }</p></div>`;
  } catch (error) {
    console.error("Erro ao carregar dados do paciente:", error);
    patientDetailsContainer.innerHTML = `<p class="error-message">Erro ao carregar dados do paciente: ${error.message}</p>`;
  }
}

/**
 * Formata a disponibilidade específica para exibição.
 */
function formatarDisponibilidadeEspecifica(disponibilidade) {
  if (!disponibilidade || disponibilidade.length === 0)
    return "Nenhum horário detalhado informado.";
  const dias = {
    "manha-semana": { label: "Manhã (Semana)", horarios: [] },
    "tarde-semana": { label: "Tarde (Semana)", horarios: [] },
    "noite-semana": { label: "Noite (Semana)", horarios: [] },
    "manha-sabado": { label: "Manhã (Sábado)", horarios: [] },
  };
  disponibilidade.forEach((item) => {
    const [periodo, hora] = item.split("_");
    if (dias[periodo]) dias[periodo].horarios.push(hora);
  });
  let html = "";
  for (const key in dias) {
    if (dias[key].horarios.length > 0) {
      dias[key].horarios.sort();
      html += `<strong>${dias[key].label}:</strong> ${dias[key].horarios.join(
        ", "
      )}<br>`;
    }
  }
  return html || "Nenhum horário detalhado informado.";
}

// --- Lógica Específica do Formulário de Triagem ---

// *** FUNÇÃO setupTriagemForm REVISADA ***
function setupTriagemForm(user, userData, trilhaId) {
  const triagemForm = document.getElementById("triagem-form");
  if (!triagemForm) {
    console.error("#triagem-form não encontrado durante setup.");
    return;
  }
  console.log("setupTriagemForm: Configurando listeners...");

  const statusSelect = document.getElementById("triagem-status");
  const valorContribuicaoInput = document.getElementById("valor-contribuicao");
  const ampliarDisponibilidadeSelect = document.getElementById(
    "ampliar-disponibilidade"
  );
  const novaDisponibilidadeContainer = document.getElementById(
    "nova-disponibilidade-container"
  );

  // Adiciona listener para formatação de moeda
  if (valorContribuicaoInput) {
    // Remove listener antigo se existir
    const oldInputListener = valorContribuicaoInput._inputListener;
    if (oldInputListener)
      valorContribuicaoInput.removeEventListener("input", oldInputListener);
    // Adiciona novo
    const newInputListener = () => formatarMoeda(valorContribuicaoInput);
    valorContribuicaoInput.addEventListener("input", newInputListener);
    valorContribuicaoInput._inputListener = newInputListener; // Guarda referência
  } else {
    console.warn("#valor-contribuicao não encontrado.");
  }

  // Adiciona listener para campos condicionais do Status
  if (statusSelect) {
    // Remove listener antigo se existir
    const oldChangeListener = statusSelect._changeListener;
    if (oldChangeListener)
      statusSelect.removeEventListener("change", oldChangeListener);
    // Adiciona novo
    statusSelect.addEventListener("change", updateTriagemConditionalFields);
    statusSelect._changeListener = updateTriagemConditionalFields; // Guarda referência
    console.log("Listener 'change' adicionado a #triagem-status");
  } else {
    console.warn("#triagem-status não encontrado.");
  }

  // Adiciona listener para campos condicionais da Disponibilidade
  if (ampliarDisponibilidadeSelect && novaDisponibilidadeContainer) {
    // Remove listener antigo se existir
    const oldAmpliChangeListener = ampliarDisponibilidadeSelect._changeListener;
    if (oldAmpliChangeListener)
      ampliarDisponibilidadeSelect.removeEventListener(
        "change",
        oldAmpliChangeListener
      );
    // Adiciona novo
    const newAmpliChangeListener = () =>
      toggleNovaDisponibilidade(
        ampliarDisponibilidadeSelect,
        novaDisponibilidadeContainer
      );
    ampliarDisponibilidadeSelect.addEventListener(
      "change",
      newAmpliChangeListener
    );
    ampliarDisponibilidadeSelect._changeListener = newAmpliChangeListener; // Guarda referência
    console.log("Listener 'change' adicionado a #ampliar-disponibilidade");
  } else {
    console.warn(
      "#ampliar-disponibilidade ou #nova-disponibilidade-container não encontrados."
    );
  }

  // Adiciona listener de submit (removendo o antigo)
  const currentSubmitListener = triagemForm._submitListener;
  if (currentSubmitListener)
    triagemForm.removeEventListener("submit", currentSubmitListener);
  const newSubmitListener = (e) =>
    handleSalvarTriagem(e, user, userData, trilhaId);
  triagemForm.addEventListener("submit", newSubmitListener);
  triagemForm._submitListener = newSubmitListener;
  console.log("Listener 'submit' adicionado a #triagem-form");

  // Carrega a queixa e define o estado inicial dos campos condicionais
  loadQueixaTriagem(trilhaId);
  console.log(
    "Chamando updateTriagemConditionalFields e toggleNovaDisponibilidade (inicial)."
  );
  updateTriagemConditionalFields(); // Chama para definir estado inicial
  if (ampliarDisponibilidadeSelect && novaDisponibilidadeContainer) {
    toggleNovaDisponibilidade(
      ampliarDisponibilidadeSelect,
      novaDisponibilidadeContainer
    ); // Chama para definir estado inicial
  }
}
// *** FIM DA FUNÇÃO setupTriagemForm REVISADA ***

async function loadQueixaTriagem(trilhaId) {
  try {
    const trilhaDocRef = doc(db, "trilhaPaciente", trilhaId);
    const trilhaDoc = await getDoc(trilhaDocRef);
    if (trilhaDoc.exists()) {
      const queixaInput = document.getElementById("queixa-paciente");
      if (queixaInput) queixaInput.value = trilhaDoc.data().motivoBusca || "";
      else console.warn("#queixa-paciente não encontrado.");
    }
  } catch (error) {
    console.error("Erro ao carregar queixa para triagem:", error);
  }
}
function formatarMoeda(input) {
  if (!input) return;
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
  console.log("updateTriagemConditionalFields: Executando..."); // Log
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
  ) {
    console.error(
      "updateTriagemConditionalFields: Elementos condicionais não encontrados!"
    );
    return;
  }

  const selectedValue = statusSelect.value;
  console.log(
    "updateTriagemConditionalFields: Valor selecionado:",
    selectedValue
  ); // Log

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
  console.log(
    "updateTriagemConditionalFields: Visibilidade e required atualizados."
  ); // Log
}
function toggleNovaDisponibilidade(selectElement, containerElement) {
  if (!selectElement || !containerElement) return;
  console.log(
    "toggleNovaDisponibilidade: Valor selecionado:",
    selectElement.value
  ); // Log
  if (selectElement.value === "sim") {
    containerElement.style.display = "block";
    if (containerElement.innerHTML.trim() === "") {
      // Gera o HTML da disponibilidade
      containerElement.innerHTML = `
                <h3 class="form-section-title">Nova Disponibilidade de Horário</h3>
                <div class="form-group">
                    <label>Opção de horário(s) para atendimento:</label>
                    <div class="horarios-options-container">
                        <div><label><input type="checkbox" name="horario" value="manha-semana"> Manhã (Semana)</label></div>
                        <div><label><input type="checkbox" name="horario" value="tarde-semana"> Tarde (Semana)</label></div>
                        <div><label><input type="checkbox" name="horario" value="noite-semana"> Noite (Semana)</label></div>
                        <div><label><input type="checkbox" name="horario" value="manha-sabado"> Manhã (Sábado)</label></div>
                    </div>
                </div>
                <div id="horarios-especificos-container">
                    <div id="container-manha-semana" class="horario-detalhe-container" style="display:none;"></div>
                    <div id="container-tarde-semana" class="horario-detalhe-container" style="display:none;"></div>
                    <div id="container-noite-semana" class="horario-detalhe-container" style="display:none;"></div>
                    <div id="container-manha-sabado" class="horario-detalhe-container" style="display:none;"></div>
                </div>`;
      // Adiciona listeners aos checkboxes gerais
      containerElement
        .querySelectorAll('input[name="horario"]')
        .forEach((checkbox) => {
          checkbox.addEventListener("change", (e) => {
            const periodo = e.target.value;
            const containerHorarios = containerElement.querySelector(
              `#container-${periodo}`
            );
            if (containerHorarios) {
              if (e.target.checked) {
                gerarHorariosEspecificos(periodo, containerHorarios);
                containerHorarios.style.display = "block";
              } else {
                containerHorarios.innerHTML = "";
                containerHorarios.style.display = "none";
              }
            }
          });
        });
    }
  } else {
    containerElement.style.display = "none";
    containerElement.innerHTML = ""; // Limpa para evitar IDs duplicados
  }
}
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
      break;
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
async function handleSalvarTriagem(evento, user, userData, trilhaId) {
  evento.preventDefault();
  const triagemForm = evento.target;
  if (!triagemForm) {
    console.error("Erro: formulário não encontrado.");
    return;
  }
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
  const modalidadeSelect = document.getElementById("modalidade-atendimento");
  const preferenciaSelect = document.getElementById("preferencia-genero");
  const queixaInput = document.getElementById("queixa-paciente");
  const statusValue = statusSelect ? statusSelect.value : null;
  if (!statusValue) {
    alert("Selecione o status.");
    return;
  }
  if (statusValue === "encaminhado") {
    const valorRaw = valorContribuicaoInput ? valorContribuicaoInput.value : "";
    const criteriosValue = criteriosTextarea
      ? criteriosTextarea.value.trim()
      : "";
    const valorNumerico =
      parseFloat(valorRaw.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    if (isNaN(valorNumerico) || valorNumerico <= 0 || !criteriosValue) {
      alert("Valor (>0) e Critérios são obrigatórios.");
      return;
    }
  } else if (statusValue === "nao_realizada" || statusValue === "desistiu") {
    const obsValue = observacaoTextarea ? observacaoTextarea.value.trim() : "";
    if (!obsValue) {
      alert("Observação obrigatória.");
      return;
    }
  }
  const saveButton = triagemForm.querySelector('button[type="submit"]');
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Salvando...";
  }
  try {
    const trilhaDocRef = doc(db, "trilhaPaciente", trilhaId);
    let dadosParaSalvar = {
      lastUpdate: serverTimestamp(),
      assistenteSocialTriagem: { uid: user.uid, nome: userData.nome },
    };
    if (statusValue === "encaminhado") {
      const valorNumerico =
        parseFloat(
          valorContribuicaoInput.value.replace(/[^\d,]/g, "").replace(",", ".")
        ) || 0;
      const trilhaSnap = await getDoc(trilhaDocRef);
      const trilhaData = trilhaSnap.exists() ? trilhaSnap.data() : {};
      dadosParaSalvar = {
        ...dadosParaSalvar,
        status: "encaminhar_para_plantao",
        valorContribuicao: valorNumerico,
        criteriosValor: criteriosTextarea ? criteriosTextarea.value : null,
        modalidadeAtendimento: modalidadeSelect ? modalidadeSelect.value : null,
        preferenciaAtendimento: preferenciaSelect
          ? preferenciaSelect.value
          : null,
        queixaPrincipal: queixaInput ? queixaInput.value : null,
        historicoContribuicao: [
          ...(Array.isArray(trilhaData.historicoContribuicao)
            ? trilhaData.historicoContribuicao
            : []),
          {
            valor: valorNumerico,
            data: Timestamp.now(),
            motivo: "Triagem",
            responsavelId: currentUserData.uid,
            responsavelNome: currentUserData.nome,
          },
        ],
      };
      if (
        ampliarDisponibilidadeSelect &&
        ampliarDisponibilidadeSelect.value === "sim" &&
        novaDisponibilidadeContainer
      ) {
        dadosParaSalvar.disponibilidadeGeral = Array.from(
          novaDisponibilidadeContainer.querySelectorAll(
            'input[name="horario"]:checked'
          )
        ).map((cb) => cb.parentElement?.textContent?.trim() || "");
        dadosParaSalvar.disponibilidadeEspecifica = Array.from(
          novaDisponibilidadeContainer.querySelectorAll(
            'input[name="horario-especifico"]:checked'
          )
        ).map((cb) => cb.value);
      }
    } else if (statusValue === "desistiu") {
      dadosParaSalvar = {
        ...dadosParaSalvar,
        status: "desistencia",
        desistenciaMotivo: `Desistiu na triagem. Motivo: ${
          observacaoTextarea ? observacaoTextarea.value : "N/A"
        }`,
      };
    } else {
      dadosParaSalvar.status = "inscricao_documentos";
      dadosParaSalvar.statusTriagem = statusValue;
      dadosParaSalvar.observacoesTriagem = observacaoTextarea
        ? observacaoTextarea.value
        : null;
    }
    await updateDoc(trilhaDocRef, dadosParaSalvar);
    alert("Ficha salva!");
    window.location.hash = "#agendamentos-view";
  } catch (error) {
    console.error("Erro ao salvar triagem:", error);
    alert(`Erro: ${error.message}.`);
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Salvar Triagem";
    }
  }
}

// --- Lógica Específica do Formulário de Reavaliação ---

// *** FUNÇÃO carregarDadosReavaliacao REVISADA ***
async function carregarDadosReavaliacao(solicitacaoId, pacienteId) {
  const loadingInfo = document.getElementById("reavaliacao-loading-info");
  const formReavaliacao = document.getElementById("reavaliacao-ss-form");
  if (!loadingInfo || !formReavaliacao) {
    console.error("Elementos do form de reavaliação não encontrados.");
    return;
  }
  loadingInfo.style.display = "block";

  try {
    const solicitacaoRef = doc(db, "solicitacoes", solicitacaoId);
    const solicitacaoSnap = await getDoc(solicitacaoRef);
    if (!solicitacaoSnap.exists()) {
      throw new Error("Solicitação de reavaliação não encontrada.");
    }
    const solicitacaoData = solicitacaoSnap.data();
    const detalhes = solicitacaoData.detalhes || {};

    // Preenche informações da solicitação
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
    else console.warn("#reavaliacao-modal-paciente-nome não encontrado.");
    if (profissionalNomeEl)
      profissionalNomeEl.textContent = solicitacaoData.solicitanteNome || "-";
    else console.warn("#reavaliacao-modal-profissional-nome não encontrado.");
    const valorAtualFormatado =
      detalhes.valorContribuicaoAtual != null
        ? `R$ ${parseFloat(detalhes.valorContribuicaoAtual)
            .toFixed(2)
            .replace(".", ",")}`
        : "-"; // Trata 0
    if (valorAtualEl) valorAtualEl.textContent = valorAtualFormatado;
    else console.warn("#reavaliacao-modal-valor-atual não encontrado.");
    if (motivoEl) motivoEl.textContent = detalhes.motivo || "-";
    else console.warn("#reavaliacao-modal-motivo não encontrado.");

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

    if (agendamentoIdInput) agendamentoIdInput.value = "";
    else console.warn("#reavaliacao-agendamento-id não encontrado.");
    if (solicitacaoIdInput) solicitacaoIdInput.value = solicitacaoId;
    else console.warn("#reavaliacao-solicitacao-id-ss não encontrado.");
    if (pacienteIdInput) pacienteIdInput.value = pacienteId;
    else console.warn("#reavaliacao-paciente-id-ss não encontrado.");
  } catch (error) {
    console.error("Erro ao carregar dados da solicitação:", error);
    alert(`Erro: ${error.message}`);
    formReavaliacao.innerHTML = `<p class="alert alert-error">Não foi possível carregar.</p>`;
  } finally {
    loadingInfo.style.display = "none";
  }
}
// *** FIM FUNÇÃO carregarDadosReavaliacao REVISADA ***

// *** FUNÇÃO setupReavaliacaoFormListeners REVISADA ***
function setupReavaliacaoFormListeners(solicitacaoId, pacienteId) {
  const form = document.getElementById("reavaliacao-ss-form");
  if (!form) {
    console.error("#reavaliacao-ss-form não encontrado.");
    return;
  }
  console.log("setupReavaliacaoFormListeners: Configurando listeners...");

  const realizadaSelect = form.querySelector("#reavaliacao-realizada");

  // Listener para campos condicionais
  if (realizadaSelect) {
    // Remove listener antigo se existir
    const oldChangeListener = realizadaSelect._changeListener;
    if (oldChangeListener)
      realizadaSelect.removeEventListener("change", oldChangeListener);
    // Adiciona novo
    realizadaSelect.addEventListener(
      "change",
      updateReavaliacaoConditionalFields
    );
    realizadaSelect._changeListener = updateReavaliacaoConditionalFields; // Guarda referência
    console.log("Listener 'change' adicionado a #reavaliacao-realizada");
  } else {
    console.warn("#reavaliacao-realizada não encontrado.");
  }

  // Listener para o submit (removendo o antigo)
  const currentSubmitListener = form._submitListener;
  if (currentSubmitListener)
    form.removeEventListener("submit", currentSubmitListener);
  const newSubmitListener = (e) =>
    handleSalvarReavaliacaoSS(e, null, solicitacaoId, pacienteId);
  form.addEventListener("submit", newSubmitListener);
  form._submitListener = newSubmitListener;
  console.log("Listener 'submit' adicionado a #reavaliacao-ss-form");

  // Chama para definir estado inicial
  console.log("Chamando updateReavaliacaoConditionalFields (inicial).");
  updateReavaliacaoConditionalFields();
}
// *** FIM FUNÇÃO setupReavaliacaoFormListeners REVISADA ***

// *** FUNÇÃO updateReavaliacaoConditionalFields REVISADA ***
function updateReavaliacaoConditionalFields() {
  console.log("updateReavaliacaoConditionalFields: Executando..."); // Log
  const realizadaSelect = document.getElementById("reavaliacao-realizada");
  const naoRealizadaFields = document.getElementById(
    "reavaliacao-nao-realizada-fields"
  );
  const simRealizadaFields = document.getElementById(
    "reavaliacao-sim-realizada-fields"
  );
  if (!realizadaSelect || !naoRealizadaFields || !simRealizadaFields) {
    console.error(
      "updateReavaliacaoConditionalFields: Elementos condicionais não encontrados!"
    );
    return;
  }

  const selecionado = realizadaSelect.value;
  console.log(
    "updateReavaliacaoConditionalFields: Valor selecionado:",
    selecionado
  ); // Log

  naoRealizadaFields.style.display = "none";
  simRealizadaFields.style.display = "none";
  // É crucial resetar o 'required' antes de definir novamente
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
  console.log(
    "updateReavaliacaoConditionalFields: Visibilidade e required atualizados."
  ); // Log
}
// *** FIM FUNÇÃO updateReavaliacaoConditionalFields REVISADA ***

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
async function handleSalvarReavaliacaoSS(
  evento,
  agendamentoId,
  solicitacaoId,
  pacienteId
) {
  // Função sem alterações funcionais significativas, apenas garante referências
  evento.preventDefault();
  const form = evento.target;
  const btnSalvar = form.querySelector("#btn-salvar-reavaliacao-ss");
  if (!btnSalvar) return;
  btnSalvar.disabled = true;
  btnSalvar.textContent = "Salvando...";
  const realizada = form.querySelector("#reavaliacao-realizada")?.value;
  try {
    const isFromSolicitacao = !!solicitacaoId;
    const solicitacaoRef = isFromSolicitacao
      ? doc(db, "solicitacoes", solicitacaoId)
      : null;
    const pacienteRef = doc(db, "trilhaPaciente", pacienteId);
    const pacienteSnap = await getDoc(pacienteRef);
    if (!pacienteSnap.exists())
      throw new Error(`Paciente ${pacienteId} não encontrado.`);
    const pacienteDataAtual = pacienteSnap.data();
    const statusDeRetorno =
      pacienteDataAtual.statusAnteriorReavaliacao || "encaminhar_para_plantao";
    let dadosPacienteUpdate = {
      status: statusDeRetorno,
      statusAnteriorReavaliacao: null,
      lastUpdate: serverTimestamp(),
    };
    let dadosSolicitacaoUpdate = null;
    if (realizada === "sim") {
      const novoValorInput = form.querySelector("#reavaliacao-novo-valor");
      const criterios = form.querySelector("#reavaliacao-criterios")?.value;
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
        throw new Error("Preencha novo valor (>0) e critérios.");
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
      dadosPacienteUpdate.valorContribuicao = novoValor;
      dadosPacienteUpdate.historicoContribuicao = novoHistorico;
      if (isFromSolicitacao) {
        dadosSolicitacaoUpdate = {
          status: "Concluída",
          adminFeedback: {
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
      await updateDoc(pacienteRef, dadosPacienteUpdate);
    } else if (realizada === "nao") {
      const motivoNao = form.querySelector("#reavaliacao-motivo-nao")?.value;
      const reagendado = form.querySelector("#reavaliacao-reagendado")?.value;
      if (!motivoNao || !motivoNao.trim() || !reagendado)
        throw new Error("Preencha motivo e se reagendado.");
      if (isFromSolicitacao) {
        dadosSolicitacaoUpdate = {
          status: reagendado === "sim" ? "Pendente" : "NaoRealizada",
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
        if (reagendado === "nao") {
          await updateDoc(pacienteRef, dadosPacienteUpdate);
        } else {
          await updateDoc(pacienteRef, { lastUpdate: serverTimestamp() });
        }
      }
    } else {
      throw new Error("Selecione se a reavaliação foi realizada.");
    }
    if (dadosSolicitacaoUpdate && solicitacaoRef) {
      await updateDoc(solicitacaoRef, dadosSolicitacaoUpdate);
      console.log("Solicitação atualizada:", solicitacaoId);
    }
    alert("Reavaliação salva!");
    window.location.hash = "#agendamentos-view";
  } catch (error) {
    console.error("Erro ao salvar reavaliação:", error);
    alert(`Erro: ${error.message}`);
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = "Salvar Reavaliação";
  }
}
