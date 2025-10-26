// Arquivo: /modulos/voluntario/js/detalhes-paciente/modais/modal-desfecho.js
// Lógica para os modais de Desfecho PB e Encerramento do Plantão.

import {
  db,
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  getDoc,
} from "../conexao-db.js"; // Firestore functions
import * as estado from "../estado.js"; // Shared state
import * as carregador from "../carregador-dados.js"; // To reload data
import * as interfaceUI from "../interface.js"; // To update UI

// --- Lógica do Modal de Desfecho PB ---

/**
 * Abre o modal para registrar o desfecho de um atendimento PB ativo.
 * Carrega dinamicamente o formulário HTML.
 */
export async function abrirModalDesfechoPb() {
  // Verifica dados essenciais e se há um atendimento PB ativo para o usuário logado
  if (!estado.pacienteDataGlobal || !estado.userDataGlobal) {
    alert(
      "Dados necessários para abrir o modal de desfecho não estão carregados."
    );
    return;
  }
  const atendimentoAtivo = estado.pacienteDataGlobal.atendimentosPB?.find(
    (at) => at.profissionalId === estado.userDataGlobal.uid
  );
  if (!atendimentoAtivo) {
    alert(
      "Não há um atendimento de Psicoterapia Breve ativo atribuído a você para registrar o desfecho."
    );
    return;
  }

  const modal = document.getElementById("desfecho-pb-modal");
  const body = document.getElementById("desfecho-pb-modal-body");
  const footer = document.getElementById("desfecho-pb-modal-footer");

  if (!modal || !body || !footer) {
    console.error(
      "Elementos essenciais do modal de desfecho PB (#desfecho-pb-modal, #desfecho-pb-modal-body, #desfecho-pb-modal-footer) não encontrados."
    );
    alert("Erro ao abrir modal: estrutura interna inválida.");
    return;
  } // Reseta UI e mostra loading

  body.innerHTML =
    '<div class="loading-spinner"></div> Carregando formulário...';
  footer.style.display = "none"; // Esconde botões enquanto carrega
  modal.style.display = "flex";

  try {
    // --- Carrega o HTML do formulário ---
    // IMPORTANTE: Verifique se este caminho './form-atendimento-pb.html' está correto!
    // Geralmente é relativo ao HTML principal, não a este arquivo JS.
    const response = await fetch("./form-atendimento-pb.html");
    if (!response.ok) {
      throw new Error(
        `Arquivo do formulário de desfecho (form-atendimento-pb.html) não encontrado (${response.status} ${response.statusText}). Verifique o caminho.`
      );
    }
    body.innerHTML = await response.text(); // Insere o HTML carregado no corpo do modal
    footer.style.display = "flex"; // Mostra os botões do modal

    const form = body.querySelector("#form-atendimento-pb");
    if (!form) {
      throw new Error(
        "Formulário #form-atendimento-pb não encontrado dentro do HTML carregado."
      );
    } // --- Preenche dados fixos no formulário carregado ---

    const pacIdInput = form.querySelector("#desfecho-paciente-id");
    if (pacIdInput) pacIdInput.value = estado.pacienteIdGlobal;
    const atendIdInput = form.querySelector("#desfecho-atendimento-id");
    if (atendIdInput) atendIdInput.value = atendimentoAtivo.atendimentoId;

    const profNomeEl = form.querySelector("#profissional-nome");
    if (profNomeEl)
      profNomeEl.value =
        atendimentoAtivo.profissionalNome || estado.userDataGlobal.nome || "";
    const pacNomeEl = form.querySelector("#paciente-nome");
    if (pacNomeEl)
      pacNomeEl.value = estado.pacienteDataGlobal.nomeCompleto || "";
    const valorContEl = form.querySelector("#valor-contribuicao");
    if (valorContEl) {
      const valor = estado.pacienteDataGlobal.valorContribuicao;
      valorContEl.value =
        typeof valor === "number"
          ? valor.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "Não definido";
    }
    const dataInicioRaw = atendimentoAtivo.horarioSessoes?.dataInicio; // Pode ser null
    const dataInicioEl = form.querySelector("#data-inicio-atendimento");
    if (dataInicioEl) {
      try {
        dataInicioEl.value = dataInicioRaw
          ? new Date(dataInicioRaw + "T00:00:00Z").toLocaleDateString("pt-BR", {
              timeZone: "UTC",
            }) // Usa UTC para evitar erros de fuso
          : "N/A";
      } catch (e) {
        console.warn(
          "Erro ao formatar data de início para desfecho:",
          dataInicioRaw,
          e
        );
        dataInicioEl.value = "Data inválida";
      }
    } // --- Configura lógica condicional do formulário (mostrar/ocultar campos) ---

    const desfechoSelect = form.querySelector("#desfecho-acompanhamento");
    const motivoContainer = form.querySelector(
      "#motivo-alta-desistencia-container"
    );
    const encaminhamentoContainer = form.querySelector(
      "#encaminhamento-container"
    );

    if (!desfechoSelect || !motivoContainer || !encaminhamentoContainer) {
      console.warn(
        "Elementos de controle condicional (desfecho, motivo, encaminhamento) não encontrados no form carregado."
      );
    } else {
      const updateFormVisibility = () => {
        const value = desfechoSelect.value;
        // CORREÇÃO: Usando 'Desistencia' (sem acento) para corresponder ao 'value' do HTML.
        const isAltaDesistencia = ["Alta", "Desistência"].includes(value);
        const isEncaminhamento = value === "Encaminhamento";

        motivoContainer.style.display = isAltaDesistencia ? "block" : "none";
        encaminhamentoContainer.style.display = isEncaminhamento
          ? "block"
          : "none";

        // Ajusta required dos campos condicionais
        const motivoInput = form.querySelector("#motivo-alta-desistencia");
        if (motivoInput) motivoInput.required = isAltaDesistencia;

        const encParaInput = form.querySelector("#encaminhado-para");
        if (encParaInput) encParaInput.required = isEncaminhamento;

        const motivoEncInput = form.querySelector("#motivo-encaminhamento");
        if (motivoEncInput) motivoEncInput.required = isEncaminhamento;
      };

      // Adiciona listener para o select (clona para remover listeners antigos se houver)
      const cloneSelect = desfechoSelect.cloneNode(true);
      desfechoSelect.parentNode.replaceChild(cloneSelect, desfechoSelect);
      cloneSelect.addEventListener("change", updateFormVisibility);
      updateFormVisibility(); // Chama uma vez para o estado inicial
    } // O listener de submit para '#form-atendimento-pb' já está configurado
    // globalmente em 'configurar-eventos.js' usando delegação no body.
  } catch (error) {
    console.error(
      "Erro ao carregar ou configurar modal de desfecho PB:",
      error
    );
    body.innerHTML = `<p class="alert alert-error"><b>Erro ao carregar formulário:</b> ${error.message}</p>`;
    footer.style.display = "flex"; // Mostra botões mesmo com erro para permitir fechar
  }
}

