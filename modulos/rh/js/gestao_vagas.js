// modulos/rh/js/gestao_vagas.js
import {
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  getDoc,
  arrayUnion,
} from "../../../assets/js/firebase-init.js";

import { fetchUsersByRole } from "../../../assets/js/utils/user-management.js";
import { arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// =====================================================================
// CONSTANTES GLOBAIS E ELEMENTOS DO DOM (MODULARIZADOS)
// =====================================================================

const VAGAS_COLLECTION_NAME = "vagas";
const CONFIG_COLLECTION_NAME = "configuracoesSistema";

// IDs dos modais auxiliares
const ID_MODAL_FICHA_TECNICA = "modal-vaga";
const ID_MODAL_CRIACAO_ARTE = "modal-criacao-arte";
const ID_MODAL_APROVACAO_ARTE = "modal-aprovacao-arte";
const ID_MODAL_DIVULGACAO = "modal-divulgacao";
const ID_MODAL_FECHADAS = "modal-fechadas";

const ID_MODAL_REJEICAO = "modal-rejeicao-ficha"; // Criado dinamicamente no JS
const ID_MODAL_SOLICITAR_FICHA = "modal-solicitar-ficha";
const ID_MODAL_SOLICITAR_ARTE = "modal-solicitar-arte";
const ID_MODAL_REAPROVEITAR = "modal-reaproveitar-vaga";

const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);

// Elementos DOM (Acessando containers modais)
const modalFicha = document.getElementById(ID_MODAL_FICHA_TECNICA);
const formVaga = document.getElementById("form-vaga");
const modalTitle = modalFicha ? modalFicha.querySelector("h3") : null;
const btnSalvar = document.getElementById("btn-salvar-vaga");

const modalCriacaoArte = document.getElementById(ID_MODAL_CRIACAO_ARTE);
const modalAprovacaoArte = document.getElementById(ID_MODAL_APROVACAO_ARTE);
const modalDivulgacao = document.getElementById(ID_MODAL_DIVULGACAO);
const modalFechadas = document.getElementById(ID_MODAL_FECHADAS);

// Forms aninhados
const formCriacaoArte = modalCriacaoArte
  ? modalCriacaoArte.querySelector("#form-criacao-arte")
  : null;
const formDivulgacao = modalDivulgacao
  ? modalDivulgacao.querySelector("#form-divulgacao")
  : null;

let currentUserData = {};

// =====================================================================
// FUNÇÕES AUXILIARES
// =====================================================================

/**
 * Gera um resumo da vaga usando os dados principais da Ficha Técnica (para a arte).
 */
function gerarResumoVaga(vaga) {
  let resumo = `Vaga: ${vaga.nome || "Não Informado"}\n`;
  resumo += `Departamento: ${vaga.departamento || "Não Informado"}\n`;
  resumo += `Regime: ${vaga.regimeTrabalho || "Não Informado"} | Modalidade: ${
    vaga.modalidadeTrabalho || "Não Informado"
  }\n`;
  resumo += `Salário: ${vaga.valorSalario || "A Combinar"}\n\n`;
  resumo += `Principais Atividades: ${
    vaga.cargo?.responsabilidades || "N/A"
  }\n\n`;
  resumo += `Nível/Formação Mínima: ${vaga.experiencia?.nivel || "Júnior"} | ${
    vaga.formacao?.minima || "Ensino Superior"
  }\n`;
  return resumo.trim();
}

/**
 * Função para carregar listas dinâmicas (Departamentos, Regimes, Modalidades) do Firebase.
 */
