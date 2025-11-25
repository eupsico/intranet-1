/**
 * Arquivo: modulos/rh/js/tabs/tabAssinaturaDocs.js
 * Versão: 4.0.0 (Migração Completa para Coleção Usuarios)
 * Descrição: Gerencia a liberação de documentos para assinatura (Fase 1).
 */

import { getGlobalState } from "../admissao.js";
import {
  db,
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
} from "../../../../assets/js/firebase-init.js";

// Variável global do módulo
let dadosUsuarioAtual = null;
const URL_INTRANET = "https://intranet.eupsico.org.br";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarAssinaturaDocs(state) {
  const { conteudoAdmissao, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando usuários para assinatura...</div>';

  try {
    // ✅ MUDANÇA: Busca na coleção 'usuarios' pelo 'status_admissao'
    const usuariosCollection = collection(db, "usuarios");
    const q = query(
      usuariosCollection,
      where("status_admissao", "in", [
        "AGUARDANDO_ASSINATURA_FASE1",
        "DOCS_LIBERADOS_FASE1",
      ])
    );
    const snapshot = await getDocs(q);

    const tab = statusAdmissaoTabs.querySelector(
      '.tab-link[data-status="assinatura-documentos"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-file-signature me-2"></i> 3. Assinatura de Documentos (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML =
        '<p class="alert alert-info">Nenhum colaborador aguardando assinatura.</p>';
      return;
    }

    let listaHtml = `
    <div class="description-box" style="margin-top: 15px;">
      <p><strong>Fase 1 (Admissão):</strong> Libere os documentos iniciais para assinatura. O colaborador já possui acesso à Intranet.</p>
    </div>
    <div class="candidatos-container candidatos-grid">
    `;

    snapshot.docs.forEach((docSnap) => {
      const user = docSnap.data();
      const userId = docSnap.id;
      const statusAtual = user.status_admissao || "N/A";

      let statusClass = "status-info";
      let botaoAcao = "";

      // ✅ LÓGICA DO BOTÃO (Baseada em status_admissao)
      if (statusAtual === "DOCS_LIBERADOS_FASE1") {
        statusClass = "status-warning";
        botaoAcao = `
            <button class="action-button secondary" disabled style="opacity: 0.7; cursor: default; width: 100%;">
               <i class="fas fa-clock me-2"></i> Aguardando Assinatura
            </button>`;
      } else if (statusAtual === "AGUARDANDO_ASSINATURA_FASE1") {
        statusClass = "status-success";
        botaoAcao = `
          <button 
            class="btn btn-sm btn-primary btn-enviar-documentos" 
            data-id="${userId}"
            data-dados="${encodeURIComponent(
              JSON.stringify({
                id: userId,
                nome: user.nome,
                email: user.email,
                telefone: user.contato,
              })
            )}"
            style="padding: 10px 16px; background: var(--cor-sucesso); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
            <i class="fas fa-file-signature me-1"></i> Liberar Documentos
          </button>`;
      }

      // Objeto de visualização
      const dadosExibicao = {
        nome: user.nome || "Usuário Sem Nome",
        email: user.email || "...",
        status: statusAtual,
      };

      listaHtml += `
      <div class="card card-candidato-gestor" data-id="${userId}">
       <div class="info-primaria">
        <h4 class="nome-candidato">
         ${dadosExibicao.nome}
          <span class="status-badge ${statusClass}">
            ${dadosExibicao.status.replace(/_/g, " ")}
          </span>
        </h4>
        <p class="small-info" style="color: var(--cor-primaria);">
         <i class="fas fa-envelope"></i> E-mail: ${dadosExibicao.email}
        </p>
       </div>
       
       div class="acoes-candidato">
         ${botaoAcao}
         <button 
           class="btn btn-sm btn-secondary btn-ver-detalhes-admissao" 
           data-id="${candidatoId}"
           data-dados="${encodeURIComponent(JSON.stringify(cand))}"
           style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 100px;">
           <i class="fas fa-eye me-1"></i> Detalhes
         </button>
       </div>
      </div>
     `;
    });

    listaHtml += "</div>";
    conteudoAdmissao.innerHTML = listaHtml;

    // Listeners
    document.querySelectorAll(".btn-enviar-documentos").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalEnviarDocumentos(userId, dados, state, 1); // Fase 1
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar aba de Assinatura:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

// ============================================
// MODAL E AÇÃO (ATUALIZADOS PARA USUÁRIOS)
// ============================================

async function abrirModalEnviarDocumentos(
  userId,
  dadosCodificados,
  state,
  fase = 1
) {
  try {
    const dadosUsuario = JSON.parse(decodeURIComponent(dadosCodificados));
    dadosUsuarioAtual = dadosUsuario;

    const modalExistente = document.getElementById("modal-enviar-documentos");
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement("div");
    modal.id = "modal-enviar-documentos";
    modal.dataset.usuarioId = userId;
    modal.dataset.fase = fase;

    const tituloFase =
      fase === 1 ? "Fase 1: Admissão" : "Fase 2: Pós-Experiência";

    modal.innerHTML = `
     <style>
      #modal-enviar-documentos { all: initial !important; display: block !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999 !important; background: rgba(0, 0, 0, 0.7) !important; font-family: inherit !important; }
      #modal-enviar-documentos .modal-container { position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; max-width: 700px !important; background: #ffffff !important; border-radius: 12px !important; box-shadow: 0 25px 50px -15px rgba(0, 0, 0, 0.3) !important; overflow: hidden !important; }
      #modal-enviar-documentos .modal-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; color: white !important; padding: 20px !important; display: flex !important; justify-content: space-between !important; align-items: center !important; }
      #modal-enviar-documentos .modal-body { padding: 25px !important; background: #f8f9fa !important; }
      #modal-enviar-documentos .info-card { background: white !important; padding: 15px !important; border-radius: 8px !important; margin-bottom: 20px !important; border-left: 4px solid #667eea !important; }
      #modal-enviar-documentos .form-group { margin-bottom: 20px !important; }
      #modal-enviar-documentos .modal-footer { padding: 20px 25px !important; background: white !important; border-top: 1px solid #e9ecef !important; display: flex !important; justify-content: flex-end !important; gap: 12px !important; }
      #modal-enviar-documentos .btn { padding: 12px 24px !important; border-radius: 6px !important; cursor: pointer !important; font-weight: 500 !important; border: none !important; }
      .btn-cancelar { background: #6c757d !important; color: white !important; }
      .btn-salvar { background: #667eea !important; color: white !important; }
     </style>
     <div class="modal-container">
      <div class="modal-header">
       <h3><i class="fas fa-file-signature"></i> Liberar Documentos (${tituloFase})</h3>
       <button onclick="fecharModalEnviarDocumentos()" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">&times;</button>
      </div>
      <div class="modal-body">
       <div class="info-card">
        <p><strong>Colaborador:</strong> ${dadosUsuario.nome}</p>
        <p><strong>E-mail:</strong> ${dadosUsuario.email}</p>
       </div>
       <div class="form-group">
         <label class="form-label" style="font-weight:bold; display:block; margin-bottom:10px;">Selecione os documentos:</label>
         <div id="documentos-checklist-container" style="background:white;padding:15px;border:1px solid #ddd;border-radius:6px;max-height:200px;overflow-y:auto;">
            <p>Carregando modelos...</p>
         </div>
       </div>
       <div class="form-group">
        <label class="form-label" style="font-weight:bold;">Mensagem para WhatsApp:</label>
        <textarea id="documentos-mensagem" class="form-textarea" rows="5" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
Olá ${dadosUsuario.nome.split(" ")[0]}!
Novos documentos (${tituloFase}) disponíveis na Intranet.
1. Acesse: ${URL_INTRANET}
2. Vá em Portal do Voluntário > Assinaturas e Termos.
        </textarea>
       </div>
      </div>
      <div class="modal-footer">
       <button class="btn btn-cancelar" onclick="fecharModalEnviarDocumentos()">Cancelar</button>
       <button class="btn btn-salvar" id="btn-confirmar-liberacao" onclick="confirmarLiberacaoDocs()">
        <i class="fab fa-whatsapp"></i> Liberar e Avisar
       </button>
      </div>
     </div>
    `;
    document.body.appendChild(modal);
    carregarDocumentosDisponiveis();
  } catch (error) {
    console.error("Erro modal:", error);
  }
}

async function carregarDocumentosDisponiveis() {
  const container = document.getElementById("documentos-checklist-container");
  if (!container) return;
  try {
    const documentosRef = collection(db, "rh_documentos_modelos");
    let snapshot = await getDocs(
      query(documentosRef, where("ativo", "==", true))
    );
    if (snapshot.empty)
      snapshot = await getDocs(collection(db, "modelos_documentos"));

    let html = "";
    snapshot.forEach((docSnap) => {
      const docData = docSnap.data();
      html += `<div style="margin-bottom:8px;"><input type="checkbox" value="${
        docSnap.id
      }" id="doc-${docSnap.id}" data-titulo="${
        docData.titulo || "Sem título"
      }"><label for="doc-${docSnap.id}">${
        docData.titulo || "Sem título"
      }</label></div>`;
    });
    container.innerHTML = html || "<p>Nenhum modelo encontrado.</p>";
  } catch (error) {
    container.innerHTML = "<p>Erro ao carregar.</p>";
  }
}

window.confirmarLiberacaoDocs = async function () {
  console.log("💾 Liberando documentos (Fluxo Usuários)...");
  const modal = document.getElementById("modal-enviar-documentos");
  const btn = document.getElementById("btn-confirmar-liberacao");
  const usuarioUid = modal.dataset.usuarioId;
  const fase = parseInt(modal.dataset.fase) || 1;
  const msgWhatsapp = document.getElementById("documentos-mensagem").value;

  const docsSelecionados = [];
  modal.querySelectorAll("input[type=checkbox]:checked").forEach((cb) => {
    docsSelecionados.push({
      modeloId: cb.value,
      titulo: cb.dataset.titulo,
      status: "pendente",
    });
  });

  if (docsSelecionados.length === 0) {
    alert("Selecione ao menos um documento.");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = "Processando...";

  try {
    const { currentUserData } = getGlobalState();

    // Cria Solicitação na coleção dedicada
    const solicitacaoData = {
      tipo: `fase_${fase}`,
      fase: fase,
      usuarioUid: usuarioUid,
      emailUsuario: dadosUsuarioAtual.email,
      nomeUsuario: dadosUsuarioAtual.nome,
      documentos: docsSelecionados,
      status: "pendente",
      dataEnvio: new Date(),
      enviadoPor: currentUserData.nome || "RH",
      metodoAssinatura: "interno_de_acordo",
    };

    await addDoc(collection(db, "solicitacoes_assinatura"), solicitacaoData);

    // Atualiza STATUS_ADMISSAO no USUÁRIO
    const novoStatus =
      fase === 1 ? "DOCS_LIBERADOS_FASE1" : "DOCS_LIBERADOS_FASE2";

    await updateDoc(doc(db, "usuarios", usuarioUid), {
      status_admissao: novoStatus,
    });

    const telefone = dadosUsuarioAtual.telefone.replace(/\D/g, "");
    const linkZap = `https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(
      msgWhatsapp
    )}`;
    window.open(linkZap, "_blank");

    window.showToast?.("Documentos liberados!", "success");
    fecharModalEnviarDocumentos();

    const state = getGlobalState();
    if (state.handleTabClick) {
      const activeTab = document.querySelector(
        "#status-admissao-tabs .tab-link.active"
      );
      if (activeTab) state.handleTabClick({ currentTarget: activeTab });
    }
  } catch (error) {
    console.error("Erro:", error);
    alert(`Erro: ${error.message}`);
    btn.disabled = false;
    btn.innerHTML = '<i class="fab fa-whatsapp"></i> Liberar e Avisar';
  }
};

window.fecharModalEnviarDocumentos = function () {
  const modal = document.getElementById("modal-enviar-documentos");
  if (modal) modal.remove();
  document.body.style.overflow = "";
};

// Expõe função para uso global
window.abrirModalEnviarDocumentos = abrirModalEnviarDocumentos;
