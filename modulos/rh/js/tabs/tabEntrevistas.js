// modulos/rh/js/tabs/tabEntrevistas.js

import { getGlobalState } from '../recrutamento.js';
import { getDocs, query, where } from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevistas e Avaliações.
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
        <p>Gerencie as etapas de Entrevista com RH, Testes e Estudos de Caso. (Link de etapa a ser criado)</p>
    `;

  snapshot.docs.forEach((doc) => {
   const cand = doc.data();
   const statusAtual = cand.status_recrutamento || "N/A";

   // Lógica para determinar a URL da próxima página (Entrevista RH ou Aplicação de Testes)
   let proximaEtapaUrl = "";
   let acaoBotao = "";
   if (statusAtual.includes("Entrevista Pendente")) {
    proximaEtapaUrl = `etapa_entrevista_rh.html?candidatura=${doc.id}&vaga=${vagaSelecionadaId}`;
    acaoBotao = "Entrevista RH";
   } else if (statusAtual.includes("Testes Pendente")) {
    proximaEtapaUrl = `etapa_aplicacao_testes.html?candidatura=${doc.id}&vaga=${vagaSelecionadaId}`;
    acaoBotao = "Aplicar Testes";
   } else {
    proximaEtapaUrl = `etapa_entrevista_rh.html?candidatura=${doc.id}&vaga=${vagaSelecionadaId}`;
    acaoBotao = "Ver Etapa";
   }

   let corStatus = "primary";
   if (statusAtual.includes("Aprovada")) corStatus = "success";

   listaHtml += `
        <div class="card card-candidato" data-id="${doc.id}">
          <h4>${cand.nome_completo || "Candidato Sem Nome"}</h4>
          <p>Status: <span class="badge bg-${corStatus}">${statusAtual}</span></p>
          <p class="small-info">Ação: ${acaoBotao}</p>
          <div class="acoes-candidato">
          <a href="${proximaEtapaUrl}" class="btn btn-sm btn-info">
            <i class="fas fa-play me-2"></i> ${acaoBotao}
          </a>
          <button class="btn btn-sm btn-outline-secondary btn-ver-detalhes" data-id="${
           doc.id
          }">Detalhes</button>
          </div>
        </div>
      `;
  });

  listaHtml += "</div>";
  conteudoRecrutamento.innerHTML = listaHtml;

  // 🔴 CORREÇÃO: Listener dinâmico para garantir que o botão funcione após renderização.
  document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
   btn.addEventListener("click", (e) => {
    const candidatoId = e.currentTarget.getAttribute("data-id");
    // Chama a função global, que foi exposta em recrutamento.js
    window.abrirModalCandidato(candidatoId, "detalhes"); 
   });
  });
 } catch (error) {
  console.error("Erro ao renderizar entrevistas:", error);
  conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos para entrevistas: ${error.message}</p>`;
 }
}