/**
 * Handler para o submit do formulário de desfecho PB (carregado dinamicamente).
 * Cria uma solicitação de desfecho para o administrativo.
 * @param {Event} evento - O evento de submit do formulário '#form-atendimento-pb'.
 */
export async function handleDesfechoPbSubmit(evento) {
  evento.preventDefault();
  const form = evento.target; // O form '#form-atendimento-pb'
  const modal = form.closest("#desfecho-pb-modal.modal-overlay"); // Encontra o modal pai
  const botaoSalvar = modal?.querySelector("#btn-salvar-desfecho-submit"); // Botão dentro do modal

  if (!form || !modal || !botaoSalvar) {
    console.error(
      "Elementos do modal de desfecho não encontrados durante o submit."
    );
    alert("Erro interno ao enviar desfecho. Recarregue a página.");
    return;
  }

  const pacienteId = form.querySelector("#desfecho-paciente-id")?.value;
  const atendimentoId = form.querySelector("#desfecho-atendimento-id")?.value; // Validação de consistência

  if (!pacienteId || !atendimentoId || pacienteId !== estado.pacienteIdGlobal) {
    alert(
      "Erro: Inconsistência nos IDs do formulário de desfecho. Recarregue a página."
    );
    return;
  } // Validações de campos obrigatórios (alguns já feitos com 'required' no HTML)

  const desfechoSelect = form.querySelector("#desfecho-acompanhamento");
  const desfechoTipo = desfechoSelect?.value;
  const dataDesfechoInput = form.querySelector("#data-desfecho");

  if (!desfechoTipo) {
    alert("Selecione o tipo de desfecho.");
    desfechoSelect?.focus();
    return;
  }
  if (!dataDesfechoInput?.value) {
    alert("A data do desfecho é obrigatória.");
    dataDesfechoInput?.focus();
    return;
  }
  // Valida campos condicionais que podem não ter sido pegos pelo 'required' se o JS falhar
  // CORREÇÃO: Usando 'Desistencia' (sem acento) para corresponder ao 'value' do HTML.
  if (
    ["Alta", "Desistência"].includes(desfechoTipo) &&
    !form.querySelector("#motivo-alta-desistencia")?.value
  ) {
    alert("O motivo é obrigatório para Alta ou Desistência.");
    form.querySelector("#motivo-alta-desistencia")?.focus();
    return;
  }
  if (
    desfechoTipo === "Encaminhamento" &&
    (!form.querySelector("#encaminhado-para")?.value ||
      !form.querySelector("#motivo-encaminhamento")?.value)
  ) {
    alert("Para Encaminhamento, o serviço e o motivo são obrigatórios.");
    form.querySelector("#encaminhado-para")?.focus(); // Foca no primeiro campo
    return;
  }

  botaoSalvar.disabled = true;
  botaoSalvar.textContent = "Enviando...";

  try {
    // Coleta detalhes com base no tipo de desfecho
    let detalhesDesfecho = {};
    if (desfechoTipo === "Encaminhamento") {
      detalhesDesfecho = {
        servicoEncaminhado:
          form.querySelector("#encaminhado-para")?.value || null,
        motivoEncaminhamento:
          form.querySelector("#motivo-encaminhamento")?.value || null,
        demandaPaciente: form.querySelector("#demanda-paciente")?.value || "",
        continuaAtendimentoEuPsico:
          form.querySelector("#continua-atendimento")?.value || "Não informado",
        relatoCaso: form.querySelector("#relato-caso")?.value || "",
      };
      // CORREÇÃO: Usando 'Desistencia' (sem acento) para corresponder ao 'value' do HTML.
    } else if (["Alta", "Desistencia"].includes(desfechoTipo)) {
      detalhesDesfecho = {
        motivo: form.querySelector("#motivo-alta-desistencia")?.value || null,
      };
    } // Adiciona data do desfecho coletada
    detalhesDesfecho.dataDesfecho = dataDesfechoInput.value; // Monta o objeto da solicitação

    const solicitacaoData = {
      tipo: "desfecho", // Tipo da solicitação para o admin processar
      status: "Pendente",
      dataSolicitacao: serverTimestamp(),
      solicitanteId: estado.userDataGlobal.uid,
      solicitanteNome: estado.userDataGlobal.nome,
      pacienteId: pacienteId,
      pacienteNome:
        estado.pacienteDataGlobal?.nomeCompleto ||
        form.querySelector("#paciente-nome")?.value ||
        "",
      atendimentoId: atendimentoId, // ID do atendimento PB específico
      detalhes: {
        tipoDesfecho: desfechoTipo, // Alta, Desistencia, Encaminhamento
        ...detalhesDesfecho, // Inclui motivo ou detalhes de encaminhamento
        sessoesRealizadas:
          form.querySelector("#quantidade-sessoes-realizadas")?.value || "N/A",
        observacoesGerais:
          form.querySelector("#observacoes-gerais")?.value || "",
      },
      adminFeedback: null,
    }; // Salva na coleção 'solicitacoes'

    const docRef = await addDoc(
      collection(db, "solicitacoes"),
      solicitacaoData
    );
    console.log(
      "Solicitação de desfecho PB criada com ID:",
      docRef.id,
      solicitacaoData
    );

    alert("Registro de desfecho enviado com sucesso para o administrativo!");
    modal.style.display = "none"; // --- Atualiza UI após sucesso ---

    // É importante recarregar os dados do paciente, pois o status dele PODE ter mudado
    // (dependendo da ação do admin ao processar a solicitação, mas recarregar é mais seguro)
    await carregador.carregarDadosPaciente(pacienteId);
    await carregador.carregarSessoes(); // Recarrega sessões (pode ser relevante)
    interfaceUI.preencherFormularios(); // Re-renderiza forms com novo status/dados
    interfaceUI.renderizarPendencias(); // Re-calcula pendências
    interfaceUI.renderizarSessoes(); // Re-renderiza lista de sessões
    interfaceUI.atualizarVisibilidadeBotoesAcao(
      estado.pacienteDataGlobal?.status || "desconhecido"
    ); // Atualiza botões
  } catch (error) {
    console.error("Erro ao enviar solicitação de desfecho PB:", error);
    alert(`Falha ao enviar registro de desfecho: ${error.message}`);
  } finally {
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar Desfecho";
  }
}

