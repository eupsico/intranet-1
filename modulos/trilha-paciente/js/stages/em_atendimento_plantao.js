// Arquivo: /modulos/trilha-paciente/js/stages/em_atendimento_plantao.js
// Versão: 2.0 (Migrado para a sintaxe modular do Firebase v9)

import { db, doc, getDoc } from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza o conteúdo do modal para a etapa "Em Atendimento (Plantão)".
 * Esta é uma visão de resumo para o Serviço Social.
 * @param {string} cardId - O ID do documento do paciente.
 * @param {string} cardTitle - O nome do paciente.
 * @returns {HTMLElement} O elemento HTML com o resumo informativo.
 */
export async function render(cardId, cardTitle) {
  // Busca os dados mais recentes do paciente com a sintaxe v9.
  const docRef = doc(db, "trilhaPaciente", cardId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    const errorElement = document.createElement("div");
    errorElement.textContent = "Erro: Paciente não encontrado.";
    return errorElement;
  }
  const data = docSnap.data();
  const plantaoInfo = data.plantaoInfo || {};

  // Formata a data e a hora da sessão para exibição
  const dataSessao = plantaoInfo.dataPrimeiraSessao
    ? new Date(plantaoInfo.dataPrimeiraSessao + "T03:00:00").toLocaleDateString(
        "pt-BR"
      )
    : "Não informada";
  const horaSessao = plantaoInfo.horaPrimeiraSessao || "Não informado";
  const sessaoCompleta = `${dataSessao} às ${horaSessao}`;

  // Cria o link do formulário que o profissional irá preencher
  const linkFormulario = `https://eupsico.com.br/intranet/modulos/voluntario/page/portal-voluntario.html`;

  // Monta o HTML do resumo com as informações solicitadas.
  const content = `
    <div class="patient-info-box confirmation">
        <h4>Agendamento Confirmado Plantão (${
          plantaoInfo.tipoAtendimento || "N/A"
        })</h4>
        <p><strong>Paciente:</strong> ${
          data.nomeCompleto || "Não informado"
        }</p>
        <p><strong>Responsável:</strong> ${
          data.responsavel?.nome || "Não aplicável"
        }</p>
        <p><strong>Nome do Terapeuta:</strong> ${
          plantaoInfo.profissionalNome || "Não informado"
        }</p>
        <p><strong>Sessão:</strong> ${sessaoCompleta}</p>
        <p><strong>Telefone de contato:</strong> ${
          data.telefoneCelular || "Não informado"
        }</p>
        <p><strong>Contribuição:</strong> ${
          data.valorContribuicao || "Não definido"
        }</p>

        
    </div>
    <p class="description-box" style="margin-top: 20px;">
        Esta etapa é de responsabilidade do profissional de atendimento. 
        As ações de encerramento do plantão são realizadas por ele na tela "Meus Pacientes".
    </p>
  `;

  // Cria o elemento HTML, insere o conteúdo e o retorna.
  const element = document.createElement("div");
  element.innerHTML = content;
  return element;
}

// Como esta etapa no Kanban é apenas de VISUALIZAÇÃO,
// não há função 'save'. O botão "Salvar" será automaticamente escondido.
