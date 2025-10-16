// Arquivo: /modulos/financeiro/js/devedores.js
// Versão: 3.0 (Migrado para a sintaxe modular do Firebase v9)

import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "../../../assets/js/firebase-init.js";

export function init() {
  const appContent = document.getElementById("devedores-content");
  if (!appContent) return;

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

  function getDividaTotal(profissional, DB) {
    const dividaInfo = { valor: 0, meses: [] };
    if (!profissional || !profissional.uid) return dividaInfo;

    const profId = profissional.uid;
    const nomeKey_antigo = sanitizeKey(profissional.nome);
    const anoAtual = new Date().getFullYear();
    const mesAtualIndex = new Date().getMonth();

    for (let i = 0; i <= mesAtualIndex; i++) {
      const mes = meses[i];

      let dividaDoMes = DB.cobranca?.[anoAtual]?.[profId]?.[mes];
      if (dividaDoMes === undefined) {
        dividaDoMes = DB.cobranca?.[anoAtual]?.[nomeKey_antigo]?.[mes] || 0;
      }

      let pagamentoDoMes = DB.repasses?.[anoAtual]?.[mes]?.[profId];
      if (pagamentoDoMes === undefined) {
        pagamentoDoMes = DB.repasses?.[anoAtual]?.[mes]?.[nomeKey_antigo];
      }

      if (dividaDoMes > 0 && !pagamentoDoMes) {
        dividaInfo.valor += dividaDoMes;
        dividaInfo.meses.push(mes.charAt(0).toUpperCase() + mes.slice(1));
      }
    }
    return dividaInfo;
  }

  function renderDevedores(DB, filtroProfissional = "todos") {
    let devedoresHtml = "";

    let profissionaisFiltrados = (DB.profissionais || []).filter(
      (prof) => prof.nome && !prof.inativo && !prof.primeiraFase
    );

    devedoresHtml += `
            <div class="filter-box">
                <label for="devedores-profissional-selector"><strong>Filtrar por Profissional:</strong></label>
                <select id="devedores-profissional-selector">
                    <option value="todos">Todos os Devedores</option>
                    ${profissionaisFiltrados
                      .sort((a, b) => a.nome.localeCompare(b.nome))
                      .map(
                        (p) =>
                          `<option value="${p.uid}" ${
                            filtroProfissional === p.uid ? "selected" : ""
                          }>${p.nome}</option>`
                      )
                      .join("")}
                </select>
            </div>`;

    devedoresHtml += `<div class="table-section"><table id="devedores-table"><thead><tr><th>Profissional</th><th>Meses Pendentes</th><th>Valor Total Devido (R$)</th></tr></thead><tbody>`;
    let totalGeralDevido = 0;
    const listaDevedores = [];

    if (filtroProfissional !== "todos") {
      profissionaisFiltrados = profissionaisFiltrados.filter(
        (p) => p.uid === filtroProfissional
      );
    }

    profissionaisFiltrados.forEach((prof) => {
      const dividaInfo = getDividaTotal(prof, DB);
      if (dividaInfo.valor > 0) {
        listaDevedores.push({
          nome: prof.nome,
          meses: dividaInfo.meses.join(", "),
          valor: dividaInfo.valor,
        });
        totalGeralDevido += dividaInfo.valor;
      }
    });

    listaDevedores.sort((a, b) => b.valor - a.valor);

    if (listaDevedores.length > 0) {
      listaDevedores.forEach((devedor) => {
        devedoresHtml += `<tr><td>${devedor.nome}</td><td>${
          devedor.meses
        }</td><td>R$ ${devedor.valor.toFixed(2).replace(".", ",")}</td></tr>`;
      });
    } else {
      devedoresHtml += `<tr><td colspan="3">Nenhum devedor encontrado para o filtro selecionado.</td></tr>`;
    }

    devedoresHtml += `</tbody><tfoot><tr><td colspan="2"><strong>Total Geral Devido</strong></td><td><strong>R$ ${totalGeralDevido
      .toFixed(2)
      .replace(".", ",")}</strong></td></tr></tfoot></table></div>`;
    appContent.innerHTML = devedoresHtml;

    document
      .getElementById("devedores-profissional-selector")
      .addEventListener("change", (e) => {
        renderDevedores(DB, e.target.value);
      });
  }

  async function fetchData() {
    appContent.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const usuariosRef = collection(db, "usuarios");
      const q = query(usuariosRef, where("fazAtendimento", "==", true));

      const [usuariosSnapshot, configSnapshot] = await Promise.all([
        getDocs(q),
        getDoc(doc(db, "financeiro", "configuracoes")),
      ]);

      const DB_data = {
        profissionais: usuariosSnapshot.docs.map((doc) => doc.data()),
        cobranca: configSnapshot.exists() ? configSnapshot.data().cobranca : {},
        repasses: configSnapshot.exists() ? configSnapshot.data().repasses : {},
      };

      renderDevedores(DB_data);
    } catch (error) {
      console.error("Erro ao carregar dados para Devedores:", error);
      appContent.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar dados do Firestore.</p>`;
    }
  }

  fetchData();
}
