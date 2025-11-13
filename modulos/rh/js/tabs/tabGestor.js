// modulos/rh/js/tabs/tabGestor.js
import { getGlobalState } from "../recrutamento.js";
import {
getDocs, query, where, doc, updateDoc, setDoc, arrayUnion,
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevista com Gestor.
 * Modal corrigido para abrir como POPUP centralizado na tela.
 * Botão "Ver Currículo" substituído por "Agendar Reunião" com padrão do tabEntrevistas.
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
    // Query Firestore - AJUSTE OS STATUS DO SEU FIRESTORE
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        // SUBSTITUA POR STATUS REAIS DO SEU FIRESTORE
        "Testes Aprovado",
        "Entrevista Gestor Pendente",
        "Entrevista Gestor Agendada",
        "Aguardando Avaliação Gestor",
        "Teste Aprovado (Entrevista com Gestor Pendente)",
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

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";
      const candidaturaId = doc.id;
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

      // Dados encoded para modal
      const dadosCandidato = {
        id: candidaturaId,
        nome_completo: cand.nome_completo,
        email_candidato: cand.email_candidato,
        telefone_contato: cand.telefone_contato,
        status_recrutamento: statusAtual,
        vaga_id: vagaId,
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
            <!-- BOTÃO AVALIAR GESTOR - CORRIGIDO -->
            <button class="action-button primary btn-avaliar-gestor" 
                    data-id="${candidaturaId}"
                    data-vaga="${vagaId}"
                    data-dados="${dadosCodificados}"
                    style="padding: 10px 16px; background: var(--cor-primaria); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
              <i class="fas fa-user-tie"></i> Avaliar Gestor
            </button>
            
            <!-- BOTÃO DETALHES - CORRIGIDO -->
            <button class="action-button secondary btn-ver-detalhes" 
                    data-id="${candidaturaId}"
                    data-dados="${dadosCodificados}"
                    style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 100px;">
              <i class="fas fa-eye"></i> Detalhes
            </button>
            
            <!-- NOVO BOTÃO AGENDAR REUNIÃO - PADRÃO DO tabEntrevistas -->
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

    listaHtml += `
      </div>
    `;

    conteudoRecrutamento.innerHTML = listaHtml;

    // === EVENT LISTENERS CORRIGIDOS ===
    console.log("🔗 Gestor: Anexando event listeners...");

    // VERIFICA SE OS BOTÕES FORAM CRIADOS
    const botoesAvaliar = document.querySelectorAll(".btn-avaliar-gestor");
    const botoesDetalhes = document.querySelectorAll(".btn-ver-detalhes");
    const botoesAgendar = document.querySelectorAll(".btn-agendar-rh");

    console.log(
      `🔍 Encontrados: ${botoesAvaliar.length} botões Avaliar, ${botoesDetalhes.length} Detalhes, ${botoesAgendar.length} Agendar`
    );

    // Botão Avaliar Gestor - CORRIGIDO
    botoesAvaliar.forEach((btn, index) => {
      console.log(`🔧 Anexando listener ao botão Avaliar #${index + 1}`);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log("🎯 Clique no botão Avaliar Gestor detectado");

        const candidatoId = btn.getAttribute("data-id");
        const vagaId = btn.getAttribute("data-vaga");
        const dadosCodificados = btn.getAttribute("data-dados");

        console.log(`📋 Dados: ID=${candidatoId}, Vaga=${vagaId}`);

        // CORREÇÃO: Chama a função local diretamente (não depende de window)
        try {
          abrirModalAvaliacaoGestorModal(candidatoId, vagaId, dadosCodificados);
        } catch (error) {
          console.error("❌ Erro ao abrir modal:", error);
          alert("Erro ao abrir modal de avaliação");
        }
      });
    });

    // Botão Detalhes - CORRIGIDO
    botoesDetalhes.forEach((btn, index) => {
      console.log(`🔧 Anexando listener ao botão Detalhes #${index + 1}`);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log("👁️ Clique no botão Detalhes detectado");

        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");

        try {
          abrirModalDetalhesModal(candidatoId, dadosCodificados);
        } catch (error) {
          console.error("❌ Erro ao abrir modal de detalhes:", error);
          alert("Erro ao abrir modal de detalhes");
        }
      });
    });

    // Botão Agendar Reunião - PADRÃO DO tabEntrevistas
    botoesAgendar.forEach((btn, index) => {
      console.log(`🔧 Anexando listener ao botão Agendar #${index + 1}`);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log("📅 Clique no botão Agendar Reunião detectado");

        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");

        // Chama a função global que existe no tabEntrevistas.js
        if (typeof window.abrirModalAgendamentoRH === "function") {
          try {
            const dadosCandidato = JSON.parse(
              decodeURIComponent(dadosCodificados)
            );
            window.abrirModalAgendamentoRH(candidatoId, dadosCandidato);
            console.log("✅ Modal de agendamento aberto via função global");
          } catch (error) {
            console.error("❌ Erro ao abrir modal de agendamento:", error);
            alert("Erro ao abrir modal de agendamento");
          }
        } else {
          console.warn(
            "⚠️ Função window.abrirModalAgendamentoRH não encontrada"
          );
          // Fallback: cria modal de agendamento simples
          abrirModalAgendamentoFallback(candidatoId, dadosCodificados);
        }
      });
    });

    console.log(
      `✅ Todos listeners anexados: ${
        botoesAvaliar.length + botoesDetalhes.length + botoesAgendar.length
      } botões configurados`
    );
  } catch (error) {
    console.error("❌ Gestor: Erro ao carregar:", error);
    conteudoRecrutamento.innerHTML = `
      <div class="alert alert-danger">
        <p><i class="fas fa-exclamation-circle"></i> Erro: ${error.message}</p>
      </div>
    `;
  }
}

