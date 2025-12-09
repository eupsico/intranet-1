/**
 * Arquivo: rh/js/utils/status_utils.js
 * Descrição: Centraliza os status e formatações para evitar duplicação e dependência circular.
 */

export const MAPA_STATUS = {
  // Status Novos (Simplificados)
  TRIAGEM_PENDENTE: "Candidatura Recebida",
  ENTREVISTA_RH_PENDENTE: "Aguardando Entrevista RH",
  ENTREVISTA_RH_AGENDADA: "Entrevista RH Agendada",
  TESTE_PENDENTE: "Aguardando Envio de Teste",
  TESTE_ENVIADO: "Teste Enviado (Aguardando Resposta)",
  TESTE_RESPONDIDO: "Teste Respondido (Aguardando Correção)",
  ENTREVISTA_GESTOR_PENDENTE: "Aguardando Entrevista Gestor",
  ENTREVISTA_GESTOR_AGENDADA: "Entrevista Gestor Agendada",
  AGUARDANDO_ADMISSAO: "Aprovado (Aguardando Admissão)",
  REPROVADO: "Processo Encerrado (Reprovado)",
  REPROVADO_TRIAGEM: "Reprovado na Triagem",
  CONTRATADO: "Contratado",
  DESISTENCIA: "Desistência",

  // Status Legados (Mantidos para compatibilidade)
  "Candidatura Recebida (Triagem Pendente)": "Candidatura Recebida",
  "Triagem Aprovada (Entrevista Pendente)": "Aguardando Entrevista RH",
  "Entrevista RH Aprovada (Testes Pendente)": "Aguardando Testes",
  "Testes Pendente": "Aguardando Testes",
  "Testes Pendente (Enviado)": "Teste Enviado",
  "Entrevista Gestor Pendente": "Aguardando Gestor",
  "Rejeitado (Comunicação Pendente)": "Reprovado",
};

/**
 * Converte status técnico (SNAKE_CASE) para texto legível
 */
export function formatarStatusLegivel(statusTecnico) {
  if (!statusTecnico) return "N/A";
  return MAPA_STATUS[statusTecnico] || statusTecnico;
}

/**
 * Retorna a classe CSS (badge) baseada no status
 */
export function getStatusBadgeClass(status) {
  if (!status) return "status-pendente";
  const statusLower = status.toLowerCase();

  if (
    statusLower.includes("aprovad") ||
    statusLower.includes("contratad") ||
    statusLower.includes("concluída") ||
    statusLower === "admissao_iniciada"
  ) {
    return "status-concluída"; // Verde
  } else if (
    statusLower.includes("rejeit") ||
    statusLower.includes("reprov") ||
    statusLower === "reprovado"
  ) {
    return "status-rejeitada"; // Vermelho
  } else {
    return "status-pendente"; // Amarelo/Azul
  }
}
