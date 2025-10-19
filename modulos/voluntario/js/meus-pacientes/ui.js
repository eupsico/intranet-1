// Arquivo: /modulos/voluntario/js/meus-pacientes/ui.js

export function calcularIdade(dataNascimento) {
  if (!dataNascimento) return "N/A";
  const hoje = new Date();
  // Garante que a data de nascimento seja interpretada corretamente como UTC para evitar problemas de fuso horário
  const [year, month, day] = dataNascimento.split("-");
  const nasc = new Date(Date.UTC(year, month - 1, day)); // Usa UTC

  if (isNaN(nasc)) return "Data inválida"; // Verifica se a data é válida

  let idade = hoje.getUTCFullYear() - nasc.getUTCFullYear();
  const m = hoje.getUTCMonth() - nasc.getUTCMonth();
  if (m < 0 || (m === 0 && hoje.getUTCDate() < nasc.getUTCDate())) {
    idade--;
  }
  return idade >= 0 ? `${idade} anos` : "N/A";
}

export function criarAccordionPaciente(paciente, atendimentoPB = null) {
  const statusPaciente = paciente.status || "desconhecido"; // Garante que sempre haja um status

  // --- CORREÇÃO DEFINITIVA DA LÓGICA DE STATUS E BOTÕES ---
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
      // Status que estava faltando
      label: "Horários Informados (PB)",
      acao: "Registrar Desfecho", // Ação após informar horários pode ser registrar desfecho
      tipo: "desfecho_pb", // Ou talvez uma ação diferente? Por ora, leva ao desfecho.
      ativo: true, // Ou talvez desabilitado até Adm confirmar? Depende da regra.
    },
    // Adicione outros status de PB aqui, se necessário
    // Exemplo:
    // aguardando_contrato: {
    //     label: "Aguardando Contrato (PB)",
    //     acao: "Reenviar Contrato", // Ação exemplo
    //     tipo: "reenviar_contrato", // Tipo exemplo
    //     ativo: true,
    // },
    em_atendimento_pb: {
      // Status que estava faltando mapeamento claro
      label: "Em Atendimento (PB)",
      acao: "Registrar Desfecho",
      tipo: "desfecho_pb",
      ativo: true,
    },
    // Status Finais ou Informativos (sem ação principal clara ou botão desabilitado)
    alta: { label: "Alta", acao: "Alta", tipo: "info", ativo: false },
    desistencia: {
      label: "Desistência",
      acao: "Desistência",
      tipo: "info",
      ativo: false,
    },
    encaminhado_grupo: {
      label: "Encaminhado para Grupo",
      acao: "Encaminhado",
      tipo: "info",
      ativo: false,
    },
    encaminhado_parceiro: {
      label: "Encaminhado para Parceiro",
      acao: "Encaminhado",
      tipo: "info",
      ativo: false,
    },
    // Adicione outros status finais conforme necessário
  };

  // Tenta encontrar o status no mapa
  if (mapaDeStatus[statusPaciente]) {
    infoStatus = mapaDeStatus[statusPaciente];
  } else {
    // Fallback genérico se o status for realmente desconhecido
    infoStatus = {
      label: `Status: ${statusPaciente.replace(/_/g, " ")}`,
      acao: "Verificar Status", // Botão informativo, mas desabilitado
      tipo: "info",
      ativo: false,
    };
    console.warn(
      `Status não mapeado encontrado: ${statusPaciente} para paciente ${paciente.id}`
    );
  }

  // Determina se os detalhes/botões de PB devem ser mostrados
  // Mostra se NÃO for plantão E se houver um atendimento PB associado
  const mostrarDetalhesPB =
    statusPaciente !== "em_atendimento_plantao" && atendimentoPB;
  // --- FIM DA CORREÇÃO DA LÓGICA ---

  // ---- DADOS GERAIS DO PACIENTE (mantidos) ----
  const dataEncaminhamento =
    atendimentoPB?.dataEncaminhamento ||
    paciente.plantaoInfo?.dataEncaminhamento
      ? new Date(
          `${
            atendimentoPB?.dataEncaminhamento ||
            paciente.plantaoInfo?.dataEncaminhamento
          }T03:00:00` // Considera fuso horário de Brasília
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

  // Botões Condicionais de PB (só aparecem se mostrarDetalhesPB for true)
  const pdfBtn =
    mostrarDetalhesPB && atendimentoPB?.contratoAssinado
      ? `<button class="action-button secondary-button" data-tipo="pdf_contrato">PDF Contrato</button>`
      : "";
  const novaSessaoBtn = mostrarDetalhesPB
    ? `<button class="action-button" data-tipo="solicitar_sessoes">Solicitar Novas Sessões</button>`
    : "";
  const alterarHorarioBtn = mostrarDetalhesPB
    ? `<button class="action-button" data-tipo="alterar_horario">Alterar Horário</button>`
    : "";

  // Botão de WhatsApp (sempre visível)
  const whatsappBtn = `<button class="action-button secondary-button btn-whatsapp" data-tipo="whatsapp">Enviar Mensagem</button>`;

  // ---- LÓGICA DE EXIBIÇÃO DO STATUS NO BADGE ----
  // Prioriza "Aguardando Contrato" se for o caso, senão usa o label do infoStatus
  const displayStatus =
    mostrarDetalhesPB && atendimentoPB && !atendimentoPB.contratoAssinado
      ? "Aguardando Contrato"
      : infoStatus.label; // Usa o label correto do mapa

  const displayStatusClass =
    mostrarDetalhesPB && atendimentoPB && !atendimentoPB.contratoAssinado
      ? "status-aguardando_contrato" // Classe específica se esperando contrato
      : `status-${statusPaciente}`; // Usa o status real do Firebase para a classe CSS

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
                        // Detalhes de PB só aparecem se não for plantão E existir atendimentoPB
                        mostrarDetalhesPB
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
                          : "" // Não mostra nada se for plantão
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
