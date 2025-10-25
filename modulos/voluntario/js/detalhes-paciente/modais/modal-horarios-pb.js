// Arquivo: /modulos/voluntario/js/detalhes-paciente/modais/modal-horarios-pb.js
// Lógica para o modal refatorado de Horários PB (informar, desistir, alterar).

import { db, doc, updateDoc, addDoc, collection, serverTimestamp, Timestamp, getDoc, query, where, getDocs, writeBatch } from "../conexao-db.js"; // Firestore functions
import * as estado from "../estado.js"; // Shared state
import * as carregador from "../carregador-dados.js"; // To reload data
import * as interfaceUI from "../interface.js"; // To update UI

// --- Funções Exportadas ---

/**
 * Abre o modal dinâmico de Horários PB.
 * Adapta a interface com base nas seleções do usuário (iniciou/não iniciou, motivo).
 */
export async function abrirModalHorariosPb() {
  // Verifica dados essenciais
  if (!estado.pacienteDataGlobal || !estado.userDataGlobal) {
    alert("Dados do paciente ou do usuário não carregados. Não é possível abrir o modal.");
    return;
  }

  // Busca o atendimento PB relevante para este profissional e status apropriado
  const atendimentoPbDoUsuario = estado.pacienteDataGlobal.atendimentosPB?.find(
    (at) =>
      at.profissionalId === estado.userDataGlobal.uid &&
      // Permite abrir se aguardando, informado, ativo (para alteração?) ou reencaminhamento.
      ["aguardando_info_horarios", "horarios_informados", "ativo", "solicitado_reencaminhamento"].includes(at.statusAtendimento) &&
      !at.statusAtendimento.startsWith("concluido_") && // Não concluído
      at.statusAtendimento !== "desistencia_antes_inicio" // Não desistiu antes
  );

  if (!atendimentoPbDoUsuario) {
    alert("Não foi encontrado um atendimento PB atribuído a você (ou o status atual não permite esta ação) para este paciente.");
    return;
  }

  // Referências aos elementos do modal principal e containers dinâmicos
  const modal = document.getElementById("horarios-pb-modal");
  const form = document.getElementById("horarios-pb-form");
  const pacienteIdInput = form?.querySelector("#paciente-id-horarios-modal");
  const atendimentoIdInput = form?.querySelector("#atendimento-id-horarios-modal");
  const motivoNaoInicioContainer = document.getElementById("motivo-nao-inicio-pb-container");
  const formContinuacaoContainer = document.getElementById("form-continuacao-pb"); // Para form Novas Sessões
  const motivoDesistenciaContainer = document.getElementById("motivo-desistencia-container"); // Para motivo desistência
  const formAlteracaoContainer = document.getElementById("form-alteracao-pb"); // Para form Alterar Horário
  const btnSalvarHorarios = modal?.querySelector('button[type="submit"]');
  const feedbackGradeDiv = document.getElementById("validacao-grade-feedback"); // Div global de feedback

  // Validação da existência dos elementos essenciais
  if (!modal || !form || !pacienteIdInput || !atendimentoIdInput || !motivoNaoInicioContainer || !formContinuacaoContainer || !motivoDesistenciaContainer || !formAlteracaoContainer || !btnSalvarHorarios || !feedbackGradeDiv) {
    console.error("Elementos essenciais do modal Horários PB (ou feedback de grade) não encontrados. Verifique o HTML.");
    alert("Erro ao abrir o modal: estrutura interna inválida.");
    return;
  }

  // --- Reset Completo da UI do Modal ---
  form.reset(); // Limpa todos os campos do form principal
  pacienteIdInput.value = estado.pacienteIdGlobal;
  atendimentoIdInput.value = atendimentoPbDoUsuario.atendimentoId;
  // Oculta todos os containers condicionais
  [motivoNaoInicioContainer, formContinuacaoContainer, motivoDesistenciaContainer, formAlteracaoContainer, feedbackGradeDiv].forEach((el) => {
      if (el) el.style.display = "none";
  });
  // Limpa o conteúdo dos containers que carregam forms externos
  formContinuacaoContainer.innerHTML = "";
  formAlteracaoContainer.innerHTML = "";
  motivoDesistenciaContainer.querySelector("#motivo-desistencia-pb")?.value = ""; // Limpa campo de texto

  // Limpa 'required' de todos os elementos dentro do form principal E dos containers dinâmicos
  form.querySelectorAll("[required]").forEach((el) => (el.required = false));
  // Limpa requireds especificos que podem ter sido adicionados dinamicamente
  motivoNaoInicioContainer.querySelectorAll('[required]').forEach(el => el.required = false);
  motivoDesistenciaContainer.querySelectorAll('[required]').forEach(el => el.required = false);


  // Garante que APENAS o radio 'iniciou-pb' seja obrigatório inicialmente
  form.querySelectorAll('input[name="iniciou-pb"]').forEach((r) => (r.required = true));

  // Reseta estado do botão salvar
  btnSalvarHorarios.disabled = false;
  btnSalvarHorarios.textContent = "Salvar";

  // --- Remove Listeners Antigos e Adiciona Novos ---
  // Usar clonagem para garantir remoção de listeners anônimos anteriores
  const radiosIniciouOriginais = form.querySelectorAll('input[name="iniciou-pb"]');
  radiosIniciouOriginais.forEach(radio => {
      const clone = radio.cloneNode(true);
      clone.required = true; // Mantém required no clone
      radio.parentNode.replaceChild(clone, radio);
      // Adiciona listener AO CLONE
      clone.addEventListener("change", listenerIniciouPbChange);
  });

  const radiosMotivoOriginais = form.querySelectorAll('input[name="motivo-nao-inicio"]');
  radiosMotivoOriginais.forEach(radio => {
       const clone = radio.cloneNode(true);
       radio.parentNode.replaceChild(clone, radio);
       // Adiciona listener AO CLONE
       clone.addEventListener("change", listenerMotivoNaoInicioChange);
  });

  modal.style.display = "flex"; // Exibe o modal
}


