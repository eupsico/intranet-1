// modulos/rh/js/tabs/tabCronograma.js

import { getGlobalState } from '../recrutamento.js';
import { getDoc, doc } from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza o cronograma da vaga.
 */
export async function renderizarCronograma(state) {
    const { vagaSelecionadaId, conteudoRecrutamento, vagasCollection } = state;

 if (!vagaSelecionadaId) {
  conteudoRecrutamento.innerHTML =
   '<p class="alert alert-info">Selecione uma vaga para iniciar a gestão do cronograma.</p>';
  return;
 }

    // O statusCandidaturaTabs e filtroVaga não estão no state, mas assumimos que o principal
    // já garantiu que a aba Cronograma está ativa e que o vagaSelecionadaId é válido.
    const filtroVaga = document.getElementById("filtro-vaga");
   let vagaNome = filtroVaga.options[filtroVaga.selectedIndex].text;

 // Tenta carregar os dados de cronograma da vaga
 let dadosCronograma = {
  data_inicio_recrutamento: "N/A",
  data_fechamento_recrutamento: "N/A",
  data_contratacao_prevista: "N/A",
  orcamento_previsto: 0,
  detalhes_cronograma: "Não informado.",
  fonte_orcamento: "Não informado.",
 };

 try {
  const vagaDoc = await getDoc(doc(vagasCollection, vagaSelecionadaId));
  if (vagaDoc.exists()) {
   const vagaData = vagaDoc.data();
   dadosCronograma = {
    data_inicio_recrutamento: vagaData.data_inicio_recrutamento || "N/A",
    data_fechamento_recrutamento:
     vagaData.data_fechamento_recrutamento || "N/A",
    data_contratacao_prevista: vagaData.data_contratacao_prevista || "N/A",
    orcamento_previsto: vagaData.orcamento_previsto || 0,
    fonte_orcamento: vagaData.fonte_orcamento || "Não informado.",
    detalhes_cronograma: vagaData.detalhes_cronograma || "Não informado.",
   };
  }
 } catch (e) {
  console.error("Erro ao carregar cronograma da vaga:", e);
 }
 
 // Serializa o objeto dadosCronograma e escapa as aspas para usar no onclick
 const dadosCronogramaJson = JSON.stringify(dadosCronograma).replace(/"/g, '&quot;');

 conteudoRecrutamento.innerHTML = `
  <div class="painel-cronograma card card-shadow p-4">
   <h3>Cronograma e Orçamento da Vaga: ${vagaNome}</h3>
   
   <div class="detalhes-cronograma-resumo mb-4">
    <p><strong>Início Previsto do Recrutamento:</strong> ${dadosCronograma.data_inicio_recrutamento}</p>
    <p><strong>Término Previsto do Recrutamento:</strong> ${dadosCronograma.data_fechamento_recrutamento}</p>
    <p><strong>Contratação Prevista:</strong> ${dadosCronograma.data_contratacao_prevista}</p>
    <p><strong>Orçamento Estimado:</strong> R$ ${dadosCronograma.orcamento_previsto.toFixed(2)} (${dadosCronograma.fonte_orcamento})</p>
    <p><strong>Observações:</strong> ${dadosCronograma.detalhes_cronograma}</p>
   </div>
   
   <button type="button" class="action-button secondary" 
      onclick='window.abrirModalCronograma("${vagaSelecionadaId}", ${dadosCronogramaJson})'>
    <i class="fas fa-edit me-2"></i> Editar/Ajustar
   </button>
   </div>
 `;
}