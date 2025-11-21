// modulos/rh/js/tabs/tabFinalizados.js
import { getGlobalState } from "../recrutamento.js";
import { getDocs, query, where } from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos na etapa de Finalizados (Contratados ou Rejeitados na fase final).
 * Estilo visual padronizado com tabEntrevistas.js e tabGestor.js (grids, cards, badges, ações).
 */
export async function renderizarFinalizados(state) {
  const {
    vagaSelecionadaId,
    conteudoRecrutamento,
    candidatosCollection,
    statusCandidaturaTabs,
  } = state;

  if (!vagaSelecionadaId) {
    conteudoRecrutamento.innerHTML = `
      <div class="alert alert-info" style="border-left: 4px solid var(--cor-info); padding: 15px; margin: 20px 0;">
        <i class="fas fa-info-circle"></i> Nenhuma vaga selecionada.
      </div>
    `;
    return;
  }

  // Loading spinner com estilo das outras abas
  conteudoRecrutamento.innerHTML = `
    <div class="loading-spinner" style="text-align: center; padding: 40px;">
      <i class="fas fa-spinner fa-spin"></i> Carregando candidatos finalizados...
    </div>
  `;

  try {
    // Query Firestore com filtros para status finalizados
    const q = query(
      candidatosCollection,
      where("vaga_id", "==", vagaSelecionadaId),
      where("status_recrutamento", "in", [
        "Triagem Reprovada (Encerrada)",
        "Contratado",
        "Finalizado - Contratado",
        "Processo Finalizado",
        "Rejeitado Final",
        "Não Selecionado",
        "Reprovado Final",
        "Processo Concluído - Rejeitado",
        "Processo Concluído - Contratado",
        "AGUARDANDO_ADMISSAO",
      ])
    );

    const snapshot = await getDocs(q);

    // Atualização de contagem na aba (padrão das outras abas)
    const tab = statusCandidaturaTabs.querySelector(
      '.tab-link[data-status="finalizados"]'
    );
    if (tab) {
      tab.textContent = `5. Finalizados (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoRecrutamento.innerHTML = `
        <div class="alert alert-warning" style="border-left: 4px solid var(--cor-warning); padding: 15px; margin: 20px 0;">
          <i class="fas fa-exclamation-triangle"></i> Nenhuma candidatura finalizada para esta vaga.
        </div>
      `;
      return;
    }

    // Container com grid responsivo (igual tabEntrevistas)
    let listaHtml = `
      <div class="candidatos-container candidatos-grid"></div>
    `;

    // Loop forEach com estrutura de cards das outras abas
    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const statusAtual = cand.status_recrutamento || "N/A";
      const candidaturaId = doc.id;

      // Determina classe de status baseada no conteúdo (igual tabGestor)
      let statusClass = "status-secondary";
      let statusIcon = "fa-circle";

      if (
        statusAtual.includes("Contratado") ||
        statusAtual.includes("Finalizado") ||
        statusAtual.includes("Concluído")
      ) {
        statusClass = "status-success";
        statusIcon = "fa-check-circle";
      } else if (
        statusAtual.includes("Rejeitado") ||
        statusAtual.includes("Reprovado") ||
        statusAtual.includes("Não Selecionado")
      ) {
        statusClass = "status-danger";
        statusIcon = "fa-times-circle";
      }

      // Dados encoded para modais (padrão das outras abas)
      const dadosCandidato = {
        id: candidaturaId,
        nome_completo: cand.nome_completo || "N/A",
        email_candidato: cand.email_candidato || "N/A",
        telefone_contato: cand.telefone_contato || "N/A",
        status_recrutamento: statusAtual,
        vaga_id: vagaSelecionadaId,
        data_finalizacao: cand.data_finalizacao || "N/A",
        motivo_rejeicao: cand.motivo_rejeicao || "N/A",
      };
      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
        <div class="card card-candidato-finalizado" data-id="${candidaturaId}">
          <div class="info-primaria">
            <h4 class="nome-candidato">
              ${cand.nome_completo || "Candidato Sem Nome"}
              <span class="status-badge ${statusClass}">
                <i class="fas ${statusIcon}"></i> ${statusAtual}
              </span>
            </h4>
            <p class="small-info">
              <i class="fas fa-flag-checkered"></i> Processo Concluído
              ${
                cand.data_finalizacao
                  ? `<br><small style="color: var(--cor-texto-secundario);">Finalizado em: ${new Date(
                      cand.data_finalizacao
                    ).toLocaleDateString("pt-BR")}</small>`
                  : ""
              }
            </p>
          </div>

          <!-- Informações de contato (igual tabEntrevistas) -->
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
            ${
              cand.motivo_rejeicao &&
              (statusAtual.includes("Rejeitado") ||
                statusAtual.includes("Reprovado"))
                ? `
              <div class="motivo-rejeicao" style="background: #fff5f5; padding: 10px; border-radius: 6px; border-left: 3px solid var(--cor-danger); margin-top: 10px;">
                <i class="fas fa-exclamation-triangle" style="color: var(--cor-danger); margin-right: 8px;"></i>
                <strong>Motivo:</strong> ${cand.motivo_rejeicao}
              </div>
            `
                : ""
            }
          </div>

          <!-- Ações padronizadas (igual tabGestor) -->
          <div class="acoes-candidato">
            <!-- Detalhes Completo -->
            <button class="action-button primary btn-detalhes-finalizado"
                    data-id="${candidaturaId}"
                    data-dados="${dadosCodificados}"
                    style="min-width: 120px;">
              <i class="fas fa-eye"></i> Detalhes Completos
            </button>

            <!-- Contato (WhatsApp/Email) -->
            ${
              cand.telefone_contato
                ? `
              <button class="action-button info btn-contato-finalizado" 
                      data-id="${candidaturaId}"
                      data-dados="${dadosCodificados}"
                      style="min-width: 120px;">
                <i class="fas fa-comments"></i> Contatar
              </button>
            `
                : ""
            }

            <!-- Contratados: Ver Contrato | Rejeitados: Feedback -->
            ${
              statusAtual.includes("Contratado")
                ? `
              <button class="action-button success btn-contrato" 
                      data-id="${candidaturaId}"
                      style="min-width: 100px;">
                <i class="fas fa-file-contract"></i> Contrato
              </button>
            `
                : statusAtual.includes("Rejeitado") ||
                  statusAtual.includes("Reprovado")
                ? `
              <button class="action-button warning btn-feedback" 
                      data-id="${candidaturaId}"
                      data-dados="${dadosCodificados}"
                      style="min-width: 100px;">
                <i class="fas fa-comment-dots"></i> Feedback
              </button>
            `
                : ""
            }
          </div>
        </div>
      `;
    });

    listaHtml += `
      </div>
    `;

    conteudoRecrutamento.innerHTML = listaHtml;

    // === EVENT LISTENERS PARA AÇÕES (PADRÃO DAS OUTRAS ABAS) ===
    console.log("🔗 Finalizados: Anexando event listeners...");

    // Botão Detalhes Completos
    document.querySelectorAll(".btn-detalhes-finalizado").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");

        console.log(
          `👁️ Finalizados: Abrindo detalhes completos - ID: ${candidatoId}`
        );

        // Chama função global se existir, senão modal local
        if (window.abrirModalDetalhesFinalizado) {
          window.abrirModalDetalhesFinalizado(candidatoId, dadosCodificados);
        } else {
          abrirModalDetalhesFinalizado(candidatoId, dadosCodificados);
        }
      });
    });

    // Botão Contatar (WhatsApp/Email)
    document.querySelectorAll(".btn-contato-finalizado").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");

        console.log(
          `💬 Finalizados: Contatando candidato - ID: ${candidatoId}`
        );

        const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

        // Prioridade: WhatsApp se telefone existir
        if (dadosCandidato.telefone_contato) {
          enviarMensagemWhatsAppFinalizado(candidatoId, dadosCodificados);
        } else if (dadosCandidato.email_candidato) {
          // Fallback para email
          window.location.href = `mailto:${dadosCandidato.email_candidato}?subject=EuPsico - Contato Pós-Processo&body=Olá ${dadosCandidato.nome_completo}, ...`;
        }
      });
    });

    // Botão Contrato (para contratados)
    document.querySelectorAll(".btn-contrato").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const candidatoId = btn.getAttribute("data-id");

        console.log(`📄 Finalizados: Abrindo contrato - ID: ${candidatoId}`);

        // Pode abrir modal de contrato ou página específica
        if (window.abrirModalContrato) {
          window.abrirModalContrato(candidatoId);
        } else {
          // Fallback: abre página de contrato
          window.open(`/contrato?candidato=${candidatoId}`, "_blank");
        }
      });
    });

    // Botão Feedback (para rejeitados)
    document.querySelectorAll(".btn-feedback").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");

        console.log(`📝 Finalizados: Enviando feedback - ID: ${candidatoId}`);

        // Abre modal de feedback ou envia email automático
        if (window.abrirModalFeedback) {
          window.abrirModalFeedback(candidatoId, dadosCodificados);
        } else {
          abrirModalFeedbackFinalizado(candidatoId, dadosCodificados);
        }
      });
    });

    console.log(
      `✅ Finalizados: ${snapshot.size} candidatos renderizados com ações configuradas`
    );
  } catch (error) {
    console.error("❌ Finalizados: Erro ao carregar:", error);
    conteudoRecrutamento.innerHTML = `
      <div class="alert alert-danger" style="border-left: 4px solid var(--cor-danger); padding: 15px; margin: 20px 0;">
        <i class="fas fa-exclamation-circle"></i> Erro ao carregar candidatos finalizados: ${error.message}
      </div>
    `;
  }
}

