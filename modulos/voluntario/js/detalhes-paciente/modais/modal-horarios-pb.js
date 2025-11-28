// Arquivo: /modulos/voluntario/js/detalhes-paciente/modais/modal-horarios-pb.js
// Versão: Corrigida (HTML injetado via JS para eliminar erro de fetch)

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

  // Limpa o conteúdo dos containers dinâmicos
  formContinuacaoContainer.innerHTML = "";
  formAlteracaoContainer.innerHTML = "";

  // Limpa campo de texto de motivo de desistência (se existir) de forma segura
  const motivoDesistenciaInput = motivoDesistenciaContainer.querySelector(
    "#motivo-desistencia-pb"
  );
  if (motivoDesistenciaInput) {
    motivoDesistenciaInput.value = ""; // Limpa campo de texto
  }

  // Limpa 'required' de todos os elementos
  form.querySelectorAll("[required]").forEach((el) => (el.required = false));
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
  const radiosIniciouOriginais = form.querySelectorAll(
    'input[name="iniciou-pb"]'
  );
  radiosIniciouOriginais.forEach((radio) => {
    const clone = radio.cloneNode(true);
    clone.required = true;
    radio.parentNode.replaceChild(clone, radio);
    clone.addEventListener("change", listenerIniciouPbChange);
  });

  const radiosMotivoOriginais = form.querySelectorAll(
    'input[name="motivo-nao-inicio"]'
  );
  radiosMotivoOriginais.forEach((radio) => {
    const clone = radio.cloneNode(true);
    radio.parentNode.replaceChild(clone, radio);
    clone.addEventListener("change", listenerMotivoNaoInicioChange);
  });

  modal.style.display = "flex";
}

// --- Funções Listener (Internas do Módulo) ---

