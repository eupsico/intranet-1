// Arquivo: /modulos/administrativo/js/cruzamento-agendas/index.js

// Importa o arquivo original (que está um nível acima) para gerenciar a aba Compatibilidade
import * as originalCruzamento from "../../cruzamento-agendas.js";
import * as tentativas from "./tentativas.js";
import * as historico from "./historico.js";

export function init(db, user, userData) {
  console.log("Iniciando Módulo Cruzamento de Agendas (Híbrido)");

  const tabsContainer = document.getElementById("cruzamento-tabs");

  // Inicializa o arquivo original (focado na Compatibilidade)
  // Nota: O arquivo original também possui lógica de tentativas básica.
  // O módulo 'tentativas.js' abaixo irá se sobrepor na manipulação do DOM da aba 'Tentativas'
  // para fornecer as funcionalidades avançadas (Modais, Grade, WhatsApp).
  if (originalCruzamento && typeof originalCruzamento.init === "function") {
    originalCruzamento.init(user, userData);
  }

  // Inicializa os novos módulos avançados
  tentativas.init(db);
  historico.init(db);

  // Controle de Abas
  if (tabsContainer) {
    tabsContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("tab-link")) {
        const tabId = e.target.dataset.tab;

        // Atualização da UI das abas
        document
          .querySelectorAll(".tab-link")
          .forEach((btn) => btn.classList.remove("active"));
        e.target.classList.add("active");

        document.querySelectorAll(".tab-content").forEach((content) => {
          content.style.display = "none";
          content.classList.remove("active");
        });

        const activeTab = document.getElementById(tabId);
        if (activeTab) {
          activeTab.style.display = "block";
          activeTab.classList.add("active");
        }

        // Refresh de dados específicos ao mudar para abas novas
        if (tabId === "tentativas") tentativas.refresh();
        if (tabId === "desistencias" || tabId === "agendados")
          historico.refresh(tabId);
      }
    });
  }
}