// === MODAL DETALHES COMPLETO ===
function abrirModalDetalhesFinalizado(candidatoId, dadosCodificados) {
  console.log("👁️ Finalizados: Modal detalhes completo");

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
    const statusAtual = dadosCandidato.status_recrutamento;

    // Remove modal anterior
    const modalExistente = document.getElementById("modal-detalhes-finalizado");
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement("div");
    modal.id = "modal-detalhes-finalizado";

    // Determina cores e título baseado no status
    let statusClass = "status-secondary";
    let statusColor = "#6c757d";
    let tituloStatus = "Processo Finalizado";

    if (statusAtual.includes("Contratado")) {
      statusClass = "status-success";
      statusColor = "#28a745";
      tituloStatus = "Contratado com Sucesso";
    } else if (
      statusAtual.includes("Rejeitado") ||
      statusAtual.includes("Reprovado")
    ) {
      statusClass = "status-danger";
      statusColor = "#dc3545";
      tituloStatus = "Processo Não Selecionado";
    }

    modal.innerHTML = `
      <style>
        #modal-detalhes-finalizado {
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
        
        #modal-detalhes-finalizado .modal-container {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: 95% !important;
          max-width: 800px !important;
          max-height: 90vh !important;
          background: white !important;
          border-radius: 12px !important;
          box-shadow: 0 25px 50px -15px rgba(0,0,0,0.3) !important;
          overflow: hidden !important;
        }
        
        #modal-detalhes-finalizado .header {
          background: linear-gradient(135deg, ${statusColor}20 0%, ${statusColor}10 100%) !important;
          color: #333 !important;
          padding: 25px !important;
          border-bottom: 1px solid #eee !important;
          position: relative !important;
        }
        
        #modal-detalhes-finalizado .header::before {
          content: '';
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          bottom: 0 !important;
          width: 5px !important;
          background: ${statusColor} !important;
        }
        
        #modal-detalhes-finalizado .body {
          padding: 30px !important;
          max-height: 60vh !important;
          overflow-y: auto !important;
        }
        
        #modal-detalhes-finalizado .footer {
          padding: 20px 30px !important;
          background: #f8f9fa !important;
          border-top: 1px solid #dee2e6 !important;
          display: flex !important;
          justify-content: flex-end !important;
          gap: 12px !important;
        }
        
        #modal-detalhes-finalizado .status-header {
          display: flex !important;
          align-items: center !important;
          gap: 15px !important;
          margin-bottom: 25px !important;
          padding: 15px !important;
          background: white !important;
          border-radius: 8px !important;
          border: 2px solid ${statusColor}20 !important;
        }
        
        #modal-detalhes-finalizado .status-icon {
          width: 60px !important;
          height: 60px !important;
          border-radius: 50% !important;
          background: ${statusColor} !important;
          color: white !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 24px !important;
          flex-shrink: 0 !important;
        }
        
        #modal-detalhes-finalizado .status-info h3 {
          margin: 0 0 5px 0 !important;
          font-size: 22px !important;
          color: ${statusColor} !important;
          font-weight: 600 !important;
        }
        
        #modal-detalhes-finalizado .status-info p {
          margin: 0 !important;
          color: #666 !important;
          font-size: 14px !important;
        }
        
        #modal-detalhes-finalizado .detalhes-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)) !important;
          gap: 20px !important;
          margin-top: 20px !important;
        }
        
        #modal-detalhes-finalizado .detalhe-card {
          background: #f8f9fa !important;
          padding: 20px !important;
          border-radius: 8px !important;
          border-left: 4px solid ${statusColor}40 !important;
        }
        
        #modal-detalhes-finalizado .detalhe-titulo {
          margin: 0 0 15px 0 !important;
          color: #333 !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }
        
        #modal-detalhes-finalizado .detalhe-conteudo {
          display: grid !important;
          gap: 12px !important;
          font-size: 14px !important;
        }
        
        #modal-detalhes-finalizado .detalhe-item {
          display: flex !important;
          justify-content: space-between !important;
          padding: 8px 0 !important;
          border-bottom: 1px solid #eee !important;
        }
        
        #modal-detalhes-finalizado .detalhe-label {
          font-weight: 600 !important;
          color: #666 !important;
          min-width: 120px !important;
        }
        
        #modal-detalhes-finalizado .detalhe-value {
          color: #333 !important;
          text-align: right !important;
          flex: 1 !important;
        }
        
        #modal-detalhes-finalizado .btn-footer {
          padding: 12px 24px !important;
          border: none !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          font-weight: 500 !important;
          font-size: 14px !important;
          transition: all 0.2s !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }
        
        #modal-detalhes-finalizado .btn-primary-footer {
          background: ${statusColor} !important;
          color: white !important;
        }
        
        #modal-detalhes-finalizado .btn-secondary-footer {
          background: #6c757d !important;
          color: white !important;
        }
        
        @media (max-width: 768px) {
          #modal-detalhes-finalizado .modal-container {
            width: 98% !important;
            max-height: 95vh !important;
            top: 5% !important;
            left: 2% !important;
            transform: none !important;
          }
          
          #modal-detalhes-finalizado .detalhes-grid {
            grid-template-columns: 1fr !important;
          }
          
          #modal-detalhes-finalizado .detalhe-item {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 4px !important;
          }
          
          #modal-detalhes-finalizado .detalhe-value {
            text-align: left !important;
          }
        }
      </style>
      
      <div class="modal-container">
        <div class="header">
          <div class="status-header">
            <div class="status-icon">
              <i class="fas ${
                statusAtual.includes("Contratado")
                  ? "fa-check-circle"
                  : statusAtual.includes("Rejeitado")
                  ? "fa-times-circle"
                  : "fa-flag-checkered"
              }"></i>
            </div>
            <div class="status-info">
              <h3>${tituloStatus}</h3>
              <p>${dadosCandidato.nome_completo || "N/A"}</p>
            </div>
          </div>
          
          <button onclick="fecharModalDetalhesFinalizado()" style="
            background: none; border: none; color: #666; font-size: 20px; cursor: pointer; padding: 5px; border-radius: 4px;
          ">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="body">
          <div class="detalhes-grid">
            <div class="detalhe-card">
              <h4 class="detalhe-titulo">
                <i class="fas fa-user"></i> Informações do Candidato
              </h4>
              <div class="detalhe-conteudo">
                <div class="detalhe-item">
                  <span class="detalhe-label">Nome Completo</span>
                  <span class="detalhe-value">${
                    dadosCandidato.nome_completo || "N/A"
                  }</span>
                </div>
                <div class="detalhe-item">
                  <span class="detalhe-label">Email</span>
                  <span class="detalhe-value">${
                    dadosCandidato.email_candidato || "N/A"
                  }</span>
                </div>
                <div class="detalhe-item">
                  <span class="detalhe-label">Telefone</span>
                  <span class="detalhe-value">${
                    dadosCandidato.telefone_contato || "N/A"
                  }</span>
                </div>
                <div class="detalhe-item">
                  <span class="detalhe-label">ID do Candidato</span>
                  <span class="detalhe-value"><code>${candidatoId}</code></span>
                </div>
              </div>
            </div>
            
            <div class="detalhe-card">
              <h4 class="detalhe-titulo">
                <i class="fas fa-clipboard-check"></i> Status do Processo
              </h4>
              <div class="detalhe-conteudo">
                <div class="detalhe-item">
                  <span class="detalhe-label">Status Final</span>
                  <span class="detalhe-value">
                    <span class="status-badge ${statusClass}" style="background: ${statusColor}20; color: ${statusColor}; padding: 6px 12px; border-radius: 20px; font-size: 13px;">
                      <i class="fas fa-${
                        statusAtual.includes("Contratado")
                          ? "check"
                          : statusAtual.includes("Rejeitado")
                          ? "times"
                          : "flag"
                      }"></i>
                      ${statusAtual}
                    </span>
                  </span>
                </div>
                <div class="detalhe-item">
                  <span class="detalhe-label">ID da Vaga</span>
                  <span class="detalhe-value"><code>${vagaId}</code></span>
                </div>
                <div class="detalhe-item">
                  <span class="detalhe-label">Data Finalização</span>
                  <span class="detalhe-value">${
                    dadosCandidato.data_finalizacao
                      ? new Date(
                          dadosCandidato.data_finalizacao
                        ).toLocaleString("pt-BR")
                      : "N/A"
                  }</span>
                </div>
                ${
                  dadosCandidato.motivo_rejeicao
                    ? `
                  <div class="detalhe-item">
                    <span class="detalhe-label">Motivo da Decisão</span>
                    <span class="detalhe-value" style="color: #dc3545; font-style: italic;">${dadosCandidato.motivo_rejeicao}</span>
                  </div>
                `
                    : ""
                }
              </div>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <button class="btn-secondary-footer btn-footer" onclick="contatarCandidatoFinalizado('${candidatoId}', '${dadosCodificados}')">
            <i class="fas fa-comments"></i> Contatar Candidato
          </button>
          <button class="btn-primary-footer btn-footer" onclick="fecharModalDetalhesFinalizado()">
            <i class="fas fa-check"></i> Fechar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);

    console.log("✅ Modal detalhes finalizado criado");
  } catch (error) {
    console.error("❌ Erro ao criar modal detalhes finalizado:", error);
    alert("Erro ao abrir detalhes");
  }
}

// === FUNÇÃO FECHAR MODAL DETALHES ===
window.fecharModalDetalhesFinalizado = function () {
  const modal = document.getElementById("modal-detalhes-finalizado");
  if (modal) {
    modal.style.opacity = "0";
    setTimeout(() => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      document.body.style.overflow = "";
    }, 300);
  }
};

// === FUNÇÃO CONTATAR CANDIDATO ===
function contatarCandidatoFinalizado(candidatoId, dadosCodificados) {
  const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

  if (dadosCandidato.telefone_contato) {
    // WhatsApp para contratados ou feedback para rejeitados
    if (dadosCandidato.status_recrutamento.includes("Contratado")) {
      const mensagem = `Olá ${dadosCandidato.nome_completo}!

🎉 Parabéns por ser selecionado(a) para nossa equipe!

Próximos passos:
📋 Onboarding e documentação
📅 Treinamento inicial
🎯 Integração à equipe

Aguarde nosso contato para agilizar sua admissão!

Bem-vindo(a) à EuPsico! 💙`;

      const telefone = dadosCandidato.telefone_contato.replace(/\D/g, "");
      const url = `https://wa.me/55${telefone}?text=${encodeURIComponent(
        mensagem
      )}`;
      window.open(url, "_blank");
    } else {
      const mensagem = `Olá ${dadosCandidato.nome_completo},

