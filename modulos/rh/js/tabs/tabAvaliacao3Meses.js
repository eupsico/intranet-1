/**
 * Arquivo: modulos/rh/js/tabs/tabAvaliacao3Meses.js
 * Versão: 4.0.0 (Fluxo Completo: Agendamento + WhatsApp Empático + Detalhes)
 * Descrição: Gerencia o agendamento e a avaliação de experiência (3 Meses).
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
  arrayUnion,
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
    // Busca na coleção 'usuarios' pelos status relevantes
    const usuariosCollection = collection(db, "usuarios");
    const q = query(
      usuariosCollection,
      where("status_admissao", "in", [
        "AGUARDANDO_AVALIACAO_3MESES",
        "AVALIACAO_3MESES_AGENDADA",
      ])
    );
    const snapshot = await getDocs(q);

    // Atualiza contador na aba
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
   	<p>Colaboradores que completaram o período de experiência. Agende a reunião de feedback e registre a decisão de efetivação.</p>
  	</div>
  	<div class="candidatos-container candidatos-grid">
  `;

    snapshot.docs.forEach((docSnap) => {
      const user = docSnap.data();
      const userId = docSnap.id;

      const statusAtual = user.status_admissao || "N/A";
      const cargo = user.profissao || "Não informado";

      let statusClass = "status-warning";
      let actionButtonHtml = "";

      // Dados para os modais
      const dadosUsuario = {
        id: userId,
        nome: user.nome || "Usuário Sem Nome",
        email: user.email || "Sem e-mail",
        telefone: user.contato || user.telefone || "Sem telefone",
        cargo: cargo,
        status_admissao: statusAtual,
        avaliacao_experiencia: user.avaliacao_experiencia,
      };

      const dadosCodificados = encodeURIComponent(JSON.stringify(dadosUsuario));

      // --- LÓGICA DOS BOTÕES ---
      if (statusAtual === "AVALIACAO_3MESES_AGENDADA") {
        statusClass = "status-info";
        // Botão Roxo: Registrar Avaliação (Já agendado)
        actionButtonHtml = `
          <button 
            class="btn btn-sm btn-avaliar-3meses" 
            data-id="${userId}"
            data-dados="${dadosCodificados}"
            style="padding: 10px 16px; background: #6f42c1; color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
            <i class="fas fa-clipboard-check me-1"></i> Registrar Decisão
          </button>`;
      } else {
        // Botão Azul: Agendar Avaliação
        actionButtonHtml = `
          <button 
            class="btn btn-sm btn-primary btn-agendar-3meses" 
            data-id="${userId}"
            data-dados="${dadosCodificados}"
            style="padding: 10px 16px; background: var(--cor-primaria); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
            <i class="fas fa-calendar-alt me-1"></i> Agendar Avaliação
          </button>`;
      }

      listaHtml += `
    <div class="card card-candidato-gestor" data-id="${userId}">
     <div class="info-primaria">
      <h4 class="nome-candidato">
       ${dadosUsuario.nome}
      	<span class="status-badge ${statusClass}">
       	<i class="fas fa-tag"></i> ${statusAtual.replace(/_/g, " ")}
      	</span>
      </h4>
     	<p class="small-info">
       <i class="fas fa-briefcase"></i> Cargo: ${cargo}
      </p>
     	<p class="small-info" style="color: var(--cor-primaria);">
       <i class="fas fa-envelope"></i> Email: ${dadosUsuario.email}
      </p>
     </div>
     
     <div class="acoes-candidato">
        ${actionButtonHtml}

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

    // --- LISTENERS ---

    // 1. Agendar
    document.querySelectorAll(".btn-agendar-3meses").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalAgendarAvaliacao3Meses(
          userId,
          JSON.parse(decodeURIComponent(dados))
        );
      });
    });

    // 2. Registrar Avaliação
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

    // 3. Detalhes (Informações)
    document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dadosCodificados = e.currentTarget.getAttribute("data-dados");
        if (typeof window.abrirModalCandidato === "function") {
          const dadosCandidato = JSON.parse(
            decodeURIComponent(dadosCodificados)
          );
          window.abrirModalCandidato(userId, "detalhes", dadosCandidato);
        }
      });
    });
  } catch (error) {
    console.error("❌ Admissão(Avaliação 3 Meses): Erro ao renderizar:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

// ============================================
// LÓGICA DE AGENDAMENTO (NOVO)
// ============================================

function abrirModalAgendarAvaliacao3Meses(userId, dadosUsuario) {
  console.log(
    `🔹 Admissão: Abrindo modal de agendamento 3 meses para ${userId}`
  );
  dadosUsuarioAtual = dadosUsuario;

  // Cria o modal dinamicamente se não existir
  let modal = document.getElementById("modal-agendamento-3meses");
  if (modal) modal.remove();

  modal = document.createElement("div");
  modal.id = "modal-agendamento-3meses";
  modal.className = "modal-overlay";
  modal.dataset.usuarioId = userId;

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h3 class="modal-title-text"><i class="fas fa-calendar-check me-2"></i> Agendar Avaliação (3 Meses)</h3>
        <button type="button" class="close-modal-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="info-card" style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
           <p><strong>Colaborador:</strong> ${dadosUsuario.nome}</p>
           <p style="margin-bottom:0;"><strong>Status:</strong> Aguardando Avaliação</p>
        </div>
        <form id="form-agendamento-3meses">
           <div class="form-group">
             <label class="form-label">Data da Reunião</label>
             <input type="date" id="data-avaliacao-3meses" class="form-control" required>
           </div>
           <div class="form-group">
             <label class="form-label">Horário</label>
             <input type="time" id="hora-avaliacao-3meses" class="form-control" required>
           </div>
           <div class="modal-footer" style="padding: 0; margin-top: 20px; border: none;">
             <button type="button" class="action-button secondary close-modal-btn">Cancelar</button>
             <button type="submit" class="action-button primary">
                <i class="fas fa-calendar-plus me-2"></i> Confirmar Agendamento
             </button>
           </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Listeners
  const form = document.getElementById("form-agendamento-3meses");
  form.addEventListener("submit", submeterAgendamento3Meses);

  modal.querySelectorAll(".close-modal-btn").forEach((btn) => {
    btn.onclick = () => {
      modal.classList.remove("is-visible");
      setTimeout(() => modal.remove(), 300);
    };
  });

  // Mostra o modal
  setTimeout(() => modal.classList.add("is-visible"), 10);
}

async function submeterAgendamento3Meses(e) {
  e.preventDefault();
  const modal = document.getElementById("modal-agendamento-3meses");
  const btnSalvar = modal.querySelector('button[type="submit"]');
  const usuarioId = modal.dataset.usuarioId;
  const { currentUserData } = getGlobalState();
  const uidResponsavel =
    auth.currentUser?.uid || currentUserData?.uid || "rh_system_user";

  const data = document.getElementById("data-avaliacao-3meses").value;
  const hora = document.getElementById("hora-avaliacao-3meses").value;

  if (!data || !hora) return;

  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

  try {
    const usuarioRef = doc(db, "usuarios", usuarioId);

    // Atualiza status para AGENDADO
    await updateDoc(usuarioRef, {
      status_admissao: "AVALIACAO_3MESES_AGENDADA",
      "avaliacao_experiencia.agendamento": {
        data: data,
        hora: hora,
        agendado_por: uidResponsavel,
        criado_em: new Date(),
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Avaliação de 3 meses agendada para ${data} às ${hora}.`,
        usuario: uidResponsavel,
      }),
    });

    window.showToast?.("Agendamento salvo!", "success");

    // Envia WhatsApp Empático
    if (dadosUsuarioAtual && dadosUsuarioAtual.telefone) {
      enviarWhatsAppAgendamento3Meses(dadosUsuarioAtual, data, hora);
    }

    modal.classList.remove("is-visible");
    setTimeout(() => modal.remove(), 300);
    renderizarAvaliacao3Meses(getGlobalState());
  } catch (error) {
    console.error("Erro ao agendar:", error);
    window.showToast?.("Erro ao salvar agendamento.", "error");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML =
      '<i class="fas fa-calendar-plus me-2"></i> Confirmar Agendamento';
  }
}

function enviarWhatsAppAgendamento3Meses(usuario, data, hora) {
  const [ano, mes, dia] = data.split("-");
  const dataFormatada = `${dia}/${mes}/${ano}`;
  const nome = usuario.nome.split(" ")[0];
  const telefone = usuario.telefone.replace(/\D/g, "");

  const msg = `Olá ${nome}, tudo bem? 👋

Parabéns! Você concluiu a *Fase 1* da sua jornada conosco (Período de Experiência)! 🚀🎉

Gostaríamos de agendar um momento especial para conversarmos sobre o seu desenvolvimento, ouvirmos você e realizarmos sua avaliação de 3 meses.

📅 *Data:* ${dataFormatada}
⏰ *Horário:* ${hora}

Contamos com sua presença! Até lá. 💙`;

  const link = `https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(
    msg
  )}`;
  window.open(link, "_blank");
}

// ============================================
// LÓGICA DE REGISTRO DA AVALIAÇÃO (EXISTENTE)
// ============================================

function abrirModalAvaliacao3Meses(userId, dadosUsuario) {
  const modal = document.getElementById("modal-avaliacao-3meses");
  const form = document.getElementById("form-avaliacao-3meses");

  if (!modal || !form) {
    window.showToast?.("Erro: Modal de Avaliação não encontrado.", "error");
    return;
  }

  dadosUsuarioAtual = dadosUsuario;
  modal.dataset.usuarioId = userId;

  const nomeEl = document.getElementById("avaliacao-3meses-nome");
  if (nomeEl) nomeEl.textContent = dadosUsuario.nome;

  form.reset();

  // Listeners de fechar
  modal.querySelectorAll(".close-modal-btn").forEach((btn) => {
    btn.onclick = () => modal.classList.remove("is-visible");
  });

  form.removeEventListener("submit", submeterAvaliacao3Meses);
  form.addEventListener("submit", submeterAvaliacao3Meses);

  modal.classList.add("is-visible");
}

async function submeterAvaliacao3Meses(e) {
  e.preventDefault();
  const { currentUserData } = getGlobalState();
  const modal = document.getElementById("modal-avaliacao-3meses");
  const btnSalvar = modal.querySelector('button[type="submit"]');
  const form = document.getElementById("form-avaliacao-3meses");
  const usuarioUid = modal.dataset.usuarioId;

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
    window.showToast?.("Selecione um resultado.", "warning");
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

  try {
    let nomeAvaliador = currentUserData?.nome || "RH";
    let uidAvaliador = auth.currentUser?.uid || "rh_user";

    const isAprovado = resultado === "Aprovado";
    const novoStatusAdmissao = isAprovado
      ? "AGUARDANDO_DOCS_POS_3MESES"
      : "REPROVADO_EXPERIENCIA";

    const dadosUpdate = {
      "avaliacao_experiencia.resultado": resultado,
      "avaliacao_experiencia.feedback_positivo": feedbackPositivo,
      "avaliacao_experiencia.feedback_desenvolver": feedbackDesenvolver,
      "avaliacao_experiencia.avaliador": nomeAvaliador,
      "avaliacao_experiencia.data_avaliacao": new Date(),
      status_admissao: novoStatusAdmissao,
      efetivado: isAprovado,
      inativo: !isAprovado,
      status: isAprovado ? "ativo" : "desligado",
    };

    await updateDoc(doc(db, "usuarios", usuarioUid), dadosUpdate);

    window.showToast?.("Avaliação registrada com sucesso!", "success");
    modal.classList.remove("is-visible");
    renderizarAvaliacao3Meses(getGlobalState());
  } catch (error) {
    console.error("Erro ao salvar:", error);
    window.showToast?.(`Erro: ${error.message}`, "error");
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML =
      '<i class="fas fa-check-circle me-2"></i> Registrar Decisão';
  }
}
