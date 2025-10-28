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
  getDoc, // Adicionado getDoc para buscar uma única vaga na edição
  arrayUnion,
} from "../../../assets/js/firebase-init.js";

// Importa a função do novo utilitário user-management (mantido)
import { fetchUsersByRole } from "../../../assets/js/utils/user-management.js";

// Importações do Firebase atualizadas
import { arrayRemove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// NOVO: Define a constante para o nome da coleção
const VAGAS_COLLECTION_NAME = "vagas"; // COLEÇÃO CORRETA: vagas
const CONFIG_COLLECTION_NAME = "configuracoesSistema"; // Para buscar listas globais

// Coleção principal no Firestore para as vagas
const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);

// NOVO: Adiciona o ID do modal de rejeição
const ID_MODAL_REJEICAO = "modal-rejeicao-ficha";

// Elementos do DOM globais
const modalVaga = document.getElementById("modal-vaga");
const formVaga = document.getElementById("form-vaga");
const modalTitle = modalVaga ? modalVaga.querySelector("h3") : null;
const btnSalvar = document.getElementById("btn-salvar-vaga");

// Elementos de novas ações (Removido btnExcluir)
const btnCancelarVaga = document.getElementById("btn-cancelar-vaga");
const btnEncerrarVaga = document.getElementById("btn-encerrar-vaga");

// Elementos de controle de etapa
const secaoFichaTecnica = document.getElementById("secao-ficha-tecnica");
const secaoCriacaoArte = document.getElementById("secao-criacao-arte");
const secaoDivulgacao = document.getElementById("secao-divulgacao");

// Elementos da Seção Arte
// Os botões abaixo foram removidos do HTML, mas mantemos o ID para referência, se necessário
const caixaAlteracoesArte = document.getElementById("caixa-alteracoes-arte");
const btnEnviarAlteracoes = document.getElementById("btn-enviar-alteracoes");

let currentUserData = {}; // Para armazenar os dados do usuário logado

/**
 * NOVO: Gera um resumo da vaga usando os dados principais da Ficha Técnica.
 * @param {object} vaga - O objeto de dados da vaga.
 * @returns {string} O resumo formatado.
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
    } // 2. Os campos Regime de Trabalho e Modalidade já estão no HTML, // mas se forem dinâmicos, a lógica de busca do Firebase seria adicionada aqui.
  } catch (error) {
    console.error("Erro ao carregar listas do Firebase:", error);
    window.showToast("Erro ao carregar listas de configuração.", "error");
  }
}

/**
 * NOVO: Gerencia a exibição das etapas no modal com base no status da vaga.
 * @param {string} status - Status atual da vaga ('em-criação', 'aguardando-aprovacao', 'arte-pendente', 'em-divulgacao', etc.).
 */
