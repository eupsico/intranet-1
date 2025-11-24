/**
 * Arquivo: modulos/rh/js/tabs/tabAssinaturaDocs.js
 * Versão: 2.2.0 (Correção de Imports e Logs de Debug)
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
  arrayUnion,
  addDoc, // <--- ESTE IMPORT É ESSENCIAL PARA CRIAR A COLEÇÃO
} from "../../../../assets/js/firebase-init.js";

// ============================================
// CONSTANTES
// ============================================
let dadosCandidatoAtual = null;

// URL da Intranet (Login)
const URL_INTRANET = "https://intranet.eupsico.org.br";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarAssinaturaDocs(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando candidatos para assinatura...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "in", [
        "AGUARDANDO_PREENCHIMENTO_FORM",
        "AGUARDANDO_ASSINATURA",
        "DOCS_LIBERADOS",
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
        '<p class="alert alert-info">Nenhum candidato nesta etapa.</p>';
      return;
    }

    let listaHtml = `
    <div class="description-box" style="margin-top: 15px;">
      <p>Libere os documentos (Contrato, Termos) para que o colaborador assine acessando a Intranet com seu login e senha.</p>
    </div>
    <div class="candidatos-container candidatos-grid">
    `;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada";
      const statusAtual = cand.status_recrutamento || "N/A";

      let statusClass = "status-info";
      let botaoAcao = "";

      // Lógica dos Botões
      if (statusAtual === "AGUARDANDO_ASSINATURA") {
        statusClass = "status-success";
        botaoAcao = `
          <button 
            class="btn btn-sm btn-primary btn-enviar-documentos" 
            data-id="${candidatoId}"
            data-dados="${encodeURIComponent(
              JSON.stringify({
                id: candidatoId,
                nome_candidato: cand.nome_candidato,
                email_novo: cand.admissaoinfo?.email_solicitado,
                telefone_contato: cand.telefone_contato,
              })
            )}"
            style="padding: 10px 16px; background: var(--cor-sucesso); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
            <i class="fas fa-file-signature me-1"></i> Liberar Documentos
          </button>`;
      } else if (statusAtual === "DOCS_LIBERADOS") {
        statusClass = "status-warning";
        botaoAcao = `
          <button class="btn btn-sm btn-secondary" disabled style="opacity: 0.7; cursor: default;">
             <i class="fas fa-clock me-1"></i> Aguardando Assinatura
          </button>`;
      } else {
        statusClass = "status-warning";
        botaoAcao = `
          <button class="btn btn-sm btn-warning" disabled style="opacity: 0.7;">
             <i class="fas fa-hourglass-half me-1"></i> Aguardando Ficha
          </button>`;
      }

      listaHtml += `
      <div class="card card-candidato-gestor" data-id="${candidatoId}">
       <div class="info-primaria">
        <h4 class="nome-candidato">
         ${cand.nome_candidato || "Candidato"}
          <span class="status-badge ${statusClass}">
            <i class="fas fa-tag"></i> ${statusAtual}
          </span>
        </h4>
        <p class="small-info" style="color: var(--cor-primaria);">
         <i class="fas fa-envelope"></i> E-mail: ${
           cand.admissaoinfo?.email_solicitado || "..."
         }
        </p>
       </div>
       
       <div class="acoes-candidato">
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
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalEnviarDocumentos(candidatoId, dados, state);
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

async function abrirModalEnviarDocumentos(
  candidatoId,
  dadosCodificados,
  state
) {
  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
    dadosCandidatoAtual = dadosCandidato;

    const modalExistente = document.getElementById("modal-enviar-documentos");
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement("div");
    modal.id = "modal-enviar-documentos";
    modal.dataset.candidaturaId = candidatoId;

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
       <h3><i class="fas fa-file-signature"></i> Liberar Documentos</h3>
       <button onclick="fecharModalEnviarDocumentos()" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">&times;</button>
      </div>
      
      <div class="modal-body">
       <div class="info-card">
        <p><strong>Colaborador:</strong> ${dadosCandidato.nome_candidato}</p>
        <p><strong>E-mail:</strong> ${dadosCandidato.email_novo}</p>
       </div>
      
       <div class="form-group">
         <label class="form-label" style="font-weight:bold; display:block; margin-bottom:10px;">Selecione os documentos para liberar:</label>
         <div id="documentos-checklist-container" style="background:white;padding:15px;border:1px solid #ddd;border-radius:6px;max-height:200px;overflow-y:auto;">
            <p>Carregando modelos...</p>
         </div>
       </div>
       
       <div class="form-group">
        <label class="form-label" style="font-weight:bold;">Mensagem para WhatsApp:</label>
        <textarea id="documentos-mensagem" class="form-textarea" rows="5" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
Olá ${dadosCandidato.nome_candidato.split(" ")[0]}!

Seus documentos de admissão já estão disponíveis na Intranet.

1. Acesse: ${URL_INTRANET}
2. Faça login com seu e-mail corporativo e senha.
3. Vá em *Portal do Voluntário* > *Assinaturas e Termos* para assinar.

Qualquer dúvida, estamos à disposição!
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
    alert("Erro ao abrir modal.");
  }
}

async function carregarDocumentosDisponiveis() {
  const container = document.getElementById("documentos-checklist-container");
  if (!container) return;

  try {
    // Tenta buscar na coleção de modelos principal
    const documentosRef = collection(db, "rh_documentos_modelos");
    let snapshot = await getDocs(
      query(documentosRef, where("ativo", "==", true))
    );

    if (snapshot.empty) {
      // Tenta outras coleções caso o nome tenha mudado
      snapshot = await getDocs(collection(db, "modelos_documentos"));
    }

    if (snapshot.empty) {
      container.innerHTML =
        '<p class="text-danger">Nenhum modelo de documento encontrado. Cadastre em "Gerenciar Documentos".</p>';
      return;
    }

    let html = "";
    snapshot.forEach((docSnap) => {
      const docData = docSnap.data();
      const titulo = docData.titulo || docData.nome || "Documento sem título";
      html += `
      <div style="margin-bottom:8px;">
        <input type="checkbox" value="${docSnap.id}" id="doc-${docSnap.id}" data-titulo="${titulo}">
        <label for="doc-${docSnap.id}">${titulo}</label>
      </div>`;
    });
    container.innerHTML = html;
  } catch (error) {
    console.error("Erro ao carregar docs:", error);
    container.innerHTML = '<p class="text-danger">Erro ao carregar lista.</p>';
  }
}

// ============================================
// AÇÃO DE LIBERAÇÃO E CRIAÇÃO DE ASSINATURA
// ============================================

window.confirmarLiberacaoDocs = async function () {
  console.log("💾 Iniciando liberação de documentos...");
  const modal = document.getElementById("modal-enviar-documentos");
  const btn = document.getElementById("btn-confirmar-liberacao");
  const candidatoId = modal.dataset.candidaturaId;
  const msgWhatsapp = document.getElementById("documentos-mensagem").value;

  // 1. Coleta documentos
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
    const { candidatosCollection, currentUserData } = getGlobalState();

    // 2. Busca o UID do Usuário Real
    // (Este passo é crucial para o vínculo funcionar na tela do voluntário)
    console.log(
      `🔍 Buscando usuário com e-mail: ${dadosCandidatoAtual.email_novo}`
    );

    if (!dadosCandidatoAtual.email_novo) {
      throw new Error(
        "O candidato não possui e-mail corporativo registrado na admissão."
      );
    }

    const usuariosRef = collection(db, "usuarios");
    const qUser = query(
      usuariosRef,
      where("email", "==", dadosCandidatoAtual.email_novo)
    );
    const snapshotUser = await getDocs(qUser);

    if (snapshotUser.empty) {
      throw new Error(
        `ERRO: O usuário com e-mail ${dadosCandidatoAtual.email_novo} não foi encontrado na coleção 'usuarios'.\n\nVerifique se a Ficha de Cadastro foi preenchida corretamente e se o usuário foi criado na etapa anterior.`
      );
    }

    const usuarioReal = snapshotUser.docs[0];
    const usuarioUid = usuarioReal.id;
    console.log(`✅ Usuário encontrado! UID: ${usuarioUid}`);

    // 3. Cria a solicitação na nova coleção
    const solicitacaoData = {
      tipo: "fase_1",
      usuarioUid: usuarioUid, // Vínculo para o 'where' do lado do voluntário
      candidatoId_ref: candidatoId,
      emailUsuario: dadosCandidatoAtual.email_novo,
      nomeUsuario: dadosCandidatoAtual.nome_candidato,
      documentos: docsSelecionados,
      status: "pendente",
      dataEnvio: new Date(),
      enviadoPor: currentUserData.nome || "RH",
      metodoAssinatura: "interno_de_acordo",
      fase: 1,
    };

    // Cria a coleção se não existir
    await addDoc(collection(db, "solicitacoes_assinatura"), solicitacaoData);
    console.log("✅ Solicitação salva na coleção 'solicitacoes_assinatura'");

    // 4. Atualiza o card na Admissão
    const candidatoRef = doc(candidatosCollection, candidatoId);
    await updateDoc(candidatoRef, {
      status_recrutamento: "DOCS_LIBERADOS",
      historico: arrayUnion({
        data: new Date(),
        acao: `Documentos liberados para assinatura interna.`,
        usuario: currentUserData.id || "rh_admin",
      }),
    });

    // 5. Abre WhatsApp
    const telefone = dadosCandidatoAtual.telefone_contato.replace(/\D/g, "");
    const linkZap = `https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(
      msgWhatsapp
    )}`;
    window.open(linkZap, "_blank");

    window.showToast?.("Documentos liberados com sucesso!", "success");
    fecharModalEnviarDocumentos();

    const state = getGlobalState();
    renderizarAssinaturaDocs(state);
  } catch (error) {
    console.error("❌ Erro ao liberar:", error);
    alert(`Erro ao liberar documentos: ${error.message}`);
    btn.disabled = false;
    btn.innerHTML = '<i class="fab fa-whatsapp"></i> Liberar e Avisar';
  }
};

window.fecharModalEnviarDocumentos = function () {
  const modal = document.getElementById("modal-enviar-documentos");
  if (modal) modal.remove();
  document.body.style.overflow = "";
};
