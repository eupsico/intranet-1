// /modulos/gestao/js/relatorio-feedback.js
// VERSÃO 1.0 (Modularizado e lendo do Cloud Firestore)

import { db as firestoreDb } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let todasAsAtas = [];
let todosOsProfissionais = [];

const perguntasTexto = {
  clareza: "O tema foi apresentado com clareza?",
  objetivos: "Os objetivos da reunião foram alcançados?",
  duracao: "A duração da reunião foi adequada?",
  sugestaoTema: "Sugestão de tema para próxima reunião:",
};

export async function init() {
  console.log("[RELATÓRIO] Módulo de Relatórios iniciado.");
  setupEventListeners();
  await carregarRelatorios();
}

async function carregarRelatorios() {
  try {
    const [atasSnapshot, profissionaisSnapshot] = await Promise.all([
      getDocs(
        query(
          collection(firestoreDb, "gestao_atas"),
          where("tipo", "==", "Reunião Técnica")
        )
      ),
      getDocs(query(collection(firestoreDb, "usuarios"), orderBy("nome"))),
    ]);

    todasAsAtas = atasSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    todosOsProfissionais = profissionaisSnapshot.docs.map(
      (doc) => doc.data().nome
    );

    renderizarResumo(todasAsAtas, todosOsProfissionais);
    renderizarFeedbacksDetalhados(todasAsAtas);
  } catch (err) {
    console.error("Erro ao carregar relatórios:", err);
    document.getElementById(
      "resumo-container"
    ).innerHTML = `<div class="no-data" style="color: red;">${err.message}</div>`;
    document.getElementById(
      "relatorio-container"
    ).innerHTML = `<div class="no-data" style="color: red;">${err.message}</div>`;
  }
}

function renderizarResumo(atas, profissionais) {
  const container = document.getElementById("resumo-container");
  const atasComFeedback = atas
    .filter((ata) => ata.feedbacks)
    .sort((a, b) => new Date(a.dataReuniao) - new Date(b.dataReuniao));

  if (atasComFeedback.length === 0) {
    container.innerHTML = `<div class="no-data"><p>Nenhum feedback encontrado para gerar resumo.</p></div>`;
    return;
  }

  const participacaoMatrix = {};
  profissionais.forEach((nome) => (participacaoMatrix[nome] = {}));

  atasComFeedback.forEach((ata) => {
    const dataFormatada = new Date(
      ata.dataReuniao + "T00:00:00"
    ).toLocaleDateString("pt-BR");
    profissionais.forEach(
      (nome) => (participacaoMatrix[nome][dataFormatada] = "❌")
    ); // Padrão 'Não'
    if (ata.feedbacks) {
      Object.values(ata.feedbacks).forEach((fb) => {
        if (participacaoMatrix[fb.nome]) {
          participacaoMatrix[fb.nome][dataFormatada] = "✔️"; // Presente
        }
      });
    }
  });

  const headers = [
    "Profissional",
    ...atasComFeedback.map((ata) =>
      new Date(ata.dataReuniao + "T00:00:00").toLocaleDateString("pt-BR")
    ),
    "Total",
  ];
  const rows = profissionais.map((nome) => {
    let total = 0;
    const participacoes = atasComFeedback.map((ata) => {
      const dataFormatada = new Date(
        ata.dataReuniao + "T00:00:00"
      ).toLocaleDateString("pt-BR");
      const valor = participacaoMatrix[nome][dataFormatada];
      if (valor === "✔️") total++;
      return valor;
    });
    return [nome, ...participacoes, total];
  });

  const resumoHtml = `
        <button class="export-btn" id="export-resumo-btn">Exportar Resumo (CSV)</button>
        <div class="table-container">
            <table class="resumo-tabela">
                <thead><tr>${headers
                  .map((h) => `<th>${h}</th>`)
                  .join("")}</tr></thead>
                <tbody>${rows
                  .map(
                    (row) =>
                      `<tr>${row
                        .map((cell) => `<td>${cell}</td>`)
                        .join("")}</tr>`
                  )
                  .join("")}</tbody>
            </table>
        </div>
    `;
  container.innerHTML = resumoHtml;
  document.getElementById("export-resumo-btn").onclick = () =>
    exportarParaCsv(headers, rows, "Resumo_Participacao");
}