function gerenciarEtapasModal(status) {
  // Elemento do botão Fechar (botão estático no HTML)
  const btnFecharRodape = modalVaga.querySelector(
    ".modal-footer .fechar-modal"
  );

  // Elementos do Modal Header (Botão X)
  const btnFecharHeader = modalVaga.querySelector(
    ".modal-header .close-modal-btn"
  );
  if (btnFecharHeader) btnFecharHeader.style.display = "block"; // Garante que o X esteja sempre visível // Oculta todas as seções por padrão

  secaoFichaTecnica.style.display = "none";
  secaoCriacaoArte.style.display = "none";
  secaoDivulgacao.style.display = "none";
  btnCancelarVaga.style.display = "none";
  btnEncerrarVaga.style.display = "none";
  btnSalvar.style.display = "none"; // NOVO: Remove botões dinâmicos anteriores

  const dynamicButtonsWrapper = modalVaga.querySelector(
    ".acoes-aprovacao-ficha-wrapper"
  );
  if (dynamicButtonsWrapper) dynamicButtonsWrapper.remove();
  const dynamicButtonsArteWrapper = modalVaga.querySelector(
    ".acoes-arte-wrapper"
  );
  if (dynamicButtonsArteWrapper) dynamicButtonsArteWrapper.remove(); // Visibilidade do botão Fechar do rodapé

  if (btnFecharRodape) {
    btnFecharRodape.style.display = "inline-block"; // Padrão: visível
  }

  const isVagaAprovada =
    status === "em-divulgacao" || status === "em-recrutamento";
  const isVagaAtiva =
    status !== "cancelada" && status !== "encerrada" && status !== "fechadas";
  const isVagaBloqueada = isVagaAprovada || status === "aguardando-aprovacao"; // Habilita/Desabilita campos da Ficha Técnica (Requisito: não permitir alteração de vaga aprovada ou pendente de aprovação)

  const inputsFichaTecnica = secaoFichaTecnica.querySelectorAll(
    "input, select, textarea"
  );
  inputsFichaTecnica.forEach((input) => {
    input.disabled = isVagaBloqueada;
  }); // Define qual seção e quais botões mostrar

  if (status === "em-criação") {
    // Fase 1.0: Rascunho da Ficha Técnica
    secaoFichaTecnica.style.display = "block";
    btnSalvar.textContent = "Salvar e Enviar para Aprovação";
    btnSalvar.style.display = "inline-block"; // REQUISITO: Remover Cancelar Vaga e Fechar do rodapé

    btnCancelarVaga.style.display = "none";
    if (btnFecharRodape) btnFecharRodape.style.display = "none";
  } else if (status === "aguardando-aprovacao") {
    // Fase 1.1: Aprovação da Ficha Técnica (3 Botões alinhados)
    secaoFichaTecnica.style.display = "block"; // REQUISITO: Remover botão Fechar do rodapé

    if (btnFecharRodape) btnFecharRodape.style.display = "none"; // REQUISITO: Exibir Cancelar Vaga (estático)

    btnCancelarVaga.style.display = "inline-block"; // Esconde o Salvar

    btnSalvar.style.display = "none"; // Adiciona botões de ação dinâmicos em um wrapper // A ordem será: [Solicitar Alterações] [Aprovar] (junto com o Cancelar Vaga estático)

    const actionHtml = `
            <div class="acoes-aprovacao-ficha-wrapper">
                <button type="button" class="btn btn-alteração" id="btn-rejeitar-ficha">
                    <i class="fas fa-times-circle"></i> Solicitar Alterações
                </button>
                <button type="button" class="btn btn-success" id="btn-aprovar-ficha">
                    <i class="fas fa-check"></i> Aprovar
                </button>
            </div>
        `; // Injeta os botões dinâmicos no modal-footer, ANTES do Fechar e Salvar

    const salvarModalBtn = modalVaga.querySelector("#btn-salvar-vaga");
    if (salvarModalBtn) {
      salvarModalBtn.insertAdjacentHTML("beforebegin", actionHtml);
    } // Configura os eventos dos novos botões dinâmicos

    const vagaId = formVaga.getAttribute("data-vaga-id");
    document.getElementById("btn-aprovar-ficha").onclick = () =>
      handleAprovarFichaTecnica(vagaId);
    document.getElementById("btn-rejeitar-ficha").onclick = () =>
      modalRejeicaoFichaTecnica(vagaId);
  } else if (status === "arte-pendente") {
    // Fase 2: Criação/Aprovação da Arte
    secaoCriacaoArte.style.display = "block";
    btnSalvar.style.display = "none"; // Salvar só existe para Alterações Solicitadas // REQUISITO: Remover Cancelar Vaga nesta fase

    btnCancelarVaga.style.display = "none";
    if (btnFecharRodape) btnFecharRodape.style.display = "inline-block";

    // --- INJEÇÃO DOS BOTÕES NO RODAPÉ (Aprovar/Solicitar/Salvar Link) ---
    const actionHtmlArte = `
        <div class="acoes-arte-wrapper">
            <button type="button" class="btn btn-primary" id="btn-salvar-link-arte">
                <i class="fas fa-save"></i> Salvar Link/Obs
            </button>
            <button type="button" class="btn btn-warning" id="btn-solicitar-alteracoes-arte">
                <i class="fas fa-edit"></i> Solicitar Alterações
            </button>
            <button type="button" class="btn btn-success" id="btn-aprovar-arte-final">
                <i class="fas fa-check"></i> Aprovar Arte
            </button>
        </div>
    `;

    // Injeta o wrapper antes dos botões de encerramento/fechar estáticos
    const fecharModalBtn = modalVaga.querySelector(".fechar-modal");
    if (fecharModalBtn) {
      fecharModalBtn.insertAdjacentHTML("beforebegin", actionHtmlArte);
      // Oculta os botões estáticos Encerrar/Salvar para priorizar os da Arte,
      // mas deixa o 'Fechar' estático visível.
      btnEncerrarVaga.style.display = "none";
      btnSalvar.style.display = "none";
    }

    // --- LÓGICA DE EVENTOS E FLUXO DA ARTE ---
    const btnSalvarLink = document.getElementById("btn-salvar-link-arte");
    const btnSolicitarRodape = document.getElementById(
      "btn-solicitar-alteracoes-arte"
    );
    const btnAprovarRodape = document.getElementById("btn-aprovar-arte-final");

    const inputLink = document.getElementById("vaga-link-arte");
    const inputObs = document.getElementById("vaga-observacao-arte");

    // 1. Configura Salvar Link/Observação
    if (btnSalvarLink) {
      btnSalvarLink.onclick = () =>
        handleSalvarArteLink(vagaId, inputLink.value, inputObs.value);
    }

    // 2. Configura Aprovação
    if (btnAprovarRodape) {
      btnAprovarRodape.onclick = () => handleAprovarArte();
    }

    // 3. Configura Solicitação de Alteração
    if (btnSolicitarRodape) {
      btnSolicitarRodape.onclick = () => {
        // Ao clicar em Solicitar, exibe o campo de texto de alterações
        if (caixaAlteracoesArte) caixaAlteracoesArte.style.display = "block";

        // Esconde os botões do rodapé enquanto o campo de texto está ativo,
        // forçando o usuário a usar o "Enviar Solicitação de Alterações" do corpo
        btnSolicitarRodape.style.display = "none";
        btnAprovarRodape.style.display = "none";
        btnSalvarLink.style.display = "none";
      };
    }

    // 4. Configura o envio da solicitação (botão dentro da caixa de texto - que chama handleSolicitarAlteracoes)
    if (btnEnviarAlteracoes) {
      btnEnviarAlteracoes.onclick = () => handleSolicitarAlteracoes();
    }

    // Esconde a caixa de texto de alteração por padrão (feito no início da função)
    caixaAlteracoesArte.style.display = "none";
  } else if (isVagaAprovada) {
    // Fase 3: Em Divulgação (Pós-Aprovação da Arte)
    secaoDivulgacao.style.display = "block";
    btnSalvar.textContent = "Salvar Canais de Divulgação";
    btnSalvar.style.display = "inline-block"; // Exibir Cancelar Vaga e Encerrar Vaga

    if (isVagaAtiva) {
      btnCancelarVaga.style.display = "inline-block";
      if (status !== "em-criação" && status !== "aguardando-aprovacao") {
        btnEncerrarVaga.style.display = "inline-block";
      }
    }
  }
}

// ... (restante do código: openNewVagaModal, handleDetalhesVaga, handleSalvarVaga, etc.)

/**
 * NOVO: Lida com o salvamento do Link da Arte e Observação
 * @param {string} vagaId
 * @param {string} link
 * @param {string} observacao
 */
async function handleSalvarArteLink(vagaId, link, observacao) {
  if (!vagaId) return;

  try {
    const vagaRef = doc(db, VAGAS_COLLECTION_NAME, vagaId);
    // Busca docSnap para manter o status e resumo atual
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
    );
  } catch (error) {
    console.error("Erro ao salvar Link/Observação da Arte:", error);
    window.showToast(
      "Ocorreu um erro ao salvar o Link/Observação da Arte.",
      "error"
    );
  }
}
// ...
