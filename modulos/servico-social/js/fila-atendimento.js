// Arquivo: /modulos/servico-social/js/fila-atendimento.js
// --- VERSÃO CORRIGIDA (Comentários e Escopo de Funções Corrigidos) ---

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

// Variável global para guardar dados do usuário logado
let currentUserData = null;

// --- FUNÇÕES AUXILIARES GLOBAIS ---

/**
 * Formata um valor numérico como moeda BRL (ex: "R$ 1.234,56").
 * @param {number|string|null|undefined} value O valor a ser formatado.
 * @returns {string} O valor formatado como moeda ou "N/A".
 */
function formatCurrency(value) {
  // Verifica null, undefined e NaN explicitamente
  if (value == null || isNaN(value)) {
    return "N/A";
  }
  // Garante que é um número antes de formatar
  const numberValue = Number(value);
  if (isNaN(numberValue)) {
    // Checa novamente após a conversão
    return "N/A";
  }
  return numberValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata o valor de um input de texto para parecer moeda (ex: "1.234,56").
 * @param {HTMLInputElement} input O elemento input.
 */
function formatarMoedaInput(input) {
  if (!input) return;
  let value = input.value.replace(/\D/g, ""); // Remove não-dígitos
  if (value === "") {
    input.value = "";
    return;
  }
  // Converte para número dividindo por 100
  let numberValue = parseInt(value, 10) / 100;
  if (isNaN(numberValue)) {
    // Se o valor for inválido após limpar
    input.value = "";
    return;
  }
  // Formata sem o símbolo R$
  input.value = numberValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Define o texto de um elemento pelo ID, tratando caso não encontre.
 * @param {string} elementId O ID do elemento HTML.
 * @param {string|number|null|undefined} text O texto a ser definido.
 */
function setTextContentIfExists(elementId, text) {
  const element = document.getElementById(elementId);
  if (element) {
    // Usa ?? para tratar null/undefined e exibir '-' nesses casos
    element.textContent = text ?? "-";
  } else {
    // Aviso no console apenas, não quebra a execução
    console.warn(`Elemento com ID "${elementId}" não encontrado.`);
  }
}
// --- FIM FUNÇÕES AUXILIARES GLOBAIS ---

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

  // Configura botão Voltar (com remoção de listener antigo)
  if (btnVoltar) {
    const oldVoltarListener = btnVoltar._clickListener;
    if (oldVoltarListener)
      btnVoltar.removeEventListener("click", oldVoltarListener);
    const newVoltarListener = () =>
      (window.location.hash = "#agendamentos-view");
    btnVoltar.addEventListener("click", newVoltarListener);
    btnVoltar._clickListener = newVoltarListener;
  } else {
    console.warn("Botão 'Voltar' (#btn-voltar-lista) não encontrado.");
  }

  // Reseta forms e campos condicionais
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

  // Controla qual formulário exibir e quais dados carregar
  if (isReavaliacao) {
    if (formTitle) formTitle.textContent = "Formulário de Reavaliação";
    if (triagemForm) triagemForm.style.display = "none";
    if (reavaliacaoForm) reavaliacaoForm.style.display = "block";
    carregarDadosPaciente(trilhaId, true); // true = Reavaliação (para resumo)
    carregarDadosReavaliacao(solicitacaoId, trilhaId);
    if (reavaliacaoForm) setupReavaliacaoFormListeners(solicitacaoId, trilhaId);
  } else {
    if (formTitle) formTitle.textContent = "Formulário de Triagem";
    if (triagemForm) triagemForm.style.display = "block";
    if (reavaliacaoForm) reavaliacaoForm.style.display = "none";
    carregarDadosPaciente(trilhaId, false); // false = Triagem (para resumo)
    if (triagemForm) setupTriagemForm(user, userData, trilhaId);
  }
}

/**
 * Carrega dados do paciente na coluna esquerda E nos resumos.
 */
async function carregarDadosPaciente(trilhaId, isReavaliacao) {
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

    // Funções locais de formatação (formatCurrency é global agora)
    const formatDate = (dateStr) =>
      dateStr
        ? new Date(dateStr + "T03:00:00").toLocaleDateString("pt-BR")
        : "N/I";
    const formatArray = (arr) =>
      arr && arr.length > 0 ? arr.join(", ") : "N/A";
    const formatHistory = (history) => {
      if (!history || history.length === 0) return "Nenhum histórico.";
      return history
        .map((entry) => {
          const date = entry.data?.toDate
            ? entry.data.toDate().toLocaleDateString("pt-BR")
            : "Data N/A";
          const value = formatCurrency(entry.valor); // Usa formatCurrency global
          const reason = entry.motivo || "N/A";
          return `<li>${date}: ${value} (${reason})</li>`;
        })
        .join("");
    };

    // Renderiza detalhes do paciente (HTML sem comentários internos)
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

    // Preenche os campos de resumo nos formulários
    const prefix = isReavaliacao ? "reavaliacao" : "triagem";
    setTextContentIfExists(
      `${prefix}-resumo-renda-individual`,
      data.rendaMensal
    );
    setTextContentIfExists(
      `${prefix}-resumo-renda-familiar`,
      data.rendaFamiliar
    );
    setTextContentIfExists(`${prefix}-resumo-moradia`, data.casaPropria);
    setTextContentIfExists(
      `${prefix}-resumo-pessoas-moradia`,
      data.pessoasMoradia
    );

    // Mostra e preenche o valor da moradia condicionalmente
    const valorMoradiaContainer = document.getElementById(
      `${prefix}-resumo-valor-moradia-container`
    );
    const tipoMoradia = data.casaPropria ? data.casaPropria.toLowerCase() : "";
    // Assumindo campo 'valorAluguelOuPrestacao'. AJUSTE SE NECESSÁRIO.
    const valorMoradia = data.valorAluguelOuPrestacao;

    if (valorMoradiaContainer) {
      if (
        tipoMoradia.includes("alugada") ||
        tipoMoradia.includes("financiada")
      ) {
        setTextContentIfExists(
          `${prefix}-resumo-valor-moradia`,
          formatCurrency(valorMoradia)
        ); // Usa formatCurrency global
        valorMoradiaContainer.style.display = "block"; // Mostra a seção
      } else {
        valorMoradiaContainer.style.display = "none"; // Esconde a seção
      }
    } else {
      console.warn(
        `Container de valor de moradia #${prefix}-resumo-valor-moradia-container não encontrado.`
      );
    }
  } catch (error) {
    console.error("Erro ao carregar dados do paciente:", error);
    if (patientDetailsContainer) {
      patientDetailsContainer.innerHTML = `<p class="error-message">Erro: ${error.message}</p>`;
    }
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
function setupTriagemForm(user, userData, trilhaId) {
  const triagemForm = document.getElementById("triagem-form");
  if (!triagemForm) {
    console.error("#triagem-form não encontrado.");
    return;
  }
  const statusSelect = document.getElementById("triagem-status");
  const valorContribuicaoInput = document.getElementById("valor-contribuicao");
  const ampliarDisponibilidadeSelect = document.getElementById(
    "ampliar-disponibilidade"
  );
  const novaDisponibilidadeContainer = document.getElementById(
    "nova-disponibilidade-container"
  );

  // Adiciona listeners (com remoção de antigos)
  if (valorContribuicaoInput) {
    const old = valorContribuicaoInput._inputListener;
    if (old) valorContribuicaoInput.removeEventListener("input", old);
    const listener = () => formatarMoedaInput(valorContribuicaoInput);
    valorContribuicaoInput.addEventListener("input", listener);
    valorContribuicaoInput._inputListener = listener;
  } else console.warn("#valor-contribuicao não encontrado.");
  if (statusSelect) {
    const old = statusSelect._changeListener;
    if (old) statusSelect.removeEventListener("change", old);
    statusSelect.addEventListener("change", updateTriagemConditionalFields);
    statusSelect._changeListener = updateTriagemConditionalFields;
  } else console.warn("#triagem-status não encontrado.");
  if (ampliarDisponibilidadeSelect && novaDisponibilidadeContainer) {
    const old = ampliarDisponibilidadeSelect._changeListener;
    if (old) ampliarDisponibilidadeSelect.removeEventListener("change", old);
    const listener = () =>
      toggleNovaDisponibilidade(
        ampliarDisponibilidadeSelect,
        novaDisponibilidadeContainer
      );
    ampliarDisponibilidadeSelect.addEventListener("change", listener);
    ampliarDisponibilidadeSelect._changeListener = listener;
  } else
    console.warn(
      "#ampliar-disponibilidade ou #nova-disponibilidade-container não encontrados."
    );
  const currentSubmitListener = triagemForm._submitListener;
  if (currentSubmitListener)
    triagemForm.removeEventListener("submit", currentSubmitListener);
  const newSubmitListener = (e) =>
    handleSalvarTriagem(e, user, userData, trilhaId);
  triagemForm.addEventListener("submit", newSubmitListener);
  triagemForm._submitListener = newSubmitListener;

  loadQueixaTriagem(trilhaId);
  updateTriagemConditionalFields(); // Estado inicial
  if (ampliarDisponibilidadeSelect && novaDisponibilidadeContainer)
    toggleNovaDisponibilidade(
      ampliarDisponibilidadeSelect,
      novaDisponibilidadeContainer
    ); // Estado inicial
}
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
  ) {
    console.error("updateTriagemConditionalFields: Elementos não encontrados!");
    return;
  }
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
      // Gera HTML da disponibilidade
      containerElement.innerHTML = `
                <h3 class="form-section-title">Nova Disponibilidade</h3>
                <div class="form-group"><label>Horários:</label><div class="horarios-options-container">
                    <div><label><input type="checkbox" name="horario" value="manha-semana"> Manhã (Semana)</label></div>
                    <div><label><input type="checkbox" name="horario" value="tarde-semana"> Tarde (Semana)</label></div>
                    <div><label><input type="checkbox" name="horario" value="noite-semana"> Noite (Semana)</label></div>
                    <div><label><input type="checkbox" name="horario" value="manha-sabado"> Manhã (Sábado)</label></div>
                </div></div>
                <div id="horarios-especificos-container">
                    <div id="container-manha-semana" style="display:none;"></div> <div id="container-tarde-semana" style="display:none;"></div>
                    <div id="container-noite-semana" style="display:none;"></div> <div id="container-manha-sabado" style="display:none;"></div>
                </div>`;
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
    containerElement.innerHTML = "";
  }
}
function gerarHorariosEspecificos(periodo, container) {
  let horarios = [],
    label = "";
  switch (periodo /* Define horários e label */) {
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
  if (!triagemForm) return;
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
  let valorNumerico = 0;
  if (statusValue === "encaminhado") {
    const valorRaw = valorContribuicaoInput ? valorContribuicaoInput.value : "";
    const criteriosValue = criteriosTextarea
      ? criteriosTextarea.value.trim()
      : "";
    valorNumerico =
      parseFloat(valorRaw.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    if (isNaN(valorNumerico) || valorNumerico <= 0 || !criteriosValue) {
      alert("Valor (>0) e Critérios obrigatórios.");
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
    const trilhaSnap = await getDoc(trilhaDocRef);
    const trilhaData = trilhaSnap.exists() ? trilhaSnap.data() : {};
    let dadosParaSalvar = {
      lastUpdate: serverTimestamp(),
      assistenteSocialTriagem: { uid: user.uid, nome: userData.nome },
    };
    if (statusValue === "encaminhado") {
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
    // Preenche campos do resumo da solicitação
    setTextContentIfExists(
      "reavaliacao-modal-paciente-nome",
      solicitacaoData.pacienteNome
    );
    setTextContentIfExists(
      "reavaliacao-modal-profissional-nome",
      solicitacaoData.solicitanteNome
    );
    // Usa a formatCurrency global agora
    const valorAtualFormatado = formatCurrency(detalhes.valorContribuicaoAtual);
    setTextContentIfExists(
      "reavaliacao-modal-valor-atual",
      valorAtualFormatado
    );
    setTextContentIfExists("reavaliacao-modal-motivo", detalhes.motivo);
    // Preenche hiddens
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
    if (formReavaliacao)
      formReavaliacao.innerHTML = `<p class="alert alert-error">Não foi possível carregar.</p>`;
  } finally {
    if (loadingInfo) loadingInfo.style.display = "none";
  }
}
function setupReavaliacaoFormListeners(solicitacaoId, pacienteId) {
  const form = document.getElementById("reavaliacao-ss-form");
  if (!form) {
    console.error("#reavaliacao-ss-form não encontrado.");
    return;
  }
  const realizadaSelect = form.querySelector("#reavaliacao-realizada");
  const novoValorInput = form.querySelector("#reavaliacao-novo-valor");

  // Listener para campos condicionais
  if (realizadaSelect) {
    const old = realizadaSelect._changeListener;
    if (old) realizadaSelect.removeEventListener("change", old);
    realizadaSelect.addEventListener(
      "change",
      updateReavaliacaoConditionalFields
    );
    realizadaSelect._changeListener = updateReavaliacaoConditionalFields;
  } else console.warn("#reavaliacao-realizada não encontrado.");
  // Listener para formatação de moeda (usando formatarMoedaInput global)
  if (novoValorInput) {
    const old = novoValorInput._inputListener;
    if (old) novoValorInput.removeEventListener("input", old);
    const listener = () => formatarMoedaInput(novoValorInput);
    novoValorInput.addEventListener("input", listener);
    novoValorInput._inputListener = listener;
  } else console.warn("#reavaliacao-novo-valor não encontrado.");
  // Listener para o submit
  const currentSubmitListener = form._submitListener;
  if (currentSubmitListener)
    form.removeEventListener("submit", currentSubmitListener);
  const newSubmitListener = (e) =>
    handleSalvarReavaliacaoSS(e, null, solicitacaoId, pacienteId);
  form.addEventListener("submit", newSubmitListener);
  form._submitListener = newSubmitListener;
  // Chama para definir estado inicial
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
  if (!realizadaSelect || !naoRealizadaFields || !simRealizadaFields) {
    console.error(
      "updateReavaliacaoConditionalFields: Elementos não encontrados!"
    );
    return;
  }
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
    simRealizadaFields.querySelectorAll("input, textarea").forEach((el) => {
      el.required = true;
    });
  } else if (selecionado === "nao") {
    naoRealizadaFields.style.display = "block";
    naoRealizadaFields.querySelectorAll("textarea, select").forEach((el) => {
      el.required = true;
    });
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
        ? novoValorInput.value.replace(/[^\d,]/g, "").replace(",", ".")
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
        ...(Array.isArray(pacienteDataAtual.historicoContribuicao)
          ? pacienteDataAtual.historicoContribuicao
          : []),
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
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar Reavaliação";
    }
  }
}
