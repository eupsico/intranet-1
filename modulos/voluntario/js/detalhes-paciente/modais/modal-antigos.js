// Arquivo: /modulos/voluntario/js/detalhes-paciente/modais/modal-antigos.js
// Lógica para os modais legados: Solicitar Novas Sessões e Alterar Horário (PB Ativo).

import { db, collection, addDoc, serverTimestamp } from "../conexao-db.js"; // Firestore functions
import * as estado from "../estado.js"; // Shared state

// --- Lógica do Modal Legado: Solicitar Novas Sessões ---

/**
 * Abre o modal legado para solicitar novas sessões (quando PB já está ativo).
 */
export function abrirModalSolicitarSessoes() {
  // Verifica dados essenciais
  if (
    !estado.pacienteDataGlobal ||
    !estado.userDataGlobal ||
    !estado.systemConfigsGlobal
  ) {
    alert(
      "Dados necessários (paciente, usuário ou configurações) não estão carregados para abrir o modal de solicitação."
    );
    return;
  }

  // Encontra o atendimento PB ativo para o usuário logado
  const atendimentoAtivo = estado.pacienteDataGlobal.atendimentosPB?.find(
    (at) => at.profissionalId === estado.userDataGlobal.uid
  );

  if (!atendimentoAtivo) {
    alert(
      "Não há um atendimento de Psicoterapia Breve ativo atribuído a você para solicitar novas sessões por este modal."
    );
    return; // Impede abrir se não houver atendimento ativo
  }

  const modal = document.getElementById("solicitar-sessoes-modal");
  const form = document.getElementById("solicitar-sessoes-form");

  if (!modal || !form) {
    console.error(
      "Modal (#solicitar-sessoes-modal) ou Form (#solicitar-sessoes-form) legado não encontrado."
    );
    alert("Erro ao abrir modal legado: Elementos não encontrados.");
    return;
  } // --- Reset e Preenchimento do Formulário ---

  form.reset();
  form.classList.remove("was-validated"); // Remove classe de validação Bootstrap (se usada) // Preenche nomes (readonly)

  const profNomeEl = form.querySelector("#solicitar-profissional-nome");
  if (profNomeEl) profNomeEl.value = estado.userDataGlobal.nome || "";
  const pacNomeEl = form.querySelector("#solicitar-paciente-nome");
  if (pacNomeEl) pacNomeEl.value = estado.pacienteDataGlobal.nomeCompleto || ""; // Preenche IDs ocultos

  const pacIdInput = form.querySelector("#solicitar-paciente-id");
  if (pacIdInput) pacIdInput.value = estado.pacienteIdGlobal;
  const atendIdInput = form.querySelector("#solicitar-atendimento-id");
  if (atendIdInput) atendIdInput.value = atendimentoAtivo.atendimentoId; // Popula select de Horário

  const horarioSelect = form.querySelector("#solicitar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 7; i <= 21; i++) {
      // 7h às 21h
      const hora = `${String(i).padStart(2, "0")}:00`;
      horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
      if (i < 21) {
        const hora30 = `${String(i).padStart(2, "0")}:30`;
        horarioSelect.innerHTML += `<option value="${hora30}">${hora30}</option>`;
      }
    }
  } // Popula select de Sala

  const salaSelect = form.querySelector("#solicitar-sala");
  if (salaSelect) {
    salaSelect.innerHTML = '<option value="">Selecione...</option>';
    salaSelect.innerHTML += '<option value="Online">Online</option>';
    estado.salasPresenciaisGlobal.forEach((sala) => {
      // Usa salas do estado
      if (sala && sala !== "Online") {
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
      }
    });
  }

  // --- Configura Listeners Internos (Tipo Atendimento -> Sala, Validação Grade) ---
  // Clonar/Substituir para remover listeners antigos

  const tipoAtendimentoSelect = form.querySelector(
    "#solicitar-tipo-atendimento"
  );
  const salaSelectEl = form.querySelector("#solicitar-sala"); // Guarda referência

  // Função para ajustar a sala com base no tipo
  const ajustarSalaSolicitar = () => {
    const tipo = tipoAtendimentoSelect?.value; // 'online' ou 'presencial'
    const isOnline = tipo === "online";
    if (salaSelectEl) {
      salaSelectEl.disabled = isOnline;
      salaSelectEl.required = !isOnline;
      if (isOnline) {
        salaSelectEl.value = "Online";
      } else if (salaSelectEl.value === "Online") {
        salaSelectEl.value = ""; // Limpa se mudou para presencial
      }
    }
    validarHorarioNaGradeOriginal(); // Chama a validação de grade específica deste modal
  };

  // Listener para tipo de atendimento
  if (tipoAtendimentoSelect) {
    const cloneTipo = tipoAtendimentoSelect.cloneNode(true);
    tipoAtendimentoSelect.parentNode.replaceChild(
      cloneTipo,
      tipoAtendimentoSelect
    );
    cloneTipo.addEventListener("change", ajustarSalaSolicitar);
  }

  // Listeners para os campos que afetam a validação da grade
  ["solicitar-dia-semana", "solicitar-horario", "solicitar-sala"].forEach(
    (id) => {
      const element = form.querySelector(`#${id}`);
      if (element) {
        const clone = element.cloneNode(true);
        element.parentNode.replaceChild(clone, element);
        clone.addEventListener("change", validarHorarioNaGradeOriginal);
      }
    }
  );

  // Chama ajuste inicial
  ajustarSalaSolicitar();

  modal.style.display = "flex"; // Exibe o modal
}

