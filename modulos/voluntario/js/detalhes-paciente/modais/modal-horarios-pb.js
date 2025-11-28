// Arquivo: /modulos/voluntario/js/detalhes-paciente/modais/modal-horarios-pb.js
// Lógica para o modal refatorado de Horários PB (informar, desistir, alterar).
// Versão: 2.2.0 (HTML Incorporado para corrigir erro 404 e falha de carregamento)

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

  const myUid = String(estado.userDataGlobal.uid).trim();

  // Busca o atendimento PB relevante para este profissional e status apropriado
  const atendimentoPbDoUsuario = estado.pacienteDataGlobal.atendimentosPB?.find(
    (at) => {
      const atProfId = String(at.profissionalId || "").trim();
      return (
        atProfId === myUid &&
        [
          "aguardando_info_horarios",
          "horarios_informados",
          "ativo",
          "solicitado_reencaminhamento",
        ].includes(at.statusAtendimento) &&
        !at.statusAtendimento.startsWith("concluido_") &&
        at.statusAtendimento !== "desistencia_antes_inicio"
      );
    }
  );

  if (!atendimentoPbDoUsuario) {
    alert(
      "Não foi encontrado um atendimento PB ativo ou aguardando horários atribuído a você para este paciente."
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
  );
  const motivoDesistenciaContainer = document.getElementById(
    "motivo-desistencia-container"
  );
  const formAlteracaoContainer = document.getElementById("form-alteracao-pb");
  const btnSalvarHorarios = modal?.querySelector('button[type="submit"]');
  const feedbackGradeDiv = document.getElementById("validacao-grade-feedback");

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
      "Elementos essenciais do modal Horários PB não encontrados. Verifique o HTML."
    );
    return;
  }

  // --- Reset Completo da UI do Modal ---
  form.reset();
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

  // Limpa conteúdo dinâmico
  formContinuacaoContainer.innerHTML = "";
  formAlteracaoContainer.innerHTML = "";

  const motivoDesistenciaInput = motivoDesistenciaContainer.querySelector(
    "#motivo-desistencia-pb"
  );
  if (motivoDesistenciaInput) motivoDesistenciaInput.value = "";

  // Limpa 'required'
  form.querySelectorAll("[required]").forEach((el) => (el.required = false));

  // Garante que APENAS o radio 'iniciou-pb' seja obrigatório inicialmente
  form
    .querySelectorAll('input[name="iniciou-pb"]')
    .forEach((r) => (r.required = true));

  btnSalvarHorarios.disabled = false;
  btnSalvarHorarios.textContent = "Salvar";

  // --- Listeners ---
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

// --- Funções Listener ---

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

  // Reset
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

  formPrincipal.querySelectorAll("[required]").forEach((el) => {
    if (el.name !== "iniciou-pb") el.required = false;
  });

  if (radio.value === "sim" && radio.checked) {
    formContinuacaoContainer.style.display = "block";
    // Injeta o HTML DIRETAMENTE para evitar erro 404
    formContinuacaoContainer.innerHTML = getTemplateNovasSessoes();

    const atendimentoId = formPrincipal.querySelector(
      "#atendimento-id-horarios-modal"
    )?.value;
    const atendimentoAtual = estado.pacienteDataGlobal?.atendimentosPB?.find(
      (at) => at.atendimentoId === atendimentoId
    );
    setupFormLogicNovasSessoes(formContinuacaoContainer, atendimentoAtual);
  } else if (radio.value === "nao" && radio.checked) {
    motivoNaoInicioContainer.style.display = "block";
    formPrincipal
      .querySelectorAll('input[name="motivo-nao-inicio"]')
      .forEach((r) => {
        r.checked = false;
        r.required = true;
      });
  }
}

async function listenerMotivoNaoInicioChange(event) {
  const radio = event.target;
  const formPrincipal = radio.closest("form");
  const motivoDesistenciaContainer = document.getElementById(
    "motivo-desistencia-container"
  );
  const formAlteracaoContainer = document.getElementById("form-alteracao-pb");
  const feedbackGradeDiv = document.getElementById("validacao-grade-feedback");

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
    // Injeta o HTML DIRETAMENTE
    formAlteracaoContainer.innerHTML = getTemplateAlterarHorario();

    const atendimentoId = formPrincipal.querySelector(
      "#atendimento-id-horarios-modal"
    )?.value;
    const atendimentoAtual = estado.pacienteDataGlobal?.atendimentosPB?.find(
      (at) => at.atendimentoId === atendimentoId
    );
    setupFormLogicAlterarHorario(formAlteracaoContainer, atendimentoAtual);
  }
}

