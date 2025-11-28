// Arquivo: /modulos/voluntario/js/detalhes-paciente/modais/modal-horarios-pb.js
// Lógica para o modal refatorado de Horários PB (informar, desistir, alterar).

import {
  db,
  doc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  getDoc,
  query,
  where,
  getDocs,
  writeBatch,
} from "../conexao-db.js"; // Firestore functions
import * as estado from "../estado.js"; // Shared state
import * as carregador from "../carregador-dados.js"; // To reload data
import * as interfaceUI from "../interface.js"; // To update UI

// --- TEMPLATES HTML (Incorporados para evitar erro 404) ---

const HTML_NOVAS_SESSOES = `
<form id="solicitar-sessoes-form">
    <div class="form-group">
      <label for="solicitar-dia-semana">Dia da semana:*</label>
      <select id="solicitar-dia-semana" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="Segunda-feira">Segunda-feira</option>
        <option value="Terça-feira">Terça-feira</option>
        <option value="Quarta-feira">Quarta-feira</option>
        <option value="Quinta-feira">Quinta-feira</option>
        <option value="Sexta-feira">Sexta-feira</option>
        <option value="Sábado">Sábado</option>
      </select>
    </div>
    <div class="form-group">
      <label for="solicitar-horario">Horário:*</label>
      <select id="solicitar-horario" class="form-control" required>
        <option value="">Selecione...</option>
        </select>
    </div>
    <div class="form-group">
      <label for="solicitar-tipo-atendimento">Tipo de atendimento:*</label>
      <select id="solicitar-tipo-atendimento" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="Presencial">Presencial</option>
        <option value="online">Online</option>
      </select>
    </div>
    <div class="form-group">
      <label for="solicitar-frequencia">Frequência:*</label>
      <select id="solicitar-frequencia" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="Semanal">Semanal</option>
        <option value="Quinzenal">Quinzenal</option>
        <option value="Mensal">Mensal</option>
      </select>
    </div>
    <div class="form-group">
      <label for="solicitar-sala">Sala:*</label>
      <select id="solicitar-sala" class="form-control" required>
        <option value="">Selecione...</option>
        </select>
    </div>
    <div class="form-group">
      <label for="solicitar-data-inicio">Data de início:*</label>
      <input type="date" id="solicitar-data-inicio" class="form-control" required>
    </div>
</form>
`;

const HTML_ALTERAR_HORARIO = `
<form id="alterar-horario-form">
    <fieldset>
        <legend>Dados Atuais (Registrados)</legend>
        <div class="form-grid cols-3">
             <div class="form-group">
                <label>Dia Atual</label>
                <input type="text" id="alterar-dia-atual" class="form-control" readonly>
            </div>
            <div class="form-group">
                <label>Horário Atual</label>
                <input type="text" id="alterar-horario-atual" class="form-control" readonly>
            </div>
            <div class="form-group">
                <label>Modalidade Atual</label>
                <input type="text" id="alterar-modalidade-atual" class="form-control" readonly>
            </div>
        </div>
    </fieldset>
    <fieldset>
        <legend>Nova Configuração Desejada</legend>
        <div class="form-group">
          <label for="alterar-dia-semana">Novo Dia:*</label>
          <select id="alterar-dia-semana" class="form-control" required>
            <option value="">Selecione...</option>
            <option value="Segunda-feira">Segunda-feira</option>
            <option value="Terça-feira">Terça-feira</option>
            <option value="Quarta-feira">Quarta-feira</option>
            <option value="Quinta-feira">Quinta-feira</option>
            <option value="Sexta-feira">Sexta-feira</option>
            <option value="Sábado">Sábado</option>
          </select>
        </div>
        <div class="form-group">
          <label for="alterar-horario">Novo Horário:*</label>
          <select id="alterar-horario" class="form-control" required>
            </select>
        </div>
        <div class="form-group">
          <label for="alterar-tipo-atendimento">Nova Modalidade:*</label>
          <select id="alterar-tipo-atendimento" class="form-control" required>
            <option value="">Selecione...</option>
            <option value="Presencial">Presencial</option>
            <option value="Online">Online</option>
          </select>
        </div>
         <div class="form-group">
          <label for="alterar-frequencia">Frequência:*</label>
          <select id="alterar-frequencia" class="form-control" required>
            <option value="">Selecione...</option>
            <option value="Semanal">Semanal</option>
            <option value="Quinzenal">Quinzenal</option>
            <option value="Mensal">Mensal</option>
          </select>
        </div>
        <div class="form-group">
          <label for="alterar-sala">Nova Sala:*</label>
          <select id="alterar-sala" class="form-control" required>
             </select>
        </div>
        <div class="form-group">
            <label for="alterar-data-inicio">A partir de:*</label>
            <input type="date" id="alterar-data-inicio" class="form-control" required>
        </div>
        <div class="form-group">
            <label for="alterar-grade">Alterar na Grade?*</label>
            <select id="alterar-grade" class="form-control" required>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
            </select>
        </div>
         <div class="form-group">
            <label for="alterar-justificativa">Justificativa (Opcional):</label>
            <textarea id="alterar-justificativa" rows="2" class="form-control"></textarea>
        </div>
    </fieldset>
</form>
`;

