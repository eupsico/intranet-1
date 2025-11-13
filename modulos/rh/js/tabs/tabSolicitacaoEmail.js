// modulos/rh/js/tabs/tabSolicitacaoEmail.js
// VERSÃO 2.1 - Corrigido CSS dos Modais e Erro de Escopo

import { getGlobalState } from "../admissao.js"; // Importa do novo módulo
import {
  db,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  setDoc,
  addDoc,
  collection,
  arrayUnion,
  httpsCallable, // Importa HttpsCallable
  functions, // Importa a instância das Functions
} from "../../../../assets/js/firebase-init.js";

/**
 * Renderiza a listagem de candidatos para Solicitação de E-mail.
 */
export async function renderizarSolicitacaoEmail(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state; // O 'state' completo é passado aqui

  conteudoAdmissao.innerHTML = `
  <div class="loading-spinner">
   <i class="fas fa-spinner fa-spin"></i> Carregando candidatos para Admissão...
  </div>
 `;

  try {
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "==", "AGUARDANDO_ADMISSAO")
    );

    const snapshot = await getDocs(q);

    const tab = statusAdmissaoTabs.querySelector(
      '.tab-link[data-status="solicitacao-email"]'
    );
    if (tab) {
      tab.innerHTML = `<i class="fas fa-envelope-open-text me-2"></i> 1. Solicitação de E-mail (${snapshot.size})`;
    }

    if (snapshot.empty) {
      conteudoAdmissao.innerHTML = `
    <div class="alert alert-info">
     <p><i class="fas fa-check-circle"></i> Nenhum candidato aguardando o início do processo de admissão.</p>
    </div>
   `;
      return;
    }

    let listaHtml = `
  	<div class="description-box" style="margin-top: 15px;">
   	<p>Os candidatos abaixo foram aprovados no Recrutamento. O primeiro passo é solicitar a criação do e-mail corporativo.</p>
  	</div>
   <div class="candidatos-container candidatos-grid">
  `;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const candidaturaId = doc.id;
      const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada";
      const statusAtual = cand.status_recrutamento || "N/A";

      const statusClass = "status-warning";

      const dadosCandidato = {
        id: candidaturaId,
        nome_completo: cand.nome_completo,
        email_pessoal: cand.email_candidato,
        telefone_contato: cand.telefone_contato,
        status_recrutamento: statusAtual,
        vaga_titulo: vagaTitulo,
        gestor_aprovador: cand.avaliacao_gestor?.avaliador || "N/A",
        cargo_final: cand.admissao_info?.cargo_final || vagaTitulo,
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
       <i class="fas fa-briefcase"></i> Vaga Aprovada: ${vagaTitulo}
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
      <button class="action-button primary btn-solicitar-email" 
          data-id="${candidaturaId}"
          data-dados="${dadosCodificados}"
          style="padding: 10px 16px; background: var(--cor-primaria); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
       <i class="fas fa-envelope-open-text"></i> Solicitar E-mail
      </button>
      
      <button class="action-button secondary btn-ver-detalhes-admissao" 
          data-id="${candidaturaId}"
          data-dados="${dadosCodificados}"
          style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 100px;">
       <i class="fas fa-eye"></i> Detalhes
      </button>
      
            <button class="action-button danger btn-reprovar-admissao" 
          data-id="${candidaturaId}"
       		data-dados="${dadosCodificados}"
          style="padding: 10px 16px; background: var(--cor-erro); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
       <i class="fas fa-times-circle"></i> Reprovar Admissão
      </button>
     </div>
    </div>
   `;
    });

    listaHtml += `
   </div>
  `;

    conteudoAdmissao.innerHTML = listaHtml; // === EVENT LISTENERS (CORRIGIDOS) ===

    console.log("🔗 Admissão(Email): Anexando event listeners..."); // Botão Solicitar E-mail

    document.querySelectorAll(".btn-solicitar-email").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("🎯 Clique no botão Solicitar E-mail");
        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados"); // CORREÇÃO: Passa o 'state' inteiro para ter acesso ao currentUserData
        abrirModalSolicitarEmail(candidatoId, dadosCodificados, state);
      });
    }); // Botão Detalhes (agora funciona)

    document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("👁️ Clique no botão Detalhes");
        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");
        if (typeof window.abrirModalCandidato === "function") {
          try {
            const dadosCandidato = JSON.parse(
              decodeURIComponent(dadosCodificados)
            ); // Usa a função global adicionada ao admissao.js
            window.abrirModalCandidato(candidatoId, "detalhes", dadosCandidato);
          } catch (error) {
            console.error("❌ Erro ao abrir modal de detalhes:", error);
          }
        } else {
          console.warn(
            "⚠️ Função window.abrirModalCandidato não encontrada. Adicione-a ao admissao.js"
          );
          alert("Erro ao carregar detalhes. Função não encontrada.");
        }
      });
    }); // Botão Reprovar Admissão (chama o novo modal)

    document.querySelectorAll(".btn-reprovar-admissao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");
        const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
        abrirModalReprovarAdmissao(candidatoId, dadosCandidato, state); // Passa o state
      });
    });
  } catch (error) {
    console.error("❌ Admissão(Email): Erro ao carregar:", error);
    conteudoAdmissao.innerHTML = `
   <div class="alert alert-danger">
    <p><i class="fas fa-exclamation-circle"></i> Erro: ${error.message}</p>
   </div>
  `;
  }
}

/**
 * Abre o modal para solicitar a criação de e-mail
 * CORREÇÃO: Usa classes CSS 'modal-overlay' e 'modal-content'
 */
function abrirModalSolicitarEmail(candidatoId, dadosCodificados, state) {
  console.log("🎯 Abrindo modal de solicitação de e-mail");
  const { currentUserData } = state; // Pega o usuário do state

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    const modalExistente = document.getElementById("modal-solicitar-email");
    if (modalExistente) {
      modalExistente.remove();
    }

    const nomeLimpo = dadosCandidato.nome_completo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z\s]/g, "")
      .split(" ");
    const primeiroNome = nomeLimpo[0] || "nome";
    const ultimoNome =
      nomeLimpo.length > 1 ? nomeLimpo[nomeLimpo.length - 1] : "sobrenome";
    const sugestaoEmail = `${primeiroNome}.${ultimoNome}@eupsico.com.br`;

    const modal = document.createElement("div");
    modal.id = "modal-solicitar-email"; // --- CORREÇÃO DE CSS ---
    modal.className = "modal-overlay is-visible"; // Usa a classe existente e a torna visível // Não injeta mais <style>, usa a estrutura de modal padrão
    modal.innerHTML = `
  	<div class="modal-content" style="max-width: 600px;">
  		<div class="modal-header">
  			<h3 class="modal-title-text"><i class="fas fa-envelope-open-text me-2"></i> Solicitar E-mail Corporativo</h3>
  			<button type="button" class="close-modal-btn" data-modal-id="modal-solicitar-email" aria-label="Fechar modal">
  				&times;
  			</button>
  		</div>
  		<div class="modal-body">
  			<form id="form-solicitar-email-${candidatoId}">
  				<div class="form-group">
  					<label class="form-label" for="solicitar-nome">Nome Completo</label>
  					<input type="text" id="solicitar-nome" class="form-control" 
  						value="${dadosCandidato.nome_completo}" readonly>
  				</div>
  				<div class="form-group">
  					<label class="form-label" for="solicitar-cargo">Cargo / Função</label>
  					<input type="text" id="solicitar-cargo" class="form-control" 
  						value="${dadosCandidato.cargo_final}" required>
  				</div>
  				<div class="form-group">
  					<label class="form-label" for="solicitar-departamento">Departamento</label>
  					<select id="solicitar-departamento" class="form-control" required>
  						<option value="">Selecione...</option>
  						<option value="administrativo">Administrativo</option>
  						<option value="financeiro">Financeiro</option>
  						<option value="rh">Recursos Humanos</option>
  						<option value="servico-social">Serviço Social</option>
  						<option value="psicologo">Psicólogo(a)</option>
  						<option value="gestao">Gestão</option>
  						<option value="ti">TI</option>
  						<option value="outro">Outro</option>
  					</select>
  				</div>
  				<div class="form-group">
  					<label class="form-label" for="solicitar-email-sugerido">E-mail Sugerido</label>
  					<input type="email" id="solicitar-email-sugerido" class="form-control" 
  						value="${sugestaoEmail}" required>
  				</div>
  				<small class="form-text text-muted">
  					Ao salvar, o sistema tentará criar o e-mail via API. Se falhar, uma solicitação será aberta para o TI.
  				</small>
  			</form>
  		</div>
  		<div class="modal-footer">
  			<button type="button" class="action-button secondary" data-modal-id="modal-solicitar-email">
  				<i class="fas fa-times me-2"></i> Cancelar
  			</button>
  			<button type="button" class="action-button primary" id="btn-salvar-solicitacao">
  				<i class="fas fa-paper-plane me-2"></i> Salvar e Solicitar
  			</button>
  		</div>
  	</div>
  `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden"; // Adiciona listener programaticamente
    const btnSalvar = document.getElementById("btn-salvar-solicitacao");
    btnSalvar.addEventListener("click", () => {
      salvarSolicitacaoEmail(
        candidatoId,
        dadosCandidato.nome_completo,
        currentUserData,
        state
      );
    }); // Adiciona listeners de fechamento

    modal
      .querySelectorAll("[data-modal-id='modal-solicitar-email']")
      .forEach((btn) => {
        btn.addEventListener("click", fecharModalSolicitarEmail);
      });
  } catch (error) {
    console.error("❌ Erro ao criar modal de solicitação:", error);
    alert("Erro ao abrir modal de solicitação.");
  }
}

/**
 * Fecha o modal de solicitação de e-mail
 */
function fecharModalSolicitarEmail() {
  console.log("❌ Fechando modal de solicitação de e-mail");
  const modal = document.getElementById("modal-solicitar-email");
  if (modal) {
    modal.classList.remove("is-visible"); // Remove a visibilidade // Adiciona um pequeno delay para a animação de fade-out antes de remover
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 300); // 300ms (ajuste conforme seu CSS)
  }
  document.body.style.overflow = ""; // Restaura o scroll
}

/**
 * Salva a solicitação (TENTA API, depois fallback)
 */
async function salvarSolicitacaoEmail(
  candidatoId,
  nomeCandidato,
  currentUserData,
  state
) {
  console.log("💾 Salvando solicitação de e-mail");

  const formId = `form-solicitar-email-${candidatoId}`;
  const form = document.getElementById(formId);
  const btnSalvar = document.getElementById("btn-salvar-solicitacao");

  const cargo = form.querySelector("#solicitar-cargo").value;
  const departamento = form.querySelector("#solicitar-departamento").value;
  const emailSugerido = form.querySelector("#solicitar-email-sugerido").value; // Validações

  if (!cargo || !departamento || !emailSugerido) {
    window.showToast?.("Por favor, preencha todos os campos.", "warning");
    return;
  }
  if (!emailSugerido.includes("@eupsico.com.br")) {
    window.showToast?.(
      "O e-mail sugerido deve ser um domínio @eupsico.com.br",
      "error"
    );
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Solicitando...';

  try {
    let emailCriadoComSucesso = false;
    let logAcao = "";

    try {
      // Tenta chamar a Cloud Function (que você precisará criar)
      const criarEmailGoogleWorkspace = httpsCallable(
        functions,
        "criarEmailGoogleWorkspace"
      );
      const resultado = await criarEmailGoogleWorkspace({
        nome: nomeCandidato,
        email: emailSugerido,
        cargo: cargo,
        departamento: departamento,
      });
      if (resultado.data.sucesso) {
        emailCriadoComSucesso = true;
        logAcao = `E-mail ${emailSugerido} criado com sucesso via API.`;
        window.showToast?.(
          "E-mail criado com sucesso no Google Workspace!",
          "success"
        );
      } else {
        throw new Error(resultado.data.erro || "API do Google falhou.");
      }
    } catch (apiError) {
      console.warn(`⚠️ Falha ao criar e-mail via API: ${apiError.message}`);
      window.showToast?.(
        "Falha na API. Criando solicitação interna para o TI.",
        "warning"
      ); // LÓGICA DE FALLBACK (Solicitação para Admin)
      const solicitacoesTiRef = collection(db, "solicitacoes_ti");
      await addDoc(solicitacoesTiRef, {
        tipo: "criacao_email_novo_colaborador",
        nome_colaborador: nomeCandidato,
        cargo: cargo,
        departamento: departamento,
        email_sugerido: emailSugerido,
        status: "pendente",
        data_solicitacao: new Date(),
        solicitante_id: currentUserData.id || "rh_admin",
        solicitante_nome: currentUserData.nome || "Usuário RH",
        candidatura_id: candidatoId,
        erro_api: apiError.message,
      });
      logAcao = `Falha na API. Solicitação de e-mail (${emailSugerido}) enviada ao TI.`;
    } // Atualiza o status do candidato para a próxima etapa

    const candidatoRef = doc(db, "candidaturas", candidatoId);
    const novoStatus = "AGUARDANDO_CADASTRO";
    await updateDoc(candidatoRef, {
      status_recrutamento: novoStatus,
      historico: arrayUnion({
        data: new Date(),
        acao: logAcao,
        usuario: currentUserData.id || "rh_admin",
      }),
      admissao_info: {
        cargo_final: cargo,
        departamento: departamento,
        email_solicitado: emailSugerido,
        email_criado_via_api: emailCriadoComSucesso,
      },
    });

    console.log(
      `✅ Solicitação salva e status do candidato atualizado para ${novoStatus}`
    );
    fecharModalSolicitarEmail();
    renderizarSolicitacaoEmail(state); // Recarrega a aba
  } catch (error) {
    console.error("❌ Erro ao salvar solicitação de e-mail:", error);
    alert(`Erro ao salvar: ${error.message}`);
    btnSalvar.disabled = false;
    btnSalvar.innerHTML =
      '<i class="fas fa-paper-plane"></i> Salvar e Solicitar';
  }
}

// ============================================
// MODAL DE REPROVAÇÃO (NOVO)
// ============================================

/**
 * Abre o modal para Reprovar a Admissão
 */
function abrirModalReprovarAdmissao(candidatoId, dadosCandidato, state) {
  console.log(`🎯 Abrindo modal de REPROVAÇÃO para ${candidatoId}`);

  const modalExistente = document.getElementById("modal-reprovar-admissao");
  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement("div");
  modal.id = "modal-reprovar-admissao";
  modal.dataset.candidaturaId = candidatoId; // --- CORREÇÃO DE CSS ---
  modal.className = "modal-overlay is-visible";

  modal.innerHTML = `
 	<div class="modal-content" style="max-width: 600px;">
 		<div class="modal-header" style="background-color: var(--cor-erro-dark); color: white;">
 			<h3 class="modal-title-text"><i class="fas fa-times-circle me-2"></i> Reprovar Candidato na Admissão</h3>
 			<button type="button" class="close-modal-btn" data-modal-id="modal-reprovar-admissao" aria-label="Fechar modal">
 				&times;
 			</button>
 		</div>
 		<div class="modal-body">
 			<p>Você está prestes a reprovar <strong>${dadosCandidato.nome_completo}</strong> no processo de admissão.</p>
 			<form id="form-reprovar-admissao-${candidatoId}">
 				<div class="form-group">
 					<label class="form-label" for="reprovar-justificativa">Justificativa (Obrigatório)</label>
 					<textarea id="reprovar-justificativa" class="form-control" rows="4"
 						placeholder="Descreva o motivo da reprovação (Ex: Desistência do candidato, falha na entrega de documentos, etc.)"
 						required></textarea>
 				</div>
 			</form>
 		</div>
 		<div class="modal-footer">
 			<button type="button" class="action-button secondary" data-modal-id="modal-reprovar-admissao">
 				<i class="fas fa-times me-2"></i> Cancelar
 			</button>
 			<button type="button" class="action-button danger" id="btn-salvar-reprovacao">
 				<i class="fas fa-check-circle me-2"></i> Confirmar Reprovação
 			</button>
 		</div>
 	</div>
 `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden"; // Adiciona listener ao botão de salvar
  const btnSalvar = document.getElementById("btn-salvar-reprovacao");
  btnSalvar.addEventListener("click", () => {
    submeterReprovacaoAdmissao(candidatoId, state);
  }); // Adiciona listeners de fechamento

  modal
    .querySelectorAll("[data-modal-id='modal-reprovar-admissao']")
    .forEach((btn) => {
      btn.addEventListener("click", fecharModalReprovarAdmissao);
    });
}

/**
 * Fecha o modal de reprovação
 */
function fecharModalReprovarAdmissao() {
  console.log("❌ Fechando modal de reprovação");
  const modal = document.getElementById("modal-reprovar-admissao");
  if (modal) {
    modal.classList.remove("is-visible");
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 300);
  }
  document.body.style.overflow = "";
}

/**
 * Submete a reprovação (chamada pelo modal)
 * CORRIGIDO: Agora usa o state para recarregar a aba
 */
async function submeterReprovacaoAdmissao(candidatoId, state) {
  const { candidatosCollection, currentUserData } = state;
  const justificativaEl = document.getElementById("reprovar-justificativa");
  const justificativa = justificativaEl ? justificativaEl.value : null;

  if (!justificativa || justificativa.trim().length < 5) {
    window.showToast?.(
      "A justificativa é obrigatória (mín. 5 caracteres).",
      "warning"
    );
    return;
  }

  const btnSalvar = document.getElementById("btn-salvar-reprovacao");
  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reprovando...';

  try {
    const candidatoRef = doc(candidatosCollection, candidatoId);
    await updateDoc(candidatoRef, {
      status_recrutamento: "Reprovado (Admissão)",
      "rejeicao.etapa": `Admissão - Solicitação de E-mail`,
      "rejeicao.data": new Date(),
      "rejeicao.justificativa": justificativa,
      historico: arrayUnion({
        data: new Date(),
        acao: `Candidatura REJEITADA na ADMISSÃO. Motivo: ${justificativa}`,
        usuario: currentUserData.id || "rh_admin",
      }),
    });

    window.showToast?.("Candidato reprovado com sucesso.", "success");
    fecharModalReprovarAdmissao();
    renderizarSolicitacaoEmail(state); // Recarrega a aba
  } catch (error) {
    console.error("❌ Erro ao reprovar candidato:", error);
    window.showToast?.(`Erro ao reprovar: ${error.message}`, "error");
    btnSalvar.disabled = false;
    btnSalvar.innerHTML =
      '<i class="fas fa-check-circle"></i> Confirmar Reprovação';
  }
}