// --- Lógica do Modal de Encerramento do Plantão ---

/**
 * Abre o modal para registrar o encerramento de um atendimento de Plantão.
 * Carrega dinamicamente a seção de disponibilidade se necessário.
 */
export function abrirModalEncerramento() {
  // Verifica dados e status
  if (!estado.pacienteDataGlobal || !estado.userDataGlobal) {
    alert(
      "Dados necessários para abrir o modal de encerramento não estão carregados."
    );
    return;
  }
  if (estado.pacienteDataGlobal.status !== "em_atendimento_plantao") {
    alert(
      "Esta ação é válida apenas para pacientes em atendimento de Plantão ativo."
    );
    return;
  }

  const modal = document.getElementById("encerramento-modal");
  const form = document.getElementById("encerramento-form");
  const motivoNaoPagContainer = document.getElementById(
    "motivo-nao-pagamento-container"
  );
  const novaDisponibilidadeContainer = document.getElementById(
    "nova-disponibilidade-container"
  );
  const dispAtualEl = document.getElementById("disponibilidade-atual");
  const pagamentoSelect = form?.querySelector("#pagamento-contribuicao");
  const motivoNaoPagInput = form?.querySelector("#motivo-nao-pagamento");
  const dispSelect = form?.querySelector("#manter-disponibilidade");

  if (
    !modal ||
    !form ||
    !motivoNaoPagContainer ||
    !novaDisponibilidadeContainer ||
    !dispAtualEl ||
    !pagamentoSelect ||
    !motivoNaoPagInput ||
    !dispSelect
  ) {
    console.error(
      "Elementos essenciais do modal de encerramento não encontrados. Verifique o HTML."
    );
    alert("Erro ao abrir modal de encerramento: estrutura interna inválida.");
    return;
  } // --- Reset da UI ---

  form.reset();
  const pacIdInput = form.querySelector("#paciente-id-modal");
  if (pacIdInput) pacIdInput.value = estado.pacienteIdGlobal;

  motivoNaoPagContainer.classList.add("hidden");
  novaDisponibilidadeContainer.classList.add("hidden");
  novaDisponibilidadeContainer.innerHTML = ""; // Limpa conteúdo carregado anteriormente
  // Garante que campos carregados dinamicamente não fiquem 'required' inicialmente
  novaDisponibilidadeContainer
    .querySelectorAll("[required]")
    .forEach((el) => (el.required = false));
  motivoNaoPagInput.required = false; // Reset required // --- Preenche Disponibilidade Atual ---

  const disponibilidadeEspecifica =
    estado.pacienteDataGlobal.disponibilidadeEspecifica || [];
  const textoDisponibilidade =
    disponibilidadeEspecifica.length > 0
      ? disponibilidadeEspecifica
          .map((item) => {
            const [periodo, hora] = item.split("_"); // Formatação aprimorada: "Manha (Segunda e Terca)" -> "Manhã (Segunda e Terça)"
            let periodoFormatado = periodo
              .replace(/-/g, " e ") // Hífen para ' e '
              .replace("manha", "Manhã")
              .replace("tarde", "Tarde")
              .replace("noite", "Noite")
              .replace("segunda", "Segunda")
              .replace("terca", "Terça")
              .replace("quarta", "Quarta")
              .replace("quinta", "Quinta")
              .replace("sexta", "Sexta")
              .replace("sabado", "Sábado");
            return `${periodoFormatado} ${hora || ""}`.trim(); // Adiciona hora se existir
          })
          .join(", ")
      : "Nenhuma disponibilidade específica informada.";
  dispAtualEl.textContent = textoDisponibilidade; // --- Configura Listeners Internos do Modal ---

  // Clonar/Substituir para remover listeners antigos e evitar duplicação

  // Listener para Pagamento -> Motivo Não Pagamento
  const clonePagamento = pagamentoSelect.cloneNode(true);
  pagamentoSelect.parentNode.replaceChild(clonePagamento, pagamentoSelect);
  clonePagamento.addEventListener("change", (e) => {
    const mostrarMotivo = e.target.value === "nao";
    motivoNaoPagContainer.classList.toggle("hidden", !mostrarMotivo);
    const inputMotivo = motivoNaoPagContainer.querySelector(
      "#motivo-nao-pagamento"
    ); // Busca dentro do container
    if (inputMotivo) inputMotivo.required = mostrarMotivo;
  });
  clonePagamento.dispatchEvent(new Event("change")); // Dispara para estado inicial // Listener para Manter Disponibilidade -> Carregar Nova Disponibilidade

  const cloneDispSelect = dispSelect.cloneNode(true);
  dispSelect.parentNode.replaceChild(cloneDispSelect, dispSelect);
  cloneDispSelect.addEventListener("change", async (e) => {
    const mostrarNovosHorarios = e.target.value === "nao";
    novaDisponibilidadeContainer.classList.toggle(
      "hidden",
      !mostrarNovosHorarios
    );
    // Limpa requireds antigos dentro do container
    novaDisponibilidadeContainer
      .querySelectorAll("[required]")
      .forEach((el) => (el.required = false)); // Se for para mostrar e ainda não foi carregado

    if (
      mostrarNovosHorarios &&
      novaDisponibilidadeContainer.innerHTML.trim() === ""
    ) {
      novaDisponibilidadeContainer.innerHTML =
        '<div class="loading-spinner-small" style="margin: 10px auto;"></div> Carregando opções...';
      try {
        // IMPORTANTE: Verifique se este caminho '../../../public/fichas-de-inscricao.html' está correto!
        // Geralmente é relativo ao HTML principal.
        const response = await fetch(
          "../../../public/fichas-de-inscricao.html"
        );
        if (!response.ok) {
          throw new Error(
            `Erro ${response.status} ao buscar HTML da disponibilidade (fichas-de-inscricao.html). Verifique o caminho.`
          );
        }
        const text = await response.text();
        const parser = new DOMParser();
        const docHtml = parser.parseFromString(text, "text/html");
        const disponibilidadeSection = docHtml.getElementById(
          "disponibilidade-section"
        ); // Busca a seção específica

        if (disponibilidadeSection) {
          novaDisponibilidadeContainer.innerHTML =
            disponibilidadeSection.innerHTML;
          // Adiciona validação para garantir que pelo menos um checkbox seja marcado
          const checkboxes = novaDisponibilidadeContainer.querySelectorAll(
            'input[type="checkbox"]'
          );
          if (checkboxes.length > 0) {
            // Adiciona um listener ao form (ou container) para validar os checkboxes no submit
            // Ou marca todos como required=true e confia na validação do browser (mais simples)
            checkboxes.forEach((cb) => (cb.required = true)); // Torna obrigatório selecionar pelo menos um
            // Para validação customizada (requer mais código):
            // form.addEventListener('submit', function validateCheckboxes(event) {
            //     const checked = novaDisponibilidadeContainer.querySelectorAll('input[type="checkbox"]:checked').length > 0;
            //     if (!checked && cloneDispSelect.value === 'nao') {
            //         alert("Selecione ao menos um horário na nova disponibilidade.");
            //         event.preventDefault();
            //     }
            // }, { once: true }); // Adiciona uma vez para evitar múltiplos listeners
          }
        } else {
          throw new Error(
            "Seção '#disponibilidade-section' não encontrada no arquivo HTML carregado."
          );
        }
      } catch (error) {
        console.error(
          "Erro ao carregar ou processar HTML da disponibilidade:",
          error
        );
        novaDisponibilidadeContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar opções: ${error.message}</p>`;
      }
    } else if (!mostrarNovosHorarios) {
      // Se selecionou "Manter", garante que os checkboxes (se existirem) não sejam required
      novaDisponibilidadeContainer
        .querySelectorAll('input[type="checkbox"]')
        .forEach((cb) => (cb.required = false));
    }
  });
  cloneDispSelect.dispatchEvent(new Event("change")); // Dispara para estado inicial

  modal.style.display = "flex"; // Exibe o modal
}

/**
 * Handler para o submit do formulário de encerramento do Plantão.
 * Atualiza o status do paciente e adiciona informações de encerramento.
 * @param {Event} evento - O evento de submit do formulário '#encerramento-form'.
 * @param {string} userUid - UID do usuário logado (passado pelo listener).
 * @param {object} userData - Dados do usuário logado (passado pelo listener).
 */
export async function handleEncerramentoSubmit(evento, userUid, userData) {
  evento.preventDefault();
  const form = evento.target; // O '#encerramento-form'
  const modal = form.closest("#encerramento-modal.modal-overlay");
  const botaoSalvar = modal?.querySelector("#modal-save-btn"); // Assumindo ID do botão Salvar // Validações básicas

  if (!form || !modal || !botaoSalvar || !userUid || !userData) {
    console.error(
      "Elementos do modal de encerramento ou dados do usuário ausentes durante o submit."
    );
    alert("Erro interno ao salvar encerramento. Recarregue a página.");
    return;
  }
  const pacienteId = form.querySelector("#paciente-id-modal")?.value;
  if (!pacienteId || pacienteId !== estado.pacienteIdGlobal) {
    console.error("Inconsistência de ID de paciente no modal de encerramento!");
    alert("Erro interno (ID Paciente). Recarregue a página.");
    return;
  } // Validações específicas do formulário

  const encaminhamentos = Array.from(
    form.querySelectorAll('input[name="encaminhamento"]:checked')
  ).map((cb) => cb.value);
  const dataEncerramentoInput = form.querySelector("#data-encerramento");
  const qtdSessoesInput = form.querySelector("#quantidade-sessoes");
  const pagamentoSelect = form.querySelector("#pagamento-contribuicao");
  const motivoNaoPagInput = form.querySelector("#motivo-nao-pagamento");
  const relatoInput = form.querySelector("#relato-encerramento");
  const manterDispSelect = form.querySelector("#manter-disponibilidade");

  if (encaminhamentos.length === 0) {
    alert("Selecione ao menos uma opção de encaminhamento.");
    return;
  }
  if (!dataEncerramentoInput?.value) {
    alert("A data de encerramento é obrigatória.");
    dataEncerramentoInput.focus();
    return;
  }
  if (
    !qtdSessoesInput?.value ||
    isNaN(parseInt(qtdSessoesInput.value)) ||
    parseInt(qtdSessoesInput.value) < 0
  ) {
    alert("Informe uma quantidade válida de sessões realizadas (0 ou mais).");
    qtdSessoesInput.focus();
    return;
  }
  if (!pagamentoSelect?.value) {
    alert("Informe se o pagamento foi efetuado.");
    pagamentoSelect.focus();
    return;
  }
  if (pagamentoSelect.value === "nao" && !motivoNaoPagInput?.value.trim()) {
    alert("Informe o motivo do não pagamento.");
    motivoNaoPagInput.focus();
    return;
  }
  if (!relatoInput?.value.trim()) {
    alert("O breve relato sobre o encerramento é obrigatório.");
    relatoInput.focus();
    return;
  }
  if (!manterDispSelect?.value) {
    alert("Informe se a disponibilidade do paciente deve ser mantida.");
    manterDispSelect.focus();
    return;
  }

  // Valida checkboxes de disponibilidade se 'nao' foi selecionado
  const novaDisponibilidadeContainer = document.getElementById(
    "nova-disponibilidade-container"
  );
  if (
    manterDispSelect.value === "nao" &&
    novaDisponibilidadeContainer.querySelectorAll(
      'input[type="checkbox"]:checked'
    ).length === 0
  ) {
    alert(
      "Se a disponibilidade mudou, por favor, selecione os novos horários disponíveis."
    );
    // Tenta focar no primeiro checkbox para guiar o usuário
    novaDisponibilidadeContainer
      .querySelector('input[type="checkbox"]')
      ?.focus();
    return;
  } // --- Inicia processo de salvar ---

  botaoSalvar.disabled = true;
  botaoSalvar.innerHTML =
    '<span class="loading-spinner-small"></span> Salvando...';

  try {
    // Busca dados atuais do paciente APENAS se precisar manter a disponibilidade antiga
    let disponibilidadeParaSalvar = [];
    if (manterDispSelect.value === "sim") {
      // Usa a disponibilidade já carregada no estado
      disponibilidadeParaSalvar =
        estado.pacienteDataGlobal?.disponibilidadeEspecifica || [];
    } else {
      // Coleta a nova disponibilidade dos checkboxes marcados
      const checkboxes = novaDisponibilidadeContainer.querySelectorAll(
        'input[type="checkbox"]:checked'
      );
      disponibilidadeParaSalvar = Array.from(checkboxes).map((cb) => cb.value);
    } // Define o novo status do paciente com base no encaminhamento principal

    let novoStatus = "encaminhado_outro"; // Padrão
    if (encaminhamentos.includes("Alta")) novoStatus = "alta";
    else if (encaminhamentos.includes("Desistência"))
      novoStatus = "desistencia";
    else if (encaminhamentos.includes("Atendimento Psicológico"))
      novoStatus = "encaminhar_para_pb"; // Indica fluxo para PB // Monta o objeto com os dados do encerramento
    // Adicionar mais lógica se houver outros encaminhamentos com status específicos

    const encerramentoData = {
      responsavelId: userUid,
      responsavelNome: userData.nome,
      encaminhamento: encaminhamentos, // Array com as opções selecionadas
      dataEncerramento: dataEncerramentoInput.value, // YYYY-MM-DD
      sessoesRealizadas: parseInt(qtdSessoesInput.value) || 0, // Garante que seja número
      pagamentoEfetuado: pagamentoSelect.value, // 'sim', 'nao', 'isento'
      motivoNaoPagamento:
        pagamentoSelect.value === "nao"
          ? motivoNaoPagInput?.value.trim() || null
          : null,
      relato: relatoInput.value.trim(),
      encerradoEm: serverTimestamp(), // Timestamp do momento do salvamento
    }; // Monta o objeto de atualização para o documento do paciente

    const dadosParaAtualizar = {
      status: novoStatus, // Atualiza o status principal do paciente
      "plantaoInfo.encerramento": encerramentoData, // Adiciona/sobrescreve dados de encerramento no plantaoInfo
      disponibilidadeEspecifica: disponibilidadeParaSalvar, // Atualiza (ou mantém) a disponibilidade
      lastUpdate: serverTimestamp(),
    }; // Atualiza o documento do paciente

    await updateDoc(doc(db, "trilhaPaciente", pacienteId), dadosParaAtualizar);

    alert("Encerramento do Plantão salvo com sucesso!");
    modal.style.display = "none"; // --- Atualiza UI após sucesso ---

    await carregador.carregarDadosPaciente(pacienteId); // Recarrega para obter novo status
    // Não precisa recarregar sessões aqui, pois o plantão geralmente não tem sessões futuras na subcoleção
    interfaceUI.preencherFormularios(); // Re-renderiza forms com novo status
    interfaceUI.renderizarPendencias(); // Re-calcula pendências
    interfaceUI.atualizarVisibilidadeBotoesAcao(
      estado.pacienteDataGlobal?.status || "desconhecido"
    ); // Atualiza botões
  } catch (error) {
    console.error("Erro ao salvar encerramento do Plantão:", error);
    alert(`Erro ao salvar encerramento: ${error.message}`);
  } finally {
    // Reabilita o botão
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar"; // Restaura texto original
  }
}
