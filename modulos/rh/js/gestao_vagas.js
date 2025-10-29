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

// Importa a função do novo utilitário user-management (mantido)
import { fetchUsersByRole } from "../../../assets/js/utils/user-management.js";

// Importações do Firebase atualizadas
import { arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// =====================================================================
// CONSTANTES GLOBAIS E ELEMENTOS DO DOM (CORRIGIDO PARA NOVA SEÇÃO)
// =====================================================================

const VAGAS_COLLECTION_NAME = "vagas";
const CONFIG_COLLECTION_NAME = "configuracoesSistema";
const ID_MODAL_REJEICAO = "modal-rejeicao-ficha";
const ID_MODAL_SOLICITAR_FICHA = "modal-solicitar-ficha";
const ID_MODAL_SOLICITAR_ARTE = "modal-solicitar-arte";
const ID_MODAL_REAPROVEITAR = "modal-reaproveitar-vaga";

const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);

// Elementos do DOM globais
const modalVaga = document.getElementById("modal-vaga");
const formVaga = document.getElementById("form-vaga");
const modalTitle = modalVaga ? modalVaga.querySelector("h3") : null;
const btnSalvar = document.getElementById("btn-salvar-vaga");

const btnCancelarVaga = document.getElementById("btn-cancelar-vaga");
const btnEncerrarVaga = document.getElementById("btn-encerrar-vaga");

const secaoFichaTecnica = document.getElementById("secao-ficha-tecnica");
const secaoCriacaoArte = document.getElementById("secao-criacao-arte");
const secaoDivulgacao = document.getElementById("secao-divulgacao");

// NOVO: Adicionando a constante para a seção de Aprovação da Arte
const secaoAprovacaoArte = document.getElementById("secao-aprovacao-arte");

const caixaAlteracoesArte = document.getElementById("caixa-alteracoes-arte");
const btnEnviarAlteracoes = document.getElementById("btn-enviar-alteracoes");

let currentUserData = {};
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
        // Usa a função de rejeição para devolver a ficha para 'em-criação'
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
 * NOVO: Modal para Solicitar Alterações na Arte (Fase Arte Pendente).
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
        // Chama a função de solicitação de alteração da arte
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
 * FUNÇÃO DE FLUXO: Gerencia a exibição das seções do modal com base no status da vaga.
 * *CORRIGIDA para usar secaoAprovacaoArte e manter secaoDivulgacao.*
 */
