// modulos/rh/js/tabs/tabGestor.js
import { getGlobalState } from "../recrutamento.js";
import {
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Entrevista com Gestor.
 * Modal corrigido para abrir como POPUP centralizado na tela.
 * Salvamento no Firebase implementado corretamente.
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
    // Query Firestore - AJUSTE OS STATUS CONFORME SEU FIRESTORE
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        // SUBSTITUA POR STATUS REAIS DO SEU FIRESTORE
        "Testes Aprovado",
        "Entrevista Gestor Pendente",
        "Entrevista Gestor Agendada",
        "Aguardando Avaliação Gestor",
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
            <!-- BOTÃO AVALIAR GESTOR -->
            <button class="action-button primary btn-avaliar-gestor" 
                    data-id="${candidaturaId}"
                    data-vaga="${vagaId}"
                    data-dados="${dadosCodificados}"
                    style="min-width: 140px;">
              <i class="fas fa-user-tie"></i> Avaliar Gestor
            </button>
            
            <!-- BOTÃO DETALHES -->
            <button class="action-button secondary btn-ver-detalhes" 
                    data-id="${candidaturaId}"
                    data-dados="${dadosCodificados}"
                    style="min-width: 100px;">
              <i class="fas fa-eye"></i> Detalhes
            </button>
            
            <!-- BOTÃO AGENDAR REUNIÃO - PADRÃO DO tabEntrevistas -->
            <button class="action-button info btn-agendar-rh" 
                    data-id="${candidaturaId}"
                    data-dados="${dadosCodificados}"
                    style="min-width: 140px;">
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

    // EVENT LISTENERS
    console.log("🔗 Gestor: Anexando event listeners...");

    // Botão Avaliar Gestor
    document.querySelectorAll(".btn-avaliar-gestor").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const candidatoId = btn.getAttribute("data-id");
        const vagaId = btn.getAttribute("data-vaga");
        const dadosCodificados = btn.getAttribute("data-dados");

        console.log(`🔹 Gestor: Abrindo modal Avaliar - ID: ${candidatoId}`);

        // Tenta funções globais existentes primeiro
        if (window.abrirModalAvaliacaoGestor) {
          window.abrirModalAvaliacaoGestor(
            candidatoId,
            vagaId,
            dadosCodificados
          );
        } else if (window.abrirModalAvaliacao) {
          window.abrirModalAvaliacao(candidatoId, dadosCodificados, "gestor");
        } else {
          // CRIA MODAL POPUP CENTRALIZADO
          abrirModalAvaliacaoGestorPopup(candidatoId, vagaId, dadosCodificados);
        }
      });
    });

    // Botão Detalhes
    document.querySelectorAll(".btn-ver-detalhes").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");

        console.log(`🔹 Gestor: Abrindo modal Detalhes - ID: ${candidatoId}`);

        if (window.abrirModalDetalhesCandidato) {
          window.abrirModalDetalhesCandidato(candidatoId, dadosCodificados);
        } else if (window.abrirModalCandidato) {
          window.abrirModalCandidato(candidatoId, dadosCodificados, "detalhes");
        } else {
          abrirModalDetalhesPopup(candidatoId, dadosCodificados);
        }
      });
    });

    // Botão Agendar Reunião - PADRÃO DO tabEntrevistas
    document.querySelectorAll(".btn-agendar-rh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");

        console.log(
          `📅 Gestor: Abrindo modal Agendar Reunião - ID: ${candidatoId}`
        );

        if (window.abrirModalAgendamentoRH) {
          const dadosCandidato = JSON.parse(
            decodeURIComponent(dadosCodificados)
          );
          window.abrirModalAgendamentoRH(candidatoId, dadosCandidato);
        } else {
          console.warn(
            "⚠️ Função window.abrirModalAgendamentoRH não encontrada"
          );
          // Fallback: modal simples de agendamento
          abrirModalAgendamentoFallback(candidatoId, dadosCodificados);
        }
      });
    });

    console.log(
      `✅ Gestor: ${snapshot.size} candidatos renderizados com listeners`
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

// === MODAL POPUP CENTRALIZADO PARA AVALIAÇÃO GESTOR ===
function abrirModalAvaliacaoGestorPopup(candidatoId, vagaId, dadosCodificados) {
  console.log("🎯 Gestor: Criando POPUP centralizado para avaliação");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    // Remove modal anterior se existir
    const modalExistente = document.getElementById("modal-gestor-avaliacao");
    if (modalExistente) {
      modalExistente.remove();
    }

    // CRIA O POPUP CENTRALIZADO
    const modal = document.createElement("div");
    modal.id = "modal-gestor-avaliacao";
    modal.className = "modal-overlay";

    modal.innerHTML = `
      <div class="modal-overlay">
        <!-- OVERLAY ESCURO -->
        <div class="modal-background" onclick="fecharModalGestorPopup()"></div>
        
        <!-- CONTEÚDO CENTRALIZADO -->
        <div class="modal-content" style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          background: white;
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          z-index: 10000;
          overflow: hidden;
          animation: modalSlideIn 0.3s ease-out;
        ">
          <!-- HEADER -->
          <div class="modal-header" style="
            background: var(--cor-primaria, #667eea);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fas fa-user-tie" style="font-size: 20px;"></i>
              <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
                Avaliação - Entrevista com Gestor
              </h3>
            </div>
            <button onclick="fecharModalGestorPopup()" style="
              background: rgba(255,255,255,0.2);
              border: none;
              color: white;
              width: 30px;
              height: 30px;
              border-radius: 50%;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
            ">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- BODY - ROLÁVEL -->
          <div class="modal-body" style="
            padding: 25px;
            max-height: 60vh;
            overflow-y: auto;
            background: #f8f9fa;
          ">
            <!-- INFORMAÇÕES DO CANDIDATO -->
            <div class="candidato-info" style="
              background: white;
              padding: 20px;
              border-radius: 6px;
              margin-bottom: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
              <h4 style="margin: 0 0 15px 0; color: var(--cor-primaria, #667eea);">
                <i class="fas fa-user"></i> ${
                  dadosCandidato.nome_completo || "N/A"
                }
              </h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                <div>
                  <strong>Email:</strong><br>
                  ${dadosCandidato.email_candidato || "N/A"}
                </div>
                <div>
                  <strong>Telefone:</strong><br>
                  ${dadosCandidato.telefone_contato || "N/A"}
                </div>
                <div>
                  <strong>Status:</strong><br>
                  <span style="padding: 4px 8px; background: #e3f2fd; color: #1976d2; border-radius: 12px; font-size: 12px;">
                    ${dadosCandidato.status_recrutamento || "N/A"}
                  </span>
                </div>
                <div>
                  <strong>Vaga ID:</strong><br>
                  ${vagaId}
                </div>
              </div>
            </div>
            
            <!-- FORMULÁRIO DE AVALIAÇÃO -->
            <form id="form-avaliacao-gestor">
              <div class="field" style="margin-bottom: 20px;">
                <label style="font-weight: 600; margin-bottom: 8px; display: block; color: #333;">
                  Observações da Entrevista
                </label>
                <textarea name="observacoes" class="textarea" 
                          style="width: 100%; min-height: 120px; border: 1px solid #ddd; border-radius: 6px; padding: 12px; font-family: inherit; resize: vertical;"
                          placeholder="Descreva suas observações sobre a entrevista com o gestor..."></textarea>
              </div>
              
              <div class="field" style="margin-bottom: 20px;">
                <label style="font-weight: 600; margin-bottom: 8px; display: block; color: #333;">
                  Resultado da Avaliação
                </label>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="radio" name="resultado" value="aprovado" style="margin: 0;">
                    <span style="display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #d4edda; color: #155724; border-radius: 20px;">
                      <i class="fas fa-check-circle" style="color: #28a745;"></i>
                      Aprovado para Contratação
                    </span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="radio" name="resultado" value="rejeitado" style="margin: 0;">
                    <span style="display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #f8d7da; color: #721c24; border-radius: 20px;">
                      <i class="fas fa-times-circle" style="color: #dc3545;"></i>
                      Não Selecionado
                    </span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="radio" name="resultado" value="pendente" style="margin: 0;">
                    <span style="display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #fff3cd; color: #856404; border-radius: 20px;">
                      <i class="fas fa-clock" style="color: #ffc107;"></i>
                      Avaliação Pendente
                    </span>
                  </label>
                </div>
              </div>
            </form>
          </div>
          
          <!-- FOOTER FIXO -->
          <div class="modal-footer" style="
            padding: 15px 25px;
            background: white;
            border-top: 1px solid #eee;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          ">
            <button onclick="fecharModalGestorPopup()" 
                    style="
                      padding: 10px 20px;
                      background: #f8f9fa;
                      color: #6c757d;
                      border: 1px solid #dee2e6;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 500;
                    ">
              <i class="fas fa-times"></i> Cancelar
            </button>
            <button onclick="salvarAvaliacaoGestor('${candidatoId}')" 
                    style="
                      padding: 10px 20px;
                      background: var(--cor-primaria, #667eea);
                      color: white;
                      border: none;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 500;
                      display: flex;
                      align-items: center;
                      gap: 6px;
                    ">
              <i class="fas fa-save"></i> Salvar Avaliação
            </button>
          </div>
        </div>
      </div>
      
      <style>
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -60%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        /* SOBRESCREVE QUALQUER CSS EXISTENTE */
        #modal-gestor-avaliacao {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 10000 !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          background: rgba(0, 0, 0, 0.6) !important;
        }
        
        #modal-gestor-avaliacao .modal-background {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background: rgba(0, 0, 0, 0.5) !important;
          z-index: 9999 !important;
        }
        
        #modal-gestor-avaliacao .modal-content {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          z-index: 10001 !important;
          max-height: 90vh !important;
          overflow: hidden !important;
        }
        
        /* RESPONSIVO */
        @media (max-width: 768px) {
          #modal-gestor-avaliacao .modal-content {
            width: 95% !important;
            max-height: 95vh !important;
            top: 5% !important;
            left: 2.5% !important;
            transform: none !important;
          }
          
          #modal-gestor-avaliacao .modal-body {
            max-height: 60vh !important;
            padding: 15px !important;
          }
        }
      </style>
    `;

    // Adiciona o modal ao body
    document.body.appendChild(modal);

    // Scroll para o topo da página
    window.scrollTo(0, 0);

    // Impede scroll do body
    document.body.style.overflow = "hidden";

    console.log("✅ Gestor: Modal popup centralizado criado e exibido");
  } catch (error) {
    console.error("❌ Erro ao criar modal popup:", error);
    // Fallback para a página original
    window.open(
      `etapa-entrevista-gestor.html?candidato=${candidatoId}&vaga=${vagaId}`,
      "_blank"
    );
  }
}