// --- Funções Listener (Internas do Módulo) ---

/** Listener para mudanças no radio 'iniciou-pb' */
async function listenerIniciouPbChange(event) {
    const radio = event.target;
    const formPrincipal = radio.closest('form'); // Encontra o form pai
    const formContinuacaoContainer = document.getElementById("form-continuacao-pb");
    const motivoNaoInicioContainer = document.getElementById("motivo-nao-inicio-pb-container");
    const motivoDesistenciaContainer = document.getElementById("motivo-desistencia-container");
    const formAlteracaoContainer = document.getElementById("form-alteracao-pb");
    const feedbackGradeDiv = document.getElementById("validacao-grade-feedback");

    // Reset geral das seções condicionais e seus requireds antes de mostrar a correta
    [formContinuacaoContainer, motivoNaoInicioContainer, motivoDesistenciaContainer, formAlteracaoContainer, feedbackGradeDiv].forEach(el => {
        if (el) el.style.display = 'none';
    });
    formContinuacaoContainer.innerHTML = ""; // Limpa conteúdo dinâmico
    formAlteracaoContainer.innerHTML = ""; // Limpa conteúdo dinâmico
    formPrincipal.querySelectorAll('#motivo-nao-inicio-pb-container [required], #motivo-desistencia-container [required], #form-continuacao-pb [required], #form-alteracao-pb [required]')
        .forEach(el => el.required = false); // Limpa requireds de todas as seções

    if (radio.value === "sim" && radio.checked) {
        formContinuacaoContainer.style.display = "block";
        formContinuacaoContainer.innerHTML = '<div class="loading-spinner-small" style="margin: 10px auto;"></div> Carregando formulário...';
        try {
            // ** Verifique o caminho! **
            const response = await fetch("./modal-content-novas-sessoes.html");
            if (!response.ok) throw new Error(`Erro ${response.status} ao buscar ./modal-content-novas-sessoes.html`);
            formContinuacaoContainer.innerHTML = await response.text();
            // Configura a lógica JS específica DESTE formulário carregado
            // Precisa passar o ID do atendimento atual
            const atendimentoId = formPrincipal.querySelector("#atendimento-id-horarios-modal")?.value;
            const atendimentoAtual = estado.pacienteDataGlobal?.atendimentosPB?.find(at => at.atendimentoId === atendimentoId);
            setupFormLogicNovasSessoes(formContinuacaoContainer, atendimentoAtual); // Passa o atendimento
        } catch (error) {
            console.error("Erro ao carregar form Novas Sessões:", error);
            formContinuacaoContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar formulário: ${error.message}</p>`;
        }
    } else if (radio.value === "nao" && radio.checked) {
        motivoNaoInicioContainer.style.display = "block";
        // Torna a escolha do motivo obrigatória
        formPrincipal.querySelectorAll('input[name="motivo-nao-inicio"]').forEach(r => {
            r.checked = false; // Garante que nenhum esteja pré-selecionado
            r.required = true;
        });
    }
}

/** Listener para mudanças no radio 'motivo-nao-inicio' */
async function listenerMotivoNaoInicioChange(event) {
    const radio = event.target;
    const formPrincipal = radio.closest('form');
    const motivoDesistenciaContainer = document.getElementById("motivo-desistencia-container");
    const formAlteracaoContainer = document.getElementById("form-alteracao-pb");
    const feedbackGradeDiv = document.getElementById("validacao-grade-feedback");


    // Reset das seções específicas do 'Não' e seus requireds
    [motivoDesistenciaContainer, formAlteracaoContainer, feedbackGradeDiv].forEach(el => {
        if(el) el.style.display = 'none';
    });
    formAlteracaoContainer.innerHTML = ""; // Limpa conteúdo dinâmico
    motivoDesistenciaContainer.querySelectorAll('[required]').forEach(el => el.required = false);
    formAlteracaoContainer.querySelectorAll('[required]').forEach(el => el.required = false);


    if (radio.value === "desistiu" && radio.checked) {
        motivoDesistenciaContainer.style.display = "block";
        const motivoInput = motivoDesistenciaContainer.querySelector("#motivo-desistencia-pb");
        if(motivoInput) motivoInput.required = true;
    } else if (radio.value === "outra_modalidade" && radio.checked) {
        formAlteracaoContainer.style.display = "block";
        formAlteracaoContainer.innerHTML = '<div class="loading-spinner-small" style="margin: 10px auto;"></div> Carregando formulário...';
        try {
            // ** Verifique o caminho! **
            const response = await fetch("./modal-content-alterar-horario.html");
            if (!response.ok) throw new Error(`Erro ${response.status} ao buscar ./modal-content-alterar-horario.html`);
            formAlteracaoContainer.innerHTML = await response.text();
            // Configura a lógica JS específica DESTE formulário carregado
            // Precisa passar o ID do atendimento atual
            const atendimentoId = formPrincipal.querySelector("#atendimento-id-horarios-modal")?.value;
            const atendimentoAtual = estado.pacienteDataGlobal?.atendimentosPB?.find(at => at.atendimentoId === atendimentoId);
            setupFormLogicAlterarHorario(formAlteracaoContainer, atendimentoAtual); // Passa o atendimento
        } catch (error) {
            console.error("Erro ao carregar form Alterar Horário:", error);
            formAlteracaoContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar formulário: ${error.message}</p>`;
        }
    }
}