function gerenciarEtapasModal(status) {
  // Elemento do botão Fechar do rodapé (âncora segura)
  const btnFecharRodape = modalVaga.querySelector(
    ".modal-footer .fechar-modal"
  ); // Limpeza de botões estáticos e dinâmicos

  if (btnCancelarVaga) btnCancelarVaga.style.display = "none";
  if (btnEncerrarVaga) btnEncerrarVaga.style.display = "none";
  if (btnSalvar) btnSalvar.style.display = "none";
  const dynamicButtonsFicha = modalVaga.querySelector(
    ".acoes-aprovacao-ficha-wrapper"
  );
  if (dynamicButtonsFicha) dynamicButtonsFicha.remove();
  const dynamicButtonsArte = modalVaga.querySelector(".acoes-arte-wrapper");
  if (dynamicButtonsArte) dynamicButtonsArte.remove();
  const dynamicButtonsReaproveitar = modalVaga.querySelector(
    ".acoes-reaproveitar-wrapper"
  );
  if (dynamicButtonsReaproveitar) dynamicButtonsReaproveitar.remove();

  if (btnFecharRodape) btnFecharRodape.style.display = "inline-block"; // Ocultar todas as seções por padrão

  secaoFichaTecnica.style.display = "none";
  secaoCriacaoArte.style.display = "none";
  if (secaoAprovacaoArte) secaoAprovacaoArte.style.display = "none"; // Nova seção
  secaoDivulgacao.style.display = "none"; // Mantida para Divulgação

  const isVagaFechada = status === "cancelada" || status === "encerrada";
  const isVagaAprovada =
    status === "em-divulgacao" || status === "em-recrutamento";
  const isFichaBloqueada = status !== "em-criação"; // 1. CONTROLE DE DESABILITAÇÃO

  const inputsFichaTecnica = secaoFichaTecnica.querySelectorAll(
    "input, select, textarea"
  );
  inputsFichaTecnica.forEach((input) => {
    input.disabled = isFichaBloqueada || isVagaFechada;
  }); // Desativa campos da Seção de Criação de Arte (visível apenas para edição em 'arte-pendente')

  const inputsCriacaoArte = secaoCriacaoArte.querySelectorAll(
    "input, select, textarea"
  );
  inputsCriacaoArte.forEach((input) => {
    input.disabled = status !== "arte-pendente";
  });

  const vagaId = formVaga.getAttribute("data-vaga-id");

  if (status === "em-criação") {
    // FASE 1.0: Rascunho da Ficha Técnica
    secaoFichaTecnica.style.display = "block";
    if (btnSalvar) {
      btnSalvar.textContent = "Salvar e Enviar para Aprovação";
      btnSalvar.style.display = "inline-block";
    }
  } else if (status === "aguardando-aprovacao") {
    // FASE 1.1: Aprovação da Ficha Técnica
    secaoFichaTecnica.style.display = "block";

    if (btnCancelarVaga) {
      btnCancelarVaga.style.display = "inline-block";
      btnCancelarVaga.onclick = () => modalRejeicaoFichaTecnica(vagaId);
    }

    if (btnSalvar) btnSalvar.style.display = "none";

    const actionHtml = `
   <div class="acoes-aprovacao-ficha-wrapper" style="display: flex; gap: 10px; margin-left: auto;">
    <button type="button" class="btn btn-alteração" id="btn-solicitar-alteracoes-ficha">
     <i class="fas fa-edit"></i> Solicitar Alterações
    </button>
    <button type="button" class="btn btn-success" id="btn-aprovar-ficha">
     <i class="fas fa-check"></i> Aprovar
    </button>
   </div>
  `;

    if (btnFecharRodape) {
      btnFecharRodape.insertAdjacentHTML("beforebegin", actionHtml);
    }

    const btnAprovarFicha = document.getElementById("btn-aprovar-ficha");
    const btnSolicitarFicha = document.getElementById(
      "btn-solicitar-alteracoes-ficha"
    );

    if (btnAprovarFicha)
      btnAprovarFicha.onclick = () => handleAprovarFichaTecnica(vagaId);
    if (btnSolicitarFicha)
      btnSolicitarFicha.onclick = () => modalSolicitarAlteracoesFicha(vagaId);
  } else if (status === "arte-pendente") {
    // FASE 2.0: CRIAÇÃO DA ARTE (APENAS CADASTRO DE LINK)
    secaoFichaTecnica.style.display = "block";
    secaoCriacaoArte.style.display = "block"; // Botão único: Enviar para Aprovação
    const actionHtmlArte = `
      <div class="acoes-arte-wrapper" style="display: flex; gap: 10px; margin-left: auto;">
        <button type="button" class="btn btn-primary" id="btn-enviar-aprovacao-arte">
          <i class="fas fa-paper-plane"></i> Enviar para Aprovação
        </button>
      </div>
  `;

    if (btnFecharRodape) {
      btnFecharRodape.insertAdjacentHTML("beforebegin", actionHtmlArte);
    }

    setTimeout(() => {
      const btnEnviarAprovacao = document.getElementById(
        "btn-enviar-aprovacao-arte"
      );
      const inputLink = document.getElementById("vaga-link-arte");
      const inputObs = document.getElementById("vaga-observacao-arte");

      if (btnEnviarAprovacao) {
        btnEnviarAprovacao.onclick = () => {
          if (!inputLink.value) {
            window.showToast(
              "O link da arte é obrigatório para envio.",
              "warning"
            );
            return;
          }
          handleSalvarEEnviarArte(vagaId, inputLink.value, inputObs.value);
        };
      }
    }, 0);
  } else if (status === "aguardando-aprovacao-arte") {
    // FASE 2.1: APROVAÇÃO DA ARTE (NOVA ETAPA)
    secaoFichaTecnica.style.display = "block";
    secaoCriacaoArte.style.display = "block";
    if (secaoAprovacaoArte) secaoAprovacaoArte.style.display = "block"; // Exibe a nova seção // Injetar botões de Aprovação/Solicitação
    const actionHtmlAprovacaoArte = `
      <div class="acoes-arte-wrapper" style="display: flex; gap: 10px; margin-left: auto;">
        <button type="button" class="btn btn-warning" id="btn-solicitar-alteracoes-arte">
          <i class="fas fa-edit"></i> Solicitar Alterações
        </button>
        <button type="button" class="btn btn-success" id="btn-aprovar-arte-final">
          <i class="fas fa-check"></i> Aprovar Arte
        </button>
      </div>
  `;

    if (btnFecharRodape) {
      btnFecharRodape.insertAdjacentHTML(
        "beforebegin",
        actionHtmlAprovacaoArte
      );
    }

    // Configuração dos eventos da Aprovação de Arte
    setTimeout(() => {
      const btnSolicitarRodape = document.getElementById(
        "btn-solicitar-alteracoes-arte"
      );
      const btnAprovarRodape = document.getElementById(
        "btn-aprovar-arte-final"
      );

      if (btnAprovarRodape)
        btnAprovarRodape.onclick = () => handleAprovarArte();
      if (btnSolicitarRodape)
        btnSolicitarRodape.onclick = () => modalSolicitarAlteracoesArte(vagaId);
    }, 0);
  } else if (isVagaAprovada) {
    // FASE 3: Em Divulgação (MANTIDO)
    secaoFichaTecnica.style.display = "block";
    secaoCriacaoArte.style.display = "block";
    secaoDivulgacao.style.display = "block"; // Esta é a seção de Divulgação final
    if (secaoAprovacaoArte) secaoAprovacaoArte.style.display = "block"; // Também visível para histórico

    if (btnSalvar) {
      btnSalvar.textContent = "Salvar Canais de Divulgação";
      btnSalvar.style.display = "inline-block";
    }

    if (btnCancelarVaga) btnCancelarVaga.style.display = "inline-block";
    if (btnEncerrarVaga) btnEncerrarVaga.style.display = "inline-block";
  } else if (isVagaFechada) {
    // FASE FECHADA / CANCELADA (Reaproveitamento)
    secaoFichaTecnica.style.display = "block";
    secaoCriacaoArte.style.display = "block";
    if (secaoAprovacaoArte) secaoAprovacaoArte.style.display = "block";
    secaoDivulgacao.style.display = "block";

    // Injetar botão Reaproveitar
    const actionHtmlReaproveitar = `
      <div class="acoes-reaproveitar-wrapper" style="display: flex; gap: 10px; margin-left: auto;">
        <button type="button" class="btn btn-primary" id="btn-reaproveitar-vaga">
          <i class="fas fa-copy"></i> Reaproveitar Vaga
        </button>
      </div>
  `;
    if (btnFecharRodape) {
      btnFecharRodape.insertAdjacentHTML("beforebegin", actionHtmlReaproveitar);
    }
    document.getElementById("btn-reaproveitar-vaga").onclick = () =>
      handleReaproveitarVaga(vagaId);
  }
}