// --- Funções Exportadas ---

/**
 * Abre o modal dinâmico de Horários PB.
 * Adapta a interface com base nas seleções do usuário (iniciou/não iniciou, motivo).
 */
export async function abrirModalHorariosPb() {
  // Verifica dados essenciais
  if (!estado.pacienteDataGlobal || !estado.userDataGlobal) {
    alert(
      "Dados do paciente ou do usuário não carregados. Não é possível abrir o modal."
    );
    return;
  }

  // Busca o atendimento PB relevante para este profissional e status apropriado
  const atendimentoPbDoUsuario = estado.pacienteDataGlobal.atendimentosPB?.find(
    (at) =>
      at.profissionalId === estado.userDataGlobal.uid &&
      // Permite abrir se aguardando, informado, ativo (para alteração?) ou reencaminhamento.
      [
        "aguardando_info_horarios",
        "horarios_informados",
        "ativo",
        "solicitado_reencaminhamento",
      ].includes(at.statusAtendimento) &&
      !at.statusAtendimento.startsWith("concluido_") && // Não concluído
      at.statusAtendimento !== "desistencia_antes_inicio" // Não desistiu antes
  );

  if (!atendimentoPbDoUsuario) {
    alert(
      "Não foi encontrado um atendimento PB atribuído a você (ou o status atual não permite esta ação) para este paciente."
    );
    return;
  }

  // Referências aos elementos do modal principal e containers dinâmicos
  const modal = document.getElementById("horarios-pb-modal");
  const form = document.getElementById("horarios-pb-form");
  const pacienteIdInput = form?.querySelector("#paciente-id-horarios-modal");
  const atendimentoIdInput = form?.querySelector(
    "#atendimento-id-horarios-modal"
  );
  const motivoNaoInicioContainer = document.getElementById(
    "motivo-nao-inicio-pb-container"
  );
  const formContinuacaoContainer = document.getElementById(
    "form-continuacao-pb"
  ); // Para form Novas Sessões
  const motivoDesistenciaContainer = document.getElementById(
    "motivo-desistencia-container"
  ); // Para motivo desistência
  const formAlteracaoContainer = document.getElementById("form-alteracao-pb"); // Para form Alterar Horário
  const btnSalvarHorarios = modal?.querySelector('button[type="submit"]');
  const feedbackGradeDiv = document.getElementById("validacao-grade-feedback"); // Div global de feedback

  // Validação da existência dos elementos essenciais
  if (
    !modal ||
    !form ||
    !pacienteIdInput ||
    !atendimentoIdInput ||
    !motivoNaoInicioContainer ||
    !formContinuacaoContainer ||
    !motivoDesistenciaContainer ||
    !formAlteracaoContainer ||
    !btnSalvarHorarios ||
    !feedbackGradeDiv
  ) {
    console.error(
      "Elementos essenciais do modal Horários PB (ou feedback de grade) não encontrados. Verifique o HTML."
    );
    alert("Erro ao abrir o modal: estrutura interna inválida.");
    return;
  }

  // --- Reset Completo da UI do Modal ---
  form.reset(); // Limpa todos os campos do form principal
  pacienteIdInput.value = estado.pacienteIdGlobal;
  atendimentoIdInput.value = atendimentoPbDoUsuario.atendimentoId;
  // Oculta todos os containers condicionais
  [
    motivoNaoInicioContainer,
    formContinuacaoContainer,
    motivoDesistenciaContainer,
    formAlteracaoContainer,
    feedbackGradeDiv,
  ].forEach((el) => {
    if (el) el.style.display = "none";
  });
  // Limpa o conteúdo dos containers que carregam forms externos
  formContinuacaoContainer.innerHTML = "";
  formAlteracaoContainer.innerHTML = "";

  // Limpa campo de texto de motivo de desistência (se existir) de forma segura
  const motivoDesistenciaInput = motivoDesistenciaContainer.querySelector(
    "#motivo-desistencia-pb"
  );
  if (motivoDesistenciaInput) {
    motivoDesistenciaInput.value = ""; // Limpa campo de texto
  }

  // Limpa 'required' de todos os elementos dentro do form principal E dos containers dinâmicos
  form.querySelectorAll("[required]").forEach((el) => (el.required = false));
  // Limpa requireds especificos que podem ter sido adicionados dinamicamente
  motivoNaoInicioContainer
    .querySelectorAll("[required]")
    .forEach((el) => (el.required = false));
  motivoDesistenciaContainer
    .querySelectorAll("[required]")
    .forEach((el) => (el.required = false));

  // Garante que APENAS o radio 'iniciou-pb' seja obrigatório inicialmente
  form
    .querySelectorAll('input[name="iniciou-pb"]')
    .forEach((r) => (r.required = true));

  // Reseta estado do botão salvar
  btnSalvarHorarios.disabled = false;
  btnSalvarHorarios.textContent = "Salvar";

  // --- Remove Listeners Antigos e Adiciona Novos ---
  // Usar clonagem para garantir remoção de listeners anônimos anteriores
  const radiosIniciouOriginais = form.querySelectorAll(
    'input[name="iniciou-pb"]'
  );
  radiosIniciouOriginais.forEach((radio) => {
    const clone = radio.cloneNode(true);
    clone.required = true; // Mantém required no clone
    radio.parentNode.replaceChild(clone, radio);
    // Adiciona listener AO CLONE
    clone.addEventListener("change", listenerIniciouPbChange);
  });

  const radiosMotivoOriginais = form.querySelectorAll(
    'input[name="motivo-nao-inicio"]'
  );
  radiosMotivoOriginais.forEach((radio) => {
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
  const formPrincipal = radio.closest("form"); // Encontra o form pai
  const formContinuacaoContainer = document.getElementById(
    "form-continuacao-pb"
  );
  const motivoNaoInicioContainer = document.getElementById(
    "motivo-nao-inicio-pb-container"
  );
  const motivoDesistenciaContainer = document.getElementById(
    "motivo-desistencia-container"
  );
  const formAlteracaoContainer = document.getElementById("form-alteracao-pb");
  const feedbackGradeDiv = document.getElementById("validacao-grade-feedback");

  // Reset geral das seções condicionais e seus requireds antes de mostrar a correta
  [
    formContinuacaoContainer,
    motivoNaoInicioContainer,
    motivoDesistenciaContainer,
    formAlteracaoContainer,
    feedbackGradeDiv,
  ].forEach((el) => {
    if (el) el.style.display = "none";
  });
  formContinuacaoContainer.innerHTML = ""; // Limpa conteúdo dinâmico
  formAlteracaoContainer.innerHTML = ""; // Limpa conteúdo dinâmico
  formPrincipal
    .querySelectorAll(
      "#motivo-nao-inicio-pb-container [required], #motivo-desistencia-container [required], #form-continuacao-pb [required], #form-alteracao-pb [required]"
    )
    .forEach((el) => (el.required = false)); // Limpa requireds de todas as seções

  if (radio.value === "sim" && radio.checked) {
    formContinuacaoContainer.style.display = "block";

    // --- ALTERAÇÃO: Usa HTML constante em vez de fetch ---
    formContinuacaoContainer.innerHTML = HTML_NOVAS_SESSOES;

    // Configura a lógica JS específica DESTE formulário carregado
    const atendimentoId = formPrincipal.querySelector(
      "#atendimento-id-horarios-modal"
    )?.value;
    const atendimentoAtual = estado.pacienteDataGlobal?.atendimentosPB?.find(
      (at) => at.atendimentoId === atendimentoId
    );
    setupFormLogicNovasSessoes(formContinuacaoContainer, atendimentoAtual); // Passa o atendimento
  } else if (radio.value === "nao" && radio.checked) {
    motivoNaoInicioContainer.style.display = "block";
    // Torna a escolha do motivo obrigatória
    formPrincipal
      .querySelectorAll('input[name="motivo-nao-inicio"]')
      .forEach((r) => {
        r.checked = false; // Garante que nenhum esteja pré-selecionado
        r.required = true;
      });
  }
}

/** Listener para mudanças no radio 'motivo-nao-inicio' */
async function listenerMotivoNaoInicioChange(event) {
  const radio = event.target;
  const formPrincipal = radio.closest("form");
  const motivoDesistenciaContainer = document.getElementById(
    "motivo-desistencia-container"
  );
  const formAlteracaoContainer = document.getElementById("form-alteracao-pb");
  const feedbackGradeDiv = document.getElementById("validacao-grade-feedback");

  // Reset das seções específicas do 'Não' e seus requireds
  [
    motivoDesistenciaContainer,
    formAlteracaoContainer,
    feedbackGradeDiv,
  ].forEach((el) => {
    if (el) el.style.display = "none";
  });
  formAlteracaoContainer.innerHTML = ""; // Limpa conteúdo dinâmico
  motivoDesistenciaContainer
    .querySelectorAll("[required]")
    .forEach((el) => (el.required = false));
  formAlteracaoContainer
    .querySelectorAll("[required]")
    .forEach((el) => (el.required = false));

  if (radio.value === "desistiu" && radio.checked) {
    motivoDesistenciaContainer.style.display = "block";
    const motivoInput = motivoDesistenciaContainer.querySelector(
      "#motivo-desistencia-pb"
    );
    if (motivoInput) motivoInput.required = true;
  } else if (radio.value === "outra_modalidade" && radio.checked) {
    formAlteracaoContainer.style.display = "block";

    // --- ALTERAÇÃO: Usa HTML constante em vez de fetch ---
    formAlteracaoContainer.innerHTML = HTML_ALTERAR_HORARIO;

    // Configura a lógica JS específica DESTE formulário carregado
    const atendimentoId = formPrincipal.querySelector(
      "#atendimento-id-horarios-modal"
    )?.value;
    const atendimentoAtual = estado.pacienteDataGlobal?.atendimentosPB?.find(
      (at) => at.atendimentoId === atendimentoId
    );
    setupFormLogicAlterarHorario(formAlteracaoContainer, atendimentoAtual); // Passa o atendimento
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
    console.error(
      "Formulário #solicitar-sessoes-form não encontrado no HTML carregado em #form-continuacao-pb."
    );
    container.innerHTML = `<p class="alert alert-error">Erro interno: Estrutura do formulário Novas Sessões inválida.</p>`;
    return;
  }
  const horarioSelect = form.querySelector("#solicitar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 7; i <= 21; i++) {
      // Horários de 7h às 21h
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
      if (i < 21) {
        const hora30 = `${String(i).padStart(2, "0")}:30`;
        horarioSelect.innerHTML += `<option value="${hora30}">${hora30}</option>`;
      }
    }
  }
  const salaSelect = form.querySelector("#solicitar-sala");
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="">Selecione...</option>';
    salaSelect.innerHTML += '<option value="Online">Online</option>';
    estado.salasPresenciaisGlobal.forEach((sala) => {
      if (sala && sala !== "Online") {
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  }
  const tipoAtendimentoSelect = form.querySelector(
    "#solicitar-tipo-atendimento"
  );
  const salaSelectEl = form.querySelector("#solicitar-sala");
  const ajustarSalaESetarRequiredsNovasSessoes = () => {
    const tipo = tipoAtendimentoSelect?.value;
    const isOnline = tipo === "online";
    if (salaSelectEl) {
      salaSelectEl.disabled = isOnline;
      salaSelectEl.required = !isOnline;
      if (isOnline) {
        salaSelectEl.value = "Online";
      } else if (salaSelectEl.value === "Online") {
        salaSelectEl.value = "";
      }
    }
    form
      .querySelectorAll(
        "#solicitar-dia-semana, #solicitar-horario, #solicitar-tipo-atendimento, #solicitar-frequencia, #solicitar-data-inicio"
      )
      .forEach((el) => (el.required = true));
    validarHorarioNaGrade(form);
  };
  [
    "solicitar-dia-semana",
    "solicitar-horario",
    "solicitar-tipo-atendimento",
    "solicitar-sala",
  ].forEach((id) => {
    const element = form.querySelector(`#${id}`);
    if (element) {
      const clone = element.cloneNode(true);
      element.parentNode.replaceChild(clone, element);
      clone.addEventListener("change", ajustarSalaESetarRequiredsNovasSessoes);
    }
  });
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
    console.error(
      "Formulário #alterar-horario-form não encontrado no HTML carregado em #form-alteracao-pb."
    );
    container.innerHTML = `<p class="alert alert-error">Erro interno: Estrutura do formulário Alterar Horário inválida.</p>`;
    return;
  }
  const horarioAtual = atendimentoAtivo?.horarioSessoes || {};
  const diaAtualEl = form.querySelector("#alterar-dia-atual");
  if (diaAtualEl) diaAtualEl.value = horarioAtual.diaSemana || "N/A";
  const horaAtualEl = form.querySelector("#alterar-horario-atual");
  if (horaAtualEl) horaAtualEl.value = horarioAtual.horario || "N/A";
  const modAtualEl = form.querySelector("#alterar-modalidade-atual");
  if (modAtualEl)
    modAtualEl.value = (horarioAtual.tipoAtendimento || "N/A").replace(
      /^./,
      (c) => c.toUpperCase()
    );

  const horarioSelect = form.querySelector("#alterar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 7; i <= 21; i++) {
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
      if (i < 21) {
        const hora30 = `${String(i).padStart(2, "0")}:30`;
        horarioSelect.innerHTML += `<option value="${hora30}">${hora30}</option>`;
      }
    }
  }
  const salaSelect = form.querySelector("#alterar-sala");
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="">Selecione...</option>';
    salaSelect.innerHTML += '<option value="Online">Online</option>';
    estado.salasPresenciaisGlobal.forEach((sala) => {
      if (sala && sala !== "Online") {
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  }
  const tipoAtendimentoSelect = form.querySelector("#alterar-tipo-atendimento");
  const salaSelectEl = form.querySelector("#alterar-sala");
  const ajustarSalaESetarRequiredsAlteracao = () => {
    const tipo = tipoAtendimentoSelect?.value;
    const isOnline = tipo === "Online";
    if (salaSelectEl) {
      salaSelectEl.disabled = isOnline;
      salaSelectEl.required = !isOnline;
      if (isOnline) {
        salaSelectEl.value = "Online";
      } else if (salaSelectEl.value === "Online") {
        salaSelectEl.value = "";
      }
    }
    form
      .querySelectorAll(
        "#alterar-dia-semana, #alterar-horario, #alterar-tipo-atendimento, #alterar-frequencia, #alterar-data-inicio, #alterar-grade"
      )
      .forEach((el) => (el.required = true));
  };
  if (tipoAtendimentoSelect) {
    const clone = tipoAtendimentoSelect.cloneNode(true);
    tipoAtendimentoSelect.parentNode.replaceChild(clone, tipoAtendimentoSelect);
    clone.addEventListener("change", ajustarSalaESetarRequiredsAlteracao);
  }
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
    console.warn(
      "Elemento de feedback #validacao-grade-feedback não encontrado."
    );
    return;
  }
  feedbackDiv.style.display = "none";
  feedbackDiv.className = "info-note";
  feedbackDiv.innerHTML = "";
  if (
    !formContext ||
    !formContext.contains(document.getElementById("solicitar-dia-semana"))
  ) {
    return;
  }
  const diaEl = formContext.querySelector("#solicitar-dia-semana");
  const horarioEl = formContext.querySelector("#solicitar-horario");
  const tipoEl = formContext.querySelector("#solicitar-tipo-atendimento");
  const salaEl = formContext.querySelector("#solicitar-sala");
  if (!diaEl || !horarioEl || !tipoEl || !salaEl) {
    console.warn(
      "Elementos para validação de grade não encontrados no contexto do form."
    );
    return;
  }
  const dia = diaEl.value;
  const horarioCompleto = horarioEl.value;
  const tipo = tipoEl.value;
  const sala = salaEl.value;
  const horaKey = horarioCompleto ? horarioCompleto.replace(":", "-") : null;
  if (!dia || !horaKey || !tipo || (tipo === "presencial" && !sala)) {
    return;
  }
  const diasMapGrade = {
    "Segunda-feira": "segunda",
    "Terça-feira": "terca",
    "Quarta-feira": "quarta",
    "Quinta-feira": "quinta",
    "Sexta-feira": "sexta",
    Sábado: "sabado",
  };
  const diaChave = diasMapGrade[dia] || dia.toLowerCase();
  let isOcupado = false;
  const grade = estado.dadosDaGradeGlobal;
  if (tipo === "online") {
    const colunasOnline = grade?.online?.[diaChave]?.[horaKey];
    if (colunasOnline) {
      for (let i = 0; i < 6; i++) {
        if (colunasOnline[`col${i}`]) {
          isOcupado = true;
          break;
        }
      }
    }
  } else if (tipo === "presencial") {
    const salaIndex = estado.salasPresenciaisGlobal?.indexOf(sala);
    if (salaIndex !== undefined && salaIndex !== -1) {
      if (grade?.presencial?.[diaChave]?.[horaKey]?.[`col${salaIndex}`]) {
        isOcupado = true;
      }
    } else if (sala) {
      console.warn(
        `Sala presencial "${sala}" selecionada não encontrada na lista global.`
      );
      isOcupado = true;
    }
  }
  feedbackDiv.style.display = "block";
  if (isOcupado) {
    feedbackDiv.className = "info-note exists alert alert-warning";
    feedbackDiv.innerHTML = `<strong>Atenção:</strong> O horário ${horarioCompleto} (${
      tipo === "presencial" ? sala : "Online"
    }) parece <strong>ocupado</strong> na grade.<br>A solicitação será enviada para análise do administrativo.`;
  } else {
    feedbackDiv.className = "info-note success alert alert-success";
    feedbackDiv.innerHTML = `<strong>Disponível:</strong> O horário ${horarioCompleto} (${
      tipo === "presencial" ? sala : "Online"
    }) parece <strong>livre</strong> na grade.<br>A solicitação será enviada para análise do administrativo.`;
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
    console.error(
      "Elementos do modal ou dados do usuário ausentes no submit de Horários PB."
    );
    alert("Erro interno ao salvar. Recarregue a página.");
    return;
  }

  botaoSalvar.disabled = true;
  botaoSalvar.innerHTML =
    '<span class="loading-spinner-small"></span> Salvando...';

  const pacienteId = formularioPrincipal.querySelector(
    "#paciente-id-horarios-modal"
  )?.value;
  const atendimentoId = formularioPrincipal.querySelector(
    "#atendimento-id-horarios-modal"
  )?.value;

  if (!pacienteId || !atendimentoId || pacienteId !== estado.pacienteIdGlobal) {
    alert("Erro: Inconsistência nos IDs do formulário. Recarregue a página.");
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }

  const docRefPaciente = doc(db, "trilhaPaciente", pacienteId);

  try {
    const iniciouRadio = formularioPrincipal.querySelector(
      'input[name="iniciou-pb"]:checked'
    );
    const motivoNaoInicioRadio = formularioPrincipal.querySelector(
      'input[name="motivo-nao-inicio"]:checked'
    ); // Pode ser null

    if (!iniciouRadio) {
      formularioPrincipal.reportValidity();
      throw new Error("Selecione se o paciente iniciou o atendimento ou não.");
    }
    const iniciou = iniciouRadio.value;

    // --- FLUXO: SIM (Iniciou Atendimento - Equivalente a Novas Sessões) ---
    if (iniciou === "sim") {
      const formContinuacao = document
        .getElementById("form-continuacao-pb")
        ?.querySelector("#solicitar-sessoes-form");
      if (!formContinuacao)
        throw new Error(
          "Erro interno: Formulário de agendamento (Novas Sessões) não encontrado."
        );
      if (!formContinuacao.checkValidity()) {
        formContinuacao.reportValidity();
        throw new Error(
          "Preencha todos os campos obrigatórios (*) do agendamento."
        );
      }
      const horarioSessaoData = {
        responsavelId: userUid,
        responsavelNome: userData.nome,
        diaSemana:
          formContinuacao.querySelector("#solicitar-dia-semana")?.value || null,
        horario:
          formContinuacao.querySelector("#solicitar-horario")?.value || null,
        tipoAtendimento:
          formContinuacao.querySelector("#solicitar-tipo-atendimento")?.value ||
          null,
        frequencia:
          formContinuacao.querySelector("#solicitar-frequencia")?.value || null,
        salaAtendimento:
          formContinuacao.querySelector("#solicitar-sala")?.value || null,
        dataInicio:
          formContinuacao.querySelector("#solicitar-data-inicio")?.value ||
          null,
        alterarGrade: "Sim",
        observacoes: "",
        definidoEm: Timestamp.now(),
      };
      const docSnap = await getDoc(docRefPaciente);
      if (!docSnap.exists())
        throw new Error("Paciente não encontrado no banco de dados!");
      const dadosDoPaciente = docSnap.data();
      const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])];
      const indiceDoAtendimento = atendimentos.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );
      if (indiceDoAtendimento === -1)
        throw new Error(
          "Atendimento PB específico não encontrado para este paciente!"
        );
      atendimentos[indiceDoAtendimento].horarioSessoes = horarioSessaoData;
      atendimentos[indiceDoAtendimento].statusAtendimento =
        "horarios_informados";
      const dadosParaAtualizarTrilha = {
        atendimentosPB: atendimentos,
        status: "cadastrar_horario_psicomanager",
        lastUpdate: serverTimestamp(),
      };
      await updateDoc(docRefPaciente, dadosParaAtualizarTrilha);
      const solicitacaoData = {
        tipo: "novas_sessoes",
        status: "Pendente",
        dataSolicitacao: serverTimestamp(),
        solicitanteId: userUid,
        solicitanteNome: userData.nome,
        pacienteId: pacienteId,
        pacienteNome: dadosDoPaciente.nomeCompleto,
        atendimentoId: atendimentoId,
        detalhes: {
          diaSemana: horarioSessaoData.diaSemana,
          horario: horarioSessaoData.horario,
          modalidade: horarioSessaoData.tipoAtendimento?.replace(/^./, (c) =>
            c.toUpperCase()
          ),
          frequencia: horarioSessaoData.frequencia,
          sala: horarioSessaoData.salaAtendimento,
          dataInicioPreferencial: horarioSessaoData.dataInicio,
          alterarGradeSolicitado: horarioSessaoData.alterarGrade,
        },
        adminFeedback: null,
      };
      await addDoc(collection(db, "solicitacoes"), solicitacaoData);
      console.log(
        "Solicitação 'novas_sessoes' (para cadastro) criada via Horários PB.",
        solicitacaoData.detalhes
      );

      // --- FLUXO: NÃO (Não iniciou atendimento) ---
    } else if (iniciou === "nao") {
      if (!motivoNaoInicioRadio) {
        formularioPrincipal
          .querySelector('input[name="motivo-nao-inicio"]')
          ?.focus();
        throw new Error(
          "Selecione o motivo pelo qual o atendimento não foi iniciado."
        );
      }
      const motivoNaoInicio = motivoNaoInicioRadio.value;

      // --- Sub-fluxo: NÃO -> DESISTIU ---
      if (motivoNaoInicio === "desistiu") {
        const motivoDescricaoInput = formularioPrincipal.querySelector(
          "#motivo-desistencia-pb"
        );
        const motivoDescricao = motivoDescricaoInput?.value.trim() || "";
        if (!motivoDescricao) {
          motivoDescricaoInput?.focus();
          motivoDescricaoInput?.reportValidity();
          throw new Error("Descreva o motivo da desistência antes do início.");
        }
        const dataDesistencia = new Date();
        const docSnap = await getDoc(docRefPaciente);
        if (!docSnap.exists()) throw new Error("Paciente não encontrado!");
        const dadosDoPaciente = docSnap.data();
        const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])];
        const indiceDoAtendimento = atendimentos.findIndex(
          (at) => at.atendimentoId === atendimentoId
        );
        if (indiceDoAtendimento === -1)
          throw new Error("Atendimento PB específico não encontrado!");
        atendimentos[indiceDoAtendimento].statusAtendimento =
          "desistencia_antes_inicio";
        atendimentos[indiceDoAtendimento].motivoNaoInicio = motivoDescricao;
        atendimentos[indiceDoAtendimento].naoIniciouEm =
          Timestamp.fromDate(dataDesistencia);
        const dadosParaAtualizarTrilha = {
          atendimentosPB: atendimentos,
          status: "desistencia",
          lastUpdate: serverTimestamp(),
        };
        await updateDoc(docRefPaciente, dadosParaAtualizarTrilha);
        console.log("Paciente marcado como desistência antes do início do PB.");
        await excluirSessoesFuturas(pacienteId, atendimentoId, dataDesistencia);

        // --- Sub-fluxo: NÃO -> OUTRA MODALIDADE/HORÁRIO ---
      } else if (motivoNaoInicio === "outra_modalidade") {
        const formAlteracao = document
          .getElementById("form-alteracao-pb")
          ?.querySelector("#alterar-horario-form");
        if (!formAlteracao)
          throw new Error(
            "Erro interno: Formulário de alteração de horário não encontrado."
          );
        if (!formAlteracao.checkValidity()) {
          formAlteracao.reportValidity();
          throw new Error(
            "Preencha todos os campos obrigatórios (*) da nova configuração desejada."
          );
        }
        const dadosNovos = {
          dia:
            formAlteracao.querySelector("#alterar-dia-semana")?.value || null,
          horario:
            formAlteracao.querySelector("#alterar-horario")?.value || null,
          modalidade:
            formAlteracao.querySelector("#alterar-tipo-atendimento")?.value ||
            null,
          frequencia:
            formAlteracao.querySelector("#alterar-frequencia")?.value || null,
          sala: formAlteracao.querySelector("#alterar-sala")?.value || null,
          dataInicio:
            formAlteracao.querySelector("#alterar-data-inicio")?.value || null,
          alterarGrade:
            formAlteracao.querySelector("#alterar-grade")?.value || null,
        };
        const justificativa =
          formAlteracao.querySelector("#alterar-justificativa")?.value.trim() ||
          "Solicitado antes do início do atendimento devido a preferência por outro horário/modalidade.";
        const docSnap = await getDoc(docRefPaciente);
        if (!docSnap.exists()) throw new Error("Paciente não encontrado!");
        const dadosDoPaciente = docSnap.data();
        const atendimentoAtual = dadosDoPaciente.atendimentosPB?.find(
          (at) => at.atendimentoId === atendimentoId
        );
        const horarioAntigo = atendimentoAtual?.horarioSessoes || {};
        const dadosAntigos = {
          dia: horarioAntigo.diaSemana || "N/A",
          horario: horarioAntigo.horario || "N/A",
          modalidade: horarioAntigo.tipoAtendimento || "N/A",
          sala: horarioAntigo.salaAtendimento || "N/A",
          frequencia: horarioAntigo.frequencia || "N/A",
        };
        const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])];
        const indiceDoAtendimento = atendimentos.findIndex(
          (at) => at.atendimentoId === atendimentoId
        );
        if (indiceDoAtendimento === -1)
          throw new Error("Atendimento PB específico não encontrado!");
        atendimentos[indiceDoAtendimento].statusAtendimento =
          "solicitado_reencaminhamento";
        atendimentos[indiceDoAtendimento].motivoNaoInicio = "outra_modalidade";
        atendimentos[indiceDoAtendimento].solicitacaoAlteracaoPendente = {
          ...dadosNovos,
          justificativa: justificativa,
          dataSolicitacao: Timestamp.now(),
        };
        atendimentos[indiceDoAtendimento].naoIniciouEm = Timestamp.now();
        const dadosParaAtualizarTrilha = {
          atendimentosPB: atendimentos,
          status: "reavaliar_encaminhamento",
          lastUpdate: serverTimestamp(),
        };
        await updateDoc(docRefPaciente, dadosParaAtualizarTrilha);
        const solicitacaoData = {
          tipo: "alteracao_horario",
          status: "Pendente",
          dataSolicitacao: serverTimestamp(),
          solicitanteId: userUid,
          solicitanteNome: userData.nome,
          pacienteId: pacienteId,
          pacienteNome: dadosDoPaciente.nomeCompleto,
          atendimentoId: atendimentoId,
          detalhes: {
            dadosAntigos: dadosAntigos,
            dadosNovos: dadosNovos,
            justificativa: justificativa,
          },
          adminFeedback: null,
        };
        await addDoc(collection(db, "solicitacoes"), solicitacaoData);
        console.log(
          "Solicitação 'alteracao_horario' criada via Horários PB (Não iniciou -> Outra).",
          solicitacaoData.detalhes
        );
      } else {
        throw new Error(
          `Motivo de não início inválido ou não tratado: ${motivoNaoInicio}`
        );
      }
    } else {
      throw new Error(`Valor inválido para 'iniciou-pb': ${iniciou}`);
    }

    // --- Finalização Comum (Sucesso) ---
    alert("Informações salvas com sucesso!");
    modal.style.display = "none";

    // Recarrega os dados e atualiza a UI
    await carregador.carregarDadosPaciente(pacienteId);
    await carregador.carregarSessoes();
    interfaceUI.preencherFormularios();
    interfaceUI.renderizarSessoes();
    interfaceUI.renderizarPendencias();
    interfaceUI.atualizarVisibilidadeBotoesAcao(
      estado.pacienteDataGlobal?.status || "desconhecido"
    );
  } catch (error) {
    console.error(
      "Erro detalhado ao salvar informações de Horários PB:",
      error
    );
    let errorMsg = error instanceof Error ? error.message : String(error);
    if (!errorMsg.includes("obrigatórios") && !errorMsg.includes("Selecione")) {
      errorMsg = `Erro ao salvar: ${errorMsg}`;
    }
    alert(errorMsg);
  } finally {
    if (botaoSalvar) {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar";
    }
  }
}

