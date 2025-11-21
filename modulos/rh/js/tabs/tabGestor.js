// modulos/rh/js/tabs/tabGestor.js
import { getGlobalState } from "../recrutamento.js";
import {
  db,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  setDoc,
  arrayUnion,
  getDoc,
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevista com Gestor.
 */
export async function renderizarEntrevistaGestor(state) {
  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML = `
      <div class="alert alert-info">
        <p><i class="fas fa-info-circle"></i> Nenhuma vaga selecionada.</p>
      </div>
    `;
    return;
  }

  conteudoRecrutamento.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i> Carregando candidatos para Entrevista com Gestor...
    </div>
  `;

  try {
    // Query Firestore
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "Testes Aprovado",
        "Entrevista Gestor Pendente",
        "Entrevista Gestor Agendada",
        "Aguardando Avaliação Gestor",
        "Teste Aprovado (Entrevista com Gestor Pendente)",
        "Testes Aprovado (Entrevista Gestor Pendente)",
      ])
    );

    const snapshot = await getDocs(q);

    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="gestor"]'
    );
    if (tab) {
      tab.textContent = `4. Entrevista com Gestor (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML = `
        <div class="alert alert-warning">
          <p><i class="fas fa-exclamation-triangle"></i> Nenhuma candidatura na fase de Entrevista com Gestor.</p>
        </div>
      `;
      return;
    }

    let listaHtml = `
      <div class="candidatos-container candidatos-grid">
    `;

    snapshot.docs.forEach((docSnap) => {
      const cand = docSnap.data();
      const statusAtual = cand.status_recrutamento || "N/A";
      const candidaturaId = docSnap.id;
      const vagaId = vagaSelecionadaId;

      let statusClass = "status-info";
      if (
        statusAtual.toLowerCase().includes("pendente") ||
        statusAtual.toLowerCase().includes("aguardando")
      ) {
        statusClass = "status-warning";
      } else if (
        statusAtual.toLowerCase().includes("aprovado") ||
        statusAtual.toLowerCase().includes("concluída")
      ) {
        statusClass = "status-success";
      }

      // --- FORMATAÇÃO DA DATA ---
      let dataCadastroFormatada = "N/A";
      if (cand.data_candidatura) {
        try {
          const dataObj = cand.data_candidatura.toDate
            ? cand.data_candidatura.toDate()
            : cand.data_candidatura.seconds
            ? new Date(cand.data_candidatura.seconds * 1000)
            : new Date(cand.data_candidatura);

          dataCadastroFormatada = dataObj.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch (e) {
          console.warn("Erro ao formatar data:", e);
        }
      }

      // --- DADOS PARA OS MODAIS ---
      const dadosCandidato = {
        id: candidaturaId,
        nome_completo: cand.nome_candidato || cand.nome_completo,
        email_candidato: cand.email_candidato,
        telefone_contato: cand.telefone_contato,
        status_recrutamento: statusAtual,
        vaga_id: vagaId,
        titulo_vaga_original:
          cand.titulo_vaga_original ||
          cand.nome_vaga ||
          "Vaga não identificada",
        data_cadastro_formatada: dataCadastroFormatada,
        // Dados específicos para o agendamento do gestor
        resumo_triagem:
          cand.triagem_rh?.prerequisitos_atendidos ||
          "Sem informações de triagem.",
        agendamento_existente: cand.entrevista_gestor?.agendamento || null,
      };

      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
        <div class="card card-candidato-gestor" data-id="${candidaturaId}">
          <div class="info-primaria">
            <h4 class="nome-candidato">
              ${cand.nome_completo || "Candidato Sem Nome"}
              <span class="status-badge ${statusClass}">
                <i class="fas fa-tag"></i> ${statusAtual}
              </span>
            </h4>
            <p class="small-info">
              <i class="fas fa-briefcase"></i> Etapa: Entrevista com Gestor.
            </p>
          </div>

          <div class="info-contato">
            ${
              cand.email_candidato
                ? `<p><i class="fas fa-envelope"></i> ${cand.email_candidato}</p>`
                : ""
            }
            ${
              cand.telefone_contato
                ? `<p><i class="fas fa-phone"></i> ${cand.telefone_contato}</p>`
                : ""
            }
          </div>

          <div class="acoes-candidato">
            <button class="action-button primary btn-avaliar-gestor" 
                    data-id="${candidaturaId}"
                    data-vaga="${vagaId}"
                    data-dados="${dadosCodificados}"
                    style="padding: 10px 16px; background: var(--cor-primaria); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
              <i class="fas fa-user-tie"></i> Avaliar Gestor
            </button>
            
            <button class="action-button secondary btn-ver-detalhes" 
                    data-id="${candidaturaId}"
                    data-dados="${dadosCodificados}"
                    style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 100px;">
              <i class="fas fa-eye"></i> Detalhes
            </button>
            
            <button class="action-button info btn-agendar-rh" 
                    data-id="${candidaturaId}"
                    data-dados="${dadosCodificados}"
                    style="padding: 10px 16px; background: var(--cor-info, #17a2b8); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
              <i class="fas fa-calendar-alt"></i> Agendar Reunião
            </button>
          </div>
        </div>
      `;
    });

    listaHtml += `</div>`;
    conteudoRecrutamento.innerHTML = listaHtml;

    // === EVENT LISTENERS ===

    // Listener Avaliar Gestor
    document.querySelectorAll(".btn-avaliar-gestor").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-id");
        const vaga = btn.getAttribute("data-vaga");
        const dados = btn.getAttribute("data-dados");
        abrirModalAvaliacaoGestorModal(id, vaga, dados);
      });
    });

    // Listener Detalhes
    document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-id");
        const dados = btn.getAttribute("data-dados");
        abrirModalDetalhesModal(id, dados);
      });
    });

    // Listener Agendar (AGORA CHAMA A FUNÇÃO LOCAL CORRETA)
    document.querySelectorAll(".btn-agendar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");
        try {
          const dadosCandidato = JSON.parse(
            decodeURIComponent(dadosCodificados)
          );
          // ⚠️ AQUI ESTÁ O SEGREDO: Chama a função local personalizada
          abrirModalAgendamentoGestorLocal(id, dadosCandidato);
        } catch (error) {
          console.error("Erro ao abrir agendamento:", error);
        }
      });
    });
  } catch (error) {
    console.error("❌ Gestor: Erro ao carregar:", error);
    conteudoRecrutamento.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

// ============================================================
// ✅ NOVA FUNÇÃO: AGENDAMENTO GESTOR (Reutiliza Modal RH mas corrige textos)
// ============================================================
function abrirModalAgendamentoGestorLocal(candidatoId, dadosCandidato) {
  console.log(
    "📅 Abrindo agendamento de GESTOR para:",
    dadosCandidato.nome_completo
  );

  // 1. Pegar elementos do modal existente no HTML (recrutamento.html)
  const modal = document.getElementById("modal-agendamento-rh");
  const form = document.getElementById("form-agendamento-entrevista-rh");
  const tituloModal = modal ? modal.querySelector(".modal-title-text") : null;

  const elNome = document.getElementById("agendamento-rh-nome-candidato");
  const elStatus = document.getElementById("agendamento-rh-status-atual");
  const elResumo = document.getElementById("agendamento-rh-resumo-triagem");

  const elData = document.getElementById("data-entrevista-agendada");
  const elHora = document.getElementById("hora-entrevista-agendada");
  const btnSubmit = document.getElementById("btn-registrar-agendamento-rh");

  if (!modal || !form) {
    alert("Erro: Modal de agendamento não encontrado no DOM.");
    return;
  }

  // 2. Ajustar Textos para o Contexto do Gestor
  if (tituloModal)
    tituloModal.textContent = "Agendamento - Entrevista com Gestor";
  if (elNome)
    elNome.textContent = dadosCandidato.nome_completo || "Nome Indisponível";
  if (elStatus)
    elStatus.textContent = dadosCandidato.status_recrutamento || "N/A";

  // No resumo, mostramos info relevante ou o resumo da triagem
  if (elResumo) {
    elResumo.textContent =
      dadosCandidato.resumo_triagem || "Sem informações adicionais.";
  }

  if (btnSubmit)
    btnSubmit.innerHTML =
      '<i class="fas fa-calendar-check me-2"></i> Confirmar Agendamento Gestor';

  // 3. Preencher data/hora se já existir
  if (dadosCandidato.agendamento_existente) {
    if (elData) elData.value = dadosCandidato.agendamento_existente.data || "";
    if (elHora) elHora.value = dadosCandidato.agendamento_existente.hora || "";
  } else {
    if (elData) elData.value = "";
    if (elHora) elHora.value = "";
  }

  // 4. SOBRESCREVER o evento de submit do formulário
  // Importante: remover listeners antigos (cloneNode) para não disparar o evento de RH
  const novoForm = form.cloneNode(true);
  form.parentNode.replaceChild(novoForm, form);

  // Re-selecionar elementos dentro do novo form (para garantir referências)
  const novaDataInput = document.getElementById("data-entrevista-agendada");
  const novaHoraInput = document.getElementById("hora-entrevista-agendada");
  const novoBtnSubmit = document.getElementById("btn-registrar-agendamento-rh");

  // Listener de Submit Específico para Gestor
  novoForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const dataAgendada = novaDataInput.value;
    const horaAgendada = novaHoraInput.value;

    if (!dataAgendada || !horaAgendada) {
      alert("Por favor, preencha a data e a hora.");
      return;
    }

    novoBtnSubmit.disabled = true;
    novoBtnSubmit.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
      const candidatoRef = doc(db, "candidaturas", candidatoId);

      // Salvar em 'entrevista_gestor.agendamento'
      await setDoc(
        candidatoRef,
        {
          status_recrutamento: "Entrevista Gestor Agendada",
          entrevista_gestor: {
            agendamento: {
              data: dataAgendada,
              hora: horaAgendada,
              criado_em: new Date(),
            },
            // Mantemos redundância útil para queries
            data_entrevista: dataAgendada,
          },
          historico: arrayUnion({
            data: new Date(),
            acao: `Entrevista com Gestor agendada para ${dataAgendada} às ${horaAgendada}`,
            usuario: getGlobalState()?.currentUserData?.email || "sistema",
          }),
        },
        { merge: true }
      );

      alert("✅ Agendamento com Gestor salvo com sucesso!");
      modal.classList.remove("is-visible");

      // Atualizar a tela
      renderizarEntrevistaGestor(getGlobalState());
    } catch (error) {
      console.error("Erro ao agendar:", error);
      alert("Erro ao salvar agendamento: " + error.message);
    } finally {
      novoBtnSubmit.disabled = false;
      novoBtnSubmit.innerHTML =
        '<i class="fas fa-calendar-check me-2"></i> Confirmar Agendamento Gestor';
    }
  });

  // 5. Configurar botão de fechar (re-anexar listener pois clonamos ou perdemos ref)
  modal.querySelectorAll(".close-modal-btn, .btn-secondary").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      modal.classList.remove("is-visible");
    };
  });

  // 6. Exibir Modal
  modal.classList.add("is-visible");
}

// === MODAL DE AVALIAÇÃO GESTOR ===
function abrirModalAvaliacaoGestorModal(candidatoId, vagaId, dadosCodificados) {
  console.log("🎯 Abrindo avaliação gestor");
  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
    const modalExistente = document.getElementById("modal-avaliacao-gestor");
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement("div");
    modal.id = "modal-avaliacao-gestor";

    modal.innerHTML = `
      <style>
        #modal-avaliacao-gestor { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999999; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; }
        .modal-container { width: 95%; max-width: 600px; background: white; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; max-height: 90vh; }
        .modal-header { background: #667eea; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; }
        .modal-body { padding: 20px; overflow-y: auto; }
        .form-group { margin-bottom: 15px; }
        .form-textarea { width: 100%; min-height: 100px; padding: 10px; margin-top: 5px; }
        .modal-footer { padding: 15px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px; }
        .btn-cancelar { padding: 8px 16px; cursor: pointer; }
        .btn-salvar { padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; }
      </style>
      <div class="modal-container">
        <div class="modal-header">
          <h3>Avaliação do Gestor</h3>
          <button onclick="fecharModalAvaliacaoGestor()" style="background:none;border:none;color:white;font-size:18px;cursor:pointer;">&times;</button>
        </div>
        <div class="modal-body">
          <p><strong>Candidato:</strong> ${dadosCandidato.nome_completo}</p>
          <p><strong>Vaga:</strong> ${dadosCandidato.titulo_vaga_original}</p>
          <hr style="margin: 15px 0; border: 0; border-top: 1px solid #eee;">
          <form id="form-avaliacao-gestor-${candidatoId}">
            <div class="form-group">
              <label>Observações:</label>
              <textarea name="observacoes" class="form-textarea" required></textarea>
            </div>
            <div class="form-group">
              <label>Resultado:</label><br>
              <label><input type="radio" name="resultado" value="aprovado" required> Aprovado</label>
              <label style="margin-left:15px;"><input type="radio" name="resultado" value="rejeitado"> Reprovado</label>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-cancelar" onclick="fecharModalAvaliacaoGestor()">Cancelar</button>
          <button type="button" class="btn-salvar" onclick="salvarAvaliacaoGestorModal('${candidatoId}', '${vagaId}')">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (e) {
    console.error(e);
  }
}

// === MODAL DE DETALHES ===
function abrirModalDetalhesModal(candidatoId, dadosCodificados) {
  try {
    const dados = JSON.parse(decodeURIComponent(dadosCodificados));
    const modalExistente = document.getElementById("modal-detalhes-gestor");
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement("div");
    modal.id = "modal-detalhes-gestor";
    modal.innerHTML = `
      <style>
        #modal-detalhes-gestor { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999999; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; }
        .detalhes-box { width: 90%; max-width: 600px; background: white; padding: 20px; border-radius: 8px; }
      </style>
      <div class="detalhes-box">
        <h3>Detalhes: ${dados.nome_completo}</h3>
        <p>Email: ${dados.email_candidato}</p>
        <p>Telefone: ${dados.telefone_contato}</p>
        <p>Status: ${dados.status_recrutamento}</p>
        <p>Vaga: ${dados.titulo_vaga_original}</p>
        <p>Data Cadastro: ${dados.data_cadastro_formatada}</p>
        <button onclick="fecharModalDetalhesGestor()" style="margin-top:15px; padding:8px 16px;">Fechar</button>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (e) {
    console.error(e);
  }
}

// Funções Globais Auxiliares
window.fecharModalAvaliacaoGestor = function () {
  const m = document.getElementById("modal-avaliacao-gestor");
  if (m) m.remove();
};
window.fecharModalDetalhesGestor = function () {
  const m = document.getElementById("modal-detalhes-gestor");
  if (m) m.remove();
};
window.salvarAvaliacaoGestorModal = async function (candidatoId, vagaId) {
  const form = document.getElementById(`form-avaliacao-gestor-${candidatoId}`);
  if (!form) return;

  const formData = new FormData(form);
  const obs = formData.get("observacoes");
  const res = formData.get("resultado");

  if (!res || !obs) {
    alert("Preencha todos os campos.");
    return;
  }

  try {
    const ref = doc(db, "candidaturas", candidatoId);
    let novoStatus =
      res === "aprovado"
        ? "AGUARDANDO_ADMISSAO"
        : "Processo Concluído - Rejeitado";

    await updateDoc(ref, {
      status_recrutamento: novoStatus,
      avaliacao_gestor: {
        resultado: res,
        observacoes: obs,
        data: new Date(),
        aprovado: res === "aprovado",
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Avaliação Gestor: ${res.toUpperCase()}`,
        usuario: getGlobalState()?.currentUserData?.email || "sistema",
      }),
    });
    alert("Salvo com sucesso!");
    fecharModalAvaliacaoGestor();
    renderizarEntrevistaGestor(getGlobalState());
  } catch (e) {
    alert("Erro ao salvar: " + e.message);
  }
};
