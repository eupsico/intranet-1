/**
 * Arquivo: modulos/rh/js/tabs/tabAssinaturaDocs.js
 * Versão: 4.3.0 (Correção Crítica: Erro de e-mail undefined resolvido)
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

export async function renderizarDocsPos3Meses(state) {
  const { conteudoAdmissao, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando usuários para assinatura...</div>';

  try {
    // Busca na coleção 'usuarios' pelo 'status_admissao'
    const usuariosCollection = collection(db, "usuarios");
    const q = query(
      usuariosCollection,
      where("status_admissao", "in", [
        "ENVIAR_ASSINATURA_FASE2",
        "AGUARDANDO_ASSINATURA_FASE2",
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

      // LÓGICA DO BOTÃO
      if (statusAtual === "AGUARDANDO_ASSINATURA_FASE2") {
        statusClass = "status-warning";
        // Botão de Lembrete por WhatsApp
        botaoAcao = `
            <button class="btn btn-sm btn-warning btn-lembrar-assinatura" 
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
      } else if (statusAtual === "AGUARDANDO_ASSINATURA_FASE2") {
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

      // Mapeamento para o Modal de Detalhes
      const dadosParaModal = {
        id: userId,
        nome_candidato: user.nome || "Usuário Sem Nome",
        email_candidato: user.email || "Sem e-mail",
        telefone_contato: user.contato || user.telefone || "",
        titulo_vaga_original: user.profissao || "Cargo não informado",
        status_recrutamento: statusAtual,
        email_novo: user.email,
      };

      const dadosCodificados = encodeURIComponent(
        JSON.stringify(dadosParaModal)
      );

      // Objeto simples apenas para exibição no Card
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
           class="btn btn-sm btn-secondary btn-ver-detalhes-admissao" 
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

    // Listeners - Liberar Documentos
    document.querySelectorAll(".btn-enviar-documentos").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalEnviarDocumentos(userId, dados, state, 1); // Fase 1
      });
    });

    // Listeners - Lembrar Assinatura
    document.querySelectorAll(".btn-lembrar-assinatura").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dados = JSON.parse(
          decodeURIComponent(e.currentTarget.getAttribute("data-dados"))
        );
        enviarLembreteAssinatura(dados);
      });
    });

    // Listeners - Detalhes
    document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
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
    console.error("Erro ao renderizar aba de Assinatura:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

// ============================================
// FUNÇÃO DE LEMBRETE
// ============================================
function enviarLembreteAssinatura(dados) {
  const nome = dados.nome ? dados.nome.split(" ")[0] : "Colaborador";
  const telefone = dados.telefone ? dados.telefone.replace(/\D/g, "") : "";

  if (!telefone) {
    alert("Telefone não encontrado para este usuário.");
    return;
  }

  const msg = `Olá ${nome}, tudo bem? 👋\n\nPassando para lembrar que os *documentos da sua admissão* já estão disponíveis e aguardando sua assinatura na Intranet! 📄✍️\n\nPara assinar:\n1️⃣ Acesse: ${URL_INTRANET}\n2️⃣ Vá no menu *Portal do Voluntário > Assinaturas e Termos*\n3️⃣ Leia e assine digitalmente.\n\nContamos com você! Qualquer dúvida, nos chame.`;

  const link = `https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(
    msg
  )}`;
  window.open(link, "_blank");
}

// ============================================
// MODAL DE ENVIO DE DOCUMENTOS (GLOBAL)
// ============================================

async function abrirModalEnviarDocumentos(
  userId,
  dadosCodificados,
  state,
  fase = 1
) {
  try {
    const dadosObj = JSON.parse(decodeURIComponent(dadosCodificados));

    // ✅ CORREÇÃO CRÍTICA AQUI:
    // O modal agora aceita 'email', 'email_novo' OU 'email_candidato'
    // Isso garante que dados vindos de outras abas (como tabDocsPos3Meses) funcionem
    const dadosUsuario = {
      nome: dadosObj.nome || dadosObj.nome_candidato || "Colaborador",
      email:
        dadosObj.email || dadosObj.email_novo || dadosObj.email_candidato || "",
      telefone:
        dadosObj.telefone ||
        dadosObj.telefone_contato ||
        dadosObj.contato ||
        "",
    };

    dadosUsuarioAtual = dadosUsuario; // Salva na variável global para uso no submit

    const modalExistente = document.getElementById("modal-enviar-documentos");
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement("div");
    modal.id = "modal-enviar-documentos";
    modal.dataset.usuarioId = userId;
    modal.dataset.fase = fase;

    const tituloFase =
      fase === 1 ? "Fase 1: Admissão" : "Fase 2: Pós-Experiência";

    const msgPadrao = `Olá ${dadosUsuario.nome.split(" ")[0]}, tudo bem? 👋

Seus documentos de admissão (${tituloFase}) já estão disponíveis para assinatura na Intranet! 📄✍️

É bem simples:
1️⃣ Acesse: ${URL_INTRANET}
2️⃣ Vá no menu *Portal do Voluntário > Assinaturas e Termos*
3️⃣ Clique em "Assinar" nos documentos pendentes.

Ficamos no aguardo!`;

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
        <p><strong>E-mail:</strong> ${
          dadosUsuario.email ||
          "<span style='color:red'>Não encontrado (Erro)</span>"
        }</p>
       </div>
       <div class="form-group">
         <label class="form-label" style="font-weight:bold; display:block; margin-bottom:10px;">Selecione os documentos:</label>
         <div id="documentos-checklist-container" style="background:white;padding:15px;border:1px solid #ddd;border-radius:6px;max-height:200px;overflow-y:auto;">
            <p>Carregando modelos...</p>
         </div>
       </div>
       <div class="form-group">
        <label class="form-label" style="font-weight:bold;">Mensagem para WhatsApp:</label>
        <textarea id="documentos-mensagem" class="form-textarea" rows="8" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">${msgPadrao}</textarea>
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
      }"><label for="doc-${docSnap.id}" style="margin-left: 8px;">${
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

  // ✅ VALIDAÇÃO DE SEGURANÇA
  // Evita o erro "Unsupported field value: undefined" no Firebase
  if (!dadosUsuarioAtual || !dadosUsuarioAtual.email) {
    alert(
      "Erro crítico: O e-mail do usuário não foi encontrado. Verifique o cadastro em 'Usuários' antes de liberar documentos."
    );
    console.error("Erro dadosUsuarioAtual:", dadosUsuarioAtual);
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

    // Cria Solicitação na coleção dedicada
    const solicitacaoData = {
      tipo: `fase_${fase}`,
      fase: fase,
      usuarioUid: usuarioUid,
      emailUsuario: dadosUsuarioAtual.email, // ✅ Agora garantido
      nomeUsuario: dadosUsuarioAtual.nome,
      documentos: docsSelecionados,
      status: "pendente",
      dataEnvio: new Date(),
      enviadoPor: currentUserData.nome || "RH",
      metodoAssinatura: "interno_de_acordo",
    };

    await addDoc(collection(db, "solicitacoes_assinatura"), solicitacaoData);

    // Atualiza STATUS_ADMISSAO no USUÁRIO
    const novoStatus = (fase = "AGUARDANDO_ASSINATURA_FASE2");

    await updateDoc(doc(db, "usuarios", usuarioUid), {
      status_admissao: novoStatus,
    });

    const telefone = dadosUsuarioAtual.telefone
      ? dadosUsuarioAtual.telefone.replace(/\D/g, "")
      : "";

    if (telefone) {
      const linkZap = `https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(
        msgWhatsapp
      )}`;
      window.open(linkZap, "_blank");
    }

    window.showToast?.("Documentos liberados!", "success");
    fecharModalEnviarDocumentos();

    const state = getGlobalState();
    if (state.handleTabClick) {
      const activeTab = document.querySelector(
        "#status-admissao-tabs .tab-link.active"
      );
      if (activeTab) state.handleTabClick({ currentTarget: activeTab });
    }

    // Recarrega a aba para mostrar o botão de lembrete
    renderizarDocsPos3Meses(state);
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
