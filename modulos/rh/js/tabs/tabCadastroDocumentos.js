/**
* Arquivo: modulos/rh/js/tabs/tabCadastroDocumentos.js
* Versão: 1.2.0 (Removido token; Adicionado login/senha e link de boas-vindas)
* Descrição: Gerencia a etapa de envio do formulário de cadastro/documentos ao candidato.
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
// Importa a referência à Cloud Function (agora não mais usada para gerar token aqui)
import {
 httpsCallable,
 functions,
} from "../../../../assets/js/firebase-init.js";

// ============================================
// CONSTANTES
// ============================================
let dadosCandidatoAtual = null;

// Reutiliza a mesma Cloud Function de "gerarTokenTeste" (REMOVIDO O USO NESTA ETAPA)
// const CF_GERAR_TOKEN =
//  "https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net/gerarTokenTeste";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

/**
* Renderiza a listagem de candidatos para envio do formulário de cadastro
*/
export async function renderizarCadastroDocumentos(state) {
 const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

 conteudoAdmissao.innerHTML =
  '<div class="loading-spinner">Carregando candidatos aguardando cadastro...</div>';

 try {
  const q = query(
   candidatosCollection,
   where("status_recrutamento", "==", "AGUARDANDO_CADASTRO")
  );
  const snapshot = await getDocs(q); // Atualiza contagem na aba

  const tab = statusAdmissaoTabs.querySelector(
   '.tab-link[data-status="cadastro-documentos"]'
  );
  if (tab) {
   tab.innerHTML = `<i class="fas fa-id-card me-2"></i> 2. Cadastro e Documentos (${snapshot.size})`;
  }

  if (snapshot.empty) {
   conteudoAdmissao.innerHTML =
    '<p class="alert alert-info">Nenhum candidato aguardando o envio do formulário de cadastro.</p>';
   return;
  }

  let listaHtml = `
  <div class="description-box" style="margin-top: 15px;">
  <p>Envie o link do formulário de cadastro para os candidatos abaixo.</p>
  </div>
 <div class="candidatos-container candidatos-grid">
 `;

  snapshot.docs.forEach((docSnap) => {
   const cand = docSnap.data();
   const candidatoId = docSnap.id;
   const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada";
   const statusAtual = cand.status_recrutamento || "N/A";

   const statusClass = "status-warning";

   const dadosCandidato = {
    id: candidatoId,
    nome_completo: cand.nome_completo,
    email_pessoal: cand.email_candidato, // E-mail pessoal
    email_novo: cand.admissao_info?.email_solicitado || "Não solicitado", // E-mail novo
    // --- ⚠️ ALTERAÇÃO AQUI ---
    // Adiciona a senha temporária (gerada na etapa anterior)
    senha_temporaria: cand.admissao_info?.senha_temporaria || "N/A",
    // --- ⚠️ FIM DA ALTERAÇÃO ---
    telefone_contato: cand.telefone_contato,
    vaga_titulo: vagaTitulo,
   };
   const dadosJSON = JSON.stringify(dadosCandidato);
   const dadosCodificados = encodeURIComponent(dadosJSON);

   listaHtml += `
  <div class="card card-candidato-gestor" data-id="${candidatoId}">
  <div class="info-primaria">
   <h4 class="nome-candidato">
   ${cand.nome_completo || "Candidato Sem Nome"}
    <span class="status-badge ${statusClass}">
    <i class="fas fa-tag"></i> ${statusAtual}
    </span>
   </h4>
   <p class="small-info">
   <i class="fas fa-briefcase"></i> Vaga: ${vagaTitulo}
   </p>
   <p class="small-info" style="color: var(--cor-primaria);">
   <i class="fas fa-envelope"></i> Novo E-mail: ${
    cand.admissao_info?.email_solicitado || "Aguardando..."
   }
   </p>
  </div>
  
  <div class="acoes-candidato">
   <button
   class="btn btn-sm btn-primary btn-enviar-formulario"
   data-id="${candidatoId}"
   data-dados="${dadosCodificados}"
    style="padding: 10px 16px; background: var(--cor-primaria); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
   <i class="fas fa-paper-plane me-1"></i> Enviar Formulário
   </button>
   <button
   class="btn btn-sm btn-secondary btn-ver-dethes-admissao"
    data-id="${candidatoId}"
    data-dados="${dadosCodificados}"
    style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 100px;">
    <i class="fas fa-eye me-1"></i> Detalhes
   </button>
  </div>
  </div>
 `;
  });

  listaHtml += "</div>";
  conteudoAdmissao.innerHTML = listaHtml; // Listeners dinâmicos para "Enviar Formulário"

  document.querySelectorAll(".btn-enviar-formulario").forEach((btn) => {
   btn.addEventListener("click", (e) => {
    const candidatoId = e.currentTarget.getAttribute("data-id");
    const dados = e.currentTarget.getAttribute("data-dados");
    // A função não é mais async
    abrirModalEnviarFormulario(candidatoId, dados);
   });
  }); // Listeners dinâmicos para "Detalhes"

  document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
   btn.addEventListener("click", (e) => {
    const candidatoId = e.currentTarget.getAttribute("data-id");
    const dadosCodificados = e.currentTarget.getAttribute("data-dados");
    if (typeof window.abrirModalCandidato === "function") {
     try {
      const dadosCandidato = JSON.parse(
       decodeURIComponent(dadosCodificados)
      );
      window.abrirModalCandidato(candidatoId, "detalhes", dadosCandidato);
     } catch (error) {
      console.error("❌ Erro ao abrir modal de detalhes:", error);
     }
    } else {
     console.warn("⚠️ Função window.abrirModalCandidato não encontrada");
     alert("Erro ao carregar detalhes. Função não encontrada.");
    }
   });
  });
 } catch (error) {
  console.error("Erro ao renderizar aba de Cadastro:", error);
  conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
 }
}