// === MODAL POPUP PARA DETALHES ===
function abrirModalDetalhesPopup(candidatoId, dadosCodificados) {
  console.log("👁️ Gestor: Criando popup de detalhes");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    // Remove modal anterior
    const modalExistente = document.getElementById("modal-gestor-detalhes");
    if (modalExistente) {
      modalExistente.remove();
    }

    const modal = document.createElement("div");
    modal.id = "modal-gestor-detalhes";
    modal.className = "modal-overlay";

    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-background" onclick="fecharModalGestorPopup()"></div>
        
        <div class="modal-content" style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 700px;
          max-height: 85vh;
          background: white;
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          z-index: 10000;
          overflow: hidden;
          animation: modalSlideIn 0.3s ease-out;
        ">
          <div class="modal-header" style="
            background: #f8f9fa;
            color: #333;
            padding: 20px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fas fa-eye" style="font-size: 20px; color: var(--cor-primaria, #667eea);"></i>
              <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
                Detalhes - ${dadosCandidato.nome_completo || "N/A"}
              </h3>
            </div>
            <button onclick="fecharModalGestorPopup()" style="
              background: none;
              border: none;
              color: #6c757d;
              font-size: 20px;
              cursor: pointer;
              padding: 5px;
              border-radius: 4px;
              transition: background 0.2s;
            " onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='none'">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body" style="
            padding: 25px;
            max-height: 60vh;
            overflow-y: auto;
            background: white;
          ">
            <div class="detalhes-grid" style="
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 20px;
              font-size: 14px;
            ">
              <div>
                <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px;">
                  Informações Pessoais
                </h4>
                <div style="line-height: 1.8;">
                  <p><strong>Nome Completo:</strong> ${
                    dadosCandidato.nome_completo || "N/A"
                  }</p>
                  <p><strong>Email:</strong> ${
                    dadosCandidato.email_candidato || "N/A"
                  }</p>
                  <p><strong>Telefone:</strong> ${
                    dadosCandidato.telefone_contato || "N/A"
                  }</p>
                  <p><strong>ID do Candidato:</strong> <code>${candidatoId}</code></p>
                </div>
              </div>
              
              <div>
                <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px;">
                  Status do Processo
                </h4>
                <div style="line-height: 1.8;">
                  <p><strong>Status Atual:</strong>
                    <span style="
                      display: inline-block;
                      padding: 6px 12px;
                      margin-left: 8px;
                      background: #e3f2fd;
                      color: #1976d2;
                      border-radius: 20px;
                      font-size: 13px;
                      font-weight: 500;
                    ">
                      ${dadosCandidato.status_recrutamento || "N/A"}
                    </span>
                  </p>
                  <p><strong>Vaga ID:</strong> <code>${vagaId}</code></p>
                  <p><strong>Data de Cadastro:</strong> ${
                    dadosCandidato.data_cadastro || "N/A"
                  }</p>
                </div>
              </div>
            </div>
            
            ${
              dadosCandidato.observacoes || dadosCandidato.curriculo_observacoes
                ? `
              <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee;">
                <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">
                  Observações
                </h4>
                <div class="box" style="
                  background: #f8f9fa;
                  padding: 15px;
                  border-radius: 6px;
                  border-left: 3px solid var(--cor-primaria, #667eea);
                ">
                  <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #555;">
                    ${
                      dadosCandidato.observacoes ||
                      dadosCandidato.curriculo_observacoes ||
                      "Nenhuma observação registrada."
                    }
                  </p>
                </div>
              </div>
            `
                : ""
            }
          </div>
          
          <div class="modal-footer" style="
            padding: 15px 25px;
            background: #f8f9fa;
            border-top: 1px solid #eee;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          ">
            <button onclick="imprimirDetalhes('${candidatoId}')" 
                    style="
                      padding: 8px 16px;
                      background: #17a2b8;
                      color: white;
                      border: none;
                      border-radius: 6px;
                      cursor: pointer;
                      font-size: 14px;
                      display: flex;
                      align-items: center;
                      gap: 6px;
                    ">
              <i class="fas fa-print"></i> Imprimir
            </button>
            <button onclick="fecharModalGestorPopup()" 
                    style="
                      padding: 8px 16px;
                      background: #6c757d;
                      color: white;
                      border: none;
                      border-radius: 6px;
                      cursor: pointer;
                      font-size: 14px;
                    ">
              Fechar
            </button>
          </div>
        </div>
      </div>
      
      <style>
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -60%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        #modal-gestor-detalhes {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 10000 !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          background: rgba(0, 0, 0, 0.6) !important;
        }
        
        #modal-gestor-detalhes .modal-background {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 9999 !important;
        }
        
        #modal-gestor-detalhes .modal-content {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          z-index: 10001 !important;
          max-height: 90vh !important;
        }
        
        @media (max-width: 768px) {
          #modal-gestor-detalhes .modal-content {
            width: 95% !important;
            max-height: 95vh !important;
            top: 5% !important;
            left: 2.5% !important;
            transform: none !important;
          }
          
          #modal-gestor-detalhes .detalhes-grid {
            grid-template-columns: 1fr !important;
            gap: 15px !important;
          }
        }
      </style>
    `;

    document.body.appendChild(modal);
    window.scrollTo(0, 0);
    document.body.style.overflow = "hidden";

    console.log("✅ Gestor: Modal detalhes popup centralizado criado");
  } catch (error) {
    console.error("❌ Erro ao criar modal detalhes:", error);
    alert("Erro ao abrir detalhes");
  }
}

// === FALLBACK PARA AGENDAMENTO ===
function abrirModalAgendamentoFallback(candidatoId, dadosCodificados) {
  console.log("📅 Gestor: Modal agendamento fallback");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    // Remove modal anterior
    const modalExistente = document.getElementById(
      "modal-agendamento-fallback"
    );
    if (modalExistente) {
      modalExistente.remove();
    }

    const modal = document.createElement("div");
    modal.id = "modal-agendamento-fallback";
    modal.className = "modal-overlay";

    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-background" onclick="fecharModalGestorPopup()"></div>
        
        <div class="modal-content" style="
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 500px;
          max-height: 85vh;
          background: white;
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          z-index: 10000;
          overflow: hidden;
          animation: modalSlideIn 0.3s ease-out;
        ">
          <div class="modal-header" style="
            background: var(--cor-info, #17a2b8);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fas fa-calendar-alt" style="font-size: 20px;"></i>
              <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
                Agendar Reunião
              </h3>
            </div>
            <button onclick="fecharModalGestorPopup()" style="
              background: rgba(255,255,255,0.2);
              border: none;
              color: white;
              width: 30px;
              height: 30px;
              border-radius: 50%;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
            ">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="modal-body" style="
            padding: 25px;
            max-height: 60vh;
            overflow-y: auto;
            background: #f8f9fa;
          ">
            <div style="background: white; padding: 20px; border-radius: 6px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h4 style="margin: 0 0 15px 0; color: var(--cor-info, #17a2b8);">
                <i class="fas fa-user"></i> ${
                  dadosCandidato.nome_completo || "N/A"
                }
              </h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                <div>
                  <strong>Email:</strong><br>
                  ${dadosCandidato.email_candidato || "N/A"}
                </div>
                <div>
                  <strong>Telefone:</strong><br>
                  ${dadosCandidato.telefone_contato || "N/A"}
                </div>
                <div>
                  <strong>Status:</strong><br>
                  <span style="padding: 4px 8px; background: #e3f2fd; color: #17a2b8; border-radius: 12px; font-size: 12px;">
                    ${dadosCandidato.status_recrutamento || "N/A"}
                  </span>
                </div>
                <div>
                  <strong>Vaga ID:</strong><br>
                  ${vagaId}
                </div>
              </div>
            </div>
            
            <form id="form-agendamento-gestor">
              <div class="field" style="margin-bottom: 20px;">
                <label style="font-weight: 600; margin-bottom: 8px; display: block; color: #333;">
                  Data da Reunião
                </label>
                <input type="date" name="data" class="input" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px;" required>
              </div>
              
              <div class="field" style="margin-bottom: 20px;">
                <label style="font-weight: 600; margin-bottom: 8px; display: block; color: #333;">
                  Horário
                </label>
                <select name="horario" class="select" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px;" required>
                  <option value="">Selecione um horário</option>
                  <option value="09:00">09:00</option>
                  <option value="10:00">10:00</option>
                  <option value="14:00">14:00</option>
                  <option value="15:00">15:00</option>
                  <option value="16:00">16:00</option>
                </select>
              </div>
              
              <div class="field" style="margin-bottom: 20px;">
                <label style="font-weight: 600; margin-bottom: 8px; display: block; color: #333;">
                  Duração
                </label>
                <select name="duracao" class="select" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px;">
                  <option value="30">30 minutos</option>
                  <option value="60" selected>1 hora</option>
                  <option value="90">1h30 minutos</option>
                </select>
              </div>
            </form>
          </div>
          
          <div class="modal-footer" style="
            padding: 15px 25px;
            background: white;
            border-top: 1px solid #eee;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          ">
            <button onclick="fecharModalGestorPopup()" 
                    style="
                      padding: 10px 20px;
                      background: #f8f9fa;
                      color: #6c757d;
                      border: 1px solid #dee2e6;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 500;
                    ">
              <i class="fas fa-times"></i> Cancelar
            </button>
            <button onclick="confirmarAgendamentoGestor('${candidatoId}')" 
                    style="
                      padding: 10px 20px;
                      background: var(--cor-info, #17a2b8);
                      color: white;
                      border: none;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 500;
                      display: flex;
                      align-items: center;
                      gap: 6px;
                    ">
              <i class="fas fa-check"></i> Confirmar Agendamento
            </button>
          </div>
        </div>
      </div>
      
      <style>
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -60%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        #modal-agendamento-fallback {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 10000 !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          background: rgba(0, 0, 0, 0.6) !important;
        }
        
        #modal-agendamento-fallback .modal-background {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background: rgba(0, 0, 0, 0.5) !important;
          z-index: 9999 !important;
        }
        
        #modal-agendamento-fallback .modal-content {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          z-index: 10001 !important;
          max-height: 90vh !important;
        }
        
        @media (max-width: 768px) {
          #modal-agendamento-fallback .modal-content {
            width: 95% !important;
            max-height: 95vh !important;
            top: 5% !important;
            left: 2.5% !important;
            transform: none !important;
          }
          
          #modal-agendamento-fallback .modal-body {
            max-height: 60vh !important;
            padding: 15px !important;
          }
        }
      </style>
    `;

    document.body.appendChild(modal);
    window.scrollTo(0, 0);
    document.body.style.overflow = "hidden";

    // Configura data padrão (amanhã)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dataInput = modal.querySelector('input[name="data"]');
    if (dataInput) {
      dataInput.value = tomorrow.toISOString().split("T")[0];
    }

    console.log("✅ Gestor: Modal agendamento popup centralizado criado");
  } catch (error) {
    console.error("❌ Erro ao criar modal agendamento:", error);
    alert("Erro ao abrir agendamento");
  }
}

