/**
 * Arquivo: modulos/rh/js/tabs/tabEntrevistas.js
 * Versão: 9.0.0 (Separado de Testes)
 * Descrição: Gerencia exclusivamente a Entrevista com RH.
 */

import {
  getDocs,
  query,
  where,
  collection,
  db,
} from "../../../../assets/js/firebase-init.js";

import { abrirModalAgendamentoRH } from "../tabs/entrevistas/modalAgendamentoRH.js";
import { abrirModalAvaliacaoRH } from "../tabs/entrevistas/modalAvaliacaoRH.js";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM (RH APENAS)
// ============================================

export async function renderizarEntrevistas(state) {
  console.log("🔹 Entrevistas RH: Iniciando renderização");

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
    // ✅ QUERY: Apenas status de ENTREVISTA RH
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "ENTREVISTA_RH_PENDENTE",
        "ENTREVISTA_RH_AGENDADA",
      ])
    );

    const snapshot = await getDocs(q);

    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="entrevistas"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-comments me-2"></i> 3. Entrevista RH (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhum candidato na fase de Entrevista com RH.</p>';
      return;
    }

    let listaHtml = '<div class="candidatos-container candidatos-grid">';

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const statusAtual = cand.status_recrutamento || "N/A";

      let corStatus = "info";
      if (statusAtual.includes("AGENDADA")) {
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
        <div class="card card-candidato-triagem" data-id="${candidatoId}" style="border-left-color: #17a2b8;">
          <div class="info-primaria">
            <h4>Nome: ${cand.nome_candidato || "Candidato Sem Nome"}</h4>
            <p>Status: <span class="status-badge status-${corStatus}">${statusAtual.replace(
        /_/g,
        " "
      )}</span></p>
            <p class="small-info">
              <i class="fas fa-user-friends"></i> Etapa: Entrevista Cultural/RH
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
              class="action-button info btn-detalhes-entrevista" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-info-circle me-1"></i> Detalhes
            </button>
            <button 
              class="action-button secondary btn-agendar-rh" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-calendar-alt me-1"></i> Agendar
            </button>
            <button 
              class="action-button primary btn-avaliar-rh" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-edit me-1"></i> Avaliar
            </button>
          </div>
        </div>`;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml;

    // Listeners
    document.querySelectorAll(".btn-detalhes-entrevista").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dados = JSON.parse(
          e.currentTarget.dataset.candidatoData.replace(/&#39;/g, "'")
        );
        window.abrirModalCandidato(
          e.currentTarget.dataset.id,
          "detalhes",
          dados
        );
      });
    });
    document.querySelectorAll(".btn-agendar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dados = JSON.parse(
          e.currentTarget.dataset.candidatoData.replace(/&#39;/g, "'")
        );
        window.abrirModalAgendamentoRH(e.currentTarget.dataset.id, dados);
      });
    });
    document.querySelectorAll(".btn-avaliar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dados = JSON.parse(
          e.currentTarget.dataset.candidatoData.replace(/&#39;/g, "'")
        );
        window.abrirModalAvaliacaoRH(e.currentTarget.dataset.id, dados);
      });
    });
  } catch (error) {
    console.error("❌ Entrevistas RH: Erro ao renderizar:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-error">Erro ao carregar: ${error.message}</p>`;
  }
}

window.abrirModalAgendamentoRH = abrirModalAgendamentoRH;
window.abrirModalAvaliacaoRH = abrirModalAvaliacaoRH;