/**
* Abre o modal para Enviar o Link do Formulário de Cadastro
* VERSÃO ATUALIZADA SEM TOKEN, COM MENSAGEM DE BOAS-VINDAS
*/
function abrirModalEnviarFormulario(candidatoId, dadosCodificados) {
 console.log("🎯 Abrindo modal de envio de formulário (sem token)");

 try {
  const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
  dadosCandidatoAtual = dadosCandidato; // Salva no estado local

  const modalExistente = document.getElementById("modal-enviar-formulario");
  if (modalExistente) {
   modalExistente.remove();
  }

  const urlBase = window.location.origin;
  const linkFormularioBase = `${urlBase}/public/fichas-de-cadastro.html`;
  const modal = document.createElement("div");
  modal.id = "modal-enviar-formulario";
  modal.dataset.candidaturaId = candidatoId;
  modal.innerHTML = `
 <style>
  #modal-enviar-formulario {
  all: initial !important; display: block !important; position: fixed !important;
  top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important;
  z-index: 999999 !important; background: rgba(0, 0, 0, 0.7) !important;
   font-family: inherit !important;
  }
  #modal-enviar-formulario .modal-container {
  position: fixed !important; top: 50% !important; left: 50% !important;
  transform: translate(-50%, -50%) !important; max-width: 700px !important;
  background: #ffffff !important; border-radius: 12px !important;
  box-shadow: 0 25px 50px -15px rgba(0, 0, 0, 0.3) !important;
  overflow: hidden !important; animation: modalPopupOpen 0.3s ease-out !important;
  }
  @keyframes modalPopupOpen {
  from { opacity: 0; transform: translate(-50%, -60%) scale(0.95); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  #modal-enviar-formulario .modal-header {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
   color: white !important; padding: 20px !important; display: flex !important;
   justify-content: space-between !important; align-items: center !important;
  }
  #modal-enviar-formulario .modal-title {
   display: flex !important; align-items: center !important; gap: 12px !important; margin: 0 !important;
  }
  #modal-enviar-formulario .modal-title i { font-size: 24px !important; }
  #modal-enviar-formulario .modal-title h3 { margin: 0 !important; font-size: 20px !important; font-weight: 600 !important; }
  #modal-enviar-formulario .modal-close {
   background: rgba(255,255,255,0.2) !important; border: none !important; color: white !important;
   width: 36px !important; height: 36px !important; border-radius: 50% !important; cursor: pointer !important;
   display: flex !important; align-items: center !important; justify-content: center !important;
   font-size: 18px !important; transition: all 0.2s !important;
  }
  #modal-enviar-formulario .modal-body {
   padding: 25px !important; max-height: 500px !important; overflow-y: auto !important;
   background: #f8f9fa !important; font-family: inherit !important;
  }
  #modal-enviar-formulario .info-card {
   background: white !important; padding: 15px !important; border-radius: 8px !important;
   margin-bottom: 20px !important; border-left: 4px solid #17a2b8 !important;
  }
  #modal-enviar-formulario .info-card p { margin: 0 !important; line-height: 1.6 !important; font-size: 14px; }
  #modal-enviar-formulario .info-card strong { color: #333; }
  #modal-enviar-formulario .form-group { margin-bottom: 20px !important; }
  #modal-enviar-formulario .form-label {
   font-weight: 600 !important; margin-bottom: 8px !important; display: block !important;
   color: #333 !important; font-size: 14px !important;
  }
  #modal-enviar-formulario .form-input {
   width: 100% !important; padding: 12px !important; border: 1px solid #ddd !important;
   border-radius: 6px !important; box-sizing: border-box !important; font-size: 14px !important;
   background: #e9ecef !important;
  }
  #modal-enviar-formulario .modal-footer {
   padding: 20px 25px !important; background: white !important; border-top: 1px solid #e9ecef !important;
   display: flex !important; justify-content: space-between !important; gap: 12px !important;
  }
  #modal-enviar-formulario .btn {
   padding: 12px 24px !important; border-radius: 6px !important; cursor: pointer !important;
   font-weight: 500 !important; border: none !important; display: inline-flex; gap: 8px; align-items: center;
  }
  #modal-enviar-formulario .btn-cancelar { background: #6c757d !important; color: white !important; }
  #modal-enviar-formulario .btn-copiar { background: #007bff !important; color: white !important; }
  #modal-enviar-formulario .btn-salvar { background: #28a745 !important; color: white !important; }
  #modal-enviar-formulario .btn-salvar:disabled { background: #ccc !important; }

    /* Estilos para a mensagem de boas-vindas */
    #modal-enviar-formulario .welcome-message-box {
        background: #fdfdfd !important; 
        border: 1px solid #ddd !important; 
        padding: 15px !important; 
        border-radius: 6px !important; 
        font-size: 14px !important; 
        line-height: 1.7 !important; 
        color: #333 !important;
    }
    #modal-enviar-formulario .welcome-message-box strong {
        color: #000 !important;
    }
    #modal-enviar-formulario .welcome-message-box a {
        color: #007bff !important;
        text-decoration: underline !important;
    }
  	#modal-enviar-formulario .modal-header {
     background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
    	color: white !important; padding: 20px !important; display: flex !important;
    	justify-content: space-between !important; align-items: center !important;
   	}
  	#modal-enviar-formulario .modal-title {
   		display: flex !important; align-items: center !important; gap: 12px !important; margin: 0 !important;
  	}
  	#modal-enviar-formulario .modal-title i { font-size: 24px !important; }
  	#modal-enviar-formulario .modal-title h3 { margin: 0 !important; font-size: 20px !important; font-weight: 600 !important; }
   	#modal-enviar-formulario .modal-close {
    	background: rgba(255,255,255,0.2) !important; border: none !important; color: white !important;
    	width: 36px !important; height: 36px !important; border-radius: 50% !important; cursor: pointer !important;
    	display: flex !important; align-items: center !important; justify-content: center !important;
    	font-size: 18px !important; transition: all 0.2s !important;
   	}
   	#modal-enviar-formulario .modal-body {
    	padding: 25px !important; max-height: 500px !important; overflow-y: auto !important;
    	background: #f8f9fa !important; font-family: inherit !important;
   	}
  	#modal-enviar-formulario .info-card {
   		background: white !important; padding: 15px !important; border-radius: 8px !important;
   		margin-bottom: 20px !important; border-left: 4px solid #17a2b8 !important;
  	}
  	#modal-enviar-formulario .info-card p { margin: 0 !important; line-height: 1.6 !important; font-size: 14px; }
  	#modal-enviar-formulario .info-card strong { color: #333; }
   	#modal-enviar-formulario .form-group { margin-bottom: 20px !important; }
   	#modal-enviar-formulario .form-label {
   		font-weight: 600 !important; margin-bottom: 8px !important; display: block !important;
   		color: #333 !important; font-size: 14px !important;
   	}
   	#modal-enviar-formulario .form-input {
   		width: 100% !important; padding: 12px !important; border: 1px solid #ddd !important;
   		border-radius: 6px !important; box-sizing: border-box !important; font-size: 14px !important;
   		background: #e9ecef !important;
   	}
   	#modal-enviar-formulario .modal-footer {
   		padding: 20px 25px !important; background: white !important; border-top: 1px solid #e9ecef !important;
   		display: flex !important; justify-content: space-between !important; gap: 12px !important;
   	}
  	#modal-enviar-formulario .btn {
  		padding: 12px 24px !important; border-radius: 6px !important; cursor: pointer !important;
  		font-weight: 500 !important; border: none !important; display: inline-flex; gap: 8px; align-items: center;
  	}
  	#modal-enviar-formulario .btn-cancelar { background: #6c757d !important; color: white !important; }
  	#modal-enviar-formulario .btn-copiar { background: #007bff !important; color: white !important; }
  	#modal-enviar-formulario .btn-salvar { background: #28a745 !important; color: white !important; }
  	#modal-enviar-formulario .btn-salvar:disabled { background: #ccc !important; }
   </style>
   
   <div class="modal-container">
    <div class="modal-header">
     <div class="modal-title">
      <i class="fas fa-paper-plane"></i>
      <h3>Enviar Formulário de Cadastro</h3>
     </div>
     <button class="modal-close" onclick="fecharModalEnviarFormulario()">
      <i class="fas fa-times"></i>
     </button>
    </div>
    
    <div class="modal-body">
     <div class="info-card">
     	<p><strong>Candidato:</strong> ${dadosCandidato.nome_completo}</p>
     	<p><strong>E-mail Pessoal:</strong> ${dadosCandidato.email_pessoal}</p>
     	<p><strong>Novo E-mail (Solicitado):</strong> ${dadosCandidato.email_novo}</p>
     </div>
    
     <form id="form-enviar-link-${candidatoId}">
      <div class="form-group">
       <label class="form-label" for="link-formulario-cadastro">
       	Link Seguro (Pronto para enviar):
      	</label>
       <input type="text" id="link-formulario-cadastro" class="form-input" 
       	value="Gerando link seguro..." readonly>
      </div>
     	<p style="font-size: 12px; color: #6c757d;">
     		Envie este link ao candidato. O link é de uso único.
     		Após o envio, clique em "Marcar como Enviado".
     	</p>
     </form>
    </div>
    
    <div class="modal-footer">
    	<div>
    		<button type="button" class="btn btn-copiar" id="btn-copiar-link-form" onclick="copiarLinkFormulario()" disabled>
     		<i class="fas fa-copy"></i> Copiar Link
    		</button>
    	</div>
    	<div>
     	<button type="button" class="btn btn-cancelar" onclick="fecharModalEnviarFormulario()">
     	 <i class="fas fa-times"></i> Cancelar
     	</button>
     	<button type="button" class="btn btn-salvar" id="btn-marcar-enviado-form" 
     		onclick="salvarEnvioFormulario('${candidatoId}')" disabled>
     	 <i class="fas fa-check-circle"></i> Marcar como Enviado
D    	</button>
    	</div>
    </div>
   </div>
  </div>
 </div>
 `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  // --- ⚠️ LÓGICA DE LINK SEM TOKEN (ATUALIZADO) ---
  const linkInput = document.getElementById("link-formulario-cadastro");
  const btnCopiar = document.getElementById("btn-copiar-link-form");
  const btnMarcar = document.getElementById("btn-marcar-enviado-form");

  try {
   // Define o link do formulário (sem token)
   linkInput.value = linkFormularioBase;

   // Habilita os botões
   btnCopiar.disabled = false;
   btnMarcar.disabled = false;

   // Remove o dataset.token, caso exista de alguma forma
   if (btnMarcar.dataset.token) {
    delete btnMarcar.dataset.token;
   }
  } catch (error) {
   console.error("Erro ao definir link:", error);
   linkInput.value = "Erro ao gerar link. Tente novamente.";
   window.showToast?.("Erro ao gerar link.", "error");
  }
  // --- ⚠️ FIM DA LÓGICA DO LINK ---
 } catch (error) {
  console.error("❌ Erro ao criar modal de envio de formulário:", error);
  alert("Erro ao abrir modal.");
 }
}

