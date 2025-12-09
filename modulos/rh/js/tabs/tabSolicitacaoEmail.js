// modulos/rh/js/tabs/tabSolicitacaoEmail.js

// VERSÃO 2.4 - CORRIGIDO: Campos ajustados para corresponder ao Firebase

import { getGlobalState } from "../admissao.js";

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
  httpsCallable,
  functions,
  getDoc,
} from "../../../../assets/js/firebase-init.js";

/**
 * Busca as listas de profissões e departamentos no Firestore
 */
async function carregarListasConfig() {
  console.log("🔹 Admissão: Carregando listas de configurações...");
  try {
    const configRef = doc(db, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);

    if (docSnap.exists() && docSnap.data().listas) {
      const listas = docSnap.data().listas;
      console.log("✅ Listas carregadas:", listas);
      return {
        profissoes: listas.profissoes || [],
        departamentos: listas.departamentos || [],
      };
    } else {
      console.warn("⚠️ Documento de configurações ou listas não encontrado.");
      return { profissoes: [], departamentos: [] };
    }
  } catch (error) {
    console.error("❌ Erro ao carregar listas de configurações:", error);
    window.showToast?.(
      "Erro ao carregar listas de cargos/departamentos.",
      "error"
    );
    return { profissoes: [], departamentos: [] };
  }
}

/**
 * Gera o HTML de <option> para um <select>
 */
function gerarOptionsHTML(lista, valorPadrao = null) {
  let html = '<option value="">Selecione...</option>';
  let padraoEncontrado = false;

  if (lista && lista.length > 0) {
    lista.forEach((item) => {
      const isSelected = item === valorPadrao;
      if (isSelected) padraoEncontrado = true;
      html += `<option value="${item}" ${
        isSelected ? "selected" : ""
      }>${item}</option>`;
    });
  }

  if (valorPadrao && !padraoEncontrado) {
    html += `<option value="${valorPadrao}" selected>${valorPadrao} (da Vaga)</option>`;
  }

  return html;
}

/**
 * Renderiza a listagem de candidatos para Solicitação de E-mail.
 * ✅ CORRIGIDO: Campos ajustados para corresponder ao Firebase
 */
export async function renderizarSolicitacaoEmail(state) {
  const { conteudoAdmissao, candidatosCollection, statusAdmissaoTabs } = state;

  conteudoAdmissao.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i> Carregando candidatos para Admissão...
    </div>
  `;

  try {
    const q = query(
      candidatosCollection,
      where("status_recrutamento", "==", "ADMISSAO_INICIADA")
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
      <div class="description-box" style="margin-top: 15px">
        <p>Os candidatos abaixo foram aprovados no Recrutamento. O primeiro passo é solicitar a criação do e-mail corporativo.</p>
      </div>
      <div class="candidatos-container candidatos-grid">
    `;

    snapshot.docs.forEach((doc) => {
      const cand = doc.data();
      const candidaturaId = doc.id;

      // ✅ CORRIGIDO: Usar campos corretos do Firebase
      const vagaTitulo = cand.titulo_vaga_original || "Vaga não informada";
      const statusAtual = cand.status_recrutamento || "N/A";
      const statusClass = "status-warning";

      const dadosCandidato = {
        id: candidaturaId,
        nome_candidato: cand.nome_candidato, // ✅ CORRIGIDO
        email_pessoal: cand.email_candidato,
        telefone_contato: cand.telefone_contato,
        status_recrutamento: statusAtual,
        vaga_titulo: vagaTitulo,
        gestor_aprovador: cand.avaliacao_gestor?.avaliador || "N/A",
        cargo_final: cand.admissaoinfo?.cargo_final || vagaTitulo, // ✅ CORRIGIDO: admissaoinfo
      };

      const dadosJSON = JSON.stringify(dadosCandidato);
      const dadosCodificados = encodeURIComponent(dadosJSON);

      listaHtml += `
        <div class="card card-candidato-gestor" data-id="${candidaturaId}">
          <div class="info-primaria">
            <h4 class="nome-candidato">
              ${cand.nome_candidato || "Candidato Sem Nome"}
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
            <button 
              class="action-button primary btn-solicitar-email" 
              data-id="${candidaturaId}" 
              data-dados="${dadosCodificados}"
              style="padding: 10px 16px; background: var(--cor-primaria); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
              <i class="fas fa-envelope-open-text"></i> Solicitar E-mail
            </button>
            <button 
              class="action-button secondary btn-ver-detalhes-admissao" 
              data-id="${candidaturaId}" 
              data-dados="${dadosCodificados}"
              style="padding: 10px 16px; border: 1px solid var(--cor-secundaria); background: transparent; color: var(--cor-secundaria); border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 100px;">
              <i class="fas fa-eye"></i> Detalhes
            </button>
            <button 
              class="action-button danger btn-reprovar-admissao" 
              data-id="${candidaturaId}" 
              data-dados="${dadosCodificados}"
              style="padding: 10px 16px; background: var(--cor-erro); color: white; border: none; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 140px;">
              <i class="fas fa-times-circle"></i> Reprovar Admissão
            </button>
          </div>
        </div>
      `;
    });

    listaHtml += `</div>`;
    conteudoAdmissao.innerHTML = listaHtml;

    console.log("🔗 Admissão(Email): Anexando event listeners...");

    // Botão Solicitar E-mail
    document.querySelectorAll(".btn-solicitar-email").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");
        abrirModalSolicitarEmail(candidatoId, dadosCodificados, state);
      });
    });

    // Botão Detalhes
    document.querySelectorAll(".btn-ver-detalhes-admissao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");

        if (typeof window.abrirModalCandidato === "function") {
          try {
            const dadosCandidato = JSON.parse(
              decodeURIComponent(dadosCodificados)
            );
            window.abrirModalCandidato(candidatoId, "detalhes", dadosCandidato);
          } catch (error) {
            console.error("❌ Erro ao abrir modal de detalhes:", error);
          }
        } else {
          console.warn("⚠️ Função window.abrirModalCandidato não encontrada.");
        }
      });
    });

    // Botão Reprovar Admissão
    document.querySelectorAll(".btn-reprovar-admissao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const candidatoId = btn.getAttribute("data-id");
        const dadosCodificados = btn.getAttribute("data-dados");
        const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));
        abrirModalReprovarAdmissao(candidatoId, dadosCandidato, state);
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
 * Salva a solicitação de e-mail
 * VERSÃO 3.4 - CORRIGIDO: Campos ajustados para Firebase
 */
