// modulos/rh/js/tabs/tabGestor.js

import { getGlobalState } from "../recrutamento.js";
import { getDocs, query, where } from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevista com Gestor.
 */
export async function renderizarEntrevistaGestor(state) {
  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Nenhuma vaga selecionada.</p>';
    return;
  }

  conteudoRecrutamento.innerHTML =
    '<div class="loading-spinner">Carregando candidatos para Entrevista com Gestor...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where(
        "status_recrutamento",
        "==",
        "Teste Aprovado (Entrevista Gestor Pendente)"
      )
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="gestor"]'
    );
    if (tab) tab.textContent = `4. Entrevista com Gestor (${snapshot.size})`;

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhuma candidato na fase de Entrevista com Gestor.</p>';
      return;
    }

    let listaHtml = `
      <div class="list-candidaturas">
        <h3>Candidaturas na Fase Entrevista com Gestor (${snapshot.size})</h3>
        <p>Avaliação final antes da comunicação e contratação.</p>
    `;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";

      listaHtml += `
        <div class="card card-candidato" data-id="${doc.id}">
          <h4>${cand.nome_completo || "Candidato Sem Nome"}</h4>
          <p>Status: <span class="badge bg-primary">${statusAtual}</span></p>
          <p class="small-info">Etapa: Entrevista com Gestor.</p>
          <div class="acoes-candidato">
          <a href="etapa_entrevista_gestor.html?candidatura=${
            doc.id
          }&vaga=${vagaSelecionadaId}" class="btn btn-sm btn-info">
            <i class="fas fa-user-tie me-2"></i> Avaliar Gestor
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
    console.log("Erro ao renderizar entrevista gestor:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-danger">Erro ao carregar a lista de candidatos: ${error.message}</p>`;
  }
}
