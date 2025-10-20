// Arquivo: /modulos/voluntario/js/recursos.js
// Versão 2.4 (Combina correção de clonagem e lógica de abas com classList/requestAnimationFrame)

export function init(user, userData) {
  console.log("Módulo Recursos do Voluntário iniciado."); // Log para depuração
  const view = document.querySelector(".view-container");
  if (!view) {
    console.error("Erro: .view-container não encontrado.");
    return;
  }

  // Define as variáveis DEPOIS da clonagem, se aplicável
  let tabContainer = view.querySelector(".tabs-container");
  const contentSections = view.querySelectorAll(".tab-content");
  const loadedTabs = new Set();

  if (!tabContainer) {
    console.error("Erro: .tabs-container não encontrado.");
    // Poderia tentar continuar sem a lógica de clique, mas é melhor parar se as abas não existirem
    // return;
  }
  if (!contentSections || contentSections.length === 0) {
    console.error("Erro: Nenhum .tab-content encontrado.");
    // Poderia tentar continuar, mas a troca de conteúdo falhará
    // return;
  }

  const loadTabModule = async (tabId) => {
    if (!tabId || loadedTabs.has(tabId)) {
      // console.log(`Módulo para ${tabId} já carregado ou ID inválido.`);
      return;
    }
    console.log(`Tentando carregar módulo para a aba: ${tabId}`); // Log
    try {
      let module;
      let initParams = [user, userData];
      switch (tabId) {
        case "disponibilidade":
          module = await import("./disponibilidade.js");
          break;
        case "grade-online":
          module = await import("./grade-view.js");
          initParams.push("online"); // Passa 'online' como parâmetro extra
          break;
        case "grade-presencial":
          module = await import("./grade-view.js");
          initParams.push("presencial"); // Passa 'presencial' como parâmetro extra
          break;
        default:
          console.warn(`Nenhum módulo definido para a aba: ${tabId}`);
          return; // Retorna se não houver módulo correspondente
      }
      if (module && typeof module.init === "function") {
        console.log(`Módulo ${tabId} importado, chamando init()...`); // Log
        await module.init(...initParams);
        loadedTabs.add(tabId);
        console.log(`Módulo ${tabId} inicializado com sucesso.`); // Log
      } else {
        console.warn(
          `Módulo importado para ${tabId}, mas não possui função init().`
        );
      }
    } catch (error) {
      console.error(
        `Erro ao carregar ou inicializar o módulo da aba '${tabId}':`,
        error
      );
      const tabContent = view.querySelector(`#${tabId}`);
      if (tabContent) {
        // Evita sobreescrever o spinner se ele ainda estiver lá
        if (!tabContent.querySelector(".loading-spinner")) {
          tabContent.innerHTML = `<p class="alert alert-error" style="color: red; padding: 10px; border: 1px solid red;">Ocorreu um erro ao carregar este recurso.</p>`;
        }
      }
    }
  };

  // --- FUNÇÃO switchTab CORRIGIDA ---
  const switchTab = (tabId) => {
    // Verifica se os containers existem
    if (!tabContainer || !contentSections) {
      console.error(
        "Containers de aba ou conteúdo não encontrados ao tentar trocar para",
        tabId
      );
      return;
    }

    // Verifica se o conteúdo da aba alvo existe antes de prosseguir
    const targetContent = document.getElementById(tabId);
    if (!targetContent) {
      console.error(`Conteúdo da aba não encontrado: #${tabId}`);
      // Tenta ir para a aba padrão se a alvo não existir
      const defaultTabId = "disponibilidade"; // Defina a aba padrão aqui
      if (tabId !== defaultTabId && document.getElementById(defaultTabId)) {
        console.warn(`Redirecionando para a aba padrão '${defaultTabId}'.`);
        // Chama recursivamente com a aba padrão OU muda o hash se preferir
        switchTab(defaultTabId);
        // Se usar hash: window.location.hash = `recursos/${defaultTabId}`;
      } else {
        console.error(
          "Erro crítico: Conteúdo da aba alvo e da aba padrão não encontrados."
        );
        view.insertAdjacentHTML(
          "afterbegin",
          '<p class="alert alert-error" style="color: red;">Erro: Abas não configuradas corretamente.</p>'
        );
      }
      return;
    }

    console.log(`Trocando para a aba: ${tabId}`); // Log

    // 1. ATUALIZA OS BOTÕES: Adiciona/Remove 'active' dos botões .tab-link
    if (tabContainer) {
      // Verifica se tabContainer ainda é válido
      tabContainer.querySelectorAll(".tab-link").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tab === tabId);
      });
    } else {
      console.warn("tabContainer não encontrado ao tentar atualizar botões.");
    }

    // 2. ATUALIZA O CONTEÚDO: Adiciona/Remove 'active' dos divs .tab-content
    contentSections.forEach((section) => {
      section.classList.toggle("active", section.id === tabId);
      // REMOVEMOS a linha: section.style.display = section.id === tabId ? "block" : "none";
    });

    // 3. CARREGA O MÓDULO (com delay):
    requestAnimationFrame(() => {
      // Verifica se a aba atual no hash ainda é a que queremos carregar
      const currentHashId =
        window.location.hash.substring(1).split("/")[1] || "disponibilidade"; // Garante fallback
      if (currentHashId === tabId) {
        // Só carrega se o conteúdo ainda não foi carregado
        if (!loadedTabs.has(tabId)) {
          console.log(`requestAnimationFrame: Carregando módulo ${tabId}`); // Log
          loadTabModule(tabId);
        } else {
          console.log(
            `requestAnimationFrame: Módulo ${tabId} já estava carregado.`
          ); // Log
        }
      } else {
        console.log(
          `requestAnimationFrame: Carregamento de ${tabId} cancelado, aba mudou para ${currentHashId}`
        ); // Log
      }
    });
  };

  // --- Lógica de Clonagem e Event Listeners ---
  if (tabContainer) {
    const newTabContainer = tabContainer.cloneNode(true);
    if (tabContainer.parentNode) {
      tabContainer.parentNode.replaceChild(newTabContainer, tabContainer);
      tabContainer = newTabContainer; // ATUALIZA a variável após a substituição

      tabContainer.addEventListener("click", (e) => {
        const clickedTab = e.target.closest(".tab-link");
        if (clickedTab && clickedTab.dataset.tab) {
          // Verifica se tem data-tab
          const tabId = clickedTab.dataset.tab;
          const newHash = `#recursos/${tabId}`;
          // Só atualiza o hash se ele for diferente, para não disparar hashchange à toa
          if (window.location.hash !== newHash) {
            console.log(`Clicou na aba ${tabId}, mudando hash para ${newHash}`); // Log
            window.location.hash = newHash;
          } else {
            console.log(`Clicou na aba ${tabId}, mas o hash já é ${newHash}`); // Log
            // Mesmo que o hash não mude, força a reavaliação da aba ativa (caso algo tenha falhado)
            // Cuidado: isso pode recarregar o módulo se loadedTabs não estiver funcionando bem
            // handleHashChange(); // Descomente com cautela
          }
        }
      });
    } else {
      console.error(
        "Erro: O elemento pai do tabContainer não foi encontrado durante a clonagem."
      );
      tabContainer = null; // Invalida tabContainer se a substituição falhar
    }
  } else {
    console.warn(
      "Container de abas (.tabs-container) não encontrado na inicialização."
    );
  }

  const handleHashChange = () => {
    console.log(`Hash mudou para: ${window.location.hash}`); // Log
    const hashParts = window.location.hash.substring(1).split("/");
    let targetTabId = "disponibilidade"; // Aba padrão

    if (hashParts[0] === "recursos" && hashParts[1]) {
      // Verifica se a aba especificada no hash realmente existe nos botões
      if (
        tabContainer &&
        tabContainer.querySelector(`.tab-link[data-tab="${hashParts[1]}"]`)
      ) {
        targetTabId = hashParts[1];
      } else {
        console.warn(
          `Aba "${hashParts[1]}" do hash não encontrada, usando aba padrão.`
        );
        // Opcional: Redirecionar para o hash da aba padrão?
        // window.location.hash = 'recursos/disponibilidade'; // Cuidado com loop
      }
    } else if (hashParts[0] !== "recursos") {
      console.log("Hash não pertence a 'recursos', usando aba padrão.");
    }
    // else: hash é só #recursos, usa a padrão

    switchTab(targetTabId);
  };

  // Listener para quando o hash na URL muda
  window.addEventListener("hashchange", handleHashChange);

  setTimeout(handleHashChange, 50); // Delay de 50ms (ajuste se necessário)
}
