// /modulos/gestao/js/ata-de-reuniao.js
// VERSÃO 2.2 (Lista de Presença com Todos os Usuários e Visível para Todos)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
  updateDoc,
} from "../../../assets/js/firebase-init.js";

let usuariosCache = [];

export async function init() {
  console.log("[ATA] Módulo Registar Ata iniciado (v2.2).");
  await fetchTodosUsuarios();
  await carregarReunioesAgendadas();
}

async function fetchTodosUsuarios() {
  if (usuariosCache.length > 0) return;
  try {
    // Query alterada: Removemos o filtro 'where("funcoes", "array-contains", "gestor")'
    // para buscar TODOS os usuários cadastrados para a lista de presença.
    const q = query(collection(firestoreDb, "usuarios"), orderBy("nome"));
    const snapshot = await getDocs(q);
    usuariosCache = snapshot.docs.map((doc) => doc.data().nome);
    console.log(
      `[ATA] ${usuariosCache.length} usuários carregados para lista de presença.`
    );
  } catch (error) {
    console.error("[ATA] Erro ao buscar usuários:", error);
  }
}

async function carregarReunioesAgendadas() {
  const container = document.getElementById("lista-reunioes-agendadas");
  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // Busca reuniões agendadas. Mantivemos os tipos, mas agora a lista de presença
    // funcionará para qualquer um deles que for selecionado.
    const q = query(
      collection(firestoreDb, "gestao_atas"),
      where("status", "==", "Agendada"),
      orderBy("dataReuniao", "desc")
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      container.innerHTML =
        '<h3>Nenhuma reunião pendente de ata.</h3><p>Para criar uma ata, primeiro agende a reunião na aba "Agendar Reunião".</p>';
      return;
    }

    let listHtml =
      '<h3>Selecione uma Reunião para Registar a Ata</h3><ul class="item-list">';
    snapshot.forEach((doc) => {
      const reuniao = doc.data();
      const dataFormatada = new Date(
        reuniao.dataReuniao + "T00:00:00"
      ).toLocaleDateString("pt-BR");
      listHtml += `<li data-id="${doc.id}">${
        reuniao.tipo
      } - ${dataFormatada} (${reuniao.pauta || "Sem pauta"})</li>`;
    });
    listHtml += "</ul>";
    container.innerHTML = listHtml;

    container.querySelectorAll("li").forEach((li) => {
      li.addEventListener("click", async () => {
        container.style.display = "none";
        const docId = li.dataset.id;
        const docSnap = await getDoc(doc(firestoreDb, "gestao_atas", docId));
        renderizarFormularioAta(docSnap.data(), docId);
      });
    });
  } catch (error) {
    console.error("Erro ao carregar reuniões agendadas:", error);
    container.innerHTML =
      '<p class="alert alert-danger">Erro ao carregar reuniões.</p>';
  }
}

function renderizarFormularioAta(data, docId) {
  const container = document.getElementById("form-ata-container");
  container.style.display = "block";

  // Gera checkboxes com TODOS os usuários
  const participantesCheckboxes = usuariosCache
    .map(
      (nome) =>
        `<div><label><input type="checkbox" class="participante-check" value="${nome}"> ${nome}</label></div>`
    )
    .join("");

  // Removemos a condição 'style="display: ..."' para que o campo apareça sempre
  container.innerHTML = `
        <form id="form-ata-registro">
            <h3>Registo da Ata: ${data.tipo}</h3>
            <p><strong>Data:</strong> ${new Date(
              data.dataReuniao + "T00:00:00"
            ).toLocaleDateString("pt-BR")} | <strong>Pauta:</strong> ${
    data.pauta
  }</p>
            <hr>
            
            <div class="form-group participantes-field">
                <label>Lista de Presença (Avaliação de Participação)</label>
                <div class="participantes-checkbox-container" style="max-height: 200px; overflow-y: auto; border: 1px solid #dee2e6; padding: 10px; border-radius: 4px;">
                    ${participantesCheckboxes}
                </div>
                <small class="text-muted">Selecione todos os presentes na reunião.</small>
            </div>

            <div class="form-group"><label>Pontos Discutidos</label><textarea class="form-control" id="ata-pontos" rows="4" required></textarea></div>
            <div class="form-group"><label>Decisões</label><textarea class="form-control" id="ata-decisoes" rows="4" required></textarea></div>
            <div class="form-group"><label>Temas para Próxima Reunião</label><textarea class="form-control" id="ata-temas-proxima" rows="3"></textarea></div>

            <div class="button-bar">
                <button type="button" id="btn-agendar-proxima" class="action-button secondary-button">Agendar Próxima Reunião</button>
                <button type="submit" class="action-button save-btn">Salvar Ata</button>
            </div>
             <div id="ata-feedback" class="status-message" style="margin-top: 15px;"></div>
        </form>
    `;

  document
    .getElementById("btn-agendar-proxima")
    .addEventListener("click", () => {
      window.location.hash = "#agendar-reuniao";
    });

  document
    .getElementById("form-ata-registro")
    .addEventListener("submit", (e) => salvarAta(e, docId));
}

async function salvarAta(e, docId) {
  e.preventDefault();
  const feedbackEl = document.getElementById("ata-feedback");
  const saveButton = e.target.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  saveButton.textContent = "A salvar...";

  const participantes = Array.from(
    document.querySelectorAll(".participante-check:checked")
  )
    .map((cb) => cb.value)
    .join(", ");

  const dadosUpdate = {
    pontos: document.getElementById("ata-pontos").value,
    decisoes: document.getElementById("ata-decisoes").value,
    temasProximaReuniao: document.getElementById("ata-temas-proxima").value,
    participantes: participantes,
    status: "Concluída",
  };

  try {
    const ataRef = doc(firestoreDb, "gestao_atas", docId);
    await updateDoc(ataRef, dadosUpdate);

    document.getElementById("form-ata-container").innerHTML = `
            <div class="alert alert-success">
                <h2>Ata Registada com Sucesso!</h2>
                <p>Pode agora selecionar outra reunião para registar.</p>
            </div>`;

    document.getElementById("lista-reunioes-agendadas").style.display = "block";
    carregarReunioesAgendadas();
  } catch (error) {
    console.error("Erro ao salvar ata:", error);
    feedbackEl.textContent = "Erro ao salvar a ata.";
    feedbackEl.className = "status-message alert alert-danger";
    saveButton.disabled = false;
    saveButton.textContent = "Salvar Ata";
  }
}
