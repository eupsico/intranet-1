// modulos/rh/js/tabs/tabFinalizados.js

import { getGlobalState } from '../recrutamento.js';
import { getDocs, query, where } from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos na etapa de Finalizados (Contratados ou Rejeitados na fase final).
 */
export async function renderizarFinalizados(state) {
    const { vagaSelecionadaId, conteudoRecrutamento, candidatosCollection, statusCandidaturaTabs } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
    return;
  }

  conteudoRecrutamento.innerHTML =
    '<div class="loading-spinner">Carregando candidatos finalizados...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "Contratado",
        "Rejeitado (Comunicação Final)",
        "Triagem Reprovada (Encerrada)",
      ])
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="finalizados"]'
    );
    if (tab) tab.textContent = `5. Finalizados (${snapshot.size})`;

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhuma candidatura finalizada para esta vaga.</p>';
      return;
    }

    let listaHtml = `
            <div class="list-candidaturas">
                <h3>Candidaturas Finalizadas (${snapshot.size})</h3>
                <p>Lista de candidatos contratados ou que receberam comunicação final de rejeição.</p>
        `;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";

      let corStatus = "secondary";
      if (statusAtual.includes("Contratado")) corStatus = "success";
      else if (
        statusAtual.includes("Rejeitado") ||
        statusAtual.includes("Reprovada")
      )
        corStatus = "danger";

      listaHtml += `
                <div class="card card-candidato" data-id="${doc.id}">
                    <h4>${cand.nome_completo || "Candidato Sem Nome"}</h4>
                    <p>Status: <span class="badge bg-${corStatus}">${statusAtual}</span></p>
                    <div class="acoes-candidato">
                    <button class="btn btn-sm btn-outline-secondary btn-ver-detalhes" data-id="${
                      doc.id
                    }">Ver Histórico</button>
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
    console.error("Erro ao renderizar finalizados:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos finalizados: ${error.message}</p>`;
  }
}