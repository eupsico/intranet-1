// Arquivo: /modulos/voluntario/js/meus-pacientes/ui.js

// --- CORREÇÃO NA FUNÇÃO calcularIdade ---
export function calcularIdade(dataNascimento) {
  // Retorna "N/A" se a data for inválida, nula ou vazia
  if (
    !dataNascimento ||
    typeof dataNascimento !== "string" ||
    dataNascimento.trim() === ""
  ) {
    return "N/A";
  }

  // Tenta criar uma data. Se for inválida, retorna "N/A"
  const nasc = new Date(dataNascimento + "T00:00:00"); // Adiciona T00:00:00 para consistência
  if (isNaN(nasc.getTime())) {
    console.warn("Formato de dataNascimento inválido:", dataNascimento);
    return "N/A"; // Retorna N/A em vez de "Data inválida"
  }

  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  // Retorna "N/A" se a idade calculada for negativa (data futura?)
  return idade >= 0 ? `${idade} anos` : "N/A";
}
// --- FIM DA CORREÇÃO ---

export function criarAccordionPaciente(paciente, atendimentoPB = null) {
  const statusPaciente = paciente.status || "desconhecido";

  let infoStatus = {};

  // Mapa de status como antes
  const mapaDeStatus = {
    em_atendimento_plantao: {
      label: "Em Atendimento (Plantão)",
      acao: "Encerrar Plantão",
      tipo: "plantao",
      ativo: true,
    },
    aguardando_info_horarios: {
      label: "Aguardando Horários (PB)",
      acao: "Informar Horários",
      tipo: "pb_horarios",
      ativo: true,
    },
    cadastrar_horario_psicomanager: {
      label: "Horários Informados (PB)",
      acao: "Registrar Desfecho",
      tipo: "desfecho_pb",
      ativo: true,
    },
    em_atendimento_pb: {
      label: "Em Atendimento (PB)",
      acao: "Registrar Desfecho",
      tipo: "desfecho_pb",
      ativo: true,
    },
    alta: { label: "Alta", acao: "Alta", tipo: "info", ativo: false },
    desistencia: {
      label: "Desistência",
      acao: "Desistência",
      tipo: "info",
      ativo: false,
    },
    encaminhado_grupo: {
      label: "Encaminhado p/ Grupo",
      acao: "Encaminhado",
      tipo: "info",
      ativo: false,
    },
    encaminhado_parceiro: {
      label: "Encaminhado p/ Parceiro",
      acao: "Encaminhado",
      tipo: "info",
      ativo: false,
    },
  };

  // Define infoStatus baseado no mapa ou fallback
  if (mapaDeStatus[statusPaciente]) {
    infoStatus = mapaDeStatus[statusPaciente];
  } else {
    infoStatus = {
      label: `Status: ${statusPaciente.replace(/_/g, " ")}`,
      acao: "Verificar Status",
      tipo: "info",
      ativo: false,
    };
    console.warn(
      `Status não mapeado encontrado: ${statusPaciente} para paciente ${paciente.id}`
    );
  }

  // ---- DADOS GERAIS DO PACIENTE (mantidos) ----
  const dataEncaminhamento =
    atendimentoPB?.dataEncaminhamento ||
    paciente.plantaoInfo?.dataEncaminhamento
      ? new Date(
          `${
            atendimentoPB?.dataEncaminhamento ||
            paciente.plantaoInfo?.dataEncaminhamento
          }T03:00:00` // Adicionado T03:00:00 para fuso
        ).toLocaleDateString("pt-BR")
      : "N/A";
  const idade = calcularIdade(paciente.dataNascimento); // Usa a função corrigida
  const responsavelNome = paciente.responsavel?.nome || "N/A";

  // --- INÍCIO DA ALTERAÇÃO (Valor Contribuição e Reavaliação) ---
  let valorContribuicaoTexto = "A definir";
  let reavaliadoInfo = ""; // Texto adicional se foi reavaliado

  if (paciente.valorContribuicao) {
    valorContribuicaoTexto = `R$ ${parseFloat(paciente.valorContribuicao)
      .toFixed(2)
      .replace(".", ",")}`;

    // Verifica se a última entrada no histórico foi uma reavaliação
    const historico = paciente.historicoContribuicao;
    if (Array.isArray(historico) && historico.length > 0) {
      const ultimoRegistro = historico[historico.length - 1];
      if (ultimoRegistro.motivo === "Reavaliação") {
        const dataReavaliacao = ultimoRegistro.data?.toDate
          ? ultimoRegistro.data.toDate().toLocaleDateString("pt-BR")
          : "";
        reavaliadoInfo = `<small class="reavaliacao-info">(Reavaliado em ${dataReavaliacao})</small>`;
      }
    }
  }
  // --- FIM DA ALTERAÇÃO ---

  // --- INÍCIO DA CORREÇÃO ---
  // Unifica as informações da sessão, priorizando PB, mas usando Plantão se for o caso
  const atendimentoInfo = atendimentoPB?.horarioSessao
    ? {
        // Dados do PB
        diaSemana: atendimentoPB.horarioSessao.diaSemana,
        horario: atendimentoPB.horarioSessao.horario,
        tipoAtendimento: atendimentoPB.horarioSessao.tipoAtendimento,
      }
    : paciente.plantaoInfo && paciente.plantaoInfo.dataPrimeiraSessao // Verifica se plantaoInfo e a data existem
    ? {
        // Dados do Plantão
        // Capitaliza a primeira letra do dia da semana
        diaSemana: ((dia) => dia.charAt(0).toUpperCase() + dia.slice(1))(
          new Date(
            paciente.plantaoInfo.dataPrimeiraSessao + "T03:00:00"
          ).toLocaleDateString("pt-BR", { weekday: "long" })
        ),
        horario: paciente.plantaoInfo.horaPrimeiraSessao,
        tipoAtendimento: paciente.plantaoInfo.tipoAtendimento,
      }
    : {}; // Fallback
  // --- FIM DA CORREÇÃO ---

  const atendimentoIdAttr = atendimentoPB
    ? `data-atendimento-id="${atendimentoPB.atendimentoId}"`
    : "";

  // ---- BOTÕES DE AÇÃO (mantidos da lógica anterior) ----
  const acaoPrincipalBtn = `<button class="action-button" data-tipo="${
    infoStatus.tipo
  }" ${!infoStatus.ativo ? "disabled" : ""}>${infoStatus.acao}</button>`;
  const mostrarBotoesPB =
    statusPaciente !== "em_atendimento_plantao" && atendimentoPB; // Botões PB só fora do plantão
  const pdfBtn =
    mostrarBotoesPB && atendimentoPB?.contratoAssinado
      ? `<button class="action-button secondary-button" data-tipo="pdf_contrato">PDF Contrato</button>`
      : "";
  const novaSessaoBtn = mostrarBotoesPB
    ? `<button class="action-button" data-tipo="solicitar_sessoes">Solicitar Novas Sessões</button>`
    : "";
  const alterarHorarioBtn = mostrarBotoesPB
    ? `<button class="action-button" data-tipo="alterar_horario">Alterar Horário</button>`
    : "";
  const whatsappBtn = `<button class="action-button secondary-button btn-whatsapp" data-tipo="whatsapp">Enviar Mensagem</button>`;

  // --- INÍCIO DA ALTERAÇÃO (Botão Reavaliação) ---
  const reavaliacaoBtn = `<button class="action-button secondary-button" data-tipo="reavaliacao">Reavaliação</button>`;
  // --- FIM DA ALTERAÇÃO ---

  // ---- CORREÇÃO NA LÓGICA DE EXIBIÇÃO DO STATUS ----
  let displayStatus = infoStatus.label; // Pega o label do mapa
  let displayStatusClass = statusPaciente; // Classe baseada no status real

  // Caso especial: Aguardando Contrato (somente se não for plantão)
  if (
    statusPaciente !== "em_atendimento_plantao" &&
    atendimentoPB &&
    !atendimentoPB.contratoAssinado
  ) {
    displayStatus = "Aguardando Contrato";
    displayStatusClass = "aguardando_contrato";
  }

  // Fallback final para garantir que algo seja exibido
  if (!displayStatus || displayStatus.trim() === "") {
    displayStatus = statusPaciente.replace(/_/g, " ") || "Status Desconhecido"; // Evita "Status: status_desconhecido"
  }
  // --- FIM DA CORREÇÃO ---

  return `
      <div class="paciente-accordion" data-id="${paciente.id}" data-telefone="${
    paciente.telefoneCelular || ""
  }" data-nome="${paciente.nomeCompleto}" ${atendimentoIdAttr}>
          <button class="accordion-header">
              <div class="header-info">
                  <span class="nome">${paciente.nomeCompleto}</span>
                  <span class="telefone">${
                    paciente.telefoneCelular || "Telefone não informado"
                  }</span>
              </div>
              <span class="accordion-icon">+</span>
          </button>
          <div class="accordion-content">
              <div class="accordion-content-inner">
                  <div class="patient-details-grid">
                      <div class="detail-item"><span class="label">Status</span><span class="value status-badge ${displayStatusClass}">${displayStatus}</span></div>
                      <div class="detail-item"><span class="label">Idade</span><span class="value">${idade}</span></div>
                      ${
                        idade < 18
                          ? `<div class="detail-item"><span class="label">Responsável</span><span class="value">${responsavelNome}</span></div>`
                          : ""
                      }
                      <div class="detail-item"><span class="label">Data Encaminhamento</span><span class="value">${dataEncaminhamento}</span></div>

                      <div class="detail-item">
                        <span class="label">Valor Contribuição</span>
                        <span class="value">${valorContribuicaoTexto} ${reavaliadoInfo}</span>
                      </div>
                      ${
                        // --- CORREÇÃO: Mostrar detalhes de PB SE EXISTIREM ---
                        // Verifica se 'atendimentoInfo' (horarioSessao) tem dados, independentemente do status
                        atendimentoInfo.diaSemana ||
                        atendimentoInfo.horario ||
                        atendimentoInfo.tipoAtendimento
                          ? `
                          <div class="detail-item"><span class="label">Dia da Sessão</span><span class="value">${
                            atendimentoInfo.diaSemana || "A definir" // Usa fallback se campo específico faltar
                          }</span></div>
                          <div class="detail-item"><span class="label">Horário</span><span class="value">${
                            atendimentoInfo.horario || "A definir"
                          }</span></div>
                          <div class="detail-item"><span class="label">Modalidade</span><span class="value">${
                            atendimentoInfo.tipoAtendimento || "A definir"
                          }</span></div>
                      `
                          : "" // Não mostra a seção se não houver NENHUM dado em horarioSessao
                        // --- FIM DA CORREÇÃO ---
                      }
                  </div>
                  <div class="card-actions">
                      ${acaoPrincipalBtn} ${pdfBtn} ${novaSessaoBtn} ${alterarHorarioBtn} ${whatsappBtn}

                      ${reavaliacaoBtn}
                      </div>
              </div>
          </div>
      </div>
  `;
}
