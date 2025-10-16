import {
  db,
  collection,
  query,
  orderBy,
  getDocs,
} from "../../../assets/js/firebase-init.js";

// Armazena todos os agendamentos carregados para evitar buscas repetidas no DB
let todosOsAgendamentos = [];
let agendamentosFiltrados = [];

export async function init(user, userData) {
  const tableBody = document.getElementById("supervisao-table-body");
  const filtroMes = document.getElementById("filtro-mes");
  const exportBtn = document.getElementById("export-pdf-btn");

  if (!tableBody || !filtroMes || !exportBtn) {
    console.error("Elementos essenciais da página não foram encontrados.");
    return;
  }

  // Adiciona os listeners aos novos elementos
  filtroMes.addEventListener("change", aplicarFiltro);
  exportBtn.addEventListener("click", exportarParaPDF);

  await carregarAgendamentos();
}

/**
 * Carrega todos os agendamentos do Firestore.
 */
async function carregarAgendamentos() {
  const tableBody = document.getElementById("supervisao-table-body");
  tableBody.innerHTML =
    '<tr><td colspan="5"><div class="loading-spinner"></div></td></tr>';

  try {
    const agendamentosRef = collection(db, "agendamentos");
    const q = query(agendamentosRef, orderBy("dataAgendamento", "desc"));
    const querySnapshot = await getDocs(q);

    todosOsAgendamentos = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (todosOsAgendamentos.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="5" style="text-align: center;">Nenhum agendamento de supervisão encontrado.</td></tr>';
      return;
    }

    popularFiltroDeMes();
    aplicarFiltro(); // Aplica o filtro inicial (mês atual ou "Todos")
  } catch (error) {
    console.error("Erro ao carregar agendamentos de supervisão:", error);
    tableBody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; color: var(--cor-erro);">Ocorreu um erro ao carregar os dados.</td></tr>';
  }
}

/**
 * Popula o select de filtro com os meses que possuem agendamentos.
 */
function popularFiltroDeMes() {
  const filtroMes = document.getElementById("filtro-mes");
  const mesesComAgendamento = new Map();

  todosOsAgendamentos.forEach((agendamento) => {
    if (agendamento.dataAgendamento && agendamento.dataAgendamento.toDate) {
      const data = agendamento.dataAgendamento.toDate();
      const mesAno = `${data.getFullYear()}-${String(data.getMonth()).padStart(
        2,
        "0"
      )}`; // Formato AAAA-MM
      const nomeMesAno = data.toLocaleString("pt-BR", {
        month: "long",
        year: "numeric",
      });
      mesesComAgendamento.set(mesAno, nomeMesAno);
    }
  });

  // Converte o Map para um array, ordena e cria as opções
  const mesesOrdenados = Array.from(mesesComAgendamento.entries())
    .sort()
    .reverse();

  let optionsHtml = '<option value="todos">Todos os Meses</option>';
  mesesOrdenados.forEach(([valor, nome]) => {
    const nomeCapitalizado = nome.charAt(0).toUpperCase() + nome.slice(1);
    optionsHtml += `<option value="${valor}">${nomeCapitalizado}</option>`;
  });

  filtroMes.innerHTML = optionsHtml;
}

/**
 * Filtra os agendamentos com base no mês selecionado e renderiza a tabela.
 */
function aplicarFiltro() {
  const filtroMes = document.getElementById("filtro-mes");
  const valorFiltro = filtroMes.value;

  if (valorFiltro === "todos") {
    agendamentosFiltrados = todosOsAgendamentos;
  } else {
    const [ano, mes] = valorFiltro.split("-").map(Number);
    agendamentosFiltrados = todosOsAgendamentos.filter((agendamento) => {
      if (agendamento.dataAgendamento && agendamento.dataAgendamento.toDate) {
        const data = agendamento.dataAgendamento.toDate();
        return data.getFullYear() === ano && data.getMonth() === mes;
      }
      return false;
    });
  }

  renderizarTabela(agendamentosFiltrados);
}

/**
 * Renderiza as linhas da tabela com base em uma lista de agendamentos.
 * @param {Array} agendamentos - A lista de agendamentos a ser exibida.
 */
function renderizarTabela(agendamentos) {
  const tableBody = document.getElementById("supervisao-table-body");
  if (agendamentos.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="5" style="text-align: center;">Nenhum agendamento encontrado para este período.</td></tr>';
    return;
  }

  let rowsHtml = "";
  agendamentos.forEach((agendamento) => {
    let dataFormatada = "Data inválida";
    let horaFormatada = "";
    if (agendamento.dataAgendamento && agendamento.dataAgendamento.toDate) {
      const data = agendamento.dataAgendamento.toDate();
      dataFormatada = data.toLocaleDateString("pt-BR");
      horaFormatada = data.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    const valorSupervisao = (agendamento.valorSupervisao || 0).toLocaleString(
      "pt-BR",
      { style: "currency", currency: "BRL" }
    );
    rowsHtml += `
            <tr>
                <td>${agendamento.profissionalNome || "Não informado"}</td>
                <td>${agendamento.supervisorNome || "Não informado"}</td>
                <td>${dataFormatada}</td>
                <td>${horaFormatada}h</td>
                <td>${valorSupervisao}</td>
            </tr>
        `;
  });
  tableBody.innerHTML = rowsHtml;
}

/**
 * Gera e baixa um PDF com os dados filtrados na tabela.
 */
function exportarParaPDF() {
  // --- INÍCIO DA CORREÇÃO ---
  // Verifica se as bibliotecas jsPDF e autoTable estão disponíveis no objeto window
  if (
    typeof window.jspdf === "undefined" ||
    typeof window.jspdf.jsPDF === "undefined"
  ) {
    alert(
      "Erro: A biblioteca de PDF (jsPDF) não foi carregada. Tente recarregar a página."
    );
    console.error("Objeto window.jspdf ou window.jspdf.jsPDF não encontrado.");
    return;
  }
  // --- FIM DA CORREÇÃO ---

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const filtroMesSelect = document.getElementById("filtro-mes");
  const mesSelecionadoTexto =
    filtroMesSelect.options[filtroMesSelect.selectedIndex].text;

  doc.setFontSize(18);
  doc.text("Relatório de Agendamentos de Supervisão", 14, 22);
  doc.setFontSize(12);
  doc.text(`Mês: ${mesSelecionadoTexto}`, 14, 30);

  const head = [["Profissional", "Supervisor", "Data", "Valor"]];
  const body = agendamentosFiltrados.map((ag) => {
    const data = ag.dataAgendamento
      ? ag.dataAgendamento.toDate().toLocaleDateString("pt-BR")
      : "N/A";
    const valor = (ag.valorSupervisao || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    return [ag.profissionalNome, ag.supervisorNome, data, valor];
  });

  doc.autoTable({
    startY: 38,
    head: head,
    body: body,
    theme: "striped",
    headStyles: { fillColor: [41, 128, 186] },
  });

  const nomeArquivo = `Relatorio_Supervisao_${mesSelecionadoTexto.replace(
    /\s/g,
    "_"
  )}.pdf`;
  doc.save(nomeArquivo);
}