// --- Funções Auxiliares para Configurar Forms Carregados Dinamicamente ---

/**
 * Configura a lógica do formulário de Novas Sessões carregado dinamicamente.
 * @param {HTMLElement} container - O elemento onde o HTML do form foi injetado.
 * @param {object | null} atendimentoAtivo - Os dados do atendimento PB atual.
 */
function setupFormLogicNovasSessoes(container, atendimentoAtivo) {
  const form = container.querySelector("#solicitar-sessoes-form"); // ID esperado do form carregado
  if (!form) {
    console.error("Formulário #solicitar-sessoes-form não encontrado no HTML carregado em #form-continuacao-pb.");
    container.innerHTML = `<p class="alert alert-error">Erro interno: Estrutura do formulário Novas Sessões inválida.</p>`;
    return;
  }

  // --- Preenche campos fixos (nomes já devem estar visíveis no modal pai) ---
 // const profNomeEl = form.querySelector("#solicitar-profissional-nome");
 // if (profNomeEl) profNomeEl.value = estado.userDataGlobal?.nome || "";
 // const pacNomeEl = form.querySelector("#solicitar-paciente-nome");
 // if (pacNomeEl) pacNomeEl.value = estado.pacienteDataGlobal?.nomeCompleto || "";

  // --- Popula selects ---
  const horarioSelect = form.querySelector("#solicitar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 7; i <= 21; i++) { // Horários de 7h às 21h
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
      // Adiciona :30 se necessário
       if (i < 21) {
            const hora30 = `${String(i).padStart(2, "0")}:30`;
            horarioSelect.innerHTML += `<option value="${hora30}">${hora30}</option>`;
       }
    }
  }

  const salaSelect = form.querySelector("#solicitar-sala");
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="">Selecione...</option>'; // Opção vazia
    salaSelect.innerHTML += '<option value="Online">Online</option>'; // Opção Online fixa
    // Adiciona salas presenciais do estado global
    estado.salasPresenciaisGlobal.forEach((sala) => {
      if (sala && sala !== "Online") { // Evita duplicar "Online"
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  }

  // --- Listeners para validação de grade e tipo/sala ---
  const tipoAtendimentoSelect = form.querySelector("#solicitar-tipo-atendimento");
  const salaSelectEl = form.querySelector("#solicitar-sala"); // Guarda referência

  const ajustarSalaESetarRequiredsNovasSessoes = () => {
    const tipo = tipoAtendimentoSelect?.value; // 'online' ou 'presencial'
    const isOnline = tipo === "online";

    if (salaSelectEl) {
        salaSelectEl.disabled = isOnline;
        salaSelectEl.required = !isOnline; // Obrigatório se não for online
        if (isOnline) {
            salaSelectEl.value = "Online"; // Força "Online"
        } else if (salaSelectEl.value === "Online") {
            salaSelectEl.value = ""; // Limpa se mudou de Online para Presencial
        }
    }
    // Define os requireds para este form
    form.querySelectorAll("#solicitar-dia-semana, #solicitar-horario, #solicitar-tipo-atendimento, #solicitar-frequencia, #solicitar-data-inicio")
        .forEach(el => el.required = true);
    // Sala já tratada acima

    // Chama validação de grade
    validarHorarioNaGrade(form);
  };

  // Adiciona listeners aos campos relevantes (clonando para remover antigos)
  ["solicitar-dia-semana", "solicitar-horario", "solicitar-tipo-atendimento", "solicitar-sala"].forEach(id => {
    const element = form.querySelector(`#${id}`);
    if (element) {
        const clone = element.cloneNode(true);
        element.parentNode.replaceChild(clone, element);
        clone.addEventListener('change', ajustarSalaESetarRequiredsNovasSessoes);
    }
  });

  // Chama a função uma vez para o estado inicial
  ajustarSalaESetarRequiredsNovasSessoes();

  console.log("Formulário Novas Sessões (dinâmico) configurado.");
}


/**
 * Configura a lógica do formulário de Alterar Horário carregado dinamicamente.
 * @param {HTMLElement} container - O elemento onde o HTML do form foi injetado.
 * @param {object | null} atendimentoAtivo - Os dados do atendimento PB atual.
 */
function setupFormLogicAlterarHorario(container, atendimentoAtivo) {
  const form = container.querySelector("#alterar-horario-form"); // ID esperado do form
  if (!form) {
    console.error("Formulário #alterar-horario-form não encontrado no HTML carregado em #form-alteracao-pb.");
    container.innerHTML = `<p class="alert alert-error">Erro interno: Estrutura do formulário Alterar Horário inválida.</p>`;
    return;
  }

  // --- Preenche dados fixos e atuais ---
  // const pacNomeEl = form.querySelector("#alterar-paciente-nome");
  // if (pacNomeEl) pacNomeEl.value = estado.pacienteDataGlobal?.nomeCompleto || "";
  // const profNomeEl = form.querySelector("#alterar-profissional-nome");
  // if (profNomeEl) profNomeEl.value = estado.userDataGlobal?.nome || "";

  // Preenche dados do horário atual (se existir no atendimento)
  const horarioAtual = atendimentoAtivo?.horarioSessoes || {};
  const diaAtualEl = form.querySelector("#alterar-dia-atual");
  if (diaAtualEl) diaAtualEl.value = horarioAtual.diaSemana || "N/A";
  const horaAtualEl = form.querySelector("#alterar-horario-atual");
  if (horaAtualEl) horaAtualEl.value = horarioAtual.horario || "N/A";
  const modAtualEl = form.querySelector("#alterar-modalidade-atual");
  // O valor no DB pode ser 'online'/'presencial' ou 'Online'/'Presencial', normaliza para exibição
  if (modAtualEl) modAtualEl.value = (horarioAtual.tipoAtendimento || "N/A").replace(/^./, c => c.toUpperCase());

  // --- Popula selects ---
  const horarioSelect = form.querySelector("#alterar-horario"); // Select para NOVO horário
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 7; i <= 21; i++) { // Horários de 7h às 21h
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
      if (i < 21) {
            const hora30 = `${String(i).padStart(2, "0")}:30`;
            horarioSelect.innerHTML += `<option value="${hora30}">${hora30}</option>`;
       }
    }
  }

  const salaSelect = form.querySelector("#alterar-sala"); // Select para NOVA sala
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="">Selecione...</option>';
    salaSelect.innerHTML += '<option value="Online">Online</option>';
    estado.salasPresenciaisGlobal.forEach((sala) => {
      if (sala && sala !== "Online") {
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  }

  // --- Lógica para habilitar/desabilitar Sala e setar Requireds ---
  const tipoAtendimentoSelect = form.querySelector("#alterar-tipo-atendimento"); // Select para NOVO tipo
  const salaSelectEl = form.querySelector("#alterar-sala"); // Select para NOVA sala

  const ajustarSalaESetarRequiredsAlteracao = () => {
    const tipo = tipoAtendimentoSelect?.value; // 'Online' ou 'Presencial' (do select)
    const isOnline = tipo === "Online";

    if (salaSelectEl) {
        salaSelectEl.disabled = isOnline;
        salaSelectEl.required = !isOnline; // Obrigatório se não for Online
        if (isOnline) {
            salaSelectEl.value = "Online"; // Força Online
        } else if (salaSelectEl.value === "Online") {
            salaSelectEl.value = ""; // Limpa se mudou para Presencial
        }
    }
     // Define os requireds para este form
    form.querySelectorAll("#alterar-dia-semana, #alterar-horario, #alterar-tipo-atendimento, #alterar-frequencia, #alterar-data-inicio, #alterar-grade")
        .forEach(el => el.required = true);
    // Justificativa pode ou não ser obrigatória, ajuste aqui se necessário:
    // form.querySelector('#alterar-justificativa').required = true;
  };

  // Adiciona listener ao select de tipo (clonando para remover antigos)
  if (tipoAtendimentoSelect) {
      const clone = tipoAtendimentoSelect.cloneNode(true);
      tipoAtendimentoSelect.parentNode.replaceChild(clone, tipoAtendimentoSelect);
      clone.addEventListener('change', ajustarSalaESetarRequiredsAlteracao);
  }

  // Chama a função uma vez para o estado inicial
  ajustarSalaESetarRequiredsAlteracao();

  console.log("Formulário Alterar Horário (dinâmico) configurado.");
}


// --- Função para validar horário na grade (Usada pelo form Novas Sessões) ---

/**
 * Valida se o horário selecionado em um formulário está ocupado na grade global.
 * Exibe feedback na div '#validacao-grade-feedback'.
 * @param {HTMLFormElement} formContext - O elemento <form> sendo validado.
 */
function validarHorarioNaGrade(formContext) {
  const feedbackDiv = document.getElementById("validacao-grade-feedback");
  if (!feedbackDiv) {
    console.warn("Elemento de feedback #validacao-grade-feedback não encontrado.");
    return;
  }

  // Esconde e reseta feedback
  feedbackDiv.style.display = "none";
  feedbackDiv.className = "info-note";
  feedbackDiv.innerHTML = "";

  if (!formContext || !formContext.contains(document.getElementById('solicitar-dia-semana'))) {
    // Só valida se o formContext for o de Novas Sessões (contém os IDs corretos)
    // console.log("validarHorarioNaGrade: Contexto não é o form Novas Sessões.");
    return;
  }

  // Pega valores dos campos DENTRO do formContext
  const diaEl = formContext.querySelector("#solicitar-dia-semana");
  const horarioEl = formContext.querySelector("#solicitar-horario");
  const tipoEl = formContext.querySelector("#solicitar-tipo-atendimento");
  const salaEl = formContext.querySelector("#solicitar-sala");

  if (!diaEl || !horarioEl || !tipoEl || !salaEl) {
    console.warn("Elementos para validação de grade não encontrados no contexto do form.");
    return; // Não pode validar
  }

  const dia = diaEl.value;
  const horarioCompleto = horarioEl.value; // Formato HH:MM
  const tipo = tipoEl.value; // Formato 'online' ou 'presencial' (do select)
  const sala = salaEl.value;

  // Converte hora para chave da grade (HH-MM)
  const horaKey = horarioCompleto ? horarioCompleto.replace(":", "-") : null;

  // Validação básica - só prossegue se todos os campos necessários estiverem preenchidos
  if (!dia || !horaKey || !tipo || (tipo === "presencial" && !sala)) {
    return; // Não mostra feedback se faltam dados
  }

  // Mapeia dia PT-BR para chave da grade (minúsculo, sem acento/cedilha)
  const diasMapGrade = {
    "Segunda-feira": "segunda",
    "Terça-feira": "terca",
    "Quarta-feira": "quarta",
    "Quinta-feira": "quinta",
    "Sexta-feira": "sexta",
    Sábado: "sabado",
  };
  const diaChave = diasMapGrade[dia] || dia.toLowerCase(); // Fallback

  // Verifica ocupação na grade (usa estado.dadosDaGradeGlobal)
  let isOcupado = false;
  const grade = estado.dadosDaGradeGlobal;

  if (tipo === "online") {
    // Verifica todas as colunas online para o dia/hora
    const colunasOnline = grade?.online?.[diaChave]?.[horaKey];
    if (colunasOnline) {
        // Assumindo 6 colunas (col0 a col5) - ajuste se necessário
        for (let i = 0; i < 6; i++) {
            if (colunasOnline[`col${i}`]) { // Verifica se a coluna tem algum valor (está ocupada)
                isOcupado = true;
                break;
            }
        }
    }
  } else if (tipo === "presencial") {
    // Encontra o índice da sala selecionada na lista global de salas
    const salaIndex = estado.salasPresenciaisGlobal?.indexOf(sala);
    // Verifica se a sala existe e se a coluna correspondente na grade está ocupada
    if (salaIndex !== undefined && salaIndex !== -1) {
        const colunaPresencial = grade?.presencial?.[diaChave]?.[horaKey]?.[`col${salaIndex}`];
        if (colunaPresencial) { // Verifica se a coluna tem algum valor
             isOcupado = true;
        }
    } else if (sala) { // Se selecionou uma sala, mas ela não foi encontrada no índice
        console.warn(`Sala presencial "${sala}" selecionada não encontrada na lista global.`);
        // Considerar como erro ou indisponível? Por segurança, marcar como ocupado/inválido.
        isOcupado = true; // Ou mostrar um erro diferente
    }
  }

  // Exibe o feedback
  feedbackDiv.style.display = "block";
  if (isOcupado) {
    feedbackDiv.className = "info-note exists alert alert-warning";
    feedbackDiv.innerHTML = `<strong>Atenção:</strong> O horário ${horarioCompleto} (${tipo === 'presencial' ? sala : 'Online'}) parece <strong>ocupado</strong> na grade.<br>A solicitação será enviada para análise do administrativo.`;
  } else {
    feedbackDiv.className = "info-note success alert alert-success";
    feedbackDiv.innerHTML = `<strong>Disponível:</strong> O horário ${horarioCompleto} (${tipo === 'presencial' ? sala : 'Online'}) parece <strong>livre</strong> na grade.<br>A solicitação será enviada para análise do administrativo.`;
  }
}


// --- Handler de Submit Principal do Modal ---

/**
 * Handler para o submit do formulário principal do modal Horários PB (#horarios-pb-form).
 * Direciona o fluxo com base nas seleções do usuário.
 * @param {Event} evento - O evento de submit.
 * @param {string} userUid - UID do usuário logado.
 * @param {object} userData - Dados do usuário logado.
 */
export async function handleHorariosPbSubmit(evento, userUid, userData) {
  evento.preventDefault();
  const formularioPrincipal = evento.target; // É o #horarios-pb-form
  const modal = formularioPrincipal.closest(".modal-overlay");
  const botaoSalvar = modal?.querySelector('button[type="submit"]');

  if (!formularioPrincipal || !modal || !botaoSalvar || !userUid || !userData) {
    console.error("Elementos do modal ou dados do usuário ausentes no submit de Horários PB.");
    alert("Erro interno ao salvar. Recarregue a página.");
    return;
  }

  botaoSalvar.disabled = true;
  botaoSalvar.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

  const pacienteId = formularioPrincipal.querySelector("#paciente-id-horarios-modal")?.value;
  const atendimentoId = formularioPrincipal.querySelector("#atendimento-id-horarios-modal")?.value;

  // Validação de IDs
  if (!pacienteId || !atendimentoId || pacienteId !== estado.pacienteIdGlobal) {
      alert("Erro: Inconsistência nos IDs do formulário. Recarregue a página.");
      botaoSalvar.disabled = false; botaoSalvar.textContent = "Salvar";
      return;
  }

  const docRefPaciente = doc(db, "trilhaPaciente", pacienteId);

  try {
    const iniciouRadio = formularioPrincipal.querySelector('input[name="iniciou-pb"]:checked');
    const motivoNaoInicioRadio = formularioPrincipal.querySelector('input[name="motivo-nao-inicio"]:checked'); // Pode ser null

    if (!iniciouRadio) {
      formularioPrincipal.reportValidity(); // Tenta mostrar validação HTML
      throw new Error("Selecione se o paciente iniciou o atendimento ou não.");
    }
    const iniciou = iniciouRadio.value; // 'sim' ou 'nao'

    // --- FLUXO: SIM (Iniciou Atendimento - Equivalente a Novas Sessões) ---
    if (iniciou === "sim") {
      const formContinuacao = document.getElementById("form-continuacao-pb")?.querySelector("#solicitar-sessoes-form");
      if (!formContinuacao) throw new Error("Erro interno: Formulário de agendamento (Novas Sessões) não encontrado.");

      // Valida o formulário carregado dinamicamente
      if (!formContinuacao.checkValidity()) {
        formContinuacao.reportValidity();
        throw new Error("Preencha todos os campos obrigatórios (*) do agendamento.");
      }

      // Coleta dados do formulário de Novas Sessões
      const horarioSessaoData = {
        responsavelId: userUid,
        responsavelNome: userData.nome,
        diaSemana: formContinuacao.querySelector("#solicitar-dia-semana")?.value || null,
        horario: formContinuacao.querySelector("#solicitar-horario")?.value || null,
        tipoAtendimento: formContinuacao.querySelector("#solicitar-tipo-atendimento")?.value || null, // 'online' ou 'presencial'
        frequencia: formContinuacao.querySelector("#solicitar-frequencia")?.value || null,
        salaAtendimento: formContinuacao.querySelector("#solicitar-sala")?.value || null,
        dataInicio: formContinuacao.querySelector("#solicitar-data-inicio")?.value || null, // YYYY-MM-DD
        alterarGrade: "Sim", // Assume que ao informar, quer incluir na grade
        observacoes: "", // Campo não presente neste form
        definidoEm: Timestamp.now(), // Timestamp de quando foi definido
      };

      // --- Atualiza a trilha do paciente ---
      const docSnap = await getDoc(docRefPaciente);
      if (!docSnap.exists()) throw new Error("Paciente não encontrado no banco de dados!");
      const dadosDoPaciente = docSnap.data();
      const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])]; // Cria cópia
      const indiceDoAtendimento = atendimentos.findIndex(at => at.atendimentoId === atendimentoId);
      if (indiceDoAtendimento === -1) throw new Error("Atendimento PB específico não encontrado para este paciente!");

      // Atualiza o atendimento específico
      atendimentos[indiceDoAtendimento].horarioSessoes = horarioSessaoData;
      atendimentos[indiceDoAtendimento].statusAtendimento = "horarios_informados"; // Muda o status DO ATENDIMENTO

      const dadosParaAtualizarTrilha = {
        atendimentosPB: atendimentos, // Array atualizado
        status: "cadastrar_horario_psicomanager", // Muda o status GERAL do paciente
        lastUpdate: serverTimestamp(),
      };
      await updateDoc(docRefPaciente, dadosParaAtualizarTrilha);

      // --- Cria a solicitação para o admin ---
      const solicitacaoData = {
        tipo: "novas_sessoes", // Usa o tipo que o admin espera para cadastrar
        status: "Pendente",
        dataSolicitacao: serverTimestamp(),
        solicitanteId: userUid,
        solicitanteNome: userData.nome,
        pacienteId: pacienteId,
        pacienteNome: dadosDoPaciente.nomeCompleto,
        atendimentoId: atendimentoId,
        detalhes: { // Mapeia para os nomes esperados pela solicitação original
          diaSemana: horarioSessaoData.diaSemana,
          horario: horarioSessaoData.horario,
          modalidade: horarioSessaoData.tipoAtendimento?.replace(/^./, c => c.toUpperCase()), // Garante 'Online' ou 'Presencial'
          frequencia: horarioSessaoData.frequencia,
          sala: horarioSessaoData.salaAtendimento,
          dataInicioPreferencial: horarioSessaoData.dataInicio,
          alterarGradeSolicitado: horarioSessaoData.alterarGrade, // Informa intenção de alterar grade
        },
        adminFeedback: null,
      };
      await addDoc(collection(db, "solicitacoes"), solicitacaoData);
      console.log("Solicitação 'novas_sessoes' (para cadastro) criada via Horários PB.", solicitacaoData.detalhes);

    // --- FLUXO: NÃO (Não iniciou atendimento) ---
    } else if (iniciou === "nao") {
      if (!motivoNaoInicioRadio) { // Validação extra
        formularioPrincipal.querySelector('input[name="motivo-nao-inicio"]')?.focus();
        throw new Error("Selecione o motivo pelo qual o atendimento não foi iniciado.");
      }
      const motivoNaoInicio = motivoNaoInicioRadio.value; // 'desistiu' ou 'outra_modalidade'

      // --- Sub-fluxo: NÃO -> DESISTIU ---
      if (motivoNaoInicio === "desistiu") {
        const motivoDescricaoInput = formularioPrincipal.querySelector("#motivo-desistencia-pb");
        const motivoDescricao = motivoDescricaoInput?.value.trim() || "";
        if (!motivoDescricao) {
          motivoDescricaoInput?.focus();
          motivoDescricaoInput?.reportValidity(); // Tenta mostrar erro HTML5
          throw new Error("Descreva o motivo da desistência antes do início.");
        }
        const dataDesistencia = new Date(); // Data/hora atual

        // --- Atualiza a trilha do paciente ---
        const docSnap = await getDoc(docRefPaciente);
        if (!docSnap.exists()) throw new Error("Paciente não encontrado!");
        const dadosDoPaciente = docSnap.data();
        const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])];
        const indiceDoAtendimento = atendimentos.findIndex(at => at.atendimentoId === atendimentoId);
        if (indiceDoAtendimento === -1) throw new Error("Atendimento PB específico não encontrado!");

        // Atualiza o atendimento específico
        atendimentos[indiceDoAtendimento].statusAtendimento = "desistencia_antes_inicio";
        atendimentos[indiceDoAtendimento].motivoNaoInicio = motivoDescricao; // Guarda a descrição
        atendimentos[indiceDoAtendimento].naoIniciouEm = Timestamp.fromDate(dataDesistencia);

        const dadosParaAtualizarTrilha = {
            atendimentosPB: atendimentos,
            status: "desistencia", // Atualiza status GERAL do paciente
            lastUpdate: serverTimestamp(),
        };
        await updateDoc(docRefPaciente, dadosParaAtualizarTrilha);
        console.log("Paciente marcado como desistência antes do início do PB.");

        // Exclui sessões futuras associadas a ESTE atendimentoId
        await excluirSessoesFuturas(pacienteId, atendimentoId, dataDesistencia);
        // Não cria solicitação, pois a ação é final no lado do profissional.

      // --- Sub-fluxo: NÃO -> OUTRA MODALIDADE/HORÁRIO (Equivalente a Alterar Horário) ---
      } else if (motivoNaoInicio === "outra_modalidade") {
        const formAlteracao = document.getElementById("form-alteracao-pb")?.querySelector("#alterar-horario-form");
        if (!formAlteracao) throw new Error("Erro interno: Formulário de alteração de horário não encontrado.");

        // Valida o formulário carregado dinamicamente
        if (!formAlteracao.checkValidity()) {
          formAlteracao.reportValidity();
          throw new Error("Preencha todos os campos obrigatórios (*) da nova configuração desejada.");
        }

        // Coleta dados do formulário de Alteração
        const dadosNovos = {
          dia: formAlteracao.querySelector("#alterar-dia-semana")?.value || null,
          horario: formAlteracao.querySelector("#alterar-horario")?.value || null,
          modalidade: formAlteracao.querySelector("#alterar-tipo-atendimento")?.value || null, // 'Online' ou 'Presencial'
          frequencia: formAlteracao.querySelector("#alterar-frequencia")?.value || null,
          sala: formAlteracao.querySelector("#alterar-sala")?.value || null,
          dataInicio: formAlteracao.querySelector("#alterar-data-inicio")?.value || null, // YYYY-MM-DD
          alterarGrade: formAlteracao.querySelector("#alterar-grade")?.value || null, // 'Sim' ou 'Não'
        };
        const justificativa = formAlteracao.querySelector("#alterar-justificativa")?.value.trim() ||
            "Solicitado antes do início do atendimento devido a preferência por outro horário/modalidade."; // Justificativa padrão

        // --- Busca dados atuais para preencher "dadosAntigos" da solicitação ---
        const docSnap = await getDoc(docRefPaciente);
        if (!docSnap.exists()) throw new Error("Paciente não encontrado!");
        const dadosDoPaciente = docSnap.data();
        const atendimentoAtual = dadosDoPaciente.atendimentosPB?.find(at => at.atendimentoId === atendimentoId);
        const horarioAntigo = atendimentoAtual?.horarioSessoes || {}; // Pode ser vazio se nunca foi definido
        const dadosAntigos = {
          dia: horarioAntigo.diaSemana || "N/A",
          horario: horarioAntigo.horario || "N/A",
          modalidade: horarioAntigo.tipoAtendimento || "N/A",
          sala: horarioAntigo.salaAtendimento || "N/A",
          frequencia: horarioAntigo.frequencia || "N/A",
        };

        // --- Atualiza a trilha do paciente ---
        const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])];
        const indiceDoAtendimento = atendimentos.findIndex(at => at.atendimentoId === atendimentoId);
        if (indiceDoAtendimento === -1) throw new Error("Atendimento PB específico não encontrado!");

        // Atualiza o atendimento específico
        atendimentos[indiceDoAtendimento].statusAtendimento = "solicitado_reencaminhamento"; // Status indicando espera pela ação do admin
        atendimentos[indiceDoAtendimento].motivoNaoInicio = "outra_modalidade";
        // Guarda a solicitação pendente dentro do próprio atendimento (opcional, mas útil)
        atendimentos[indiceDoAtendimento].solicitacaoAlteracaoPendente = { ...dadosNovos, justificativa: justificativa, dataSolicitacao: Timestamp.now() };
        atendimentos[indiceDoAtendimento].naoIniciouEm = Timestamp.now(); // Marca quando essa decisão foi tomada


        const dadosParaAtualizarTrilha = {
            atendimentosPB: atendimentos,
            status: "reavaliar_encaminhamento", // Status GERAL para admin analisar a solicitação
            lastUpdate: serverTimestamp(),
        };
        await updateDoc(docRefPaciente, dadosParaAtualizarTrilha);

        // --- Cria a solicitação para o admin ---
        const solicitacaoData = {
          tipo: "alteracao_horario", // Usa o tipo que o admin espera para processar alterações
          status: "Pendente",
          dataSolicitacao: serverTimestamp(),
          solicitanteId: userUid,
          solicitanteNome: userData.nome,
          pacienteId: pacienteId,
          pacienteNome: dadosDoPaciente.nomeCompleto,
          atendimentoId: atendimentoId,
          detalhes: {
            dadosAntigos: dadosAntigos,
            dadosNovos: dadosNovos, // Contém os dados preenchidos no form de alteração
            justificativa: justificativa,
          },
          adminFeedback: null,
        };
        await addDoc(collection(db, "solicitacoes"), solicitacaoData);
        console.log("Solicitação 'alteracao_horario' criada via Horários PB (Não iniciou -> Outra).", solicitacaoData.detalhes);

      } else {
        // Caso algum outro valor de radio 'motivo-nao-inicio' seja adicionado no futuro
        throw new Error(`Motivo de não início inválido ou não tratado: ${motivoNaoInicio}`);
      }
    } else {
      // Caso o valor do radio 'iniciou-pb' seja algo diferente de 'sim' ou 'nao'
      throw new Error(`Valor inválido para 'iniciou-pb': ${iniciou}`);
    }

    // --- Finalização Comum (Sucesso) ---
    alert("Informações salvas com sucesso!");
    modal.style.display = "none";

    // Recarrega os dados e atualiza a UI
    await carregador.carregarDadosPaciente(pacienteId);
    await carregador.carregarSessoes(); // Recarregar sessões caso alguma tenha sido excluída
    interfaceUI.preencherFormularios();
    interfaceUI.renderizarSessoes();
    interfaceUI.renderizarPendencias();
    interfaceUI.atualizarVisibilidadeBotoesAcao(estado.pacienteDataGlobal?.status || 'desconhecido');

  } catch (error) {
    console.error("Erro detalhado ao salvar informações de Horários PB:", error);
    // Tenta extrair uma mensagem mais útil
    let errorMsg = error instanceof Error ? error.message : String(error);
    // Adiciona contexto se for um erro de validação comum
    if (errorMsg.includes("obrigatórios") || errorMsg.includes("Selecione")) {
        // A mensagem já é auto-explicativa
    } else {
        errorMsg = `Erro ao salvar: ${errorMsg}`; // Mensagem mais genérica para outros erros
    }
    alert(errorMsg);
  } finally {
    // Garante que o botão seja reabilitado
    if (botaoSalvar) {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar";
    }
  }
}


