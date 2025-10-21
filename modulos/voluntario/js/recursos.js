// eupsico/intranet-1/intranet-1-3f5b28aea177748beae753ef1bee8bfd1916ed36/modulos/voluntario/js/recursos.js
// CORRIGIDO

// Arquivo: /modulos/voluntario/js/recursos.js
// Versão 3.0 (Padronizado para Padrão 2: Pré-Renderizado + Hash)

// --- IMPORTAÇÕES ESTÁTICAS ---
// Importe TODOS os módulos JS que controlam o conteúdo das abas aqui
import * as Disponibilidade from "./disponibilidade.js";
import * as AlterarGrade from "./alterar-grade.js";
import * as GradeView from "./grade-view.js";
// Adicione imports para outros módulos de abas se houver

export function init(user, userData) {
  console.log("[Recursos Init V3.0] Módulo Iniciado (Padrão Pré-Renderizado).");
  const view = document.querySelector(".view-container");
  if (!view) {
    console.error(
      "[Recursos Init] Erro Fatal: .view-container não encontrado."
    );
    return;
  }

  let tabContainer = view.querySelector(".tabs-container"); // Container dos botões/links
  const tabContentContainer = view.querySelector(".tab-content"); // Container PAI dos conteúdos

  if (!tabContainer) {
    console.error("[Recursos Init] Erro: .tabs-container não encontrado.");
    // Considere se a falta dos botões é um erro fatal ou não
  }
  if (!tabContentContainer) {
    console.error(
      "[Recursos Init] Erro CRÍTICO: Container PAI .tab-content não encontrado. As abas não funcionarão."
    );
    return; // Sem o container pai, não há onde mostrar o conteúdo.
  }

  // Guarda os IDs das abas cujo JS já foi inicializado com sucesso
  const initializedTabs = new Set();

  // Mapeamento de tabId para o módulo JS correspondente e seus parâmetros
  const tabModules = {
    disponibilidade: { module: Disponibilidade, params: [user, userData] },
    "alterar-grade": { module: AlterarGrade, params: [user, userData] },
    "grade-online": { module: GradeView, params: [user, userData, "online"] },
    "grade-presencial": {
      module: GradeView,
      params: [user, userData, "presencial"],
    },
    // Adicione mapeamentos para outras abas aqui
    // 'outra-aba': { module: OutroModulo, params: [user, userData] }
  };

  // --- FUNÇÃO initializeTabScript ---
  // Responsável por chamar a função init do módulo da aba, apenas uma vez.
  const initializeTabScript = async (tabId) => {
    // Não inicializa se ID for inválido OU se já foi inicializado com SUCESSO antes
    if (!tabId || initializedTabs.has(tabId)) {
      return;
    }
    console.log(`[InitializeTab ${tabId}] Tentando inicializar script...`);

    const tabConfig = tabModules[tabId];
    const targetContentEl = tabContentContainer.querySelector(`#${tabId}`); // Busca dentro do container pai

    if (!targetContentEl) {
      console.error(
        `[InitializeTab ${tabId}] ERRO CRÍTICO: Elemento de conteúdo #${tabId} NÃO encontrado no HTML.`
      );
      return; // Não pode inicializar sem o container
    }

    if (
      tabConfig &&
      tabConfig.module &&
      typeof tabConfig.module.init === "function"
    ) {
      // Mostra um spinner simples se o conteúdo estiver vazio (opcional, pode ser melhorado)
      let spinner = null;
      if (
        targetContentEl.innerHTML.trim() === "" ||
        targetContentEl.textContent.includes("Carregando")
      ) {
        targetContentEl.innerHTML =
          '<div class="loading-spinner" style="margin: 30px auto;"></div>';
        spinner = targetContentEl.querySelector(".loading-spinner");
      }

      try {
        console.log(`[InitializeTab ${tabId}] Chamando init() do módulo...`);
        await tabConfig.module.init(...tabConfig.params);
        console.log(
          `[InitializeTab ${tabId}] Script inicializado com sucesso.`
        );
        initializedTabs.add(tabId); // Marca como inicializado SOMENTE após sucesso

        // Remove o spinner APÓS a inicialização (se ele foi adicionado)
        // A função init do módulo pode ter preenchido o conteúdo.
        if (spinner && spinner.parentNode === targetContentEl) {
          spinner.remove();
        } else if (targetContentEl.querySelector(".loading-spinner")) {
          // Remove caso o init() não limpe o conteúdo e o spinner ainda exista
          targetContentEl.querySelector(".loading-spinner").remove();
        }
      } catch (error) {
        console.error(
          `[InitializeTab ${tabId}] ERRO during a inicialização do script:`,
          error
        );
        if (targetContentEl) {
          // Remove spinner em caso de erro também
          const errorSpinner =
            targetContentEl.querySelector(".loading-spinner");
          if (errorSpinner) errorSpinner.remove();
          targetContentEl.innerHTML = `<p class="alert alert-error" style="color: red; padding: 10px; border: 1px solid red;">Ocorreu um erro grave ao inicializar este recurso (${tabId}). Verifique o console.</p>`;
        }
      }
    } else {
      console.warn(
        `[InitializeTab ${tabId}] Nenhuma função init válida encontrada no módulo mapeado ou módulo não mapeado.`
      );
      // Opcional: Limpar placeholder de carregamento se não houver script
      if (targetContentEl.textContent.includes("Carregando")) {
        targetContentEl.innerHTML = `<p>Conteúdo para '${tabId}' não disponível ou script não configurado.</p>`;
      }
      // Marcar como "inicializado" para não tentar de novo? Depende.
      // initializedTabs.add(tabId);
    }
  };

  // --- FUNÇÃO switchTab SIMPLIFICADA ---
  // Apenas gerencia a visibilidade e chama a inicialização do script
  const switchTab = (tabId) => {
    console.log(`[SwitchTab V3.0] Tentando trocar para aba: ${tabId}`);

    if (!tabContainer || !tabContentContainer) {
      console.error(
        "[SwitchTab] Erro: Container de botões ou de conteúdo não encontrados."
      );
      return;
    }

    const targetContent = tabContentContainer.querySelector(`#${tabId}`);

    // --- VERIFICAÇÃO ESSENCIAL ---
    if (!targetContent) {
      console.error(
        `[SwitchTab] Erro CRÍTICO: Conteúdo da aba #${tabId} não encontrado no DOM. Verifique o HTML.`
      );
      // Tenta voltar para a aba padrão se a alvo não existe
      const defaultTabId = "disponibilidade"; // Defina sua aba padrão
      if (
        tabId !== defaultTabId &&
        tabContentContainer.querySelector(`#${defaultTabId}`)
      ) {
        console.warn(
          `[SwitchTab] Redirecionando para aba padrão '${defaultTabId}'.`
        );
        // Atualiza o hash para refletir a mudança (evita loops se o hashchange chamou)
        // window.location.hash = `#recursos/${defaultTabId}`; // Cuidado com loops
        switchTab(defaultTabId); // Chama recursivamente para a padrão
      } else {
        console.error("[SwitchTab] Aba padrão também não encontrada!");
      }
      return; // Não continua se o conteúdo alvo não existe
    }

    // 1. ATUALIZA BOTÕES
    let foundButton = false;
    tabContainer.querySelectorAll(".tab-link").forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle("active", isActive);
      if (isActive) foundButton = true;
    });
    if (!foundButton)
      console.warn(`[SwitchTab] Botão para aba ${tabId} não encontrado.`);

    // 2. ATUALIZA CONTEÚDO (Visibilidade)
    const allContentSections = tabContentContainer.querySelectorAll(
      ":scope > .tab-content"
    ); // :scope garante filhos diretos
    let foundContent = false;
    allContentSections.forEach((section) => {
      const isActive = section.id === tabId;
      section.classList.toggle("active", isActive);
      section.style.display = isActive ? "block" : "none"; // Controle direto de display
      if (isActive) foundContent = true;
    });

    if (!foundContent) {
      // Isso não deveria acontecer se targetContent foi encontrado antes, mas é uma segurança.
      console.error(
        `[SwitchTab] Div de conteúdo #${tabId} encontrada inicialmente mas não atualizada corretamente.`
      );
      // Forçar exibição como último recurso
      targetContent.classList.add("active");
      targetContent.style.display = "block";
    }

    // 3. CHAMA A INICIALIZAÇÃO DO SCRIPT DA ABA (se necessário)
    // A função interna `initializeTabScript` verifica se já foi inicializada.
    console.log(
      `[SwitchTab ${tabId}] Chamando initializeTabScript (se necessário)...`
    );
    initializeTabScript(tabId); // Não precisa de await aqui, pode inicializar em background

    console.log(`[SwitchTab ${tabId}] Troca visual concluída.`);
  };

  // --- Lógica de Clonagem e Event Listeners (Mantida) ---
  if (tabContainer) {
    // Clonar para remover listeners antigos pode ser útil se este init for chamado múltiplas vezes
    const newTabContainer = tabContainer.cloneNode(true);
    if (tabContainer.parentNode) {
      tabContainer.parentNode.replaceChild(newTabContainer, tabContainer);
      tabContainer = newTabContainer; // ATUALIZA a variável
      console.log("[Recursos Init] tabContainer clonado e substituído.");

      tabContainer.addEventListener("click", (e) => {
        const clickedTab = e.target.closest(".tab-link");
        if (clickedTab && clickedTab.dataset.tab) {
          e.preventDefault(); // Previne navegação padrão do link '#'
          const tabId = clickedTab.dataset.tab;
          const newHash = `#recursos/${tabId}`;
          if (window.location.hash !== newHash) {
            console.log(
              `[Click Listener] Aba ${tabId} clicada. Mudando hash para ${newHash}`
            );
            window.location.hash = newHash; // Dispara o hashchange
          } else {
            console.log(
              `[Click Listener] Aba ${tabId} clicada, hash já é ${newHash}. Forçando inicialização (se pendente).`
            );
            // Se clicar na aba ativa, garante que o script seja inicializado
            initializeTabScript(tabId);
          }
        }
      });
    } else {
      console.error(
        "[Recursos Init] Erro: Pai do tabContainer não encontrado durante clonagem."
      );
      tabContainer = null;
    }
  } else {
    console.warn(
      "[Recursos Init] .tabs-container (botões das abas) não encontrado."
    );
  }

  // --- handleHashChange (Mantida e ligeiramente ajustada) ---
  const handleHashChange = () => {
    console.log(`[HashChange V3.0] Hash atual: ${window.location.hash}`);
    const hashParts = window.location.hash.substring(1).split("/");
    let targetTabId = "disponibilidade"; // Defina sua aba padrão aqui

    if (hashParts[0] === "recursos" && hashParts[1]) {
      // Verifica se existe um BOTÃO para a aba no hash
      if (
        tabContainer &&
        tabContainer.querySelector(`.tab-link[data-tab="${hashParts[1]}"]`)
      ) {
        // Verifica também se o CONTEÚDO para essa aba existe no HTML
        if (tabContentContainer.querySelector(`#${hashParts[1]}`)) {
          targetTabId = hashParts[1];
          console.log(
            `[HashChange] Hash aponta para aba existente e com conteúdo: ${targetTabId}`
          );
        } else {
          console.warn(
            `[HashChange] Aba "${hashParts[1]}" existe no botão mas CONTEÚDO não encontrado no HTML. Usando padrão '${targetTabId}'.`
          );
          // Opcional: Remover o hash inválido ou redirecionar para o padrão
          // window.history.replaceState(null, '', `#recursos/${targetTabId}`);
        }
      } else {
        console.warn(
          `[HashChange] Botão para aba "${hashParts[1]}" (do hash) não encontrado. Usando padrão '${targetTabId}'.`
        );
        // Opcional: Remover o hash inválido ou redirecionar para o padrão
        // window.history.replaceState(null, '', `#recursos/${targetTabId}`);
      }
    } else {
      console.log(
        `[HashChange] Hash não corresponde a '#recursos/[aba]'. Usando padrão '${targetTabId}'.`
      );
      // Opcional: Definir o hash padrão na URL se não houver um válido
      // window.history.replaceState(null, '', `#recursos/${targetTabId}`);
    }

    // Chama switchTab para ativar a aba correta (visualmente) e disparar a inicialização do script (se necessário)
    switchTab(targetTabId);
  };

  // Listener para quando o hash na URL muda
  window.addEventListener("hashchange", handleHashChange);

  // Chama handleHashChange na inicialização para carregar a aba correta
  console.log(
    "[Recursos Init] Chamando handleHashChange para carregar aba inicial."
  );

  // CORREÇÃO: Aumentado o timeout de 0 para 100ms.
  // Isso dá ao navegador tempo para renderizar o HTML injetado
  // (recursos.html) antes que os scripts das abas (disponibilidade.js)
  // tentem encontrar seus containers (ex: #disponibilidade).
  setTimeout(handleHashChange, 100);

  console.log("[Recursos Init] Inicialização V3.0 concluída.");
} // Fim da função init