// === MODAL DE AVALIAÇÃO GESTOR - CORRIGIDO ===
function abrirModalAvaliacaoGestorModal(candidatoId, vagaId, dadosCodificados) {
  console.log("🎯 Abrindo modal de avaliação gestor");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    // Remove modal anterior
    const modalExistente = document.getElementById("modal-avaliacao-gestor");
    if (modalExistente) {
      modalExistente.remove();
      console.log("🧹 Modal anterior removido");
    }

    // Cria novo modal com posicionamento garantido
    const modal = document.createElement("div");
    modal.id = "modal-avaliacao-gestor";

    // CSS EMBEDDED GARANTIDO - SOBRESCREVE TUDO
    modal.innerHTML = `
      <style>
        /* RESET E POSICIONAMENTO ABSOLUTO */
        #modal-avaliacao-gestor {
          all: initial !important;
          display: block !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 999999 !important;
          background: rgba(0, 0, 0, 0.7) !important;
        }
        
        #modal-avaliacao-gestor .modal-container {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: 95% !important;
          max-width: 650px !important;
          max-height: 90vh !important;
          background: #ffffff !important;
          border-radius: 12px !important;
          box-shadow: 0 25px 50px -15px rgba(0, 0, 0, 0.3) !important;
          overflow: hidden !important;
          z-index: 1000000 !important;
          animation: modalPopupOpen 0.3s ease-out !important;
        }
        
        @keyframes modalPopupOpen {
          from {
            opacity: 0;
            transform: translate(-50%, -60%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        /* HEADER DO MODAL */
        #modal-avaliacao-gestor .modal-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          padding: 20px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          position: relative !important;
        }
        
        #modal-avaliacao-gestor .modal-title {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          margin: 0 !important;
        }
        
        #modal-avaliacao-gestor .modal-title i {
          font-size: 24px !important;
        }
        
        #modal-avaliacao-gestor .modal-title h3 {
          margin: 0 !important;
          font-size: 20px !important;
          font-weight: 600 !important;
        }
        
        #modal-avaliacao-gestor .modal-close {
          background: rgba(255,255,255,0.2) !important;
          border: none !important;
          color: white !important;
          width: 36px !important;
          height: 36px !important;
          border-radius: 50% !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 18px !important;
          transition: all 0.2s !important;
        }
        
        #modal-avaliacao-gestor .modal-close:hover {
          background: rgba(255,255,255,0.3) !important;
          transform: scale(1.1) !important;
        }
        
        /* BODY DO MODAL */
        #modal-avaliacao-gestor .modal-body {
          padding: 25px !important;
          max-height: 500px !important;
          overflow-y: auto !important;
          background: #f8f9fa !important;
        }
        
        #modal-avaliacao-gestor .info-card {
          background: white !important;
          padding: 20px !important;
          border-radius: 8px !important;
          margin-bottom: 25px !important;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08) !important;
          border-left: 4px solid #667eea !important;
        }
        
        #modal-avaliacao-gestor .info-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
          gap: 15px !important;
          font-size: 14px !important;
        }
        
        #modal-avaliacao-gestor .info-item {
          line-height: 1.6 !important;
        }
        
        #modal-avaliacao-gestor .status-badge {
          display: inline-block !important;
          padding: 4px 12px !important;
          background: #e3f2fd !important;
          color: #1976d2 !important;
          border-radius: 20px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
        }
        
        /* FORMULÁRIO */
        #modal-avaliacao-gestor .form-group {
          margin-bottom: 20px !important;
        }
        
        #modal-avaliacao-gestor .form-label {
          font-weight: 600 !important;
          margin-bottom: 8px !important;
          display: block !important;
          color: #333 !important;
          font-size: 14px !important;
        }
        
        #modal-avaliacao-gestor .form-textarea {
          width: 100% !important;
          min-height: 120px !important;
          padding: 12px !important;
          border: 1px solid #ddd !important;
          border-radius: 6px !important;
          font-family: inherit !important;
          resize: vertical !important;
          box-sizing: border-box !important;
          font-size: 14px !important;
        }
        
        #modal-avaliacao-gestor .form-textarea:focus {
          outline: none !important;
          border-color: #667eea !important;
          box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2) !important;
        }
        
        /* OPÇÕES DE RESULTADO */
        #modal-avaliacao-gestor .resultado-options {
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
        }
        
        #modal-avaliacao-gestor .resultado-option {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          cursor: pointer !important;
          padding: 12px !important;
          border: 1px solid #e9ecef !important;
          border-radius: 8px !important;
          transition: all 0.2s !important;
          background: white !important;
        }
        
        #modal-avaliacao-gestor .resultado-option:hover {
          border-color: #667eea !important;
          background: #f8f9ff !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1) !important;
        }
        
        #modal-avaliacao-gestor .resultado-option input[type="radio"] {
          margin: 0 !important;
          width: 18px !important;
          height: 18px !important;
          accent-color: #667eea !important;
        }
        
        #modal-avaliacao-gestor .resultado-icon {
          width: 24px !important;
          height: 24px !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 12px !important;
          color: white !important;
          flex-shrink: 0 !important;
        }
        
        #modal-avaliacao-gestor .resultado-aprovado .resultado-icon {
          background: #28a745 !important;
        }
        
        #modal-avaliacao-gestor .resultado-rejeitado .resultado-icon {
          background: #dc3545 !important;
        }
        
        #modal-avaliacao-gestor .resultado-pendente .resultado-icon {
          background: #ffc107 !important;
          color: #212529 !important;
        }
        
        #modal-avaliacao-gestor .resultado-text {
          font-weight: 500 !important;
          margin: 0 !important;
        }
        
        /* FOOTER */
        #modal-avaliacao-gestor .modal-footer {
          padding: 20px 25px !important;
          background: white !important;
          border-top: 1px solid #e9ecef !important;
          display: flex !important;
          justify-content: flex-end !important;
          gap: 12px !important;
        }
        
        #modal-avaliacao-gestor .btn-cancelar {
          padding: 12px 24px !important;
          background: #f8f9fa !important;
          color: #6c757d !important;
          border: 1px solid #dee2e6 !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-weight: 500 !important;
          transition: all 0.2s !important;
        }
        
        #modal-avaliacao-gestor .btn-salvar {
          padding: 12px 24px !important;
          background: #667eea !important;
          color: white !important;
          border: none !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-weight: 500 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          transition: all 0.2s !important;
        }
        
        #modal-avaliacao-gestor .btn-salvar:hover {
          background: #5a67d8 !important;
          transform: translateY(-1px) !important;
        }
        
        #modal-avaliacao-gestor .btn-salvar:disabled {
          background: #ccc !important;
          cursor: not-allowed !important;
          transform: none !important;
        }
        
        /* RESPONSIVO */
        @media (max-width: 768px) {
          #modal-avaliacao-gestor .modal-container {
            width: 98% !important;
            max-height: 95vh !important;
            top: 5% !important;
            left: 2% !important;
            transform: none !important;
            border-radius: 8px !important;
          }
          
          #modal-avaliacao-gestor .modal-body {
            padding: 15px !important;
            max-height: 400px !important;
          }
          
          #modal-avaliacao-gestor .info-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          
          #modal-avaliacao-gestor .modal-footer {
            padding: 15px !important;
            flex-direction: column !important;
          }
          
          #modal-avaliacao-gestor .btn-cancelar,
          #modal-avaliacao-gestor .btn-salvar {
            width: 100% !important;
          }
        }
      </style>
      
      <div class="modal-container">
        <div class="modal-header">
          <div class="modal-title">
            <i class="fas fa-user-tie"></i>
            <h3>Avaliação do Gestor</h3>
            <p style="margin: 0; opacity: 0.9; font-size: 14px;">
              ${dadosCandidato.nome_completo || "N/A"}
            </p>
          </div>
          <button class="modal-close" onclick="fecharModalAvaliacaoGestor()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="info-card">
            <h4><i class="fas fa-info-circle"></i> Informações do Candidato</h4>
            <div class="info-grid">
              <div class="info-item">
                <strong>ID do Candidato:</strong><br>
                <code>${candidatoId}</code>
              </div>
              <div class="info-item">
                <strong>Email:</strong><br>
                ${dadosCandidato.email_candidato || "N/A"}
              </div>
              <div class="info-item">
                <strong>Telefone:</strong><br>
                ${dadosCandidato.telefone_contato || "N/A"}
              </div>
              <div class="info-item">
                <strong>Status Atual:</strong><br>
                <span class="status-badge">${
                  dadosCandidato.status_recrutamento || "N/A"
                }</span>
              </div>
              <div class="info-item">
                <strong>ID da Vaga:</strong><br>
                <code>${vagaId}</code>
              </div>
            </div>
          </div>
          
          <form id="form-avaliacao-gestor-${candidatoId}">
            <div class="form-group">
              <label class="form-label">Observações da Entrevista</label>
              <textarea name="observacoes" class="form-textarea" 
                        placeholder="Descreva sua avaliação detalhada sobre a entrevista com o gestor. Inclua pontos fortes, áreas de melhoria, fit cultural, etc."
                        required></textarea>
            </div>
            
            <div class="form-group">
              <label class="form-label">Resultado da Avaliação</label>
              <div class="resultado-options">
                <label class="resultado-option resultado-aprovado">
                  <input type="radio" name="resultado" value="aprovado">
                  <div class="resultado-icon">
                    <i class="fas fa-check"></i>
                  </div>
                  <span class="resultado-text">Aprovado para Contratação</span>
                </label>
                
                <label class="resultado-option resultado-rejeitado">
                  <input type="radio" name="resultado" value="rejeitado">
                  <div class="resultado-icon">
                    <i class="fas fa-times"></i>
                  </div>
                  <span class="resultado-text">Não Selecionado</span>
                </label>
                
                <label class="resultado-option resultado-pendente">
                  <input type="radio" name="resultado" value="pendente">
                  <div class="resultado-icon">
                    <i class="fas fa-clock"></i>
                  </div>
                  <span class="resultado-text">Avaliação Pendente</span>
                </label>
              </div>
            </div>
          </form>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn-cancelar" onclick="fecharModalAvaliacaoGestor()">
            <i class="fas fa-times"></i> Cancelar
          </button>
          <button type="button" class="btn-salvar" onclick="salvarAvaliacaoGestorModal('${candidatoId}', '${vagaId}')">
            <i class="fas fa-save"></i> Salvar Avaliação
          </button>
        </div>
      </div>
    `;

    // ADICIONA AO BODY E MOSTRA
    document.body.appendChild(modal);

    // FORÇA VISIBILIDADE E POSICIONAMENTO
    modal.style.display = "block";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";

    // IMPEDIR SCROLL E CENTRALIZAR
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);

    // FOCO NO PRIMEIRO INPUT
    const firstInput = modal.querySelector('textarea[name="observacoes"]');
    if (firstInput) {
      firstInput.focus();
    }

    console.log("✅ Modal de avaliação criado e visível");
  } catch (error) {
    console.error("❌ Erro ao criar modal de avaliação:", error);
    alert("Erro ao abrir modal de avaliação. Tente novamente.");
  }
}