/** Listener para mudanças no radio 'iniciou-pb' */
async function listenerIniciouPbChange(event) {
  const radio = event.target;
  const formPrincipal = radio.closest("form");
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

  // Reset geral das seções condicionais
  [
    formContinuacaoContainer,
    motivoNaoInicioContainer,
    motivoDesistenciaContainer,
    formAlteracaoContainer,
    feedbackGradeDiv,
  ].forEach((el) => {
    if (el) el.style.display = "none";
  });

  formContinuacaoContainer.innerHTML = "";
  formAlteracaoContainer.innerHTML = "";

  // Limpa requireds
  formPrincipal
    .querySelectorAll(
      "#motivo-nao-inicio-pb-container [required], #motivo-desistencia-container [required], #form-continuacao-pb [required], #form-alteracao-pb [required]"
    )
    .forEach((el) => (el.required = false));

  if (radio.value === "sim" && radio.checked) {
    // CASO SIM: Mostra formulário de Novas Sessões (Construído via JS)
    formContinuacaoContainer.style.display = "block";

    // Injeta o HTML diretamente
    formContinuacaoContainer.innerHTML = getHtmlNovasSessoes();

    // Configura a lógica
    const atendimentoId = formPrincipal.querySelector(
      "#atendimento-id-horarios-modal"
    )?.value;
    const atendimentoAtual = estado.pacienteDataGlobal?.atendimentosPB?.find(
      (at) => at.atendimentoId === atendimentoId
    );
    setupFormLogicNovasSessoes(formContinuacaoContainer, atendimentoAtual);
  } else if (radio.value === "nao" && radio.checked) {
    // CASO NÃO: Mostra opções de motivo
    motivoNaoInicioContainer.style.display = "block";
    formPrincipal
      .querySelectorAll('input[name="motivo-nao-inicio"]')
      .forEach((r) => {
        r.checked = false;
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

  // Reset das seções específicas do 'Não'
  [
    motivoDesistenciaContainer,
    formAlteracaoContainer,
    feedbackGradeDiv,
  ].forEach((el) => {
    if (el) el.style.display = "none";
  });

  formAlteracaoContainer.innerHTML = "";
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

    // Injeta HTML diretamente para Alteração
    formAlteracaoContainer.innerHTML = getHtmlAlteracaoHorario();

    // Configura a lógica
    const atendimentoId = formPrincipal.querySelector(
      "#atendimento-id-horarios-modal"
    )?.value;
    const atendimentoAtual = estado.pacienteDataGlobal?.atendimentosPB?.find(
      (at) => at.atendimentoId === atendimentoId
    );
    setupFormLogicAlterarHorario(formAlteracaoContainer, atendimentoAtual);
  }
}

// --- Templates HTML (Substituem os arquivos externos) ---

function getHtmlNovasSessoes() {
  return `
        <div id="solicitar-sessoes-form">
            <h4 style="color: var(--cor-primaria); margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Configuração do Atendimento</h4>
            <div class="form-grid cols-2"> 
                <div class="form-group">
                    <label for="solicitar-dia-semana">Dia da Sessão*</label>
                    <select id="solicitar-dia-semana" class="form-control" required>
                        <option value="">Selecione...</option> <option value="Segunda-feira">Segunda-feira</option>
                        <option value="Terça-feira">Terça-feira</option>
                        <option value="Quarta-feira">Quarta-feira</option>
                        <option value="Quinta-feira">Quinta-feira</option>
                        <option value="Sexta-feira">Sexta-feira</option>
                        <option value="Sábado">Sábado</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="solicitar-horario">Horário*</label>
                    <select id="solicitar-horario" class="form-control" required></select>
                </div>
            </div>
            <div class="form-grid cols-2">
                <div class="form-group">
                    <label for="solicitar-tipo-atendimento">Tipo de Atendimento*</label>
                    <select id="solicitar-tipo-atendimento" class="form-control" required>
                        <option value="">Selecione...</option> <option value="online">Online</option>
                        <option value="presencial">Presencial</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="solicitar-sala">Sala de Atendimento*</label>
                    <select id="solicitar-sala" class="form-control" required>
                        <option value="Online">Online</option>
                    </select>
                </div>
            </div>
            <div class="form-grid cols-2">
                <div class="form-group">
                    <label for="solicitar-frequencia">Frequência*</label>
                    <select id="solicitar-frequencia" class="form-control" required>
                        <option value="">Selecione...</option>
                        <option value="Semanal">Semanal</option>
                        <option value="Quinzenal">Quinzenal</option>
                        <option value="Mensal">Mensal</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="solicitar-data-inicio">Data de Início*</label>
                    <input type="date" id="solicitar-data-inicio" class="form-control" required>
                </div>
            </div>
            <input type="hidden" id="alterar-grade-pb" value="Sim"> </div>
    `;
}

function getHtmlAlteracaoHorario() {
  return `
        <div id="alterar-horario-form">
            <h4 style="color: var(--cor-primaria); margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Nova Preferência de Horário</h4>
            <div class="form-grid cols-2">
                <div class="form-group">
                    <label>Dia Atual</label>
                    <input type="text" id="alterar-dia-atual" class="form-control" readonly>
                </div>
                <div class="form-group">
                    <label>Horário Atual</label>
                    <input type="text" id="alterar-horario-atual" class="form-control" readonly>
                </div>
            </div>

            <div class="form-grid cols-2"> 
                <div class="form-group">
                    <label for="alterar-dia-semana">Novo Dia*</label>
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
                    <label for="alterar-horario">Novo Horário*</label>
                    <select id="alterar-horario" class="form-control" required></select>
                </div>
            </div>
            <div class="form-grid cols-2">
                <div class="form-group">
                    <label for="alterar-tipo-atendimento">Novo Tipo*</label>
                    <select id="alterar-tipo-atendimento" class="form-control" required>
                        <option value="">Selecione...</option>
                        <option value="Online">Online</option>
                        <option value="Presencial">Presencial</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="alterar-sala">Nova Sala*</label>
                    <select id="alterar-sala" class="form-control" required>
                        <option value="Online">Online</option>
                    </select>
                </div>
            </div>
             <div class="form-grid cols-2">
                <div class="form-group">
                    <label for="alterar-frequencia">Frequência*</label>
                    <select id="alterar-frequencia" class="form-control" required>
                        <option value="">Selecione...</option>
                        <option value="Semanal">Semanal</option>
                        <option value="Quinzenal">Quinzenal</option>
                        <option value="Mensal">Mensal</option>
                    </select>
                </div>
                 <div class="form-group">
                    <label for="alterar-data-inicio">A partir de*</label>
                    <input type="date" id="alterar-data-inicio" class="form-control" required>
                </div>
            </div>
             <div class="form-group">
                <label for="alterar-grade">Alterar na grade?*</label>
                <select id="alterar-grade" class="form-control" required>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                </select>
            </div>
            <div class="form-group">
                <label for="alterar-justificativa">Justificativa:</label>
                <textarea id="alterar-justificativa" rows="2" class="form-control"></textarea>
            </div>
        </div>
    `;
}

// --- Funções Auxiliares para Configurar Forms ---

function setupFormLogicNovasSessoes(container, atendimentoAtivo) {
  const form = container.querySelector("#solicitar-sessoes-form");

  // Popula Horários
  const horarioSelect = form.querySelector("#solicitar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 7; i <= 21; i++) {
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
      if (i < 21) {
        // Meia hora
        const hora30 = `${String(i).padStart(2, "0")}:30`;
        horarioSelect.innerHTML += `<option value="${hora30}">${hora30}</option>`;
      }
    }
  }

  // Popula Salas
  const salaSelect = form.querySelector("#solicitar-sala");
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="Online">Online</option>';
    estado.salasPresenciaisGlobal.forEach((sala) => {
      if (sala && sala !== "Online") {
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  }

  // Lógica Tipo -> Sala
  const tipoAtendimentoSelect = form.querySelector(
    "#solicitar-tipo-atendimento"
  );
  const ajustarSala = () => {
    const tipo = tipoAtendimentoSelect?.value;
    const isOnline = tipo === "online";
    if (salaSelect) {
      salaSelect.disabled = isOnline;
      salaSelect.required = !isOnline;
      if (isOnline) salaSelect.value = "Online";
      else if (salaSelect.value === "Online") salaSelect.value = "";
    }
    validarHorarioNaGrade(form);
  };

  [
    "solicitar-dia-semana",
    "solicitar-horario",
    "solicitar-tipo-atendimento",
    "solicitar-sala",
  ].forEach((id) => {
    const element = form.querySelector(`#${id}`);
    if (element) element.addEventListener("change", ajustarSala);
  });

  ajustarSala();
}

function setupFormLogicAlterarHorario(container, atendimentoAtivo) {
  const form = container.querySelector("#alterar-horario-form");

  // Preenche dados atuais
  const horarioAtual = atendimentoAtivo?.horarioSessoes || {};
  const diaAtualEl = form.querySelector("#alterar-dia-atual");
  if (diaAtualEl) diaAtualEl.value = horarioAtual.diaSemana || "N/A";
  const horaAtualEl = form.querySelector("#alterar-horario-atual");
  if (horaAtualEl) horaAtualEl.value = horarioAtual.horario || "N/A";

  // Popula Horários
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

  // Popula Salas
  const salaSelect = form.querySelector("#alterar-sala");
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="Online">Online</option>';
    estado.salasPresenciaisGlobal.forEach((sala) => {
      if (sala && sala !== "Online") {
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  }

  // Lógica Tipo -> Sala
  const tipoAtendimentoSelect = form.querySelector("#alterar-tipo-atendimento");
  const ajustarSala = () => {
    const tipo = tipoAtendimentoSelect?.value;
    const isOnline = tipo === "Online";
    if (salaSelect) {
      salaSelect.disabled = isOnline;
      salaSelect.required = !isOnline;
      if (isOnline) salaSelect.value = "Online";
      else if (salaSelect.value === "Online") salaSelect.value = "";
    }
  };

  if (tipoAtendimentoSelect) {
    tipoAtendimentoSelect.addEventListener("change", ajustarSala);
  }
  ajustarSala();
}

// --- Função para validar horário na grade ---

function validarHorarioNaGrade(formContext) {
  const feedbackDiv = document.getElementById("validacao-grade-feedback");
  if (!feedbackDiv) return;

  feedbackDiv.style.display = "none";
  feedbackDiv.className = "info-note";
  feedbackDiv.innerHTML = "";

  if (!formContext) return;

  const diaEl = formContext.querySelector("#solicitar-dia-semana");
  const horarioEl = formContext.querySelector("#solicitar-horario");
  const tipoEl = formContext.querySelector("#solicitar-tipo-atendimento");
  const salaEl = formContext.querySelector("#solicitar-sala");

  if (!diaEl || !horarioEl || !tipoEl || !salaEl) return;

  const dia = diaEl.value;
  const horarioCompleto = horarioEl.value;
  const tipo = tipoEl.value;
  const sala = salaEl.value;
  const horaKey = horarioCompleto ? horarioCompleto.replace(":", "-") : null;

  if (!dia || !horaKey || !tipo || (tipo === "presencial" && !sala)) return;

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

export async function handleHorariosPbSubmit(evento, userUid, userData) {
  evento.preventDefault();
  const formularioPrincipal = evento.target;
  const modal = formularioPrincipal.closest(".modal-overlay");
  const botaoSalvar = modal?.querySelector('button[type="submit"]');

  if (!formularioPrincipal || !modal || !botaoSalvar || !userUid || !userData) {
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
    alert("Erro: Inconsistência nos IDs do formulário.");
    botaoSalvar.disabled = false;
    botaoSalvar.textContent = "Salvar";
    return;
  }

  const docRefPaciente = doc(db, "trilhaPaciente", pacienteId);

  try {
    const iniciouRadio = formularioPrincipal.querySelector(
      'input[name="iniciou-pb"]:checked'
    );
    if (!iniciouRadio)
      throw new Error("Selecione se o paciente iniciou o atendimento ou não.");

    const iniciou = iniciouRadio.value;

    // --- FLUXO SIM (Iniciou) ---
    if (iniciou === "sim") {
      const formContinuacao = document
        .getElementById("form-continuacao-pb")
        ?.querySelector("#solicitar-sessoes-form"); // Form injetado
      if (!formContinuacao)
        throw new Error(
          "Erro interno: Formulário de agendamento não encontrado."
        );

      // Validação manual pois o form é uma div wrapper
      const dia = formContinuacao.querySelector("#solicitar-dia-semana").value;
      const hora = formContinuacao.querySelector("#solicitar-horario").value;
      const tipo = formContinuacao.querySelector(
        "#solicitar-tipo-atendimento"
      ).value;
      const freq = formContinuacao.querySelector("#solicitar-frequencia").value;
      const sala = formContinuacao.querySelector("#solicitar-sala").value;
      const inicio = formContinuacao.querySelector(
        "#solicitar-data-inicio"
      ).value;

      if (!dia || !hora || !tipo || !freq || !sala || !inicio) {
        throw new Error(
          "Preencha todos os campos obrigatórios do agendamento."
        );
      }

      const horarioSessaoData = {
        responsavelId: userUid,
        responsavelNome: userData.nome,
        diaSemana: dia,
        horario: hora,
        tipoAtendimento: tipo,
        frequencia: freq,
        salaAtendimento: sala,
        dataInicio: inicio,
        alterarGrade: "Sim",
        observacoes: "",
        definidoEm: Timestamp.now(),
      };

      const docSnap = await getDoc(docRefPaciente);
      if (!docSnap.exists()) throw new Error("Paciente não encontrado!");
      const dadosDoPaciente = docSnap.data();
      const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])];
      const idx = atendimentos.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );

      if (idx === -1)
        throw new Error("Atendimento PB específico não encontrado!");

      atendimentos[idx].horarioSessoes = horarioSessaoData;
      atendimentos[idx].statusAtendimento = "horarios_informados";

      await updateDoc(docRefPaciente, {
        atendimentosPB: atendimentos,
        status: "cadastrar_horario_psicomanager",
        lastUpdate: serverTimestamp(),
      });

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

      // --- FLUXO NÃO (Não Iniciou) ---
    } else if (iniciou === "nao") {
      const motivoRadio = formularioPrincipal.querySelector(
        'input[name="motivo-nao-inicio"]:checked'
      );
      if (!motivoRadio)
        throw new Error(
          "Selecione o motivo pelo qual o atendimento não foi iniciado."
        );
      const motivo = motivoRadio.value;

      const docSnap = await getDoc(docRefPaciente);
      if (!docSnap.exists()) throw new Error("Paciente não encontrado!");
      const dadosDoPaciente = docSnap.data();
      const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])];
      const idx = atendimentos.findIndex(
        (at) => at.atendimentoId === atendimentoId
      );
      if (idx === -1) throw new Error("Atendimento PB não encontrado!");

      if (motivo === "desistiu") {
        const desc = formularioPrincipal
          .querySelector("#motivo-desistencia-pb")
          .value.trim();
        if (!desc) throw new Error("Descreva o motivo da desistência.");

        atendimentos[idx].statusAtendimento = "desistencia_antes_inicio";
        atendimentos[idx].motivoNaoInicio = desc;
        atendimentos[idx].naoIniciouEm = Timestamp.now();

        await updateDoc(docRefPaciente, {
          atendimentosPB: atendimentos,
          status: "desistencia",
          lastUpdate: serverTimestamp(),
        });
        await excluirSessoesFuturas(pacienteId, atendimentoId, new Date());
      } else if (motivo === "outra_modalidade") {
        const formAlteracao = document
          .getElementById("form-alteracao-pb")
          ?.querySelector("#alterar-horario-form");
        if (!formAlteracao)
          throw new Error("Erro interno: Form alteração não encontrado.");

        // Validação manual
        const dia = formAlteracao.querySelector("#alterar-dia-semana").value;
        const hora = formAlteracao.querySelector("#alterar-horario").value;
        const tipo = formAlteracao.querySelector(
          "#alterar-tipo-atendimento"
        ).value;
        const freq = formAlteracao.querySelector("#alterar-frequencia").value;
        const sala = formAlteracao.querySelector("#alterar-sala").value;
        const inicio = formAlteracao.querySelector(
          "#alterar-data-inicio"
        ).value;
        const grade = formAlteracao.querySelector("#alterar-grade").value;

        if (!dia || !hora || !tipo || !freq || !sala || !inicio || !grade) {
          throw new Error("Preencha todos os campos da nova configuração.");
        }

        const dadosNovos = {
          dia,
          horario: hora,
          modalidade: tipo,
          frequencia: freq,
          sala,
          dataInicio: inicio,
          alterarGrade: grade,
        };
        const justificativa =
          formAlteracao.querySelector("#alterar-justificativa")?.value.trim() ||
          "Preferência por outro horário.";

        atendimentos[idx].statusAtendimento = "solicitado_reencaminhamento";
        atendimentos[idx].motivoNaoInicio = "outra_modalidade";
        atendimentos[idx].solicitacaoAlteracaoPendente = {
          ...dadosNovos,
          justificativa,
          dataSolicitacao: Timestamp.now(),
        };
        atendimentos[idx].naoIniciouEm = Timestamp.now();

        await updateDoc(docRefPaciente, {
          atendimentosPB: atendimentos,
          status: "reavaliar_encaminhamento",
          lastUpdate: serverTimestamp(),
        });

        // Dados antigos (vazio pois não iniciou)
        const dadosAntigos = {
          dia: "N/A",
          horario: "N/A",
          modalidade: "N/A",
          sala: "N/A",
          frequencia: "N/A",
        };

        const solicitacaoData = {
          tipo: "alteracao_horario",
          status: "Pendente",
          dataSolicitacao: serverTimestamp(),
          solicitanteId: userUid,
          solicitanteNome: userData.nome,
          pacienteId: pacienteId,
          pacienteNome: dadosDoPaciente.nomeCompleto,
          atendimentoId: atendimentoId,
          detalhes: { dadosAntigos, dadosNovos, justificativa },
          adminFeedback: null,
        };
        await addDoc(collection(db, "solicitacoes"), solicitacaoData);
      }
    }

    alert("Informações salvas com sucesso!");
    modal.style.display = "none";

    // Atualiza UI
    await carregador.carregarDadosPaciente(pacienteId);
    await carregador.carregarSessoes();
    interfaceUI.preencherFormularios();
    interfaceUI.renderizarSessoes();
    interfaceUI.renderizarPendencias();
    interfaceUI.atualizarVisibilidadeBotoesAcao(
      estado.pacienteDataGlobal?.status
    );
  } catch (error) {
    console.error("Erro detalhado:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    if (botaoSalvar) {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar";
    }
  }
}

async function excluirSessoesFuturas(
  pacienteId,
  atendimentoId,
  dataReferencia
) {
  // Mesma lógica do arquivo original
  const sessoesRef = collection(db, "trilhaPaciente", pacienteId, "sessoes");
  const timestampReferencia = Timestamp.fromDate(dataReferencia);
  const q = query(
    sessoesRef,
    where("atendimentoId", "==", atendimentoId),
    where("dataHora", ">", timestampReferencia)
  );
  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return;
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (error) {
    console.error("Erro ao excluir sessões futuras:", error);
  }
}
