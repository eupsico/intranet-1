// Arquivo: /modulos/admin/js/configuracoes.js
// Versão: 5.1 (COMPLETO E CORRIGIDO - Com gestão de Feedback)

import { db, doc, getDoc, setDoc } from "../../../assets/js/firebase-init.js";

// --- REFERÊNCIAS AOS DOCUMENTOS NO FIRESTORE ---
const configGeralRef = doc(db, "configuracoesSistema", "geral");
const configFeedbackRef = doc(db, "configuracoesSistema", "modelo_feedback");

// --- LÓGICA DAS ABAS ---
function openTab(evt, tabName) {
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => (tab.style.display = "none"));
  document
    .querySelectorAll(".tab-link")
    .forEach((link) => link.classList.remove("active"));
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.classList.add("active");
}

// --- LÓGICA DE CARREGAMENTO ---
async function loadConfig() {
  const feedbackEl = document.getElementById("save-feedback");
  const spinner = document.getElementById("loading-spinner");
  spinner.style.display = "block";

  try {
    const [geralSnap, feedbackSnap] = await Promise.all([
      getDoc(configGeralRef),
      getDoc(configFeedbackRef),
    ]);

    if (geralSnap.exists()) {
      populateForm(geralSnap.data());
      renderFaixasTable(geralSnap.data().financeiro?.faixasContribuicao || []);
    } else {
      console.warn("Documento 'geral' não encontrado!");
      renderFaixasTable([]);
    }

    if (feedbackSnap.exists()) {
      renderPerguntasTable(feedbackSnap.data().perguntas || []);
    } else {
      console.warn("Documento 'modelo_feedback' não encontrado!");
      renderPerguntasTable([]);
    }
  } catch (error) {
    console.error("Erro ao carregar configurações:", error);
    feedbackEl.textContent = "Erro ao carregar as configurações.";
    feedbackEl.style.color = "red";
  } finally {
    spinner.style.display = "none";
  }
}

function populateForm(data) {
  const form = document.getElementById("config-form");
  for (const mapKey in data) {
    if (!data.hasOwnProperty(mapKey)) continue;
    const mapData = data[mapKey];
    for (const fieldKey in mapData) {
      if (
        !mapData.hasOwnProperty(fieldKey) ||
        fieldKey === "faixasContribuicao"
      )
        continue;
      const fieldName = `${mapKey}.${fieldKey}`;
      const field = form.elements[fieldName];
      if (field) {
        field.value = Array.isArray(mapData[fieldKey])
          ? mapData[fieldKey].join("\n")
          : mapData[fieldKey];
      }
    }
  }
}

// --- LÓGICA DE SALVAMENTO ---
async function saveConfig() {
  const feedbackEl = document.getElementById("save-feedback");
  const spinner = document.getElementById("loading-spinner");
  const saveButton = document.getElementById("save-button");
  saveButton.disabled = true;
  spinner.style.display = "block";
  feedbackEl.textContent = "";

  try {
    // --- SALVAR CONFIG GERAL ---
    const configGeralObject = {};
    const formData = new FormData(document.getElementById("config-form"));
    for (const [key, value] of formData.entries()) {
      const [mapKey, fieldKey] = key.split(".");
      if (!mapKey || !fieldKey) continue;
      if (!configGeralObject[mapKey]) configGeralObject[mapKey] = {};
      const element = document.querySelector(`[name="${key}"]`);
      if (element?.tagName === "TEXTAREA" && key.startsWith("listas.")) {
        configGeralObject[mapKey][fieldKey] = value
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line);
      } else {
        configGeralObject[mapKey][fieldKey] = value;
      }
    }
    const faixas = [];
    document
      .getElementById("faixas-contribuicao-tbody")
      .querySelectorAll("tr")
      .forEach((row) => {
        const ateSalarios = row.querySelector(
          'input[data-field="ateSalarios"]'
        ).value;
        const percentual = row.querySelector(
          'input[data-field="percentual"]'
        ).value;
        if (ateSalarios && percentual)
          faixas.push({
            ateSalarios: parseFloat(ateSalarios),
            percentual: parseFloat(percentual),
          });
      });
    faixas.sort((a, b) => a.ateSalarios - b.ateSalarios);
    if (!configGeralObject.financeiro) configGeralObject.financeiro = {};
    configGeralObject.financeiro.faixasContribuicao = faixas;

    // --- SALVAR MODELO DE FEEDBACK ---
    const perguntas = [];
    document
      .getElementById("perguntas-feedback-tbody")
      .querySelectorAll("tr")
      .forEach((row) => {
        const id = row.querySelector('input[data-field="id"]').value.trim();
        const texto = row
          .querySelector('input[data-field="texto"]')
          .value.trim();
        const tipo = row.querySelector('select[data-field="tipo"]').value;
        const opcoes = row
          .querySelector('input[data-field="opcoes"]')
          .value.split(",")
          .map((o) => o.trim())
          .filter((o) => o);
        if (id && texto && tipo) {
          const pergunta = { id, texto, tipo };
          if (tipo === "select") pergunta.opcoes = opcoes;
          perguntas.push(pergunta);
        }
      });
    const configFeedbackObject = { perguntas };

    await Promise.all([
      setDoc(configGeralRef, configGeralObject, { merge: true }),
      setDoc(configFeedbackRef, configFeedbackObject),
    ]);

    feedbackEl.textContent = "Configurações salvas com sucesso!";
    feedbackEl.style.color = "green";
  } catch (error) {
    console.error("Erro ao salvar configurações: ", error);
    feedbackEl.textContent = "Erro ao salvar. Verifique o console.";
    feedbackEl.style.color = "red";
  } finally {
    saveButton.disabled = false;
    spinner.style.display = "none";
    setTimeout(() => {
      if (feedbackEl) feedbackEl.textContent = "";
    }, 3000);
  }
}