function renderizarFeedbacksDetalhados(atas) {
  const container = document.getElementById("relatorio-container");
  const atasComFeedback = atas
    .filter((ata) => ata.feedbacks)
    .sort((a, b) => new Date(b.dataReuniao) - new Date(a.dataReuniao));

  if (atasComFeedback.length === 0) {
    container.innerHTML = `<div class="no-data"><p>Nenhum feedback encontrado.</p></div>`;
    return;
  }

  container.innerHTML = atasComFeedback
    .map((ata) => {
      const dataFormatada = new Date(
        ata.dataReuniao + "T00:00:00"
      ).toLocaleDateString("pt-BR");
      const nomeArquivo = `Feedbacks_${(ata.pauta || "Reuniao").replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_${dataFormatada}`;

      const feedbacksHtml = Object.values(ata.feedbacks)
        .map((feedback) => {
          const nomeProfissional = feedback.nome || "Anônimo";
          const respostasHtml = Object.keys(perguntasTexto)
            .map((key) => {
              if (feedback[key]) {
                return `<div class="resposta-item"><strong>${perguntasTexto[key]}</strong><span>${feedback[key]}</span></div>`;
              }
              return "";
            })
            .join("");
          return `<div class="feedback-item"><div class="feedback-profissional">${nomeProfissional}</div>${respostasHtml}</div>`;
        })
        .join("");

      return `
            <div class="accordion">
                <button class="accordion-trigger level-2">${
                  ata.pauta || "Reunião Sem Tema"
                } <span>(${dataFormatada})</span></button>
                <div class="accordion-content">
                    <div class="content-wrapper">
                        <button class="export-btn" data-ata-id="${
                          ata.id
                        }" data-filename="${nomeArquivo}">Exportar Feedbacks (CSV)</button>
                        ${feedbacksHtml}
                    </div>
                </div>
            </div>`;
    })
    .join("");
}

function setupEventListeners() {
  const viewContainer = document.querySelector(".view-container");
  viewContainer.addEventListener("click", (e) => {
    const tabButton = e.target.closest(".tab-link");
    if (tabButton) {
      const tabName = tabButton.dataset.tab;
      document
        .querySelectorAll(".tab-content, .tab-link")
        .forEach((el) => el.classList.remove("active"));
      document.getElementById(tabName).classList.add("active");
      tabButton.classList.add("active");
    }

    if (e.target.matches(".accordion-trigger")) {
      const content = e.target.nextElementSibling;
      content.style.maxHeight = content.style.maxHeight
        ? null
        : content.scrollHeight + "px";
    }

    if (e.target.matches(".export-btn[data-ata-id]")) {
      const ataId = e.target.dataset.ataId;
      const filename = e.target.dataset.filename;
      const ata = todasAsAtas.find((a) => a.id === ataId);
      if (ata && ata.feedbacks) {
        const headers = ["Profissional", "Pergunta", "Resposta"];
        const rows = [];
        Object.values(ata.feedbacks).forEach((fb) => {
          Object.keys(perguntasTexto).forEach((key) => {
            if (fb[key])
              rows.push([fb.nome || "Anônimo", perguntasTexto[key], fb[key]]);
          });
        });
        exportarParaCsv(headers, rows, filename);
      }
    }
  });
}

function exportarParaCsv(headers, rows, filename) {
  const formatCell = (cell) => {
    const text = cell ? String(cell) : "";
    return text.includes(",") || text.includes('"') || text.includes("\n")
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  };
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map(formatCell).join(",")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}