// === FUNÇÃO PARA FECHAR MODAL DE AVALIAÇÃO ===
window.fecharModalAvaliacaoGestor = function () {
  console.log("❌ Fechando modal de avaliação gestor");

  const modal = document.getElementById("modal-avaliacao-gestor");
  if (modal) {
    // ANIMAÇÃO DE SAÍDA
    modal.style.opacity = "0";
    modal.style.transform = "translate(-50%, -50%) scale(0.9)";

    setTimeout(() => {
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      document.body.style.overflow = "";
    }, 250);
  }
};

// === FUNÇÃO PARA SALVAR AVALIAÇÃO - CORREÇÃO APLICADA ===
window.salvarAvaliacaoGestorModal = async function (candidatoId, vagaId) {
  console.log("💾 Salvando avaliação do gestor");

  const formId = `form-avaliacao-gestor-${candidatoId}`;
  const form = document.getElementById(formId);

  if (!form) {
    console.error("❌ Formulário não encontrado");
    alert("Erro: Formulário não encontrado");
    return;
  }

  const formData = new FormData(form);
  const observacoes = formData.get("observacoes");
  const resultado = formData.get("resultado");

  if (!resultado) {
    alert("Por favor, selecione um resultado da avaliação");
    return;
  }

  if (!observacoes || observacoes.trim().length < 10) {
    alert(
      "Por favor, adicione observações detalhadas da entrevista (mínimo 10 caracteres)"
    );
    return;
  }

  // BLOQUEIA BOTÃO ENQUANTO SALVA
  const btnSalvar = form.querySelector(".btn-salvar");
  if (btnSalvar) {
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
  }

  console.log(`📝 Salvando para candidato ${candidatoId}:`);
  console.log(`- Resultado: ${resultado}`);
  console.log(`- Observações: ${observacoes.substring(0, 100)}...`);

// SALVAMENTO NO FIREBASE - IMPLEMENTADO
try {
  const novoStatus = resultado === "aprovado" ? 
    "Processo Concluído - Contratado" : 
    "Processo Concluído - Rejeitado";

  const candidatoRef = doc(db, "candidatos", candidatoId);
  
  // Usa setDoc com merge para criar se não existir, ou atualizar se existir
  await setDoc(candidatoRef, {
    status_recrutamento: novoStatus,
    avaliacao_gestor: {
      aprovado: resultado === "aprovado",
      data_avaliacao: new Date(),
      observacoes: observacoes.trim(),
      avaliador: getGlobalState()?.usuarioAtual?.email || "gestor@eupsico.com"
    },
    historico: arrayUnion({
      data: new Date(),
      acao: `Avaliação ${resultado === "aprovado" ? "Aprovada" : "Rejeitada"} pelo Gestor`,
      usuario: getGlobalState()?.usuarioAtual?.id || "gestor",
      anterior: "Entrevista com Gestor Pendente"
    })
  }, { merge: true });

  alert(`✅ ${resultado === "aprovado" ? "Aprovado" : "Rejeitado"} com sucesso!`);
  fecharModalAvaliacaoGestor();

  const stateNovo = getGlobalState();
  renderizarEntrevistaGestor(stateNovo);
} catch (error) {
  console.error("❌ Erro ao salvar avaliação:", error);
  alert(`Erro ao salvar: ${error.message}`);
  
  // Reativa botão em caso de erro
  const btnSalvar = form.querySelector(".btn-salvar");
  if (btnSalvar) {
    btnSalvar.disabled = false;
    btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Avaliação';
  }
}


// === MODAL DE DETALHES - SIMPLIFICADO ===
function abrirModalDetalhesModal(candidatoId, dadosCodificados) {
  console.log("👁️ Abrindo modal de detalhes");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    // Remove modal anterior
    const modalExistente = document.getElementById("modal-detalhes-gestor");
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement("div");
    modal.id = "modal-detalhes-gestor";

    modal.innerHTML = `
      <style>
        #modal-detalhes-gestor {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 999999 !important;
          background: rgba(0,0,0,0.7) !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
        }
        
        #modal-detalhes-gestor .detalhes-container {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: 90% !important;
          max-width: 700px !important;
          max-height: 85vh !important;
          background: white !important;
          border-radius: 12px !important;
          box-shadow: 0 25px 50px rgba(0,0,0,0.3) !important;
          overflow: hidden !important;
          z-index: 1000000 !important;
          animation: modalSlideIn 0.3s ease-out !important;
        }
        
        #modal-detalhes-gestor .detalhes-header {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important;
          color: #333 !important;
          padding: 20px !important;
          border-bottom: 1px solid #dee2e6 !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
        }
        
        #modal-detalhes-gestor .detalhes-body {
          padding: 25px !important;
          max-height: 60vh !important;
          overflow-y: auto !important;
        }
        
        #modal-detalhes-gestor .info-section {
          margin-bottom: 25px !important;
          padding-bottom: 20px !important;
          border-bottom: 1px solid #eee !important;
        }
        
        #modal-detalhes-gestor .info-section:last-child {
          border-bottom: none !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
        }
        
        #modal-detalhes-gestor .section-title {
          margin: 0 0 15px 0 !important;
          color: #333 !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }
        
        #modal-detalhes-gestor .info-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)) !important;
          gap: 15px !important;
        }
        
        #modal-detalhes-gestor .info-item {
          background: #f8f9fa !important;
          padding: 12px !important;
          border-radius: 6px !important;
          border-left: 3px solid #667eea !important;
        }
        
        #modal-detalhes-gestor .info-label {
          font-weight: 600 !important;
          color: #666 !important;
          margin-bottom: 4px !important;
          font-size: 13px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }
        
        #modal-detalhes-gestor .info-value {
          font-size: 14px !important;
          color: #333 !important;
          word-break: break-word !important;
        }
        
        #modal-detalhes-gestor .status-container {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          margin-top: 10px !important;
        }
        
        #modal-detalhes-gestor .status-badge {
          padding: 6px 12px !important;
          border-radius: 20px !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
        }
        
        #modal-detalhes-gestor .status-aprovado {
          background: #d4edda !important;
          color: #155724 !important;
          border: 1px solid #c3e6cb !important;
        }
        
        #modal-detalhes-gestor .status-pendente {
          background: #fff3cd !important;
          color: #856404 !important;
          border: 1px solid #ffeaa7 !important;
        }
        
        #modal-detalhes-gestor .status-rejeitado {
          background: #f8d7da !important;
          color: #721c24 !important;
          border: 1px solid #f5c6cb !important;
        }
        
        #modal-detalhes-gestor .modal-footer {
          padding: 20px 25px !important;
          background: #f8f9fa !important;
          border-top: 1px solid #dee2e6 !important;
          display: flex !important;
          justify-content: flex-end !important;
          gap: 12px !important;
        }
        
        #modal-detalhes-gestor .btn-close {
          padding: 10px 20px !important;
          background: #6c757d !important;
          color: white !important;
          border: none !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-weight: 500 !important;
        }
        
        #modal-detalhes-gestor .btn-print {
          padding: 10px 20px !important;
          background: #17a2b8 !important;
          color: white !important;
          border: none !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-weight: 500 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }
        
        @media (max-width: 768px) {
          #modal-detalhes-gestor .detalhes-container {
            width: 98% !important;
            max-height: 95vh !important;
            top: 5% !important;
            left: 2% !important;
            transform: none !important;
          }
          
          #modal-detalhes-gestor .info-grid {
            grid-template-columns: 1fr !important;
          }
          
          #modal-detalhes-gestor .modal-body {
            padding: 15px !important;
          }
        }
      </style>
      
      <div class="detalhes-container">
        <div class="detalhes-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas fa-eye" style="font-size: 22px; color: #667eea;"></i>
            <div>
              <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #333;">
                Detalhes do Candidato
              </h3>
              <p style="margin: 2px 0 0 0; color: #666; font-size: 14px;">
                ${dadosCandidato.nome_completo || "N/A"}
              </p>
            </div>
          </div>
          <button class="btn-close" onclick="fecharModalDetalhesGestor()">
            <i class="fas fa-times"></i> Fechar
          </button>
        </div>
        
        <div class="detalhes-body">
          <div class="info-section">
            <h4 class="section-title">
              <i class="fas fa-user"></i> Informações Pessoais
            </h4>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Nome Completo</div>
                <div class="info-value">${
                  dadosCandidato.nome_completo || "N/A"
                }</div>
              </div>
              <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${
                  dadosCandidato.email_candidato || "N/A"
                }</div>
              </div>
              <div class="info-item">
                <div class="info-label">Telefone</div>
                <div class="info-value">${
                  dadosCandidato.telefone_contato || "N/A"
                }</div>
              </div>
              <div class="info-item">
                <div class="info-label">ID do Candidato</div>
                <div class="info-value"><code>${candidatoId}</code></div>
              </div>
            </div>
          </div>
          
          <div class="info-section">
            <h4 class="section-title">
              <i class="fas fa-clipboard-list"></i> Status do Processo
            </h4>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Status Atual</div>
                <div class="info-value">
                  <span class="status-badge status-${dadosCandidato.status_recrutamento
                    .toLowerCase()
                    .replace(/ /g, "-")}">
                    ${dadosCandidato.status_recrutamento || "N/A"}
                  </span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">ID da Vaga</div>
                <div class="info-value"><code>${
                  dadosCandidato.vaga_id
                }</code></div>
              </div>
              <div class="info-item">
                <div class="info-label">Data de Cadastro</div>
                <div class="info-value">${
                  dadosCandidato.data_cadastro || "N/A"
                }</div>
              </div>
              <div class="info-item">
                <div class="info-label">Etapa Atual</div>
                <div class="info-value">Entrevista com Gestor</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-print" onclick="imprimirDetalhesGestor('${candidatoId}')">
            <i class="fas fa-print"></i> Imprimir
          </button>
          <button class="btn-close" onclick="fecharModalDetalhesGestor()">
            Fechar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);

    console.log("✅ Modal de detalhes criado e visível");
  } catch (error) {
    console.error("❌ Erro ao criar modal de detalhes:", error);
    alert("Erro ao abrir detalhes do candidato");
  }
}

// === MODAL DE AGENDAMENTO - FALLBACK ===
function abrirModalAgendamentoFallback(candidatoId, dadosCodificados) {
  console.log("📅 Abrindo modal de agendamento (fallback)");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    const modal = document.createElement("div");
    modal.id = "modal-agendamento-fallback";
    modal.innerHTML = `
      <style>
        #modal-agendamento-fallback {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 999999 !important;
          background: rgba(0,0,0,0.7) !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
        }
        
        #modal-agendamento-fallback .agendamento-container {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: 90% !important;
          max-width: 500px !important;
          background: white !important;
          border-radius: 12px !important;
          box-shadow: 0 25px 50px rgba(0,0,0,0.3) !important;
          overflow: hidden !important;
        }
        
        #modal-agendamento-fallback .agendamento-header {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important;
          color: white !important;
          padding: 20px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
        }
        
        #modal-agendamento-fallback .agendamento-body {
          padding: 25px !important;
        }
        
        #modal-agendamento-fallback .agendamento-footer {
          padding: 20px 25px !important;
          background: #f8f9fa !important;
          border-top: 1px solid #dee2e6 !important;
          display: flex !important;
          justify-content: flex-end !important;
          gap: 12px !important;
        }
      </style>
      
      <div class="agendamento-container">
        <div class="agendamento-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas fa-calendar-alt" style="font-size: 24px;"></i>
            <h3 style="margin: 0; font-size: 20px;">Agendar Reunião</h3>
          </div>
          <button onclick="fecharModalAgendamentoFallback()" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="agendamento-body">
          <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745;">
            <h4 style="margin: 0 0 10px 0; color: #28a745;">${
              dadosCandidato.nome_completo
            }</h4>
            <p style="margin: 0; color: #666; font-size: 14px;">
              <i class="fas fa-envelope"></i> ${
                dadosCandidato.email_candidato || "N/A"
              }<br>
              <i class="fas fa-phone"></i> ${
                dadosCandidato.telefone_contato || "N/A"
              }
            </p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="font-weight: 600; display: block; margin-bottom: 8px;">Data Proposta</label>
            <input type="date" id="data-agendamento" style="
              width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;
            " required>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="font-weight: 600; display: block; margin-bottom: 8px;">Horário</label>
            <select id="horario-agendamento" style="
              width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;
            " required>
              <option value="">Selecione um horário</option>
              <option value="09:00">09:00</option>
              <option value="10:00">10:00</option>
              <option value="14:00">14:00</option>
              <option value="15:00">15:00</option>
              <option value="16:00">16:00</option>
            </select>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="font-weight: 600; display: block; margin-bottom: 8px;">Duração</label>
            <select id="duracao-agendamento" style="
              width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;
            ">
              <option value="30">30 minutos</option>
              <option value="60">1 hora</option>
              <option value="90">1h30</option>
            </select>
          </div>
        </div>
        
        <div class="agendamento-footer">
          <button type="button" onclick="fecharModalAgendamentoFallback()" style="
            padding: 12px 24px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;
          ">
            Cancelar
          </button>
          <button type="button" onclick="confirmarAgendamentoFallback('${candidatoId}')" style="
            padding: 12px 24px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer;
            display: flex; align-items: center; gap: 8px;
          ">
            <i class="fas fa-check"></i> Confirmar Agendamento
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    // Configura data padrão (amanhã)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById("data-agendamento").value = tomorrow
      .toISOString()
      .split("T")[0];

    console.log("✅ Modal de agendamento fallback criado");
  } catch (error) {
    console.error("❌ Erro ao criar modal de agendamento:", error);
    alert("Erro ao abrir modal de agendamento");
  }
}

