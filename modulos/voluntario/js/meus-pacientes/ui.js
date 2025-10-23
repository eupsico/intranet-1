// Arquivo: /modulos/voluntario/js/meus-pacientes/ui.js

// --- CORREÇÃO NA FUNÇÃO calcularIdade ---
// Esta função é mantida, pois pode ser usada por outros módulos,
// embora não seja mais usada pela 'criarCardPaciente' nesta página.
export function calcularIdade(dataNascimento) {
  // Retorna "N/A" se a data for inválida, nula ou vazia
  if (
    !dataNascimento ||
    typeof dataNascimento !== "string" ||
    dataNascimento.trim() === ""
  ) {
    return "N/A";
  } // Tenta criar uma data. Se for inválida, retorna "N/A"

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
  } // Retorna "N/A" se a idade calculada for negativa (data futura?)
  return idade >= 0 ? `${idade} anos` : "N/A";
}
// --- FIM DA CORREÇÃO ---

/**
 * REFATORAÇÃO:
 * A função 'criarAccordionPaciente' foi substituída por 'criarCardPaciente'.
 * Esta nova função gera um link (<a>) em vez de um accordion expansível.
 * Todo o conteúdo detalhado e botões de ação foram removidos,
 * pois agora eles pertencerão à página 'detalhe-paciente.html'.
 */
export function criarCardPaciente(paciente, atendimentoPB = null) {
  // Define a URL para a nova página de detalhes do paciente.
  // Usamos o roteador da aplicação (parâmetros 'p' e 's') e passamos o ID.
  const urlDetalhePaciente = `?p=voluntario&s=detalhe-paciente&id=${paciente.id}`; // O 'atendimentoId' ainda é necessário caso a página de detalhes precise // saber qual atendimento específico (em caso de múltiplos) está sendo visualizado. // Adicionamos como um data attribute no link para referência, se necessário, // ou pode ser adicionado à URL. Por simplicidade, vamos mantê-lo aqui.

  const atendimentoIdAttr = atendimentoPB
    ? `data-atendimento-id="${atendimentoPB.atendimentoId}"`
    : "";

  return `
            <a href="${urlDetalhePaciente}" class="paciente-card" data-id="${
    paciente.id
  }" ${atendimentoIdAttr}>
              <div class="card-info">
                  <span class="nome">${paciente.nomeCompleto}</span>
                  <span class="telefone">${
    paciente.telefoneCelular || "Telefone não informado"
  }</span>
              </div>
              <span class="card-icon">&rarr;</span>
      </a>
  `;
}