/**
 * Handler para o submit do modal legado de Solicitar Novas Sessões.
 * Cria uma solicitação na coleção 'solicitacoes'.
 * @param {Event} evento - O evento de submit (ou click no botão).
 */
export async function handleSolicitarSessoesSubmit(evento) {
  evento.preventDefault(); // Previne submit/navegação padrão
  const form = document.getElementById("solicitar-sessoes-form");
  const modal = document.getElementById("solicitar-sessoes-modal");
  const btnSubmit = document.getElementById("btn-confirmar-solicitacao"); // Botão específico

  if (!form || !modal || !btnSubmit) {
    console.error(
      "Elementos do modal legado de solicitar sessões não encontrados durante o submit."
    );
    alert("Erro interno ao enviar solicitação legada.");
    return;
  }

  const pacienteId = form.querySelector("#solicitar-paciente-id")?.value;
  const atendimentoId = form.querySelector("#solicitar-atendimento-id")?.value;

  if (!pacienteId || !atendimentoId || pacienteId !== estado.pacienteIdGlobal) {
    alert(
      "Erro: IDs do paciente ou atendimento inválidos no formulário. Recarregue a página."
    );
    return;
  }

  // Validação HTML5
  if (!form.checkValidity()) {
    form.reportValidity(); // Mostra mensagens de erro do navegador
    alert(
      "Por favor, preencha todos os campos obrigatórios (*) para solicitar novas sessões."
    );
    return;
  } // --- Inicia processo de salvar ---

  btnSubmit.disabled = true;
  btnSubmit.innerHTML =
    '<span class="loading-spinner-small"></span> Enviando...';

  try {
    // Coleta os detalhes da solicitação do formulário
    const detalhesSolicitacao = {
      diaSemana: form.querySelector("#solicitar-dia-semana")?.value || null,
      horario: form.querySelector("#solicitar-horario")?.value || null,
      modalidade:
        form.querySelector("#solicitar-tipo-atendimento")?.value || null, // 'online' ou 'presencial'
      frequencia: form.querySelector("#solicitar-frequencia")?.value || null,
      sala: form.querySelector("#solicitar-sala")?.value || null,
      dataInicioPreferencial:
        form.querySelector("#solicitar-data-inicio")?.value || null, // YYYY-MM-DD
    };
    // Garante capitalização da modalidade para consistência com outras solicitações
    if (detalhesSolicitacao.modalidade) {
      detalhesSolicitacao.modalidade = detalhesSolicitacao.modalidade.replace(
        /^./,
        (c) => c.toUpperCase()
      );
    } // Monta o objeto da solicitação

    const solicitacaoData = {
      tipo: "novas_sessoes", // Tipo para o admin
      status: "Pendente",
      dataSolicitacao: serverTimestamp(),
      solicitanteId: estado.userDataGlobal.uid,
      solicitanteNome: estado.userDataGlobal.nome,
      pacienteId: pacienteId,
      pacienteNome:
        estado.pacienteDataGlobal?.nomeCompleto ||
        form.querySelector("#solicitar-paciente-nome")?.value ||
        "",
      atendimentoId: atendimentoId,
      detalhes: detalhesSolicitacao,
      adminFeedback: null,
    }; // Salva na coleção 'solicitacoes'

    const docRef = await addDoc(
      collection(db, "solicitacoes"),
      solicitacaoData
    );
    console.log(
      "Solicitação de novas sessões (legada) criada com ID:",
      docRef.id,
      solicitacaoData
    );

    alert(
      "Solicitação de novas sessões enviada com sucesso para o administrativo!"
    );
    modal.style.display = "none"; // Fecha o modal
  } catch (error) {
    console.error(
      "Erro ao enviar solicitação de novas sessões (legada):",
      error
    );
    alert(`Erro ao enviar solicitação: ${error.message}`);
  } finally {
    // Reabilita o botão
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Enviar Solicitação"; // Restaura texto
  }
}