/**
* Fecha o modal de envio de formulário
*/
window.fecharModalEnviarFormulario = function () {
 console.log("❌ Fechando modal de envio de formulário");
 const modal = document.getElementById("modal-enviar-formulario");
 if (modal) {
  modal.remove();
 }
 document.body.style.overflow = "";
};

/**
* Copia o link do formulário
*/
window.copiarLinkFormulario = function () {
 const input = document.getElementById("link-formulario-cadastro");
 if (input) {
  input.select();
  document.execCommand("copy");
  window.showToast?.("Link copiado!", "success");
 }
};

/**
* Salva o envio do formulário (versão atualizada SEM token)
*/
window.salvarEnvioFormulario = async function (candidatoId) {
 console.log("💾 Marcando formulário como enviado...");

 const modal = document.getElementById("modal-enviar-formulario");
 const btnSalvar = modal?.querySelector("#btn-marcar-enviado-form");
 
 // --- ⚠️ ALTERAÇÃO AQUI ---
 // Remove a verificação do token
 // const token = btnSalvar?.dataset.token;
 // if (!token) {
 //  window.showToast?.("Erro: Token de validação não encontrado.", "error");
 //  return;
 // }
 // --- ⚠️ FIM DA ALTERAÇÃO ---

 if (btnSalvar) {
  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
 }

 try {
  const { candidatosCollection, currentUserData } = getGlobalState();
  const candidatoRef = doc(candidatosCollection, candidatoId);
  const novoStatus = "AGUARDANDO_PREENCHIMENTO_FORM";
  await updateDoc(candidatoRef, {
   status_recrutamento: novoStatus,
   historico: arrayUnion({
    data: new Date(),
    // --- ⚠️ ALTERAÇÃO AQUI ---
    // Mensagem de histórico atualizada
    acao: `Link do formulário de cadastro enviado ao candidato.`,
    // --- ⚠️ FIM DA ALTERAÇÃO ---
    usuario: currentUserData.id || "rh_admin",
   }),
  });

  console.log(`✅ Status do candidato atualizado para ${novoStatus}`);
 T window.showToast?.(
   "Candidato movido para 'Aguardando Preenchimento'!",
   "success"
  );
  window.fecharModalEnviarFormulario();
  renderizarCadastroDocumentos(getGlobalState()); // Recarrega a aba
 } catch (error) {
  console.error("❌ Erro ao marcar como enviado:", error);
  alert(`Erro ao salvar: ${error.message}`);
  if (btnSalvar) {
   btnSalvar.disabled = false;
   btnSalvar.innerHTML =
    '<i class="fas fa-check-circle"></i> Marcar como Enviado';
  }
 }
};