export function setupAgendamentoConfirmadoPlantao(
  db,
  functions,
  trilhaId,
  data
) {
  const plantaoInfo = data.plantaoInfo || {};
  const content = `
        <div class="patient-info-box confirmation">
            <h4>Agendamento Confirmado - Plantão</h4>
            <p><strong>Paciente:</strong> ${
              data.nomeCompleto || "Não informado"
            }</p>
            <p><strong>Responsável:</strong> ${
              data.responsavel?.nome || "N/A"
            }</p>
            <p><strong>Nome do Terapeuta:</strong> ${
              plantaoInfo.profissionalNome || "Não informado"
            }</p>
            <p><strong>Data e Horário da Sessão:</strong> ${
              plantaoInfo.dataPrimeiraSessao
                ? new Date(
                    plantaoInfo.dataPrimeiraSessao + "T00:00:00"
                  ).toLocaleDateString("pt-BR")
                : ""
            } às ${plantaoInfo.horaPrimeiraSessao || ""}</p>
            <p><strong>Telefone de Contato:</strong> ${
              data.telefoneCelular || "Não informado"
            }</p>
            <p><strong>Contribuição:</strong> ${
              data.valorContribuicao || "Não informado"
            }</p>
            <p><strong>Atendimento:</strong> ${
              plantaoInfo.tipoAtendimento || "Não informado"
            }</p>
        </div>
    `;
  const element = document.createElement("div");
  element.innerHTML = content;
  return element;
}
