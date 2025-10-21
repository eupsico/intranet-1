// eupsico/intranet-1/intranet-1-3f5b28aea177748beae753ef1bee8bfd1916ed36/modulos/voluntario/js/disponibilidade.js
// CORRIGIDO

// Arquivo: /modulos/voluntario/js/disponibilidade.js
// Versão 2.0 (Atualizado para a sintaxe modular do Firebase v9)

// 1. Importa as funções necessárias do nosso arquivo central de inicialização
import {
  db,
  doc,
  getDoc,
  updateDoc,
} from "../../../assets/js/firebase-init.js";

let currentUser; // Armazena o usuário autenticado

/**
 * Função Principal (INIT): Ponto de entrada do módulo.
 * @param {object} user - Objeto do usuário autenticado.
 * @param {object} userData - Dados do perfil do usuário do Firestore.
 */
export function init(user, userData) {
  // CORREÇÃO: Alterado o seletor para corresponder ao ID no recursos.html
  const container = document.querySelector("#disponibilidade");
  if (!container) {
    console.error("Container de disponibilidade não encontrado.");
    return;
  }

  currentUser = user; // Armazena o usuário atual no escopo do módulo
  fetchData(); // Inicia o carregamento dos dados
}

/**
 * Busca os dados de disponibilidade mais recentes do usuário no Firestore.
 */
async function fetchData() {
  // CORREÇÃO: Alterado o seletor
  const container = document.querySelector("#disponibilidade");
  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // SINTAXE V9: Cria a referência ao documento e busca os dados
    const userDocRef = doc(db, "usuarios", currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      renderUserView(userDocSnap.data());
    } else {
      container.innerHTML = `<div class="disponibilidade-view"><h3>Minha Disponibilidade</h3><p>Seus dados não foram encontrados.</p></div>`;
    }
  } catch (error) {
    console.error("Erro ao buscar dados de disponibilidade:", error);
    container.innerHTML = `<p class="alert alert-error">Não foi possível carregar os dados.</p>`;
  }
}

/**
 * Renderiza a visualização principal com os horários salvos.
 * @param {object} profData - Dados do perfil do profissional.
 */
function renderUserView(profData) {
  // CORREÇÃO: Alterado o seletor
  const container = document.querySelector("#disponibilidade");
  const horarios = profData.horarios || [];

  const horariosHtml =
    horarios.length > 0
      ? horarios
          .sort((a, b) => a.horario - b.horario) // Ordena por horário
          .map(
            (h) =>
              `<li><strong>${
                h.dia.charAt(0).toUpperCase() + h.dia.slice(1)
              } - ${String(h.horario).padStart(2, "0")}:00:</strong> ${
                h.modalidade
              } (${h.status})</li>`
          )
          .join("")
      : "<li>Nenhum horário cadastrado.</li>";

  container.innerHTML = `
        <div class="disponibilidade-view">
            <div class="display-header">
                <h3>Horários Salvos</h3>
                <button id="modify-btn" class="action-button">Modificar</button>
            </div>
            <div class="display-body">
                <ul class="schedule-list">${horariosHtml}</ul>
                <div class="demands-display">
                    <h4>Demandas que NÃO atende:</h4>
                    <p>${
                      profData.demandasNaoAtendidas ||
                      "Nenhuma restrição informada."
                    }</p>
                </div>
            </div>
        </div>
    `;
  container
    .querySelector("#modify-btn")
    .addEventListener("click", () => renderEditView(profData));
}

/**
 * Cria o HTML para uma nova linha na tabela de edição de horários.
 * @returns {string} - String HTML da nova linha.
 */
function createNewScheduleRowHtml() {
  const dias = {
    segunda: "Segunda-feira",
    terca: "Terça-feira",
    quarta: "Quarta-feira",
    quinta: "Quinta-feira",
    sexta: "Sexta-feira",
    sabado: "Sábado",
  };
  const horarios = Array.from({ length: 15 }, (_, i) => i + 7); // 7h às 21h

  return `
        <tr>
            <td><select class="form-control dia">${Object.entries(dias)
              .map(([val, text]) => `<option value="${val}">${text}</option>`)
              .join("")}</select></td>
            <td><select class="form-control horario">${horarios
              .map(
                (hora) =>
                  `<option value="${hora}">${String(hora).padStart(
                    2,
                    "0"
                  )}:00</option>`
              )
              .join("")}</select></td>
            <td><select class="form-control modalidade"><option value="online">Online</option><option value="presencial">Presencial</option><option value="ambas">Ambas</option></select></td>
            <td><select class="form-control status"><option value="disponivel">Disponível</option><option value="ocupado">Ocupado</option></select></td>
            <td><button class="action-button secondary-button delete-row-btn">Excluir</button></td>
        </tr>
    `;
}

/**
 * Renderiza a visualização de edição da disponibilidade.
 * @param {object} profData - Dados do perfil do profissional.
 */
