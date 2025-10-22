// /modulos/gestao/js/dashboard-reunioes.js
// VERSÃO 2.3 (CORRIGIDO - Lógica de "Próxima Reunião")

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "../../../assets/js/firebase-init.js";

let todasAsAtas = [];

export function init() {
  console.log("[DASH] Módulo Dashboard de Reuniões iniciado.");
  loadAtasFromFirestore();
  setupEventListeners();
}

function loadAtasFromFirestore() {
  const atasContainer = document.getElementById("atas-container");
  const q = query(
    collection(firestoreDb, "gestao_atas"),
    orderBy("dataReuniao", "desc")
  );

  onSnapshot(
    q,
    (snapshot) => {
      todasAsAtas = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      filtrarEExibirAtas();
    },
    (error) => {
      console.error("[DASH] Erro ao carregar atas do Firestore:", error);
      if (atasContainer)
        atasContainer.innerHTML =
          '<div class="alert alert-danger">Erro ao carregar atas.</div>';
    }
  );
}

function filtrarEExibirAtas() {
  const filterType = document.getElementById("tipo-filtro")?.value || "Todos";
  const atasContainer = document.getElementById("atas-container");
  if (!atasContainer) return;

  // Agora filtra para mostrar apenas as atas concluídas
  const atasConcluidas = todasAsAtas.filter(
    (ata) => ata.status === "Concluída"
  );
  const atasFiltradas =
    filterType === "Todos"
      ? atasConcluidas
      : atasConcluidas.filter((ata) => ata.tipo === filterType);

  if (atasFiltradas.length === 0) {
    atasContainer.innerHTML =
      '<div class="card"><p>Nenhuma ata registada encontrada para este filtro.</p></div>';
  } else {
    atasContainer.innerHTML = atasFiltradas
      .map((ata) => renderSavedAtaAccordion(ata.id, ata))
      .join("");
  }

  // Passa a lista completa de atas (incluindo as agendadas) para a função de próxima reunião
  exibirProximaReuniao(todasAsAtas);
}

// --- INÍCIO DA CORREÇÃO ---
function exibirProximaReuniao(listaDeTodasAsAtas) {
  const infoBox = document.getElementById("proxima-reuniao-info");
  if (!infoBox) return;

  const agora = new Date();
  let proximaReuniao = null;

  // Procura na lista por reuniões com status "Agendada" que ainda não aconteceram
  const reunioesAgendadas = listaDeTodasAsAtas.filter(
    (ata) =>
      ata.status === "Agendada" &&
      new Date(`${ata.dataReuniao}T${ata.horaInicio}`) > agora
  );

  // Se encontrar reuniões agendadas, pega a mais próxima
  if (reunioesAgendadas.length > 0) {
    // Ordena para garantir que a mais próxima venha primeiro
    reunioesAgendadas.sort(
      (a, b) =>
        new Date(`${a.dataReuniao}T${a.horaInicio}`) -
        new Date(`${b.dataReuniao}T${b.horaInicio}`)
    );
    proximaReuniao = reunioesAgendadas[0];
  }

  if (proximaReuniao) {
    const data = new Date(
      `${proximaReuniao.dataReuniao}T${proximaReuniao.horaInicio}`
    );
    infoBox.innerHTML = `<h3>Próxima Reunião</h3><p><strong>${
      proximaReuniao.tipo
    }</strong> em ${data.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    })}</p>`;
  } else {
    infoBox.innerHTML = `<h3>Próxima Reunião</h3><p>Nenhuma reunião futura agendada.</p>`;
  }
}
// --- FIM DA CORREÇÃO ---

function renderSavedAtaAccordion(id, data) {
  const date = data.dataReuniao
    ? new Date(data.dataReuniao + "T00:00:00")
    : null;
  const formattedDate = date
    ? date.toLocaleDateString("pt-BR")
    : "Data Inválida";
  const title = `${data.tipo} - ${formattedDate}`;

  const createItem = (title, content) =>
    content && String(content).trim()
      ? `<div class="ata-item-title">${title}</div><div class="ata-item-content"><p>${String(
          content
        ).replace(/\n/g, "<br>")}</p></div>`
      : "";
  const createList = (title, listData) => {
    if (!Array.isArray(listData) || listData.length === 0) return "";
    const listItems = listData
      .map(
        (item) =>
          `<li><strong>${item.responsavel}:</strong> ${
            item.descricao
          } (Prazo: ${new Date(item.prazo).toLocaleDateString("pt-BR", {
            timeZone: "UTC",
          })})</li>`
      )
      .join("");
    return `<div class="ata-item-title">${title}</div><div class="ata-item-content"><ul>${listItems}</ul></div>`;
  };

  let contentHtml = createItem(
    "Data e Horário",
    `Início: ${data.horaInicio || "N/A"} | Fim: ${data.horaFim || "N/A"}`
  );

  if (data.tipo === "Reunião Técnica") {
    contentHtml += createItem("Tema", data.pauta);
    contentHtml += createItem("Facilitador", data.responsavelTecnica);
  } else {
    contentHtml += createItem("Pauta", data.pauta);
    contentHtml += createItem("Participantes", data.participantes);
    contentHtml += createItem("Pontos Discutidos", data.pontos);
    contentHtml += createItem("Decisões", data.decisoes);
    contentHtml += createList("Plano de Ação", data.planoDeAcao);
    contentHtml += createItem(
      "Temas p/ Próxima Reunião",
      data.temasProximaReuniao
    );
  }

  const pdfButtonHtml = data.pdfUrl
    ? `<a href="${data.pdfUrl}" target="_blank" class="action-button pdf">Abrir PDF</a>`
    : "";
  const feedbackButtonHtml =
    data.tipo === "Reunião Técnica"
      ? `<a href="./feedback.html#${id}" target="_blank" class="action-button feedback">Dar Feedback</a>`
      : "";

  return `<div class="accordion">
                <button class="accordion-trigger">${title}</button>
                <div class="accordion-content">
                    <div class="content-wrapper">
                        ${contentHtml}
                        <div class="action-buttons-container">
                            ${pdfButtonHtml}
                            ${feedbackButtonHtml}
                        </div>
                    </div>
                </div>
            </div>`;
}

function setupEventListeners() {
  const contentArea = document.querySelector(".main-content");
  document
    .getElementById("tipo-filtro")
    ?.addEventListener("change", filtrarEExibirAtas);

  // Garante que o listener de clique só seja adicionado uma vez
  if (!contentArea.dataset.listenerAttached) {
    contentArea.addEventListener("click", (e) => {
      if (e.target.classList.contains("accordion-trigger")) {
        const content = e.target.nextElementSibling;
        if (content.style.maxHeight) {
          content.style.maxHeight = null;
        } else {
          document
            .querySelectorAll(".accordion-content")
            .forEach((c) => (c.style.maxHeight = null));
          content.style.maxHeight = content.scrollHeight + "px";
        }
      }
    });
    contentArea.dataset.listenerAttached = "true";
  }
}