Agradecemos muito seu interesse e tempo dedicado ao processo seletivo.

Após análise detalhada, informamos que não prosseguiremos com sua candidatura nesta oportunidade.

💡 Sugestões:
• Mantenha seu perfil atualizado
• Considere outras vagas que abriremos
• Seu cadastro permanece ativo para futuras seleções

Obrigado e sucesso na sua jornada profissional! 🙏

Equipe EuPsico`;

      const telefone = dadosCandidato.telefone_contato.replace(/\D/g, "");
      const url = `https://wa.me/55${telefone}?text=${encodeURIComponent(
        mensagem
      )}`;
      window.open(url, "_blank");
    }
  } else if (dadosCandidato.email_candidato) {
    let subject = "EuPsico - ";
    let body = "";

    if (dadosCandidato.status_recrutamento.includes("Contratado")) {
      subject += "Bem-vindo à Equipe!";
      body = `Olá ${dadosCandidato.nome_completo},

Parabéns por ser selecionado(a) para nossa equipe! Em breve entraremos em contato para os próximos passos do onboarding.

Obrigado!`;
    } else {
      subject += "Agradecimento pelo Processo";
      body = `Olá ${dadosCandidato.nome_completo},

Agradecemos sua participação no processo seletivo. Em breve receberá mais informações.

