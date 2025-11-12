// modulos/rh/js/tabs/tabGestor.js
import { getGlobalState } from "../recrutamento.js";
import { getDocs, query, where } from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevista com Gestor.
 * Estilo visual padronizado ao tabEntrevistas.js, mantendo 100% da funcionalidade original.
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

  // Loading spinner com classes do rh.css
  conteudoRecrutamento.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i> Carregando candidatos para Entrevista com Gestor...
    </div>
  `;

  try {
    // Query Firestore EXATA do original
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "Testes Aprovado",
        "Entrevista Gestor Pendente",
        "Entrevista Gestor Agendada",
        "Aguardando Avaliação Gestor",
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

    // Container com grid do rh.css (igual tabEntrevistas)
    let listaHtml = `
      <div class="candidatos-container candidatos-grid">
    `;

    // Loop forEach EXATO do original com estrutura de cards do tabEntrevistas
    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";
      const candidaturaId = doc.id;

      // Classe CSS dinâmica baseada no status real (igual tabEntrevistas)
      let statusClass = "status-info";
      if (
        statusAtual.toLowerCase().includes("pendente") ||
        statusAtual.toLowerCase().includes("aguardando")
      ) {
        statusClass = "status-warning";
      } else if (
        statusAtual.toLowerCase().includes("aprovado") ||
        statusAtual.toLowerCase().includes("concluída")
      ) {
        statusClass = "status-success";
      }

      listaHtml += `
        <div class="card card-candidato-gestor" data-id="${candidaturaId}">
          <div class="info-primaria">
            <h4 class="nome-candidato">
              ${cand.nome_completo || "Candidato Sem Nome"}
              <span class="status-badge ${statusClass}">
                <i class="fas fa-tag"></i> ${statusAtual}
              </span>
            </h4>
            <p class="small-info">
              <i class="fas fa-briefcase"></i> Etapa: Entrevista com Gestor.
            </p>
          </div>

          <!-- Informações de contato (igual tabEntrevistas) -->
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

          <!-- AÇÕES EXATAMENTE COMO NO ORIGINAL -->
          <div class="acoes-candidato">
            <!-- Botão Avaliar Gestor - CHAMADA ORIGINAL PRESERVADA -->
            <a href="etapa-entrevista-gestor.html?candidatura=${candidaturaId}&vaga=${vagaSelecionadaId}" 
               class="action-button primary" 
               style="padding: 10px 16px; background: var(--cor-primaria); color: white; text-decoration: none; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fas fa-user-tie"></i> Avaliar Gestor
            </a>
            
            <!-- Botão Detalhes - COM CLASSE ORIGINAL PRESERVADA -->
            <button class="action-button secondary btn-ver-detalhes" 
                    data-id="${candidaturaId}"
                    style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fas fa-eye"></i> Detalhes
            </button>
            
            <!-- Botão Currículo se existir -->
            ${
              cand.link_curriculo_drive
                ? `
              <a href="${cand.link_curriculo_drive}" target="_blank" class="action-button info" 
                 style="padding: 10px 16px; background: var(--cor-info); color: white; text-decoration: none; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fas fa-file-pdf"></i> Currículo
              </a>
            `
                : ""
            }
          </div>
        </div>
      `;
    });

    listaHtml += `
      </div>
    `;

    conteudoRecrutamento.innerHTML = listaHtml;

    // EVENT LISTENERS EXATAMENTE COMO NO ORIGINAL (APÓS RENDERIZAÇÃO)
    console.log("Gestor: Anexando listeners aos botões...");

    // Listener para botões Detalhes (EXATAMENTE COMO NO ORIGINAL)
    document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const candidatoId = e.currentTarget.getAttribute("data-id");

        // Chama a função global ORIGINAL que já existe no seu sistema
        if (window.abrirModalCandidato) {
          window.abrirModalCandidato(candidatoId, "detalhes");
        }
      });
    });

    console.log(
      `Gestor: ${snapshot.size} candidatos renderizados com listeners`
    );
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
