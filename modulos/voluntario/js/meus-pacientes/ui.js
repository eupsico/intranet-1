// Arquivo: /modulos/voluntario/js/meus-pacientes/ui.js
// Versão com correção de Roteamento (Hash) e Linha Clicável

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
 *
 * *** CORREÇÕES APLICADAS ***
 * 1. A linha inteira (<tr>) agora é clicável.
 * 2. O link usa o roteamento por HASH (#) para navegar para detalhe-paciente,
 * corrigindo o bug que redirecionava ao dashboard.
 */
export function criarLinhaPacienteTabela(paciente, atendimentoPB = null) {
  // --- CORREÇÃO 1: Mudar a URL para usar o HASH (#) em vez de parâmetros (?)
  // Isso garante que o roteador interno (portal-voluntario.js) seja usado.
  const urlDetalhePaciente = `#detalhe-paciente/${paciente.id}`;

  // Atendimento ID pode ser útil na página de detalhes, mantido como data attribute na linha
  const atendimentoIdAttr = atendimentoPB
    ? `data-atendimento-id="${atendimentoPB.atendimentoId}"`
    : "";

  // Obter dados para as colunas
  const nomeCompleto = paciente.nomeCompleto || "Nome não disponível";
  const telefone = paciente.telefoneCelular || "Não informado";
  const email = paciente.email || "Não informado"; // Assumindo que o campo 'email' existe no objeto paciente
  const statusPaciente = paciente.status || "desconhecido";

  // --- Lógica de Status (Inalterada) ---
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

  // --- CORREÇÃO 2: Aplicar o clique na linha (<tr>) e remover o link (<a>) do nome
  // Adicionado style="cursor: pointer;" e o onclick="window.location.hash=..."
  return `
        <tr style="cursor: pointer;" onclick="window.location.hash='${urlDetalhePaciente}'" data-id="${paciente.id}" ${atendimentoIdAttr}>
            <td>
                ${nomeCompleto}
            </td>
            <td>${telefone}</td>
            <td>${email}</td>
            <td>
                <span class="status-badge ${displayStatusClass}">${displayStatus}</span>
            </td>
        </tr>
    `;
}