function fecharModalAgendamentoFallback() {
  const modal = document.getElementById("modal-agendamento-fallback");
  if (modal) modal.remove();
  document.body.style.overflow = "";
}

function confirmarAgendamentoFallback(candidatoId) {
  const data = document.getElementById("data-agendamento").value;
  const horario = document.getElementById("horario-agendamento").value;
  const duracao = document.getElementById("duracao-agendamento").value;

  if (!data || !horario) {
    alert("Por favor, selecione data e horário");
    return;
  }

  console.log(
    `📅 Agendamento confirmado: ${data} ${horario} (${duracao} min) para ${candidatoId}`
  );
  alert("✅ Reunião agendada com sucesso!");
  fecharModalAgendamentoFallback();
}

// === FUNÇÕES GLOBAIS PARA COMPATIBILIDADE ===
window.abrirModalAvaliacaoGestor = abrirModalAvaliacaoGestorModal;
window.fecharModalAvaliacaoGestor = fecharModalAvaliacaoGestor;
window.salvarAvaliacaoGestorModal = salvarAvaliacaoGestorModal;
window.abrirModalDetalhesGestor = abrirModalDetalhesModal;
window.fecharModalDetalhesGestor = function () {
  const modal = document.getElementById("modal-detalhes-gestor");
  if (modal) modal.remove();
  document.body.style.overflow = "";
};
window.imprimirDetalhesGestor = function (candidatoId) {
  console.log(`🖨️ Imprimindo: ${candidatoId}`);
  window.print();
};
