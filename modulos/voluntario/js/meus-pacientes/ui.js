// Arquivo: /modulos/voluntario/js/meus-pacientes/ui.js

export function calcularIdade(dataNascimento) {
  if (!dataNascimento) return "N/A";
  const hoje = new Date();
  // Garante que a data de nascimento seja interpretada corretamente como UTC para evitar problemas de fuso horário
  const [year, month, day] = dataNascimento.split("-");
  // Adiciona verificação para garantir que year, month e day são números válidos
  if (isNaN(year) || isNaN(month) || isNaN(day)) return "Data inválida";
  const nasc = new Date(Date.UTC(year, month - 1, day)); // Usa UTC

  if (isNaN(nasc.getTime())) return "Data inválida"; // Verifica se a data é válida

  let idade = hoje.getUTCFullYear() - nasc.getUTCFullYear();
  const m = hoje.getUTCMonth() - nasc.getUTCMonth();
  if (m < 0 || (m === 0 && hoje.getUTCDate() < nasc.getUTCDate())) {
    idade--;
  }
  return idade >= 0 ? `${idade} anos` : "N/A";
}

export function criarAccordionPaciente(paciente, atendimentoPB = null) {
  const statusPaciente = paciente.status || "desconhecido";

  let infoStatus = {}; // Objeto para guardar label, ação e tipo do botão principal

  // Define o mapa de status com mais clareza
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
      acao: "Registrar Desfecho", // Temporário - A ação pode mudar
      tipo: "desfecho_pb", // Temporário
      ativo: true, // Ou false, dependendo da regra
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
    }, // Label abreviado
    encaminhado_parceiro: {
      label: "Encaminhado p/ Parceiro",
      acao: "Encaminhado",
      tipo: "info",
      ativo: false,
    }, // Label abreviado
    // Adicione outros status aqui se necessário
  };

  // Tenta encontrar o status no mapa
  if (mapaDeStatus[statusPaciente]) {
    infoStatus = mapaDeStatus[statusPaciente];
  } else {
    // Fallback genérico se o status for realmente desconhecido
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

  // --- CORREÇÃO: Lógica para exibir detalhes de PB ---
  // Mostra os detalhes se atendimentoPB existir E tiver informações de horárioSessao
  const mostrarDetalhesPB = !!(
    atendimentoPB &&
    atendimentoPB.horarioSessao &&
    atendimentoPB.horarioSessao.diaSemana
  );
  // --- FIM DA CORREÇÃO ---

  // ---- DADOS GERAIS DO PACIENTE (mantidos) ----
  const dataEncaminhamento =
    atendimentoPB?.dataEncaminhamento ||
    paciente.plantaoInfo?.dataEncaminhamento
      ? new Date(
          `${
            atendimentoPB?.dataEncaminhamento ||
            paciente.plantaoInfo?.dataEncaminhamento
          }T03:00:00`
        ).toLocaleDateString("pt-BR")
      : "N/A";
  const idade = calcularIdade(paciente.dataNascimento);
  const responsavelNome = paciente.responsavel?.nome || "N/A";
  const atendimentoInfo = atendimentoPB?.horarioSessao || {};
  const atendimentoIdAttr = atendimentoPB
    ? `data-atendimento-id="${atendimentoPB.atendimentoId}"`
    : "";

  // ---- BOTÕES DE AÇÃO ----
  // Botão Principal (baseado no infoStatus)
  const acaoPrincipalBtn = `<button class="action-button" data-tipo="${
    infoStatus.tipo
  }" ${!infoStatus.ativo ? "disabled" : ""}>${infoStatus.acao}</button>`;

  // --- CORREÇÃO: Botões de PB agora usam a nova lógica `mostrarDetalhesPB` ---
  // Define se os botões específicos de PB devem aparecer (não é o mesmo que mostrar os detalhes, pois mesmo no plantão pode haver ações de PB)
  const mostrarBotoesPB =
    statusPaciente !== "em_atendimento_plantao" && atendimentoPB;

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
  // --- FIM DA CORREÇÃO ---

  // Botão de WhatsApp (sempre visível)
  const whatsappBtn = `<button class="action-button secondary-button btn-whatsapp" data-tipo="whatsapp">Enviar Mensagem</button>`;

  // ---- LÓGICA DE EXIBIÇÃO DO STATUS NO BADGE (Refinada) ----
  let displayStatus = infoStatus.label; // Começa com o label padrão do status
  let displayStatusClass = `status-${statusPaciente}`; // Usa o status real para a classe

  // Caso especial: Se for PB e estiver aguardando contrato, sobrescreve
  if (
    statusPaciente !== "em_atendimento_plantao" &&
    atendimentoPB &&
    !atendimentoPB.contratoAssinado
  ) {
    displayStatus = "Aguardando Contrato";
    displayStatusClass = "status-aguardando_contrato";
  }

  // Garante que displayStatus nunca seja vazio
  if (!displayStatus || displayStatus.trim() === "") {
    displayStatus = `Status: ${statusPaciente}`; // Fallback final
  }

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
                      ${
                        // --- CORREÇÃO: Detalhes de PB agora usam a nova lógica ---
                        mostrarDetalhesPB // Mostra se atendimentoPB.horarioSessao tiver dados
                          ? `
                          <div class="detail-item"><span class="label">Dia da Sessão</span><span class="value">${
                            atendimentoInfo.diaSemana || "A definir"
                          }</span></div>
                          <div class="detail-item"><span class="label">Horário</span><span class="value">${
                            atendimentoInfo.horario || "A definir"
                          }</span></div>
                          <div class="detail-item"><span class="label">Modalidade</span><span class="value">${
                            atendimentoInfo.tipoAtendimento || "A definir"
                          }</span></div>
                      `
                          : "" // Não mostra se não houver dados de horárioSessao
                        // --- FIM DA CORREÇÃO ---
                      }
                  </div>
                  <div class="card-actions">
                      ${acaoPrincipalBtn} ${pdfBtn} ${novaSessaoBtn} ${alterarHorarioBtn} ${whatsappBtn}
                  </div>
              </div>
          </div>
      </div>
  `;
}
