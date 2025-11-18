/**
 * Arquivo: modulos/rh/js/tabs/tabEntrevistas.js
 * Versão: 8.1.0 (Corrigida dependência circular)
 * Descrição: Módulo "mestre" que renderiza a lista e importa a lógica dos modais.
 */

// ✅ CORREÇÃO: 'getGlobalState' removido.
import {
  getDocs,
  query,
  where,
  collection,
  db,
} from "../../../../assets/js/firebase-init.js";

// ✅ 1. Importar a lógica dos submódulos
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
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      // ==========================================================
      // ✅ CORREÇÃO 1: Adicionado "Testes Respondido" à query
      // ==========================================================
      where("status_recrutamento", "in", [
        "Triagem Aprovada (Entrevista Pendente)",
        "Entrevista RH Aprovada (Testes Pendente)",
        "Testes Pendente",
        "Testes Pendente (Enviado)",
        "Testes Respondido", // <-- ADICIONADO AQUI
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

      let corStatus = "info";
      if (statusAtual.includes("Aprovada")) {
        corStatus = "success";
      } else if (statusAtual.includes("Testes")) {
        // "Testes Respondido" também é um status de 'warning' (atenção)
        corStatus = "warning";
      }
      // ✅ CORREÇÃO: "Testes Respondido" agora usa o status 'success'
      if (statusAtual.includes("Testes Respondido")) {
        corStatus = "success";
      }

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
            <h4>Nome: ${cand.nome_candidato || "Candidato Sem Nome"}</h4>
            <p>Status: <span class="status-badge status-${corStatus}">${statusAtual.replace(
        /_/g,
        " "
      )}</span></p>
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

      // LÓGICA: EXIBIÇÃO DOS BOTÕES
      if (statusAtual.includes("Entrevista Pendente")) {
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

        // ==========================================================
        // ✅ CORREÇÃO 2: Adicionado "Testes Respondido" à lógica dos botões
        // ==========================================================
      } else if (
        statusAtual === "Entrevista RH Aprovada (Testes Pendente)" ||
        statusAtual === "Testes Pendente" ||
        statusAtual === "Testes Pendente (Enviado)" ||
        statusAtual === "Testes Respondido" // <-- ADICIONADO AQUI
      ) {
        // Se o teste ainda não foi respondido, mostra "Enviar Teste"

        listaHtml += `
              <button 
                class="action-button primary btn-enviar-teste" 
                data-id="${candidatoId}"
                data-candidato-data='${jsonCand}'>
                <i class="fas fa-vial me-1"></i> Enviar Teste
              </button>
          `;

        // Mostra "Avaliar Teste" (seja pendente ou respondido)
        listaHtml += `
            <button 
              class="action-button success btn-avaliar-teste" 
              data-id="${candidatoId}"
              data-candidato-data='${jsonCand}'>
              <i class="fas fa-clipboard-check me-1"></i> Avaliar Teste
            </button>
        `;
      } else {
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

    // ✅ 3. Anexar Listeners (Nenhuma mudança aqui)
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

// ✅ 4. Anexar as funções ao 'window' para que outros módulos
// (como tabGestor.js) possam chamá-las se necessário.
window.abrirModalAgendamentoRH = abrirModalAgendamentoRH;
window.abrirModalAvaliacaoRH = abrirModalAvaliacaoRH;
window.abrirModalEnviarTeste = abrirModalEnviarTeste;
window.abrirModalAvaliacaoTeste = abrirModalAvaliacaoTeste;
