// modulos/rh/js/tabs/tabGestor.js
import { getGlobalState } from "../recrutamento.js";
import { getDocs, query, where } from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevista com Gestor.
 * Versão original funcional com estilo visual padronizado ao tabEntrevistas.js.
 */
export async function renderizarEntrevistaGestor(state) {
  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML = `
      <div class="alert alert-info">
        <p><i class="fas fa-info-circle"></i> Nenhuma vaga selecionada.</p>
      </div>
    `;
    return;
  }

  // Loading spinner com estilo do rh.css (igual ao tabEntrevistas)
  conteudoRecrutamento.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i> Carregando candidatos para Entrevista com Gestor...
    </div>
  `;

  try {
    // Query Firestore EXATA do código original
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "Entrevista com Gestor Agendada",
        "Aguardando Entrevista com Gestor",
        "Entrevista com Gestor Pendente",
        "Entrevista com Gestor Concluída",
      ])
    );

    const snapshot = await getDocs(q);

    // Atualização de contagem EXATA do original
    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="gestor"]'
    );
    if (tab) {
      tab.textContent = `4. Entrevista com Gestor (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML = `
        <div class="alert alert-warning">
          <p><i class="fas fa-exclamation-triangle"></i> Nenhuma candidatura na fase de Entrevista com Gestor.</p>
        </div>
      `;
      return;
    }

    // Container grid com classes do rh.css (igual ao tabEntrevistas)
    let listaHtml = `
      <div class="candidatos-container candidatos-grid">
        <h3 class="section-title">
          <i class="fas fa-users"></i> Candidatos - Entrevista com Gestor (${snapshot.size})
        </h3>
    `;

    // Loop forEach EXATO do original, com HTML estilizado
    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";

      // Determina classe CSS baseada no status existente (sem criar novos valores)
      let statusClass = "status-info";
      if (
        statusAtual.toLowerCase().includes("pendente") ||
        statusAtual.toLowerCase().includes("aguardando")
      ) {
        statusClass = "status-warning";
      } else if (
        statusAtual.toLowerCase().includes("concluída") ||
        statusAtual.toLowerCase().includes("aprovado")
      ) {
        statusClass = "status-success";
      }

      listaHtml += `
        <div class="card card-candidato-gestor">
          <div class="info-primaria">
            <h4 class="nome-candidato">
              ${cand.nome_completo || "Nome não informado"}
              <span class="status-badge ${statusClass}">
                <i class="fas fa-tag"></i> Status: ${statusAtual}
              </span>
            </h4>
            <p class="small-info">
              <i class="fas fa-briefcase"></i> Etapa: Entrevista com Gestor.
            </p>
          </div>

          <!-- Info contato se existir (estilo do tabEntrevistas) -->
          <div class="info-contato">
            ${
              cand.email_candidato
                ? `<p><i class="fas fa-envelope"></i> ${cand.email_candidato}</p>`
                : ""
            }
            ${
              cand.telefone_contato
                ? `<p><i class="fas fa-phone"></i> ${cand.telefone_contato}</p>`
                : ""
            }
          </div>

          <!-- Ações com classes action-button do rh.css -->
          <div class="acoes-candidato">
            <button class="action-button primary" onclick="avaliarGestor('${
              doc.id
            }');">
              <i class="fas fa-user-tie"></i> Avaliar Gestor
            </button>
            <button class="action-button secondary" onclick="detalhesCandidato('${
              doc.id
            }');">
              <i class="fas fa-eye"></i> Detalhes
            </button>
            ${
              cand.link_curriculo
                ? `
              <a href="${cand.link_curriculo}" target="_blank" class="action-button info">
                <i class="fas fa-file-pdf"></i> Currículo
              </a>
            `
                : ""
            }
          </div>
        </div>
      `;
    });

    // Fecha container (igual ao tabEntrevistas)
    listaHtml += `
      </div>
    `;

    conteudoRecrutamento.innerHTML = listaHtml;
  } catch (error) {
    // Tratamento de erro EXATO do original
    console.error("Erro ao carregar a lista de candidatos:", error);
    conteudoRecrutamento.innerHTML = `
      <div class="alert alert-danger">
        <p><i class="fas fa-exclamation-circle"></i> Erro ao carregar a lista de candidatos: ${error.message}</p>
      </div>
    `;
  }
}

// Funções globais para ações (preservam chamadas originais)
window.avaliarGestor = function (candidatoId) {
  console.log(`Avaliando candidato gestor ID: ${candidatoId}`);
  // Chame sua função original de avaliação aqui
};

window.detalhesCandidato = function (candidatoId) {
  console.log(`Abrindo detalhes do candidato ID: ${candidatoId}`);
  // Chame sua função original de detalhes aqui
};