// --- Função Auxiliar: Excluir Sessões Futuras ---

/**
 * Exclui todas as sessões futuras (após dataReferencia) associadas a um atendimento específico.
 * @param {string} pacienteId - ID do paciente.
 * @param {string} atendimentoId - ID do atendimento PB específico.
 * @param {Date} dataReferencia - Data a partir da qual as sessões devem ser excluídas.
 */
async function excluirSessoesFuturas(
  pacienteId,
  atendimentoId,
  dataReferencia
) {
  console.log(
    `Iniciando exclusão de sessões futuras para Atendimento ID: ${atendimentoId} após ${dataReferencia.toISOString()}`
  );
  const sessoesRef = collection(db, "trilhaPaciente", pacienteId, "sessoes");
  const timestampReferencia = Timestamp.fromDate(dataReferencia);

  const q = query(
    sessoesRef,
    where("atendimentoId", "==", atendimentoId),
    where("dataHora", ">", timestampReferencia)
  );

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.log(
        "Nenhuma sessão futura encontrada para excluir para este atendimento."
      );
      return;
    }

    const batch = writeBatch(db);
    let count = 0;
    querySnapshot.forEach((doc) => {
      console.log(
        `Marcando sessão ${doc.id} (${
          doc.data().dataHora?.toDate()?.toLocaleString("pt-BR") ||
          "Data inválida"
        }) para exclusão.`
      );
      batch.delete(doc.ref);
      count++;
    });

    await batch.commit();
    console.log(
      `${count} sessões futuras excluídas com sucesso para o atendimento ${atendimentoId}.`
    );
  } catch (error) {
    console.error(
      `Erro ao excluir sessões futuras para o atendimento ${atendimentoId}:`,
      error
    );
    alert(
      `Atenção: Ocorreu um erro ao tentar excluir automaticamente as sessões futuras agendadas para este atendimento (${error.message}). Por favor, verifique e remova manualmente se necessário.`
    );
  }
}