function renderEditView(profData) {
  // CORREÇÃO: Alterado o seletor
  const container = document.querySelector("#disponibilidade");
  const horarios = profData.horarios || [];

  const scheduleRowsHtml = horarios
    .map((h) => {
      const dias = {
        segunda: "Segunda-feira",
        terca: "Terça-feira",
        quarta: "Quarta-feira",
        quinta: "Quinta-feira",
        sexta: "Sexta-feira",
        sabado: "Sábado",
      };
      const horariosOptions = Array.from({ length: 15 }, (_, i) => i + 7); // 7h às 21h
      return `
        <tr>
            <td><select class="form-control dia">${Object.entries(dias)
              .map(
                ([val, text]) =>
                  `<option value="${val}" ${
                    h.dia === val ? "selected" : ""
                  }>${text}</option>`
              )
              .join("")}</select></td>
            <td><select class="form-control horario">${horariosOptions
              .map(
                (hora) =>
                  `<option value="${hora}" ${
                    h.horario == hora ? "selected" : ""
                  }>${String(hora).padStart(2, "0")}:00</option>`
              )
              .join("")}</select></td>
            <td><select class="form-control modalidade"><option value="online" ${
              h.modalidade === "online" ? "selected" : ""
            }>Online</option><option value="presencial" ${
        h.modalidade === "presencial" ? "selected" : ""
      }>Presencial</option><option value="ambas" ${
        h.modalidade === "ambas" ? "selected" : ""
      }>Ambas</option></select></td>
            <td><select class="form-control status"><option value="disponivel" ${
              h.status === "disponivel" ? "selected" : ""
            }>Disponível</option><option value="ocupado" ${
        h.status === "ocupado" ? "selected" : ""
      }>Ocupado</option></select></td>
            <td><button class="action-button secondary-button delete-row-btn">Excluir</button></td>
        </tr>
    `;
    })
    .join("");

  container.innerHTML = `
        <div class="disponibilidade-view">
            <h3>Editando Minha Disponibilidade</h3>
            <p class="description-box">Como a EuPsico não trabalha somente com voluntários, é preciso que cada um assuma a responsabilidade de informar a sua disponibilidade correta para o setor administrativo.</p>
            <table class="edit-table">
                <thead><tr><th>Dia da Semana</th><th>Horário</th><th>Modalidade</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>${scheduleRowsHtml}</tbody>
            </table>
            <button id="add-row-btn" class="action-button" style="margin-top: 10px;">Adicionar Horário (+)</button>
            <hr style="margin: 20px 0;">
            <div class="form-group">
                <label for="demands-textarea">Demandas que NÃO atende:</label>
                <textarea id="demands-textarea" class="form-control" placeholder="Ex: Crianças abaixo de 10 anos, casos de abuso sexual, etc.">${
                  profData.demandasNaoAtendidas || ""
                }</textarea>
            </div>
            <div class="edit-controls">
                <button id="cancel-btn" class="action-button secondary-button">Cancelar</button>
                <button id="save-btn" class="action-button">Salvar Alterações</button>
            </div>
        </div>
    `;

  // Adiciona os event listeners para a tela de edição
  container.querySelector("#add-row-btn").addEventListener("click", () => {
    const newRowHtml = createNewScheduleRowHtml();
    container
      .querySelector(".edit-table tbody")
      .insertAdjacentHTML("beforeend", newRowHtml);
  });
  container
    .querySelector(".edit-table tbody")
    .addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-row-btn"))
        e.target.closest("tr").remove();
    });
  container
    .querySelector("#cancel-btn")
    .addEventListener("click", () => renderUserView(profData));
  container
    .querySelector("#save-btn")
    .addEventListener("click", saveAvailability);
}

/**
 * Salva as alterações de disponibilidade no Firestore usando a sintaxe v9.
 */
async function saveAvailability() {
  // CORREÇÃO: Alterado o seletor
  const container = document.querySelector("#disponibilidade");
  const saveButton = container.querySelector("#save-btn");
  saveButton.disabled = true;
  saveButton.textContent = "Salvando...";

  const updatedHorarios = [];
  container.querySelectorAll(".edit-table tbody tr").forEach((row) => {
    const dia = row.querySelector(".dia").value;
    const horario = row.querySelector(".horario").value;
    if (dia && horario) {
      updatedHorarios.push({
        dia: dia,
        horario: parseInt(horario, 10), // Garante que o horário seja um número
        modalidade: row.querySelector(".modalidade").value,
        status: row.querySelector(".status").value,
      });
    }
  });

  const updatedDemands = container.querySelector("#demands-textarea").value;

  try {
    // SINTAXE V9: Cria a referência ao documento e atualiza os dados
    const userDocRef = doc(db, "usuarios", currentUser.uid);
    await updateDoc(userDocRef, {
      horarios: updatedHorarios,
      demandasNaoAtendidas: updatedDemands,
    });

    // A função showToast deve estar disponível globalmente ou ser importada
    if (window.showToast) {
      window.showToast("Disponibilidade salva com sucesso!", "success");
    }

    fetchData(); // Recarrega os dados para mostrar a visualização atualizada
  } catch (error) {
    console.error("Erro ao salvar disponibilidade:", error);
    if (window.showToast) {
      window.showToast("Erro ao salvar disponibilidade.", "error");
    }
    saveButton.disabled = false;
    saveButton.textContent = "Salvar Alterações";
  }
}
