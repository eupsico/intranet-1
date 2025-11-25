/**
 * Arquivo: modulos/rh/js/tabs/tabAvaliacao3Meses.js
 * Versão: 3.0.0 (Migração Completa para Coleção Usuarios)
 * Descrição: Gerencia a Avaliação de Experiência lendo e gravando em 'usuarios'.
 */

import { getGlobalState } from "../admissao.js";
import {
  updateDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  collection,
  db,
  auth,
} from "../../../../assets/js/firebase-init.js";

// Variável global do módulo
let dadosUsuarioAtual = null;

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarAvaliacao3Meses(state) {
  const { conteudoAdmissao } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando colaboradores em período de experiência...</div>';

  try {
    // ✅ MUDANÇA 1: Busca na coleção 'usuarios' pelo 'status_admissao'
    const usuariosCollection = collection(db, "usuarios");
    const q = query(
      usuariosCollection,
      where("status_admissao", "==", "AGUARDANDO_AVALIACAO_3MESES")
    );
    const snapshot = await getDocs(q);

    // Atualiza contador na aba (opcional, se tiver acesso ao elemento da aba)
    const tab = document.querySelector(
      '.tab-link[data-status="avaliacao-3-meses"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-calendar-check me-2"></i> 5. Avaliação (3 Meses) (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML =
        '<p class="alert alert-info">Nenhum colaborador aguardando avaliação de 3 meses.</p>';
      return;
    }

    let listaHtml = `
  	<div class="description-box" style="margin-top: 15px;">
   	<p>Colaboradores que completaram a integração e o período de experiência. Registre a avaliação para efetivá-los.</p>
  	</div>
  	<div class="candidatos-container candidatos-grid">
  `;

    snapshot.docs.forEach((docSnap) => {
      const user = docSnap.data();
      const userId = docSnap.id;

      // Mapeamento de dados do Usuário
      const statusAtual = user.status_admissao || "N/A";
      const cargo = user.profissao || "Não informado";
      // Tenta pegar a data de integração se foi salva no usuário, senão mostra N/A
      const dataIntegracao = user.data_integracao
        ? new Date(user.data_integracao.seconds * 1000).toLocaleDateString(
            "pt-BR"
          )
        : "N/A";

      const statusClass = "status-success";

      // Objeto de dados para passar aos modais
      const dadosUsuario = {
        id: userId,
        nome: user.nome || "Usuário Sem Nome",
        email: user.email || "Sem e-mail",
        telefone: user.contato || user.telefone || "Sem telefone",
        cargo: cargo,
        status_admissao: statusAtual,
        avaliacao_experiencia: user.avaliacao_experiencia, // Passa avaliação anterior se houver
      };

      const dadosJSON = JSON.stringify(dadosUsuario);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
    <div class="card card-candidato-gestor" data-id="${userId}">
     <div class="info-primaria">
      <h4 class="nome-candidato">
       ${dadosUsuario.nome}
      	<span class="status-badge ${statusClass}">
       	<i class="fas fa-tag"></i> Em Experiência
      	</span>
      </h4>
     	<p class="small-info">
       <i class="fas fa-briefcase"></i> Cargo: ${cargo}
      </p>
     	<p class="small-info">
       <i class="fas fa-envelope"></i> Email: ${dadosUsuario.email}
      </p>
     </div>
     
     <div class="acoes-candidato">
     	<button 
      	class="action-button primary btn-avaliar-3meses" 
      	data-id="${userId}"
      	data-dados="${dadosCodificados}"
     		style="background: var(--cor-primaria);">
      	<i class="fas fa-clipboard-check me-1"></i> Registrar Avaliação
     	</button>
        </div>
    </div>
   `;
    });

    listaHtml += "</div>";
    conteudoAdmissao.innerHTML = listaHtml;

    // Listeners
    document.querySelectorAll(".btn-avaliar-3meses").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalAvaliacao3Meses(
          userId,
          JSON.parse(decodeURIComponent(dados))
        );
      });
    });
  } catch (error) {
    console.error("❌ Admissão(Avaliação 3 Meses): Erro ao renderizar:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

// ============================================
// LÓGICA DO MODAL DE AVALIAÇÃO (3 MESES)
// ============================================

function abrirModalAvaliacao3Meses(userId, dadosUsuario) {
  console.log(`🔹 Admissão: Abrindo modal de avaliação 3 meses para ${userId}`);
  const modal = document.getElementById("modal-avaliacao-3meses");
  const form = document.getElementById("form-avaliacao-3meses");

  if (!modal || !form) {
    window.showToast?.(
      "Erro: Modal de Avaliação 3 Meses não encontrado no HTML.",
      "error"
    );
    return;
  }

  // Injeta CSS para corrigir visual (mantido da versão anterior)
  const styleId = "style-fix-avaliacao-3meses";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      #modal-avaliacao-3meses .status-badge {
        background-color: #007bff !important;
        color: white !important;
        padding: 4px 12px;
        border-radius: 12px;
        font-weight: bold;
        font-size: 0.9em;
        display: inline-block;
      }
      #modal-avaliacao-3meses .modal-footer {
        display: flex !important;
        justify-content: flex-end !important;
        gap: 10px !important;
      }
    `;
    document.head.appendChild(style);
  }

  dadosUsuarioAtual = dadosUsuario;
  modal.dataset.usuarioId = userId; // ✅ Salva o UID no dataset

  const nomeEl = document.getElementById("avaliacao-3meses-nome");
  if (nomeEl) nomeEl.textContent = dadosUsuario.nome;

  form.reset();

  // Preenche dados anteriores se existirem
  const avaliacaoAnterior = dadosUsuario.avaliacao_experiencia || {};
  const feedbackPositivoEl = document.getElementById(
    "avaliacao-3meses-positivo"
  );
  const feedbackDesenvolverEl = document.getElementById(
    "avaliacao-3meses-desenvolver"
  );
  const radioAprovado = document.getElementById("avaliacao-3meses-aprovado");
  const radioReprovado = document.getElementById("avaliacao-3meses-reprovado");

  if (feedbackPositivoEl)
    feedbackPositivoEl.value = avaliacaoAnterior.feedback_positivo || "";
  if (feedbackDesenvolverEl)
    feedbackDesenvolverEl.value = avaliacaoAnterior.feedback_desenvolver || "";
  if (radioAprovado)
    radioAprovado.checked = avaliacaoAnterior.resultado === "Aprovado";
  if (radioReprovado)
    radioReprovado.checked = avaliacaoAnterior.resultado === "Reprovado";

  form.removeEventListener("submit", submeterAvaliacao3Meses);
  form.addEventListener("submit", submeterAvaliacao3Meses);

  // Listeners de fechar
  modal
    .querySelectorAll(".close-modal-btn, .action-button.secondary")
    .forEach((btn) => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener("click", () =>
        modal.classList.remove("is-visible")
      );
    });

  modal.classList.add("is-visible");
}

async function submeterAvaliacao3Meses(e) {
  e.preventDefault();
  const { currentUserData } = getGlobalState(); // Não precisa mais de candidatosCollection
  const modal = document.getElementById("modal-avaliacao-3meses");
  const btnSalvar = modal.querySelector('button[type="submit"]');
  const form = document.getElementById("form-avaliacao-3meses");

  // ✅ Pega o UID do dataset
  const usuarioUid = modal.dataset.usuarioId;

  if (!usuarioUid) {
    console.error("UID do usuário não encontrado.");
    alert("Erro interno: UID não identificado.");
    return;
  }

  const resultado = form.querySelector(
    'input[name="resultado_3meses"]:checked'
  )?.value;
  const feedbackPositivo = document.getElementById(
    "avaliacao-3meses-positivo"
  ).value;
  const feedbackDesenvolver = document.getElementById(
    "avaliacao-3meses-desenvolver"
  ).value;

  if (!resultado) {
    window.showToast?.(
      "Por favor, selecione um resultado (Aprovado ou Reprovado).",
      "warning"
    );
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

  try {
    // 1. DEFINIR AVALIADOR
    let nomeAvaliador = currentUserData?.nome;
    let uidAvaliador =
      currentUserData?.id || currentUserData?.uid || auth.currentUser?.uid;

    if (!nomeAvaliador && uidAvaliador) {
      try {
        const snap = await getDoc(doc(db, "usuarios", uidAvaliador));
        if (snap.exists()) nomeAvaliador = snap.data().nome;
      } catch (e) {
        console.warn("Nome não recuperado");
      }
    }
    if (!nomeAvaliador) nomeAvaliador = "RH (Admin)";
    if (!uidAvaliador) uidAvaliador = "rh_system_user";

    const isAprovado = resultado === "Aprovado";

    // 2. ATUALIZAR A COLEÇÃO USUARIOS (Muda status_admissao)
    const novoStatusAdmissao = isAprovado
      ? "AGUARDANDO_DOCS_POS_3MESES"
      : "REPROVADO_EXPERIENCIA";

    const dadosUpdate = {
      avaliacao_experiencia: {
        data: new Date(),
        resultado: resultado,
        feedback_positivo: feedbackPositivo,
        feedback_desenvolver: feedbackDesenvolver,
        avaliador: nomeAvaliador,
        avaliador_uid: uidAvaliador,
      },
      // ✅ Atualiza o status na coleção usuarios
      status_admissao: novoStatusAdmissao,

      // Lógica de status geral
      efetivado: isAprovado,
      inativo: !isAprovado,
      status: isAprovado ? "ativo" : "desligado",
    };

    await updateDoc(doc(db, "usuarios", usuarioUid), dadosUpdate);
    console.log(
      `✅ Usuário ${usuarioUid} atualizado. Novo status: ${novoStatusAdmissao}`
    );

    window.showToast?.("Avaliação registrada com sucesso!", "success");
    modal.classList.remove("is-visible");

    // Recarrega a aba
    renderizarAvaliacao3Meses(getGlobalState());
  } catch (error) {
    console.error("Erro ao salvar avaliação de 3 meses:", error);
    window.showToast?.(`Erro ao registrar: ${error.message}`, "error");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Registrar Decisão';
  }
}