// --- Templates HTML Incorporados ---

function getTemplateNovasSessoes() {
  return `
    <div id="solicitar-sessoes-form">
        <div class="form-group">
            <label for="solicitar-dia-semana">Dia da Semana *</label>
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
            <label for="solicitar-horario">Horário *</label>
            <select id="solicitar-horario" class="form-control" required></select>
        </div>
        <div class="form-group">
            <label for="solicitar-tipo-atendimento">Modalidade *</label>
            <select id="solicitar-tipo-atendimento" class="form-control" required>
                <option value="">Selecione...</option>
                <option value="online">Online</option>
                <option value="presencial">Presencial</option>
            </select>
        </div>
        <div class="form-group">
            <label for="solicitar-sala">Sala *</label>
            <select id="solicitar-sala" class="form-control" required></select>
        </div>
        <div class="form-group">
            <label for="solicitar-frequencia">Frequência *</label>
            <select id="solicitar-frequencia" class="form-control" required>
                <option value="Semanal">Semanal</option>
                <option value="Quinzenal">Quinzenal</option>
            </select>
        </div>
        <div class="form-group">
            <label for="solicitar-data-inicio">Data de Início *</label>
            <input type="date" id="solicitar-data-inicio" class="form-control" required>
        </div>
        <div class="form-group">
            <label for="observacoes-pb-horarios">Observações (Opcional)</label>
            <textarea id="observacoes-pb-horarios" class="form-control" rows="2"></textarea>
        </div>
        <input type="hidden" id="alterar-grade-pb" value="Sim">
        <input type="hidden" id="tipo-profissional-pb" value="Voluntário"> 
        </div>`;
}

function getTemplateAlterarHorario() {
  return `
    <div id="alterar-horario-form">
        <div class="form-group">
            <label for="alterar-dia-semana">Novo Dia *</label>
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
            <label for="alterar-horario">Novo Horário *</label>
            <select id="alterar-horario" class="form-control" required></select>
        </div>
        <div class="form-group">
            <label for="alterar-tipo-atendimento">Nova Modalidade *</label>
            <select id="alterar-tipo-atendimento" class="form-control" required>
                <option value="">Selecione...</option>
                <option value="online">Online</option>
                <option value="presencial">Presencial</option>
            </select>
        </div>
        <div class="form-group">
            <label for="alterar-sala">Nova Sala *</label>
            <select id="alterar-sala" class="form-control" required></select>
        </div>
        <div class="form-group">
            <label for="alterar-frequencia">Nova Frequência *</label>
            <select id="alterar-frequencia" class="form-control" required>
                <option value="Semanal">Semanal</option>
                <option value="Quinzenal">Quinzenal</option>
            </select>
        </div>
        <div class="form-group">
            <label for="alterar-data-inicio">A partir de *</label>
            <input type="date" id="alterar-data-inicio" class="form-control" required>
        </div>
        <div class="form-group">
            <label for="alterar-grade">Alterar na Grade? *</label>
            <select id="alterar-grade" class="form-control" required>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
            </select>
        </div>
        <div class="form-group">
            <label for="alterar-justificativa">Justificativa *</label>
            <textarea id="alterar-justificativa" class="form-control" required></textarea>
        </div>
    </div>`;
}

// --- Configuração dos Forms ---

