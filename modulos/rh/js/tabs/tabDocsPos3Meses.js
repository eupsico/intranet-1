/**
 * Arquivo: modulos/rh/js/tabs/tabDocsPos3Meses.js
 * Versão: 3.0.0 (Migração Completa para Coleção Usuarios e status_admissao)
 * Descrição: Gerencia a etapa final de envio de documentos pós-experiência.
 */

import { getGlobalState } from "../admissao.js";
import {
  getDocs,
  query,
  where,
  collection,
  db,
} from "../../../../assets/js/firebase-init.js";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarDocsPos3Meses(state) {
  const { conteudoAdmissao, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando colaboradores aprovados...</div>';

  try {
    // ✅ MUDANÇA: Busca na coleção 'usuarios' pelo 'status_admissao'
    const usuariosCollection = collection(db, "usuarios");
    const q = query(
      usuariosCollection,
      where("status_admissao", "in", [
        "AGUARDANDO_DOCS_POS_3MESES",
        "DOCS_LIBERADOS_FASE2",
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
      const user = docSnap.data();
      const userId = docSnap.id; // UID do usuário
      const statusAtual = user.status_admissao || "N/A";

      let statusClass = "status-success";
      let botaoAcao = "";

      // ✅ LÓGICA DO BOTÃO PRINCIPAL (Baseada em status_admissao)
      if (statusAtual === "AGUARDANDO_DOCS_POS_3MESES") {
        // Botão para abrir o modal de envio (Fase 2)
        botaoAcao = `
            <button 
                class="action-button primary btn-enviar-docs-finais" 
                data-id="${userId}"
                data-dados="${encodeURIComponent(
                  JSON.stringify({
                    id: userId,
                    nome: user.nome,
                    email: user.email,
                    telefone: user.contato,
                  })
                )}"
                style="background: var(--cor-sucesso);">
                <i class="fas fa-file-signature me-1"></i> Enviar Docs Finais
            </button>`;
      } else if (statusAtual === "DOCS_LIBERADOS_FASE2") {
        // Botão informativo
        statusClass = "status-warning";
        botaoAcao = `
            <button class="action-button secondary" disabled style="opacity:0.7; cursor: default; width: 100%;">
                <i class="fas fa-clock me-2"></i> Aguardando Assinatura
            </button>`;
      } else {
        // Fallback
        botaoAcao = `<span class="text-muted">Status: ${statusAtual}</span>`;
      }

      // Objeto de dados para os modais
      const dadosUsuario = {
        id: userId,
        nome_completo: user.nome || "Usuário Sem Nome",
        email_novo: user.email || "Sem e-mail",
        telefone_contato: user.contato || user.telefone || "",
        vaga_titulo: user.profissao || "Cargo não informado",
        status_recrutamento: statusAtual,
      };

      const dadosCodificados = encodeURIComponent(JSON.stringify(dadosUsuario));

      listaHtml += `
        <div class="card card-candidato-gestor" data-id="${userId}">
         <div class="info-primaria">
          <h4 class="nome-candidato">
           ${dadosUsuario.nome_completo}
            <span class="status-badge ${statusClass}">
              ${statusAtual.replace(/_/g, " ")}
            </span>
          </h4>
          <p class="small-info">
           <i class="fas fa-briefcase"></i> Cargo: ${dadosUsuario.vaga_titulo}
          </p>
          <p class="small-info" style="color: var(--cor-primaria);">
           <i class="fas fa-envelope"></i> Email: ${dadosUsuario.email_novo}
          </p>
         </div>
         
         <div class="acoes-candidato">
           ${botaoAcao}
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
        const userId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");

        // Chama a função global definida em tabAssinaturaDocs.js
        // Parâmetro 2 indica FASE 2
        if (typeof window.abrirModalEnviarDocumentos === "function") {
          window.abrirModalEnviarDocumentos(userId, dados, state, 2);
        } else {
          console.error(
            "Função window.abrirModalEnviarDocumentos não encontrada."
          );
          alert(
            "Erro: O módulo de assinatura de documentos não foi carregado corretamente."
          );
        }
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar aba Docs Pós 3 Meses:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}
