// Arquivo: /modulos/servico-social/js/fila-atendimento.js
// --- VERSÃO COM DEBUG COMPLETA (sem abreviações) ---

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
  console.log(`fila-atendimento.js: init executado com trilhaId: ${trilhaId}`); // Log inicial
  currentUserData = userData; // Salva os dados do usuário logado

  const hashParts = window.location.hash.substring(1).split("/");
  // Exemplo Triagem: #fila-atendimento/paciente123
  // Exemplo Reavaliação: #fila-atendimento/paciente123/reavaliacao/solicitacao456 (Usa ID da SOLICITAÇÃO)
  const isReavaliacao = hashParts.length >= 3 && hashParts[2] === "reavaliacao"; // Ajuste para >=3
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

    // Renderiza os detalhes do paciente
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
function setupTriagemForm(user, userData, trilhaId) {
  const triagemForm = document.getElementById("triagem-form");
  if (!triagemForm) {
    console.error("#triagem-form não encontrado.");
    return;
  }
  // Define elementos e listeners
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

  // Remove listener antigo antes de adicionar um novo para evitar duplicação
  const formClone = triagemForm.cloneNode(true);
  triagemForm.parentNode.replaceChild(formClone, triagemForm);
  formClone.addEventListener("submit", (e) =>
    handleSalvarTriagem(e, user, userData, trilhaId)
  ); // Adiciona listener ao clone

  loadQueixaTriagem(trilhaId);
  updateTriagemConditionalFields(); // Chama para definir estado inicial
  // Verifica se os elementos existem antes de chamar toggleNovaDisponibilidade
  if (ampliarDisponibilidadeSelect && novaDisponibilidadeContainer) {
    toggleNovaDisponibilidade(
      ampliarDisponibilidadeSelect,
      novaDisponibilidadeContainer
    ); // Chama para definir estado inicial
  }
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
  if (!selectElement || !containerElement) return;
  if (selectElement.value === "sim") {
    containerElement.style.display = "block";
    if (containerElement.innerHTML.trim() === "") {
      // Gera o HTML da disponibilidade
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

// *** FUNÇÃO handleSalvarTriagem COM DEBUG ***
async function handleSalvarTriagem(evento, user, userData, trilhaId) {
  console.log("handleSalvarTriagem: Iniciada para trilhaId:", trilhaId); // Log 1: Iniciou
  evento.preventDefault(); // Impede o envio padrão
  console.log("handleSalvarTriagem: preventDefault() chamado."); // Log 2: Verificou preventDefault

  const triagemForm = evento.target;
  if (!triagemForm) {
    console.error("Erro: formulário não encontrado no evento.");
    return;
  }

  // Garante que temos todos os elementos necessários
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

  // Validação extra manual
  const statusValue = statusSelect ? statusSelect.value : null;
  console.log("handleSalvarTriagem: Status selecionado:", statusValue); // Log 3: Status

  if (!statusValue) {
    alert("Selecione o status da triagem.");
    return;
  }

  if (statusValue === "encaminhado") {
    const valorRaw = valorContribuicaoInput ? valorContribuicaoInput.value : "";
    const criteriosValue = criteriosTextarea
      ? criteriosTextarea.value.trim()
      : "";
    // Converte valor BRL para número
    const valorNumerico =
      parseFloat(valorRaw.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    console.log(
      `handleSalvarTriagem: Encaminhado - ValorRaw: ${valorRaw}, ValorNum: ${valorNumerico}, Criterios: ${criteriosValue}`
    ); // Log 4: Dados encaminhado
    if (isNaN(valorNumerico) || valorNumerico <= 0 || !criteriosValue) {
      alert(
        'Os campos "Valor da contribuição" (maior que zero) e "Critérios" são obrigatórios.'
      );
      return;
    }
  } else if (statusValue === "nao_realizada" || statusValue === "desistiu") {
    const obsValue = observacaoTextarea ? observacaoTextarea.value.trim() : "";
    console.log(
      `handleSalvarTriagem: ${statusValue} - Observacao: ${obsValue}`
    ); // Log 5: Dados não realizada/desistiu
    if (!obsValue) {
      alert('O campo "Observação" é obrigatório para este status.');
      return;
    }
  }

  const saveButton = triagemForm.querySelector('button[type="submit"]');
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Salvando...";
  }

  try {
    console.log("handleSalvarTriagem: Dentro do try, antes de preparar dados."); // Log 6: Entrou no Try
    const trilhaDocRef = doc(db, "trilhaPaciente", trilhaId);
    let dadosParaSalvar = {
      lastUpdate: serverTimestamp(),
      assistenteSocialTriagem: { uid: user.uid, nome: userData.nome },
    };

    if (statusValue === "encaminhado") {
      // Converte valor BRL para número ao salvar
      const valorNumerico =
        parseFloat(
          valorContribuicaoInput.value.replace(/[^\d,]/g, "").replace(",", ".")
        ) || 0;
      dadosParaSalvar = {
        ...dadosParaSalvar,
        status: "encaminhar_para_plantao", // Status correto para encaminhar
        valorContribuicao: valorNumerico,
        criteriosValor: criteriosTextarea ? criteriosTextarea.value : null,
        modalidadeAtendimento: modalidadeSelect ? modalidadeSelect.value : null,
        preferenciaAtendimento: preferenciaSelect
          ? preferenciaSelect.value
          : null,
        queixaPrincipal: queixaInput ? queixaInput.value : null,
        // Garante que o histórico seja um array antes de adicionar
        historicoContribuicao: [
          ...(Array.isArray(userData.historicoContribuicao)
            ? userData.historicoContribuicao
            : []), // Pega histórico anterior se existir
          {
            valor: valorNumerico,
            data: Timestamp.now(), // Usar Timestamp.now()
            motivo: "Triagem",
            responsavelId: currentUserData.uid,
            responsavelNome: currentUserData.nome,
          },
        ],
      };

      // Coleta nova disponibilidade apenas se "Sim" foi selecionado
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
        desistenciaMotivo: `Desistiu na etapa de triagem. Motivo: ${
          observacaoTextarea ? observacaoTextarea.value : "N/A"
        }`,
      };
    } else {
      // nao_realizada
      dadosParaSalvar.status = "inscricao_documentos"; // Volta para inscrição
      dadosParaSalvar.statusTriagem = statusValue; // Guarda o status específico da triagem
      dadosParaSalvar.observacoesTriagem = observacaoTextarea
        ? observacaoTextarea.value
        : null;
    }

    console.log(
      "handleSalvarTriagem: Dados para salvar:",
      JSON.stringify(dadosParaSalvar, null, 2)
    ); // Log 7: Dados a salvar (formatado)
    console.log("handleSalvarTriagem: Chamando updateDoc..."); // Log 8: Antes do update
    await updateDoc(trilhaDocRef, dadosParaSalvar);
    console.log("handleSalvarTriagem: updateDoc concluído com sucesso."); // Log 9: Depois do update

    alert("Ficha de triagem salva com sucesso! O paciente foi atualizado.");
    console.log("handleSalvarTriagem: Redirecionando para #agendamentos-view"); // Log 10: Antes do redirect
    window.location.hash = "#agendamentos-view";
  } catch (error) {
    console.error("Erro CRÍTICO ao salvar a triagem:", error); // Log 11: Erro
    alert(
      `Ocorreu um erro ao salvar a ficha: ${error.message}. Verifique o console.`
    );
  } finally {
    console.log("handleSalvarTriagem: Bloco finally executado."); // Log 12: Finally
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Salvar Triagem";
    }
  }
}
// --- FIM DA FUNÇÃO handleSalvarTriagem ---

// --- Lógica Específica do Formulário de Reavaliação ---
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
    if (solicitacaoIdInput) solicitacaoIdInput.value = solicitacaoId;
    if (pacienteIdInput) pacienteIdInput.value = pacienteId;
  } catch (error) {
    console.error("Erro ao carregar dados da solicitação:", error);
    alert(`Erro: ${error.message}`);
    formReavaliacao.innerHTML = `<p class="alert alert-error">Não foi possível carregar.</p>`;
  } finally {
    loadingInfo.style.display = "none";
  }
}
function setupReavaliacaoFormListeners(solicitacaoId, pacienteId) {
  const form = document.getElementById("reavaliacao-ss-form");
  if (!form) {
    console.error("#reavaliacao-ss-form não encontrado.");
    return;
  }
  const realizadaSelect = form.querySelector("#reavaliacao-realizada");
  if (realizadaSelect) {
    realizadaSelect.addEventListener(
      "change",
      updateReavaliacaoConditionalFields
    );
  } else {
    console.warn("#reavaliacao-realizada não encontrado.");
  }
  const formClone = form.cloneNode(true);
  form.parentNode.replaceChild(formClone, form);
  formClone.addEventListener("submit", (e) =>
    handleSalvarReavaliacaoSS(e, null, solicitacaoId, pacienteId)
  );
  updateReavaliacaoConditionalFields();
}
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
