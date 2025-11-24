/**
 * Arquivo: modulos/rh/js/tabs/tabAvaliacao3Meses.js
 * Versão: 2.4.0 (Correção Crítica: UID Undefined)
 * Descrição: Gerencia a etapa de Avaliação de Experiência (3 Meses).
 */

import { getGlobalState } from "../admissao.js";
import {
  updateDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  arrayUnion,
  collection,
  db,
  auth, // ✅ IMPORTANTE: Importando auth para garantir acesso ao UID
} from "../../../../assets/js/firebase-init.js";

// Variável global do módulo
let dadosCandidatoAtual = null;

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarAvaliacao3Meses(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando colaboradores em período de experiência...</div>';

  try {
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "==", "AGUARDANDO_AVALIACAO_3MESES")
    );
    const snapshot = await getDocs(q);

    const tab = statusAdmissaoTabs.querySelector(
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
   	<p>Colaboradores que completaram a integração e estão no período de experiência. Registre a avaliação de 3 meses para efetivá-los.</p>
  	</div>
  	<div class="candidatos-container candidatos-grid">
  `;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const candidatoId = docSnap.id;
      const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada";
      const statusAtual = cand.status_recrutamento || "N/A";

      const statusClass = "status-success";

      const dadosCandidato = {
        id: candidatoId,
        nome_candidato: cand.nome_candidato || cand.nome_completo,
        email_pessoal: cand.email_candidato || cand.email_pessoal,
        email_novo:
          cand.admissaoinfo?.email_solicitado ||
          cand.email_novo ||
          "Não solicitado",
        telefone_contato: cand.telefone_contato,
        titulo_vaga_original: cand.titulo_vaga_original,
        status_recrutamento: statusAtual,
        data_integracao: cand.integracao?.conclusao?.concluido_em
          ? new Date(
              cand.integracao.conclusao.concluido_em.seconds * 1000
            ).toLocaleDateString("pt-BR")
          : "N/A",
      };

      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
    <div class="card card-candidato-gestor" data-id="${candidatoId}">
     <div class="info-primaria">
      <h4 class="nome-candidato">
       ${dadosCandidato.nome_candidato || "Colaborador Sem Nome"}
      	<span class="status-badge ${statusClass}">
       	<i class="fas fa-tag"></i> Em Experiência
      	</span>
      </h4>
     	<p class="small-info">
       <i class="fas fa-briefcase"></i> Cargo: ${
         cand.admissao_info?.cargo_final || vagaTitulo
       }
      </p>
     	<p class="small-info">
       <i class="fas fa-calendar-alt"></i> Integração: ${
         dadosCandidato.data_integracao
       }
      </p>
     </div>
     
     <div class="acoes-candidato">
     	<button 
      	class="action-button primary btn-avaliar-3meses" 
      	data-id="${candidatoId}"
      	data-dados="${dadosCodificados}"
     		style="background: var(--cor-primaria);">
      	<i class="fas fa-clipboard-check me-1"></i> Registrar Avaliação
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

    // Listeners
    document.querySelectorAll(".btn-avaliar-3meses").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const candidatoId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");
        abrirModalAvaliacao3Meses(
          candidatoId,
          JSON.parse(decodeURIComponent(dados))
        );
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
    console.error("❌ Admissão(Avaliação 3 Meses): Erro ao renderizar:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

// ============================================
// LÓGICA DO MODAL DE AVALIAÇÃO (3 MESES)
// ============================================

function abrirModalAvaliacao3Meses(candidatoId, dadosCandidato) {
  console.log(
    `🔹 Admissão: Abrindo modal de avaliação 3 meses para ${candidatoId}`
  );
  const modal = document.getElementById("modal-avaliacao-3meses");
  const form = document.getElementById("form-avaliacao-3meses");

  if (!modal || !form) {
    window.showToast?.(
      "Erro: Modal de Avaliação 3 Meses não encontrado no HTML.",
      "error"
    );
    return;
  }

  // Injeta CSS para corrigir visual do status e botões
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

  dadosCandidatoAtual = dadosCandidato;
  modal.dataset.candidaturaId = candidatoId;

  const nomeEl = document.getElementById("avaliacao-3meses-nome");
  if (nomeEl) nomeEl.textContent = dadosCandidato.nome_candidato;

  form.reset();

  // Preenche dados anteriores se existirem
  const avaliacaoAnterior = dadosCandidato.avaliacao_3meses || {};
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

  // Obtém estado global
  const { candidatosCollection, currentUserData } = getGlobalState();

  const modal = document.getElementById("modal-avaliacao-3meses");
  const btnSalvar = modal.querySelector('button[type="submit"]');
  const form = document.getElementById("form-avaliacao-3meses");
  const candidatoId = modal.dataset.candidaturaId;

  if (!candidatoId || !dadosCandidatoAtual) {
    console.error("Dados do candidato não encontrados.");
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
    // --- 1. DEFINIR UID E NOME DO AVALIADOR (LÓGICA DE SEGURANÇA) ---
    let uidAvaliador = null;
    let nomeAvaliador = "RH";

    // Tentativa 1: Do estado global
    if (currentUserData && (currentUserData.uid || currentUserData.id)) {
      uidAvaliador = currentUserData.uid || currentUserData.id;
      if (currentUserData.nome) nomeAvaliador = currentUserData.nome;
    }

    // Tentativa 2: Do Auth direto (se o estado falhou)
    if (!uidAvaliador && auth && auth.currentUser) {
      uidAvaliador = auth.currentUser.uid;
      // Tenta buscar o nome no banco rapidinho se não tiver
      try {
        const snap = await getDoc(doc(db, "usuarios", uidAvaliador));
        if (snap.exists()) nomeAvaliador = snap.data().nome;
      } catch (e) {
        console.warn("Nome não recuperado");
      }
    }

    // Tentativa 3: Fallback de Emergência (Evita crash undefined)
    if (!uidAvaliador) {
      console.warn("⚠️ UID do avaliador indefinido. Usando fallback seguro.");
      uidAvaliador = "rh_system_fallback";
    }

    console.log(
      `✅ Avaliador Definido -> UID: ${uidAvaliador}, Nome: ${nomeAvaliador}`
    );

    // --- 2. Identificar o USUÁRIO COLABORADOR (UID) ---
    const emailBusca =
      dadosCandidatoAtual.email_novo &&
      dadosCandidatoAtual.email_novo !== "Não solicitado"
        ? dadosCandidatoAtual.email_novo
        : dadosCandidatoAtual.email_pessoal;

    if (!emailBusca)
      throw new Error(
        "E-mail do colaborador não encontrado para vincular a avaliação."
      );

    const usuariosQuery = query(
      collection(db, "usuarios"),
      where("email", "==", emailBusca)
    );
    const usuariosSnap = await getDocs(usuariosQuery);

    if (usuariosSnap.empty) {
      throw new Error(
        `Usuário com e-mail ${emailBusca} não encontrado na coleção 'usuarios'.`
      );
    }

    const usuarioDoc = usuariosSnap.docs[0];
    const usuarioUid = usuarioDoc.id;

    const isAprovado = resultado === "Aprovado";

    // --- 3. Atualizar a coleção USUARIOS ---
    const dadosAvaliacaoUsuario = {
      avaliacao_experiencia: {
        data: new Date(),
        resultado: resultado,
        feedback_positivo: feedbackPositivo,
        feedback_desenvolver: feedbackDesenvolver,
        avaliador: nomeAvaliador,
        avaliador_uid: uidAvaliador, // Agora garantido como string
      },
      efetivado: isAprovado,
      inativo: !isAprovado,
      status: isAprovado ? "ativo" : "desligado",
    };

    await updateDoc(doc(db, "usuarios", usuarioUid), dadosAvaliacaoUsuario);
    console.log("✅ Avaliação salva no perfil do usuário.");

    // --- 4. Atualizar CANDIDATURA ---
    const novoStatusCandidatura = isAprovado
      ? "PROCESSO_CONCLUIDO"
      : "REPROVADO_EXPERIENCIA";
    const acaoHistorico = `Avaliação de 3 Meses: ${resultado}. ${
      isAprovado ? "Efetivado." : "Desligado."
    }`;

    await updateDoc(doc(candidatosCollection, candidatoId), {
      status_recrutamento: novoStatusCandidatura,
      historico: arrayUnion({
        data: new Date(),
        acao: acaoHistorico,
        usuario: nomeAvaliador,
      }),
    });

    window.showToast?.("Avaliação registrada e perfil atualizado!", "success");
    modal.classList.remove("is-visible");
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
