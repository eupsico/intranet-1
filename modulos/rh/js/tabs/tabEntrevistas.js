/**
 * Arquivo: modulos/rh/js/tabs/tabEntrevistas.js
 * Versão: 9.0.0 (Atualizado para Status Simplificado + Utils)
 * Descrição: Módulo "mestre" que renderiza a lista e importa a lógica dos modais.
 */

import {
  getDocs,
  query,
  where,
  collection,
  db,
} from "../../../../assets/js/firebase-init.js";

// ✅ Importação do Utilitário de Status (Corrigido caminho relativo)
import {
  formatarStatusLegivel,
  getStatusBadgeClass,
} from "../utils/status_utils.js";

// ✅ Importar a lógica dos submódulos (Modais)
import { abrirModalAgendamentoRH } from "../tabs/entrevistas/modalAgendamentoRH.js";
import { abrirModalAvaliacaoRH } from "../tabs/entrevistas/modalAvaliacaoRH.js";
import { abrirModalEnviarTeste } from "../tabs/entrevistas/modalEnviarTeste.js";
import { abrirModalAvaliacaoTeste } from "../tabs/entrevistas/modalAvaliacaoTeste.js";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM (Única função principal)
// ============================================

export async function renderizarEntrevistas(state) {
  console.log("🔹 Entrevistas: Iniciando renderização");

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
    // ✅ QUERY ATUALIZADA COM NOVOS STATUS TÉCNICOS
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        // Fase de Entrevista RH
        "ENTREVISTA_RH_PENDENTE",
        "ENTREVISTA_RH_AGENDADA", // Caso implemente mudança de status no agendamento

        // Fase de Testes
        "TESTE_PENDENTE",
        "TESTE_ENVIADO",
        "TESTE_RESPONDIDO",
      ])
    );

    const snapshot = await getDocs(q);

    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="entrevistas"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-comments me-2"></i> 3. Entrevistas e Avaliações (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Nenhum candidato na fase de Entrevistas/Avaliações.</p>';
      return;
    }

    let listaHtml = '<div class="candidatos-container candidatos-grid">';

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const statusAtual = cand.status_recrutamento || "N/A";

      // ✅ FORMATAÇÃO DE STATUS E CLASSE CSS (Usando Utils)
      const statusLegivel = formatarStatusLegivel(statusAtual);
      const statusClass = getStatusBadgeClass(statusAtual);

      const telefone = cand.telefone_contato
        ? cand.telefone_contato.replace(/\D/g, "")
        : "";
      const linkWhatsApp = telefone
        ? `https://api.whatsapp.com/send?phone=55${telefone}`
        : "#";

      const jsonCand = JSON.stringify(cand).replace(/'/g, "&#39;");

      listaHtml += `
        <div class="card card-candidato-triagem" data-id="${candidatoId}">
          <div class="info-primaria">
            <h4>Nome: ${
              cand.nome_candidato || cand.nome_completo || "Candidato Sem Nome"
            }</h4>
            
            <p>Status: 
               <span class="status-badge ${statusClass}">
                 ${statusLegivel}
               </span>
            </p>
            
            <p class="small-info">
              <i class="fas fa-briefcase"></i> Etapa: Entrevistas e avaliações
            </p>
          </div>

          <div class="info-contato">
            ${
              cand.email_candidato
                ? `<p><i class="fas fa-envelope"></i>E-mail: ${cand.email_candidato}</p>`
                : ""
            }
            <a href="${linkWhatsApp}" target="_blank" class="whatsapp" ${
        !telefone ? "disabled" : ""
      }>
               <i class="fab fa-whatsapp me-1"></i> ${
                 cand.telefone_contato || "N/A (Sem WhatsApp)"
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
      `;

      // ==========================================================
      // ✅ LÓGICA DE BOTÕES ATUALIZADA (Novos Status)
      // ==========================================================

      // 1. Fase de Entrevista RH
      if (
        statusAtual === "ENTREVISTA_RH_PENDENTE" ||
        statusAtual === "ENTREVISTA_RH_AGENDADA"
      ) {
        listaHtml += `
            <button 
              class="action-button secondary btn-agendar-rh" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-calendar-alt me-1"></i> Agendar RH
            </button>
            <button 
              class="action-button primary btn-avaliar-rh" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-edit me-1"></i> Avaliar RH
            </button>
        `;
      }
      // 2. Fase de Testes
      else if (
        ["TESTE_PENDENTE", "TESTE_ENVIADO", "TESTE_RESPONDIDO"].includes(
          statusAtual
        )
      ) {
        // Se ainda não respondeu (Pendente ou Enviado), permite enviar/reenviar
        if (statusAtual !== "TESTE_RESPONDIDO") {
          listaHtml += `
              <button 
                class="action-button primary btn-enviar-teste" 
                data-id="${candidatoId}"
                data-candidato-data='${jsonCand}'>
                <i class="fas fa-vial me-1"></i> ${
                  statusAtual === "TESTE_ENVIADO"
                    ? "Reenviar Teste"
                    : "Enviar Teste"
                }
              </button>
          `;
        }

        // Avaliar Teste (Sempre disponível nesta fase para correções ou visualização)
        listaHtml += `
            <button 
              class="action-button success btn-avaliar-teste" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-clipboard-check me-1"></i> Avaliar Teste
            </button>
        `;
      }
      // Fallback
      else {
        listaHtml += `
            <button 
              class="action-button primary btn-avaliar-rh" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-eye me-1"></i> Ver Avaliação
            </button>
        `;
      }

      listaHtml += `</div></div>`;
    });

    listaHtml += "</div>";
    conteudoRecrutamento.innerHTML = listaHtml;

    // ✅ 3. Anexar Listeners (Nenhuma mudança funcional, apenas re-bind)
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

    document.querySelectorAll(".btn-avaliar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dados = JSON.parse(
          e.currentTarget.dataset.candidatoData.replace(/&#39;/g, "'")
        );
        window.abrirModalAvaliacaoRH(e.currentTarget.dataset.id, dados);
      });
    });
  } catch (error) {
    console.error("❌ Entrevistas: Erro ao renderizar:", error);
    conteudoRecrutamento.innerHTML = `<p class="alert alert-error">Erro ao carregar: ${error.message}</p>`;
  }
}

// ✅ 4. Anexar as funções ao 'window' para acesso global
window.abrirModalAgendamentoRH = abrirModalAgendamentoRH;
window.abrirModalAvaliacaoRH = abrirModalAvaliacaoRH;
window.abrirModalEnviarTeste = abrirModalEnviarTeste;
window.abrirModalAvaliacaoTeste = abrirModalAvaliacaoTeste;