// --- Função Auxiliar: Excluir Sessões Futuras ---

/**
 * Exclui todas as sessões futuras (após dataReferencia) associadas a um atendimento específico.
 * Usado quando há desistência antes do início do PB.
 * @param {string} pacienteId - ID do paciente.
 * @param {string} atendimentoId - ID do atendimento PB específico.
 * @param {Date} dataReferencia - Data a partir da qual as sessões devem ser excluídas.
 */
async function excluirSessoesFuturas(pacienteId, atendimentoId, dataReferencia) {
  console.log(`Iniciando exclusão de sessões futuras para Atendimento ID: ${atendimentoId} após ${dataReferencia.toISOString()}`);
  const sessoesRef = collection(db, "trilhaPaciente", pacienteId, "sessoes");
  const timestampReferencia = Timestamp.fromDate(dataReferencia); // Converte para Timestamp do Firestore

  // Query para buscar sessões DESTE atendimentoId que ocorrem APÓS a data de referência
  const q = query(
    sessoesRef,
    where("atendimentoId", "==", atendimentoId), // Filtra pelo atendimento específico
    where("dataHora", ">", timestampReferencia) // Apenas sessões futuras
  );

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.log("Nenhuma sessão futura encontrada para excluir para este atendimento.");
      return; // Nada a fazer
    }

    // Usa um batch para eficiência e atomicidade (até 500 operações)
    const batch = writeBatch(db);
    let count = 0;
    querySnapshot.forEach((doc) => {
      console.log(`Marcando sessão ${doc.id} (${doc.data().dataHora?.toDate()?.toLocaleString("pt-BR") || 'Data inválida'}) para exclusão.`);
      batch.delete(doc.ref);
      count++;
    });

    // Executa o batch
    await batch.commit();
    console.log(`${count} sessões futuras excluídas com sucesso para o atendimento ${atendimentoId}.`);

    // A UI será atualizada pela chamada `carregarSessoes` e `renderizarSessoes` no final do `handleHorariosPbSubmit`.

  } catch (error) {
    console.error(`Erro ao excluir sessões futuras para o atendimento ${atendimentoId}:`, error);
    // Informa o usuário sobre o erro, mas não interrompe o fluxo principal
    alert(`Atenção: Ocorreu um erro ao tentar excluir automaticamente as sessões futuras agendadas para este atendimento (${error.message}). Por favor, verifique e remova manualmente se necessário.`);
  }
}