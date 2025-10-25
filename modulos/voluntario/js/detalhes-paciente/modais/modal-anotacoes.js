// Arquivo: /modulos/voluntario/js/detalhes-paciente/modais/modal-anotacoes.js
// Lógica para o modal de adicionar/editar anotações das sessões.

import { doc, getDoc, updateDoc, serverTimestamp } from "../conexao-db.js"; // Firestore functions
import * as estado from "../estado.js"; // Shared state
import * as carregador from "../carregador-dados.js"; // To reload sessions/pendencies
import * as interfaceUI from "../interface.js"; // To re-render UI

/**
 * Abre o modal de anotações, preenchendo com dados existentes se houver.
 * @param {string} sessaoId - O ID da sessão cujas anotações serão visualizadas/editadas.
 */
export async function handleAbrirAnotacoes(sessaoId) {
  const modal = document.getElementById("anotacoes-sessao-modal");
  const form = document.getElementById("anotacoes-sessao-form");
  if (!modal || !form) {
    console.error(
      "Modal (#anotacoes-sessao-modal) ou Form (#anotacoes-sessao-form) não encontrado."
    );
    alert("Erro ao abrir anotações: Elementos essenciais não encontrados.");
    return;
  }

  form.reset(); // Limpa o formulário
  const sessaoIdInput = form.querySelector("#anotacoes-sessao-id");
  if (!sessaoIdInput) {
    console.error("Input hidden #anotacoes-sessao-id não encontrado no modal.");
    alert("Erro interno no modal de anotações (ID da sessão).");
    return;
  }
  sessaoIdInput.value = sessaoId; // Define o ID da sessão no input hidden // Seleciona os campos de texto e botão de salvar

  const fieldsSelectors = [
    "#anotacoes-ficha-evolucao",
    "#anotacoes-campo-compartilhado-prof",
    "#anotacoes-campo-compartilhado-admin",
  ];
  const fieldsElements = fieldsSelectors
    .map((sel) => form.querySelector(sel))
    .filter(Boolean); // Filtra caso algum campo não exista
  const btnSalvar = form.querySelector("#btn-salvar-anotacoes"); // Desabilita campos enquanto carrega

  fieldsElements.forEach((el) => (el.disabled = true));
  if (btnSalvar) btnSalvar.disabled = true; // Exibe o modal

  modal.style.display = "flex";

  try {
    const sessaoRef = doc(
      db,
      "trilhaPaciente",
      estado.pacienteIdGlobal, // Usa ID do estado
      "sessoes",
      sessaoId
    );
    const sessaoSnap = await getDoc(sessaoRef);

    if (sessaoSnap.exists()) {
      const data = sessaoSnap.data();
      const anotacoes = data.anotacoes || {}; // Pega anotações existentes ou objeto vazio // Preenche os campos do formulário

      const fichaEvolucaoEl = form.querySelector("#anotacoes-ficha-evolucao");
      if (fichaEvolucaoEl)
        fichaEvolucaoEl.value = anotacoes.fichaEvolucao || "";

      const compProfEl = form.querySelector(
        "#anotacoes-campo-compartilhado-prof"
      );
      if (compProfEl) compProfEl.value = anotacoes.compartilhadoProf || "";

      const compAdminEl = form.querySelector(
        "#anotacoes-campo-compartilhado-admin"
      );
      if (compAdminEl) compAdminEl.value = anotacoes.compartilhadoAdmin || "";

      // Ajusta as abas para começar na Ficha de Evolução (opcional)
      const tabFicha = document.querySelector(
        '#anotacoes-tabs-nav .tab-link[data-tab="anotacoes-tab-ficha"]'
      );
      const contentFicha = document.getElementById("anotacoes-tab-ficha");
      if (tabFicha && contentFicha) {
        // Desativa outras abas/conteúdos e ativa a da ficha
        document
          .querySelectorAll(
            "#anotacoes-tabs-nav .tab-link.active, #anotacoes-tabs-content .tab-content.active"
          )
          .forEach((el) => el.classList.remove("active"));
        tabFicha.classList.add("active");
        contentFicha.classList.add("active");
      }
    } else {
      console.warn(
        `Sessão ${sessaoId} não encontrada para carregar anotações.`
      );
      alert("A sessão selecionada não foi encontrada no banco de dados.");
      modal.style.display = "none"; // Fecha o modal se a sessão não existe
      return;
    }
  } catch (error) {
    console.error(`Erro ao carregar anotações da sessão ${sessaoId}:`, error);
    alert("Erro ao carregar anotações existentes. Tente novamente.");
    modal.style.display = "none"; // Fecha o modal em caso de erro
    return; // Não reabilita os campos se deu erro ao carregar
  } finally {
    // Reabilita campos após carregar (ou se não existia anotação)
    fieldsElements.forEach((el) => (el.disabled = false));
    if (btnSalvar) btnSalvar.disabled = false;
  }
}

/**
 * Handler para o submit do formulário de anotações.
 * Salva as anotações no Firestore.
 * @param {Event} event - O evento de submit do formulário.
 */
export async function handleSalvarAnotacoes(event) {
  event.preventDefault(); // Impede o recarregamento da página
  const form = event.target; // O próprio formulário que disparou o evento
  const button = form.querySelector("#btn-salvar-anotacoes");
  const sessaoId = form.querySelector("#anotacoes-sessao-id")?.value;
  const modal = document.getElementById("anotacoes-sessao-modal"); // Modal pai

  if (!sessaoId) {
    alert(
      "Erro: ID da sessão não encontrado no formulário. Não é possível salvar."
    );
    return;
  }
  if (!modal || !button) {
    console.error(
      "Modal ou botão de salvar anotações não encontrado durante submit."
    );
    return;
  }

  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

  try {
    // Coleta os dados dos campos de anotações
    const anotacoesData = {
      fichaEvolucao:
        form.querySelector("#anotacoes-ficha-evolucao")?.value || "",
      compartilhadoProf:
        form.querySelector("#anotacoes-campo-compartilhado-prof")?.value || "",
      compartilhadoAdmin:
        form.querySelector("#anotacoes-campo-compartilhado-admin")?.value || "",
    };

    const sessaoRef = doc(
      db,
      "trilhaPaciente",
      estado.pacienteIdGlobal, // Usa ID do estado
      "sessoes",
      sessaoId
    );

    const updateData = {
      anotacoes: anotacoesData,
      anotacoesAtualizadasEm: serverTimestamp(),
    };
    // Adiciona quem atualizou, se usuário logado
    if (estado.userDataGlobal) {
      updateData.anotacoesAtualizadasPor = {
        id: estado.userDataGlobal.uid,
        nome: estado.userDataGlobal.nome,
      };
    }

    await updateDoc(sessaoRef, updateData);

    alert("Anotações salvas com sucesso!");
    modal.style.display = "none"; // Fecha o modal // --- Atualiza UI após salvar ---

    // Recarrega as sessões do Firestore para atualizar o estado
    await carregador.carregarSessoes();
    // Re-renderiza a lista de sessões (que mudará o texto do botão "Adicionar" para "Ver/Editar")
    interfaceUI.renderizarSessoes();
    // Re-renderiza as pendências (caso a falta de anotação fosse uma pendência)
    interfaceUI.renderizarPendencias();
  } catch (error) {
    console.error(`Erro ao salvar anotações da sessão ${sessaoId}:`, error);
    alert(`Erro ao salvar anotações: ${error.message}`);
  } finally {
    // Garante que o botão seja reabilitado mesmo se der erro
    if (button) {
      button.disabled = false;
      button.textContent = "Salvar Anotações";
    }
  }
}
