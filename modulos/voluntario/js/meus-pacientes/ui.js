// Arquivo: /modulos/voluntario/js/meus-pacientes/ui.js

// Função calcularIdade mantida como antes...
export function calcularIdade(dataNascimento) {
  if (
    !dataNascimento ||
    typeof dataNascimento !== "string" ||
    dataNascimento.trim() === ""
  ) {
    return "N/A";
  }
  const nasc = new Date(dataNascimento + "T00:00:00");
  if (isNaN(nasc.getTime())) {
    console.warn("Formato de dataNascimento inválido:", dataNascimento);
    return "N/A";
  }
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return idade >= 0 ? `${idade} anos` : "N/A";
}

/**
 * REFATORAÇÃO:
 * Cria uma linha de tabela (<tr>) para um paciente com Nome (link), Telefone, Email e Status.
 */
export function criarLinhaPacienteTabela(paciente, atendimentoPB = null) {
  // Define a URL para a nova página de detalhes do paciente.
  const urlDetalhePaciente = `?p=voluntario&s=detalhe-paciente&id=${paciente.id}`;

  // Atendimento ID pode ser útil na página de detalhes, mantido como data attribute no link
  const atendimentoIdAttr = atendimentoPB
    ? `data-atendimento-id="${atendimentoPB.atendimentoId}"`
    : "";

  // Obter dados para as colunas
  const nomeCompleto = paciente.nomeCompleto || "Nome não disponível";
  const telefone = paciente.telefoneCelular || "Não informado";
  const email = paciente.email || "Não informado"; // Assumindo que o campo 'email' existe no objeto paciente
  const statusPaciente = paciente.status || "desconhecido";

  // --- Lógica de Status (similar à versão anterior, mas simplificada para o badge) ---
  let displayStatus = statusPaciente.replace(/_/g, " ") || "Desconhecido"; // Texto para exibir
  let displayStatusClass = statusPaciente; // Classe CSS

  // Caso especial: Aguardando Contrato (somente se não for plantão)
  if (
    statusPaciente !== "em_atendimento_plantao" &&
    atendimentoPB &&
    !atendimentoPB.contratoAssinado
  ) {
    displayStatus = "Aguardando Contrato";
    displayStatusClass = "aguardando_contrato"; // Pode usar o mesmo estilo de 'aguardando_info_horarios'
  }
  // Formata o texto do status para exibição (Ex: 'Em Atendimento Pb' -> 'Em Atendimento (PB)')
  const mapaStatusTexto = {
    em_atendimento_plantao: "Em Atendimento (Plantão)",
    aguardando_info_horarios: "Aguardando Horários (PB)",
    cadastrar_horario_psicomanager: "Horários Informados (PB)",
    em_atendimento_pb: "Em Atendimento (PB)",
    aguardando_contrato: "Aguardando Contrato", // Texto do caso especial
    alta: "Alta",
    desistencia: "Desistência",
    encaminhado_grupo: "Encaminhado p/ Grupo",
    encaminhado_parceiro: "Encaminhado p/ Parceiro",
  };
  displayStatus =
    mapaStatusTexto[displayStatusClass] ||
    displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1); // Usa mapa ou capitaliza

  return `
        <tr>
            <td>
                <a href="${urlDetalhePaciente}" data-id="${paciente.id}" ${atendimentoIdAttr}>
                    ${nomeCompleto}
                </a>
            </td>
            <td>${telefone}</td>
            <td>${email}</td>
            <td>
                <span class="status-badge ${displayStatusClass}">${displayStatus}</span>
            </td>
        </tr>
    `;
}