// --- FUNÇÕES PARA A TABELA DE FAIXAS ---
function renderFaixasTable(faixas = []) {
  const tbody = document.getElementById("faixas-contribuicao-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  faixas.forEach((faixa) => tbody.appendChild(createFaixaRow(faixa)));
}

function createFaixaRow(faixa = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
        <td><input type="number" step="0.1" placeholder="Ex: 1.5" data-field="ateSalarios" value="${
          faixa.ateSalarios || ""
        }"></td>
        <td><input type="number" step="1" placeholder="Ex: 7" data-field="percentual" value="${
          faixa.percentual || ""
        }"></td>
        <td><button type="button" class="btn-remover-faixa">-</button></td>
    `;
  tr.querySelector(".btn-remover-faixa").addEventListener("click", () =>
    tr.remove()
  );
  return tr;
}

// --- FUNÇÕES PARA A TABELA DE PERGUNTAS DE FEEDBACK ---
function renderPerguntasTable(perguntas = []) {
  const tbody = document.getElementById("perguntas-feedback-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  perguntas.forEach((pergunta) =>
    tbody.appendChild(createPerguntaRow(pergunta))
  );
}

function createPerguntaRow(pergunta = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
        <td><input type="text" placeholder="ex: clareza" data-field="id" value="${
          pergunta.id || ""
        }"></td>
        <td><input type="text" placeholder="Texto da pergunta" data-field="texto" value="${
          pergunta.texto || ""
        }"></td>
        <td>
            <select data-field="tipo">
                <option value="select" ${
                  pergunta.tipo === "select" ? "selected" : ""
                }>Seleção (select)</option>
                <option value="textarea" ${
                  pergunta.tipo === "textarea" ? "selected" : ""
                }>Texto (textarea)</option>
            </select>
        </td>
        <td><input type="text" placeholder="Opção1,Opção2,..." data-field="opcoes" value="${(
          pergunta.opcoes || []
        ).join(", ")}"></td>
        <td><button type="button" class="btn-remover-faixa">-</button></td>
    `;
  tr.querySelector(".btn-remover-faixa").addEventListener("click", () =>
    tr.remove()
  );
  return tr;
}

// --- INICIALIZAÇÃO DO MÓDULO ---
export function init() {
  console.log("⚙️ Módulo de Configurações iniciado.");
  window.openTab = openTab;
  document.querySelector(".tab-link")?.click();
  loadConfig();
  document.getElementById("save-button")?.addEventListener("click", saveConfig);
  document
    .getElementById("btn-adicionar-faixa")
    ?.addEventListener("click", () => {
      document
        .getElementById("faixas-contribuicao-tbody")
        .appendChild(createFaixaRow());
    });
  document
    .getElementById("btn-adicionar-pergunta")
    ?.addEventListener("click", () => {
      document
        .getElementById("perguntas-feedback-tbody")
        .appendChild(createPerguntaRow());
    });
}