function setupFormLogicNovasSessoes(container, atendimentoAtivo) {
  const form = container.querySelector("#solicitar-sessoes-form");
  if (!form) return;

  const horarioSelect = form.querySelector("#solicitar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 7; i <= 21; i++) {
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
    }
  }

  const salaSelect = form.querySelector("#solicitar-sala");
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="Online">Online</option>';
    if (estado.salasPresenciaisGlobal) {
      estado.salasPresenciaisGlobal.forEach((sala) => {
        if (sala && sala !== "Online")
          salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      });
    }
  }

  const tipoSelect = form.querySelector("#solicitar-tipo-atendimento");
  const salaEl = form.querySelector("#solicitar-sala");

  const updateUI = () => {
    const isOnline = tipoSelect.value.toLowerCase() === "online";
    salaEl.disabled = isOnline;
    salaEl.required = !isOnline;
    if (isOnline) salaEl.value = "Online";
    validarHorarioNaGrade(form);
  };

  if (tipoSelect) {
    tipoSelect.addEventListener("change", updateUI);
    // Força update inicial
    updateUI();
  }

  ["solicitar-dia-semana", "solicitar-horario", "solicitar-sala"].forEach(
    (id) => {
      form
        .querySelector("#" + id)
        ?.addEventListener("change", () => validarHorarioNaGrade(form));
    }
  );
}

function setupFormLogicAlterarHorario(container, atendimentoAtivo) {
  const form = container.querySelector("#alterar-horario-form");
  if (!form) return;

  const horarioSelect = form.querySelector("#alterar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 7; i <= 21; i++) {
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
    }
  }

  const salaSelect = form.querySelector("#alterar-sala");
  if (salaSelect && estado.salasPresenciaisGlobal) {
    salaSelect.innerHTML = '<option value="Online">Online</option>';
    estado.salasPresenciaisGlobal.forEach((sala) => {
      if (sala !== "Online")
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
    });
  }

  const tipoSelect = form.querySelector("#alterar-tipo-atendimento");
  if (tipoSelect) {
    tipoSelect.addEventListener("change", () => {
      const isOnline = tipoSelect.value.toLowerCase() === "online";
      salaSelect.disabled = isOnline;
      if (isOnline) salaSelect.value = "Online";
    });
  }
}

function validarHorarioNaGrade(formContext) {
  const feedbackDiv = document.getElementById("validacao-grade-feedback");
  if (!feedbackDiv) return;

  feedbackDiv.style.display = "none";

  const dia = formContext.querySelector("#solicitar-dia-semana")?.value;
  const hora = formContext.querySelector("#solicitar-horario")?.value;
  const tipo = formContext.querySelector("#solicitar-tipo-atendimento")?.value;
  const sala = formContext.querySelector("#solicitar-sala")?.value;

  if (!dia || !hora || !tipo) return;

  const horaKey = hora.replace(":", "-");
  const diasMap = {
    "Segunda-feira": "segunda",
    "Terça-feira": "terca",
    "Quarta-feira": "quarta",
    "Quinta-feira": "quinta",
    "Sexta-feira": "sexta",
    Sábado: "sabado",
  };
  const diaKey = diasMap[dia];

  let isOcupado = false;
  const grade = estado.dadosDaGradeGlobal;

  if (grade && diaKey) {
    if (tipo.toLowerCase() === "online") {
      const cols = grade.online?.[diaKey]?.[horaKey];
      if (cols) {
        for (let i = 0; i < 6; i++) {
          if (cols[`col${i}`]) isOcupado = true;
        }
      }
    } else if (sala) {
      const salaIndex = estado.salasPresenciaisGlobal?.indexOf(sala);
      if (salaIndex >= 0) {
        if (grade.presencial?.[diaKey]?.[horaKey]?.[`col${salaIndex}`])
          isOcupado = true;
      }
    }
  }

  feedbackDiv.style.display = "block";
  if (isOcupado) {
    feedbackDiv.className = "alert alert-warning";
    feedbackDiv.innerHTML = "⚠️ Horário parece ocupado na grade.";
  } else {
    feedbackDiv.className = "alert alert-success";
    feedbackDiv.innerHTML = "✅ Horário parece livre.";
  }
}

