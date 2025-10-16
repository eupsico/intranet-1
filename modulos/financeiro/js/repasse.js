// Arquivo: /modulos/financeiro/js/repasse.js
// Versão: 2.2 (Atualizado para Firebase v9)
// Descrição: Adiciona funcionalidade de editar profissional e padroniza botões da tabela.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

export function init(db, user, userData) {
  if (!db) {
    return;
  }

  const mainContentDiv = document.getElementById("repasse-main-content");

  let DB = { profissionais: [], comprovantes: [], cobranca: {} };
  let currentlyDisplayedData = [];
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const formatCurrency = (value) =>
    (value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  const formatDate = (dateStr) =>
    dateStr ? dateStr.split("-").reverse().join("/") : "---";
  const sanitizeKey = (key) =>
    !key ? "" : key.replace(/\.|\$|\[|\]|#|\//g, "_");

  function showMessage(message, type = "info") {
    const messageEl = document.getElementById("status-message");
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.className = `status-${type}`;
    messageEl.style.display = "block";
    setTimeout(() => {
      messageEl.style.display = "none";
    }, 4000);
  }

  function showConfirmation(message, onConfirm) {
    const modal = document.getElementById("custom-confirm-repasse");
    const messageEl = document.getElementById("confirm-repasse-message");
    const btnYes = document.getElementById("confirm-repasse-yes");
    const btnNo = document.getElementById("confirm-repasse-no");

    if (!modal || !messageEl || !btnYes || !btnNo) return;

    messageEl.textContent = message;
    modal.classList.add("is-visible");

    btnYes.onclick = () => {
      modal.classList.remove("is-visible");
      onConfirm();
    };
    btnNo.onclick = () => {
      modal.classList.remove("is-visible");
    };
  }

  async function fetchData() {
    mainContentDiv.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const [usuariosSnap, configSnap, comprovantesSnap] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDoc(doc(db, "financeiro", "configuracoes")),
        getDocs(collection(db, "comprovantes")),
      ]);

      DB.profissionais = usuariosSnap.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));
      DB.comprovantes = comprovantesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const configData = configSnap.exists() ? configSnap.data() : {};
      DB.cobranca = configData.cobranca || {};

      renderInitialLayout();
      updateView();
    } catch (error) {
      mainContentDiv.innerHTML =
        '<p style="color:red;">Erro ao carregar dados.</p>';
      console.error(error);
    }
  }

  function renderInitialLayout() {
    const currentYear = new Date().getFullYear();
    let yearsHtml = "";
    for (let y = currentYear - 3; y <= currentYear + 1; y++) {
      yearsHtml += `<option value="${y}" ${
        y === currentYear ? "selected" : ""
      }>${y}</option>`;
    }

    const ativos = DB.profissionais
      .filter(
        (p) =>
          p.nome && !p.primeiraFase && !p.inativo && p.recebeDireto === true
      )
      .sort((a, b) => a.nome.localeCompare(b.nome));

    mainContentDiv.innerHTML = `
            <div class="repasse-filters-container">
                <div class="filter-box">
                    <label for="filtro-profissional">Filtrar por Profissional</label>
                    <select id="filtro-profissional">
                        <option value="todos">Todos os Profissionais</option>
                        ${ativos
                          .map(
                            (p) => `<option value="${p.uid}">${p.nome}</option>`
                          )
                          .join("")}
                    </select>
                </div>
                <div class="filter-box">
                    <label for="filtro-mes">Filtrar por Mês de Referência</label>
                    <select id="filtro-mes">
                        <option value="todos">Todos os Meses</option>
                        ${meses
                          .map(
                            (m, i) =>
                              `<option value="${m.toLowerCase()}">${m}</option>`
                          )
                          .join("")}
                    </select>
                </div>
                <div class="filter-box">
                    <label for="filtro-ano">Filtrar por Ano</label>
                    <select id="filtro-ano">${yearsHtml}</select>
                </div>
                <div class="filter-box export-buttons">
                    <button id="export-pdf-btn" class="action-button btn-pdf">Exportar PDF</button>
                    <button id="export-csv-btn" class="action-button btn-excel">Exportar CSV</button>
                </div>
            </div>
            <div id="summary-container" style="display: none;">
                <div class="summary-cards">
                    <div class="card recebido"><h3>Total Recebido (Comprovantes)</h3><p id="total-recebido">R$ 0,00</p></div>
                    <div class="card devido"><h3 id="titulo-devido">Total Devido</h3><p id="total-devido">R$ 0,00</p></div>
                    <div class="card saldo"><h3 id="titulo-saldo">Saldo (Repasse)</h3><p id="saldo-profissional">R$ 0,00</p></div>
                </div>
            </div>
            <div class="table-section">
                <h3>Comprovantes Enviados no Período</h3>
                <table id="comprovantes-table">
                    <thead><tr><th>Profissional</th><th>Data Pag.</th><th>Mês Ref.</th><th>Valor Pago</th><th>Link</th><th>Ações</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        `;
    attachEventListeners();
  }

  function attachEventListeners() {
    document
      .getElementById("filtro-profissional")
      .addEventListener("change", updateView);
    document
      .getElementById("filtro-mes")
      .addEventListener("change", updateView);
    document
      .getElementById("filtro-ano")
      .addEventListener("change", updateView);
    document
      .getElementById("export-pdf-btn")
      .addEventListener("click", () => generateReport("pdf"));
    document
      .getElementById("export-csv-btn")
      .addEventListener("click", () => generateReport("csv"));

    // ALTERAÇÃO: Listener de clique centralizado para todas as ações da tabela
    document
      .getElementById("comprovantes-table")
      .addEventListener("click", handleTableClick);
  }

  function updateView() {
    const selectedProfId = document.getElementById("filtro-profissional").value;
    const selectedMes = document.getElementById("filtro-mes").value;
    const selectedAno = document.getElementById("filtro-ano").value;
    const summaryContainer = document.getElementById("summary-container");

    let filteredData = DB.comprovantes;

    if (selectedProfId !== "todos") {
      const prof = DB.profissionais.find((p) => p.uid === selectedProfId);
      if (prof) {
        // Filtra pelo nome do profissional, já que é assim que está salvo no comprovante
        filteredData = filteredData.filter((c) => c.profissional === prof.nome);
      }
    }
    if (selectedMes !== "todos") {
      filteredData = filteredData.filter(
        (c) => c.mesReferencia && c.mesReferencia.toLowerCase() === selectedMes
      );
    }
    if (selectedAno) {
      filteredData = filteredData.filter((c) => c.anoReferencia == selectedAno);
    }

    currentlyDisplayedData = filteredData;
    renderTable(filteredData);

    if (selectedProfId !== "todos") {
      summaryContainer.style.display = "block";
      calculateSummary(selectedProfId, filteredData);
    } else {
      summaryContainer.style.display = "none";
    }
  }

  function calculateSummary(professionalId, comprovantesFiltrados) {
    const professional = DB.profissionais.find((p) => p.uid === professionalId);
    if (!professional) return;

    const selectedMes = document.getElementById("filtro-mes").value;
    const selectedAno = document.getElementById("filtro-ano").value;
    const totalRecebido = comprovantesFiltrados.reduce(
      (sum, c) => sum + (c.valor || 0),
      0
    );

    const profId = professional.uid;
    const profKey_antigo = sanitizeKey(professional.nome);
    let totalDevido = 0;

    if (selectedMes !== "todos") {
      totalDevido =
        DB.cobranca[selectedAno]?.[profId]?.[selectedMes] ||
        DB.cobranca[selectedAno]?.[profKey_antigo]?.[selectedMes] ||
        0;
    } else {
      const cobrancasDoAno =
        DB.cobranca[selectedAno]?.[profId] ||
        DB.cobranca[selectedAno]?.[profKey_antigo];
      if (cobrancasDoAno) {
        for (const mes in cobrancasDoAno) {
          totalDevido += cobrancasDoAno[mes] || 0;
        }
      }
    }

    const saldo = totalRecebido - totalDevido;

    document.getElementById("total-recebido").textContent =
      formatCurrency(totalRecebido);
    document.getElementById("total-devido").textContent =
      formatCurrency(totalDevido);
    document.getElementById("saldo-profissional").textContent =
      formatCurrency(saldo);
    document.getElementById("titulo-devido").textContent = `Total Devido (${
      selectedMes === "todos" ? "Ano" : "Mês"
    })`;
    document.getElementById("titulo-saldo").textContent = `Saldo (Repasse)`;
  }

  function renderTable(comprovantes) {
    const comprovantesTableBody = document
      .getElementById("comprovantes-table")
      .querySelector("tbody");
    comprovantes.sort((a, b) => {
      const dateA = a.dataPagamento
        ? new Date(a.dataPagamento)
        : new Date(a.timestamp?.toDate());
      const dateB = b.dataPagamento
        ? new Date(b.dataPagamento)
        : new Date(b.timestamp?.toDate());
      return dateB - dateA;
    });

    if (comprovantes.length === 0) {
      comprovantesTableBody.innerHTML =
        '<tr><td colspan="6">Nenhum comprovante para os filtros selecionados.</td></tr>';
    } else {
      comprovantesTableBody.innerHTML = comprovantes
        .map(
          (c) => `
                <tr data-comprovante-id="${c.id}">
                    <td>${c.profissional || "N/A"}</td>
                    <td>${formatDate(c.dataPagamento)}</td>
                    <td>${
                      c.mesReferencia
                        ? c.mesReferencia.charAt(0).toUpperCase() +
                          c.mesReferencia.slice(1)
                        : "N/A"
                    }/${c.anoReferencia || ""}</td>
                    <td>${formatCurrency(c.valor || 0)}</td>
                    <td><a href="${
                      c.comprovanteUrl
                    }" target="_blank" rel="noopener noreferrer" class="action-button">Ver</a></td>
                    <td>
                        <div class="table-actions">
                            <button class="action-button btn-edit">Editar</button>
                            <button class="action-button btn-delete">Excluir</button>
                        </div>
                    </td>
                </tr>
            `
        )
        .join("");
    }
  }

  // ALTERAÇÃO: Nova função para lidar com todos os cliques na tabela
  async function handleTableClick(e) {
    const target = e.target;
    const row = target.closest("tr");
    if (!row) return;

    const comprovanteId = row.dataset.comprovanteId;

    // Ação de Excluir
    if (target.classList.contains("btn-delete")) {
      deleteComprovante(comprovanteId);
    }

    // Ação de Editar
    if (target.classList.contains("btn-edit")) {
      const profissionalCell = row.cells[0];
      const originalName = profissionalCell.textContent;

      const ativos = DB.profissionais
        .filter((p) => p.nome && !p.inativo)
        .sort((a, b) => a.nome.localeCompare(b.nome));
      const selectOptions = ativos
        .map(
          (p) =>
            `<option value="${p.uid}" ${
              p.nome === originalName ? "selected" : ""
            }>${p.nome}</option>`
        )
        .join("");

      profissionalCell.innerHTML = `<select class="edit-prof-selector">${selectOptions}</select>`;
      row.cells[5].innerHTML = `
                <div class="table-actions">
                    <button class="action-button btn-save-edit">Salvar</button>
                    <button class="action-button btn-cancel-edit">Cancelar</button>
                </div>
            `;
    }

    // Ação de Cancelar Edição
    if (target.classList.contains("btn-cancel-edit")) {
      updateView(); // Simplesmente re-renderiza a tabela
    }

    // Ação de Salvar Edição
    if (target.classList.contains("btn-save-edit")) {
      const select = row.querySelector(".edit-prof-selector");
      const newProfId = select.value;
      const newProfName = select.options[select.selectedIndex].text;

      target.disabled = true;
      target.textContent = "Salvando...";

      try {
        const comprovanteRef = doc(db, "comprovantes", comprovanteId);
        await updateDoc(comprovanteRef, {
          profissional: newProfName,
          profissionalId: newProfId, // Adiciona/atualiza o UID para consistência futura
        });
        window.showToast("Profissional atualizado com sucesso!", "success");
        fetchData(); // Recarrega todos os dados para garantir consistência
      } catch (error) {
        window.showToast("Erro ao atualizar o profissional.", "error");
        console.error("Erro ao atualizar comprovante:", error);
        updateView(); // Re-renderiza para o estado anterior em caso de erro
      }
    }
  }

  function deleteComprovante(comprovanteId) {
    if (!comprovanteId) return;
    showConfirmation(
      "Tem certeza que deseja excluir este comprovante? Esta ação não pode ser desfeita.",
      async () => {
        try {
          await deleteDoc(doc(db, "comprovantes", comprovanteId));
          window.showToast("Comprovante excluído com sucesso!", "success");
          DB.comprovantes = DB.comprovantes.filter(
            (c) => c.id !== comprovanteId
          );
          updateView();
        } catch (error) {
          window.showToast("Ocorreu um erro ao tentar excluir.", "error");
          console.error("Erro ao excluir comprovante: ", error);
        }
      }
    );
  }

  function generateReport(format) {
    if (currentlyDisplayedData.length === 0) {
      showMessage("Não há dados para exportar.", "info");
      return;
    }
    const profId = document.getElementById("filtro-profissional").value;
    const profNome =
      profId !== "todos"
        ? DB.profissionais.find((p) => p.uid === profId).nome
        : "Geral";
    const mes = document.getElementById("filtro-mes").value;
    const ano = document.getElementById("filtro-ano").value;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    if (profId !== "todos") {
      const totalRecebido = parseFloat(
        document
          .getElementById("total-recebido")
          .textContent.replace(/[^\d,-]/g, "")
          .replace(",", ".")
      );
      const totalDevido = parseFloat(
        document
          .getElementById("total-devido")
          .textContent.replace(/[^\d,-]/g, "")
          .replace(",", ".")
      );
      const saldo = parseFloat(
        document
          .getElementById("saldo-profissional")
          .textContent.replace(/[^\d,-]/g, "")
          .replace(",", ".")
      );

      if (format === "pdf") {
        doc.setFontSize(18);
        doc.text(`Resumo Financeiro - ${profNome}`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Período: ${mes}/${ano}`, 14, 28);
        doc.autoTable({
          head: [["Item", "Valor"]],
          body: [
            ["Total Recebido (Comprovantes)", formatCurrency(totalRecebido)],
            ["Total Devido (Mês/Ano)", formatCurrency(totalDevido)],
            ["Saldo (Repasse)", formatCurrency(saldo)],
          ],
          startY: 35,
        });
        doc.save(`resumo_${profNome}_${mes}.pdf`);
      } else if (format === "csv") {
        let csvContent = "Item;Valor\n";
        csvContent += `"Total Recebido (Comprovantes)";"${totalRecebido
          .toFixed(2)
          .replace(".", ",")}"\n`;
        csvContent += `"Total Devido (Mês/Histórico)";"${totalDevido
          .toFixed(2)
          .replace(".", ",")}"\n`;
        csvContent += `"Saldo (Crédito/Débito)";"${saldo
          .toFixed(2)
          .replace(".", ",")}"\n`;
        downloadFile(
          csvContent,
          `resumo_${profNome}_${mes}.csv`,
          "text/csv;charset=utf-8;"
        );
      }
    } else {
      if (format === "pdf") {
        doc.setFontSize(18);
        doc.text(`Relatório Geral de Comprovantes`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Período: ${mes}/${ano}`, 14, 28);
        doc.autoTable({
          head: [["Profissional", "Data Pag.", "Mês Ref.", "Valor Pago"]],
          body: currentlyDisplayedData.map((c) => [
            c.profissional,
            formatDate(c.dataPagamento),
            `${c.mesReferencia}/${c.anoReferencia}`,
            formatCurrency(c.valor || 0),
          ]),
          startY: 35,
        });
        doc.save(`relatorio_geral_${mes}_${ano}.pdf`);
      } else if (format === "csv") {
        let csvContent =
          "Profissional;Data Pagamento;Mes Referencia;Valor Pago;Link Comprovante\n";
        currentlyDisplayedData.forEach((c) => {
          csvContent += `"${c.profissional}";"${formatDate(
            c.dataPagamento
          )}";"${c.mesReferencia}/${c.anoReferencia}";"${(c.valor || 0)
            .toFixed(2)
            .replace(".", ",")}";"${c.comprovanteUrl}"\n`;
        });
        downloadFile(
          csvContent,
          `relatorio_comprovantes_${mes}_${ano}.csv`,
          "text/csv;charset=utf-8;"
        );
      }
    }
  }

  function downloadFile(content, fileName, mimeType) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mimeType }));
    a.setAttribute("download", fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  fetchData();
}
