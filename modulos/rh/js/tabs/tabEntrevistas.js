// modulos/rh/js/tabs/tabEntrevistas.js

import { getGlobalState } from '../recrutamento.js';
import { getDocs, query, where } from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevistas e Avaliações (Layout de Cartão).
 */
export async function renderizarEntrevistas(state) {
    const { vagaSelecionadaId, conteudoRecrutamento, candidatosCollection, statusCandidaturaTabs } = state;

 if (!vagaSelecionadaId) {
  conteudoRecrutamento.innerHTML =
   '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
  return;
 }

 conteudoRecrutamento.innerHTML =
  '<div class="loading-spinner">Carregando candidatos em Entrevistas/Avaliações...</div>';

 try {
  const q = query(
   candidatosCollection,
   where("vaga_id", "==", vagaSelecionadaId),
   where("status_recrutamento", "in", [
    "Triagem Aprovada (Entrevista Pendente)",
    "Entrevista RH Aprovada (Testes Pendente)",
    "Testes Pendente",
   ])
  );
  const snapshot = await getDocs(q);

  // Atualiza contagem na aba
  const tab = statusCandidaturaTabs.querySelector(
   '.tab-link[data-status="entrevistas"]'
  );
  if (tab) tab.textContent = `3. Entrevistas e Avaliações (${snapshot.size})`;

  if (snapshot.empty) {
   conteudoRecrutamento.innerHTML =
    '<p class="alert alert-warning">Nenhuma candidato na fase de Entrevistas/Avaliações.</p>';
   return;
  }

  let listaHtml = `
      <div class="list-candidaturas">
        <h3>Candidaturas em Entrevistas e Testes (${snapshot.size})</h3>
    `;

  snapshot.docs.forEach((docSnap) => {
   const cand = docSnap.data();
   const candidatoId = docSnap.id;
   const statusAtual = cand.status_recrutamento || "N/A";
        
        let corStatus = "info";
   if (statusAtual.includes("Aprovada")) {
    corStatus = "success";
   } else if (statusAtual.includes("Testes")) {
    corStatus = "warning";
   }
        
        // Formatação de contato e WhatsApp, idêntica à Triagem
   const telefone = cand.telefone_contato ? cand.telefone_contato.replace(/\D/g, '') : '';
   const linkWhatsApp = telefone ? `https://api.whatsapp.com/send?phone=55${telefone}` : '#';

   listaHtml += `
   <div class="card card-candidato-triagem" data-id="${candidatoId}">
    <div class="info-primaria">
      <h4>${cand.nome_completo || "Candidato Sem Nome"}</h4>
      <p>Status: <span class="badge bg-${corStatus}">${statusAtual.replace(
        "_",
        " "
      )}</span></p>
    </div>
    
    <div class="info-contato">
      <a href="${linkWhatsApp}" target="_blank" class="whatsapp" ${!telefone ? 'disabled' : ''}>
        <i class="fab fa-whatsapp me-1"></i> ${cand.telefone_contato || 'N/A (Sem WhatsApp)'}
      </a>
    </div>
    
    <div class="acoes-candidato">
      <button 
        class="action-button info btn-detalhes-entrevista" 
        data-id="${candidatoId}"
        data-candidato-data='${JSON.stringify(cand).replace(/'/g, '&#39;')}'>
        <i class="fas fa-info-circle me-1"></i> Detalhes
      </button>
      <button 
                data-etapa="${statusAtual}"
        class="action-button primary btn-avaliar-entrevista" 
        data-id="${candidatoId}"
        data-candidato-data='${JSON.stringify(cand).replace(/'/g, '&#39;')}'>
        <i class="fas fa-calendar-check me-1"></i> ${statusAtual.includes("Entrevista Pendente") ? 'Agendar / Avaliar RH' : 'Avaliar Testes'}
      </button>
    </div>
   </div>
  `;
  });

  listaHtml += "</div>";
  conteudoRecrutamento.innerHTML = listaHtml;

  // Configura evento para abrir modal de detalhes (modalCandidato)
  document.querySelectorAll(".btn-detalhes-entrevista").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const candidatoId = e.currentTarget.getAttribute("data-id");
      const dados = JSON.parse(e.currentTarget.getAttribute("data-candidato-data").replace(/&#39;/g, "'"));
      window.abrirModalCandidato(candidatoId, "detalhes", dados); 
    });
  });
  
  // Configura evento para abrir o NOVO modal de Entrevista RH
  document.querySelectorAll(".btn-avaliar-entrevista").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const candidatoId = e.currentTarget.getAttribute("data-id");
      const dados = JSON.parse(e.currentTarget.getAttribute("data-candidato-data").replace(/&#39;/g, "'"));
            
            // 🔴 CORREÇÃO: Chama a nova função de modal
      window.abrirModalEntrevistaRH(candidatoId, dados); 
    });
  });

 } catch (error) {
  console.error("Erro ao renderizar entrevistas:", error);
  conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos para entrevistas: ${error.message}</p>`;
 }
}