async function salvarSolicitacaoEmail(
  candidatoId,
  nomeCandidato,
  currentUserData,
  state
) {
  console.log("📧 ===== INICIANDO SALVAMENTO DE SOLICITAÇÃO DE E-MAIL =====");

  const { candidatosCollection } = state;
  const formId = `form-solicitar-email-${candidatoId}`;
  const form = document.getElementById(formId);
  const btnSalvar = document.getElementById("btn-salvar-solicitacao");

  if (!form || !btnSalvar) {
    console.error("❌ Formulário ou botão não encontrado");
    window.showToast?.(
      "❌ Erro: Elementos do formulário não encontrados.",
      "error"
    );
    return;
  }

  // Extrair valores do formulário
  const cargo = form.querySelector("#solicitar-cargo").value;
  const departamento = form.querySelector("#solicitar-departamento").value;
  const emailSugerido = form.querySelector("#solicitar-email-sugerido").value;

  // Validações
  if (!cargo || !departamento || !emailSugerido) {
    window.showToast?.("⚠️ Por favor, preencha todos os campos.", "warning");
    return;
  }

  if (!emailSugerido.includes("eupsico")) {
    window.showToast?.(
      "❌ O e-mail sugerido deve ser um domínio eupsico",
      "error"
    );
    return;
  }

  // Desabilitar botão
  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Solicitando...';

  try {
    let emailCriadoComSucesso = false;
    let logAcao = "";
    const novoStatus = "CADASTRO_PENDENTE";
    const solicitanteId = currentUserData?.uid || "rhadmin-fallback-uid";
    const solicitanteNome =
      currentUserData?.nome || currentUserData?.email || "Usuário RH";

    let senhaTemporaria = null;

    // ⭐ TENTAR CRIAR E-MAIL VIA CLOUD FUNCTION
    try {
      console.log("🔄 Iniciando chamada para Cloud Function...");
      console.log("📨 E-mail:", emailSugerido);
      console.log("👤 Nome:", nomeCandidato);
      console.log("🎯 Cargo:", cargo);
      console.log("🏢 Departamento:", departamento);

      const criarEmailGoogleWorkspace = httpsCallable(
        functions,
        "criarEmailGoogleWorkspace"
      );

      console.log("✅ httpsCallable criado, enviando requisição...");

      // 🔧 CORREÇÃO: Tratamento adequado do nome
      const partesNome = nomeCandidato.trim().split(" ");
      const primeiroNome = partesNome[0] || "";
      const sobrenome =
        partesNome.length > 1 ? partesNome.slice(1).join(" ") : partesNome[0];

      // Validação adicional
      if (!primeiroNome || !sobrenome) {
        throw new Error(
          "Nome inválido: é necessário fornecer nome e sobrenome."
        );
      }

      // Chamar a Cloud Function
      const resultado = await criarEmailGoogleWorkspace({
        primeiroNome: primeiroNome,
        sobrenome: sobrenome,
        email: emailSugerido,
      });

      console.log("✅ Resposta recebida da API:", resultado.data);

      // Verificar sucesso
      if (resultado.data && resultado.data.sucesso === true) {
        emailCriadoComSucesso = true;
        senhaTemporaria = resultado.data.senhaTemporaria;
        logAcao = `✅ E-mail ${emailSugerido} criado com sucesso no Google Workspace. Senha: ${senhaTemporaria}`;
        window.showToast?.("✅ E-mail criado com sucesso!", "success");
        console.log("🎉 E-MAIL CRIADO COM SUCESSO!");
        console.log("Senha:", senhaTemporaria);
      } else {
        throw new Error(resultado.data?.mensagem || "API falhou");
      }
    } catch (apiError) {
      console.error("❌ Erro ao criar e-mail:", apiError);
      window.showToast?.(
        "⚠️ Falha na API. Criando solicitação interna para o TI.",
        "warning"
      );

      // FALLBACK: Criar solicitação para TI
      const solicitacoesTiRef = collection(db, "solicitacoes_ti");
      await addDoc(solicitacoesTiRef, {
        tipo: "criacao_email_novo_colaborador",
        nome_colaborador: nomeCandidato,
        cargo: cargo,
        departamento: departamento,
        email_sugerido: emailSugerido,
        status: "pendente",
        data_solicitacao: new Date(),
        solicitante_id: solicitanteId,
        solicitante_nome: solicitanteNome,
        candidatura_id: candidatoId,
        erro_api: apiError.message || "Erro sem detalhes",
      });

      logAcao = `⚠️ Falha na API (${(apiError.message || "").substring(
        0,
        50
      )}...). Solicitação de e-mail ${emailSugerido} enviada ao TI.`;
      emailCriadoComSucesso = false;
    }

    // ✅ ATUALIZAR CANDIDATURA NO FIRESTORE
    // ✅ CORRIGIDO: Usar campo admissaoinfo (sem underscore)
    const candidatoRef = doc(candidatosCollection, candidatoId);
    await updateDoc(candidatoRef, {
      status_recrutamento: novoStatus,
      historico: arrayUnion({
        data: new Date(),
        acao: logAcao,
        usuario: solicitanteId,
      }),
      admissaoinfo: {
        // ✅ CORRIGIDO: sem underscore
        cargo_final: cargo,
        departamento: departamento,
        email_solicitado: emailSugerido,
        email_criado_via_api: emailCriadoComSucesso,
        data_solicitacao_email: new Date(),
        senha_temporaria: senhaTemporaria,
      },
    });

    console.log(`✅ Candidatura atualizada para: ${novoStatus}`);
    window.showToast?.(
      "✅ Processo de e-mail iniciado com sucesso!",
      "success"
    );
  } catch (error) {
    console.error("❌ Erro geral ao salvar solicitação:", error);
    window.showToast?.(`❌ Erro ao salvar: ${error.message}`, "error");
  } finally {
    // Reabilitar botão
    btnSalvar.disabled = false;
    btnSalvar.innerHTML =
      '<i class="fas fa-paper-plane"></i> Salvar e Solicitar';

    // Fechar modal e recarregar
    fecharModalSolicitarEmail();

    // Opcionalmente, recarregar a lista depois
    setTimeout(() => {
      if (typeof renderizarSolicitacaoEmail === "function") {
        renderizarSolicitacaoEmail(state);
      }
    }, 500);
  }
}

