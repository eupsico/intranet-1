/**
 * Arquivo: modulos/rh/js/tabs/tabReprovadosAdmissao.js
 * Versão: 1.0.0 (Baseado em tabTriagem.js)
 * Descrição: Lista candidatos reprovados durante o processo de admissão.
 */

// Importa do módulo de ADMISSÃO
import { getGlobalState } from "../admissao.js";
import { getDocs, query, where } from "../../../../assets/js/firebase-init.js";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM (SOMENTE LEITURA)
// ============================================

export async function renderizarReprovadosAdmissao(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando candidatos reprovados na admissão...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "==", "Reprovado (Admissão)")
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const tab = statusAdmissaoTabs.querySelector(
      '.tab-link[data-status="reprovados-admissao"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-times-circle me-2"></i> Reprovados na Admissão (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML =
        '<p class="alert alert-info">Nenhum candidato foi reprovado durante o processo de admissão.</p>';
      return;
    }

    let listaHtml = `
  	<div class="description-box" style="margin-top: 15px;">
   	<p>Lista de candidatos que foram aprovados na seleção mas reprovados durante o processo de admissão (ex: desistência, falha em documentos, etc.).</p>
  	</div>
  	<div class="candidatos-container candidatos-grid">
  `;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada";

      const statusClass = "status-rejeitada"; // Sempre reprovado

      const dadosCandidato = {
        id: candidatoId,
        nome_completo: cand.nome_completo,
        email_pessoal: cand.email_candidato,
        telefone_candidato: cand.telefone_candidato,
        motivo_rejeicao: cand.rejeicao?.justificativa || "Não informado",
        etapa_rejeicao: cand.rejeicao?.etapa || "N/A",
      };
      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
    <div class="card card-candidato-gestor" data-id="${candidatoId}">
     <div class="info-primaria">
      <h4 class="nome-candidato">
       ${cand.nome_completo || "Colaborador Sem Nome"}
      	<span class="status-badge ${statusClass}">
       	<i class="fas fa-tag"></i> Reprovado
      	</span>
      </h4>
     	<p class="small-info">
       <i class="fas fa-briefcase"></i> Cargo: ${
         cand.admissao_info?.cargo_final || vagaTitulo
       }
      </p>
     	<p class="small-info" style="color: var(--cor-erro);">
       <i class="fas fa-exclamation-triangle"></i> Etapa: ${
         dadosCandidato.etapa_rejeicao
       }
      </p>
  		<p class="small-info">
       <i class="fas fa-comment"></i> Motivo: ${dadosCandidato.motivo_rejeicao}
      </p>
     </div>
     
          <div class="acoes-candidato">
     	<button 
      	class="action-button secondary btn-ver-detalhes-admissao" 
      	data-id="${candidatoId}"
      	data-dados="${dadosCodificados}">
      	<i class="fas fa-eye me-1"></i> Ver Detalhes
     	</button>
     </div>
    </div>
   `;
    });

    listaHtml += "</div>";
    conteudoAdmissao.innerHTML = listaHtml;

    // Listeners de Detalhes
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
    console.error("❌ Admissão(Reprovados): Erro ao renderizar:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}
