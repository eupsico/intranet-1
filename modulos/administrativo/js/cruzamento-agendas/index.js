// Arquivo: /modulos/administrativo/js/cruzamento-agendas/index.js
import * as compatibilidade from "./compatibilidade.js";
import * as tentativas from "./tentativas.js";
import * as historico from "./historico.js";

export function init(db, user, userData) {
  console.log("Iniciando Módulo Cruzamento de Agendas (Modular)");

  const tabsContainer = document.getElementById("cruzamento-tabs");

  // Inicializa sub-módulos
  compatibilidade.init(db);
  tentativas.init(db);
  historico.init(db);

  // Controle de Abas
  if (tabsContainer) {
    tabsContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("tab-link")) {
        const tabId = e.target.dataset.tab;

        // UI Update
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

        // Refresh de dados específicos ao mudar de aba
        if (tabId === "tentativas") tentativas.refresh();
        if (tabId === "desistencias" || tabId === "agendados")
          historico.refresh(tabId);
      }
    });
  }
}