// --- Lógica do Modal Legado: Alterar Horário ---

/**
 * Abre o modal legado para solicitar alteração de horário (quando PB já está ativo).
 */
export function abrirModalAlterarHorario() {
  // Verifica dados essenciais
  if (
    !estado.pacienteDataGlobal ||
    !estado.userDataGlobal ||
    !estado.systemConfigsGlobal
  ) {
    alert(
      "Dados necessários (paciente, usuário ou configurações) não estão carregados para abrir o modal de alteração."
    );
    return;
  }

  // Encontra o atendimento PB ativo para o usuário logado
  const atendimentoAtivo = estado.pacienteDataGlobal.atendimentosPB?.find(
    (at) =>
      at.profissionalId === estado.userDataGlobal.uid &&
      at.statusAtendimento === "ativo"
  );
  if (!atendimentoAtivo) {
    alert(
      "Não há um atendimento de Psicoterapia Breve ativo atribuído a você para solicitar alteração de horário por este modal."
    );
    return;
  }

  const modal = document.getElementById("alterar-horario-modal");
  const form = document.getElementById("alterar-horario-form");

  if (!modal || !form) {
    console.error(
      "Modal (#alterar-horario-modal) ou Form (#alterar-horario-form) legado não encontrado."
    );
    alert(
      "Erro ao abrir modal legado de alteração: Elementos não encontrados."
    );
    return;
  } // --- Reset e Preenchimento ---

  form.reset(); // Dados fixos e IDs ocultos

  const pacNomeEl = form.querySelector("#alterar-paciente-nome");
  if (pacNomeEl) pacNomeEl.value = estado.pacienteDataGlobal.nomeCompleto || "";
  const profNomeEl = form.querySelector("#alterar-profissional-nome");
  if (profNomeEl) profNomeEl.value = estado.userDataGlobal.nome || "";
  const pacIdInput = form.querySelector("#alterar-paciente-id");
  if (pacIdInput) pacIdInput.value = estado.pacienteIdGlobal;
  const atendIdInput = form.querySelector("#alterar-atendimento-id");
  if (atendIdInput) atendIdInput.value = atendimentoAtivo.atendimentoId; // Preenche dados do horário ATUAL

  const horarioAtual = atendimentoAtivo.horarioSessoes || {}; // Usa o horário definido no atendimento
  const diaAtualEl = form.querySelector("#alterar-dia-atual");
  if (diaAtualEl) diaAtualEl.value = horarioAtual.diaSemana || "N/A";
  const horaAtualEl = form.querySelector("#alterar-horario-atual");
  if (horaAtualEl) horaAtualEl.value = horarioAtual.horario || "N/A";
  const modAtualEl = form.querySelector("#alterar-modalidade-atual");
  if (modAtualEl)
    modAtualEl.value = (horarioAtual.tipoAtendimento || "N/A").replace(
      /^./,
      (c) => c.toUpperCase()
    ); // Capitaliza 'online'/'presencial' // Popula selects para o NOVO horário/sala

  const horarioSelect = form.querySelector("#alterar-horario");
  if (horarioSelect) {
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 7; i <= 21; i++) {
      // 7h às 21h
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
  } // --- Lógica Condicional: Tipo -> Sala ---

  const tipoAtendimentoSelect = form.querySelector("#alterar-tipo-atendimento"); // Select NOVO tipo
  const salaSelectEl = form.querySelector("#alterar-sala"); // Select NOVA sala

  const ajustarSalaAlteracaoOriginal = () => {
    const tipo = tipoAtendimentoSelect?.value; // 'Online' ou 'Presencial'
    const isOnline = tipo === "Online";
    if (salaSelectEl) {
      salaSelectEl.disabled = isOnline;
      salaSelectEl.required = !isOnline;
      if (isOnline) {
        salaSelectEl.value = "Online";
      } else if (salaSelectEl.value === "Online") {
        salaSelectEl.value = ""; // Limpa se mudou para Presencial
      }
    }
    // Define os requireds para este form (pode variar)
    form
      .querySelectorAll(
        "#alterar-dia-semana, #alterar-horario, #alterar-tipo-atendimento, #alterar-frequencia, #alterar-data-inicio, #alterar-grade"
      )
      .forEach((el) => (el.required = true));
    // form.querySelector('#alterar-justificativa').required = true; // Tornar justificativa obrigatória?
  };

  // Adiciona listener (clonando)
  if (tipoAtendimentoSelect) {
    const clone = tipoAtendimentoSelect.cloneNode(true);
    tipoAtendimentoSelect.parentNode.replaceChild(clone, tipoAtendimentoSelect);
    clone.addEventListener("change", ajustarSalaAlteracaoOriginal);
  } // Chama ajuste inicial

  ajustarSalaAlteracaoOriginal();

  modal.style.display = "flex"; // Exibe o modal
}

