/**
 * Arquivo: modulos/rh/js/tabs/tabDocsPos3Meses.js
 * Versão: 2.2.0 (Integrado com Modal Global de Documentos - Fase 2)
 * Descrição: Gerencia a etapa final de envio de documentos pós-experiência.
 */

import { getGlobalState } from "../admissao.js";
import { getDocs, query, where } from "../../../../assets/js/firebase-init.js";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarDocsPos3Meses(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando colaboradores aprovados...</div>';

  try {
    // Busca colaboradores que já passaram pela avaliação de 3 meses (aprovados)
    // Status: AGUARDANDO_DOCS_POS_3MESES (Pendente de envio)
    // Status: DOCS_POS_3MESES_LIBERADOS (Já enviado, aguardando assinatura)
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "in", [
        "AGUARDANDO_DOCS_POS_3MESES",
        "DOCS_POS_3MESES_LIBERADOS",
      ])
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const tab = statusAdmissaoTabs.querySelector(
      '.tab-link[data-status="documentos-pos-3-meses"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-file-contract me-2"></i> 6. Documentos (Pós-3 Meses) (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML =
        '<p class="alert alert-info">Nenhum colaborador aguardando envio de documentos finais.</p>';
      return;
    }

    let listaHtml = `
      <div class="description-box" style="margin-top: 15px;">
        <p><strong>Fase 2 (Efetivação):</strong> Colaboradores aprovados na experiência. Envie os documentos finais (contrato de efetivação, novos termos) para assinatura na Intranet.</p>
      </div>
      <div class="candidatos-container candidatos-grid">
    `;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada";
      const statusAtual = cand.status_recrutamento || "N/A";

      let statusClass = "status-success";
      let botaoAcao = "";

      // Configuração do objeto de dados para passar aos modais
      const dadosCandidato = {
        id: candidatoId,
        nome_candidato: cand.nome_candidato || cand.nome_completo,
        // Garante que pegamos o email correto (novo ou pessoal)
        email_novo:
          cand.admissaoinfo?.email_solicitado ||
          cand.email_novo ||
          cand.email_candidato,
        telefone_contato: cand.telefone_contato,
        vaga_titulo: vagaTitulo,
        status_recrutamento: statusAtual,
      };

      // Codifica para passar no dataset
      const dadosCodificados = encodeURIComponent(
        JSON.stringify(dadosCandidato)
      );

      // Lógica do Botão Principal
      if (statusAtual === "AGUARDANDO_DOCS_POS_3MESES") {
        // Botão para abrir o modal de envio (reusa o modal da Fase 1, mas com flag Fase 2)
        botaoAcao = `
            <button 
                class="action-button primary btn-enviar-docs-finais" 
                data-id="${candidatoId}"
                data-dados="${dadosCodificados}"
                style="background: var(--cor-sucesso);">
                <i class="fas fa-file-signature me-1"></i> Enviar Docs Finais
            </button>`;
      } else if (statusAtual === "DOCS_POS_3MESES_LIBERADOS") {
        // Botão informativo
        statusClass = "status-warning";
        botaoAcao = `
            <button class="action-button secondary" disabled style="opacity:0.7; cursor: default;">
                <i class="fas fa-clock me-1"></i> Aguardando Assinatura
            </button>`;
      } else {
        // Fallback
        botaoAcao = `<span class="text-muted">Status: ${statusAtual}</span>`;
      }

      listaHtml += `
        <div class="card card-candidato-gestor" data-id="${candidatoId}">
         <div class="info-primaria">
          <h4 class="nome-candidato">
           ${dadosCandidato.nome_candidato || "Colaborador Sem Nome"}
            <span class="status-badge ${statusClass}">
              ${statusAtual.replace(/_/g, " ")}
            </span>
          </h4>
          <p class="small-info">
           <i class="fas fa-briefcase"></i> Cargo: ${
             cand.admissao_info?.cargo_final || vagaTitulo
           }
          </p>
          <p class="small-info" style="color: var(--cor-primaria);">
           <i class="fas fa-envelope"></i> Email: ${dadosCandidato.email_novo}
          </p>
         </div>
         
         <div class="acoes-candidato">
           ${botaoAcao}
           <button 
             class="action-button secondary btn-ver-detalhes-admissao" 
             data-id="${candidatoId}"
             data-dados="${dadosCodificados}">
             <i class="fas fa-eye me-1"></i> Detalhes
           </button>
         </div>
        </div>
       `;
    });

    listaHtml += "</div>";
    conteudoAdmissao.innerHTML = listaHtml;

    // --- LISTENERS ---

    // 1. Botão Enviar Docs Finais
    document.querySelectorAll(".btn-enviar-docs-finais").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");

        // Chama a função global definida em tabAssinaturaDocs.js
        // Parâmetro 2 indica FASE 2
        if (typeof window.abrirModalEnviarDocumentos === "function") {
          window.abrirModalEnviarDocumentos(candidatoId, dados, state, 2);
        } else {
          console.error(
            "Função window.abrirModalEnviarDocumentos não encontrada."
          );
          alert(
            "Erro: O módulo de assinatura de documentos (tabAssinaturaDocs.js) não foi carregado corretamente."
          );
        }
      });
    });

    // 2. Botão Detalhes
    document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dadosCodificados = e.currentTarget.getAttribute("data-dados");
        if (typeof window.abrirModalCandidato === "function") {
          const dadosCandidato = JSON.parse(
            decodeURIComponent(dadosCodificados)
          );
          window.abrirModalCandidato(candidatoId, "detalhes", dadosCandidato);
        }
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar aba Docs Pós 3 Meses:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}
