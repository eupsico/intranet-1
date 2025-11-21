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

    document.querySelectorAll(".btn-avaliar-gestor").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-id");
        const vaga = btn.getAttribute("data-vaga");
        const dados = btn.getAttribute("data-dados");
        abrirModalAvaliacaoGestorModal(id, vaga, dados);
      });
    });

    document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-id");
        const dados = btn.getAttribute("data-dados");
        abrirModalDetalhesModal(id, dados);
      });
    });

    document.querySelectorAll(".btn-agendar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");
        try {
          const dadosCandidato = JSON.parse(
            decodeURIComponent(dadosCodificados)
          );
          // Chama a função local correta para agendamento do GESTOR
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
// ✅ FUNÇÃO: AGENDAMENTO GESTOR (Reutiliza Modal RH mas CORRIGE Títulos/Botões)
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
  const novoForm = form.cloneNode(true);
  form.parentNode.replaceChild(novoForm, form);

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

  // 5. Configurar botão de fechar (CORRIGIDO para funcionar)
  // Seleciona todos os botões de fechar dentro do modal e reanexa o evento
  modal
    .querySelectorAll(".close-modal-btn, .action-button.secondary")
    .forEach((btn) => {
      // Clona para limpar listeners antigos
      const novoBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(novoBtn, btn);

      novoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Botão Cancelar/Fechar clicado");
        modal.classList.remove("is-visible");
      });
    });

  // 6. Exibir Modal
  modal.classList.add("is-visible");
}

