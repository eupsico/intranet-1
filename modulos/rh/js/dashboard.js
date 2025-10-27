// modulos/rh/js/dashboard.js

import {
  db,
  collection,
  getDocs,
  query,
  where,
  limit,
} from "../../../assets/js/firebase-init.js";

const vagasCollection = collection(db, "vagas");
const onboardingCollection = collection(db, "onboarding");

/**
 * Inicializa o dashboard de RH e carrega todos os dados principais.
 */
export async function initdashboard(user, userData) {
  console.log("Dashboard de RH carregado. Buscando dados resumidos.");

  await carregarVagasEmRecrutamento();
  // Funções futuras: carregarOnboardingSummary(), carregarDesligamentosSummary()
}

/**
 * Busca e exibe as vagas que estão ativamente em recrutamento.
 */
async function carregarVagasEmRecrutamento() {
  const listaVagasBody = document.getElementById("lista-vagas-dashboard");
  const countVagasAbertas = document.getElementById("count-vagas-abertas");

  // Filtra vagas que estão 'em-divulgacao' (status ativo)
  const q = query(
    vagasCollection,
    where("status", "==", "em-divulgacao"),
    limit(5) // Limita a 5 para o dashboard de resumo
  );

  try {
    const snapshot = await getDocs(q);
    let htmlVagas = "";
    let count = 0;

    if (snapshot.empty) {
      listaVagasBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Nenhuma vaga em recrutamento ativa no momento.</td></tr>';
      countVagasAbertas.textContent = "0";
      return;
    }

    snapshot.forEach((doc) => {
      const vaga = doc.data();
      vaga.id = doc.id;
      count++;

      const dataAbertura = vaga.dataCriacao
        ? new Date(vaga.dataCriacao.seconds * 1000).toLocaleDateString("pt-BR")
        : "N/A";
      const candidatos = vaga.candidatosCount || 0;

      htmlVagas += `
                <tr>
                    <td>${vaga.nome}</td>
                    <td><span class="status-badge status-pendente">${vaga.status
                      .toUpperCase()
                      .replace("-", " ")}</span></td>
                    <td>${candidatos}</td>
                    <td>${dataAbertura}</td>
                    <td><button class="action-button secondary btn-sm" data-vaga-id="${
                      vaga.id
                    }">Gerenciar</button></td>
                </tr>
            `;
    });

    listaVagasBody.innerHTML = htmlVagas;
    countVagasAbertas.textContent = count.toString();
  } catch (error) {
    console.error("Erro ao carregar vagas do dashboard:", error);
    listaVagasBody.innerHTML =
      '<tr><td colspan="5" class="alert alert-error">Erro ao carregar os dados.</td></tr>';
    countVagasAbertas.textContent = "ERRO";
  }
}

// Inicia o módulo quando o DOM estiver pronto e a função for chamada pelo app.js
document.addEventListener("DOMContentLoaded", () => {
  // Adiciona listener para os botões "Ver Todas as Vagas"
  document
    .querySelector('.action-button[data-view-id="gestao_vagas"]')
    ?.addEventListener("click", (e) => {
      // Redireciona via JS para garantir que o app.js intercepte
      const viewId = e.target.getAttribute("data-view-id");
      window.location.search = `?view=${viewId}`;
    });
});
