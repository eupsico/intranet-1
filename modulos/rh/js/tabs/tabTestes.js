/**
 * Arquivo: modulos/rh/js/tabs/tabTestes.js
 * Versão: 1.0.0 (Novo módulo separado)
 * Descrição: Gerencia exclusivamente a etapa de testes (envio e avaliação).
 */

import {
  getDocs,
  query,
  where,
  collection,
  db,
} from "../../../../assets/js/firebase-init.js";

// Importar a lógica dos modais de teste
import { abrirModalEnviarTeste } from "../tabs/entrevistas/modalEnviarTeste.js";
import { abrirModalAvaliacaoTeste } from "../tabs/entrevistas/modalAvaliacaoTeste.js";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM DE TESTES
// ============================================

export async function renderizarTestes(state) {
  console.log("🔹 Testes: Iniciando renderização");

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

  conteudoRecrutamento.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // ✅ QUERY: Apenas status relacionados a TESTES
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "TESTE_PENDENTE",
        "TESTE_ENVIADO",
        "TESTE_RESPONDIDO",
      ])
    );

    const snapshot = await getDocs(q);

    // Atualiza o contador na aba de Testes
    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="testes"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-file-alt me-2"></i> 4. Testes (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhum candidato na fase de Testes.</p>';
      return;
    }

    let listaHtml = '<div class="candidatos-container candidatos-grid">';

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const statusAtual = cand.status_recrutamento || "N/A";

      let corStatus = "warning"; // Padrão para testes pendentes/enviados
      if (statusAtual.includes("TESTE_RESPONDIDO")) {
        corStatus = "success";
      }

      const telefone = cand.telefone_candidato
        ? cand.telefone_candidato.replace(/\D/g, "")
        : "";
      const linkWhatsApp = telefone
        ? `https://api.whatsapp.com/send?phone=55${telefone}`
        : "#";

      const jsonCand = JSON.stringify(cand).replace(/'/g, "&#39;");

      listaHtml += `
        <div class="card card-candidato-triagem" data-id="${candidatoId}" style="border-left-color: #6f42c1;">
          <div class="info-primaria">
            <h4>Nome: ${cand.nome_candidato || "Candidato Sem Nome"}</h4>
            <p>Status: <span class="status-badge status-${corStatus}">${statusAtual.replace(
        /_/g,
        " "
      )}</span></p>
            <p class="small-info">
              <i class="fas fa-vial"></i> Etapa: Avaliação de Testes
            </p>
          </div>

          <div class="info-contato">
            ${
              cand.email_candidato
                ? `<p><i class="fas fa-envelope"></i> ${cand.email_candidato}</p>`
                : ""
            }
            <a href="${linkWhatsApp}" target="_blank" class="whatsapp" ${
        !telefone ? "disabled" : ""
      }>
               <i class="fab fa-whatsapp me-1"></i> ${
                 cand.telefone_candidato || "N/A"
               }
            </a>
          </div>
          
          <div class="acoes-candidato">
            <button 
              class="action-button info btn-detalhes-candidato" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-info-circle me-1"></i> Detalhes
            </button>
      `;

      // LÓGICA DE BOTÕES ESPECÍFICA PARA TESTES
      if (statusAtual === "TESTE_PENDENTE" || statusAtual === "TESTE_ENVIADO") {
        listaHtml += `
              <button 
                class="action-button primary btn-enviar-teste" 
                data-id="${candidatoId}"
                data-candidato-data='${jsonCand}'>
                <i class="fas fa-paper-plane me-1"></i> Enviar Teste
              </button>
              <button 
                class="action-button success btn-avaliar-teste" 
                data-id="${candidatoId}"
                data-candidato-data='${jsonCand}'>
                <i class="fas fa-clipboard-check me-1"></i> Avaliar (Manual)
              </button>
        `;
      } else if (statusAtual === "TESTE_RESPONDIDO") {
        listaHtml += `
            <button 
              class="action-button success btn-avaliar-teste" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-check-double me-1"></i> Corrigir/Avaliar
            </button>
        `;
      }

      listaHtml += `</div></div>`;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml;

    // ANEXAR LISTENERS
    document.querySelectorAll(".btn-detalhes-candidato").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dados = JSON.parse(
          e.currentTarget.dataset.candidatoData.replace(/&#39;/g, "'")
        );
        if (window.abrirModalCandidato) {
          window.abrirModalCandidato(
            e.currentTarget.dataset.id,
            "detalhes",
            dados
          );
        }
      });
    });

    document.querySelectorAll(".btn-enviar-teste").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dados = JSON.parse(
          e.currentTarget.dataset.candidatoData.replace(/&#39;/g, "'")
        );
        window.abrirModalEnviarTeste(e.currentTarget.dataset.id, dados);
      });
    });

    document.querySelectorAll(".btn-avaliar-teste").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dados = JSON.parse(
          e.currentTarget.dataset.candidatoData.replace(/&#39;/g, "'")
        );
        window.abrirModalAvaliacaoTeste(e.currentTarget.dataset.id, dados);
      });
    });
  } catch (error) {
    console.error("❌ Testes: Erro ao renderizar:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-error">Erro ao carregar: ${error.message}</p>`;
  }
}

// Expor funções necessárias
window.abrirModalEnviarTeste = abrirModalEnviarTeste;
window.abrirModalAvaliacaoTeste = abrirModalAvaliacaoTeste;
