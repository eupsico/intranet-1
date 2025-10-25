// Arquivo: /modulos/voluntario/js/detalhes-paciente/utilitarios.js
// Funções auxiliares puras e de formatação.

/**
 * Calcula a idade a partir da data de nascimento.
 * @param {string | null | undefined} dataNascimento - String no formato YYYY-MM-DD ou ISO 8601.
 * @returns {string} - A idade formatada (ex: "30 anos") ou "N/A".
 */
export function calcularIdade(dataNascimento) {
  if (
    !dataNascimento ||
    typeof dataNascimento !== "string" ||
    dataNascimento.trim() === ""
  ) {
    return "N/A";
  }
  try {
    // Tenta normalizar para garantir que a hora não afete o cálculo
    const dateStringOnly = dataNascimento.split("T")[0];
    const [year, month, day] = dateStringOnly.split("-").map(Number);

    if (!year || !month || !day) {
      // Validação simples
      console.warn(
        "Formato de dataNascimento inválido ao calcular idade:",
        dataNascimento
      );
      return "N/A";
    }

    const nasc = new Date(Date.UTC(year, month - 1, day)); // Usa UTC para consistência
    const hoje = new Date();
    const hojeUTC = new Date(
      Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())
    );

    if (isNaN(nasc.getTime())) {
      console.warn(
        "Data de nascimento inválida após conversão:",
        dataNascimento
      );
      return "N/A";
    }

    let idade = hojeUTC.getUTCFullYear() - nasc.getUTCFullYear();
    const m = hojeUTC.getUTCMonth() - nasc.getUTCMonth(); // Ajusta a idade se o aniversário no ano corrente ainda não passou

    if (m < 0 || (m === 0 && hojeUTC.getUTCDate() < nasc.getUTCDate())) {
      idade--;
    }

    return idade >= 0 ? `${idade} anos` : "N/A"; // Retorna N/A se idade for negativa (data futura?)
  } catch (e) {
    console.warn("Erro ao calcular idade para:", dataNascimento, e);
    return "N/A";
  }
}

/**
 * Formata um status interno (snake_case) para um texto legível.
 * @param {string | null | undefined} status - O status interno.
 * @returns {string} - O status formatado ou "Desconhecido".
 */
export function formatarStatus(status) {
  const mapaStatus = {
    em_atendimento_plantao: "Em Atendimento (Plantão)",
    aguardando_info_horarios: "Aguardando Horários (PB)",
    cadastrar_horario_psicomanager: "Horários Informados (PB)",
    em_atendimento_pb: "Em Atendimento (PB)",
    alta: "Alta",
    desistencia: "Desistência",
    encaminhado_grupo: "Encaminhado p/ Grupo",
    encaminhado_parceiro: "Encaminhado p/ Parceiro",
    encaminhar_para_pb: "Encaminhado para PB",
    reavaliar_encaminhamento: "Reavaliar Encaminhamento",
    triagem_agendada: "Triagem Agendada",
    inscricao_documentos: "Aguardando Documentos",
    aguardando_reavaliacao: "Aguardando Reavaliação",
    desistencia_antes_inicio: "Desistência (Antes Início PB)",
    solicitado_reencaminhamento: "Solicitado Reencaminhamento",
    encaminhado_outro: "Encaminhado (Outro)", // Status genérico do encerramento
    // Adicionar outros status conforme necessário
  };

  if (status && mapaStatus[status]) {
    return mapaStatus[status];
  } // Fallback: Transforma snake_case em Title Case

  if (typeof status === "string" && status.trim() !== "") {
    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return "Desconhecido";
}

/**
 * Formata uma data YYYY-MM-DD para DD/MM/YYYY.
 * @param {string | null | undefined} dataString - A data no formato YYYY-MM-DD.
 * @returns {string} - A data formatada ou a string original se inválida.
 */
export function formatarDataParaTexto(dataString) {
  if (!dataString || !/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
    return dataString || ""; // Retorna string vazia se for null/undefined
  }
  const [ano, mes, dia] = dataString.split("-");
  return `${dia}/${mes}/${ano}`;
}