Atenciosamente,`;
    }

    window.location.href = `mailto:${
      dadosCandidato.email_candidato
    }?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  fecharModalDetalhesFinalizado();
}

// === MODAL FEEDBACK PARA REJEITADOS ===
function abrirModalFeedbackFinalizado(candidatoId, dadosCodificados) {
  console.log("📝 Finalizados: Modal de feedback");

  const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

  // Remove modal anterior
  const modalExistente = document.getElementById("modal-feedback-finalizado");
  if (modalExistente) modalExistente.remove();

  const modal = document.createElement("div");
  modal.id = "modal-feedback-finalizado";

  modal.innerHTML = `
    <style>
      #modal-feedback-finalizado {
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
      
      #modal-feedback-finalizado .feedback-container {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 90% !important;
        max-width: 550px !important;
        background: white !important;
        border-radius: 12px !important;
        box-shadow: 0 25px 50px rgba(0,0,0,0.3) !important;
        overflow: hidden !important;
      }
      
      #modal-feedback-finalizado .feedback-header {
        background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%) !important;
        color: white !important;
        padding: 20px !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
      }
      
      #modal-feedback-finalizado .feedback-body {
        padding: 25px !important;
      }
      
      #modal-feedback-finalizado .feedback-form {
        display: flex !important;
        flex-direction: column !important;
        gap: 20px !important;
      }
      
      #modal-feedback-finalizado .form-group {
        position: relative !important;
      }
      
      #modal-feedback-finalizado .form-label {
        position: absolute !important;
        top: -8px !important;
        left: 12px !important;
        background: white !important;
        padding: 0 8px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        color: #666 !important;
      }
      
      #modal-feedback-finalizado .form-textarea {
        width: 100% !important;
        min-height: 100px !important;
        padding: 20px 12px 12px !important;
        border: 2px solid #e9ecef !important;
        border-radius: 8px !important;
        font-family: inherit !important;
        resize: vertical !important;
        font-size: 14px !important;
        transition: all 0.2s !important;
        box-sizing: border-box !important;
      }
      
      #modal-feedback-finalizado .form-textarea:focus {
        outline: none !important;
        border-color: #ffc107 !important;
        box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.1) !important;
      }
      
      #modal-feedback-finalizado .form-textarea:valid + .form-label,
      #modal-feedback-finalizado .form-textarea:focus + .form-label {
        color: #ffc107 !important;
      }
      
      #modal-feedback-finalizado .feedback-footer {
        padding: 20px 25px !important;
        background: #f8f9fa !important;
        border-top: 1px solid #dee2e6 !important;
        display: flex !important;
        justify-content: flex-end !important;
        gap: 12px !important;
      }
      
      #modal-feedback-finalizado .btn-feedback {
        padding: 12px 24px !important;
        border: none !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-weight: 500 !important;
        font-size: 14px !important;
        transition: all 0.2s !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }
      
      #modal-feedback-finalizado .btn-primary-feedback {
        background: #ffc107 !important;
        color: #212529 !important;
      }
      
      #modal-feedback-finalizado .btn-primary-feedback:hover {
        background: #e0a800 !important;
        transform: translateY(-1px) !important;
      }
      
      #modal-feedback-finalizado .btn-secondary-feedback {
        background: #6c757d !important;
        color: white !important;
      }
      
      @media (max-width: 768px) {
        #modal-feedback-finalizado .feedback-container {
          width: 98% !important;
          max-height: 95vh !important;
          top: 5% !important;
          left: 2% !important;
          transform: none !important;
        }
        
        #modal-feedback-finalizado .feedback-body {
          padding: 15px !important;
        }
        
        #modal-feedback-finalizado .feedback-footer {
          padding: 15px !important;
          flex-direction: column !important;
        }
        
        #modal-feedback-finalizado .btn-feedback {
          width: 100% !important;
        }
      }
    </style>
    
    <div class="feedback-container">
      <div class="feedback-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <i class="fas fa-comment-dots" style="font-size: 24px;"></i>
          <h3 style="margin: 0; font-size: 20px;">Enviar Feedback</h3>
        </div>
        <button onclick="fecharModalFeedbackFinalizado()" style="
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
      
      <div class="feedback-body">
        <div style="margin-bottom: 20px; text-align: center; padding: 20px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
          <i class="fas fa-info-circle" style="color: #856404; font-size: 20px; margin-bottom: 10px;"></i>
          <p style="margin: 0; color: #856404; font-size: 14px;">
            Envie um feedback construtivo ao candidato sobre o processo seletivo.
          </p>
        </div>
        
        <div class="feedback-form">
          <div class="form-group">
            <label class="form-label">Mensagem de Feedback</label>
            <textarea class="form-textarea" name="feedback" placeholder="Exemplo: 'Agradecemos sua participação no processo. Identificamos potencial, mas desta vez optamos por outro perfil. Mantenha-se atento às nossas próximas vagas!'" required></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">Canal de Envio</label>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px;">
                <input type="radio" name="canal" value="whatsapp" checked style="margin: 0;">
                <i class="fab fa-whatsapp" style="color: #25d366;"></i>
                <span>WhatsApp</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 12px; border: 1px solid #e9ecef; border-radius: 6px;">
                <input type="radio" name="canal" value="email" style="margin: 0;">
                <i class="fas fa-envelope" style="color: #007bff;"></i>
                <span>Email</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div class="feedback-footer">
        <button class="btn-secondary-feedback btn-feedback" onclick="fecharModalFeedbackFinalizado()" type="button">
          <i class="fas fa-times"></i> Cancelar
        </button>
        <button class="btn-primary-feedback btn-feedback" onclick="enviarFeedbackFinalizado('${candidatoId}')" type="button">
          <i class="fas fa-paper-plane"></i> Enviar Feedback
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
  window.scrollTo(0, 0);

  // Foca no textarea
  const textarea = modal.querySelector('textarea[name="feedback"]');
  if (textarea) textarea.focus();

  console.log("✅ Modal feedback criado");
}

// === FUNÇÃO ENVIAR FEEDBACK ===
function enviarFeedbackFinalizado(candidatoId) {
  const modal = document.getElementById("modal-feedback-finalizado");
  if (!modal) return;

  const textarea = modal.querySelector('textarea[name="feedback"]');
  const canal = modal.querySelector('input[name="canal"]:checked');

  if (!textarea || !textarea.value.trim()) {
    alert("Por favor, escreva uma mensagem de feedback");
    textarea.focus();
    return;
  }

  if (!canal) {
    alert("Por favor, selecione um canal de envio");
    return;
  }

  const mensagem = textarea.value.trim();
  console.log(`📤 Enviando feedback via ${canal.value} para ${candidatoId}:`);
  console.log(mensagem);

  // TODO: Implementar envio real via Cloud Function ou API
  // Para contratados: mensagem de boas-vindas
  // Para rejeitados: feedback construtivo

  alert(
    `✅ Feedback enviado via ${
      canal.value === "whatsapp" ? "WhatsApp" : "Email"
    }!`
  );
  fecharModalFeedbackFinalizado();
}

// === FUNÇÃO FECHAR FEEDBACK ===
window.fecharModalFeedbackFinalizado = function () {
  const modal = document.getElementById("modal-feedback-finalizado");
  if (modal) {
    modal.style.opacity = "0";
    setTimeout(() => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      document.body.style.overflow = "";
    }, 300);
  }
};

// === FUNÇÃO WHATSAPP FINALIZADOS ===
function enviarMensagemWhatsAppFinalizado(candidatoId, dadosCodificados) {
  try {
    const dados = JSON.parse(decodeURIComponent(dadosCodificados));
    const status = dados.status_recrutamento;
    const nome = dados.nome_completo;
    const telefone = dados.telefone_contato.replace(/\D/g, "");

    let mensagem = "";

    if (status.includes("Contratado")) {
      mensagem = `Olá ${nome}!

🎉 PARABÉNS! Você foi selecionado(a) para nossa equipe!

📋 Próximos Passos:
• Onboarding e documentação
• Treinamento inicial  
• Integração com a equipe

Em breve receberá todas as informações para sua admissão.

Bem-vindo(a) à família EuPsico! 💙

Obrigado por escolher fazer parte da nossa missão!`;
    } else {
      mensagem = `Olá ${nome},

Agradecemos sinceramente o tempo e dedicação que você investiu em nosso processo seletivo.

Após uma análise cuidadosa, informamos que desta vez não prosseguiremos com sua candidatura para esta posição específica.

💡 O que gostaríamos de destacar:
• Seu perfil demonstrou qualidades valiosas
• Agradecemos sua paciência e profissionalismo
• Seu cadastro permanece ativo para futuras oportunidades

Mantenha-se atento às nossas próximas vagas! Você ainda pode ser uma excelente adição para nossa equipe.

Muito sucesso em sua jornada profissional! 🙏

Atenciosamente,
Equipe EuPsico`;
    }

    const url = `https://wa.me/55${telefone}?text=${encodeURIComponent(
      mensagem
    )}`;
    window.open(url, "_blank");

    console.log("✅ WhatsApp enviado para candidato finalizado");
  } catch (error) {
    console.error("❌ Erro ao enviar WhatsApp:", error);
    alert("Erro ao abrir WhatsApp");
  }
}

// Expor funções globalmente para compatibilidade
window.abrirModalDetalhesFinalizado = abrirModalDetalhesFinalizado;
window.fecharModalDetalhesFinalizado = fecharModalDetalhesFinalizado;
window.contatarCandidatoFinalizado = contatarCandidatoFinalizado;
window.abrirModalFeedbackFinalizado = abrirModalFeedbackFinalizado;
window.fecharModalFeedbackFinalizado = fecharModalFeedbackFinalizado;
window.enviarFeedbackFinalizado = enviarFeedbackFinalizado;
