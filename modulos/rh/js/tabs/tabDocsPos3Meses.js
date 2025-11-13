/**
* Arquivo: modulos/rh/js/tabs/tabDocsPos3Meses.js
* Versão: 1.0.0 (Baseado em tabTriagem.js)
* Descrição: Gerencia a etapa final de envio de documentos pós-experiência.
*/

// Importa do módulo de ADMISSÃO
import { getGlobalState } from "../admissao.js";
import {
 updateDoc,
 doc,
 getDocs,
 query,
 where,
 arrayUnion,
} from "../../../../assets/js/firebase-init.js";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarDocsPos3Meses(state) {
 const {
 	conteudoAdmissao,
 	candidatosCollection,
 	statusAdmissaoTabs,
 } = state;

 conteudoAdmissao.innerHTML =
 	'<div class="loading-spinner">Carregando colaboradores aprovados...</div>';

 try {
  const q = query(
   candidatosCollection,
   where("status_recrutamento", "==", "AGUARDANDO_DOCS_POS_3MESES")
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
   	<p>Colaboradores aprovados no período de experiência. Envie os documentos finais (contrato de efetivação, etc.) para assinatura.</p>
  	</div>
  	<div class="candidatos-container candidatos-grid">
  `;

  snapshot.docs.forEach((docSnap) => {
   const cand = docSnap.data();
   const candidatoId = docSnap.id;
   const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada";
   const statusAtual = cand.status_recrutamento || "N/A";

   const statusClass = "status-success"; // Pronto para ação

  	const dadosCandidato = {
    id: candidatoId,
    nome_completo: cand.nome_completo,
    email_novo: cand.admissao_info?.email_solicitado || "Não solicitado",
    telefone_contato: cand.telefone_contato,
   };
   const dadosJSON = JSON.stringify(dadosCandidato);
   const dadosCodificados = encodeURIComponent(dadosJSON);

   listaHtml += `
    <div class="card card-candidato-gestor" data-id="${candidatoId}">
     <div class="info-primaria">
      <h4 class="nome-candidato">
       ${cand.nome_completo || "Colaborador Sem Nome"}
      	<span class="status-badge ${statusClass}">
       	<i class="fas fa-tag"></i> Aprovado
      	</span>
      </h4>
     	<p class="small-info">
       <i class="fas fa-briefcase"></i> Cargo: ${cand.admissao_info?.cargo_final || vagaTitulo}
      </p>
     </div>
     
     <div class="acoes-candidato">
     	<button 
      	class="action-button primary btn-enviar-docs-finais" 
      	data-id="${candidatoId}"
      	data-dados="${dadosCodificados}"
     		style="background: var(--cor-sucesso);">
      	<i class="fas fa-file-signature me-1"></i> Enviar Docs Finais
     	</button>
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

  // Listeners de Enviar Docs
  document.querySelectorAll(".btn-enviar-docs-finais").forEach((btn) => {
   btn.addEventListener("click", (e) => {
   	const candidatoId = e.currentTarget.getAttribute("data-id");
   	const dados = e.currentTarget.getAttribute("data-dados");
   	// (Reutiliza a lógica do modal de 'tabAssinaturaDocs')
   	if (typeof window.abrirModalEnviarDocumentos === "function") {
   		abrirModalEnviarDocumentos(candidatoId, dados, state);
   	} else {
   		alert("Erro: Função 'abrirModalEnviarDocumentos' não encontrada. Verifique 'tabAssinaturaDocs.js'");
   	}
   });
  });
 
  // Listeners de Detalhes
  document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
   btn.addEventListener("click", (e) => {
    const candidatoId = e.currentTarget.getAttribute("data-id");
    const dadosCodificados = e.currentTarget.getAttribute("data-dados");
   	if (typeof window.abrirModalCandidato === "function") {
   		const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
   		window.abrirModalCandidato(candidatoId, "detalhes", dadosCandidato);
   	}
   });
  });

 } catch (error) {
  console.error("❌ Admissão(Docs Finais): Erro ao renderizar:", error);
  conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
 }
}