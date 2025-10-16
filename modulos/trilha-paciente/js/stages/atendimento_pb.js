// modulos/trilha-paciente/js/stages/atendimento_pb.js

export function carregarEtapa(paciente) {
  // Formata a data para o padrão brasileiro (dd/mm/aaaa)
  const dataInicio = paciente.pbInfo.dataInicio
    ? new Date(paciente.pbInfo.dataInicio).toLocaleDateString("pt-BR")
    : "Não informada";

  // Retorna o HTML que será exibido na Trilha do Paciente para esta etapa
  return `
        <div class="info-atendimento-pb">
            <h4>Informações do Atendimento</h4>
            <div class="info-item">
                <span class="info-label">Nome do Profissional:</span>
                <span class="info-value">${
                  paciente.pbInfo.profissionalNome || "Não informado"
                }</span>
            </div>
            <div class="info-item">
                <span class="info-label">Data de Início do Atendimento:</span>
                <span class="info-value">${dataInicio}</span>
            </div>
        </div>
    `;
}