// ============================================================
// ✅ MODAL DE AVALIAÇÃO GESTOR (ESTILO ORIGINAL RESTAURADO)
// ============================================================
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
        #modal-avaliacao-gestor { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999999; background: rgba(0, 0, 0, 0.7); }
        #modal-avaliacao-gestor .modal-container { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 95%; max-width: 650px; max-height: 90vh; background: #ffffff; border-radius: 12px; box-shadow: 0 25px 50px -15px rgba(0, 0, 0, 0.3); overflow: hidden; animation: modalPopupOpen 0.3s ease-out; }
        @keyframes modalPopupOpen { from { opacity: 0; transform: translate(-50%, -60%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
        
        /* Header Gradiente */
        #modal-avaliacao-gestor .modal-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; }
        #modal-avaliacao-gestor .modal-title { display: flex; align-items: center; gap: 12px; }
        #modal-avaliacao-gestor .modal-title h3 { margin: 0; font-size: 20px; font-weight: 600; }
        
        #modal-avaliacao-gestor .modal-body { padding: 25px; max-height: 500px; overflow-y: auto; background: #f8f9fa; }
        
        /* Card de Informações */
        #modal-avaliacao-gestor .info-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); border-left: 4px solid #667eea; }
        #modal-avaliacao-gestor .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; font-size: 14px; }
        #modal-avaliacao-gestor .info-item strong { color: #555; display: block; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
        #modal-avaliacao-gestor .info-item span { color: #333; font-weight: 500; font-size: 14px; }
        
        /* Formulário */
        #modal-avaliacao-gestor .form-group { margin-bottom: 20px; }
        #modal-avaliacao-gestor .form-label { font-weight: 600; margin-bottom: 8px; display: block; color: #333; }
        #modal-avaliacao-gestor .form-textarea { width: 100%; min-height: 120px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; resize: vertical; font-family: inherit; box-sizing: border-box; }
        
        /* Opções de Resultado */
        #modal-avaliacao-gestor .resultado-options { display: flex; gap: 15px; flex-direction: column; }
        #modal-avaliacao-gestor .resultado-option { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid #eee; border-radius: 6px; background: white; cursor: pointer; }
        #modal-avaliacao-gestor .resultado-option:hover { background: #f0f4ff; border-color: #667eea; }
        #modal-avaliacao-gestor .resultado-option input { margin: 0; width: 18px; height: 18px; }
        
        /* Footer */
        #modal-avaliacao-gestor .modal-footer { padding: 20px; background: white; border-top: 1px solid #e9ecef; display: flex; justify-content: flex-end; gap: 12px; }
        #modal-avaliacao-gestor .btn-cancelar { padding: 10px 20px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; }
        #modal-avaliacao-gestor .btn-salvar { padding: 10px 24px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
      </style>
      
      <div class="modal-container">
        <div class="modal-header">
          <div class="modal-title">
            <i class="fas fa-user-tie" style="font-size: 22px;"></i>
            <div>
                <h3>Avaliação do Gestor</h3>
                <span style="font-size: 13px; opacity: 0.9;">${
                  dadosCandidato.nome_completo
                }</span>
            </div>
          </div>
          <button onclick="fecharModalAvaliacaoGestor()" style="background:none; border:none; color:white; font-size:20px; cursor:pointer;">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="info-card">
            <h4 style="margin-top:0; margin-bottom:15px; color:#667eea;"><i class="fas fa-info-circle"></i> Resumo do Candidato</h4>
            <div class="info-grid">
              <div class="info-item">
                <strong>Nome Completo</strong>
                <span>${dadosCandidato.nome_completo}</span>
              </div>
              <div class="info-item">
                <strong>Vaga</strong>
                <span>${dadosCandidato.titulo_vaga_original}</span>
              </div>
              <div class="info-item">
                <strong>Email</strong>
                <span>${dadosCandidato.email_candidato || "N/A"}</span>
              </div>
              <div class="info-item">
                <strong>Telefone</strong>
                <span>${dadosCandidato.telefone_contato || "N/A"}</span>
              </div>
            </div>
          </div>
          
          <form id="form-avaliacao-gestor-${candidatoId}">
            <div class="form-group">
              <label class="form-label">Observações da Entrevista</label>
              <textarea name="observacoes" class="form-textarea" 
                        placeholder="Descreva os pontos fortes, fracos e sua conclusão sobre o candidato..." required></textarea>
            </div>
            
            <div class="form-group">
              <label class="form-label">Decisão Final</label>
              <div class="resultado-options">
                <label class="resultado-option">
                  <input type="radio" name="resultado" value="aprovado" required>
                  <i class="fas fa-check-circle" style="color: #28a745;"></i>
                  <strong>Aprovado para Contratação</strong>
                </label>
                <label class="resultado-option">
                  <input type="radio" name="resultado" value="rejeitado">
                  <i class="fas fa-times-circle" style="color: #dc3545;"></i>
                  <strong>Não Selecionado</strong>
                </label>
                <label class="resultado-option">
                  <input type="radio" name="resultado" value="pendente">
                  <i class="fas fa-clock" style="color: #ffc107;"></i>
                  <strong>Avaliação Pendente</strong>
                </label>
              </div>
            </div>
          </form>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn-cancelar" onclick="fecharModalAvaliacaoGestor()">Cancelar</button>
          <button type="button" class="btn-salvar" onclick="salvarAvaliacaoGestorModal('${candidatoId}', '${vagaId}')">
            <i class="fas fa-save"></i> Salvar Avaliação
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (e) {
    console.error(e);
  }
}

// ============================================================
// ✅ MODAL DE DETALHES (ESTILO ORIGINAL RESTAURADO + CORREÇÃO COR)
// ============================================================
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
        .detalhes-container { width: 90%; max-width: 700px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
        
        /* Header Limpo */
        .detalhes-header { background: #fff; padding: 20px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .detalhes-header h3 { margin: 0; color: #333; font-size: 18px; display: flex; align-items: center; gap: 10px; }
        
        .detalhes-body { padding: 30px; max-height: 70vh; overflow-y: auto; }
        
        .info-section { margin-bottom: 30px; }
        .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #333; margin-bottom: 15px; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; display: flex; align-items: center; gap: 8px; }
        
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-item { background: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; }
        .info-label { font-size: 11px; color: #777; text-transform: uppercase; font-weight: 600; margin-bottom: 5px; }
        .info-value { font-size: 15px; color: #222; font-weight: 500; word-break: break-word; }
        
        /* CORREÇÃO STATUS: Cor azul escura para leitura */
        .status-badge-detalhe {
            display: inline-block; padding: 5px 12px; border-radius: 15px;
            font-size: 12px; font-weight: bold; text-transform: uppercase;
            background: #e3f2fd; color: #0d47a1; 
            border: 1px solid #bbdefb;
        }
        
        .modal-footer { padding: 15px 25px; background: #f8f9fa; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px; }
        .btn-close-detalhe { padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .btn-close-icon { background: none; border: none; font-size: 24px; color: #999; cursor: pointer; }
        .btn-close-icon:hover { color: #333; }
      </style>
      
      <div class="detalhes-container">
        <div class="detalhes-header">
          <h3><i class="fas fa-id-card" style="color: #667eea;"></i> Detalhes do Candidato</h3>
          <button class="btn-close-icon" onclick="fecharModalDetalhesGestor()">&times;</button>
        </div>
        
        <div class="detalhes-body">
          <div class="info-section">
            <div class="section-title"><i class="fas fa-user"></i> Informações Pessoais</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Nome Completo</div>
                <div class="info-value">${dados.nome_completo}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${dados.email_candidato || "N/A"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Telefone</div>
                <div class="info-value">${dados.telefone_contato || "N/A"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">ID Candidato</div>
                <div class="info-value"><small>${candidatoId}</small></div>
              </div>
            </div>
          </div>
          
          <div class="info-section">
            <div class="section-title"><i class="fas fa-briefcase"></i> Dados do Processo</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Vaga Aplicada</div>
                <div class="info-value">${dados.titulo_vaga_original}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Data Cadastro</div>
                <div class="info-value">${dados.data_cadastro_formatada}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Status Atual</div>
                <div class="info-value">
                    <span class="status-badge-detalhe">${
                      dados.status_recrutamento
                    }</span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">Etapa</div>
                <div class="info-value">Entrevista com Gestor</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-close-detalhe" onclick="fecharModalDetalhesGestor()">Fechar</button>
        </div>
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
    // Botão loading
    const btn = document.querySelector("#modal-avaliacao-gestor .btn-salvar");
    if (btn) {
      btn.innerHTML = "Salvando...";
      btn.disabled = true;
    }

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
    const btn = document.querySelector("#modal-avaliacao-gestor .btn-salvar");
    if (btn) {
      btn.innerHTML = "Salvar Avaliação";
      btn.disabled = false;
    }
  }
};

// Fallback para Agendamento Simples se modal de RH falhar
function abrirModalAgendamentoFallback(candidatoId, dadosCodificados) {
  console.warn("Usando fallback para agendamento");
  // Implementação básica caso necessário, mas a função Local acima deve resolver
  alert("Erro: Use a função abrirModalAgendamentoGestorLocal");
}