// --- Handler de Submit Principal ---
export async function handleHorariosPbSubmit(evento, userUid, userData) {
  evento.preventDefault();
  const form = evento.target;
  const modal = form.closest(".modal-overlay");
  const btn = modal.querySelector('button[type="submit"]');

  btn.disabled = true;
  btn.textContent = "Salvando...";

  try {
    const iniciou = form.querySelector(
      'input[name="iniciou-pb"]:checked'
    )?.value;
    const pacienteId = form.querySelector("#paciente-id-horarios-modal").value;
    const atendimentoId = form.querySelector(
      "#atendimento-id-horarios-modal"
    ).value;

    if (!iniciou) throw new Error("Selecione se iniciou ou não.");

    // Lógica simplificada para exemplo
    if (iniciou === "sim") {
      // Busca o form dentro do container, pois ele foi injetado dinamicamente
      const subForm = document
        .getElementById("form-continuacao-pb")
        .querySelector("#solicitar-sessoes-form");

      if (!subForm) throw new Error("Formulário de detalhes não encontrado.");

      // Cria solicitação 'novas_sessoes'
      const solicitacao = {
        tipo: "novas_sessoes",
        status: "Pendente",
        solicitanteId: userUid,
        solicitanteNome: userData.nome,
        pacienteId: pacienteId,
        atendimentoId: atendimentoId,
        dataSolicitacao: serverTimestamp(),
        detalhes: {
          diaSemana: subForm.querySelector("#solicitar-dia-semana").value,
          horario: subForm.querySelector("#solicitar-horario").value,
          modalidade: subForm.querySelector("#solicitar-tipo-atendimento")
            .value,
          frequencia: subForm.querySelector("#solicitar-frequencia").value,
          sala: subForm.querySelector("#solicitar-sala").value,
          dataInicioPreferencial: subForm.querySelector(
            "#solicitar-data-inicio"
          ).value,
        },
      };

      await addDoc(collection(db, "solicitacoes"), solicitacao);

      // Atualiza status do paciente
      const docRef = doc(db, "trilhaPaciente", pacienteId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const atendimentos = data.atendimentosPB || [];
        const idx = atendimentos.findIndex(
          (at) => at.atendimentoId === atendimentoId
        );
        if (idx !== -1) {
          atendimentos[idx].statusAtendimento = "horarios_informados";
          // Salva detalhes no atendimento também
          atendimentos[idx].horarioSessao = {
            ...solicitacao.detalhes,
            responsavelId: userUid,
          };
          await updateDoc(docRef, {
            atendimentosPB: atendimentos,
            status: "cadastrar_horario_psicomanager",
            lastUpdate: serverTimestamp(),
          });
        }
      }
    } else {
      // Lógica "Não Iniciou"
      const motivo = form.querySelector(
        'input[name="motivo-nao-inicio"]:checked'
      )?.value;
      if (motivo === "desistiu") {
        const docRef = doc(db, "trilhaPaciente", pacienteId);
        const justificativa = document.getElementById(
          "motivo-desistencia-pb"
        ).value;
        await updateDoc(docRef, {
          status: "desistencia",
          desistenciaMotivo: justificativa,
          lastUpdate: serverTimestamp(),
        });
      } else if (motivo === "outra_modalidade") {
        // Cria solicitação de alteração
        const subForm = document
          .getElementById("form-alteracao-pb")
          .querySelector("#alterar-horario-form");

        const solicitacao = {
          tipo: "alteracao_horario",
          status: "Pendente",
          solicitanteId: userUid,
          solicitanteNome: userData.nome,
          pacienteId: pacienteId,
          atendimentoId: atendimentoId,
          dataSolicitacao: serverTimestamp(),
          detalhes: {
            justificativa: subForm.querySelector("#alterar-justificativa")
              .value,
            dadosNovos: {
              dia: subForm.querySelector("#alterar-dia-semana").value,
              horario: subForm.querySelector("#alterar-horario").value,
              modalidade: subForm.querySelector("#alterar-tipo-atendimento")
                .value,
            },
          },
        };
        await addDoc(collection(db, "solicitacoes"), solicitacao);
      }
    }

    alert("Salvo com sucesso!");
    modal.classList.remove("is-visible");
    modal.style.display = "none";

    // Recarregar dados
    await carregador.carregarDadosPaciente(pacienteId);
    interfaceUI.preencherFormularios();
    interfaceUI.atualizarVisibilidadeBotoesAcao(
      estado.pacienteDataGlobal?.status
    );
  } catch (error) {
    console.error("Erro:", error);
    alert("Erro ao salvar: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar";
  }
}