/**
 * Handler para o submit do modal legado de Alterar Horário.
 * Cria uma solicitação na coleção 'solicitacoes'.
 * @param {Event} evento - O evento de submit (ou click no botão).
 */
export async function handleAlterarHorarioSubmit(evento) {
  evento.preventDefault();
  const form = document.getElementById("alterar-horario-form");
  const modal = document.getElementById("alterar-horario-modal");
  const btnSubmit = document.getElementById("btn-confirmar-alteracao-horario");

  if (!form || !modal || !btnSubmit) {
    console.error(
      "Elementos do modal legado de alterar horário não encontrados durante o submit."
    );
    alert("Erro interno ao enviar solicitação de alteração legada.");
    return;
  }

  const pacienteId = form.querySelector("#alterar-paciente-id")?.value;
  const atendimentoId = form.querySelector("#alterar-atendimento-id")?.value;

  if (!pacienteId || !atendimentoId || pacienteId !== estado.pacienteIdGlobal) {
    alert(
      "Erro: IDs do paciente ou atendimento inválidos no formulário. Recarregue a página."
    );
    return;
  }

  // Validação HTML5
  if (!form.checkValidity()) {
    form.reportValidity();
    alert(
      "Por favor, preencha todos os campos obrigatórios (*) para a nova configuração de horário."
    );
    return;
  } // --- Inicia processo de salvar ---

  btnSubmit.disabled = true;
  btnSubmit.innerHTML =
    '<span class="loading-spinner-small"></span> Enviando...';

  try {
    // Busca dados do atendimento atual para incluir 'dadosAntigos' na solicitação
    const atendimentoAtivo = estado.pacienteDataGlobal?.atendimentosPB?.find(
      (at) => at.atendimentoId === atendimentoId
    );
    const horarioAntigo = atendimentoAtivo?.horarioSessoes || {};
    const dadosAntigos = {
      dia: horarioAntigo.diaSemana || "N/A",
      horario: horarioAntigo.horario || "N/A",
      // Normaliza modalidade antiga para 'Online'/'Presencial' ou 'N/A'
      modalidade: (horarioAntigo.tipoAtendimento || "N/A").replace(/^./, (c) =>
        c.toUpperCase()
      ),
      sala: horarioAntigo.salaAtendimento || "N/A",
      frequencia: horarioAntigo.frequencia || "N/A",
    }; // Coleta os dados NOVOS do formulário

    const dadosNovos = {
      dia: form.querySelector("#alterar-dia-semana")?.value || null,
      horario: form.querySelector("#alterar-horario")?.value || null,
      modalidade:
        form.querySelector("#alterar-tipo-atendimento")?.value || null, // 'Online' ou 'Presencial'
      frequencia: form.querySelector("#alterar-frequencia")?.value || null,
      sala: form.querySelector("#alterar-sala")?.value || null,
      dataInicio: form.querySelector("#alterar-data-inicio")?.value || null, // YYYY-MM-DD
      alterarGrade: form.querySelector("#alterar-grade")?.value || null, // 'Sim' ou 'Não'
    }; // Monta o objeto da solicitação

    const solicitacaoData = {
      tipo: "alteracao_horario", // Tipo para o admin
      status: "Pendente",
      dataSolicitacao: serverTimestamp(),
      solicitanteId: estado.userDataGlobal.uid,
      solicitanteNome: estado.userDataGlobal.nome,
      pacienteId: pacienteId,
      pacienteNome:
        estado.pacienteDataGlobal?.nomeCompleto ||
        form.querySelector("#alterar-paciente-nome")?.value ||
        "",
      atendimentoId: atendimentoId,
      detalhes: {
        dadosAntigos: dadosAntigos,
        dadosNovos: dadosNovos,
        justificativa:
          form.querySelector("#alterar-justificativa")?.value.trim() || "", // Pega a justificativa
      },
      adminFeedback: null,
    };

    // Salva na coleção 'solicitacoes'
    const docRef = await addDoc(
      collection(db, "solicitacoes"),
      solicitacaoData
    );
    console.log(
      "Solicitação de alteração de horário (legada) criada com ID:",
      docRef.id,
      solicitacaoData
    );

    alert(
      "Solicitação de alteração de horário enviada com sucesso para o administrativo!"
    );
    modal.style.display = "none"; // Fecha o modal
  } catch (error) {
    console.error(
      "Erro ao enviar solicitação de alteração de horário (legada):",
      error
    );
    alert(`Erro ao enviar solicitação: ${error.message}`);
  } finally {
    // Reabilita o botão
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Enviar Solicitação de Alteração"; // Restaura texto
  }
}