/**
 * NOVO: Salva os dados de Arte e muda o status para Aguardando Aprovação da Arte.
 */
async function handleSalvarEEnviarArte(vagaId, link, observacao) {
  if (!vagaId) return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    const docSnap = await getDoc(vagaRef);
    if (!docSnap.exists()) throw new Error("Vaga não encontrada.");
    const currentArte = docSnap.data().arte || {};

    const newStatus = "aguardando-aprovacao-arte";

    await updateDoc(vagaRef, {
      status: newStatus, // Mudar para o novo status de aprovação de arte
      arte: {
        ...currentArte,
        link: link,
        observacao: observacao,
        status: "Aprovação da Arte",
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Arte e Link salvos. Enviado para Aprovação de Arte.`,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast("Arte enviada para aprovação do Gestor!", "success");
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("arte-pendente"); // Recarrega a aba para refletir a mudança de status
  } catch (error) {
    console.error("Erro ao salvar/enviar Arte:", error);
    window.showToast("Ocorreu um erro ao salvar e enviar a Arte.", "error");
  }
}

/**
 * NOVO: Gera um resumo da vaga usando os dados principais da Ficha Técnica (para a arte).
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
 * NOVO: Função para carregar listas dinâmicas (Departamentos, Regimes, Modalidades) do Firebase.
 */
async function carregarListasFirebase() {
  const selectDepartamento = document.getElementById("vaga-departamento");

  if (!selectDepartamento) return;

  try {
    // 1. Carregar Departamentos
    // Caminho: configuracoesSistema -> geral -> listas (map) -> departamentos (array)
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
    const planoCarreira = document.getElementById("vaga-plano-carreira").value; // Campos da Seção de Arte e Divulgação (Salva mesmo se a seção estiver oculta)

    const resumoArte = document.getElementById("vaga-resumo-arte").value;
    const linkArte = document.getElementById("vaga-link-arte").value;
    const observacaoArte = document.getElementById(
      "vaga-observacao-arte"
    ).value; // Novo campo

    const selectCanais = document.getElementById("vaga-canais-divulgacao");
    const canaisDivulgacao = Array.from(selectCanais.options)
      .filter((option) => option.selected)
      .map((option) => option.value); // 2. CONSTRUÇÃO DO OBJETO DE DADOS

    const vagaData = {
      nome: nome,
      departamento: departamento,
      tipoRecrutamento: tipoRecrutamento,
      regimeTrabalho: regimeTrabalho,
      modalidadeTrabalho: modalidadeTrabalho,
      valorSalario: valorSalario,
      dataFechamento: dataFechamento, // Guarda a data no formato 'YYYY-MM-DD' // Mapeamento dos campos detalhados

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
      }, // Informações da arte e divulgação

      arte: {
        resumo: resumoArte,
        link: linkArte,
        status: "Pendente", // Status só muda por ação dos botões
        observacao: observacaoArte, // Novo campo salvo // alteraçõesPendentes: string
      },
      canaisDivulgacao: canaisDivulgacao,
    };

    const historicoEntry = {
      data: new Date(),
      usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
    };

    let newStatus = "";

    if (isEditing) {
      // Carrega status anterior para decidir o que fazer no histórico
      const vagaDoc = await getDoc(doc(db, VAGAS_COLLECTION_NAME, vagaId));
      const oldStatus = vagaDoc.data().status; // 3. AÇÃO DE EDIÇÃO/ATUALIZAÇÃO // A edição da Ficha só é permitida se a vaga NÃO FOI APROVADA

      if (oldStatus === "em-divulgacao" || oldStatus === "em-recrutamento") {
        window.showToast(
          "Não é possível editar a Ficha Técnica de uma vaga aprovada.",
          "error"
        );
        return;
      }

      newStatus = oldStatus; // Se for em Criação, mantemos o status, mas se o usuário clicar em Salvar e Enviar, muda para aguardando-aprovacao

      if (
        oldStatus === "em-criação" &&
        submitButton.textContent.includes("Aprovação")
      ) {
        newStatus = "aguardando-aprovacao";
        vagaData.status = newStatus;
        vagaData.historico = arrayUnion({
          ...historicoEntry,
          acao: "Ficha Técnica finalizada e enviada para aprovação do gestor.",
        });
      } else {
        // Se for edição em Rascunho (em-criação) ou em Aguardando Aprovação (sem alteração de status)
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
      // 4. AÇÃO DE CRIAÇÃO (Novo Fluxo: Salvar e Enviar para Aprovação do Gestor)
      newStatus = "aguardando-aprovacao";
      vagaData.status = newStatus;
      vagaData.dataCriacao = new Date();
      vagaData.candidatosCount = 0;
      vagaData.historico = [
        {
          ...historicoEntry,
          acao: "Vaga criada (Ficha Técnica) e enviada para aprovação do gestor.",
        },
      ];

      await addDoc(vagasCollection, vagaData);
      window.showToast(
        "Ficha Técnica da Vaga salva com sucesso! Enviada para aprovação do gestor.",
        "success"
      );
    }

    document.getElementById("modal-vaga").style.display = "none"; // Recarrega a lista para o status que será o novo (aguardando-aprovacao)
    carregarVagas(newStatus);
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
 * NOVO: Lida com o salvamento do Link da Arte e Observação
 */
async function handleSalvarArteLink(vagaId, link, observacao) {
  if (!vagaId) return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId); // Busca docSnap para manter o status e resumo atual
    const docSnap = await getDoc(vagaRef);
    if (!docSnap.exists()) throw new Error("Vaga não encontrada.");
    const currentArte = docSnap.data().arte || {};

    await updateDoc(vagaRef, {
      arte: {
        ...currentArte,
        link: link,
        observacao: observacao, // Salva o novo campo de observação
      },
      historico: arrayUnion({
        data: new Date(),
        acao: `Link e Observação da Arte atualizados. Link: ${link}`,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      }),
    });

    window.showToast(
      "Link e Observação da Arte salvos com sucesso.",
      "success"
    ); // Recarrega o modal para exibir o status atualizado
    handleDetalhesVaga(vagaId);
  } catch (error) {
    console.error("Erro ao salvar Link/Observação da Arte:", error);
    window.showToast(
      "Ocorreu um erro ao salvar o Link/Observação da Arte.",
      "error"
    );
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
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("arte-pendente");
  } catch (error) {
    console.error("Erro ao aprovar ficha técnica:", error);
    window.showToast("Ocorreu um erro ao aprovar a ficha técnica.", "error");
  }
}

/**
 * NOVO: Abre um modal para solicitar a justificativa da rejeição.
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
     <h3 style="margin: 0;">Rejeitar Ficha Técnica</h3>
     <button type="button" class="close-modal-btn fechar-modal-rejeicao" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
    </div>
    <div class="modal-body">
     <p>**ATENÇÃO:** Esta ação é irreversível e interromperá o fluxo de aprovação. A vaga será retornada para **'Em Elaboração'** para correção.</p>
     <p>Por favor, informe o motivo da rejeição/cancelamento:</p>
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
        // Chama a rejeição APENAS se o motivo for preenchido
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
 * NOVO: Lida com a Rejeição da Ficha Técnica pelo Gestor (volta para Em Criação).
 * MODIFICADA: Agora recebe a justificativa.
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
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("abertas");
  } catch (error) {
    console.error("Erro ao rejeitar ficha técnica:", error);
    window.showToast("Ocorreu um erro ao rejeitar a ficha técnica.", "error");
  }
}

/**
 * NOVO: Lida com o reaproveitamento de uma vaga (cria nova a partir da antiga).
 */
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

    const vagaOriginal = docSnap.data();

    // 1. Clonar os dados da vaga
    const newVagaData = { ...vagaOriginal };

    // 2. Resetar e atualizar campos de status e histórico
    newVagaData.nome = `REAPROVEITADA: ${vagaOriginal.nome} (Cópia)`;
    newVagaData.status = "em-criação"; // Volta para a fase de rascunho
    newVagaData.dataCriacao = new Date();
    newVagaData.dataFechamento = null;
    newVagaData.dataCancelamento = null;
    newVagaData.dataEncerramento = null;
    newVagaData.candidatosCount = 0;

    // Limpar dados de arte e aprovação para um novo ciclo
    newVagaData.arte = {
      resumo: newVagaData.arte?.resumo || "",
      link: "",
      status: "Pendente",
      observacao: "",
      alteracoesPendentes: null,
    };

    newVagaData.historico = [
      {
        data: new Date(),
        acao: `Vaga criada a partir do reaproveitamento da Vaga ID: ${vagaId}. Enviada para 'Em Elaboração'.`,
        usuario: currentUserData.id || "ID_DO_USUARIO_LOGADO",
      },
    ];

    // 3. Salvar como novo documento
    await addDoc(vagasCollection, newVagaData);

    window.showToast(
      "Vaga reaproveitada com sucesso! Editando nova cópia.",
      "success"
    );

    document.getElementById("modal-vaga").style.display = "none";
    // Recarrega a lista para mostrar a nova vaga
    carregarVagas("abertas");

    // Abre o modal de edição para a nova vaga (o ID é gerado pelo Firestore, precisa ser buscado)
    // Isso requer uma busca mais complexa ou a captura do ID do addDoc.
    // Por simplicidade, recarregaremos a lista e pediremos ao usuário para abrir a nova.
    // Uma implementação mais robusta usaria o ID de retorno do addDoc.
    // Como o ID de retorno não está disponível aqui, apenas recarregamos.
  } catch (error) {
    console.error("Erro ao reaproveitar a vaga:", error);
    window.showToast("Ocorreu um erro ao reaproveitar a vaga.", "error");
  }
}
/**
 * MODIFICADA: Lida com a Aprovação da Arte pelo Gestor (Agora na fase 'aguardando-aprovacao-arte').
 */
async function handleAprovarArte() {
  const vagaId = formVaga.getAttribute("data-vaga-id");
  if (!vagaId || !confirm("Confirma a APROVAÇÃO da arte de divulgação?"))
    return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    const docSnap = await getDoc(vagaRef);
    if (!docSnap.exists()) throw new Error("Vaga não encontrada.");

    await updateDoc(vagaRef, {
      status: "em-divulgacao", // Próxima fase: em Divulgação
      arte: {
        ...docSnap.data().arte,
        status: "Aprovada",
        alteracoesPendentes: null, // Limpa qualquer pendência
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
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("em-divulgacao");
  } catch (error) {
    console.error("Erro ao aprovar arte:", error);
    window.showToast("Ocorreu um erro ao aprovar a arte.", "error");
  }
}

/**
 * NOVO: Lida com a Solicitação de Alterações na Arte.
 */
async function handleSolicitarAlteracoes(vagaId, alteracoes) {
  // O vagaId já é passado, e as alterações vêm do novo modal.
  if (!vagaId || !alteracoes) {
    window.showToast(
      "Erro: ID da vaga ou descrição das alterações ausente.",
      "error"
    );
    return;
  }

  if (!confirm("Confirma a SOLICITAÇÃO de alterações na arte?")) return; // Removido o bloqueio do botão de envio, pois ele é interno ao modal agora.

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    const docSnap = await getDoc(vagaRef);
    if (!docSnap.exists()) throw new Error("Vaga não encontrada.");

    await updateDoc(vagaRef, {
      status: "arte-pendente",
      arte: {
        ...docSnap.data().arte,
        status: "Alteração Solicitada",
        alteracoesPendentes: alteracoes, // Usa a variável alteracoes
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
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("arte-pendente");
  } catch (error) {
    console.error("Erro ao solicitar alterações na arte:", error);
    window.showToast("Ocorreu um erro ao solicitar alterações.", "error");
  }
}

/**
 * NOVO: Lida com o Cancelamento da Divulgação.
 */
async function handleCancelarDivulgacao() {
  const vagaId = formVaga.getAttribute("data-vaga-id");
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
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("fechadas"); // Exibe vagas canceladas/encerradas na aba Fechadas
  } catch (error) {
    console.error("Erro ao cancelar a vaga:", error);
    window.showToast("Ocorreu um erro ao cancelar a vaga.", "error");
  }
}

/**
 * NOVO: Lida com o Encerramento da Vaga (pós-recrutamento ou por outro motivo).
 */
async function handleEncerrarVaga() {
  const vagaId = formVaga.getAttribute("data-vaga-id");
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
    document.getElementById("modal-vaga").style.display = "none";
    carregarVagas("fechadas"); // Exibe vagas canceladas/encerradas na aba Fechadas
  } catch (error) {
    console.error("Erro ao encerrar a vaga:", error);
    window.showToast("Ocorreu um erro ao encerrar a vaga.", "error");
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
  ); // 2. Consulta Ampla (Para Contagem Global)

  const allStatuses = [
    "em-criação",
    "aguardando-aprovacao",
    "arte-pendente",
    "aguardando-aprovacao-arte", // NOVO
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
    "aprovacao-arte": 0, // NOVO
    "em-divulgacao": 0,
    fechadas: 0,
  }; // 1. Contagem GLOBAL

  snapshotContagem.docs.forEach((doc) => {
    const vaga = doc.data();

    if (vaga.status === "em-criação") {
      counts["abertas"]++;
    }

    if (vaga.status === "aguardando-aprovacao") counts["aprovacao-gestao"]++;
    if (vaga.status === "arte-pendente") counts["arte-pendente"]++;
    if (vaga.status === "aguardando-aprovacao-arte") counts["aprovacao-arte"]++; // NOVO: Conta vagas na fila de Aprovação da Arte
    if (vaga.status === "em-divulgacao") counts["em-divulgacao"]++;
    if (vaga.status === "cancelada" || vaga.status === "encerrada")
      counts["fechadas"]++;
  }); // 2. Renderização (Mantida)

  snapshotConteudo.docs.forEach((doc) => {
    const vaga = doc.data();
    vaga.id = doc.id;
    count++;

    const statusFormatado = vaga.status
      .toUpperCase()
      .replace(/-/g, " ")
      .replace("APROVACAO GESTAO", "AGUARDANDO APROVAÇÃO")
      .replace("APROVACAO ARTE", "AGUARDANDO APROVAÇÃO ARTE"); // NOVO

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
  }); // Atualiza os contadores em todos os botões de status

  document.querySelectorAll(".status-tabs .tab-link").forEach((btn) => {
    const btnStatus = btn.getAttribute("data-status");
    const countValue = counts[btnStatus] || 0;

    let tabText = btnStatus;
    if (btnStatus === "aprovacao-gestao") tabText = "Aguardando Aprovação";
    if (btnStatus === "arte-pendente") tabText = "Criação da Arte";
    if (btnStatus === "aprovacao-arte") tabText = "Aprovação da Arte"; // NOVO: Rótulo correto para a nova aba
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
 * Função para configurar o modal para criação de uma nova vaga.
 * NOTA: Esta função precisa ser definida no escopo principal.
 */
function openNewVagaModal() {
  if (formVaga) {
    formVaga.reset();
    formVaga.removeAttribute("data-vaga-id"); // Remove ID para indicar criação
  }
  if (modalTitle) modalTitle.textContent = "Nova Vaga - Ficha Técnica"; // NOVO: Exibe apenas a primeira etapa (Ficha Técnica)

  gerenciarEtapasModal("em-criação");

  if (modalVaga) modalVaga.style.display = "flex";
}

/**
 * Função para buscar e exibir os detalhes de uma vaga para edição.
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
    const statusAtual = vaga.status || "em-criação";
    const isVagaFechada =
      statusAtual === "cancelada" || statusAtual === "encerrada"; // 1. Pré-preenchimento (mantido)

    if (formVaga) formVaga.setAttribute("data-vaga-id", vagaId);
    // Armazena todos os dados da vaga para uso em gerenciarEtapasModal (ex: preenchimento da seção de aprovação)
    formVaga.setAttribute("data-vaga-data", JSON.stringify(vaga));
    if (modalTitle) modalTitle.textContent = `Vaga: ${vaga.nome}`;

    await carregarListasFirebase();

    document.getElementById("vaga-nome").value = vaga.nome || "";

    const selectDepartamento = document.getElementById("vaga-departamento");
    if (selectDepartamento) {
      selectDepartamento.value = vaga.departamento || "";
    }

    // (O restante do preenchimento dos campos é mantido para clareza)
    document.getElementById("vaga-tipo-recrutamento").value =
      vaga.tipoRecrutamento || "";
    document.getElementById("vaga-regime-trabalho").value =
      vaga.regimeTrabalho || "";
    document.getElementById("vaga-modalidade-trabalho").value =
      vaga.modalidadeTrabalho || "";
    document.getElementById("vaga-valor-salario").value =
      vaga.valorSalario || "";
    document.getElementById("vaga-data-fechamento").value =
      vaga.dataFechamento || "";

    document.getElementById("vaga-responsabilidades").value =
      vaga.cargo?.responsabilidades || "";
    document.getElementById("vaga-resultados").value =
      vaga.cargo?.resultados || "";
    document.getElementById("vaga-nova-substituicao").value =
      vaga.cargo?.novaSubstituicao || "";
    document.getElementById("vaga-formacao-minima").value =
      vaga.formacao?.minima || "";
    document.getElementById("vaga-conselho").value =
      vaga.formacao?.conselho || "";
    document.getElementById("vaga-especializacoes").value =
      vaga.formacao?.especializacoes || "";
    document.getElementById("vaga-comp-tecnicas").value =
      vaga.competencias?.tecnicas || "";
    document.getElementById("vaga-comp-comportamentais").value =
      vaga.competencias?.comportamentais || "";
    document.getElementById("vaga-certificacoes").value =
      vaga.competencias?.certificacoes || "";
    document.getElementById("vaga-nivel-experiencia").value =
      vaga.experiencia?.nivel || "";
    document.getElementById("vaga-contextos-similares").value =
      vaga.experiencia?.contextosSimilares || "";
    document.getElementById("vaga-atuacao-grupos").value =
      vaga.experiencia?.atuacaoGrupos || "";
    document.getElementById("vaga-fit-valores").value =
      vaga.fitCultural?.valoresEuPsico || "";
    document.getElementById("vaga-estilo-equipe").value =
      vaga.fitCultural?.estiloEquipe || "";
    document.getElementById("vaga-perfil-destaque").value =
      vaga.fitCultural?.perfilDestaque || "";
    document.getElementById("vaga-oportunidades").value =
      vaga.crescimento?.oportunidades || "";
    document.getElementById("vaga-desafios").value =
      vaga.crescimento?.desafios || "";
    document.getElementById("vaga-plano-carreira").value =
      vaga.crescimento?.planoCarreira || "";

    // NOVOS CAMPOS ARTE E DIVULGAÇÃO (Mantido)
    const resumoArteField = document.getElementById("vaga-resumo-arte");
    const linkArteField = document.getElementById("vaga-link-arte");
    const obsArteField = document.getElementById("vaga-observacao-arte");
    linkArteField.value = vaga.arte?.link || "";
    obsArteField.value = vaga.arte?.observacao || "";
    if (!vaga.arte?.resumo) {
      resumoArteField.value = gerarResumoVaga(vaga);
    } else {
      resumoArteField.value = vaga.arte.resumo;
    }

    // 2. Preencher a seção de Revisão (NOVO)
    const linkParaRevisao = vaga.arte?.link || "N/A";
    const obsParaRevisao = vaga.arte?.observacao || "Nenhuma observação.";

    if (document.getElementById("link-arte-clicavel")) {
      const linkElement = document.getElementById("link-arte-clicavel");
      linkElement.textContent =
        linkParaRevisao !== "N/A" ? linkParaRevisao : "N/A";
      linkElement.href = linkParaRevisao !== "N/A" ? linkParaRevisao : "#";
      linkElement.style.pointerEvents =
        linkParaRevisao !== "N/A" ? "auto" : "none"; // Desabilita clique se N/A
    }
    if (document.getElementById("aprovacao-obs-arte-visual")) {
      document.getElementById("aprovacao-obs-arte-visual").textContent =
        obsParaRevisao;
    }

    // 3. Gerencia a exibição da etapa
    gerenciarEtapasModal(statusAtual);

    document.getElementById("status-arte-atual").textContent =
      vaga.arte?.status || "Pendente"; // Habilita/desabilita campos se for vaga fechada/cancelada

    if (isVagaFechada) {
      modalVaga.querySelectorAll("input, select, textarea").forEach((field) => {
        field.disabled = true;
      });
    }

    if (modalVaga) modalVaga.style.display = "flex";
  } catch (error) {
    console.error("Erro ao carregar detalhes da vaga:", error);
    window.showToast("Erro ao carregar os dados para edição.", "error");
  }
}

/**
 * Função de inicialização principal do módulo.
 */
async function initgestaovagas(user, userData) {
  console.log("🔹 Iniciando Módulo de Gestão de Vagas e Recrutamento...");

  currentUserData = userData || {};

  if (modalVaga) modalVaga.style.display = "none";

  const btnNovaVaga = document.getElementById("btn-nova-vaga"); // 1. Carrega as listas dinâmicas (Departamentos)

  await carregarListasFirebase(); // 2. Configura eventos de UI

  if (btnNovaVaga) {
    // CORREÇÃO: A função openNewVagaModal é agora acessível no escopo
    btnNovaVaga.addEventListener("click", openNewVagaModal);
  } // NOVO: Adiciona eventos aos botões de controle de fluxo no modal

  if (btnCancelarVaga) {
    btnCancelarVaga.addEventListener("click", handleCancelarDivulgacao);
  }
  if (btnEncerrarVaga) {
    btnEncerrarVaga.addEventListener("click", handleEncerrarVaga);
  } // Configura evento de fechamento do modal

  document.querySelectorAll(".fechar-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      // NOVO: Remove botões dinâmicos ao fechar o modal
      const dynamicButtonsFicha = modalVaga.querySelector(
        ".acoes-aprovacao-ficha-wrapper"
      );
      if (dynamicButtonsFicha) dynamicButtonsFicha.remove();
      const dynamicButtonsArte = modalVaga.querySelector(".acoes-arte-wrapper");
      if (dynamicButtonsArte) dynamicButtonsArte.remove();

      if (modalVaga) modalVaga.style.display = "none";
    });
  }); // Configura submissão do formulário (Salvar Ficha Técnica)

  if (formVaga) {
    formVaga.addEventListener("submit", handleSalvarVaga);
  } // 3. Carrega a lista inicial (vagas abertas)

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
