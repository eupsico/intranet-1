// Arquivo: /modulos/financeiro/js/controle_pagamentos.js
// Versão: 3.0 (Migrado para a sintaxe modular do Firebase v9)

import {
  db,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  deleteField,
  query,
  where,
  addDoc,
} from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  const appContent = document.getElementById("pagamentos-content");
  if (!appContent) return;

  let DB = { profissionais: [], cobranca: {}, repasses: {} };
  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];

  const sanitizeKey = (key) =>
    !key ? "" : key.replace(/\.|\$|\[|\]|#|\//g, "_");

  async function fetchData() {
    appContent.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const [usuariosSnapshot, configSnapshot] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDoc(doc(db, "financeiro", "configuracoes")),
      ]);

      DB.profissionais = usuariosSnapshot.docs.map((doc) => doc.data());
      const configData = configSnapshot.exists() ? configSnapshot.data() : {};
      DB.cobranca = configData.cobranca || {};
      DB.repasses = configData.repasses || {};

      const d = new Date();
      renderPagamentos(d.getFullYear(), d.getMonth());
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      appContent.innerHTML = `<p style="color:red;">Erro ao carregar dados do Firestore.</p>`;
    }
  }

  function renderPagamentos(ano, mesIndex, filtroProfissional = "todos") {
    const mes = meses[mesIndex];
    const vencimento = new Date(
      ano,
      parseInt(mesIndex) + 1,
      10
    ).toLocaleDateString("pt-BR");
    const currentYear = new Date().getFullYear();
    let years = [];
    for (let i = currentYear - 1; i <= currentYear + 5; i++) {
      years.push(i);
    }

    const profissionaisAtivos = (DB.profissionais || [])
      .filter(
        (prof) =>
          prof.nome &&
          !prof.primeiraFase &&
          !prof.inativo &&
          prof.profissao !== "Assistente Social"
      )
      .sort((a, b) => a.nome.localeCompare(b.nome));

    let filtersHtml = `
            <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px;">
                <div class="filter-box">
                    <h4>Selecionar Período:</h4>
                    <div class="selectors">
                        <select id="repasse-mes-selector">${meses
                          .map(
                            (m, i) =>
                              `<option value="${i}" ${
                                i === mesIndex ? "selected" : ""
                              }>${
                                m.charAt(0).toUpperCase() + m.slice(1)
                              }</option>`
                          )
                          .join("")}</select>
                        <select id="repasse-ano-selector">${years
                          .map(
                            (y) =>
                              `<option value="${y}" ${
                                y === ano ? "selected" : ""
                              }>${y}</option>`
                          )
                          .join("")}</select>
                    </div>
                </div>
                <div class="filter-box">
                    <label for="pagamentos-profissional-selector"><strong>Filtrar por Profissional:</strong></label>
                    <select id="pagamentos-profissional-selector">
                        <option value="todos">Todos os Profissionais</option>
                        ${profissionaisAtivos
                          .map(
                            (p) =>
                              `<option value="${p.uid}" ${
                                filtroProfissional === p.uid ? "selected" : ""
                              }>${p.nome}</option>`
                          )
                          .join("")}
                    </select>
                </div>
            </div>`;

    let tableHtml = `<div class="table-section"><table><thead><tr><th>Profissional</th><th>Data Vencimento</th><th>Valor a Pagar (R$)</th><th>Data Pagamento</th><th>Ação</th></tr></thead><tbody>`;

    let profissionaisParaRenderizar = profissionaisAtivos;
    if (filtroProfissional !== "todos") {
      profissionaisParaRenderizar = profissionaisAtivos.filter(
        (p) => p.uid === filtroProfissional
      );
    }

    profissionaisParaRenderizar.forEach((prof) => {
      const profId = prof.uid;
      const nomeKey_antigo = sanitizeKey(prof.nome);

      let valorDevido = DB.cobranca[ano]?.[profId]?.[mes];
      if (valorDevido === undefined) {
        valorDevido = DB.cobranca[ano]?.[nomeKey_antigo]?.[mes] || 0;
      }

      let repasseSalvo = DB.repasses[ano]?.[mes]?.[profId];
      if (repasseSalvo === undefined) {
        repasseSalvo = DB.repasses[ano]?.[mes]?.[nomeKey_antigo] || "";
      }

      if (valorDevido > 0) {
        tableHtml += `<tr data-prof-id="${profId}">
                    <td>${prof.nome}</td>
                    <td>${vencimento}</td>
                    <td>R$ ${valorDevido.toFixed(2).replace(".", ",")}</td>
                    <td><input type="date" class="repasse-data-pg" value="${
                      repasseSalvo || ""
                    }"></td>
                    <td><button class="action-button save-repasse-btn">Salvar</button></td>
                </tr>`;
      }
    });

    if (
      profissionaisParaRenderizar.length === 0 &&
      filtroProfissional !== "todos"
    ) {
      tableHtml += `<tr><td colspan="5">Nenhum pagamento encontrado para o profissional selecionado neste período.</td></tr>`;
    }

    appContent.innerHTML = filtersHtml + tableHtml + `</tbody></table></div>`;
    attachEventListeners();
  }

  function attachEventListeners() {
    const mesSelector = document.getElementById("repasse-mes-selector");
    if (mesSelector) mesSelector.addEventListener("change", handlePeriodChange);

    const anoSelector = document.getElementById("repasse-ano-selector");
    if (anoSelector) anoSelector.addEventListener("change", handlePeriodChange);

    const profSelector = document.getElementById(
      "pagamentos-profissional-selector"
    );
    if (profSelector)
      profSelector.addEventListener("change", handlePeriodChange);

    const table = appContent.querySelector("table");
    if (table) table.addEventListener("click", handleSaveClick);
  }

  function handlePeriodChange() {
    const ano = document.getElementById("repasse-ano-selector").value;
    const mesIndex = document.getElementById("repasse-mes-selector").value;
    const profId = document.getElementById(
      "pagamentos-profissional-selector"
    ).value;
    renderPagamentos(parseInt(ano), parseInt(mesIndex), profId);
  }

  async function handleSaveClick(e) {
    const target = e.target;
    if (target.classList.contains("save-repasse-btn")) {
      target.disabled = true;
      target.textContent = "...";

      const row = target.closest("tr");
      const profId = row.dataset.profId;
      const dataPg = row.querySelector(".repasse-data-pg").value;
      const ano = document.getElementById("repasse-ano-selector").value;
      const mesIndex = document.getElementById("repasse-mes-selector").value;
      const mes = meses[mesIndex];

      const nomeProfissional = row.cells[0].textContent;
      const valor = parseFloat(
        row.cells[2].textContent.replace("R$ ", "").replace(",", ".")
      );
      const vencimentoDate = new Date(ano, parseInt(mesIndex) + 1, 10);
      const dataVencimento = vencimentoDate.toISOString().split("T")[0];
      const descricaoBusca = `Recebimento - ${nomeProfissional} (Ref. ${mes}/${ano})`;

      if (!profId) {
        window.showToast("Erro: UID do profissional não encontrado.", "error");
        target.disabled = false;
        target.textContent = "Salvar";
        return;
      }

      try {
        const configRef = doc(db, "financeiro", "configuracoes");
        const repassePath = `repasses.${ano}.${mes}.${profId}`;
        const repasseUpdate = {};

        if (dataPg) {
          repasseUpdate[repassePath] = dataPg;
        } else {
          repasseUpdate[repassePath] = deleteField();
        }
        await updateDoc(configRef, repasseUpdate);

        const fluxoCaixaRef = collection(db, "fluxoCaixa");
        const q = query(
          fluxoCaixaRef,
          where("descricao", "==", descricaoBusca)
        );
        const fluxoCaixaQuery = await getDocs(q);

        if (dataPg) {
          const novoLancamento = {
            descricao: descricaoBusca,
            valor,
            tipo: "receita",
            categoria: "Recebimento Profissional",
            dataVencimento,
            dataPagamento: dataPg,
            status: "pago",
            timestamp: serverTimestamp(),
          };
          if (fluxoCaixaQuery.empty) {
            await addDoc(fluxoCaixaRef, novoLancamento);
          } else {
            const lancamentoDocRef = doc(
              db,
              "fluxoCaixa",
              fluxoCaixaQuery.docs[0].id
            );
            await updateDoc(lancamentoDocRef, novoLancamento);
          }
        } else {
          if (!fluxoCaixaQuery.empty) {
            const lancamentoDocRef = doc(
              db,
              "fluxoCaixa",
              fluxoCaixaQuery.docs[0].id
            );
            await deleteDoc(lancamentoDocRef);
          }
        }

        target.textContent = "Salvo!";
        target.style.backgroundColor = "#28a745";
        setTimeout(() => {
          target.disabled = false;
          target.textContent = "Salvar";
          target.style.backgroundColor = "";
        }, 2000);

        if (!DB.repasses[ano]) DB.repasses[ano] = {};
        if (!DB.repasses[ano][mes]) DB.repasses[ano][mes] = {};
        if (dataPg) DB.repasses[ano][mes][profId] = dataPg;
        else delete DB.repasses[ano][mes][profId];
      } catch (err) {
        window.showToast("Erro ao salvar!", "error");
        target.disabled = false;
        target.textContent = "Salvar";
        console.error(err);
      }
    }
  }

  fetchData();
}
