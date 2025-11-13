/**
 * Arquivo: modulos/rh/js/tabs/tabAssinaturaDocs.js
 * Versão: 1.0.0 (Baseado em tabEntrevistas.js)
 * Descrição: Gerencia a etapa de envio de documentos para assinatura.
 */

// Importa do módulo de ADMISSÃO
import { getGlobalState } from "../admissao.js";
import {
  db,
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
} from "../../../../assets/js/firebase-init.js";

// ============================================
// CONSTANTES
// ============================================
let dadosCandidatoAtual = null;

// Reutiliza a mesma Cloud Function de "gerarTokenTeste", mas enviaremos um 'tipo' diferente.
const CLOUD_FUNCTIONS_BASE =
  "https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net";
const CF_GERAR_TOKEN_ASSINATURA = `${CLOUD_FUNCTIONS_BASE}/gerarTokenTeste`; // Reutilizando a CF

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarAssinaturaDocs(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando candidatos para assinatura...</div>';

  try {
    // NOTA: O formulário público 'fichas-de-inscricao.html' deve
    // ser responsável por mudar o status do candidato de
    // 'AGUARDANDO_PREENCHIMENTO_FORM' para 'AGUARDANDO_ASSINATURA'
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "in", [
        "AGUARDANDO_PREENCHIMENTO_FORM", // Para monitorar quem não preencheu
        "AGUARDANDO_ASSINATURA", // Pronto para enviar docs
      ])
    );
    const snapshot = await getDocs(q); // Atualiza contagem na aba

    const tab = statusAdmissaoTabs.querySelector(
      '.tab-link[data-status="assinatura-documentos"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-file-signature me-2"></i> 3. Assinatura de Documentos (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML =
        '<p class="alert alert-info">Nenhum candidato aguardando assinatura de documentos.</p>';
      return;
    }

    let listaHtml = `
    	<div class="description-box" style="margin-top: 15px;">
      	<p>Monitore os candidatos que ainda não preencheram o formulário e envie os documentos (Contratos, Termos) para assinatura digital (Gov.br) para os que já preencheram.</p>
    	</div>
      <div class="candidatos-container candidatos-grid">
    `;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada";
      const statusAtual = cand.status_recrutamento || "N/A";

      let statusClass = "status-info";
      if (statusAtual === "AGUARDANDO_ASSINATURA") {
        statusClass = "status-success"; // Pronto para ação
      } else if (statusAtual === "AGUARDANDO_PREENCHIMENTO_FORM") {
        statusClass = "status-warning"; // Pendente (apenas monitorar)
      }

      const dadosCandidato = {
        id: candidatoId,
        nome_completo: cand.nome_completo,
        email_pessoal: cand.email_candidato,
        email_novo: cand.admissao_info?.email_solicitado || "Não solicitado",
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
          	<p class="small-info" style="color: var(--cor-primaria);">
              <i class="fas fa-envelope"></i> Novo E-mail: ${
        cand.admissao_info?.email_solicitado || "Aguardando..."
      }
            </p>
          </div>
          
          <div class="acoes-candidato">
      		${
        statusAtual === "AGUARDANDO_ASSINATURA"
          ? `            	<button 
            	  class="btn btn-sm btn-primary btn-enviar-documentos" 
            	  data-id="${candidatoId}"
            	  data-dados="${dadosCodificados}"
          		  style="padding: 10px 16px; background: var(--cor-sucesso); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
            	  <i class="fas fa-file-signature me-1"></i> Enviar Docs Assinatura
          	  </button>`
          : `      			<button 
            	  class="btn btn-sm btn-warning btn-reenviar-formulario" 
            	  data-id="${candidatoId}"
            	  data-dados="${dadosCodificados}"
          		  style="padding: 10px 16px; background: var(--cor-aviso); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
            	  <i class="fas fa-paper-plane me-1"></i> Reenviar Formulário
          	  </button>`
      }
          	<button 
              class="btn btn-sm btn-secondary btn-ver-detalhes-admissao" 
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
    conteudoAdmissao.innerHTML = listaHtml; // Listeners

    document.querySelectorAll(".btn-enviar-documentos").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalEnviarDocumentos(candidatoId, dados, state);
      });
    });

    document.querySelectorAll(".btn-reenviar-formulario").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados"); // Esta função foi criada em 'tabCadastroDocumentos.js' // Reutilizamos a lógica do modal de lá.
        if (typeof window.abrirModalReenviarFormulario === "function") {
          window.abrirModalReenviarFormulario(candidatoId, dados);
        } else {
          alert(
            "Erro: Função 'abrirModalReenviarFormulario' não encontrada. Verifique 'tabCadastroDocumentos.js'"
          );
        }
      });
    });

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
    console.error("Erro ao renderizar aba de Assinatura:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

// ============================================
// MODAL - ENVIAR DOCUMENTOS
// ============================================

/**
 * Abre o modal para Enviar Documentos para Assinatura
 */
async function abrirModalEnviarDocumentos(
  candidatoId,
  dadosCodificados,
  state
) {
  console.log("🎯 Abrindo modal de envio de documentos");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
    dadosCandidatoAtual = dadosCandidato; // Salva no estado local

    const modalExistente = document.getElementById("modal-enviar-documentos");
    if (modalExistente) {
      modalExistente.remove();
    }

    const modal = document.createElement("div");
    modal.id = "modal-enviar-documentos";
    modal.dataset.candidaturaId = candidatoId; // Salva o ID no modal
    modal.innerHTML = `
      <style>
        #modal-enviar-documentos {
          all: initial !important; display: block !important; position: fixed !important;
          top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important;
          z-index: 999999 !important; background: rgba(0, 0, 0, 0.7) !important;
        	font-family: inherit !important;
        }
        #modal-enviar-documentos .modal-container {
          position: fixed !important; top: 50% !important; left: 50% !important;
          transform: translate(-50%, -50%) !important; max-width: 700px !important;
          background: #ffffff !important; border-radius: 12px !important;
          box-shadow: 0 25px 50px -15px rgba(0, 0, 0, 0.3) !important;
          overflow: hidden !important; animation: modalPopupOpen 0.3s ease-out !important;
        }
      	#modal-enviar-documentos .modal-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        	color: white !important; padding: 20px !important; display: flex !important;
        	justify-content: space-between !important; align-items: center !important;
      	}
    	#modal-enviar-documentos .modal-title {
      		display: flex !important; align-items: center !important; gap: 12px !important; margin: 0 !important;
    	}
    	#modal-enviar-documentos .modal-title i { font-size: 24px !important; }
    	#modal-enviar-documentos .modal-title h3 { margin: 0 !important; font-size: 20px !important; font-weight: 600 !important; }
      	#modal-enviar-documentos .modal-close {
        	background: rgba(255,255,255,0.2) !important; border: none !important; color: white !important;
        	width: 36px !important; height: 36px !important; border-radius: 50% !important; cursor: pointer !important;
        	display: flex !important; align-items: center !important; justify-content: center !important;
        	font-size: 18px !important; transition: all 0.2s !important;
      	}
      	#modal-enviar-documentos .modal-body {
        	padding: 25px !important; max-height: 500px !important; overflow-y: auto !important;
        	background: #f8f9fa !important; font-family: inherit !important;
      	}
    	#modal-enviar-documentos .info-card {
      		background: white !important; padding: 15px !important; border-radius: 8px !important;
      		margin-bottom: 20px !important; border-left: 4px solid #667eea !important;
    	}
    	#modal-enviar-documentos .info-card p { margin: 0 !important; line-height: 1.6 !important; font-size: 14px; }
    	#modal-enviar-documentos .form-group { margin-bottom: 20px !important; }
      	#modal-enviar-documentos .form-label {
      		font-weight: 600 !important; margin-bottom: 8px !important; display: block !important;
      		color: #333 !important; font-size: 14px !important;
      	}
    	#modal-enviar-documentos #documentos-checklist-container {
    		background: white; padding: 15px; border-radius: 6px;
    		max-height: 200px; overflow-y: auto; border: 1px solid #ddd;
    	}
    	#modal-enviar-documentos .form-check { display: block; margin-bottom: 10px; }
    	#modal-enviar-documentos .form-check label { font-weight: 500; }
    	#modal-enviar-documentos .form-textarea {
      		width: 100% !important; min-height: 100px !important; padding: 12px !important;
      		border: 1px solid #ddd !important; border-radius: 6px !important;
      		resize: vertical !important; box-sizing: border-box !important; font-size: 14px !important;
      	}
      	#modal-enviar-documentos .modal-footer {
      		padding: 20px 25px !important; background: white !important; border-top: 1px solid #e9ecef !important;
      		display: flex !important; justify-content: flex-end !important; gap: 12px !important;
      	}
    	#modal-enviar-documentos .btn {
    		padding: 12px 24px !important; border-radius: 6px !important; cursor: pointer !important;
    		font-weight: 500 !important; border: none !important; display: inline-flex; gap: 8px; align-items: center;
    	}
    	#modal-enviar-documentos .btn-cancelar { background: #6c757d !important; color: white !important; }
    	#modal-enviar-documentos .btn-salvar { background: #667eea !important; color: white !important; }
    	#modal-enviar-documentos .btn-salvar:disabled { background: #ccc !important; }
      </style>
      
      <div class="modal-container">
        <div class="modal-header">
          <div class="modal-title">
            <i class="fas fa-file-signature"></i>
            <h3>Enviar Documentos p/ Assinatura</h3>
          </div>
          <button class="modal-close" onclick="fecharModalEnviarDocumentos()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="info-card">
          	<p><strong>Candidato:</strong> ${dadosCandidato.nome_completo}</p>
          	<p><strong>Telefone:</strong> ${dadosCandidato.telefone_contato}</p>
          	<p><strong>Novo E-mail:</strong> ${dadosCandidato.email_novo}</p>
          </div>
        
          <form id="form-enviar-docs-${candidatoId}">
            <div class="form-group">
              <label class="form-label" for="documentos-checklist-container">
              	Selecione os documentos para enviar:
            	</label>
            	<div id="documentos-checklist-container">
            		<p>Carregando modelos de documentos...</p>
            	</div>
            </div>
            <div class="form-group">
            	<label class="form-label" for="documentos-mensagem">Mensagem Personalizada (Opcional)</label>
            	<textarea id="documentos-mensagem" class="form-textarea" rows="3"
            	placeholder="Deixe em branco para usar a mensagem padrão."></textarea>
            </div>
          </form>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-cancelar" onclick="fecharModalEnviarDocumentos()">
            <i class="fas fa-times"></i> Cancelar
          </button>
          <button type="button" class="btn btn-salvar" id="btn-enviar-docs-whatsapp"
          	onclick="enviarDocumentosWhatsApp()">
            <i class="fab fa-whatsapp"></i> Enviar via WhatsApp
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden"; // Carrega os documentos no checklist

    carregarDocumentosDisponiveis();
  } catch (error) {
    console.error("❌ Erro ao criar modal de envio de documentos:", error);
    alert("Erro ao abrir modal.");
  }
}

/**
 * Carrega os modelos de documentos da coleção 'rh_documentos_modelos'
 */
async function carregarDocumentosDisponiveis() {
  const container = document.getElementById("documentos-checklist-container");
  if (!container) return;

  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // Esta é a coleção que criamos na Parte 2
    const documentosRef = collection(db, "rh_documentos_modelos");
    const q = query(documentosRef, where("ativo", "==", true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      container.innerHTML =
        '<p class="alert alert-warning">Nenhum modelo de documento cadastrado em "Gerenciar Documentos".</p>';
      return;
    }

    let htmlCheckboxes = "";
    snapshot.forEach((docSnap) => {
      const doc = docSnap.data();
      htmlCheckboxes += `
      	<div class="form-check">
      		<input class="form-check-input" type="checkbox" value="${docSnap.id}" id="doc-${docSnap.id}" data-titulo="${doc.titulo}">
      		<label class="form-check-label" for="doc-${docSnap.id}">
      			<strong>${doc.titulo}</strong> (${doc.tipo})
      		</label>
      	</div>
      `;
    });

    container.innerHTML = htmlCheckboxes;
  } catch (error) {
    console.error("❌ Erro ao carregar modelos de documentos:", error);
    container.innerHTML =
      '<p class="alert alert-danger">Erro ao carregar documentos.</p>';
  }
}

/**
 * Salva o envio dos documentos no Firestore (histórico)
 */
async function salvarEnvioDocumentos(
  candidatoId,
  documentosEnviados,
  linkAssinatura,
  tokenId
) {
  console.log(`🔹 Salvando envio de documentos: ${candidatoId}`);

  const { candidatosCollection, currentUserData } = getGlobalState();

  try {
    const candidatoRef = doc(candidatosCollection, candidatoId);
    const novoStatus = "AGUARDANDO_INTEGRACAO"; // Próxima etapa

    await updateDoc(candidatoRef, {
      status_recrutamento: novoStatus,
      documentos_enviados: arrayUnion({
        documentos: documentosEnviados, // Array de {id, titulo}
        tokenId: tokenId,
        link: linkAssinatura,
        data_envio: new Date(),
        enviado_por_uid: currentUserData.id || "rh_system_user",
        status: "enviado",
      }),
      historico: arrayUnion({
        data: new Date(),
        acao: `Documentos para assinatura enviados. Token: ${tokenId.substring(
          0,
          8
        )}...`,
        usuario: currentUserData.id || "rh_system_user",
      }),
    });

    console.log("✅ Envio de documentos salvo no Firestore");
  } catch (error) {
    console.error("❌ Erro ao salvar envio de documentos:", error);
    throw error;
  }
}

// === FUNÇÕES GLOBAIS DO MODAL ===
window.fecharModalEnviarDocumentos = function () {
  console.log("❌ Fechando modal de envio de documentos");
  const modal = document.getElementById("modal-enviar-documentos");
  if (modal) {
    modal.remove();
  }
  document.body.style.overflow = "";
};

window.enviarDocumentosWhatsApp = async function () {
  console.log("🔹 Enviando documentos via WhatsApp (com Cloud Function)");

  const modal = document.getElementById("modal-enviar-documentos");
  const candidatoId = modal?.dataset.candidaturaId;
  const telefone = dadosCandidatoAtual?.telefone_contato;
  const btnEnviar = document.getElementById("btn-enviar-docs-whatsapp"); // Pega documentos selecionados

  const documentosSelecionados = [];
  modal
    .querySelectorAll("#documentos-checklist-container input:checked")
    .forEach((input) => {
      documentosSelecionados.push({
        id: input.value,
        titulo: input.dataset.titulo,
      });
    });

  if (!candidatoId || !telefone) {
    window.showToast?.("Erro: Candidato ou telefone não encontrado.", "error");
    return;
  }
  if (documentosSelecionados.length === 0) {
    window.showToast?.(
      "Selecione pelo menos um documento para enviar.",
      "error"
    );
    return;
  }

  btnEnviar.disabled = true;
  btnEnviar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Gerando link...';

  try {
    // Chama a Cloud Function para gerar um token seguro
    console.log(
      `🔹 Chamando Cloud Function: gerarTokenTeste (para documentos)`
    );
    const documentosIds = documentosSelecionados.map((d) => d.id);
    const responseGerarToken = await fetch(CF_GERAR_TOKEN_ASSINATURA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidatoId: candidatoId,
        documentosIds: documentosIds, // Envia os IDs dos documentos
        tipo: "documento_assinatura", // Novo tipo
        prazoDias: 3, // Prazo curto para assinatura
      }),
    });

    const dataToken = await responseGerarToken.json();
    if (!dataToken.sucesso) {
      throw new Error(dataToken.erro || "Erro ao gerar token de assinatura");
    }

    console.log("✅ Token de Assinatura gerado:", dataToken.token);

    const linkAssinatura = dataToken.urlTeste; // A CF retorna a URL pública
    const nomesDocumentos = documentosSelecionados
      .map((d) => d.titulo)
      .join(", "); // Monta mensagem

    const mensagemPersonalizada = document.getElementById(
      "documentos-mensagem"
    )?.value;
    const mensagemPadrao = `
✒️ *Olá ${dadosCandidatoAtual.nome_completo}!*

Estamos na etapa final da sua admissão. Por favor, revise e assine os seguintes documentos:

*Documentos:*
${nomesDocumentos}

*Plataforma de Assinatura (via Gov.br):*
${linkAssinatura}

*Instruções:*
1. Acesse o link acima.
2. Você será redirecionado para a plataforma de assinatura.
3. Use sua conta *Gov.br* para assinar digitalmente.

Qualquer dúvida, fale com o RH.

*Equipe de Recursos Humanos - EuPsico* 💙
    `.trim();

    const mensagemFinal = mensagemPersonalizada || mensagemPadrao;
    const telefoneLimpo = telefone.replace(/\D/g, "");
    const mensagemCodificada = encodeURIComponent(mensagemFinal);
    const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${telefoneLimpo}&text=${mensagemCodificada}`; // Abre WhatsApp

    window.open(linkWhatsApp, "_blank"); // Salva o envio no Firestore

    await salvarEnvioDocumentos(
      candidatoId,
      documentosSelecionados,
      linkAssinatura,
      dataToken.tokenId
    );

    window.showToast?.("✅ Documentos enviados! WhatsApp aberto", "success");
    setTimeout(() => {
      window.fecharModalEnviarDocumentos();
      const state = getGlobalState();
      const { handleTabClick, statusAdmissaoTabs } = state;
      const activeTab = statusAdmissaoTabs?.querySelector(".tab-link.active");
      if (activeTab) handleTabClick({ currentTarget: activeTab });
    }, 2000);
  } catch (error) {
    console.error("❌ Erro ao enviar documentos:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.innerHTML =
      '<i class="fab fa-whatsapp me-2"></i> Enviar via WhatsApp';
  }
};

/**
 * Esta função é copiada de 'tabCadastroDocumentos.js' para permitir
 * o reenvio do formulário a partir desta aba.
 */
window.abrirModalReenviarFormulario = function (candidatoId, dadosCodificados) {
  console.log("🎯 Abrindo modal de REenvio de formulário");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    const modalExistente = document.getElementById("modal-enviar-formulario");
    if (modalExistente) {
      modalExistente.remove();
    }

    const urlBase = window.location.origin;
    const linkFormulario = `${urlBase}/public/fichas-de-inscricao.html?candidaturaId=${candidatoId}`;

    const modal = document.createElement("div");
    modal.id = "modal-enviar-formulario"; // Mesmo ID da aba anterior, para reutilizar CSS e helpers
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
    	#modal-enviar-formulario .modal-header {
          background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%) !important;
        	color: white !important; padding: 20px !important; display: flex !important;
        	justify-content: space-between !important; align-items: center !important;
      	}
    	#modal-enviar-formulario .modal-title {
      		display: flex !important; align-items: center !important; gap: 12px !important; margin: 0 !important;
    	}
    	#modal-enviar-formulario .modal-title h3 { margin: 0 !important; font-size: 20px !important; font-weight: 600 !important; }
      	#modal-enviar-formulario .modal-close {
        	background: rgba(255,255,255,0.2) !important; border: none !important; color: white !important;
        	width: 36px !important; height: 36px !important; border-radius: 50% !important; cursor: pointer !important;
        	display: flex !important; align-items: center !important; justify-content: center !important;
        	font-size: 18px !important;
      	}
      	#modal-enviar-formulario .modal-body {
        	padding: 25px !important; max-height: 500px !important; overflow-y: auto !important;
        	background: #f8f9fa !important; font-family: inherit !important;
      	}
    	#modal-enviar-formulario .info-card {
      		background: white !important; padding: 15px !important; border-radius: 8px !important;
      		margin-bottom: 20px !important; border-left: 4px solid #17a2b8 !important;
    	}
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
    	#modal-enviar-formulario .btn-salvar { background: #ffc107 !important; color: #212529 !important; }
      </style>
    	<div class="modal-container">
    		<div class="modal-header">
    			<div class="modal-title">
    				<i class="fas fa-exclamation-triangle"></i>
    				<h3>Reenviar Formulário de Cadastro</h3>
    			</div>
    			<button class="modal-close" onclick="fecharModalEnviarFormulario()">
    				<i class="fas fa-times"></i>
    			</button>
    		</div>
    		<div class="modal-body">
    			<div class="info-card">
    				<p><strong>Candidato:</strong> ${dadosCandidato.nome_completo}</p>
    			</div>
    			<form id="form-enviar-link-${candidatoId}">
    				<div class="form-group">
    					<label class="form-label" for="link-formulario-cadastro">
    						Link do Formulário (Pronto para reenviar):
    					</label>
    					<input type="text" id="link-formulario-cadastro" class="form-input" 
    						value="${linkFormulario}" readonly>
    				</div>
    				<p style="font-size: 12px; color: #6c757d;">
    					Reenvie este link ao candidato. Clicar em "Marcar como Reenviado" apenas adicionará um novo registro no histórico.
    				</p>
    			</form>
    		</div>
    		<div class="modal-footer">
    			<div>
    				<button type="button" class="btn btn-copiar" onclick="copiarLinkFormulario()">
    					<i class="fas fa-copy"></i> Copiar Link
    				</button>
    			</div>
    			<div>
    				<button type="button" class="btn btn-cancelar" onclick="fecharModalEnviarFormulario()">
    					<i class="fas fa-times"></i> Cancelar
    				</button>
    				<button type="button" class="btn btn-salvar" 
    					onclick="salvarReenvioFormulario('${candidatoId}')">
    					<i class="fas fa-check-circle"></i> Marcar como Reenviado
    				</button>
    			</div>
    		</div>
    	</div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";
  } catch (error) {
    console.error("❌ Erro ao criar modal de reenvio:", error);
  }
};

/**
 * Salva o REenvio (apenas loga no histórico)
 */
window.salvarReenvioFormulario = async function (candidatoId) {
  console.log("💾 Marcando formulário como REenviado...");

  const modal = document.getElementById("modal-enviar-formulario");
  const btnSalvar = modal?.querySelector(".btn-salvar");

  if (btnSalvar) {
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
  }

  try {
    const { candidatosCollection, currentUserData } = getGlobalState();
    const candidatoRef = doc(candidatosCollection, candidatoId);
    await updateDoc(candidatoRef, {
      historico: arrayUnion({
        data: new Date(),
        acao: `Link do formulário de cadastro REENVIADO ao candidato.`,
        usuario: currentUserData.id || "rh_admin",
      }),
    });
    window.showToast?.("Histórico de reenvio salvo!", "success");
    window.fecharModalEnviarFormulario();
  } catch (error) {
    console.error("❌ Erro ao marcar como reenviado:", error);
    alert(`Erro ao salvar: ${error.message}`);
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML =
        '<i class="fas fa-check-circle"></i> Marcar como Reenviado';
    }
  }
};
