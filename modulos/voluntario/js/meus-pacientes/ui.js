// Arquivo: /modulos/voluntario/js/meus-pacientes/ui.js

export function calcularIdade(dataNascimento) {
  if (!dataNascimento) return "N/A";
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return idade >= 0 ? `${idade} anos` : "N/A";
}

export function criarAccordionPaciente(paciente, atendimentoPB = null) {
  // --- INÍCIO DA CORREÇÃO ---
  // A fonte da verdade deve ser o status principal do paciente.
  const isPlantao = paciente.status === "em_atendimento_plantao";

  // O statusKey deve ser o status real do paciente.
  const statusKey = paciente.status;
  // --- FIM DA CORREÇÃO ---

  const mapaDeStatus = {
    em_atendimento_plantao: {
      label: "Em Atendimento (Plantão)",
      acao: "Encerrar Plantão",
      tipo: "plantao",
      ativo: true,
    },
    aguardando_info_horarios: {
      label: "Aguardando Info Horários (PB)",
      acao: "Informar Horários",
      tipo: "pb_horarios",
      ativo: true,
    },
    em_atendimento_pb: {
      label: "Em Atendimento (PB)",
      acao: "Registrar Desfecho",
      tipo: "desfecho_pb",
      ativo: true,
    },
    // Fallback para status desconhecidos ou não listados
    [statusKey]: {
      label: `Status: ${statusKey.replace(/_/g, " ")}`,
      acao: "Ação Indefinida",
      tipo: "info",
      ativo: false,
    },
  };

  // Garante que 'infoStatus' sempre encontre uma entrada válida
  const infoStatus = mapaDeStatus[statusKey];

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

  // Definição dos botões de ação (agora corretos por causa de 'isPlantao')
  const acaoPrincipalBtn = `<button class="action-button" data-tipo="${
    infoStatus.tipo
  }" ${!infoStatus.ativo ? "disabled" : ""}>${infoStatus.acao}</button>`;

  const pdfBtn = atendimentoPB?.contratoAssinado
    ? `<button class="action-button secondary-button" data-tipo="pdf_contrato">PDF Contrato</button>`
    : "";

  const novaSessaoBtn = !isPlantao // Corrigido
    ? `<button class="action-button" data-tipo="solicitar_sessoes">Solicitar Novas Sessões</button>`
    : "";

  const alterarHorarioBtn = !isPlantao // Corrigido (botão da nossa última conversa)
    ? `<button class="action-button" data-tipo="alterar_horario">Alterar Horário</button>`
    : "";

  const whatsappBtn = `<button class="action-button secondary-button btn-whatsapp" data-tipo="whatsapp">Enviar Mensagem</button>`;

  // Status de exibição (agora correto)
  const displayStatus =
    atendimentoPB && !atendimentoPB.contratoAssinado
      ? "Aguardando Contrato"
      : infoStatus.label;

  const displayStatusClass =
    atendimentoPB && !atendimentoPB.contratoAssinado
      ? "status-aguardando_contrato"
      : `status-${statusKey}`; // Usa o statusKey real

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
                        !isPlantao // Corrigido: Este bloco não será exibido para o paciente em plantão
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
                          : ""
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
