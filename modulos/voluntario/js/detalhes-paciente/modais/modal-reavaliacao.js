// Arquivo: /modulos/voluntario/js/detalhes-paciente/modais/modal-reavaliacao.js
// Lógica para o modal de solicitação de reavaliação, incluindo busca de agenda.

import {
  db,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "../conexao-db.js"; // Firestore functions
import * as estado from "../estado.js"; // Shared state

// --- Variável Interna do Módulo ---
// Armazena a configuração da agenda carregada para evitar múltiplas buscas no DB
let currentReavaliacaoConfig = { agendas: [] };

// --- Funções Exportadas ---

/**
 * Abre o modal de solicitação de reavaliação.
 * Busca a agenda configurada e exibe as opções de data/hora disponíveis.
 */
export async function abrirModalReavaliacao() {
  // Verifica dados essenciais do estado
  if (!estado.pacienteDataGlobal || !estado.userDataGlobal) {
    alert(
      "Dados do paciente ou do usuário não carregados. Não é possível abrir o modal de reavaliação."
    );
    return;
  } // Referências aos elementos do modal

  const modal = document.getElementById("reavaliacao-modal");
  const form = document.getElementById("reavaliacao-form");
  const msgSemAgenda = document.getElementById("reavaliacao-sem-agenda");
  const btnConfirmar = document.getElementById("btn-confirmar-reavaliacao");
  const tipoAtendimentoGroup = document.getElementById(
    "reavaliacao-tipo-atendimento-group"
  );
  const tipoAtendimentoSelect = document.getElementById(
    "reavaliacao-tipo-atendimento"
  );
  const datasContainer = document.getElementById(
    "reavaliacao-datas-disponiveis"
  );
  const dataSelecionadaInput = document.getElementById(
    "reavaliacao-data-selecionada"
  ); // Input hidden
  const horariosContainer = document.getElementById(
    "reavaliacao-horarios-disponiveis"
  ); // Validação da existência dos elementos

  if (
    !modal ||
    !form ||
    !msgSemAgenda ||
    !btnConfirmar ||
    !tipoAtendimentoGroup ||
    !tipoAtendimentoSelect ||
    !datasContainer ||
    !dataSelecionadaInput ||
    !horariosContainer
  ) {
    console.error(
      "Elementos essenciais do modal de reavaliação não encontrados. Verifique o HTML."
    );
    alert("Erro ao abrir modal de reavaliação: estrutura interna inválida.");
    return;
  } // --- Reset da UI do Modal ---

  form.reset();
  currentReavaliacaoConfig = { agendas: [] }; // Limpa config anterior
  msgSemAgenda.style.display = "none";
  form.style.display = "none"; // Esconde form enquanto carrega agenda
  btnConfirmar.style.display = "none"; // Esconde botão de salvar
  datasContainer.innerHTML =
    '<p class="info-note loading">Carregando datas...</p>'; // Feedback inicial
  horariosContainer.innerHTML =
    '<p class="info-note">Selecione uma data para ver os horários.</p>';
  dataSelecionadaInput.value = "";
  // Limpa listeners antigos para evitar duplicação (clonando e substituindo)
  const cloneTipoSelect = tipoAtendimentoSelect.cloneNode(true);
  tipoAtendimentoSelect.parentNode.replaceChild(
    cloneTipoSelect,
    tipoAtendimentoSelect
  );
  const cloneDatasContainer = datasContainer.cloneNode(true); // Limpa conteúdo interno também
  datasContainer.parentNode.replaceChild(cloneDatasContainer, datasContainer);
  cloneDatasContainer.innerHTML =
    '<p class="info-note loading">Carregando datas...</p>'; // Restaura msg inicial
  const cloneHorariosContainer = horariosContainer.cloneNode(true); // Limpa conteúdo interno também
  horariosContainer.parentNode.replaceChild(
    cloneHorariosContainer,
    horariosContainer
  );
  cloneHorariosContainer.innerHTML =
    '<p class="info-note">Selecione uma data para ver os horários.</p>'; // Restaura msg inicial // --- Preenche Dados Fixos ---

  const paciente = estado.pacienteDataGlobal;
  const user = estado.userDataGlobal; // Pega o atendimento ativo (pode ser null)
  const atendimentoAtivo = paciente.atendimentosPB?.find(
    (at) => at.profissionalId === user.uid && at.statusAtendimento === "ativo"
  );

  const pacIdInput = form.querySelector("#reavaliacao-paciente-id");
  if (pacIdInput) pacIdInput.value = estado.pacienteIdGlobal;
  const atendIdInput = form.querySelector("#reavaliacao-atendimento-id"); // Pode não existir no form, tratar se null
  if (atendIdInput) atendIdInput.value = atendimentoAtivo?.atendimentoId || ""; // Usa ID do atendimento ativo ou vazio

  const profNomeEl = document.getElementById("reavaliacao-profissional-nome");
  if (profNomeEl) profNomeEl.value = user.nome || "";
  const pacNomeEl = document.getElementById("reavaliacao-paciente-nome");
  if (pacNomeEl) pacNomeEl.value = paciente.nomeCompleto || "";
  const valorAtualEl = document.getElementById("reavaliacao-valor-atual");
  if (valorAtualEl) {
    // Formata valor para exibição com vírgula
    const valor = paciente.valorContribuicao;
    valorAtualEl.value =
      typeof valor === "number"
        ? valor.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "";
  } // Exibe o modal

  modal.style.display = "flex"; // --- Carrega Configuração da Agenda ---

  try {
    const hoje = new Date().toISOString().split("T")[0]; // Formato YYYY-MM-DD
    const agendaQuery = query(
      collection(db, "agendaConfigurada"),
      where("tipo", "==", "reavaliacao"),
      where("data", ">=", hoje) // Busca apenas datas futuras ou hoje
    );
    const agendaSnapshot = await getDocs(agendaQuery);

    if (agendaSnapshot.empty) {
      msgSemAgenda.textContent =
        "Não há agenda de reavaliação configurada disponível no momento.";
      msgSemAgenda.className = "alert alert-warning";
      msgSemAgenda.style.display = "block";
      datasContainer.innerHTML = ""; // Limpa "carregando"
      horariosContainer.innerHTML = ""; // Limpa
      return; // Interrompe se não há agenda
    } // Processa e armazena a configuração carregada

    let agendasConfig = [];
    agendaSnapshot.forEach((doc) =>
      agendasConfig.push({ id: doc.id, ...doc.data() })
    );
    currentReavaliacaoConfig = { agendas: agendasConfig }; // Armazena no estado interno do módulo

    // Determina modalidades disponíveis
    const modalidadesDisponiveis = [
      ...new Set(agendasConfig.map((a) => a.modalidade)),
    ]
      .filter(Boolean)
      .sort(); // Configura o select de modalidade

    const selectAtual = document.getElementById("reavaliacao-tipo-atendimento"); // Pega o elemento (ou o clone)
    selectAtual.innerHTML = ""; // Limpa opções antigas
    selectAtual.required = false; // Reset required

    if (modalidadesDisponiveis.length > 1) {
      tipoAtendimentoGroup.style.display = "block"; // Mostra o grupo do select
      selectAtual.innerHTML =
        '<option value="">Selecione a modalidade...</option>';
      modalidadesDisponiveis.forEach((mod) => {
        const modFormatado =
          mod.charAt(0).toUpperCase() + mod.slice(1).toLowerCase();
        selectAtual.innerHTML += `<option value="${mod}">${modFormatado}</option>`;
      });
      selectAtual.required = true; // Obrigatório se houver mais de uma opção
      datasContainer.innerHTML =
        '<p class="info-note">Selecione uma modalidade para ver as datas.</p>'; // Mensagem inicial
    } else if (modalidadesDisponiveis.length === 1) {
      tipoAtendimentoGroup.style.display = "none"; // Esconde o grupo do select
      const unicaModalidade = modalidadesDisponiveis[0];
      const modFormatado =
        unicaModalidade.charAt(0).toUpperCase() +
        unicaModalidade.slice(1).toLowerCase();
      selectAtual.innerHTML = `<option value="${unicaModalidade}" selected>${modFormatado}</option>`;
      // Renderiza as datas diretamente, pois a modalidade já está definida
      renderizarDatasDisponiveis(unicaModalidade);
    } else {
      throw new Error(
        "Agenda de reavaliação configurada de forma inválida (sem modalidade definida nas entradas encontradas)."
      );
    } // Adiciona listeners DEPOIS de popular o select e containers

    selectAtual.addEventListener("change", (e) => {
      // Limpa containers de datas/horários ao mudar modalidade
      document.getElementById("reavaliacao-horarios-disponiveis").innerHTML =
        '<p class="info-note">Selecione uma data para ver os horários.</p>';
      document.getElementById("reavaliacao-data-selecionada").value = "";
      renderizarDatasDisponiveis(e.target.value); // Renderiza datas para a nova modalidade
    });

    // Usa delegação para cliques nas datas (container é o elemento atualizado)
    document
      .getElementById("reavaliacao-datas-disponiveis")
      .addEventListener("click", (e) => {
        const target = e.target.closest(".slot-time"); // Busca o botão clicado
        if (target && !target.disabled) {
          // Remove seleção de outro botão de data
          document
            .querySelectorAll(
              "#reavaliacao-datas-disponiveis .slot-time.selected"
            )
            .forEach((btn) => btn.classList.remove("selected"));
          target.classList.add("selected"); // Marca o botão clicado
          document.getElementById("reavaliacao-data-selecionada").value =
            target.dataset.data; // Atualiza input hidden
          carregarHorariosReavaliacao(); // Carrega horários para a data selecionada
        }
      });

    // Usa delegação para cliques nos horários
    document
      .getElementById("reavaliacao-horarios-disponiveis")
      .addEventListener("click", (e) => {
        const target = e.target.closest(".slot-time");
        if (target && !target.disabled) {
          // Remove seleção de outro botão de horário
          document
            .querySelectorAll(
              "#reavaliacao-horarios-disponiveis .slot-time.selected"
            )
            .forEach((btn) => btn.classList.remove("selected"));
          target.classList.add("selected"); // Marca o botão clicado
        }
      });

    // Exibe o formulário e botão de salvar agora que a agenda foi processada
    form.style.display = "block";
    btnConfirmar.style.display = "block";
  } catch (error) {
    console.error(
      "Erro ao carregar ou processar agenda de reavaliação:",
      error
    );
    msgSemAgenda.textContent = `Erro ao carregar a agenda: ${error.message}. Tente novamente.`;
    msgSemAgenda.className = "alert alert-error";
    msgSemAgenda.style.display = "block";
    // Limpa containers em caso de erro
    datasContainer.innerHTML = "";
    horariosContainer.innerHTML = ""; // Mantém form e botão escondidos
    form.style.display = "none";
    btnConfirmar.style.display = "none";
  }
}

/**
 * Renderiza os botões de datas disponíveis para a modalidade selecionada.
 * (Função interna do módulo)
 * @param {string} modalidade - A modalidade selecionada ('online' ou 'presencial').
 */
function renderizarDatasDisponiveis(modalidade) {
  const datasContainer = document.getElementById(
    "reavaliacao-datas-disponiveis"
  );
  if (!datasContainer) return;

  if (!modalidade) {
    datasContainer.innerHTML =
      '<p class="info-note">Selecione uma modalidade para ver as datas.</p>';
    return;
  }

  const { agendas } = currentReavaliacaoConfig; // Usa a config armazenada
  if (!agendas) {
    console.error(
      "Configuração de reavaliação não disponível para renderizar datas."
    );
    datasContainer.innerHTML =
      '<p class="alert alert-error">Erro interno ao buscar datas.</p>';
    return;
  } // Filtra agendas pela modalidade, pega as datas únicas e ordena

  const datasDisponiveis = [
    ...new Set(
      agendas.filter((a) => a.modalidade === modalidade).map((a) => a.data)
    ),
  ].sort();

  if (datasDisponiveis.length === 0) {
    datasContainer.innerHTML = `<p class="info-note">Nenhuma data disponível encontrada para a modalidade ${modalidade}.</p>`;
    return;
  } // Gera o HTML dos botões de data

  const datasHtml = datasDisponiveis
    .map((dataISO) => {
      try {
        // Usa UTC para evitar problemas de fuso na formatação
        const [year, month, day] = dataISO.split("-").map(Number);
        const dataObj = new Date(Date.UTC(year, month - 1, day));
        if (isNaN(dataObj.getTime())) throw new Error("Data inválida");

        const diaSemana = dataObj.toLocaleDateString("pt-BR", {
          weekday: "long",
          timeZone: "UTC",
        });
        const dataFormatada = dataObj.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          timeZone: "UTC",
        });
        const diaSemanaCapitalizado =
          diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

        return `<button type="button" class="slot-time" data-data="${dataISO}">${diaSemanaCapitalizado} (${dataFormatada})</button>`;
      } catch (e) {
        console.error(`Erro ao formatar data ${dataISO}:`, e);
        return ""; // Retorna string vazia para datas inválidas
      }
    })
    .join("");

  datasContainer.innerHTML =
    datasHtml ||
    '<p class="alert alert-error">Erro ao processar datas disponíveis.</p>';
}

