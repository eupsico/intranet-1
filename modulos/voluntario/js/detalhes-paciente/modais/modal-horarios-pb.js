// Arquivo: /modulos/voluntario/js/detalhes-paciente/modais/modal-horarios-pb.js
// Lógica para o modal refatorado de Horários PB (informar, desistir, alterar).
// Versão: 2.1.0 (Com logs de debug e comparação de ID robusta)

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
  console.log("🔹 Tentando abrir modal Horários PB...");

  // Verifica dados essenciais
  if (!estado.pacienteDataGlobal || !estado.userDataGlobal) {
    console.error("❌ Dados globais ausentes:", {
      paciente: !!estado.pacienteDataGlobal,
      user: !!estado.userDataGlobal,
    });
    alert(
      "Dados do paciente ou do usuário não carregados. Recarregue a página."
    );
    return;
  }

  const myUid = String(estado.userDataGlobal.uid).trim();
  console.log("👤 Meu UID:", myUid);

  // Busca o atendimento PB relevante para este profissional e status apropriado
  const atendimentos = estado.pacienteDataGlobal.atendimentosPB || [];

  const atendimentoPbDoUsuario = atendimentos.find((at) => {
    // Comparação segura de IDs
    const atProfId = String(at.profissionalId || "").trim();
    const isMyUser = atProfId === myUid;

    // Verifica status permitidos
    const statusPermitidos = [
      "aguardando_info_horarios",
      "horarios_informados",
      "ativo",
      "solicitado_reencaminhamento",
    ];
    const statusOk = statusPermitidos.includes(at.statusAtendimento);

    // Logs detalhados para debug (ver no console F12 se falhar)
    if (isMyUser) {
      console.log("🔎 Analisando meu atendimento:", at);
      console.log("   - Status:", at.statusAtendimento, statusOk ? "✅" : "❌");
    }

    return (
      isMyUser &&
      statusOk &&
      !at.statusAtendimento.startsWith("concluido_") &&
      at.statusAtendimento !== "desistencia_antes_inicio"
    );
  });

  if (!atendimentoPbDoUsuario) {
    console.warn(
      "⚠️ Nenhum atendimento compatível encontrado para este usuário."
    );
    alert(
      "Não foi encontrado um atendimento PB ativo ou aguardando horários atribuído a você para este paciente."
    );
    return;
  }

  console.log("✅ Atendimento encontrado:", atendimentoPbDoUsuario);

  // Referências aos elementos do modal principal e containers dinâmicos
  const modal = document.getElementById("horarios-pb-modal");
  const form = document.getElementById("horarios-pb-form");

  if (!modal || !form) {
    console.error("❌ Modal ou form não encontrado no DOM");
    return;
  }

  const pacienteIdInput = form.querySelector("#paciente-id-horarios-modal");
  const atendimentoIdInput = form.querySelector(
    "#atendimento-id-horarios-modal"
  );

  // Referências aos containers
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
  const feedbackGradeDiv = document.getElementById("validacao-grade-feedback");
  const btnSalvarHorarios = modal.querySelector('button[type="submit"]');

  // --- Reset Completo da UI do Modal ---
  form.reset();

  if (pacienteIdInput) pacienteIdInput.value = estado.pacienteIdGlobal;
  if (atendimentoIdInput)
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
  if (formContinuacaoContainer) formContinuacaoContainer.innerHTML = "";
  if (formAlteracaoContainer) formAlteracaoContainer.innerHTML = "";

  // Limpa campo de texto de motivo de desistência
  if (motivoDesistenciaContainer) {
    const motivoInput = motivoDesistenciaContainer.querySelector(
      "#motivo-desistencia-pb"
    );
    if (motivoInput) motivoInput.value = "";
  }

  // Limpa 'required'
  form.querySelectorAll("[required]").forEach((el) => (el.required = false));

  // Garante que APENAS o radio 'iniciou-pb' seja obrigatório inicialmente
  form
    .querySelectorAll('input[name="iniciou-pb"]')
    .forEach((r) => (r.required = true));

  // Reseta estado do botão salvar
  if (btnSalvarHorarios) {
    btnSalvarHorarios.disabled = false;
    btnSalvarHorarios.textContent = "Salvar";
  }

  // --- Remove Listeners Antigos e Adiciona Novos ---
  const radiosIniciouOriginais = form.querySelectorAll(
    'input[name="iniciou-pb"]'
  );
  radiosIniciouOriginais.forEach((radio) => {
    // Clone para limpar listeners
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

  console.log("🚀 Exibindo modal...");
  modal.style.display = "flex";
  modal.classList.add("is-visible"); // Garante compatibilidade com CSS novo
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

  // Reset geral
  [
    formContinuacaoContainer,
    motivoNaoInicioContainer,
    motivoDesistenciaContainer,
    formAlteracaoContainer,
    feedbackGradeDiv,
  ].forEach((el) => {
    if (el) el.style.display = "none";
  });

  if (formContinuacaoContainer) formContinuacaoContainer.innerHTML = "";
  if (formAlteracaoContainer) formAlteracaoContainer.innerHTML = "";

  formPrincipal
    .querySelectorAll(
      "#motivo-nao-inicio-pb-container [required], #motivo-desistencia-container [required], #form-continuacao-pb [required], #form-alteracao-pb [required]"
    )
    .forEach((el) => (el.required = false));

  if (radio.value === "sim" && radio.checked) {
    if (formContinuacaoContainer) {
      formContinuacaoContainer.style.display = "block";
      formContinuacaoContainer.innerHTML =
        '<div class="loading-spinner-small" style="margin: 10px auto;"></div> Carregando formulário...';

      try {
        // Carrega o HTML do formulário de novas sessões
        // IMPORTANTE: O arquivo deve existir em voluntario/page/
        const response = await fetch("./modal-content-novas-sessoes.html");

        if (!response.ok) {
          // FALLBACK: Se o arquivo externo não existir, injeta o HTML diretamente (para evitar erro 404)
          console.warn("HTML externo não encontrado, usando template interno.");
          formContinuacaoContainer.innerHTML = getTemplateNovasSessoes();
        } else {
          formContinuacaoContainer.innerHTML = await response.text();
        }

        // Configura a lógica JS
        const atendimentoId = formPrincipal.querySelector(
          "#atendimento-id-horarios-modal"
        )?.value;
        const atendimentoAtual =
          estado.pacienteDataGlobal?.atendimentosPB?.find(
            (at) => at.atendimentoId === atendimentoId
          );
        setupFormLogicNovasSessoes(formContinuacaoContainer, atendimentoAtual);
      } catch (error) {
        console.error("Erro ao carregar form Novas Sessões:", error);
        formContinuacaoContainer.innerHTML = `<p class="alert alert-error">Erro ao carregar formulário: ${error.message}</p>`;
      }
    }
  } else if (radio.value === "nao" && radio.checked) {
    if (motivoNaoInicioContainer) {
      motivoNaoInicioContainer.style.display = "block";
      formPrincipal
        .querySelectorAll('input[name="motivo-nao-inicio"]')
        .forEach((r) => {
          r.checked = false;
          r.required = true;
        });
    }
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

  if (motivoDesistenciaContainer)
    motivoDesistenciaContainer.style.display = "none";
  if (formAlteracaoContainer) formAlteracaoContainer.style.display = "none";

  if (radio.value === "desistiu" && radio.checked) {
    if (motivoDesistenciaContainer) {
      motivoDesistenciaContainer.style.display = "block";
      const motivoInput = motivoDesistenciaContainer.querySelector(
        "#motivo-desistencia-pb"
      );
      if (motivoInput) motivoInput.required = true;
    }
  } else if (radio.value === "outra_modalidade" && radio.checked) {
    if (formAlteracaoContainer) {
      formAlteracaoContainer.style.display = "block";
      formAlteracaoContainer.innerHTML =
        '<div class="loading-spinner-small"></div> Carregando...';

      try {
        const response = await fetch("./modal-content-alterar-horario.html");
        if (!response.ok) {
          formAlteracaoContainer.innerHTML = getTemplateAlterarHorario();
        } else {
          formAlteracaoContainer.innerHTML = await response.text();
        }

        const atendimentoId = formPrincipal.querySelector(
          "#atendimento-id-horarios-modal"
        )?.value;
        const atendimentoAtual =
          estado.pacienteDataGlobal?.atendimentosPB?.find(
            (at) => at.atendimentoId === atendimentoId
          );
        setupFormLogicAlterarHorario(formAlteracaoContainer, atendimentoAtual);
      } catch (error) {
        console.error("Erro ao carregar form Alterar:", error);
        formAlteracaoContainer.innerHTML = getTemplateAlterarHorario();
        // Tenta configurar mesmo com template fallback
        const atendimentoId = formPrincipal.querySelector(
          "#atendimento-id-horarios-modal"
        )?.value;
        const atendimentoAtual =
          estado.pacienteDataGlobal?.atendimentosPB?.find(
            (at) => at.atendimentoId === atendimentoId
          );
        setupFormLogicAlterarHorario(formAlteracaoContainer, atendimentoAtual);
      }
    }
  }
}

// --- Templates de Fallback (Caso os arquivos HTML não existam) ---
function getTemplateNovasSessoes() {
  return `
    <div id="solicitar-sessoes-form">
        <div class="form-group">
            <label>Dia da Semana</label>
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
            <label>Horário</label>
            <select id="solicitar-horario" class="form-control" required></select>
        </div>
        <div class="form-group">
            <label>Modalidade</label>
            <select id="solicitar-tipo-atendimento" class="form-control" required>
                <option value="">Selecione...</option>
                <option value="online">Online</option>
                <option value="presencial">Presencial</option>
            </select>
        </div>
        <div class="form-group">
            <label>Sala</label>
            <select id="solicitar-sala" class="form-control" required></select>
        </div>
        <div class="form-group">
            <label>Frequência</label>
            <select id="solicitar-frequencia" class="form-control" required>
                <option value="Semanal">Semanal</option>
                <option value="Quinzenal">Quinzenal</option>
            </select>
        </div>
        <div class="form-group">
            <label>Início</label>
            <input type="date" id="solicitar-data-inicio" class="form-control" required>
        </div>
    </div>`;
}

function getTemplateAlterarHorario() {
  return `
    <div id="alterar-horario-form">
        <div class="form-group">
            <label>Novo Dia</label>
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
        <div class="form-group"><label>Novo Horário</label><select id="alterar-horario" class="form-control" required></select></div>
        <div class="form-group"><label>Nova Modalidade</label><select id="alterar-tipo-atendimento" class="form-control" required><option value="Online">Online</option><option value="Presencial">Presencial</option></select></div>
        <div class="form-group"><label>Nova Sala</label><select id="alterar-sala" class="form-control" required></select></div>
        <div class="form-group"><label>Nova Frequência</label><select id="alterar-frequencia" class="form-control" required><option value="Semanal">Semanal</option><option value="Quinzenal">Quinzenal</option></select></div>
        <div class="form-group"><label>A partir de</label><input type="date" id="alterar-data-inicio" class="form-control" required></div>
        <div class="form-group"><label>Alterar na Grade?</label><select id="alterar-grade" class="form-control" required><option value="Sim">Sim</option><option value="Não">Não</option></select></div>
        <div class="form-group"><label>Justificativa</label><textarea id="alterar-justificativa" class="form-control"></textarea></div>
        <input type="hidden" id="alterar-dia-atual"><input type="hidden" id="alterar-horario-atual"><input type="hidden" id="alterar-modalidade-atual">
    </div>`;
}

// --- Funções de Configuração de Forms ---

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

  if (tipoSelect) tipoSelect.addEventListener("change", updateUI);

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
      const isOnline = tipoSelect.value === "Online";
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
      const subForm = document.getElementById("solicitar-sessoes-form");
      if (!subForm) throw new Error("Formulário de detalhes não carregado.");

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
        const subForm = document.getElementById("alterar-horario-form");
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
