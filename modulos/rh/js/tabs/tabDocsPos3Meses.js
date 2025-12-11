/**
 * Arquivo: modulos/rh/js/tabs/tabDocsPos3Meses.js
 * Versão: 5.1.0 (Correção Final: Seletor HTML e Conflito de Escopo Resolvidos)
 * Descrição: Gerencia a liberação de documentos para assinatura (Fase 2 - Pós-Experiência).
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

// Variável global exclusiva deste módulo para evitar conflitos com a Fase 1
let dadosUsuarioAtualPos3Meses = null;
const URL_INTRANET = "https://intranet.eupsico.org.br";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarDocsPos3Meses(state) {
  const { conteudoAdmissao, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando usuários para assinatura (Fase 2)...</div>';

  try {
    // Busca na coleção 'usuarios' pelo 'status_admissao'
    const usuariosCollection = collection(db, "usuarios");
    const q = query(
      usuariosCollection,
      where("status_admissao", "in", [
        "DOCS_FASE2_PREPARACAO",
        "AGUARDANDO_ASSINATURA_FASE2",
      ])
    );
    const snapshot = await getDocs(q);

    // ✅ CORREÇÃO: Nome exato conforme seu admissao.html
    const tab = statusAdmissaoTabs.querySelector(
      '.tab-link[data-status="documentos-pos-3-meses"]'
    );

    if (tab) {
      tab.innerHTML = `<i class="fas fa-file-contract me-2"></i>Documentos (Pós-3 Meses) (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML =
        '<p class="alert alert-info">Nenhum colaborador aguardando assinatura de pós-experiência.</p>';
      return;
    }

    let listaHtml = `
    <div class="description-box" style="margin-top: 15px;">
      <p><strong>Fase 2 (Pós-Experiência):</strong> Libere o contrato definitivo e novos termos para assinatura.</p>
    </div>
    <div class="candidatos-container candidatos-grid">
    `;

    snapshot.docs.forEach((docSnap) => {
      const user = docSnap.data();
      const userId = docSnap.id;
      const statusAtual = user.status_admissao || "N/A";

      let statusClass = "status-info";
      let botaoAcao = "";

      // LÓGICA DO BOTÃO
      if (statusAtual === "AGUARDANDO_ASSINATURA_FASE2") {
        statusClass = "status-warning";
        // Botão de Lembrete (Função renomeada para evitar conflito)
        botaoAcao = `
            <button class="btn btn-sm btn-warning btn-lembrar-assinatura-pos" 
               data-id="${userId}"
               data-dados="${encodeURIComponent(
                 JSON.stringify({
                   id: userId,
                   nome: user.nome,
                   telefone: user.contato || user.telefone || "",
                 })
               )}"
               style="padding: 10px 16px; background: #ffc107; color: #212529; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
               <i class="fab fa-whatsapp me-1"></i> Lembrar Assinatura
            </button>`;
      } else {
        // DOCS_FASE2_PREPARACAO
        statusClass = "status-success";
        // Botão de Envio (Função renomeada para evitar conflito)
        botaoAcao = `
          <button 
            class="btn btn-sm btn-primary btn-enviar-docs-pos" 
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

      // Dados para o Modal de Detalhes (padronizado)
      const dadosParaModal = {
        id: userId,
        nome_candidato: user.nome || "Usuário Sem Nome",
        email_candidato: user.email || "Sem e-mail",
        telefone_candidato: user.contato || user.telefone || "",
        titulo_vaga_original: user.profissao || "Cargo não informado",
        status_recrutamento: statusAtual,
        email_novo: user.email,
      };

      const dadosCodificados = encodeURIComponent(
        JSON.stringify(dadosParaModal)
      );

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
       
       <div class="acoes-candidato">
         ${botaoAcao}
         <button 
           class="btn btn-sm btn-secondary btn-ver-detalhes-pos" 
           data-id="${userId}"
           data-dados="${dadosCodificados}"
           style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 100px;">
           <i class="fas fa-eye me-1"></i> Detalhes
         </button>
       </div>
      </div>
     `;
    });

    listaHtml += "</div>";
    conteudoAdmissao.innerHTML = listaHtml;

    // LISTENERS (Usando as funções renomeadas)

    document.querySelectorAll(".btn-enviar-docs-pos").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        // Chama modal exclusivo desta aba (fase 2)
        abrirModalEnviarDocumentosPos3Meses(userId, dados, state, 2);
      });
    });

    document.querySelectorAll(".btn-lembrar-assinatura-pos").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dados = JSON.parse(
          decodeURIComponent(e.currentTarget.getAttribute("data-dados"))
        );
        enviarLembreteAssinaturaPos(dados);
      });
    });

    document.querySelectorAll(".btn-ver-detalhes-pos").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dadosCodificados = e.currentTarget.getAttribute("data-dados");
        if (typeof window.abrirModalCandidato === "function") {
          try {
            const dadosUser = JSON.parse(decodeURIComponent(dadosCodificados));
            window.abrirModalCandidato(userId, "detalhes", dadosUser);
          } catch (err) {
            console.error("Erro ao abrir detalhes", err);
          }
        }
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar aba de Assinatura (Fase 2):", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

// ============================================
// FUNÇÃO DE LEMBRETE (Renomeada)
// ============================================
function enviarLembreteAssinaturaPos(dados) {
  const nome = dados.nome ? dados.nome.split(" ")[0] : "Colaborador";
  const telefone = dados.telefone ? dados.telefone.replace(/\D/g, "") : "";

  if (!telefone) {
    alert("Telefone não encontrado para este usuário.");
    return;
  }

  const msg = `Olá ${nome}, tudo bem? 👋\n\nPassando para lembrar que os *documentos da sua Efetivação (Pós-Experiência)* já estão disponíveis e aguardando sua assinatura na Intranet! 📄✍️\n\nPara assinar:\n1️⃣ Acesse: ${URL_INTRANET}\n2️⃣ Vá no menu *Portal do Voluntário > Assinaturas e Termos*\n3️⃣ Leia e assine digitalmente.\n\nContamos com você!`;

  const link = `https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(
    msg
  )}`;
  window.open(link, "_blank");
}

// ============================================
// MODAL DE ENVIO DE DOCUMENTOS (RENOMEADO)
// ============================================

// Função global única para esta aba
async function abrirModalEnviarDocumentosPos3Meses(
  userId,
  dadosCodificados,
  state,
  fase = 2
) {
  try {
    const dadosObj = JSON.parse(decodeURIComponent(dadosCodificados));

    const dadosUsuario = {
      nome: dadosObj.nome || dadosObj.nome_candidato || "Colaborador",
      email:
        dadosObj.email || dadosObj.email_novo || dadosObj.email_candidato || "",
      telefone:
        dadosObj.telefone ||
        dadosObj.telefone_candidato ||
        dadosObj.contato ||
        "",
    };

    // Armazena na variável global ESPECÍFICA DESTE MÓDULO (resolve o problema do undefined)
    dadosUsuarioAtualPos3Meses = dadosUsuario;

    // ID Único para evitar conflito com a aba da Fase 1
    const modalId = "modal-enviar-docs-pos3meses";
    const modalExistente = document.getElementById(modalId);
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement("div");
    modal.id = modalId;
    modal.dataset.usuarioId = userId;
    modal.dataset.fase = fase;

    const tituloFase = "Fase 2: Pós-Experiência";
    const msgPadrao = `Olá ${dadosUsuario.nome.split(" ")[0]}, tudo bem? 👋

Seus documentos de efetivação (${tituloFase}) já estão disponíveis para assinatura na Intranet! 📄✍️

É bem simples:
1️⃣ Acesse: ${URL_INTRANET}
2️⃣ Vá no menu *Portal do Voluntário > Assinaturas e Termos*
3️⃣ Clique em "Assinar" nos documentos pendentes.

Parabéns pela efetivação! 🚀`;

    // IDs internos também renomeados para evitar conflito de querySelector
    modal.innerHTML = `
     <style>
      #${modalId} { all: initial !important; display: block !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999 !important; background: rgba(0, 0, 0, 0.7) !important; font-family: inherit !important; }
      #${modalId} .modal-container { position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; max-width: 700px !important; background: #ffffff !important; border-radius: 12px !important; box-shadow: 0 25px 50px -15px rgba(0, 0, 0, 0.3) !important; overflow: hidden !important; }
      #${modalId} .modal-header { background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; color: white !important; padding: 20px !important; display: flex !important; justify-content: space-between !important; align-items: center !important; }
      #${modalId} .modal-body { padding: 25px !important; background: #f8f9fa !important; }
      #${modalId} .info-card { background: white !important; padding: 15px !important; border-radius: 8px !important; margin-bottom: 20px !important; border-left: 4px solid #10b981 !important; }
      #${modalId} .form-group { margin-bottom: 20px !important; }
      #${modalId} .modal-footer { padding: 20px 25px !important; background: white !important; border-top: 1px solid #e9ecef !important; display: flex !important; justify-content: flex-end !important; gap: 12px !important; }
      #${modalId} .btn { padding: 12px 24px !important; border-radius: 6px !important; cursor: pointer !important; font-weight: 500 !important; border: none !important; }
      .btn-cancelar { background: #6c757d !important; color: white !important; }
      .btn-salvar { background: #10b981 !important; color: white !important; }
     </style>
     <div class="modal-container">
      <div class="modal-header">
       <h3><i class="fas fa-file-signature"></i> Liberar Documentos (${tituloFase})</h3>
       <button onclick="fecharModalEnviarDocumentosPos3Meses()" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">&times;</button>
      </div>
      <div class="modal-body">
       <div class="info-card">
        <p><strong>Colaborador:</strong> ${dadosUsuario.nome}</p>
        <p><strong>E-mail:</strong> ${
          dadosUsuario.email ||
          "<span style='color:red'>Não encontrado (Erro)</span>"
        }</p>
       </div>
       <div class="form-group">
         <label class="form-label" style="font-weight:bold; display:block; margin-bottom:10px;">Selecione os documentos:</label>
         <div id="checklist-docs-pos3meses" style="background:white;padding:15px;border:1px solid #ddd;border-radius:6px;max-height:200px;overflow-y:auto;">
            <p>Carregando modelos...</p>
         </div>
       </div>
       <div class="form-group">
        <label class="form-label" style="font-weight:bold;">Mensagem para WhatsApp:</label>
        <textarea id="mensagem-docs-pos3meses" class="form-textarea" rows="8" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">${msgPadrao}</textarea>
       </div>
      </div>
      <div class="modal-footer">
       <button class="btn btn-cancelar" onclick="fecharModalEnviarDocumentosPos3Meses()">Cancelar</button>
       <button class="btn btn-salvar" id="btn-liberar-pos3meses" onclick="confirmarLiberacaoDocsPos3Meses()">
        <i class="fab fa-whatsapp"></i> Liberar e Avisar
       </button>
      </div>
     </div>
    `;
    document.body.appendChild(modal);
    carregarDocumentosDisponiveisPos3Meses();
  } catch (error) {
    console.error("Erro modal:", error);
  }
}

// Renomeado para evitar conflito com a outra aba
async function carregarDocumentosDisponiveisPos3Meses() {
  const container = document.getElementById("checklist-docs-pos3meses");
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
      }" id="doc-pos-${docSnap.id}" data-titulo="${
        docData.titulo || "Sem título"
      }"><label for="doc-pos-${docSnap.id}" style="margin-left: 8px;">${
        docData.titulo || "Sem título"
      }</label></div>`;
    });
    container.innerHTML = html || "<p>Nenhum modelo encontrado.</p>";
  } catch (error) {
    container.innerHTML = "<p>Erro ao carregar.</p>";
  }
}

// =========================================================
// FUNÇÃO EXPORTADA NO WINDOW COM NOME ÚNICO
// =========================================================
window.confirmarLiberacaoDocsPos3Meses = async function () {
  console.log("💾 Liberando documentos (Fluxo Pós-Experiência)...");

  // Captura elementos usando os novos IDs
  const modal = document.getElementById("modal-enviar-docs-pos3meses");
  const btn = document.getElementById("btn-liberar-pos3meses");
  const usuarioUid = modal.dataset.usuarioId;
  const fase = parseInt(modal.dataset.fase) || 2;
  const msgWhatsapp = document.getElementById("mensagem-docs-pos3meses").value;

  // Usa a variável local renomeada (RESOLVE O ERRO DE UNDEFINED)
  if (!dadosUsuarioAtualPos3Meses || !dadosUsuarioAtualPos3Meses.email) {
    alert(
      "Erro crítico: O e-mail do usuário não foi encontrado. Verifique o cadastro."
    );
    return;
  }

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

    const solicitacaoData = {
      tipo: `fase_${fase}`, // "fase_2"
      fase: fase,
      usuarioUid: usuarioUid,
      emailUsuario: dadosUsuarioAtualPos3Meses.email, // ✅ Aqui está a correção
      nomeUsuario: dadosUsuarioAtualPos3Meses.nome,
      documentos: docsSelecionados,
      status: "pendente",
      dataEnvio: new Date(),
      enviadoPor: currentUserData.nome || "RH",
      metodoAssinatura: "interno_de_acordo",
    };

    // Cria a solicitação
    await addDoc(collection(db, "solicitacoes_assinatura"), solicitacaoData);

    // Atualiza o usuário
    await updateDoc(doc(db, "usuarios", usuarioUid), {
      status_admissao: "AGUARDANDO_ASSINATURA_FASE2",
    });

    // Envia WhatsApp
    const telefone = dadosUsuarioAtualPos3Meses.telefone
      ? dadosUsuarioAtualPos3Meses.telefone.replace(/\D/g, "")
      : "";

    if (telefone) {
      const linkZap = `https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(
        msgWhatsapp
      )}`;
      window.open(linkZap, "_blank");
    }

    window.showToast?.("Documentos fase 2 liberados!", "success");
    fecharModalEnviarDocumentosPos3Meses();

    const state = getGlobalState();
    // Atualiza a aba
    renderizarDocsPos3Meses(state);
  } catch (error) {
    console.error("Erro:", error);
    alert(`Erro: ${error.message}`);
    btn.disabled = false;
    btn.innerHTML = '<i class="fab fa-whatsapp"></i> Liberar e Avisar';
  }
};

window.fecharModalEnviarDocumentosPos3Meses = function () {
  const modal = document.getElementById("modal-enviar-docs-pos3meses");
  if (modal) modal.remove();
  document.body.style.overflow = "";
};

// Exponha também a função de abrir caso precise chamá-la externamente
window.abrirModalEnviarDocumentosPos3Meses =
  abrirModalEnviarDocumentosPos3Meses;
