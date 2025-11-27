// Arquivo: /modulos/admin/js/configuracoes.js
// Versão: 6.1 (Com atualização garantida de profissionaisPB_ids)

import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
} from "../../../assets/js/firebase-init.js";

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

// --- LÓGICA DE MANUTENÇÃO (CORREÇÃO DE IDs e ARRAY DE BUSCA) ---
async function executarCorrecaoIdsPB() {
  const btn = document.getElementById("btn-corrigir-ids-pb");
  const logDiv = document.getElementById("log-manutencao");

  if (
    !confirm(
      "Isso irá varrer TODOS os pacientes para:\n1. Corrigir IDs faltantes em 'atendimentosPB' pelo nome.\n2. Atualizar o array 'profissionaisPB_ids'.\nDeseja continuar?"
    )
  ) {
    return;
  }

  btn.disabled = true;
  btn.textContent = "Processando...";
  logDiv.style.display = "block";
  logDiv.innerHTML = "Iniciando varredura...<br>";

  const log = (msg) => {
    logDiv.innerHTML += `<div>${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(`[Correção IDs] ${msg}`);
  };

  try {
    // 1. Carregar mapeamento de Usuários (Nome -> ID)
    log("Carregando lista de usuários...");
    const usersSnap = await getDocs(collection(db, "usuarios"));
    const userMap = {};
    usersSnap.forEach((doc) => {
      const data = doc.data();
      if (data.nome) {
        // Normaliza para lowercase e trim para facilitar comparação
        userMap[data.nome.toLowerCase().trim()] = doc.id;
      }
    });
    log(`Mapeados ${Object.keys(userMap).length} usuários.`);

    // 2. Carregar Pacientes
    log("Carregando pacientes...");
    const patientsSnap = await getDocs(collection(db, "trilhaPaciente"));
    let updatedCount = 0;
    let errorCount = 0;

    // 3. Iterar e Corrigir
    for (const pDoc of patientsSnap.docs) {
      const pData = pDoc.data();
      const atendimentos = pData.atendimentosPB;

      if (
        !atendimentos ||
        !Array.isArray(atendimentos) ||
        atendimentos.length === 0
      ) {
        continue;
      }

      let needsUpdate = false;

      // A. Correção dos IDs dentro dos objetos de atendimento
      const newAtendimentos = atendimentos.map((at) => {
        // Verifica se tem Nome mas NÃO tem ID (ou ID está vazio)
        if (
          at.profissionalNome &&
          (!at.profissionalId || at.profissionalId.trim() === "")
        ) {
          const searchName = at.profissionalNome.toLowerCase().trim();
          const foundId = userMap[searchName];

          if (foundId) {
            log(
              `✅ ID recuperado para "${at.profissionalNome}" (Paciente: ${
                pData.nomeCompleto || pDoc.id
              })`
            );
            needsUpdate = true;
            return { ...at, profissionalId: foundId };
          } else {
            log(
              `⚠️ Profissional "${at.profissionalNome}" não encontrado em usuarios (Paciente: ${pData.nomeCompleto})`
            );
          }
        }
        return at;
      });

      // B. Reconstrução do Array 'profissionaisPB_ids' (Para garantir a busca)
      // Extrai todos os IDs únicos e válidos dos atendimentos corrigidos
      const idsUnicos = [
        ...new Set(
          newAtendimentos
            .map((at) => at.profissionalId)
            .filter((id) => id && id.trim() !== "")
        ),
      ];

      // Verifica se o array atual no banco é diferente do calculado (para evitar update desnecessário)
      const arrayAtual = pData.profissionaisPB_ids || [];
      const arraysDiferentes =
        idsUnicos.length !== arrayAtual.length ||
        !idsUnicos.every((val) => arrayAtual.includes(val));

      if (needsUpdate || arraysDiferentes) {
        try {
          const pacienteRef = doc(db, "trilhaPaciente", pDoc.id);

          await updateDoc(pacienteRef, {
            atendimentosPB: newAtendimentos,
            profissionaisPB_ids: idsUnicos, // <-- Atualização forçada do array de busca
          });

          log(
            `💾 Atualizado: ${
              pData.nomeCompleto || pDoc.id
            } (IDs Array: [${idsUnicos.join(", ")}])`
          );
          updatedCount++;
        } catch (err) {
          log(`❌ Erro ao atualizar paciente ${pDoc.id}: ${err.message}`);
          errorCount++;
        }
      }
    }

    log("--- FIM DA OPERAÇÃO ---");
    log(`Pacientes atualizados: ${updatedCount}`);
    log(`Erros de gravação: ${errorCount}`);
    alert(`Processo concluído! ${updatedCount} pacientes foram corrigidos.`);
  } catch (error) {
    console.error("Erro fatal na manutenção:", error);
    log(`Erro fatal: ${error.message}`);
    alert("Ocorreu um erro durante o processo. Verifique o log.");
  } finally {
    btn.disabled = false;
    btn.textContent = "🔄 Executar Correção de IDs";
  }
}

// --- INICIALIZAÇÃO DO MÓDULO ---
export function init() {
  console.log("⚙️ Módulo de Configurações iniciado.");
  window.openTab = openTab;
  document.querySelector(".tab-link")?.click();
  loadConfig();

  // Listeners existentes
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

  // Novo Listener para Manutenção
  document
    .getElementById("btn-corrigir-ids-pb")
    ?.addEventListener("click", executarCorrecaoIdsPB);
}