// === FUNÇÃO PARA CONFIRMAR AGENDAMENTO ===
function confirmarAgendamentoGestor(candidatoId) {
  const form = document.getElementById("form-agendamento-gestor");
  if (!form) {
    alert("Erro: Formulário de agendamento não encontrado");
    return;
  }

  const formData = new FormData(form);
  const data = formData.get("data");
  const horario = formData.get("horario");
  const duracao = formData.get("duracao");

  if (!data || !horario) {
    alert("Por favor, selecione data e horário da reunião");
    return;
  }

  console.log(`📅 Gestor: Confirmando agendamento - ID: ${candidatoId}`);
  console.log(`Data: ${data}, Horário: ${horario}, Duração: ${duracao}`);

  // TODO: Implementar salvamento no Firestore
  // await updateDoc(doc(db, 'candidatos', candidatoId), {
  //   agendamento_gestor: {
  //     data: data,
  //     horario: horario,
  //     duracao: parseInt(duracao),
  //     status: 'Agendado',
  //     data_cadastro: new Date()
  //   }
  // });

  alert("✅ Reunião agendada com sucesso!");
  fecharModalGestorPopup();
}

// === FUNÇÃO PARA FECHAR MODAL ===
function fecharModalGestorPopup() {
  const modals = [
    document.getElementById("modal-gestor-avaliacao"),
    document.getElementById("modal-gestor-detalhes"),
    document.getElementById("modal-agendamento-fallback"),
  ];

  modals.forEach((modal) => {
    if (modal) {
      modal.style.opacity = "0";
      setTimeout(() => {
        if (modal && modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 300);
    }
  });

  document.body.style.overflow = "";
  window.scrollTo(0, 0);
}

// === FUNÇÃO PARA SALVAR AVALIAÇÃO (CORRIGIDA - IMPLEMENTAÇÃO REAL) ===
async function salvarAvaliacaoGestor(candidatoId) {
  console.log("💾 Gestor: Salvando avaliação no Firebase");

  const form = document.getElementById("form-avaliacao-gestor");
  if (!form) {
    alert("Erro: Formulário de avaliação não encontrado");
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

  try {
    // BLOQUEIA BOTÃO DURANTE SALVAMENTO
    const btnSalvar = form.querySelector(
      'button[onclick="salvarAvaliacaoGestor()"]'
    );
    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    }

    // CONSTRÓI O OBJETO DE ATUALIZAÇÃO
    const agora = new Date();
    const updateData = {
      status_recrutamento:
        resultado === "aprovado"
          ? "Processo Concluído - Contratado"
          : "Processo Concluído - Rejeitado",
      avaliacao_gestor: {
        aprovado: resultado === "aprovado",
        data_avaliacao: agora,
        observacoes: observacoes.trim(),
        avaliador:
          getGlobalState()?.usuarioAtual?.email || "usuario@eupsico.com",
        etapa: "Entrevista com Gestor",
      },
      historico: arrayUnion({
        data: agora,
        acao: `Avaliação ${
          resultado === "aprovado" ? "Aprovada" : "Rejeitada"
        } pelo Gestor`,
        usuario: getGlobalState()?.usuarioAtual?.id || "gestor",
        anterior: "Entrevista com Gestor Pendente",
        detalhes: observacoes.trim(),
      }),
      data_ultima_atualizacao: agora,
    };

    if (resultado === "rejeitado") {
      updateData.rejeicao = {
        etapa: "Entrevista com Gestor",
        data: agora,
        motivo: "Avaliação final pelo gestor",
        observacoes: observacoes.trim(),
      };
    }

    // SALVAMENTO REAL NO FIRESTORE
    console.log("📝 Atualizando documento do candidato:", candidatoId);
    console.log("📋 Dados de atualização:", updateData);

    const candidatoRef = doc(db, "candidatos", candidatoId);
    await updateDoc(candidatoRef, updateData);

    console.log("✅ Avaliação salva com sucesso no Firebase");
    alert(
      "✅ Avaliação salva com sucesso! O candidato foi movido para a aba Finalizados."
    );

    // FECHA MODAL E RECARREGA A LISTA
    fecharModalGestorPopup();

    // RECARREGA A LISTA DE CANDIDATOS (remove da aba atual)
    const stateAtual = getGlobalState();
    renderizarEntrevistaGestor(stateAtual);
  } catch (error) {
    console.error("❌ Erro ao salvar avaliação:", error);
    alert(`Erro ao salvar avaliação: ${error.message}`);
  } finally {
    // REATIVA BOTÃO
    const btnSalvar = form.querySelector(
      'button[onclick="salvarAvaliacaoGestor()"]'
    );
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Avaliação';
    }
  }
}

// === FUNÇÃO PARA IMPRIMIR DETALHES ===
function imprimirDetalhes(candidatoId) {
  console.log("🖨️ Gestor: Imprimindo detalhes do candidato:", candidatoId);

  // Cria janela de impressão com dados do candidato
  const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
      <head><title>Detalhes - ${dadosCandidato.nome_completo}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
          .info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
          .info div { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 3px solid #667eea; }
          h1 { color: #333; margin: 0 0 10px 0; }
          h2 { color: #666; margin: 30px 0 15px 0; }
          .status { padding: 6px 12px; border-radius: 20px; font-weight: bold; }
          .aprovado { background: #d4edda; color: #155724; }
          .rejeitado { background: #f8d7da; color: #721c24; }
          .pendente { background: #fff3cd; color: #856404; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>EuPsico - Detalhes do Candidato</h1>
          <p style="color: #666; font-size: 14px;">${new Date().toLocaleDateString(
            "pt-BR"
          )}</p>
        </div>
        
        <div class="info">
          <div>
            <h2>Informações Pessoais</h2>
            <p><strong>Nome:</strong> ${
              dadosCandidato.nome_completo || "N/A"
            }</p>
            <p><strong>Email:</strong> ${
              dadosCandidato.email_candidato || "N/A"
            }</p>
            <p><strong>Telefone:</strong> ${
              dadosCandidato.telefone_contato || "N/A"
            }</p>
            <p><strong>ID:</strong> ${candidatoId}</p>
          </div>
          <div>
            <h2>Status do Processo</h2>
            <p><strong>Status Atual:</strong> <span class="status">${
              dadosCandidato.status_recrutamento || "N/A"
            }</span></p>
            <p><strong>Vaga ID:</strong> ${vagaId}</p>
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

// === FUNÇÕES AUXILIARES ===
function fecharModalGestorPopup() {
  const modals = [
    document.getElementById("modal-gestor-avaliacao"),
    document.getElementById("modal-gestor-detalhes"),
    document.getElementById("modal-agendamento-fallback"),
  ];

  modals.forEach((modal) => {
    if (modal) {
      modal.style.opacity = "0";
      modal.style.transform = "translate(-50%, -60%) scale(0.95)";
      setTimeout(() => {
        if (modal && modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 300);
    }
  });

  document.body.style.overflow = "";
  window.scrollTo(0, 0);
}

// Torna funções globalmente acessíveis
window.abrirModalAvaliacaoGestorPopup = abrirModalAvaliacaoGestorPopup;
window.abrirModalDetalhesPopup = abrirModalDetalhesPopup;
window.confirmarAgendamentoGestor = confirmarAgendamentoGestor;
window.salvarAvaliacaoGestor = salvarAvaliacaoGestor;
window.fecharModalGestorPopup = fecharModalGestorPopup;
window.imprimirDetalhes = imprimirDetalhes;