/**
 * Abre o modal para solicitar a criação de e-mail
 * ✅ CORRIGIDO: Campo nome_candidato (era nome_completo)
 */
async function abrirModalSolicitarEmail(candidatoId, dadosCodificados, state) {
  console.log("🎯 Abrindo modal de solicitação de e-mail");

  const { currentUserData } = state;

  // Mostra um spinner simples enquanto carrega as listas
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div id="modal-temp-loader" class="modal-overlay is-visible"><div class="loading-spinner"></div></div>'
  );

  const { profissoes, departamentos } = await carregarListasConfig();

  const tempLoader = document.getElementById("modal-temp-loader");
  if (tempLoader) tempLoader.remove();

  try {
    const dadosCandidato = JSON.parse(decodeURIComponent(dadosCodificados));

    const modalExistente = document.getElementById("modal-solicitar-email");
    if (modalExistente) {
      modalExistente.remove();
    }

    // ✅ CORRIGIDO: Validação e tratamento do nome
    const nomeCompleto = dadosCandidato.nome_candidato || ""; // ✅ CORRIGIDO

    if (!nomeCompleto || nomeCompleto.trim() === "") {
      window.showToast?.("❌ Nome do candidato não encontrado.", "error");
      console.error("❌ dadosCandidato.nome_candidato está vazio ou undefined");
      return;
    }

    const nomeLimpo = nomeCompleto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z\s]/g, "")
      .split(" ");

    const primeiroNome = nomeLimpo[0] || "nome";
    const ultimoNome =
      nomeLimpo.length > 1 ? nomeLimpo[nomeLimpo.length - 1] : "sobrenome";

    const sugestaoEmail = `${primeiroNome}.${ultimoNome}@eupsico.org.br`;

    const profissoesOptions = gerarOptionsHTML(
      profissoes,
      dadosCandidato.cargo_final
    );
    const departamentosOptions = gerarOptionsHTML(departamentos, null);

    const modal = document.createElement("div");
    modal.id = "modal-solicitar-email";
    modal.className = "modal-overlay is-visible";

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px">
        <div class="modal-header">
          <h3 class="modal-title-text"><i class="fas fa-envelope-open-text me-2"></i> Solicitar E-mail Corporativo</h3>
          <button type="button" class="close-modal-btn" data-modal-id="modal-solicitar-email" aria-label="Fechar modal">&times;</button>
        </div>
        <div class="modal-body">
          <form id="form-solicitar-email-${candidatoId}">
            <div class="form-group">
              <label class="form-label" for="solicitar-nome">Nome Completo</label>
              <input type="text" id="solicitar-nome" class="form-control" value="${nomeCompleto}" readonly />
            </div>
            <div class="form-group">
              <label class="form-label" for="solicitar-cargo">Cargo / Função</label>
              <select id="solicitar-cargo" class="form-control" required>
                ${profissoesOptions}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="solicitar-departamento">Departamento</label>
              <select id="solicitar-departamento" class="form-control" required>
                ${departamentosOptions}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="solicitar-email-sugerido">E-mail Sugerido</label>
              <input type="email" id="solicitar-email-sugerido" class="form-control" value="${sugestaoEmail}" required />
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
    document.body.style.overflow = "hidden";

    const btnSalvar = document.getElementById("btn-salvar-solicitacao");
    btnSalvar.addEventListener("click", () => {
      salvarSolicitacaoEmail(
        candidatoId,
        nomeCompleto, // ✅ CORRIGIDO
        currentUserData,
        state
      );
    });

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
    modal.classList.remove("is-visible");
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 300);
  }
  document.body.style.overflow = "";
}

