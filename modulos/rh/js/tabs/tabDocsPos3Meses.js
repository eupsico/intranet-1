/**
 * Arquivo: modulos/rh/js/tabs/tabDocsPos3Meses.js
 * Versão: 4.1.0 (Correção: Status da Fase 2 + Detalhes + Lembrete)
 * Descrição: Gerencia a etapa final de envio de documentos pós-experiência (Fase 2).
 */

import { getGlobalState } from "../admissao.js";
import {
  getDocs,
  query,
  where,
  collection,
  db,
} from "../../../../assets/js/firebase-init.js";

const URL_INTRANET = "https://intranet.eupsico.org.br";

// ============================================
// RENDERIZAÇÃO DA LISTAGEM
// ============================================

export async function renderizarDocsPos3Meses(state) {
  const { conteudoAdmissao, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML =
    '<div class="loading-spinner">Carregando colaboradores aprovados...</div>';

  try {
    // Busca na coleção 'usuarios' pelos status da FASE 2
    const usuariosCollection = collection(db, "usuarios");
    const q = query(
      usuariosCollection,
      where("status_admissao", "in", [
        "ENVIAR_ASSINATURA_FASE2", // Status vindo da Avaliação 3 Meses
        "AGUARDANDO_ASSINATURA_FASE2", // Status após liberar docs
      ])
    );
    const snapshot = await getDocs(q);

    // Atualiza contagem na aba
    const tab = statusAdmissaoTabs.querySelector(
      '.tab-link[data-status="documentos-pos-3-meses"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-file-contract me-2"></i> 6. Documentos (Pós-3 Meses) (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML =
        '<p class="alert alert-info">Nenhum colaborador aguardando envio de documentos finais.</p>';
      return;
    }

    let listaHtml = `
      <div class="description-box" style="margin-top: 15px;">
        <p><strong>Fase 2 (Efetivação):</strong> Colaboradores aprovados na experiência. Envie os documentos finais (contrato de efetivação, novos termos) para assinatura na Intranet.</p>
      </div>
      <div class="candidatos-container candidatos-grid">
    `;

    snapshot.docs.forEach((docSnap) => {
      const user = docSnap.data();
      const userId = docSnap.id;
      const statusAtual = user.status_admissao || "N/A";

      let statusClass = "status-success";
      let botaoAcao = "";

      // ✅ LÓGICA DO BOTÃO PRINCIPAL (Fase 2)
      if (statusAtual === "AGUARDANDO_ASSINATURA_FASE2") {
        // Botão de Lembrete (WhatsApp) - Amarelo
        statusClass = "status-warning";
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
      } else if (statusAtual === "ENVIAR_ASSINATURA_FASE2") {
        // Botão para abrir o modal de envio - Verde/Azul
        botaoAcao = `
            <button 
                class="btn btn-sm btn-primary btn-enviar-docs-finais" 
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
                <i class="fas fa-file-signature me-1"></i> Enviar Docs Finais
            </button>`;
      } else {
        botaoAcao = `<span class="text-muted">Status: ${statusAtual}</span>`;
      }

      // ✅ MAPEAMENTO DE DADOS PARA O MODAL DE DETALHES
      const dadosParaModal = {
        id: userId,
        // Chaves esperadas pelo modal global
        nome_candidato: user.nome || "Usuário Sem Nome",
        email_candidato: user.email || "Sem e-mail",
        telefone_contato: user.contato || user.telefone || "",
        titulo_vaga_original: user.profissao || "Cargo não informado",
        status_recrutamento: statusAtual,

        // Chave extra
        email_novo: user.email,
      };

      const dadosCodificados = encodeURIComponent(
        JSON.stringify(dadosParaModal)
      );

      // Objeto para exibição no card
      const dadosExibicao = {
        nome: user.nome || "Usuário Sem Nome",
        email: user.email || "...",
        cargo: user.profissao || "Não informado",
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
          <p class="small-info">
           <i class="fas fa-briefcase"></i> Cargo: ${dadosExibicao.cargo}
          </p>
          <p class="small-info" style="color: var(--cor-primaria);">
           <i class="fas fa-envelope"></i> Email: ${dadosExibicao.email}
          </p>
         </div>
         
         <div class="acoes-candidato">
           ${botaoAcao}
           
           <button 
             class="btn btn-sm btn-secondary btn-ver-detalhes-pos3meses" 
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

    // 1. Botão Enviar Docs Finais
    document.querySelectorAll(".btn-enviar-docs-finais").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dados = e.currentTarget.getAttribute("data-dados");

        // Chama a função global definida em tabAssinaturaDocs.js
        // Parâmetro '2' indica FASE 2
        if (typeof window.abrirModalEnviarDocumentos === "function") {
          window.abrirModalEnviarDocumentos(userId, dados, state, 2);
        } else {
          console.error(
            "Função window.abrirModalEnviarDocumentos não encontrada."
          );
          alert(
            "Erro: O módulo de assinatura de documentos (tabAssinaturaDocs) não foi carregado."
          );
        }
      });
    });

    // 2. Botão Lembrar Assinatura
    document.querySelectorAll(".btn-lembrar-assinatura").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const dados = JSON.parse(
          decodeURIComponent(e.currentTarget.getAttribute("data-dados"))
        );
        enviarLembreteAssinaturaFase2(dados);
      });
    });

    // 3. Botão Detalhes
    document.querySelectorAll(".btn-ver-detalhes-pos3meses").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.getAttribute("data-id");
        const dadosCodificados = e.currentTarget.getAttribute("data-dados");
        if (typeof window.abrirModalCandidato === "function") {
          try {
            const dadosCandidato = JSON.parse(
              decodeURIComponent(dadosCodificados)
            );
            window.abrirModalCandidato(userId, "detalhes", dadosCandidato);
          } catch (err) {
            console.error("Erro ao abrir detalhes:", err);
          }
        }
      });
    });
  } catch (error) {
    console.error("Erro ao renderizar aba Docs Pós 3 Meses:", error);
    conteudoAdmissao.innerHTML = `<p class="alert alert-danger">Erro ao carregar: ${error.message}</p>`;
  }
}

// ============================================
// FUNÇÃO DE LEMBRETE (Fase 2)
// ============================================
function enviarLembreteAssinaturaFase2(dados) {
  const nome = dados.nome ? dados.nome.split(" ")[0] : "Colaborador";
  const telefone = dados.telefone ? dados.telefone.replace(/\D/g, "") : "";

  if (!telefone) {
    alert("Telefone não encontrado para este usuário.");
    return;
  }

  const msg = `Olá ${nome}, tudo bem? 👋\n\nPassando para lembrar que os documentos da sua *Efetivação* já estão disponíveis na Intranet! 📄✍️\n\nPara assinar:\n1️⃣ Acesse: ${URL_INTRANET}\n2️⃣ Vá no menu *Portal do Voluntário > Assinaturas e Termos*\n3️⃣ Leia e assine digitalmente.\n\nContamos com você!`;

  const link = `https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(
    msg
  )}`;
  window.open(link, "_blank");
}