async function carregarListasFirebase() {
  const selectDepartamento = document.getElementById("vaga-departamento");

  if (!selectDepartamento) return;

  try {
    const configRef = doc(db, CONFIG_COLLECTION_NAME, "geral");
    const docSnap = await getDoc(configRef);

    if (docSnap.exists()) {
      const listas = docSnap.data().listas;
      const departamentos = listas?.departamentos || [];

      selectDepartamento.innerHTML =
        '<option value="">Selecione o Departamento</option>';

      departamentos.forEach((depto) => {
        const option = document.createElement("option");
        option.value = depto;
        option.textContent = depto;
        selectDepartamento.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Erro ao carregar listas do Firebase:", error);
    window.showToast("Erro ao carregar listas de configuração.", "error");
  }
}

/**
 * Função para configurar o modal para criação de uma nova vaga.
 */
/**
 * Função para configurar o modal para criação de uma nova vaga.
 */
function openNewVagaModal() {
  if (formVaga) {
    formVaga.reset();
    formVaga.removeAttribute("data-vaga-id"); // Garante que é uma nova vaga
  }
  if (modalTitle) modalTitle.textContent = "Nova Vaga - Ficha Técnica";

  // Abre o modal principal (Ficha Técnica) forçando o status de edição
  openFichaTecnicaModal(null, "em-criação");
}

/**
 * NOVO: Abre o modal da Ficha Técnica (Em Criação e Aguardando Aprovação).
 * CORRIGIDO: Usa modalFicha em vez de modalVaga, resolvendo o ReferenceError.
 */
function openFichaTecnicaModal(vagaId, statusAtual) {
  // Só pode editar se o status for "em-criação" (Nova Vaga ou Rascunho rejeitado)
  const canEdit = statusAtual === "em-criação";

  // 1. Desabilita/Habilita todos os campos
  const inputsAndSelects = modalFicha.querySelectorAll(
    // <-- CORREÇÃO: Usando modalFicha
    "input, select, textarea"
  );
  inputsAndSelects.forEach((el) => {
    // Se canEdit for TRUE, el.disabled será FALSE (habilitado)
    el.disabled = !canEdit;
  });

  // 2. Configura botões de Salvar/Editar
  const btnSalvar = modalFicha.querySelector("#btn-salvar-vaga");
  // const btnEnviar = modalFicha.querySelector("#btn-enviar-aprovacao"); // Comentado se não existir no HTML

  // Se não estiver em Aprovação Vaga (aguardando-aprovacao), remove botões dinâmicos
  const dynamicWrapper = modalFicha.querySelector(
    ".acoes-aprovacao-ficha-wrapper"
  );
  if (dynamicWrapper) dynamicWrapper.remove();

  if (btnSalvar) {
    btnSalvar.style.display = canEdit ? "inline-block" : "none";
    btnSalvar.textContent = vagaId
      ? "Salvar Alterações"
      : "Salvar e Enviar para Aprovação";
  }

  // if (btnEnviar) {
  //     btnEnviar.style.display = 'none';
  // }

  // 3. Exibe o modal
  if (modalFicha) modalFicha.style.display = "flex"; // <-- CORREÇÃO: Usando modalFicha
}
/**
 * NOVO: Modal para Solicitar Alterações na Ficha Técnica (Aprovação Gestão).
 */
function modalSolicitarAlteracoesFicha(vagaId) {
  let modal = document.getElementById(ID_MODAL_SOLICITAR_FICHA);

  if (!modal) {
    modal = document.createElement("div");
    modal.id = ID_MODAL_SOLICITAR_FICHA;
    modal.className = "modal-overlay";
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    modal.style.zIndex = "1000";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";

    modal.innerHTML = `
<div class="modal-content" style="max-width: 450px; background-color: white; padding: 20px; border-radius: 8px;">
 <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 15px;">
 <h3 style="margin: 0;">Solicitar Alterações na Ficha</h3>
 <button type="button" class="close-modal-btn fechar-modal-alteracao-ficha" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
 </div>
 <div class="modal-body">
 <p>Descreva as alterações necessárias na Ficha Técnica. A vaga será retornada para **'Em Elaboração'** para correção:</p>
 <div class="form-group" style="margin-bottom: 15px;">
 <label for="solicitar-ficha-motivo">Alterações:</label>
 <textarea id="solicitar-ficha-motivo" rows="4" required style="width: 100%; padding: 8px; box-sizing: border-box;"></textarea>
 </div>
 </div>
 <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px;">
 <button type="button" class="btn btn-secondary fechar-modal-alteracao-ficha">Cancelar</button>
 <button type="button" class="btn btn-danger" id="btn-confirmar-alteracoes-ficha">Confirmar Solicitação</button>
 </div>
</div>
`;
    document.body.appendChild(modal);

    modal.querySelectorAll(".fechar-modal-alteracao-ficha").forEach((btn) => {
      btn.onclick = () => (modal.style.display = "none");
    });
  }

  const btnConfirmar = modal.querySelector("#btn-confirmar-alteracoes-ficha");
  if (btnConfirmar) {
    btnConfirmar.onclick = () => {
      const motivo = document.getElementById("solicitar-ficha-motivo").value;
      if (motivo.trim()) {
        modal.style.display = "none";
        handleRejeitarFichaTecnica(vagaId, motivo);
      } else {
        window.showToast("A descrição da alteração é obrigatória.", "warning");
      }
    };
  }

  document.getElementById("solicitar-ficha-motivo").value = "";
  modal.style.display = "flex";
}

/**
 * NOVO: Modal para Solicitar Alterações na Arte (Fase Aprovação da Arte).
 */
function modalSolicitarAlteracoesArte(vagaId) {
  let modal = document.getElementById(ID_MODAL_SOLICITAR_ARTE);

  if (!modal) {
    modal = document.createElement("div");
    modal.id = ID_MODAL_SOLICITAR_ARTE;
    modal.className = "modal-overlay";
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    modal.style.zIndex = "1000";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";

    modal.innerHTML = `
<div class="modal-content" style="max-width: 450px; background-color: white; padding: 20px; border-radius: 8px;">
 <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 15px;">
 <h3 style="margin: 0;">Solicitar Alterações na Arte</h3>
 <button type="button" class="close-modal-btn fechar-modal-alteracao-arte" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
 </div>
 <div class="modal-body">
 <p>Descreva detalhadamente as alterações necessárias na arte de divulgação:</p>
 <div class="form-group" style="margin-bottom: 15px;">
 <label for="solicitar-arte-motivo">Alterações:</label>
 <textarea id="solicitar-arte-motivo" rows="4" required style="width: 100%; padding: 8px; box-sizing: border-box;"></textarea>
 </div>
 </div>
 <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px;">
 <button type="button" class="btn btn-secondary fechar-modal-alteracao-arte">Cancelar</button>
 <button type="button" class="btn btn-warning" id="btn-confirmar-alteracoes-arte">Confirmar Solicitação</button>
 </div>
</div>
`;
    document.body.appendChild(modal);

    modal.querySelectorAll(".fechar-modal-alteracao-arte").forEach((btn) => {
      btn.onclick = () => (modal.style.display = "none");
    });
  }

  const btnConfirmar = modal.querySelector("#btn-confirmar-alteracoes-arte");
  if (btnConfirmar) {
    btnConfirmar.onclick = () => {
      const alteracoes = document.getElementById("solicitar-arte-motivo").value;
      if (alteracoes.trim()) {
        modal.style.display = "none";
        handleSolicitarAlteracoes(vagaId, alteracoes);
      } else {
        window.showToast("A descrição da alteração é obrigatória.", "warning");
      }
    };
  }

  document.getElementById("solicitar-arte-motivo").value = "";
  modal.style.display = "flex";
}

/**
 * NOVO: Abre um modal para solicitar a justificativa da rejeição.
 * Usado pelo botão 'Cancelar Vaga' (na fase de aprovação da ficha).
 */
function modalRejeicaoFichaTecnica(vagaId) {
  let modal = document.getElementById(ID_MODAL_REJEICAO);

  if (!modal) {
    modal = document.createElement("div");
    modal.id = ID_MODAL_REJEICAO;
    modal.className = "modal-overlay";
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    modal.style.zIndex = "1000";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";

    modal.innerHTML = `
<div class="modal-content" style="max-width: 450px; background-color: white; padding: 20px; border-radius: 8px;">
 <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 15px;">
 <h3 style="margin: 0;">Rejeitar Ficha Técnica (Cancelar Vaga)</h3>
 <button type="button" class="close-modal-btn fechar-modal-rejeicao" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
 </div>
 <div class="modal-body">
 <p>**ATENÇÃO:** Esta ação é irreversível e interromperá o fluxo de aprovação. A vaga será retornada para **'Em Elaboração'** para correção.</p>
 <p>Por favor, informe o motivo do cancelamento da vaga:</p>
 <div class="form-group" style="margin-bottom: 15px;">
 <label for="rejeicao-motivo">Justificativa:</label>
 <textarea id="rejeicao-motivo" rows="4" required style="width: 100%; padding: 8px; box-sizing: border-box;"></textarea>
 </div>
 </div>
 <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px;">
 <button type="button" class="btn btn-secondary fechar-modal-rejeicao">Cancelar</button>
 <button type="button" class="btn btn-danger" id="btn-confirmar-rejeicao">Confirmar Rejeição</button>
 </div>
</div>
`;
    document.body.appendChild(modal);

    modal.querySelectorAll(".fechar-modal-rejeicao").forEach((btn) => {
      btn.onclick = () => (modal.style.display = "none");
    });
  }

  const btnConfirmar = modal.querySelector("#btn-confirmar-rejeicao");
  if (btnConfirmar) {
    btnConfirmar.onclick = () => {
      const motivo = document.getElementById("rejeicao-motivo").value;
      if (motivo.trim()) {
        modal.style.display = "none";
        handleRejeitarFichaTecnica(vagaId, motivo);
      } else {
        window.showToast("O motivo da rejeição é obrigatório.", "warning");
      }
    };
  }

  document.getElementById("rejeicao-motivo").value = "";
  modal.style.display = "flex";
}
/**
 * Lida com a submissão do formulário de nova vaga ou edição.
 */
async function handleSalvarVaga(e) {
  e.preventDefault();

  const vagaId = formVaga.getAttribute("data-vaga-id");
  let isEditing = !!vagaId;
  const submitButton = e.submitter;
  if (submitButton) submitButton.disabled = true;

  try {
    // 1. EXTRAÇÃO DE DADOS PRINCIPAIS E DE AGRUPAMENTO (Ficha Técnica)
    const nome = document.getElementById("vaga-nome").value;
    const departamento = document.getElementById("vaga-departamento").value;
    const tipoRecrutamento = document.getElementById(
      "vaga-tipo-recrutamento"
    ).value;
    const regimeTrabalho = document.getElementById(
      "vaga-regime-trabalho"
    ).value;
    const modalidadeTrabalho = document.getElementById(
      "vaga-modalidade-trabalho"
    ).value;
    const valorSalario = document.getElementById("vaga-valor-salario").value;
    const dataFechamento = document.getElementById(
      "vaga-data-fechamento"
    ).value;
    const responsabilidades = document.getElementById(
      "vaga-responsabilidades"
    ).value; // Outros campos agrupados...

    const resultados = document.getElementById("vaga-resultados").value;
    const novaSubstituicao = document.getElementById(
      "vaga-nova-substituicao"
    ).value;
    const formacaoMinima = document.getElementById(
      "vaga-formacao-minima"
    ).value;
    const conselho = document.getElementById("vaga-conselho").value;
    const especializacoes = document.getElementById(
      "vaga-especializacoes"
    ).value;
    const compTecnicas = document.getElementById("vaga-comp-tecnicas").value;
    const compComportamentais = document.getElementById(
      "vaga-comp-comportamentais"
    ).value;
    const certificacoes = document.getElementById("vaga-certificacoes").value;
    const nivelExperiencia = document.getElementById(
      "vaga-nivel-experiencia"
    ).value;
    const contextosSimilares = document.getElementById(
      "vaga-contextos-similares"
    ).value;
    const atuacaoGrupos = document.getElementById("vaga-atuacao-grupos").value;
    const fitValores = document.getElementById("vaga-fit-valores").value;
    const estiloEquipe = document.getElementById("vaga-estilo-equipe").value;
    const perfilDestaque = document.getElementById(
      "vaga-perfil-destaque"
    ).value;
    const oportunidades = document.getElementById("vaga-oportunidades").value;
    const desafios = document.getElementById("vaga-desafios").value;
    const planoCarreira = document.getElementById("vaga-plano-carreira").value; // Campos da Seção de Arte (apenas leitura do estado atual se existirem) // NOTE: Estes campos serão salvos mesmo se o modal-vaga for submetido.

    const resumoArte = document.getElementById("vaga-resumo-arte")?.value || "";
    const linkArte = document.getElementById("vaga-link-arte")?.value || "";
    const observacaoArte =
      document.getElementById("vaga-texto-divulgacao")?.value || ""; // Usando texto de divulgação // 2. CONSTRUÇÃO DO OBJETO DE DADOS

    const vagaData = {
      nome: nome,
      departamento: departamento,
      tipoRecrutamento: tipoRecrutamento,
      regimeTrabalho: regimeTrabalho,
      modalidadeTrabalho: modalidadeTrabalho,
      valorSalario: valorSalario,
      dataFechamento: dataFechamento, // Mapeamento dos campos detalhados

      cargo: {
        responsabilidades: responsabilidades,
        resultados: resultados,
        novaSubstituicao: novaSubstituicao,
      },
      formacao: {
        minima: formacaoMinima,
        conselho: conselho,
        especializacoes: especializacoes,
      },
      competencias: {
        tecnicas: compTecnicas,
        comportamentais: compComportamentais,
        certificacoes: certificacoes,
      },
      experiencia: {
        nivel: nivelExperiencia,
        contextosSimilares: contextosSimilares,
        atuacaoGrupos: atuacaoGrupos,
      },
      fitCultural: {
        valoresEuPsico: fitValores,
        estiloEquipe: estiloEquipe,
        perfilDestaque: perfilDestaque,
      },
      crescimento: {
        oportunidades: oportunidades,
        desafios: desafios,
        planoCarreira: planoCarreira,
      }, // Informações da arte e divulgação (Mantendo o estado atual, mas atualizando se vier do formulário)

      arte: {
        resumo: resumoArte,
        link: linkArte,
        status: "Pendente",
        observacao: observacaoArte, // alteraçõesPendentes: string
      }, // Canais de Divulgação não estão nesta fase, mas são necessários no objeto para edição
    };

    const historicoEntry = {
      data: new Date(),
      usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
    };

    let newStatus = "";

    if (isEditing) {
      // Carrega status anterior
      const vagaDoc = await getDoc(doc(db, VAGAS_COLLECTION_NAME, vagaId));
      const oldStatus = vagaDoc.data().status; // A edição da Ficha só é permitida se a vaga NÃO FOI APROVADA

      if (oldStatus !== "em-criação" && oldStatus !== "aguardando-aprovacao") {
        window.showToast(
          "Não é possível editar a Ficha Técnica de uma vaga aprovada.",
          "error"
        );
        return;
      }

      newStatus = oldStatus; // Se for clique em Salvar e Próxima Etapa, muda para aguardando-aprovacao // No novo fluxo, o botão principal do formVaga é "Salvar e Próxima Etapa"

      if (oldStatus === "em-criação") {
        newStatus = "aguardando-aprovacao";
        vagaData.status = newStatus;
        vagaData.historico = arrayUnion({
          ...historicoEntry,
          acao: "Ficha Técnica finalizada e enviada para Aprovação da Vaga.",
        });
      } else {
        // Se for edição em Aguardando Aprovação (sem alteração de status)
        vagaData.historico = arrayUnion({
          ...historicoEntry,
          acao: `Vaga editada (Ficha Técnica atualizada). Status: ${newStatus}`,
        });
      }

      const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
      await updateDoc(vagaRef, vagaData);

      window.showToast(
        "Ficha Técnica da Vaga atualizada com sucesso!",
        "success"
      );
    } else {
      // AÇÃO DE CRIAÇÃO (Novo Fluxo)
      newStatus = "aguardando-aprovacao";
      vagaData.status = newStatus;
      vagaData.dataCriacao = new Date();
      vagaData.candidatosCount = 0;
      vagaData.historico = [
        {
          ...historicoEntry,
          acao: "Vaga criada (Ficha Técnica) e enviada para Aprovação da Vaga.",
        },
      ];

      await addDoc(vagasCollection, vagaData);
      window.showToast(
        "Ficha Técnica da Vaga salva com sucesso! Enviada para Aprovação da Vaga.",
        "success"
      );
    }

    modalFicha.style.display = "none";
    carregarVagas("aprovacao-gestao");
  } catch (error) {
    console.error("Erro ao salvar/atualizar a Ficha Técnica da vaga:", error);
    window.showToast(
      "Ocorreu um erro ao salvar/atualizar a Ficha Técnica da vaga.",
      "error"
    );
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

/**
 * NOVO: Lida com a Aprovação da Ficha Técnica pelo Gestor.
 */
async function handleAprovarFichaTecnica(vagaId) {
  if (
    !vagaId ||
    !confirm(
      "Confirma a APROVAÇÃO desta Ficha Técnica de Vaga? Isso liberará a próxima etapa de Criação da Arte."
    )
  )
    return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    await updateDoc(vagaRef, {
      status: "arte-pendente", // Próxima fase: Criação da Arte
      dataAprovacaoFicha: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Ficha Técnica APROVADA. Próxima etapa: Criação da Arte.",
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast(
      "Ficha Técnica aprovada! Próximo passo é a Criação da Arte.",
      "success"
    );
    modalFicha.style.display = "none";
    carregarVagas("arte-pendente");
  } catch (error) {
    console.error("Erro ao aprovar ficha técnica:", error);
    window.showToast("Ocorreu um erro ao aprovar a ficha técnica.", "error");
  }
}

/**
 * NOVO: Lida com a Rejeição da Ficha Técnica pelo Gestor (volta para Em Criação).
 * @param {string} vagaId
 * @param {string} justificativa
 */
async function handleRejeitarFichaTecnica(vagaId, justificativa) {
  if (!vagaId || !justificativa) return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    await updateDoc(vagaRef, {
      status: "em-criação", // Volta para Em Criação (aba "Abertas")
      historico: arrayUnion({
        data: new Date(),
        acao: `Ficha Técnica REJEITADA. Motivo: ${justificativa.substring(
          0,
          80
        )}...`,
        justificativa: justificativa,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast(
      "Ficha Técnica rejeitada. Retornando para Em Elaboração.",
      "info"
    );
    modalFicha.style.display = "none";
    carregarVagas("abertas");
  } catch (error) {
    console.error("Erro ao rejeitar ficha técnica:", error);
    window.showToast("Ocorreu um erro ao rejeitar a ficha técnica.", "error");
  }
}

/**
 * NOVO: Salva os dados de Arte e muda o status para Aguardando Aprovação da Arte.
 * Chamada pelo botão 'Enviar para Aprovação' no modal de Criação da Arte.
 */
async function handleSalvarEEnviarArte(vagaId, link, textoDivulgacao) {
  if (!vagaId || !link) return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    const docSnap = await getDoc(vagaRef);
    if (!docSnap.exists()) throw new Error("Vaga não encontrada.");

    const currentArte = docSnap.data().arte || {};
    const newStatus = "aguardando-aprovacao-arte";

    await updateDoc(vagaRef, {
      status: newStatus,
      arte: {
        ...currentArte,
        link: link,
        observacao: textoDivulgacao, // O campo observação é usado como "Texto de Divulgação"
        status: "Aguardando Aprovação",
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Arte e Link salvos. Enviado para Aprovação de Arte.`,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast("Arte enviada para aprovação do Gestor!", "success");
    if (modalCriacaoArte) modalCriacaoArte.style.display = "none";
    carregarVagas("aprovacao-arte");
  } catch (error) {
    console.error("Erro ao salvar/enviar Arte:", error);
    window.showToast("Ocorreu um erro ao salvar e enviar a Arte.", "error");
  }
}

/**
 * NOVO: Lida com a Aprovação da Arte pelo Gestor.
 */
async function handleAprovarArte() {
  // Busca o ID da vaga no modal de aprovação de arte
  const vagaId = modalAprovacaoArte.querySelector(
    "#vaga-id-arte-aprovacao"
  )?.value;

  if (!vagaId || !confirm("Confirma a APROVAÇÃO da arte de divulgação?"))
    return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    const docSnap = await getDoc(vagaRef);
    if (!docSnap.exists()) throw new Error("Vaga não encontrada.");

    await updateDoc(vagaRef, {
      status: "em-divulgacao",
      arte: {
        ...docSnap.data().arte,
        status: "Aprovada",
        alteracoesPendentes: null,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: "Arte de divulgação APROVADA. Vaga pronta para ser divulgada.",
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast(
      "Arte aprovada! A vaga agora está em Divulgação.",
      "success"
    );
    if (modalAprovacaoArte) modalAprovacaoArte.style.display = "none";
    carregarVagas("em-divulgacao");
  } catch (error) {
    console.error("Erro ao aprovar arte:", error);
    window.showToast("Ocorreu um erro ao aprovar a arte.", "error");
  }
}
async function handleSolicitarAlteracoes(vagaId, alteracoes) {
  if (!vagaId || !alteracoes) {
    window.showToast(
      "Erro: ID da vaga ou descrição das alterações ausente.",
      "error"
    );
    return;
  }

  if (!confirm("Confirma a SOLICITAÇÃO de alterações na arte?")) return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    const docSnap = await getDoc(vagaRef);
    if (!docSnap.exists()) throw new Error("Vaga não encontrada.");

    await updateDoc(vagaRef, {
      status: "arte-pendente", // Volta para a fase de Criação
      arte: {
        ...docSnap.data().arte,
        status: "Alteração Solicitada",
        alteracoesPendentes: alteracoes,
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Alterações na arte solicitadas: ${alteracoes.substring(
          0,
          50
        )}...`,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast("Solicitação de alterações enviada com sucesso.", "info");
    if (modalAprovacaoArte) modalAprovacaoArte.style.display = "none";
    carregarVagas("arte-pendente");
  } catch (error) {
    console.error("Erro ao solicitar alterações na arte:", error);
    window.showToast("Ocorreu um erro ao solicitar alterações.", "error");
  }
}

/**
 * NOVO: Lida com o Encerramento da Vaga (pós-recrutamento ou por outro motivo).
 */
async function handleEncerrarVaga() {
  // Busca o ID do campo hidden no formulário de divulgação
  const vagaId = document.getElementById("vaga-id-divulgacao")?.value;
  if (!vagaId) return;

  if (
    !confirm(
      "Tem certeza que deseja ENCERRAR a vaga? Se o recrutamento foi concluído, esta é a ação correta. Se não, use 'Cancelar Vaga'."
    )
  ) {
    return;
  }

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    await updateDoc(vagaRef, {
      status: "encerrada", // Novo status para encerramento
      dataEncerramento: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Vaga ENCERRADA (Recrutamento concluído ou finalizado).",
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast("Vaga encerrada com sucesso!", "success");
    if (modalDivulgacao) modalDivulgacao.style.display = "none";
    carregarVagas("fechadas");
  } catch (error) {
    console.error("Erro ao encerrar a vaga:", error);
    window.showToast("Ocorreu um erro ao encerrar a vaga.", "error");
  }
}

/**
 * NOVO: Lida com o Cancelamento da Divulgação.
 */
async function handleCancelarDivulgacao() {
  // Busca o ID do campo hidden no formulário de divulgação
  const vagaId = document.getElementById("vaga-id-divulgacao")?.value;
  if (!vagaId) return;

  if (
    !confirm(
      "Tem certeza que deseja CANCELAR a divulgação e arquivar esta vaga? Esta ação pode ser revertida manualmente, mas interrompe o fluxo de recrutamento."
    )
  ) {
    return;
  }

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    await updateDoc(vagaRef, {
      status: "cancelada", // Novo status para cancelamento
      dataCancelamento: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Vaga CANCELADA (Fluxo de divulgação interrompido).",
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast("Vaga cancelada com sucesso!", "info");
    if (modalDivulgacao) modalDivulgacao.style.display = "none";
    carregarVagas("fechadas");
  } catch (error) {
    console.error("Erro ao cancelar a vaga:", error);
    window.showToast("Ocorreu um erro ao cancelar a vaga.", "error");
  }
}

/**
 * NOVO: Manipula o salvamento de detalhes de divulgação (canais e período).
 */
async function handleSalvarDivulgacaoDetalhes(e) {
  e.preventDefault(); // Busca o ID do campo hidden no formulário de divulgação

  const vagaId = document.getElementById("vaga-id-divulgacao")?.value;
  if (!vagaId) return;

  const selectCanais = document.getElementById("vaga-canais-divulgacao");
  const canaisDivulgacao = Array.from(selectCanais.options)
    .filter((option) => option.selected)
    .map((option) => option.value);

  const periodoDivulgacao =
    document.getElementById("vaga-periodo-divulgacao")?.value || "";

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    await updateDoc(vagaRef, {
      canaisDivulgacao: canaisDivulgacao,
      periodoDivulgacao: periodoDivulgacao, // Assumindo novo campo no DB
      historico: arrayUnion({
        data: new Date(),
        acao: `Canais e Período de Divulgação atualizados.`,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast("Detalhes de Divulgação salvos com sucesso.", "success");
    if (modalDivulgacao) modalDivulgacao.style.display = "none";
    carregarVagas("em-divulgacao");
  } catch (error) {
    console.error("Erro ao salvar detalhes de divulgação:", error);
    window.showToast(
      "Ocorreu um erro ao salvar os detalhes de divulgação.",
      "error"
    );
  }
}

async function handleReaproveitarVaga(vagaId) {
  if (
    !vagaId ||
    !confirm(
      "Confirma o reaproveitamento desta vaga? Uma nova vaga será criada com as mesmas informações na fase 'Em Elaboração'."
    )
  )
    return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    const docSnap = await getDoc(vagaRef);

    if (!docSnap.exists()) {
      window.showToast("Vaga original não encontrada.", "error");
      return;
    }

    const vagaOriginal = docSnap.data(); // 1. Clonar APENAS os dados da Ficha Técnica (Requisito)

    const newVagaData = {
      nome: `REAPROVEITADA: ${vagaOriginal.nome} (Cópia)`,
      departamento: vagaOriginal.departamento,
      tipoRecrutamento: vagaOriginal.tipoRecrutamento,
      regimeTrabalho: vagaOriginal.regimeTrabalho,
      modalidadeTrabalho: vagaOriginal.modalidadeTrabalho,
      valorSalario: vagaOriginal.valorSalario,

      cargo: vagaOriginal.cargo,
      formacao: vagaOriginal.formacao,
      competencias: vagaOriginal.competencias,
      experiencia: vagaOriginal.experiencia,
      fitCultural: vagaOriginal.fitCultural,
      crescimento: vagaOriginal.crescimento, // Dados de controle

      status: "em-criação",
      dataCriacao: new Date(),
      dataFechamento: null,
      candidatosCount: 0, // Resetar informações de arte e histórico para um novo ciclo

      arte: {
        resumo: vagaOriginal.arte?.resumo || "",
        link: "",
        status: "Pendente",
        observacao: "",
        alteracoesPendentes: null,
      },
      historico: [
        {
          data: new Date(),
          acao: `Vaga criada a partir do reaproveitamento da Vaga ID: ${vagaId}.`,
          usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
        },
      ],
    }; // 2. Salvar como novo documento

    await addDoc(vagasCollection, newVagaData);

    window.showToast(
      "Vaga reaproveitada com sucesso! Retornando para Em Elaboração.",
      "success"
    );

    if (modalFechadas) modalFechadas.style.display = "none";
    carregarVagas("abertas");
  } catch (error) {
    console.error("Erro ao reaproveitar a vaga:", error);
    window.showToast("Ocorreu um erro ao reaproveitar a vaga.", "error");
  }
}

/**
 * NOVO: Abre o modal da Ficha Técnica (Em Criação e Aguardando Aprovação).
 * CORREÇÃO: Foi a única definição mantida, removendo a duplicata.
 */
function openFichaTecnicaModal(vagaId, statusAtual) {
  // Só pode editar se o status for "em-criação" (Nova Vaga ou Rascunho rejeitado)
  const canEdit = statusAtual === "em-criação";

  // 1. Desabilita/Habilita todos os campos
  const inputsAndSelects = modalVaga.querySelectorAll(
    "input, select, textarea"
  );
  inputsAndSelects.forEach((el) => {
    // Se canEdit for TRUE, el.disabled será FALSE (habilitado)
    el.disabled = !canEdit;
  });

  // 2. Configura botões de Salvar/Editar
  const btnSalvar = modalFicha.querySelector("#btn-salvar-vaga");
  const btnEnviar = modalFicha.querySelector("#btn-enviar-aprovacao"); // Assumindo ID fictício

  // Se não estiver em Aprovação Vaga (aguardando-aprovacao), remove botões dinâmicos
  const dynamicWrapper = modalFicha.querySelector(
    ".acoes-aprovacao-ficha-wrapper"
  );
  if (dynamicWrapper) dynamicWrapper.remove();

  if (btnSalvar) {
    btnSalvar.style.display = canEdit ? "inline-block" : "none";
    btnSalvar.textContent = vagaId
      ? "Salvar Alterações"
      : "Salvar e Enviar para Aprovação";
  }

  if (btnEnviar) {
    btnEnviar.style.display = "none"; // Este botão é injetado dinamicamente no modo Aprovação Vaga, não deve estar no HTML estático.
  }

  // 3. Exibe o modal
  if (modalFicha) modalFicha.style.display = "flex";
}
/**
 * NOVO: Centraliza o preenchimento de TODOS os campos da Ficha Técnica e Arte.
 */
async function preencherFormularioVaga(vagaId, vaga) {
  if (!vaga) return;

  // 1. Garante que as listas dinâmicas estejam carregadas
  await carregarListasFirebase();

  // 2. Define o ID da vaga nos formulários de cada modal (assumindo que os inputs hidden existem)
  const forms = [formVaga, formCriacaoArte, formDivulgacao, modalFechadas];
  const ids = [
    "vaga-id-ficha",
    "vaga-id-arte-criacao",
    "vaga-id-divulgacao",
    "vaga-id-fechadas",
  ];

  forms.forEach((form, index) => {
    if (form) {
      const hiddenInput = form.querySelector(`#${ids[index]}`);
      if (hiddenInput) hiddenInput.value = vagaId;
      if (form === formVaga) form.setAttribute("data-vaga-id", vagaId);
    }
  });

  // 3. Mapeamento dos campos da FICHA TÉCNICA (formVaga)
  const mapValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  };

  mapValue("vaga-nome", vaga.nome);
  mapValue("vaga-departamento", vaga.departamento);
  mapValue("vaga-tipo-recrutamento", vaga.tipoRecrutamento);
  mapValue("vaga-regime-trabalho", vaga.regimeTrabalho);
  mapValue("vaga-modalidade-trabalho", vaga.modalidadeTrabalho);
  mapValue("vaga-valor-salario", vaga.valorSalario);
  mapValue("vaga-data-fechamento", vaga.dataFechamento);

  mapValue("vaga-responsabilidades", vaga.cargo?.responsabilidades);
  mapValue("vaga-resultados", vaga.cargo?.resultados);
  mapValue("vaga-nova-substituicao", vaga.cargo?.novaSubstituicao);
  mapValue("vaga-formacao-minima", vaga.formacao?.minima);
  mapValue("vaga-conselho", vaga.formacao?.conselho);
  mapValue("vaga-especializacoes", vaga.formacao?.especializacoes);
  mapValue("vaga-comp-tecnicas", vaga.competencias?.tecnicas);
  mapValue("vaga-comp-comportamentais", vaga.competencias?.comportamentais);
  mapValue("vaga-certificacoes", vaga.competencias?.certificacoes);
  mapValue("vaga-nivel-experiencia", vaga.experiencia?.nivel);
  mapValue("vaga-contextos-similares", vaga.experiencia?.contextosSimilares);
  mapValue("vaga-atuacao-grupos", vaga.experiencia?.atuacaoGrupos);
  mapValue("vaga-fit-valores", vaga.fitCultural?.valoresEuPsico);
  mapValue("vaga-estilo-equipe", vaga.fitCultural?.estiloEquipe);
  mapValue("vaga-perfil-destaque", vaga.fitCultural?.perfilDestaque);
  mapValue("vaga-oportunidades", vaga.crescimento?.oportunidades);
  mapValue("vaga-desafios", vaga.crescimento?.desafios);
  mapValue("vaga-plano-carreira", vaga.crescimento?.planoCarreira);

  // 4. Mapeamento dos campos de CRIAÇÃO DE ARTE (modal-criacao-arte)
  const resumoArteField = document.querySelector(
    "#modal-criacao-arte #vaga-resumo-arte"
  );
  const linkArteField = document.querySelector(
    "#modal-criacao-arte #vaga-link-arte"
  );
  const textoDivulgacaoField = document.querySelector(
    "#modal-criacao-arte #vaga-texto-divulgacao"
  );

  if (linkArteField) linkArteField.value = vaga.arte?.link || "";
  if (textoDivulgacaoField)
    textoDivulgacaoField.value = vaga.arte?.observacao || "";

  if (resumoArteField) {
    resumoArteField.value = vaga.arte?.resumo || gerarResumoVaga(vaga);
  }

  // 5. Mapeamento dos campos de APROVAÇÃO/DIVULGAÇÃO (somente visualização)
  const linkParaRevisao = vaga.arte?.link || "N/A";
  const textoParaRevisao = vaga.arte?.observacao || "N/A";
  const statusArte = vaga.arte?.status || "Pendente";

  // --- Aprovação de Arte: Link Clicável e Texto ---
  const linkClicavelAprov = document.querySelector(
    "#modal-aprovacao-arte #link-arte-clicavel"
  );
  const textoVisualAprov = document.querySelector(
    "#modal-aprovacao-arte #aprovacao-texto-divulgacao-visual"
  );
  const statusArteAtualElement = document.querySelector(
    "#modal-aprovacao-arte #status-arte-atual"
  );

  if (linkClicavelAprov) {
    linkClicavelAprov.textContent =
      linkParaRevisao !== "N/A" ? "Clique Aqui" : "N/A";
    linkClicavelAprov.href = linkParaRevisao !== "N/A" ? linkParaRevisao : "#";
    linkClicavelAprov.target = "_blank";
    linkClicavelAprov.style.pointerEvents =
      linkParaRevisao !== "N/A" ? "auto" : "none";
  }
  if (textoVisualAprov) {
    textoVisualAprov.textContent = textoParaRevisao;
  }
  // ATENÇÃO: #status-arte-atual não existe no modal-aprovacao-arte no HTML que me forneceu, mas assumo que está em algum lugar no seu código
  if (statusArteAtualElement) {
    statusArteAtualElement.textContent = statusArte;
  }

  // --- Divulgação: Link Clicável e Canais ---
  const linkClicavelDivulg = document.querySelector(
    "#modal-divulgacao #divulgacao-link-clicavel"
  );
  const textoAprovadoDivulg = document.querySelector(
    "#modal-divulgacao #divulgacao-texto-aprovado"
  );
  const periodoDivulgacaoInput = document.querySelector(
    "#vaga-periodo-divulgacao"
  );
  const selectCanais = document.querySelector(
    "#modal-divulgacao #vaga-canais-divulgacao"
  );

  if (linkClicavelDivulg) {
    linkClicavelDivulg.href = linkParaRevisao !== "N/A" ? linkParaRevisao : "#";
  }
  if (textoAprovadoDivulg) {
    textoAprovadoDivulg.textContent = textoParaRevisao;
  }
  if (periodoDivulgacaoInput) {
    periodoDivulgacaoInput.value = vaga.periodoDivulgacao || "";
  }

  if (selectCanais) {
    const canaisSalvos = vaga.canaisDivulgacao || [];
    Array.from(selectCanais.options).forEach(
      (option) => (option.selected = false)
    );
    Array.from(selectCanais.options).forEach((option) => {
      option.selected = canaisSalvos.includes(option.value);
    });
  }
}

/**
 * NOVO: Abre o modal de Criação da Arte (Fase RH).
 */
function openCriacaoArteModal(vagaId, vaga) {
  const isPendente = vaga.status === "arte-pendente"; // 1. Configura o formulário

  const linkArteField = document.querySelector(
    "#modal-criacao-arte #vaga-link-arte"
  );
  const textoDivulgacaoField = document.querySelector(
    "#modal-criacao-arte #vaga-texto-divulgacao"
  ); // 2. Configura botões e estados para edição de link/texto de divulgação

  const inputs = modalCriacaoArte.querySelectorAll("input, textarea");
  inputs.forEach((input) => (input.disabled = !isPendente));

  const btnEnviar = modalCriacaoArte.querySelector(
    "#btn-enviar-aprovacao-arte"
  );
  if (btnEnviar) {
    btnEnviar.style.display = isPendente ? "inline-block" : "none";
    btnEnviar.onclick = () => {
      handleSalvarEEnviarArte(
        vagaId,
        linkArteField.value,
        textoDivulgacaoField.value
      );
    };
  }

  if (modalCriacaoArte) modalCriacaoArte.style.display = "flex";
}

/**
 * NOVO: Abre o modal de Aprovação da Arte (Fase Gestor/Revisor).
 */
function openAprovacaoArteModal(vagaId, vaga) {
  // 1. O preenchimento visual é feito em preencherFormularioVaga

  // 2. Configuração dos eventos
  const btnAprovar = modalAprovacaoArte.querySelector(
    "#btn-aprovar-arte-final"
  );
  const btnSolicitar = modalAprovacaoArte.querySelector(
    "#btn-solicitar-alteracoes-arte"
  );

  if (btnAprovar) btnAprovar.onclick = () => handleAprovarArte();
  if (btnSolicitar)
    btnSolicitar.onclick = () => modalSolicitarAlteracoesArte(vagaId);

  if (modalAprovacaoArte) modalAprovacaoArte.style.display = "flex";
}

/**
 * NOVO: Abre o modal de Gerenciamento da Divulgação (Vaga Ativa).
 */
function openDivulgacaoModal(vagaId, vaga) {
  const btnSalvarDiv = modalDivulgacao.querySelector("#btn-salvar-divulgacao"); // 1. Configura botão de salvar detalhes

  if (btnSalvarDiv) btnSalvarDiv.onclick = handleSalvarDivulgacaoDetalhes; // 2. Configura botões de fluxo (Encerrar/Cancelar)

  const btnEncerrar = modalDivulgacao.querySelector("#btn-encerrar-vaga");
  const btnCancelar = modalDivulgacao.querySelector("#btn-cancelar-vaga");

  if (btnEncerrar) btnEncerrar.onclick = handleEncerrarVaga;
  if (btnCancelar) btnCancelar.onclick = handleCancelarDivulgacao;

  if (modalDivulgacao) modalDivulgacao.style.display = "flex";
}

/**
 * NOVO: Abre o modal de Visualização de Vagas Fechadas/Encerradas.
 */
function openVisualizacaoFechadaModal(vagaId, vaga) {
  const fichaContainer = modalFechadas.querySelector(
    "#visualizacao-ficha-completa"
  );
  const arteContainer = modalFechadas.querySelector(
    "#visualizacao-arte-completa"
  );
  const historicoContainer = modalFechadas.querySelector(
    "#visualizacao-historico"
  ); // 1. Limpar e popular Ficha Técnica para visualização // (A lógica de clonagem/população visual é assumida como complexa e omitida aqui) // 2. Configuração dos Eventos

  const btnReaproveitar = modalFechadas.querySelector("#btn-reaproveitar-vaga");

  if (btnReaproveitar)
    btnReaproveitar.onclick = () => handleReaproveitarVaga(vagaId); // 3. Exibe o modal

  if (modalFechadas) modalFechadas.style.display = "flex";
}

/**
 * Função para buscar e exibir os detalhes de uma vaga para edição.
 * ATUA COMO ROTEAROR: Carrega os dados e abre o modal correto baseado no status.
 */
async function handleDetalhesVaga(vagaId) {
  if (!vagaId) return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    const docSnap = await getDoc(vagaRef);

    if (!docSnap.exists()) {
      window.showToast("Vaga não encontrada.", "error");
      return;
    }

    const vaga = docSnap.data();
    const statusAtual = vaga.status || "em-criação"; // 1. Preenche TODOS os campos em TODOS os modais (centralizado)

    await preencherFormularioVaga(vagaId, vaga); // 2. ROTEA PARA O MODAL CORRETO // Esconde todos os modais antes de abrir o correto (garante limpeza de tela)

    document
      .querySelectorAll(".modal-overlay")
      .forEach((modal) => (modal.style.display = "none"));

    if (
      statusAtual === "em-criação" ||
      statusAtual === "aguardando-aprovacao"
    ) {
      openFichaTecnicaModal(vagaId, statusAtual);
    } else if (statusAtual === "arte-pendente") {
      openCriacaoArteModal(vagaId, vaga);
    } else if (statusAtual === "aguardando-aprovacao-arte") {
      openAprovacaoArteModal(vagaId, vaga);
    } else if (statusAtual === "em-divulgacao") {
      openDivulgacaoModal(vagaId, vaga);
    } else if (statusAtual === "cancelada" || statusAtual === "encerrada") {
      openVisualizacaoFechadaModal(vagaId, vaga);
    }
  } catch (error) {
    console.error("Erro ao carregar detalhes da vaga:", error);
    window.showToast("Erro ao carregar os dados para edição.", "error");
  }
}

/**
 * Carrega e exibe as vagas com base no status.
 */
async function carregarVagas(status) {
  const listaVagas = document.getElementById("lista-vagas");
  if (!listaVagas) return;
  listaVagas.innerHTML =
    '<div class="loading-spinner">Carregando vagas...</div>';

  let statusArray = [status];

  if (status === "abertas") {
    statusArray = ["em-criação"];
  } else if (status === "fechadas") {
    statusArray = ["cancelada", "encerrada"];
  } else if (status === "aprovacao-gestao") {
    statusArray = ["aguardando-aprovacao"];
  } else if (status === "arte-pendente") {
    statusArray = ["arte-pendente"];
  } else if (status === "aprovacao-arte") {
    statusArray = ["aguardando-aprovacao-arte"];
  } else if (status === "em-divulgacao") {
    statusArray = ["em-divulgacao"];
  }
  const queryConteudo = query(
    vagasCollection,
    where("status", "in", statusArray)
  );

  const allStatuses = [
    "em-criação",
    "aguardando-aprovacao",
    "arte-pendente",
    "aguardando-aprovacao-arte",
    "em-divulgacao",
    "encerrada",
    "cancelada",
  ];

  const queryContagemGlobal = query(
    vagasCollection,
    where("status", "in", allStatuses)
  );

  const [snapshotConteudo, snapshotContagem] = await Promise.all([
    getDocs(queryConteudo),
    getDocs(queryContagemGlobal),
  ]);

  let htmlVagas = "";
  let count = 0;

  const counts = {
    abertas: 0,
    "aprovacao-gestao": 0,
    "arte-pendente": 0,
    "aprovacao-arte": 0,
    "em-divulgacao": 0,
    fechadas: 0,
  };

  snapshotContagem.docs.forEach((doc) => {
    const vaga = doc.data();

    if (vaga.status === "em-criação") {
      counts["abertas"]++;
    }

    if (vaga.status === "aguardando-aprovacao") counts["aprovacao-gestao"]++;
    if (vaga.status === "arte-pendente") counts["arte-pendente"]++;
    if (vaga.status === "aguardando-aprovacao-arte") counts["aprovacao-arte"]++;
    if (vaga.status === "em-divulgacao") counts["em-divulgacao"]++;
    if (vaga.status === "cancelada" || vaga.status === "encerrada")
      counts["fechadas"]++;
  });

  snapshotConteudo.docs.forEach((doc) => {
    const vaga = doc.data();
    vaga.id = doc.id;
    count++;

    const statusFormatado = vaga.status
      .toUpperCase()
      .replace(/-/g, " ")
      .replace("APROVACAO GESTAO", "APROVAÇÃO DA VAGA")
      .replace("APROVACAO ARTE", "APROVAÇÃO DA ARTE");

    const infoSecundaria = [
      `Dpto: ${vaga.departamento || "Não definido"}`,
      `Regime: ${vaga.regimeTrabalho || "Não definido"}`,
      `Salário: ${vaga.valorSalario || "Não informado"}`,
    ].join(" | ");

    htmlVagas += `
<div class="card card-vaga" data-id="${vaga.id}">
<h4>${vaga.nome}</h4>
<p class="text-secondary small-info">${infoSecundaria}</p>
<p>Status: **${statusFormatado}**</p>
<p>Candidatos: ${vaga.candidatosCount || 0}</p>
<div class="rh-card-actions">
 <button class="btn btn-primary btn-detalhes" data-id="${
   vaga.id
 }">Ver/Gerenciar Vaga</button>
</div>
</div>
`;
  });

  document.querySelectorAll(".status-tabs .tab-link").forEach((btn) => {
    const btnStatus = btn.getAttribute("data-status");
    const countValue = counts[btnStatus] || 0;

    let tabText = btnStatus;
    if (btnStatus === "aprovacao-gestao") tabText = "Aprovação da Vaga";
    if (btnStatus === "arte-pendente") tabText = "Criação da Arte";
    if (btnStatus === "aprovacao-arte") tabText = "Aprovação da Arte";
    if (btnStatus === "em-divulgacao") tabText = "Em Divulgação";
    if (btnStatus === "fechadas") tabText = "Fechadas/Encerradas";
    if (btnStatus === "abertas") tabText = "Em Elaboração";

    btn.textContent = `${tabText} (${countValue})`;
  });

  if (count === 0) {
    listaVagas.innerHTML = `<p id="mensagem-vagas">Nenhuma vaga encontrada para o status: **${status
      .replace(/-/g, " ")
      .toUpperCase()}**.</p>`;
    return;
  }

  listaVagas.innerHTML = htmlVagas;

  document.querySelectorAll(".btn-detalhes").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      handleDetalhesVaga(e.target.getAttribute("data-id"));
    });
  });
}

/**
 * Função de inicialização principal do módulo.
 */
async function initgestaovagas(user, userData) {
  console.log("🔹 Iniciando Módulo de Gestão de Vagas e Recrutamento...");

  currentUserData = userData || {}; // Esconde todos os modais no início

  document
    .querySelectorAll(".modal-overlay")
    .forEach((modal) => (modal.style.display = "none"));

  const btnNovaVaga = document.getElementById("btn-nova-vaga"); // 1. Carrega as listas dinâmicas (Departamentos)

  await carregarListasFirebase(); // 2. Configura eventos de UI (Fechamento de modais)

  document.querySelectorAll(".fechar-modal").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      // Encontra o ID do modal a partir do atributo data-modal ou do pai
      const modalId =
        e.target.getAttribute("data-modal") ||
        e.target.closest(".modal-content").parentElement.id;
      const modal = document.getElementById(modalId);

      if (modal) {
        modal.style.display = "none";
      }
    });
  }); // Configura eventos de Abertura e Submissão

  if (btnNovaVaga) {
    btnNovaVaga.addEventListener("click", openNewVagaModal);
  } // CORREÇÃO DE ERRO LÓGICO: Atribui o submit ao formulário, não ao botão.
  if (formVaga) {
    formVaga.addEventListener("submit", handleSalvarVaga);
  } // Configura submissão do modal de divulgação

  const btnSalvarDivulgacao = document.getElementById("btn-salvar-divulgacao");
  if (btnSalvarDivulgacao) {
    btnSalvarDivulgacao.addEventListener(
      "click",
      handleSalvarDivulgacaoDetalhes
    );
  } // Configura eventos nos botões de fluxo (Encerrar/Cancelar)

  const btnEncerrarVagaDiv = document.querySelector(
    "#modal-divulgacao #btn-encerrar-vaga"
  );
  const btnCancelarVagaDiv = document.querySelector(
    "#modal-divulgacao #btn-cancelar-vaga"
  );

  if (btnEncerrarVagaDiv)
    btnEncerrarVagaDiv.addEventListener("click", handleEncerrarVaga);
  if (btnCancelarVagaDiv)
    btnCancelarVagaDiv.addEventListener("click", handleCancelarDivulgacao); // 3. Carrega a lista inicial (vagas abertas)

  document.querySelectorAll(".status-tabs .tab-link").forEach((b) => {
    b.classList.remove("active");
    if (b.getAttribute("data-status") === "abertas") {
      b.classList.add("active");
    }
  });

  await carregarVagas("abertas"); // 4. Adiciona eventos aos botões de status (filtragem)

  document.querySelectorAll(".status-tabs .tab-link").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const status = e.target.getAttribute("data-status");
      document
        .querySelectorAll(".status-tabs .tab-link")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      carregarVagas(status);
    });
  });
}

// CORREÇÃO DE ERRO DE INICIALIZAÇÃO: Exporta a função principal
export { initgestaovagas };