// ============================================
// MODAL DE REPROVAÇÃO (CORRIGIDO)
// ============================================

/**
 * Abre o modal para Reprovar a Admissão
 * ✅ CORRIGIDO: Campo nome_candidato (era nome_completo)
 */
function abrirModalReprovarAdmissao(candidatoId, dadosCandidato, state) {
  console.log(`🎯 Abrindo modal de REPROVAÇÃO para ${candidatoId}`);

  const modalExistente = document.getElementById("modal-reprovar-admissao");
  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement("div");
  modal.id = "modal-reprovar-admissao";
  modal.dataset.candidaturaId = candidatoId;
  modal.className = "modal-overlay is-visible";

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px">
      <div class="modal-header" style="background-color: var(--cor-erro-dark, #dc3545); color: white">
        <h3 class="modal-title-text"><i class="fas fa-times-circle me-2"></i> Reprovar Candidato na Admissão</h3>
        <button type="button" class="close-modal-btn" data-modal-id="modal-reprovar-admissao" aria-label="Fechar modal">&times;</button>
      </div>
      <div class="modal-body">
        <p>Você está prestes a reprovar <strong>${dadosCandidato.nome_candidato}</strong> no processo de admissão.</p>
        <form id="form-reprovar-admissao-${candidatoId}">
          <div class="form-group">
            <label class="form-label" for="reprovar-justificativa">Justificativa (Obrigatório)</label>
            <textarea id="reprovar-justificativa" class="form-control" rows="4" placeholder="Descreva o motivo da reprovação (Ex: Desistência do candidato, falha na entrega de documentos, etc.)" required></textarea>
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
  document.body.style.overflow = "hidden";

  const btnSalvar = document.getElementById("btn-salvar-reprovacao");
  btnSalvar.addEventListener("click", () => {
    submeterReprovacaoAdmissao(candidatoId, state);
  });

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
        usuario: currentUserData.uid || "rh_admin_fallback_uid",
      }),
    });

    window.showToast?.("Candidato reprovado com sucesso.", "success");
    fecharModalReprovarAdmissao();
    renderizarSolicitacaoEmail(state);
  } catch (error) {
    console.error("❌ Erro ao reprovar candidato:", error);
    window.showToast?.(`Erro ao reprovar: ${error.message}`, "error");
    btnSalvar.disabled = false;
    btnSalvar.innerHTML =
      '<i class="fas fa-check-circle"></i> Confirmar Reprovação';
  }
}