/**
 * Carrega e renderiza os horários disponíveis para a data e modalidade selecionadas.
 * Verifica também os agendamentos existentes para desabilitar horários ocupados.
 * (Função interna do módulo)
 */
async function carregarHorariosReavaliacao() {
  const modalidadeEl = document.getElementById("reavaliacao-tipo-atendimento");
  const dataISOEl = document.getElementById("reavaliacao-data-selecionada"); // Input hidden
  const horariosContainer = document.getElementById(
    "reavaliacao-horarios-disponiveis"
  );

  if (!modalidadeEl || !dataISOEl || !horariosContainer) {
    console.error(
      "Elementos necessários para carregar horários não encontrados."
    );
    return;
  }

  const modalidade = modalidadeEl.value;
  const dataISO = dataISOEl.value;

  if (!modalidade || !dataISO) {
    horariosContainer.innerHTML =
      '<p class="info-note">Selecione a modalidade e a data primeiro.</p>';
    return;
  } // Mostra feedback de carregamento

  horariosContainer.innerHTML =
    '<div class="loading-spinner-small" style="margin: 10px auto;"></div>';

  try {
    const { agendas } = currentReavaliacaoConfig; // Usa config armazenada
    if (!agendas) throw new Error("Configuração de reavaliação não carregada."); // Filtra as configurações de agenda para o dia e modalidade selecionados

    const agendasDoDia = agendas.filter(
      (a) => a.modalidade === modalidade && a.data === dataISO
    );

    if (agendasDoDia.length === 0) {
      horariosContainer.innerHTML =
        '<p class="info-note">Nenhum horário configurado na agenda para este dia/modalidade.</p>';
      return;
    } // Gera todos os slots possíveis de 30min dentro dos intervalos definidos na agenda

    let slotsDoDia = new Set();
    agendasDoDia.forEach((agenda) => {
      // Validação básica do formato HH:MM
      if (
        !agenda.inicio ||
        !agenda.fim ||
        !/^\d{2}:\d{2}$/.test(agenda.inicio) ||
        !/^\d{2}:\d{2}$/.test(agenda.fim)
      ) {
        console.warn(
          `Agenda ID ${agenda.id || "(sem ID)"} com formato de hora inválido:`,
          agenda.inicio,
          agenda.fim
        );
        return; // Pula esta entrada inválida
      }
      const [hInicio, mInicio] = agenda.inicio.split(":").map(Number);
      const [hFim, mFim] = agenda.fim.split(":").map(Number);

      // Validação numérica
      if (
        isNaN(hInicio) ||
        isNaN(mInicio) ||
        isNaN(hFim) ||
        isNaN(mFim) ||
        hInicio > hFim ||
        (hInicio === hFim && mInicio >= mFim)
      ) {
        console.warn(
          `Agenda ID ${
            agenda.id || "(sem ID)"
          } com valores de hora inválidos ou fim antes do início:`,
          agenda.inicio,
          agenda.fim
        );
        return; // Pula esta entrada inválida
      }

      const inicioEmMinutos = hInicio * 60 + mInicio;
      const fimEmMinutos = hFim * 60 + mFim;

      // Gera slots de 30min (ou outro intervalo se necessário)
      for (
        let minutos = inicioEmMinutos;
        minutos < fimEmMinutos;
        minutos += 30
      ) {
        const hAtual = Math.floor(minutos / 60);
        const mAtual = minutos % 60;
        const horaSlot = `${String(hAtual).padStart(2, "0")}:${String(
          mAtual
        ).padStart(2, "0")}`;
        slotsDoDia.add(horaSlot);
      }
    });

    const slotsOrdenados = [...slotsDoDia].sort(); // Ordena os horários

    if (slotsOrdenados.length === 0) {
      horariosContainer.innerHTML =
        '<p class="info-note">Nenhum slot de horário gerado para este dia/modalidade.</p>';
      return;
    } // Busca agendamentos *existentes* para este dia/tipo/modalidade para desabilitar slots

    const agendamentosQuery = query(
      collection(db, "agendamentos"),
      where("data", "==", dataISO),
      where("tipo", "==", "reavaliacao"),
      where("modalidade", "==", modalidade),
      where("status", "in", ["agendado", "confirmado"]) // Considera apenas agendamentos ativos
    );
    const agendamentosSnapshot = await getDocs(agendamentosQuery);
    const horariosOcupados = new Set(
      agendamentosSnapshot.docs.map((doc) => doc.data().hora)
    ); // Gera o HTML dos botões de horário, desabilitando os ocupados

    const slotsHtml = slotsOrdenados
      .map((hora) => {
        const isDisabled = horariosOcupados.has(hora);
        return `<button type="button" class="slot-time ${
          isDisabled ? "disabled" : ""
        }" data-hora="${hora}" ${
          isDisabled ? "disabled" : ""
        }>${hora}</button>`;
      })
      .join("");

    horariosContainer.innerHTML =
      slotsHtml ||
      '<p class="info-note">Nenhum horário disponível encontrado para seleção.</p>';
  } catch (error) {
    console.error("Erro ao carregar horários disponíveis:", error);
    horariosContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar horários: ${error.message}. Tente novamente.</p>`;
  }
}

/**
 * Handler para o submit do formulário de solicitação de reavaliação.
 * Cria um documento na coleção 'solicitacoes'.
 * @param {Event} evento - O evento de submit do formulário.
 */
export async function handleReavaliacaoSubmit(evento) {
  evento.preventDefault();
  const form = document.getElementById("reavaliacao-form");
  const modal = document.getElementById("reavaliacao-modal");
  const btnConfirmar = document.getElementById("btn-confirmar-reavaliacao");

  if (!form || !modal || !btnConfirmar) {
    console.error(
      "Elementos do modal de reavaliação não encontrados durante o submit."
    );
    alert("Erro interno ao enviar solicitação.");
    return;
  }

  const pacienteId = form.querySelector("#reavaliacao-paciente-id")?.value;
  const atendimentoId =
    form.querySelector("#reavaliacao-atendimento-id")?.value || null; // Pode ser null

  if (!pacienteId || pacienteId !== estado.pacienteIdGlobal) {
    // Validação extra
    alert("Erro: Inconsistência no ID do paciente. Recarregue a página.");
    return;
  } // Validação do motivo

  const motivoEl = document.getElementById("reavaliacao-motivo");
  const motivo = motivoEl?.value.trim() || "";
  if (!motivo) {
    alert("Por favor, preencha o motivo da solicitação de reavaliação.");
    motivoEl?.focus();
    return;
  }
  // Validação de data/hora (opcional, mas se selecionou data, deve selecionar hora)
  const dataPrefEl = document.getElementById("reavaliacao-data-selecionada");
  const dataPref = dataPrefEl?.value || null;
  const selectedSlot = document.querySelector(
    "#reavaliacao-horarios-disponiveis .slot-time.selected"
  );
  const horaPref = selectedSlot ? selectedSlot.dataset.hora : null;

  if (dataPref && !horaPref) {
    alert(
      "Você selecionou uma data de preferência. Por favor, selecione também um horário disponível."
    );
    return;
  }

  btnConfirmar.disabled = true;
  btnConfirmar.textContent = "Enviando...";

  try {
    const valorAtualEl = document.getElementById("reavaliacao-valor-atual");
    const valorAtualStr = valorAtualEl?.value || "0";
    // Converte valor formatado (com vírgula) para número
    const valorAtualNum =
      parseFloat(valorAtualStr.replace(/\./g, "").replace(",", ".")) || 0; // Remove pontos de milhar, troca vírgula por ponto

    const modalidadePrefEl = document.getElementById(
      "reavaliacao-tipo-atendimento"
    );
    const modalidadePref = modalidadePrefEl?.value || null;

    const solicitacaoData = {
      tipo: "reavaliacao",
      status: "Pendente", // Status inicial da solicitação
      dataSolicitacao: serverTimestamp(),
      solicitanteId: estado.userDataGlobal.uid,
      solicitanteNome: estado.userDataGlobal.nome,
      pacienteId: pacienteId,
      pacienteNome:
        estado.pacienteDataGlobal?.nomeCompleto ||
        form.querySelector("#reavaliacao-paciente-nome")?.value ||
        "", // Usa nome do estado ou do form
      atendimentoId: atendimentoId, // ID do atendimento PB ativo, se houver
      detalhes: {
        motivo: motivo,
        valorContribuicaoAtual: valorAtualNum,
        preferenciaAgendamento: {
          // Guarda a preferência selecionada (pode ser null)
          modalidade: modalidadePref,
          data: dataPref,
          hora: horaPref,
        },
      },
      adminFeedback: null, // Campo para feedback do admin
    }; // Salva na coleção 'solicitacoes'

    const docRef = await addDoc(
      collection(db, "solicitacoes"),
      solicitacaoData
    );
    console.log(
      "Solicitação de reavaliação criada com ID:",
      docRef.id,
      solicitacaoData
    );

    alert(
      "Solicitação de reavaliação enviada com sucesso para o administrativo!"
    );
    modal.style.display = "none"; // Fecha o modal
  } catch (error) {
    console.error("Erro ao enviar solicitação de reavaliação:", error);
    alert(`Erro ao enviar solicitação: ${error.message}`);
  } finally {
    // Reabilita o botão
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Enviar Solicitação";
  }
}