// --- Função de Validação de Grade Específica do Modal Legado Solicitar ---
// (Mantida aqui por estar diretamente ligada à UI desse modal específico)
// **NOTA:** Esta função assume a existência de um elemento com ID 'validacao-grade-feedback'
// fora do modal, ou precisaria ser ajustada para um elemento dentro do modal legado.
// Vamos usar o ID global por enquanto, igual ao modal Horários PB fez.
function validarHorarioNaGradeOriginal() {
  const feedbackDiv = document.getElementById("validacao-grade-feedback");
  const form = document.getElementById("solicitar-sessoes-form"); // Form específico

  if (!form) {
    console.warn(
      "validarHorarioNaGradeOriginal: Form #solicitar-sessoes-form não encontrado."
    );
    if (feedbackDiv) feedbackDiv.style.display = "none";
    return;
  }
  if (!feedbackDiv) {
    console.warn(
      "Elemento de feedback #validacao-grade-feedback não encontrado para modal legado."
    );
    return;
  } // Esconde e reseta feedback

  feedbackDiv.style.display = "none";
  feedbackDiv.className = "info-note";
  feedbackDiv.innerHTML = ""; // Pega valores dos campos DESTE form

  const diaEl = form.querySelector("#solicitar-dia-semana");
  const horarioEl = form.querySelector("#solicitar-horario");
  const tipoEl = form.querySelector("#solicitar-tipo-atendimento");
  const salaEl = form.querySelector("#solicitar-sala");

  if (!diaEl || !horarioEl || !tipoEl || !salaEl) {
    console.warn(
      "Elementos para validação de grade não encontrados no form legado."
    );
    return;
  }

  const dia = diaEl.value;
  const horarioCompleto = horarioEl.value; // HH:MM
  const tipo = tipoEl.value; // 'online' ou 'presencial'
  const sala = salaEl.value;
  const horaKey = horarioCompleto ? horarioCompleto.replace(":", "-") : null; // HH-MM // Só valida se dados essenciais estão presentes

  if (!dia || !horaKey || !tipo || (tipo === "presencial" && !sala)) {
    return;
  } // Mapeamento PT-BR -> chave grade

  const diasMapGrade = {
    "Segunda-feira": "segunda",
    "Terça-feira": "terca",
    "Quarta-feira": "quarta",
    "Quinta-feira": "quinta",
    "Sexta-feira": "sexta",
    Sábado: "sabado",
  };
  const diaChave = diasMapGrade[dia] || dia.toLowerCase(); // Verifica ocupação na grade (usa estado global)

  let isOcupado = false;
  const grade = estado.dadosDaGradeGlobal;

  if (tipo === "online") {
    const colunasOnline = grade?.online?.[diaChave]?.[horaKey];
    if (colunasOnline) {
      for (let i = 0; i < 6; i++) {
        // Assume 6 colunas
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
      console.warn(`Sala presencial "${sala}" não encontrada na lista global.`);
      isOcupado = true; // Considera inválido/ocupado
    }
  } // Exibe feedback

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
