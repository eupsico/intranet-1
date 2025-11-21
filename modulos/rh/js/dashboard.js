// Arquivo: /modulos/rh/js/dashboard.js
// Versão: 3.7.0 (CORREÇÃO DE ESTRUTURA: Alinhamento com testesrespondidos e nomes de campos)

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "../../../assets/js/firebase-init.js";

export async function initdashboard(user, userData) {
  console.log("📈 Iniciando Dashboard de RH...");

  const db = window.db;

  if (!db) {
    console.error(
      "Firebase Firestore não inicializado. Não é possível carregar os dados."
    );
    document.getElementById("content-area").innerHTML =
      "<h2>Erro</h2><p>Falha ao conectar com o banco de dados.</p>";
    return;
  }

  // ============================================
  // DEFINIÇÃO DAS COLEÇÕES
  // ============================================

  const usuariosCollection = collection(db, "usuarios");
  const vagasCollection = collection(db, "vagas");
  const onboardingCollection = collection(db, "onboarding");
  const comunicadosCollection = collection(db, "comunicados");
  const desligamentosCollection = collection(db, "desligamentos");
  const candidatosCollection = collection(db, "candidaturas");
  const tokensAcessoCollection = collection(db, "tokensacesso"); // Ajustado para "tokensacesso"
  const estudosDeCasoCollection = collection(db, "estudos_de_caso");

  // ✅ CORREÇÃO: Coleção correta para testes respondidos
  const testesRespondidosCollection = collection(db, "testesrespondidos");

  // ============================================
  // MAPEAMENTO DOS ELEMENTOS DO DOM - DASHBOARD
  // ============================================

  const metricAtivos = document.getElementById("rh-metric-ativos");
  const metricVagas = document.getElementById("rh-metric-vagas");
  const metricOnboarding = document.getElementById("rh-metric-onboarding");
  const metricComunicados = document.getElementById("rh-metric-comunicados");
  const funcoesChartCtx = document
    .getElementById("rh-funcoes-chart")
    ?.getContext("2d");
  const rhProfissaoChartCtx = document
    .getElementById("rh-profissao-chart")
    ?.getContext("2d");
  const desligamentoChartCtx = document
    .getElementById("rh-desligamento-chart")
    ?.getContext("2d");

  // ============================================
  // MAPEAMENTO DOS ELEMENTOS DO DOM - RELATÓRIOS
  // ============================================

  const relTotalInscricoes = document.getElementById("rel-total-inscricoes");
  const relTestesRespondidos = document.getElementById(
    "rel-testes-respondidos"
  );
  const relTestesPendentes = document.getElementById("rel-testes-pendentes");
  const relTaxaResposta = document.getElementById("rel-taxa-resposta");
  const relFiltroVaga = document.getElementById("rel-filtro-vaga");
  const relFiltroStatus = document.getElementById("rel-filtro-status");
  const relBuscaCandidato = document.getElementById("rel-busca-candidato");
  const relFiltroTeste = document.getElementById("rel-filtro-teste");
  const btnAtualizarRelatorios = document.getElementById(
    "btn-atualizar-relatorios"
  );

  // ============================================
  // ESTADO GLOBAL DOS RELATÓRIOS
  // ============================================

  let candidatosCache = [];
  let tokensCache = [];
  let vagasCache = [];
  let estudosCache = [];
  let respostasCache = []; // ✅ Cache unificado para testes respondidos (testesrespondidos)

  // ... (Funções de Exportação omitidas)

  // ============================================
  // LISTENERS DE ABAS - ✅ CARREGAMENTO AUTOMÁTICO
  // ============================================

  const relDashboardTabs = document.getElementById("rh-dashboard-tabs");
  const relRelatóriosTabs = document.getElementById("rel-relatorios-tabs");

  if (relDashboardTabs) {
    relDashboardTabs.querySelectorAll(".tab-link").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const tabName = e.target.getAttribute("data-tab");

        relDashboardTabs
          .querySelectorAll(".tab-link")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll('[id^="tab-"]')
          .forEach((t) => (t.style.display = "none"));

        e.target.classList.add("active");
        document.getElementById(`tab-${tabName}`).style.display = "block";

        if (tabName === "relatorios") {
          console.log("🔹 Aba de Relatórios aberta - Carregando dados...");
          carregarRelatorios();
        }
      });
    });
  }

  if (relRelatóriosTabs) {
    relRelatóriosTabs.querySelectorAll(".tab-link").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const tabName = e.target.getAttribute("data-rel-tab");

        relRelatóriosTabs
          .querySelectorAll(".tab-link")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll(".tab-content-rel")
          .forEach((t) => (t.style.display = "none"));

        e.target.classList.add("active");
        document.getElementById(`rel-tab-${tabName}`).style.display = "block";
      });
    });
  }

  if (btnAtualizarRelatorios) {
    btnAtualizarRelatorios.addEventListener("click", carregarRelatorios);
  }

  if (relBuscaCandidato) {
    relBuscaCandidato.addEventListener("input", filtrarCandidatos);
  }

  // ============================================
  // FUNÇÃO: Carregar Relatórios
  // ============================================

  async function carregarRelatorios() {
    console.log("🔹 Carregando relatórios de recrutamento...");

    try {
      console.log("📊 Buscando dados do Firestore...");

      if (!db) {
        console.error("❌ ERRO: db não está definido!");
        throw new Error("Firestore não foi inicializado");
      }

      const candidatosRef = collection(db, "candidaturas");
      const tokensRef = collection(db, "tokensacesso");
      const vagasRef = collection(db, "vagas");
      const estudosRef = collection(db, "estudos_de_caso");

      // ✅ CORREÇÃO: Usar a coleção correta
      const testesRespondidosRef = collection(db, "testesrespondidos");

      const [
        candidatosSnap,
        tokensSnap,
        vagasSnap,
        estudosSnap,
        testesRespondidosSnap, // ✅ NOVO: Buscar testesRespondidos
      ] = await Promise.all([
        getDocs(candidatosRef),
        getDocs(tokensRef),
        getDocs(vagasRef),
        getDocs(estudosRef),
        getDocs(testesRespondidosCollection), // ✅ Chamada correta para testesrespondidos
      ]);

      candidatosCache = [];
      candidatosSnap.docs.forEach((doc) => {
        const data = doc.data();
        candidatosCache.push({
          id: doc.id,
          ...data,
        });
      });

      tokensCache = tokensSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      vagasCache = vagasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      estudosCache = estudosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ✅ CORREÇÃO: Cache de respostas simples da coleção testesrespondidos
      respostasCache = testesRespondidosSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      console.log(`📊 ✅ Candidatos total: ${candidatosCache.length}`);
      console.log(`📊 ✅ Tokens (enviados): ${tokensCache.length}`);
      console.log(
        `📊 ✅ Respostas (testesrespondidos): ${respostasCache.length}`
      );
      console.log(`📊 ✅ Vagas: ${vagasCache.length}`);
      console.log(`📊 ✅ Estudos: ${estudosCache.length}`);

      // ✅ CORRIGIDO: Usar respostasCache para contar respondidos
      const totalInscritos = candidatosCache.length;
      const testesRespondidos = respostasCache.length;
      const testesPendentes = tokensCache.filter((t) => {
        // Um teste é pendente se há um token, mas NENHUMA resposta na coleção testesrespondidos
        return !respostasCache.some((r) => r.tokenId === t.id);
      }).length;
      const taxaResposta =
        totalInscritos > 0
          ? Math.round((testesRespondidos / totalInscritos) * 100)
          : 0;

      if (relTotalInscricoes) relTotalInscricoes.textContent = totalInscritos;
      if (relTestesRespondidos)
        relTestesRespondidos.textContent = testesRespondidos;
      if (relTestesPendentes) relTestesPendentes.textContent = testesPendentes;
      if (relTaxaResposta) relTaxaResposta.textContent = `${taxaResposta}%`;

      // ✅ Salvar respostasCache globalmente
      window.respostasCache = respostasCache;

      popularFiltros();
      renderizarInscricoesPorVaga();
      renderizarListaCandidatos();
      renderizarRespostasAosTestes();

      console.log("✅ Relatórios carregados com sucesso");
    } catch (error) {
      console.error("❌ Erro ao carregar relatórios:", error);
      window.showToast?.(
        "Erro ao carregar relatórios: " + error.message,
        "error"
      );
    }
  }

  // ============================================
  // FUNÇÃO: Renderizar Lista de Candidatos (CORRIGIDA)
  // ============================================

  async function renderizarListaCandidatos() {
    console.log("🔹 Renderizando lista de candidatos...");
    const tabelaBody = document.getElementById("rel-tbody-candidatos");
    if (!tabelaBody) return;

    tabelaBody.innerHTML = "";

    const filtroVaga = relFiltroVaga?.value;
    const filtroStatus = relFiltroStatus?.value;
    const buscaNome = relBuscaCandidato?.value.toLowerCase() || "";

    const respostasCache = window.respostasCache || [];

    let candidatosFiltrados = candidatosCache;

    if (filtroVaga) {
      candidatosFiltrados = candidatosFiltrados.filter(
        (c) => c.vaga_id === filtroVaga
      );
    }

    if (filtroStatus) {
      candidatosFiltrados = candidatosFiltrados.filter(
        (c) => c.status_recrutamento === filtroStatus
      );
    }

    if (buscaNome) {
      candidatosFiltrados = candidatosFiltrados.filter(
        (c) =>
          (c.nome_completo || c.nome_candidato || "")
            .toLowerCase()
            .includes(buscaNome) // ✅ CORRIGIDO: Busca em nome_completo e nome_candidato
      );
    }

    candidatosFiltrados.forEach((candidato) => {
      const vaga = vagasCache.find((v) => v.id === candidato.vaga_id);

      // ✅ CORRIGIDO: Priorizar titulo_vaga_original do candidato
      const vagaNome =
        candidato.titulo_vaga_original ||
        vaga?.titulo ||
        vaga?.tituloVaga ||
        "-";

      // ✅ CORRIGIDO: Priorizar nome_completo ou nome_candidato
      const nomeCandidato =
        candidato.nome_completo || candidato.nome_candidato || "-";

      // ✅ CORRIGIDO: Status do Teste
      const testeEnviado = tokensCache.some(
        (t) => t.candidatoId === candidato.id
      );

      const testeRespondido = respostasCache.some(
        (r) => r.candidatoId === candidato.id
      );

      let statusTeste = "Não enviado";
      if (testeRespondido) {
        statusTeste = "Respondido";
      } else if (testeEnviado) {
        statusTeste = "Enviado";
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
   <td><strong>${nomeCandidato}</strong></td>
   <td>${candidato.email_candidato || "-"}</td>
   <td>${candidato.telefone_contato || "-"}</td>
   <td>${vagaNome}</td>
   <td><span class="badge bg-info">${
     candidato.status_recrutamento || "-"
   }</span></td>
   <td><span class="badge ${
     statusTeste === "Respondido"
       ? "bg-success"
       : statusTeste === "Enviado"
       ? "bg-warning"
       : "bg-secondary"
   }">${statusTeste}</span></td>
  `;
      tabelaBody.appendChild(tr);
    });

    if (candidatosFiltrados.length === 0) {
      tabelaBody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">Nenhum candidato encontrado</td></tr>';
    }
  }

  // Função auxiliar para atualizar e filtrar
  function atualizarTabelaCandidatos(candidatos, tabelaBody) {
    console.log(`🔹 Atualizando tabela com ${candidatos.length} candidatos`);

    tabelaBody.innerHTML = "";

    if (candidatos.length === 0) {
      tabelaBody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">Nenhum candidato encontrado</td></tr>';
      return;
    }

    candidatos.forEach((cand) => {
      // ✅ CORRIGIDO: Busca melhorada da vaga
      const vaga = vagasCache.find((v) => v.id === cand.vaga_id);
      const vagaNome =
        cand.titulo_vaga_original || // ✅ Prioridade
        vaga?.titulo ||
        vaga?.tituloVaga ||
        "Sem vaga";

      const nomeCandidato = cand.nome_completo || cand.nome_candidato || "-";

      console.log(
        `📋 Candidato: ${nomeCandidato}, Vaga ID: ${cand.vaga_id}, Vaga Nome: ${vagaNome}`
      );

      const testeEnviado = tokensCache.some((t) => t.candidatoId === cand.id);
      const testeRespondido = window.respostasCache.some(
        // ✅ Usar window.respostasCache
        (r) => r.candidatoId === cand.id
      );

      let statusTeste = '<span class="badge bg-secondary">Não enviado</span>';
      if (testeEnviado && testeRespondido) {
        statusTeste = '<span class="badge bg-success">✅ Respondido</span>';
      } else if (testeEnviado) {
        statusTeste =
          '<span class="badge bg-warning text-dark">⏳ Enviado</span>';
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
   <td><strong>${nomeCandidato}</strong></td>
   <td>${cand.email_candidato || "-"}</td>
   <td>${cand.telefone_contato || "-"}</td>
   <td><strong>${vagaNome}</strong></td>
   <td><span class="badge bg-info">${
     cand.status_recrutamento || "Pendente"
   }</span></td>
   <td>${statusTeste}</td>
  `;
      tabelaBody.appendChild(tr);
    });
  }

  function filtrarCandidatos(e) {
    const termo = e.target.value.toLowerCase();
    const candidatosFiltrados = candidatosCache.filter(
      (c) =>
        (c.nome_completo || c.nome_candidato || "")
          .toLowerCase()
          .includes(termo) // ✅ CORRIGIDO: Busca em nome_completo e nome_candidato
    );

    const tabelaBody = document.getElementById("rel-tbody-candidatos");
    atualizarTabelaCandidatos(candidatosFiltrados, tabelaBody);
  }

  // ============================================
  // FUNÇÕES DE EXPORTAÇÃO - EXCEL (CSV com BOM UTF-8)
  // ============================================

  function exportarParaExcel(dados, nomeArquivo = "relatorio.csv") {
    console.log("📊 Exportando para Excel (CSV UTF-8 com BOM)...", dados);

    if (!dados || dados.length === 0) {
      window.showToast?.("Nenhum dado para exportar", "warning");
      return;
    }

    try {
      let csv = [];
      const headers = Object.keys(dados[0]);

      // ✅ Adiciona BOM (Byte Order Mark) para UTF-8
      // Isso faz o Excel reconhecer corretamente os acentos
      const headerRow = headers
        .map((h) => {
          let header = String(h).replace(/"/g, '""');
          return `"${header}"`;
        })
        .join(",");

      csv.push(headerRow);

      // ✅ Processa cada linha de dados
      dados.forEach((linha) => {
        const row = headers
          .map((h) => {
            let valor = linha[h] || "";

            // Converte valores especiais
            if (valor === null || valor === undefined) {
              valor = "";
            } else if (typeof valor === "object") {
              valor = JSON.stringify(valor);
            } else {
              valor = String(valor);
            }

            // Escapa aspas duplas
            valor = valor.replace(/"/g, '""');

            return `"${valor}"`;
          })
          .join(",");

        csv.push(row);
      });

      const csvContent = csv.join("\n");

      // ✅ BOM UTF-8 (\uFEFF) faz Excel reconhecer acentos corretamente
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      // ✅ Download do arquivo
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);

      // ✅ Muda extensão para .csv
      const nomeComExtenso = nomeArquivo.includes(".")
        ? nomeArquivo
        : nomeArquivo + ".csv";

      link.setAttribute("download", nomeComExtenso);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Libera memória
      URL.revokeObjectURL(url);

      console.log("✅ CSV gerado com sucesso!");
      window.showToast?.(`✅ Arquivo ${nomeComExtenso} baixado!`, "success");
    } catch (error) {
      console.error("❌ Erro ao gerar CSV:", error);
      window.showToast?.("❌ Erro ao exportar arquivo", "error");
    }
  }

  // ============================================
  // FUNÇÕES DE EXPORTAÇÃO - PDF (JSPDF + autoTable)
  // ============================================

  function exportarParaPDF(elementId, nomeArquivo = "relatorio.pdf") {
    console.log("📄 Exportando para PDF...", elementId);

    const element = document.getElementById(elementId);
    if (!element) {
      console.error("❌ Elemento não encontrado:", elementId);
      window.showToast?.("❌ Elemento não encontrado para exportar", "error");
      return;
    }

    const tabela = element.querySelector("table");
    if (!tabela) {
      window.showToast?.(
        "⚠️ Nenhuma tabela encontrada para exportar",
        "warning"
      );
      return;
    }

    const linhas = tabela.querySelectorAll("tbody tr");
    if (linhas.length === 0) {
      window.showToast?.("⚠️ Nenhum dado para exportar", "warning");
      return;
    }

    if (typeof jspdf === "undefined" || typeof jspdf.jsPDF === "undefined") {
      console.log("⚠️ Carregando jsPDF e autoTable...");

      const scriptJsPDF = document.createElement("script");
      scriptJsPDF.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

      const scriptAutoTable = document.createElement("script");
      scriptAutoTable.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js";

      scriptJsPDF.onload = () => {
        scriptAutoTable.onload = () => {
          setTimeout(() => {
            gerarPDFComJsPDF(tabela, nomeArquivo);
          }, 500);
        };
        scriptAutoTable.onerror = () => {
          console.error("❌ Erro ao carregar autoTable");
          window.showToast?.("Erro ao carregar biblioteca PDF", "error");
        };
        document.head.appendChild(scriptAutoTable);
      };

      scriptJsPDF.onerror = () => {
        console.error("❌ Erro ao carregar jsPDF");
        window.showToast?.("Erro ao carregar biblioteca PDF", "error");
      };

      document.head.appendChild(scriptJsPDF);
    } else {
      gerarPDFComJsPDF(tabela, nomeArquivo);
    }
  }

  function gerarPDFComJsPDF(tabela, nomeArquivo) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // ✅ CABEÇALHO
      doc.setFontSize(18);
      doc.setTextColor(102, 126, 234);
      doc.text("EuPsico", 148, 15, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      doc.text("Grupo de atendimento multidisciplinar", 148, 22, {
        align: "center",
      });

      doc.setFontSize(14);
      doc.setTextColor(51, 51, 51);
      const tituloRelatorio = nomeArquivo
        .replace(".pdf", "")
        .replace(/_/g, " ")
        .toUpperCase();
      doc.text(tituloRelatorio, 148, 32, { align: "center" });

      doc.setFontSize(9);
      doc.setTextColor(153, 153, 153);
      const dataHora = `Data: ${new Date().toLocaleDateString(
        "pt-BR"
      )} | Hora: ${new Date().toLocaleTimeString("pt-BR")}`;
      doc.text(dataHora, 148, 38, { align: "center" });

      // Linha separadora
      doc.setDrawColor(102, 126, 234);
      doc.setLineWidth(0.5);
      doc.line(14, 42, 283, 42);

      // ✅ EXTRAI DADOS DA TABELA
      const cabecalhos = [];
      const linhas = [];

      tabela.querySelectorAll("thead th").forEach((th) => {
        cabecalhos.push(th.textContent.trim());
      });

      tabela.querySelectorAll("tbody tr").forEach((tr) => {
        const linha = [];
        tr.querySelectorAll("td").forEach((td) => {
          const texto = td.textContent.trim();
          linha.push(texto);
        });
        if (linha.length > 0) {
          linhas.push(linha);
        }
      });

      console.log("📊 Cabeçalhos:", cabecalhos);
      console.log("📊 Linhas:", linhas.length);

      // ✅ CRIA A TABELA COM AUTOTABLE
      doc.autoTable({
        head: [cabecalhos],
        body: linhas,
        startY: 48,
        theme: "striped",
        headStyles: {
          fillColor: [102, 126, 234],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
        },
        alternateRowStyles: {
          fillColor: [249, 249, 249],
        },
        margin: { top: 48, left: 14, right: 14, bottom: 35 },
        styles: {
          overflow: "linebreak",
          cellWidth: "wrap",
        },
        columnStyles: {
          0: { cellWidth: "auto" },
        },
      });

      // ✅ RODAPÉ COM ENDEREÇO, WHATSAPP E CONTATO
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // Linha separadora
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(14, 182, 283, 182);

        // ✅ Informações de contato
        const endereco =
          "Avenida Inocêncio Seráfico, 141 - Centro de Carapicuíba - SP, 06320-290";
        const whatsapp = "WhatsApp: 11 99794-9071";

        doc.text(endereco, 148, 187, { align: "center", maxWidth: 260 });
        doc.text(whatsapp, 148, 191, { align: "center" });

        // Página e copyright
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 148, 195, { align: "center" });
        doc.text(
          "Relatório gerado automaticamente pelo sistema EuPsico © 2025",
          148,
          198,
          { align: "center" }
        );
      }

      // ✅ SALVA O PDF
      doc.save(nomeArquivo);
      console.log("✅ PDF gerado com sucesso!");
      window.showToast?.(`✅ Arquivo ${nomeArquivo} baixado!`, "success");
    } catch (error) {
      console.error("❌ Erro ao gerar PDF:", error);
      window.showToast?.("❌ Erro ao exportar arquivo", "error");
    }
  }

  // ============================================
  // FUNÇÕES DE EXPORTAÇÃO INDIVIDUAIS - EXCEL
  // ============================================

  window.exportarInscricoesExcel = function () {
    console.log("📊 Exportando Inscrições por Vaga...");

    const tabelaBody = document.getElementById("rel-tbody-inscricoes");
    if (!tabelaBody) {
      window.showToast?.("Tabela não encontrada", "error");
      return;
    }

    const dados = [];

    tabelaBody.querySelectorAll("tr").forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      if (cells.length > 0) {
        dados.push({
          Vaga: cells[0].textContent.trim(),
          "Total de Inscritos": parseInt(cells[1].textContent.trim()) || 0,
          "Em Triagem": parseInt(cells[2].textContent.trim()) || 0,
          Aprovados: parseInt(cells[3].textContent.trim()) || 0,
          Rejeitados: parseInt(cells[4].textContent.trim()) || 0,
          Contratados: parseInt(cells[5].textContent.trim()) || 0,
          "Data do Relatório": new Date().toLocaleDateString("pt-BR"),
        });
      }
    });

    if (dados.length === 0) {
      window.showToast?.("Nenhum dado para exportar", "warning");
      return;
    }

    exportarParaExcel(dados, "inscricoes_por_vaga.csv");
  };

  window.exportarInscricoesPDF = function () {
    exportarParaPDF("rel-tabela-inscricoes", "inscricoes_por_vaga.pdf");
  };

  window.exportarCandidatosExcel = function () {
    console.log("📊 Exportando Lista de Candidatos com todos os dados...");

    const dados = [];

    candidatosCache.forEach((candidato) => {
      const vaga = vagasCache.find((v) => v.id === candidato.vaga_id);
      const vagaNome =
        candidato.titulo_vaga_original ||
        vaga?.titulo ||
        vaga?.tituloVaga ||
        "-";

      const testeEnviado = tokensCache.some(
        (t) => t.candidatoId === candidato.id
      );
      const testeRespondido = respostasCache.some(
        (r) => r.candidatoId === candidato.id
      );

      let statusTeste = "Não enviado";
      if (testeRespondido) {
        statusTeste = "Respondido";
      } else if (testeEnviado) {
        statusTeste = "Enviado";
      }

      dados.push({
        "Nome Completo":
          candidato.nome_completo || candidato.nome_candidato || "-", // ✅ CORRIGIDO: nome_completo ou nome_candidato
        Email: candidato.email_candidato || "-",
        Telefone: candidato.telefone_contato || "-",
        WhatsApp: candidato.telefone_contato || "-",
        CPF: candidato.cpf || "-",
        Cidade: candidato.cidade || "-",
        Estado: candidato.estado || "-",
        CEP: candidato.cep || "-",
        Endereço: candidato.endereco || "-",
        "Data de Nascimento": candidato.data_nascimento || "-",
        Gênero: candidato.genero || "-",
        Nacionalidade: candidato.nacionalidade || "-",
        Vaga: vagaNome, // ✅ CORRIGIDO: Usando nome da vaga resolvido
        "Formação Profissional": candidato.formacao_profissional || "-",
        "Conselho Profissional": candidato.conselho_profissional || "-",
        "Número do Conselho": candidato.numero_conselho || "-",
        Profissão: candidato.profissao || "-",
        "Anos de Experiência": candidato.anos_experiencia || "-",
        "Experiência Profissional": candidato.resumo_experiencia || "-",
        Habilidades: candidato.habilidades_competencias || "-",
        "Expectativa Salarial": candidato.expectativa_salarial || "-",
        "Como Conheceu a EuPsico": candidato.como_conheceu || "-",
        Disponibilidade: candidato.disponibilidade || "-",
        "Pode Trabalhar Finais de Semana":
          candidato.trabalha_finais_semana === true ? "Sim" : "Não",
        "Pode Trabalhar Feriados":
          candidato.trabalha_feriados === true ? "Sim" : "Não",
        "Status do Recrutamento": candidato.status_recrutamento || "-",
        "Status do Teste": statusTeste,
        "Data da Candidatura": candidato.data_candidatura
          ? new Date(
              candidato.data_candidatura.toDate?.() ||
                candidato.data_candidatura
            ).toLocaleDateString("pt-BR")
          : "-",
        "Link do Currículo": candidato.link_curriculo_drive || "-",
        "Link do Portfolio": candidato.link_portfolio || "-",
        LinkedIn: candidato.linkedin || "-",
        Observações: candidato.observacoes || "-",
        "Fonte da Inscrição": candidato.fonte_inscricao || "-",
      });
    });

    if (dados.length === 0) {
      window.showToast?.("⚠️ Nenhum candidato para exportar", "warning");
      return;
    }

    exportarParaExcel(dados, "candidatos_completo.csv");
  };

  window.exportarCandidatosPDF = function () {
    exportarParaPDF("rel-tabela-candidatos", "candidatos.pdf");
  };

  window.exportarRespostasExcel = function () {
    console.log("📊 Exportando Respostas aos Testes...");

    const tabelaBody = document.getElementById("rel-tbody-respostas");
    if (!tabelaBody) {
      window.showToast?.("Tabela não encontrada", "error");
      return;
    }

    const dados = [];

    tabelaBody.querySelectorAll("tr").forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      if (cells.length >= 5) {
        dados.push({
          Candidato: cells[0].textContent.trim(),
          Teste: cells[1].textContent.trim(),
          "Data de Resposta": cells[2].textContent.trim(),
          "Tempo Gasto": cells[3].textContent.trim(),
          Status: cells[4].textContent.trim(),
        });
      }
    });

    if (dados.length === 0) {
      window.showToast?.("Nenhum dado para exportar", "warning");
      return;
    }

    exportarParaExcel(dados, "respostas_testes.csv");
  };

  window.exportarRespostasPDF = function () {
    exportarParaPDF("rel-tabela-respostas", "respostas_testes.pdf");
  };

  async function renderizarRespostasAosTestes() {
    console.log("🔹 Renderizando respostas aos testes...");
    const tabelaBody = document.getElementById("rel-tbody-respostas");
    if (!tabelaBody) return;

    tabelaBody.innerHTML = "";

    const respostasCache = window.respostasCache || [];

    if (respostasCache.length === 0) {
      tabelaBody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">Nenhuma resposta encontrada</td></tr>';
      return;
    }

    respostasCache.forEach((resposta) => {
      // Buscar informações do candidato
      const candidato = candidatosCache.find(
        (c) => c.id === resposta.candidatoId
      ); // Buscar informações do teste (do token original)

      const tokenOriginal = tokensCache.find((t) => t.id === resposta.tokenId);
      let teste = null;
      if (tokenOriginal) {
        teste = estudosCache.find((t) => t.id === tokenOriginal.testeId);
      }

      const candidatoNome =
        candidato?.nome_completo || candidato?.nome_candidato || "-"; // ✅ CORRIGIDO: Nome do profissional/candidato
      const testeNome =
        teste?.titulo || teste?.nome || resposta.nomeTeste || "-"; // ✅ CORRIGIDO: Formatação robusta de dataResposta

      const dataResposta = resposta.dataResposta
        ? new Date(
            resposta.dataResposta.toDate?.() ||
              resposta.dataResposta.seconds * 1000 // Suporta Timestamp do Firestore
          ).toLocaleDateString("pt-BR", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const tempoSegundos = resposta.tempoGasto || 0;
      const tempoMinutos = Math.floor(tempoSegundos / 60);
      const tempoFormatado =
        tempoMinutos > 0
          ? `${tempoMinutos}min ${tempoSegundos % 60}s`
          : `${tempoSegundos}s`; // ✅ USAR AVALIAÇÃO DO CANDIDATO

      let notaHTML =
        '<span class="badge bg-secondary">Aguardando Avaliação</span>';

      if (candidato?.avaliacaoTeste?.resultado) {
        const resultadoRH = candidato.avaliacaoTeste.resultado;
        if (resultadoRH === "Aprovado") {
          notaHTML = '<span class="badge bg-success">Avaliado: Aprovado</span>';
        } else if (resultadoRH === "Reprovado") {
          notaHTML = '<span class="badge bg-danger">Avaliado: Reprovado</span>';
        }
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td><strong>${candidatoNome}</strong></td>
      <td>${testeNome}</td>
      <td>${dataResposta}</td>
      <td class="text-center"><span class="badge bg-info">${tempoFormatado}</span></td>
      <td class="text-center">${notaHTML}</td>
      <td><span class="badge bg-success">✅ Respondido</span></td>
      <td class="text-center">
        <button 
          class="btn btn-sm btn-primary" 
          title="Ver Respostas" 
          onclick="window.location.hash='#rh/detalhes_teste?token=${resposta.tokenId}&candidato=${resposta.candidatoId}'"
        >
          <i class="fas fa-eye me-1"></i> Ver Respostas
        </button>
      </td>
    `;
      tabelaBody.appendChild(tr);
    });
  } // ============================================ // FUNÇÃO ORIGINAL: Busca de dados do Dashboard // ============================================

  async function fetchRHDashboardData() {
    const ativosQuery = query(
      usuariosCollection,
      where("inativo", "==", false)
    );

    const vagasQuery = query(
      vagasCollection,
      where("status", "in", ["aguardando-aprovacao", "em-divulgacao"])
    );

    const onboardingQuery = query(
      onboardingCollection,
      where("faseAtual", "in", [
        "pendente-docs",
        "em-integracao",
        "acompanhamento",
      ])
    );

    const comunicadosQuery = query(comunicadosCollection);
    const todosUsuariosQuery = query(
      usuariosCollection,
      where("inativo", "==", false)
    );

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const desligamentosQuery = query(
      desligamentosCollection,
      where("dataEfetiva", ">=", oneYearAgo)
    );

    const [
      ativosSnap,
      vagasSnap,
      onboardingSnap,
      comunicadosSnap,
      todosUsuariosSnap,
      desligamentosSnap,
    ] = await Promise.all([
      getDocs(ativosQuery),
      getDocs(vagasQuery),
      getDocs(onboardingQuery),
      getDocs(comunicadosQuery),
      getDocs(todosUsuariosQuery),
      getDocs(desligamentosQuery),
    ]);

    const funcoesMap = {};
    const profissaoMap = {};

    todosUsuariosSnap.forEach((doc) => {
      const user = doc.data();
      const funcoes = user.funcoes || [];
      const profissao = user.profissao || "Não Informado";

      funcoes.forEach((role) => {
        const displayRole =
          {
            psicologo_voluntario: "Psicólogo Voluntário",
            psicologo_plantonista: "Psicólogo Plantonista",
            supervisor: "Supervisor",
            admin: "Admin",
            rh: "RH",
            gestor: "Gestor",
          }[role] ||
          role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");

        funcoesMap[displayRole] = (funcoesMap[displayRole] || 0) + 1;
      });

      const displayProfissao =
        profissao.charAt(0).toUpperCase() + profissao.slice(1);
      profissaoMap[displayProfissao] =
        (profissaoMap[displayProfissao] || 0) + 1;
    });

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    const monthlyDataMap = {};
    const labels = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const yearMonthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
      monthlyDataMap[yearMonthKey] = 0;
      labels.push(
        `${monthNames[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`
      );
    }

    desligamentosSnap.forEach((doc) => {
      const desligamento = doc.data();
      let effectiveDate;

      if (
        desligamento.dataEfetiva &&
        typeof desligamento.dataEfetiva.toDate === "function"
      ) {
        effectiveDate = desligamento.dataEfetiva.toDate();
      } else if (desligamento.dataEfetiva instanceof Date) {
        effectiveDate = desligamento.dataEfetiva;
      } else {
        return;
      }

      const yearMonthKey = `${effectiveDate.getFullYear()}-${
        effectiveDate.getMonth() + 1
      }`;

      if (monthlyDataMap.hasOwnProperty(yearMonthKey)) {
        monthlyDataMap[yearMonthKey]++;
      }
    });

    const desligamentoData = labels.map((label) => {
      const [monthName, yearShort] = label.split("/");
      const monthIndex = monthNames.findIndex((name) => name === monthName);
      const year = parseInt(
        yearShort.length === 2 ? `20${yearShort}` : yearShort
      );
      const yearMonthKey = `${year}-${monthIndex + 1}`;
      return monthlyDataMap[yearMonthKey] || 0;
    });

    return {
      ativos: ativosSnap.size,
      vagas: vagasSnap.size,
      onboarding: onboardingSnap.size,
      comunicados: comunicadosSnap.size,

      funcoesData: {
        labels: funcoesLabels,
        data: funcoesData,
      },
      profissaoData: {
        labels: profissaoLabels,
        data: profissaoData,
      },
      desligamentoData: {
        labels: labels,
        data: desligamentoData,
      },
    };
  } // ============================================ // FUNÇÃO: Visualizar Respostas do Teste (COM CARREGAMENTO DINÂMICO DE SWEETALERT2) // ============================================

  window.abrirModalVerRespostas = async function (tokenId, candidatoNome) {
    console.log(`🔹 Abrindo respostas do teste: ${tokenId}`); // ✅ VERIFICA SE SWEETALERT2 ESTÁ CARREGADO

    if (typeof Swal === "undefined") {
      console.log("⚠️ Carregando SweetAlert2...");

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
      script.onload = () => {
        console.log("✅ SweetAlert2 carregado"); // Tenta novamente após carregar
        abrirModalVerRespostasInterno(tokenId, candidatoNome);
      };
      script.onerror = () => {
        console.error("❌ Erro ao carregar SweetAlert2");
        if (window.showToast) {
          window.showToast("Erro ao carregar componente de modal", "error");
        } else {
          alert("Erro ao carregar componente de modal");
        }
      };
      document.head.appendChild(script);
      return;
    } // Se já está carregado, executa direto

    abrirModalVerRespostasInterno(tokenId, candidatoNome);
  }; // ============================================ // FUNÇÃO: Visualizar Respostas do Teste COM CORREÇÃO (CORRIGIDO) // ============================================

  async function abrirModalVerRespostasInterno(tokenId, candidatoNome) {
    try {
      if (!db) {
        console.error("❌ ERRO: Firestore não inicializado!");
        window.showToast?.("Erro: Firestore não está pronto", "error");
        return;
      } // ✅ Busca o token

      const tokenDocRef = doc(db, "tokensacesso", tokenId);
      const tokenSnap = await getDoc(tokenDocRef);

      if (!tokenSnap.exists()) {
        window.showToast?.("Token não encontrado", "error");
        return;
      }

      const tokenData = tokenSnap.data();
      console.log("✅ Token encontrado:", tokenData);

      if (
        !tokenData.respostas ||
        Object.keys(tokenData.respostas).length === 0
      ) {
        window.showToast?.(
          "Nenhuma resposta encontrada para este teste",
          "warning"
        );
        return;
      } // ✅ Busca o teste

      const testeRef = doc(db, "estudos_de_caso", tokenData.testeId);
      const testeSnap = await getDoc(testeRef);
      const testeDados = testeSnap.exists() ? testeSnap.data() : {};

      console.log("✅ Teste carregado:", testeDados); // ✅ NOVA LÓGICA: Calcula acertos e erros

      let totalPerguntas = 0;
      let acertos = 0;
      let erros = 0; // ✅ Cria HTML do modal com correção

      let perguntasHTML = "";

      if (testeDados.perguntas && testeDados.perguntas.length > 0) {
        totalPerguntas = testeDados.perguntas.length;

        testeDados.perguntas.forEach((pergunta, index) => {
          // ✅ CORRIGIDO: Trata resposta do candidato
          let respostaCandidato = tokenData.respostas[`resposta-${index}`]; // Se for objeto, extrai o texto da resposta

          if (
            typeof respostaCandidato === "object" &&
            respostaCandidato !== null
          ) {
            respostaCandidato =
              respostaCandidato.texto ||
              respostaCandidato.resposta ||
              JSON.stringify(respostaCandidato);
          }

          respostaCandidato = respostaCandidato || "-"; // ✅ CORRIGIDO: Trata resposta correta

          let respostaCorreta =
            pergunta.respostaCorreta || pergunta.gabarito || null; // Se for objeto, extrai o texto

          if (typeof respostaCorreta === "object" && respostaCorreta !== null) {
            respostaCorreta =
              respostaCorreta.texto ||
              respostaCorreta.resposta ||
              JSON.stringify(respostaCorreta);
          }

          console.log(`📝 Pergunta ${index + 1}:`, {
            respostaCandidato,
            respostaCorreta,
            pergunta,
          }); // ✅ Verifica se há resposta correta definida

          let statusResposta = "";
          let corResposta = "#555"; // cinza padrão
          let iconeResposta = "";

          if (respostaCorreta) {
            // Normaliza strings para comparação (case-insensitive e remove espaços extras)
            const respostaCandidatoNorm = String(respostaCandidato)
              .trim()
              .toLowerCase();
            const respostaCorretaNorm = String(respostaCorreta)
              .trim()
              .toLowerCase();

            if (respostaCandidatoNorm === respostaCorretaNorm) {
              acertos++;
              statusResposta = "✅ CORRETO";
              corResposta = "#28a745"; // verde
              iconeResposta = "✅";
            } else {
              erros++;
              statusResposta = "❌ INCORRETO";
              corResposta = "#dc3545"; // vermelho
              iconeResposta = "❌";
            }
          } else {
            statusResposta = "ℹ️ Sem gabarito definido";
            corResposta = "#6c757d"; // cinza
            iconeResposta = "ℹ️";
          } // ✅ CORRIGIDO: Trata as opções

          let opcoesHTML = "";

          if (
            pergunta.opcoes &&
            Array.isArray(pergunta.opcoes) &&
            pergunta.opcoes.length > 0
          ) {
            const opcoesTexto = pergunta.opcoes.map((opcao) => {
              // Se for objeto, extrai o texto
              if (typeof opcao === "object" && opcao !== null) {
                return (
                  opcao.texto ||
                  opcao.resposta ||
                  opcao.label ||
                  JSON.stringify(opcao)
                );
              }
              return String(opcao);
            });

            opcoesHTML = `
          <div style="background: #f9f9f9; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 13px;">
            <strong>Opções:</strong>
            <ul style="margin: 5px 0; padding-left: 20px;">
              ${opcoesTexto.map((opcao) => `<li>${opcao}</li>`).join("")}
            </ul>
          </div>
          `;
          }

          perguntasHTML += `
        <div style="background: #f0f8ff; padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid ${corResposta}; text-align: left;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #333;">
            <strong>Pergunta ${index + 1}:</strong> ${pergunta.enunciado}
          </p>
          
          ${opcoesHTML}
          
          <div style="background: white; padding: 10px; border-radius: 4px; color: ${corResposta}; border: 2px solid ${corResposta}; margin-top: 8px;">
            <strong>${iconeResposta} Resposta do Candidato:</strong> ${respostaCandidato}
          </div>
          
          ${
            respostaCorreta
              ? `
          <div style="background: #e8f8f0; padding: 8px; border-radius: 4px; margin-top: 8px; color: #28a745; border: 1px solid #28a745;">
            <strong>✓ Resposta Correta:</strong> ${respostaCorreta}
          </div>
          <div style="text-align: right; margin-top: 5px; font-weight: bold; color: ${corResposta}; font-size: 14px;">
            ${statusResposta}
          </div>
          `
              : `
          <div style="text-align: right; margin-top: 5px; font-style: italic; color: #6c757d; font-size: 12px;">
            ${statusResposta}
          </div>
          `
          }
        </div>
      `;
        });
      } else {
        perguntasHTML =
          '<p style="color: #999; text-align: center;">Nenhuma pergunta encontrada.</p>';
      }

      const dataResposta = tokenData.respondidoEm
        ? new Date(
            tokenData.respondidoEm.toDate?.() || tokenData.respondidoEm
          ).toLocaleDateString("pt-BR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const tempoGasto = tokenData.tempoRespostaSegundos
        ? `${Math.floor(tokenData.tempoRespostaSegundos / 60)}min ${
            tokenData.tempoRespostaSegundos % 60
          }s`
        : "-"; // ✅ Calcula porcentagem de acerto

      const porcentagemAcerto =
        totalPerguntas > 0 ? ((acertos / totalPerguntas) * 100).toFixed(1) : 0; // ✅ Define cor do resultado baseado na porcentagem

      let corResultado = "#6c757d"; // cinza padrão
      if (porcentagemAcerto >= 70) {
        corResultado = "#28a745"; // verde (aprovado)
      } else if (porcentagemAcerto >= 50) {
        corResultado = "#ffc107"; // amarelo (médio)
      } else {
        corResultado = "#dc3545"; // vermelho (reprovado)
      } // ✅ Abre com SweetAlert2

      await Swal.fire({
        title: `<i class="fas fa-eye me-2"></i> Respostas do Teste`,
        html: `
      <div style="text-align: left; max-height: 500px; overflow-y: auto;">
        <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>📋 Candidato:</strong> ${candidatoNome}</p>
          <p style="margin: 5px 0;"><strong>📝 Teste:</strong> ${
          testeDados.titulo || "Teste"
        }</p>
          <p style="margin: 5px 0;"><strong>⏱️ Tempo gasto:</strong> ${tempoGasto}</p>
          <p style="margin: 5px 0;"><strong>📅 Data da resposta:</strong> ${dataResposta}</p>
        </div>
        
                <div style="background: ${corResultado}; color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
          <h4 style="margin: 0 0 10px 0; font-size: 18px;">📊 Resultado da Correção</h4>
          <div style="display: flex; justify-content: space-around; margin-top: 10px;">
            <div>
              <div style="font-size: 32px; font-weight: bold;">${acertos}</div>
              <div style="font-size: 14px;">✅ Acertos</div>
            </div>
            <div>
              <div style="font-size: 32px; font-weight: bold;">${erros}</div>
              <div style="font-size: 14px;">❌ Erros</div>
            </div>
            <div>
              <div style="font-size: 32px; font-weight: bold;">${porcentagemAcerto}%</div>
              <div style="font-size: 14px;">📈 Aproveitamento</div>
            </div>
          </div>
        </div>
        
        <hr style="margin: 20px 0;">
        
        <h6 style="color: #667eea; margin-bottom: 15px; text-align: left;"><strong>Respostas Fornecidas:</strong></h6>
        
        ${perguntasHTML}
      </div>
    `,
        width: "900px",
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-download me-1"></i> Exportar',
        cancelButtonText: "Fechar",
        confirmButtonColor: "#667eea",
        cancelButtonColor: "#6c757d",
      }).then((result) => {
        if (result.isConfirmed) {
          window.exportarRespostaIndividual?.(tokenId, candidatoNome);
        }
      });

      console.log("✅ Modal de respostas aberto com correção");
    } catch (error) {
      console.error("❌ Erro ao abrir respostas:", error);
      window.showToast?.(`Erro: ${error.message}`, "error");
    }
  } // ============================================ // FUNÇÃO: Exportar Resposta Individual (COM RESPOSTAS) // ============================================

  window.exportarRespostaIndividual = async function (
    tokenDocId,
    candidatoNome
  ) {
    console.log(`🔹 Exportando resposta individual: ${tokenDocId}`);

    try {
      if (!db) {
        console.error("❌ ERRO: Firestore não inicializado!");
        return;
      } // ✅ Busca o token

      const tokenDocRef = doc(db, "tokensacesso", tokenDocId);
      const tokenSnap = await getDoc(tokenDocRef);

      if (!tokenSnap.exists()) {
        window.showToast?.("Token não encontrado", "error");
        return;
      }

      const tokenData = tokenSnap.data();
      console.log("✅ Token encontrado:", tokenData); // ✅ Busca o teste

      const testeRef = doc(db, "estudos_de_caso", tokenData.testeId);
      const testeSnap = await getDoc(testeRef);
      const testeDados = testeSnap.exists() ? testeSnap.data() : {};

      console.log("✅ Teste encontrado:", testeDados); // ✅ Formata data e tempo

      const dataResposta = tokenData.respondidoEm
        ? new Date(
            tokenData.respondidoEm.toDate?.() || tokenData.respondidoEm
          ).toLocaleDateString("pt-BR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const tempoGasto = tokenData.tempoRespostaSegundos
        ? `${Math.floor(tokenData.tempoRespostaSegundos / 60)}min ${
            tokenData.tempoRespostaSegundos % 60
          }s`
        : "-"; // ✅ Cria linha única para Excel com TODAS as colunas

      const linhaExcel = {
        Candidato: candidatoNome,
        Teste: testeDados.titulo || "Teste",
        "Data da Resposta": dataResposta,
        "Tempo Gasto": tempoGasto,
        Status: "Respondido",
      }; // ✅ Adiciona cada RESPOSTA como coluna no Excel

      if (testeDados.perguntas && testeDados.perguntas.length > 0) {
        testeDados.perguntas.forEach((pergunta, index) => {
          const resposta = tokenData.respostas[`resposta-${index}`] || "-"; // Usa o enunciado do Firestore
          const enunciado =
            pergunta.enunciado || pergunta.texto || `P${index + 1}`;
          linhaExcel[`P${index + 1}: ${enunciado}`] = resposta;
        });
      }

      console.log("📊 Dados para exportação:", linhaExcel); // ✅ Pergunta qual formato exportar

      const { isConfirmed, isDenied } = await Swal.fire({
        title: "Exportar Respostas",
        text: "Escolha o formato para exportação:",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "📊 Excel (CSV)",
        denyButtonText: "📄 PDF",
        cancelButtonText: "Cancelar",
        showDenyButton: true,
      });

      if (isConfirmed) {
        console.log("📊 Exportando para Excel...");
        exportarParaExcel(
          [linhaExcel],
          `resposta_${candidatoNome.replace(/\s+/g, "_")}.csv`
        );
      } else if (isDenied) {
        console.log("📄 Exportando para PDF...");
        exportarRespostaPDFIndividual(
          candidatoNome,
          testeDados,
          tokenData,
          dataResposta,
          tempoGasto
        );
      }
    } catch (error) {
      console.error("❌ Erro ao exportar:", error);
      window.showToast?.(`Erro: ${error.message}`, "error");
    }
  };
  /**
   * ✅ Exporta uma resposta individual para PDF
   */

  function exportarRespostaPDFIndividual(
    candidatoNome,
    testeDados,
    tokenData,
    dataResposta,
    tempoGasto
  ) {
    console.log("📄 Exportando resposta individual para PDF...");

    if (typeof jspdf === "undefined" || typeof jspdf.jsPDF === "undefined") {
      console.log("⚠️ Carregando jsPDF...");

      const scriptJsPDF = document.createElement("script");
      scriptJsPDF.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

      const scriptAutoTable = document.createElement("script");
      scriptAutoTable.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js";

      scriptJsPDF.onload = () => {
        scriptAutoTable.onload = () => {
          setTimeout(() => {
            gerarPDFRespostasIndividualCorrigido(
              candidatoNome,
              testeDados,
              tokenData,
              dataResposta,
              tempoGasto
            );
          }, 500);
        };
        document.head.appendChild(scriptAutoTable);
      };

      document.head.appendChild(scriptJsPDF);
    } else {
      gerarPDFRespostasIndividualCorrigido(
        candidatoNome,
        testeDados,
        tokenData,
        dataResposta,
        tempoGasto
      );
    }
  }

  function gerarPDFRespostasIndividualCorrigido(
    candidatoNome,
    testeDados,
    tokenData,
    dataResposta,
    tempoGasto
  ) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let yPosition = 15; // ✅ CABEÇALHO

      doc.setFontSize(18);
      doc.setTextColor(102, 126, 234);
      doc.text("EuPsico", 105, yPosition, { align: "center" });
      yPosition += 8;

      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      doc.text("Grupo de atendimento multidisciplinar", 105, yPosition, {
        align: "center",
      });
      yPosition += 8;

      doc.setFontSize(12);
      doc.setTextColor(51, 51, 51);
      doc.text("RESPOSTAS DO TESTE", 105, yPosition, { align: "center" });
      yPosition += 10; // Linha separadora

      doc.setDrawColor(102, 126, 234);
      doc.setLineWidth(0.5);
      doc.line(14, yPosition - 2, 196, yPosition - 2);
      yPosition += 5; // ✅ INFORMAÇÕES DO CANDIDATO

      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);

      doc.text(`Candidato(a): ${candidatoNome}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Teste: ${testeDados.titulo || "Teste"}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Data da resposta: ${dataResposta}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Tempo gasto: ${tempoGasto}`, 14, yPosition);
      yPosition += 10; // ✅ PERGUNTAS E RESPOSTAS

      doc.setFontSize(11);
      doc.setTextColor(102, 126, 234);
      doc.text("Respostas Fornecidas:", 14, yPosition);
      yPosition += 8;

      doc.setFontSize(9);
      doc.setTextColor(51, 51, 51);

      if (testeDados.perguntas && testeDados.perguntas.length > 0) {
        testeDados.perguntas.forEach((pergunta, index) => {
          const resposta = tokenData.respostas[`resposta-${index}`] || "-"; // ✅ PERGUNTA

          doc.setFont(undefined, "bold");
          const perguntaText = `P${index + 1}: ${pergunta.enunciado}`;
          const perguntaWrapped = doc.splitTextToSize(perguntaText, 180);

          perguntaWrapped.forEach((line) => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 15;
            }
            doc.text(line, 14, yPosition);
            yPosition += 5;
          }); // ✅ RESPOSTA

          doc.setFont(undefined, "normal");
          doc.setFillColor(240, 240, 240);
          const respostaWrapped = doc.splitTextToSize(
            `Resposta: ${resposta}`,
            180
          );

          respostaWrapped.forEach((line) => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 15;
            }
            doc.text(line, 14, yPosition);
            yPosition += 5;
          });

          yPosition += 3;
        });
      } else {
        doc.text("Nenhuma resposta encontrada.", 14, yPosition);
      }

      yPosition += 5; // ✅ RODAPÉ

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150); // Linha separadora

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(14, 280, 196, 280);

        doc.text(
          "Avenida Inocêncio Seráfico, 141 - Centro de Carapicuíba - SP, 06320-290",
          105,
          285,
          { align: "center" }
        );
        doc.text("WhatsApp: 11 99794-9071", 105, 289, { align: "center" });
        doc.text(
          `Página ${i} de ${pageCount} | Relatório gerado automaticamente © 2025`,
          105,
          293,
          { align: "center" }
        );
      } // ✅ SALVA O PDF

      doc.save(`resposta_${candidatoNome.replace(/\s+/g, "_")}.pdf`);
      window.showToast?.("✅ PDF exportado com sucesso!", "success");

      console.log("✅ PDF gerado com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao gerar PDF:", error);
      window.showToast?.("❌ Erro ao exportar PDF", "error");
    }
  } // ============================================ // FUNÇÃO ORIGINAL: Busca de dados do Dashboard // ============================================

  async function fetchRHDashboardData() {
    const ativosQuery = query(
      usuariosCollection,
      where("inativo", "==", false)
    );

    const vagasQuery = query(
      vagasCollection,
      where("status", "in", ["aguardando-aprovacao", "em-divulgacao"])
    );

    const onboardingQuery = query(
      onboardingCollection,
      where("faseAtual", "in", [
        "pendente-docs",
        "em-integracao",
        "acompanhamento",
      ])
    );

    const comunicadosQuery = query(comunicadosCollection);
    const todosUsuariosQuery = query(
      usuariosCollection,
      where("inativo", "==", false)
    );

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const desligamentosQuery = query(
      desligamentosCollection,
      where("dataEfetiva", ">=", oneYearAgo)
    );

    const [
      ativosSnap,
      vagasSnap,
      onboardingSnap,
      comunicadosSnap,
      todosUsuariosSnap,
      desligamentosSnap,
    ] = await Promise.all([
      getDocs(ativosQuery),
      getDocs(vagasQuery),
      getDocs(onboardingQuery),
      getDocs(comunicadosQuery),
      getDocs(todosUsuariosQuery),
      getDocs(desligamentosQuery),
    ]);

    const funcoesMap = {};
    const profissaoMap = {};

    todosUsuariosSnap.forEach((doc) => {
      const user = doc.data();
      const funcoes = user.funcoes || [];
      const profissao = user.profissao || "Não Informado";

      funcoes.forEach((role) => {
        const displayRole =
          {
            psicologo_voluntario: "Psicólogo Voluntário",
            psicologo_plantonista: "Psicólogo Plantonista",
            supervisor: "Supervisor",
            admin: "Admin",
            rh: "RH",
            gestor: "Gestor",
          }[role] ||
          role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");

        funcoesMap[displayRole] = (funcoesMap[displayRole] || 0) + 1;
      });

      const displayProfissao =
        profissao.charAt(0).toUpperCase() + profissao.slice(1);
      profissaoMap[displayProfissao] =
        (profissaoMap[displayProfissao] || 0) + 1;
    });

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    const monthlyDataMap = {};
    const labels = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const yearMonthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
      monthlyDataMap[yearMonthKey] = 0;
      labels.push(
        `${monthNames[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`
      );
    }

    desligamentosSnap.forEach((doc) => {
      const desligamento = doc.data();
      let effectiveDate;

      if (
        desligamento.dataEfetiva &&
        typeof desligamento.dataEfetiva.toDate === "function"
      ) {
        effectiveDate = desligamento.dataEfetiva.toDate();
      } else if (desligamento.dataEfetiva instanceof Date) {
        effectiveDate = desligamento.dataEfetiva;
      } else {
        return;
      }

      const yearMonthKey = `${effectiveDate.getFullYear()}-${
        effectiveDate.getMonth() + 1
      }`;

      if (monthlyDataMap.hasOwnProperty(yearMonthKey)) {
        monthlyDataMap[yearMonthKey]++;
      }
    });

    const desligamentoData = labels.map((label) => {
      const [monthName, yearShort] = label.split("/");
      const monthIndex = monthNames.findIndex((name) => name === monthName);
      const year = parseInt(
        yearShort.length === 2 ? `20${yearShort}` : yearShort
      );
      const yearMonthKey = `${year}-${monthIndex + 1}`;
      return monthlyDataMap[yearMonthKey] || 0;
    });

    return {
      ativos: ativosSnap.size,
      vagas: vagasSnap.size,
      onboarding: onboardingSnap.size,
      comunicados: comunicadosSnap.size,

      funcoesData: {
        labels: funcoesLabels,
        data: funcoesData,
      },
      profissaoData: {
        labels: profissaoLabels,
        data: profissaoData,
      },
      desligamentoData: {
        labels: labels,
        data: desligamentoData,
      },
    };
  } // ============================================ // FUNÇÃO: Visualizar Respostas do Teste (COM CARREGAMENTO DINÂMICO DE SWEETALERT2) // ============================================

  window.abrirModalVerRespostas = async function (tokenId, candidatoNome) {
    console.log(`🔹 Abrindo respostas do teste: ${tokenId}`); // ✅ VERIFICA SE SWEETALERT2 ESTÁ CARREGADO

    if (typeof Swal === "undefined") {
      console.log("⚠️ Carregando SweetAlert2...");

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
      script.onload = () => {
        console.log("✅ SweetAlert2 carregado"); // Tenta novamente após carregar
        abrirModalVerRespostasInterno(tokenId, candidatoNome);
      };
      script.onerror = () => {
        console.error("❌ Erro ao carregar SweetAlert2");
        if (window.showToast) {
          window.showToast("Erro ao carregar componente de modal", "error");
        } else {
          alert("Erro ao carregar componente de modal");
        }
      };
      document.head.appendChild(script);
      return;
    } // Se já está carregado, executa direto

    abrirModalVerRespostasInterno(tokenId, candidatoNome);
  }; // ============================================ // FUNÇÃO: Visualizar Respostas do Teste COM CORREÇÃO (CORRIGIDO) // ============================================

  async function abrirModalVerRespostasInterno(tokenId, candidatoNome) {
    try {
      if (!db) {
        console.error("❌ ERRO: Firestore não inicializado!");
        window.showToast?.("Erro: Firestore não está pronto", "error");
        return;
      } // ✅ Busca o token

      const tokenDocRef = doc(db, "tokensacesso", tokenId);
      const tokenSnap = await getDoc(tokenDocRef);

      if (!tokenSnap.exists()) {
        window.showToast?.("Token não encontrado", "error");
        return;
      }

      const tokenData = tokenSnap.data();
      console.log("✅ Token encontrado:", tokenData);

      if (
        !tokenData.respostas ||
        Object.keys(tokenData.respostas).length === 0
      ) {
        window.showToast?.(
          "Nenhuma resposta encontrada para este teste",
          "warning"
        );
        return;
      } // ✅ Busca o teste

      const testeRef = doc(db, "estudos_de_caso", tokenData.testeId);
      const testeSnap = await getDoc(testeRef);
      const testeDados = testeSnap.exists() ? testeSnap.data() : {};

      console.log("✅ Teste carregado:", testeDados); // ✅ NOVA LÓGICA: Calcula acertos e erros

      let totalPerguntas = 0;
      let acertos = 0;
      let erros = 0; // ✅ Cria HTML do modal com correção

      let perguntasHTML = "";

      if (testeDados.perguntas && testeDados.perguntas.length > 0) {
        totalPerguntas = testeDados.perguntas.length;

        testeDados.perguntas.forEach((pergunta, index) => {
          // ✅ CORRIGIDO: Trata resposta do candidato
          let respostaCandidato = tokenData.respostas[`resposta-${index}`]; // Se for objeto, extrai o texto da resposta

          if (
            typeof respostaCandidato === "object" &&
            respostaCandidato !== null
          ) {
            respostaCandidato =
              respostaCandidato.texto ||
              respostaCandidato.resposta ||
              JSON.stringify(respostaCandidato);
          }

          respostaCandidato = respostaCandidato || "-"; // ✅ CORRIGIDO: Trata resposta correta

          let respostaCorreta =
            pergunta.respostaCorreta || pergunta.gabarito || null; // Se for objeto, extrai o texto

          if (typeof respostaCorreta === "object" && respostaCorreta !== null) {
            respostaCorreta =
              respostaCorreta.texto ||
              respostaCorreta.resposta ||
              JSON.stringify(respostaCorreta);
          }

          console.log(`📝 Pergunta ${index + 1}:`, {
            respostaCandidato,
            respostaCorreta,
            pergunta,
          }); // ✅ Verifica se há resposta correta definida

          let statusResposta = "";
          let corResposta = "#555"; // cinza padrão
          let iconeResposta = "";

          if (respostaCorreta) {
            // Normaliza strings para comparação (case-insensitive e remove espaços extras)
            const respostaCandidatoNorm = String(respostaCandidato)
              .trim()
              .toLowerCase();
            const respostaCorretaNorm = String(respostaCorreta)
              .trim()
              .toLowerCase();

            if (respostaCandidatoNorm === respostaCorretaNorm) {
              acertos++;
              statusResposta = "✅ CORRETO";
              corResposta = "#28a745"; // verde
              iconeResposta = "✅";
            } else {
              erros++;
              statusResposta = "❌ INCORRETO";
              corResposta = "#dc3545"; // vermelho
              iconeResposta = "❌";
            }
          } else {
            statusResposta = "ℹ️ Sem gabarito definido";
            corResposta = "#6c757d"; // cinza
            iconeResposta = "ℹ️";
          } // ✅ CORRIGIDO: Trata as opções

          let opcoesHTML = "";

          if (
            pergunta.opcoes &&
            Array.isArray(pergunta.opcoes) &&
            pergunta.opcoes.length > 0
          ) {
            const opcoesTexto = pergunta.opcoes.map((opcao) => {
              // Se for objeto, extrai o texto
              if (typeof opcao === "object" && opcao !== null) {
                return (
                  opcao.texto ||
                  opcao.resposta ||
                  opcao.label ||
                  JSON.stringify(opcao)
                );
              }
              return String(opcao);
            });

            opcoesHTML = `
          <div style="background: #f9f9f9; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 13px;">
            <strong>Opções:</strong>
            <ul style="margin: 5px 0; padding-left: 20px;">
              ${opcoesTexto.map((opcao) => `<li>${opcao}</li>`).join("")}
            </ul>
          </div>
          `;
          }

          perguntasHTML += `
        <div style="background: #f0f8ff; padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid ${corResposta}; text-align: left;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #333;">
            <strong>Pergunta ${index + 1}:</strong> ${pergunta.enunciado}
          </p>
          
          ${opcoesHTML}
          
          <div style="background: white; padding: 10px; border-radius: 4px; color: ${corResposta}; border: 2px solid ${corResposta}; margin-top: 8px;">
            <strong>${iconeResposta} Resposta do Candidato:</strong> ${respostaCandidato}
          </div>
          
          ${
            respostaCorreta
              ? `
          <div style="background: #e8f8f0; padding: 8px; border-radius: 4px; margin-top: 8px; color: #28a745; border: 1px solid #28a745;">
            <strong>✓ Resposta Correta:</strong> ${respostaCorreta}
          </div>
          <div style="text-align: right; margin-top: 5px; font-weight: bold; color: ${corResposta}; font-size: 14px;">
            ${statusResposta}
          </div>
          `
              : `
          <div style="text-align: right; margin-top: 5px; font-style: italic; color: #6c757d; font-size: 12px;">
            ${statusResposta}
          </div>
          `
          }
        </div>
      `;
        });
      } else {
        perguntasHTML =
          '<p style="color: #999; text-align: center;">Nenhuma pergunta encontrada.</p>';
      }

      const dataResposta = tokenData.respondidoEm
        ? new Date(
            tokenData.respondidoEm.toDate?.() || tokenData.respondidoEm
          ).toLocaleDateString("pt-BR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const tempoGasto = tokenData.tempoRespostaSegundos
        ? `${Math.floor(tokenData.tempoRespostaSegundos / 60)}min ${
            tokenData.tempoRespostaSegundos % 60
          }s`
        : "-"; // ✅ Calcula porcentagem de acerto

      const porcentagemAcerto =
        totalPerguntas > 0 ? ((acertos / totalPerguntas) * 100).toFixed(1) : 0; // ✅ Define cor do resultado baseado na porcentagem

      let corResultado = "#6c757d"; // cinza padrão
      if (porcentagemAcerto >= 70) {
        corResultado = "#28a745"; // verde (aprovado)
      } else if (porcentagemAcerto >= 50) {
        corResultado = "#ffc107"; // amarelo (médio)
      } else {
        corResultado = "#dc3545"; // vermelho (reprovado)
      } // ✅ Abre com SweetAlert2

      await Swal.fire({
        title: `<i class="fas fa-eye me-2"></i> Respostas do Teste`,
        html: `
      <div style="text-align: left; max-height: 500px; overflow-y: auto;">
        <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>📋 Candidato:</strong> ${candidatoNome}</p>
          <p style="margin: 5px 0;"><strong>📝 Teste:</strong> ${
          testeDados.titulo || "Teste"
        }</p>
          <p style="margin: 5px 0;"><strong>⏱️ Tempo gasto:</strong> ${tempoGasto}</p>
          <p style="margin: 5px 0;"><strong>📅 Data da resposta:</strong> ${dataResposta}</p>
        </div>
        
                <div style="background: ${corResultado}; color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
          <h4 style="margin: 0 0 10px 0; font-size: 18px;">📊 Resultado da Correção</h4>
          <div style="display: flex; justify-content: space-around; margin-top: 10px;">
            <div>
              <div style="font-size: 32px; font-weight: bold;">${acertos}</div>
              <div style="font-size: 14px;">✅ Acertos</div>
            </div>
            <div>
              <div style="font-size: 32px; font-weight: bold;">${erros}</div>
              <div style="font-size: 14px;">❌ Erros</div>
            </div>
            <div>
              <div style="font-size: 32px; font-weight: bold;">${porcentagemAcerto}%</div>
              <div style="font-size: 14px;">📈 Aproveitamento</div>
            </div>
          </div>
        </div>
        
        <hr style="margin: 20px 0;">
        
        <h6 style="color: #667eea; margin-bottom: 15px; text-align: left;"><strong>Respostas Fornecidas:</strong></h6>
        
        ${perguntasHTML}
      </div>
    `,
        width: "900px",
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-download me-1"></i> Exportar',
        cancelButtonText: "Fechar",
        confirmButtonColor: "#667eea",
        cancelButtonColor: "#6c757d",
      }).then((result) => {
        if (result.isConfirmed) {
          window.exportarRespostaIndividual?.(tokenId, candidatoNome);
        }
      });

      console.log("✅ Modal de respostas aberto com correção");
    } catch (error) {
      console.error("❌ Erro ao abrir respostas:", error);
      window.showToast?.(`Erro: ${error.message}`, "error");
    }
  } // ============================================ // FUNÇÃO: Exportar Resposta Individual (COM RESPOSTAS) // ============================================

  window.exportarRespostaIndividual = async function (
    tokenDocId,
    candidatoNome
  ) {
    console.log(`🔹 Exportando resposta individual: ${tokenDocId}`);

    try {
      if (!db) {
        console.error("❌ ERRO: Firestore não inicializado!");
        return;
      } // ✅ Busca o token

      const tokenDocRef = doc(db, "tokensacesso", tokenDocId);
      const tokenSnap = await getDoc(tokenDocRef);

      if (!tokenSnap.exists()) {
        window.showToast?.("Token não encontrado", "error");
        return;
      }

      const tokenData = tokenSnap.data();
      console.log("✅ Token encontrado:", tokenData); // ✅ Busca o teste

      const testeRef = doc(db, "estudos_de_caso", tokenData.testeId);
      const testeSnap = await getDoc(testeRef);
      const testeDados = testeSnap.exists() ? testeSnap.data() : {};

      console.log("✅ Teste encontrado:", testeDados); // ✅ Formata data e tempo

      const dataResposta = tokenData.respondidoEm
        ? new Date(
            tokenData.respondidoEm.toDate?.() || tokenData.respondidoEm
          ).toLocaleDateString("pt-BR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const tempoGasto = tokenData.tempoRespostaSegundos
        ? `${Math.floor(tokenData.tempoRespostaSegundos / 60)}min ${
            tokenData.tempoRespostaSegundos % 60
          }s`
        : "-"; // ✅ Cria linha única para Excel com TODAS as colunas

      const linhaExcel = {
        Candidato: candidatoNome,
        Teste: testeDados.titulo || "Teste",
        "Data da Resposta": dataResposta,
        "Tempo Gasto": tempoGasto,
        Status: "Respondido",
      }; // ✅ Adiciona cada RESPOSTA como coluna no Excel

      if (testeDados.perguntas && testeDados.perguntas.length > 0) {
        testeDados.perguntas.forEach((pergunta, index) => {
          const resposta = tokenData.respostas[`resposta-${index}`] || "-"; // Usa o enunciado do Firestore
          const enunciado =
            pergunta.enunciado || pergunta.texto || `P${index + 1}`;
          linhaExcel[`P${index + 1}: ${enunciado}`] = resposta;
        });
      }

      console.log("📊 Dados para exportação:", linhaExcel); // ✅ Pergunta qual formato exportar

      const { isConfirmed, isDenied } = await Swal.fire({
        title: "Exportar Respostas",
        text: "Escolha o formato para exportação:",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "📊 Excel (CSV)",
        denyButtonText: "📄 PDF",
        cancelButtonText: "Cancelar",
        showDenyButton: true,
      });

      if (isConfirmed) {
        console.log("📊 Exportando para Excel...");
        exportarParaExcel(
          [linhaExcel],
          `resposta_${candidatoNome.replace(/\s+/g, "_")}.csv`
        );
      } else if (isDenied) {
        console.log("📄 Exportando para PDF...");
        exportarRespostaPDFIndividual(
          candidatoNome,
          testeDados,
          tokenData,
          dataResposta,
          tempoGasto
        );
      }
    } catch (error) {
      console.error("❌ Erro ao exportar:", error);
      window.showToast?.(`Erro: ${error.message}`, "error");
    }
  };
  /**
   * ✅ Exporta uma resposta individual para PDF
   */

  function exportarRespostaPDFIndividual(
    candidatoNome,
    testeDados,
    tokenData,
    dataResposta,
    tempoGasto
  ) {
    console.log("📄 Exportando resposta individual para PDF...");

    if (typeof jspdf === "undefined" || typeof jspdf.jsPDF === "undefined") {
      console.log("⚠️ Carregando jsPDF...");

      const scriptJsPDF = document.createElement("script");
      scriptJsPDF.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

      const scriptAutoTable = document.createElement("script");
      scriptAutoTable.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js";

      scriptJsPDF.onload = () => {
        scriptAutoTable.onload = () => {
          setTimeout(() => {
            gerarPDFRespostasIndividualCorrigido(
              candidatoNome,
              testeDados,
              tokenData,
              dataResposta,
              tempoGasto
            );
          }, 500);
        };
        document.head.appendChild(scriptAutoTable);
      };

      document.head.appendChild(scriptJsPDF);
    } else {
      gerarPDFRespostasIndividualCorrigido(
        candidatoNome,
        testeDados,
        tokenData,
        dataResposta,
        tempoGasto
      );
    }
  }

  function gerarPDFRespostasIndividualCorrigido(
    candidatoNome,
    testeDados,
    tokenData,
    dataResposta,
    tempoGasto
  ) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let yPosition = 15; // ✅ CABEÇALHO

      doc.setFontSize(18);
      doc.setTextColor(102, 126, 234);
      doc.text("EuPsico", 105, yPosition, { align: "center" });
      yPosition += 8;

      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      doc.text("Grupo de atendimento multidisciplinar", 105, yPosition, {
        align: "center",
      });
      yPosition += 8;

      doc.setFontSize(12);
      doc.setTextColor(51, 51, 51);
      doc.text("RESPOSTAS DO TESTE", 105, yPosition, { align: "center" });
      yPosition += 10; // Linha separadora

      doc.setDrawColor(102, 126, 234);
      doc.setLineWidth(0.5);
      doc.line(14, yPosition - 2, 196, yPosition - 2);
      yPosition += 5; // ✅ INFORMAÇÕES DO CANDIDATO

      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);

      doc.text(`Candidato(a): ${candidatoNome}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Teste: ${testeDados.titulo || "Teste"}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Data da resposta: ${dataResposta}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Tempo gasto: ${tempoGasto}`, 14, yPosition);
      yPosition += 10; // ✅ PERGUNTAS E RESPOSTAS

      doc.setFontSize(11);
      doc.setTextColor(102, 126, 234);
      doc.text("Respostas Fornecidas:", 14, yPosition);
      yPosition += 8;

      doc.setFontSize(9);
      doc.setTextColor(51, 51, 51);

      if (testeDados.perguntas && testeDados.perguntas.length > 0) {
        testeDados.perguntas.forEach((pergunta, index) => {
          const resposta = tokenData.respostas[`resposta-${index}`] || "-"; // ✅ PERGUNTA

          doc.setFont(undefined, "bold");
          const perguntaText = `P${index + 1}: ${pergunta.enunciado}`;
          const perguntaWrapped = doc.splitTextToSize(perguntaText, 180);

          perguntaWrapped.forEach((line) => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 15;
            }
            doc.text(line, 14, yPosition);
            yPosition += 5;
          }); // ✅ RESPOSTA

          doc.setFont(undefined, "normal");
          doc.setFillColor(240, 240, 240);
          const respostaWrapped = doc.splitTextToSize(
            `Resposta: ${resposta}`,
            180
          );

          respostaWrapped.forEach((line) => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 15;
            }
            doc.text(line, 14, yPosition);
            yPosition += 5;
          });

          yPosition += 3;
        });
      } else {
        doc.text("Nenhuma resposta encontrada.", 14, yPosition);
      }

      yPosition += 5; // ✅ RODAPÉ

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150); // Linha separadora

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(14, 280, 196, 280);

        doc.text(
          "Avenida Inocêncio Seráfico, 141 - Centro de Carapicuíba - SP, 06320-290",
          105,
          285,
          { align: "center" }
        );
        doc.text("WhatsApp: 11 99794-9071", 105, 289, { align: "center" });
        doc.text(
          `Página ${i} de ${pageCount} | Relatório gerado automaticamente © 2025`,
          105,
          293,
          { align: "center" }
        );
      } // ✅ SALVA O PDF

      doc.save(`resposta_${candidatoNome.replace(/\s+/g, "_")}.pdf`);
      window.showToast?.("✅ PDF exportado com sucesso!", "success");

      console.log("✅ PDF gerado com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao gerar PDF:", error);
      window.showToast?.("❌ Erro ao exportar PDF", "error");
    }
  } // ============================================ // FUNÇÃO ORIGINAL: Busca de dados do Dashboard // ============================================

  async function fetchRHDashboardData() {
    const ativosQuery = query(
      usuariosCollection,
      where("inativo", "==", false)
    );

    const vagasQuery = query(
      vagasCollection,
      where("status", "in", ["aguardando-aprovacao", "em-divulgacao"])
    );

    const onboardingQuery = query(
      onboardingCollection,
      where("faseAtual", "in", [
        "pendente-docs",
        "em-integracao",
        "acompanhamento",
      ])
    );

    const comunicadosQuery = query(comunicadosCollection);
    const todosUsuariosQuery = query(
      usuariosCollection,
      where("inativo", "==", false)
    );

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const desligamentosQuery = query(
      desligamentosCollection,
      where("dataEfetiva", ">=", oneYearAgo)
    );

    const [
      ativosSnap,
      vagasSnap,
      onboardingSnap,
      comunicadosSnap,
      todosUsuariosSnap,
      desligamentosSnap,
    ] = await Promise.all([
      getDocs(ativosQuery),
      getDocs(vagasQuery),
      getDocs(onboardingQuery),
      getDocs(comunicadosQuery),
      getDocs(todosUsuariosQuery),
      getDocs(desligamentosQuery),
    ]);

    const funcoesMap = {};
    const profissaoMap = {};

    todosUsuariosSnap.forEach((doc) => {
      const user = doc.data();
      const funcoes = user.funcoes || [];
      const profissao = user.profissao || "Não Informado";

      funcoes.forEach((role) => {
        const displayRole =
          {
            psicologo_voluntario: "Psicólogo Voluntário",
            psicologo_plantonista: "Psicólogo Plantonista",
            supervisor: "Supervisor",
            admin: "Admin",
            rh: "RH",
            gestor: "Gestor",
          }[role] ||
          role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");

        funcoesMap[displayRole] = (funcoesMap[displayRole] || 0) + 1;
      });

      const displayProfissao =
        profissao.charAt(0).toUpperCase() + profissao.slice(1);
      profissaoMap[displayProfissao] =
        (profissaoMap[displayProfissao] || 0) + 1;
    });

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    const monthlyDataMap = {};
    const labels = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const yearMonthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
      monthlyDataMap[yearMonthKey] = 0;
      labels.push(
        `${monthNames[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`
      );
    }

    desligamentosSnap.forEach((doc) => {
      const desligamento = doc.data();
      let effectiveDate;

      if (
        desligamento.dataEfetiva &&
        typeof desligamento.dataEfetiva.toDate === "function"
      ) {
        effectiveDate = desligamento.dataEfetiva.toDate();
      } else if (desligamento.dataEfetiva instanceof Date) {
        effectiveDate = desligamento.dataEfetiva;
      } else {
        return;
      }

      const yearMonthKey = `${effectiveDate.getFullYear()}-${
        effectiveDate.getMonth() + 1
      }`;

      if (monthlyDataMap.hasOwnProperty(yearMonthKey)) {
        monthlyDataMap[yearMonthKey]++;
      }
    });

    const desligamentoData = labels.map((label) => {
      const [monthName, yearShort] = label.split("/");
      const monthIndex = monthNames.findIndex((name) => name === monthName);
      const year = parseInt(
        yearShort.length === 2 ? `20${yearShort}` : yearShort
      );
      const yearMonthKey = `${year}-${monthIndex + 1}`;
      return monthlyDataMap[yearMonthKey] || 0;
    });

    return {
      ativos: ativosSnap.size,
      vagas: vagasSnap.size,
      onboarding: onboardingSnap.size,
      comunicados: comunicadosSnap.size,

      funcoesData: {
        labels: funcoesLabels,
        data: funcoesData,
      },
      profissaoData: {
        labels: profissaoLabels,
        data: profissaoData,
      },
      desligamentoData: {
        labels: labels,
        data: desligamentoData,
      },
    };
  } // ============================================ // FUNÇÃO: Visualizar Respostas do Teste (COM CARREGAMENTO DINÂMICO DE SWEETALERT2) // ============================================

  window.abrirModalVerRespostas = async function (tokenId, candidatoNome) {
    console.log(`🔹 Abrindo respostas do teste: ${tokenId}`); // ✅ VERIFICA SE SWEETALERT2 ESTÁ CARREGADO

    if (typeof Swal === "undefined") {
      console.log("⚠️ Carregando SweetAlert2...");

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
      script.onload = () => {
        console.log("✅ SweetAlert2 carregado"); // Tenta novamente após carregar
        abrirModalVerRespostasInterno(tokenId, candidatoNome);
      };
      script.onerror = () => {
        console.error("❌ Erro ao carregar SweetAlert2");
        if (window.showToast) {
          window.showToast("Erro ao carregar componente de modal", "error");
        } else {
          alert("Erro ao carregar componente de modal");
        }
      };
      document.head.appendChild(script);
      return;
    } // Se já está carregado, executa direto

    abrirModalVerRespostasInterno(tokenId, candidatoNome);
  }; // ============================================ // FUNÇÃO: Visualizar Respostas do Teste COM CORREÇÃO (CORRIGIDO) // ============================================

  async function abrirModalVerRespostasInterno(tokenId, candidatoNome) {
    try {
      if (!db) {
        console.error("❌ ERRO: Firestore não inicializado!");
        window.showToast?.("Erro: Firestore não está pronto", "error");
        return;
      } // ✅ Busca o token

      const tokenDocRef = doc(db, "tokensacesso", tokenId);
      const tokenSnap = await getDoc(tokenDocRef);

      if (!tokenSnap.exists()) {
        window.showToast?.("Token não encontrado", "error");
        return;
      }

      const tokenData = tokenSnap.data();
      console.log("✅ Token encontrado:", tokenData);

      if (
        !tokenData.respostas ||
        Object.keys(tokenData.respostas).length === 0
      ) {
        window.showToast?.(
          "Nenhuma resposta encontrada para este teste",
          "warning"
        );
        return;
      } // ✅ Busca o teste

      const testeRef = doc(db, "estudos_de_caso", tokenData.testeId);
      const testeSnap = await getDoc(testeRef);
      const testeDados = testeSnap.exists() ? testeSnap.data() : {};

      console.log("✅ Teste carregado:", testeDados); // ✅ NOVA LÓGICA: Calcula acertos e erros

      let totalPerguntas = 0;
      let acertos = 0;
      let erros = 0; // ✅ Cria HTML do modal com correção

      let perguntasHTML = "";

      if (testeDados.perguntas && testeDados.perguntas.length > 0) {
        totalPerguntas = testeDados.perguntas.length;

        testeDados.perguntas.forEach((pergunta, index) => {
          // ✅ CORRIGIDO: Trata resposta do candidato
          let respostaCandidato = tokenData.respostas[`resposta-${index}`]; // Se for objeto, extrai o texto da resposta

          if (
            typeof respostaCandidato === "object" &&
            respostaCandidato !== null
          ) {
            respostaCandidato =
              respostaCandidato.texto ||
              respostaCandidato.resposta ||
              JSON.stringify(respostaCandidato);
          }

          respostaCandidato = respostaCandidato || "-"; // ✅ CORRIGIDO: Trata resposta correta

          let respostaCorreta =
            pergunta.respostaCorreta || pergunta.gabarito || null; // Se for objeto, extrai o texto

          if (typeof respostaCorreta === "object" && respostaCorreta !== null) {
            respostaCorreta =
              respostaCorreta.texto ||
              respostaCorreta.resposta ||
              JSON.stringify(respostaCorreta);
          }

          console.log(`📝 Pergunta ${index + 1}:`, {
            respostaCandidato,
            respostaCorreta,
            pergunta,
          }); // ✅ Verifica se há resposta correta definida

          let statusResposta = "";
          let corResposta = "#555"; // cinza padrão
          let iconeResposta = "";

          if (respostaCorreta) {
            // Normaliza strings para comparação (case-insensitive e remove espaços extras)
            const respostaCandidatoNorm = String(respostaCandidato)
              .trim()
              .toLowerCase();
            const respostaCorretaNorm = String(respostaCorreta)
              .trim()
              .toLowerCase();

            if (respostaCandidatoNorm === respostaCorretaNorm) {
              acertos++;
              statusResposta = "✅ CORRETO";
              corResposta = "#28a745"; // verde
              iconeResposta = "✅";
            } else {
              erros++;
              statusResposta = "❌ INCORRETO";
              corResposta = "#dc3545"; // vermelho
              iconeResposta = "❌";
            }
          } else {
            statusResposta = "ℹ️ Sem gabarito definido";
            corResposta = "#6c757d"; // cinza
            iconeResposta = "ℹ️";
          } // ✅ CORRIGIDO: Trata as opções

          let opcoesHTML = "";

          if (
            pergunta.opcoes &&
            Array.isArray(pergunta.opcoes) &&
            pergunta.opcoes.length > 0
          ) {
            const opcoesTexto = pergunta.opcoes.map((opcao) => {
              // Se for objeto, extrai o texto
              if (typeof opcao === "object" && opcao !== null) {
                return (
                  opcao.texto ||
                  opcao.resposta ||
                  opcao.label ||
                  JSON.stringify(opcao)
                );
              }
              return String(opcao);
            });

            opcoesHTML = `
          <div style="background: #f9f9f9; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 13px;">
            <strong>Opções:</strong>
            <ul style="margin: 5px 0; padding-left: 20px;">
              ${opcoesTexto.map((opcao) => `<li>${opcao}</li>`).join("")}
            </ul>
          </div>
          `;
          }

          perguntasHTML += `
        <div style="background: #f0f8ff; padding: 12px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid ${corResposta}; text-align: left;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #333;">
            <strong>Pergunta ${index + 1}:</strong> ${pergunta.enunciado}
          </p>
          
          ${opcoesHTML}
          
          <div style="background: white; padding: 10px; border-radius: 4px; color: ${corResposta}; border: 2px solid ${corResposta}; margin-top: 8px;">
            <strong>${iconeResposta} Resposta do Candidato:</strong> ${respostaCandidato}
          </div>
          
          ${
            respostaCorreta
              ? `
          <div style="background: #e8f8f0; padding: 8px; border-radius: 4px; margin-top: 8px; color: #28a745; border: 1px solid #28a745;">
            <strong>✓ Resposta Correta:</strong> ${respostaCorreta}
          </div>
          <div style="text-align: right; margin-top: 5px; font-weight: bold; color: ${corResposta}; font-size: 14px;">
            ${statusResposta}
          </div>
          `
              : `
          <div style="text-align: right; margin-top: 5px; font-style: italic; color: #6c757d; font-size: 12px;">
            ${statusResposta}
          </div>
          `
          }
        </div>
      `;
        });
      } else {
        perguntasHTML =
          '<p style="color: #999; text-align: center;">Nenhuma pergunta encontrada.</p>';
      }

      const dataResposta = tokenData.respondidoEm
        ? new Date(
            tokenData.respondidoEm.toDate?.() || tokenData.respondidoEm
          ).toLocaleDateString("pt-BR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const tempoGasto = tokenData.tempoRespostaSegundos
        ? `${Math.floor(tokenData.tempoRespostaSegundos / 60)}min ${
            tokenData.tempoRespostaSegundos % 60
          }s`
        : "-"; // ✅ Calcula porcentagem de acerto

      const porcentagemAcerto =
        totalPerguntas > 0 ? ((acertos / totalPerguntas) * 100).toFixed(1) : 0; // ✅ Define cor do resultado baseado na porcentagem

      let corResultado = "#6c757d"; // cinza padrão
      if (porcentagemAcerto >= 70) {
        corResultado = "#28a745"; // verde (aprovado)
      } else if (porcentagemAcerto >= 50) {
        corResultado = "#ffc107"; // amarelo (médio)
      } else {
        corResultado = "#dc3545"; // vermelho (reprovado)
      } // ✅ Abre com SweetAlert2

      await Swal.fire({
        title: `<i class="fas fa-eye me-2"></i> Respostas do Teste`,
        html: `
      <div style="text-align: left; max-height: 500px; overflow-y: auto;">
        <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>📋 Candidato:</strong> ${candidatoNome}</p>
          <p style="margin: 5px 0;"><strong>📝 Teste:</strong> ${
          testeDados.titulo || "Teste"
        }</p>
          <p style="margin: 5px 0;"><strong>⏱️ Tempo gasto:</strong> ${tempoGasto}</p>
          <p style="margin: 5px 0;"><strong>📅 Data da resposta:</strong> ${dataResposta}</p>
        </div>
        
                <div style="background: ${corResultado}; color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
          <h4 style="margin: 0 0 10px 0; font-size: 18px;">📊 Resultado da Correção</h4>
          <div style="display: flex; justify-content: space-around; margin-top: 10px;">
            <div>
              <div style="font-size: 32px; font-weight: bold;">${acertos}</div>
              <div style="font-size: 14px;">✅ Acertos</div>
            </div>
            <div>
              <div style="font-size: 32px; font-weight: bold;">${erros}</div>
              <div style="font-size: 14px;">❌ Erros</div>
            </div>
            <div>
              <div style="font-size: 32px; font-weight: bold;">${porcentagemAcerto}%</div>
              <div style="font-size: 14px;">📈 Aproveitamento</div>
            </div>
          </div>
        </div>
        
        <hr style="margin: 20px 0;">
        
        <h6 style="color: #667eea; margin-bottom: 15px; text-align: left;"><strong>Respostas Fornecidas:</strong></h6>
        
        ${perguntasHTML}
      </div>
    `,
        width: "900px",
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-download me-1"></i> Exportar',
        cancelButtonText: "Fechar",
        confirmButtonColor: "#667eea",
        cancelButtonColor: "#6c757d",
      }).then((result) => {
        if (result.isConfirmed) {
          window.exportarRespostaIndividual?.(tokenId, candidatoNome);
        }
      });

      console.log("✅ Modal de respostas aberto com correção");
    } catch (error) {
      console.error("❌ Erro ao abrir respostas:", error);
      window.showToast?.(`Erro: ${error.message}`, "error");
    }
  } // ============================================ // FUNÇÃO: Exportar Resposta Individual (COM RESPOSTAS) // ============================================

  window.exportarRespostaIndividual = async function (
    tokenDocId,
    candidatoNome
  ) {
    console.log(`🔹 Exportando resposta individual: ${tokenDocId}`);

    try {
      if (!db) {
        console.error("❌ ERRO: Firestore não inicializado!");
        return;
      } // ✅ Busca o token

      const tokenDocRef = doc(db, "tokensacesso", tokenDocId);
      const tokenSnap = await getDoc(tokenDocRef);

      if (!tokenSnap.exists()) {
        window.showToast?.("Token não encontrado", "error");
        return;
      }

      const tokenData = tokenSnap.data();
      console.log("✅ Token encontrado:", tokenData); // ✅ Busca o teste

      const testeRef = doc(db, "estudos_de_caso", tokenData.testeId);
      const testeSnap = await getDoc(testeRef);
      const testeDados = testeSnap.exists() ? testeSnap.data() : {};

      console.log("✅ Teste encontrado:", testeDados); // ✅ Formata data e tempo

      const dataResposta = tokenData.respondidoEm
        ? new Date(
            tokenData.respondidoEm.toDate?.() || tokenData.respondidoEm
          ).toLocaleDateString("pt-BR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const tempoGasto = tokenData.tempoRespostaSegundos
        ? `${Math.floor(tokenData.tempoRespostaSegundos / 60)}min ${
            tokenData.tempoRespostaSegundos % 60
          }s`
        : "-"; // ✅ Cria linha única para Excel com TODAS as colunas

      const linhaExcel = {
        Candidato: candidatoNome,
        Teste: testeDados.titulo || "Teste",
        "Data da Resposta": dataResposta,
        "Tempo Gasto": tempoGasto,
        Status: "Respondido",
      }; // ✅ Adiciona cada RESPOSTA como coluna no Excel

      if (testeDados.perguntas && testeDados.perguntas.length > 0) {
        testeDados.perguntas.forEach((pergunta, index) => {
          const resposta = tokenData.respostas[`resposta-${index}`] || "-"; // Usa o enunciado do Firestore
          const enunciado =
            pergunta.enunciado || pergunta.texto || `P${index + 1}`;
          linhaExcel[`P${index + 1}: ${enunciado}`] = resposta;
        });
      }

      console.log("📊 Dados para exportação:", linhaExcel); // ✅ Pergunta qual formato exportar

      const { isConfirmed, isDenied } = await Swal.fire({
        title: "Exportar Respostas",
        text: "Escolha o formato para exportação:",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "📊 Excel (CSV)",
        denyButtonText: "📄 PDF",
        cancelButtonText: "Cancelar",
        showDenyButton: true,
      });

      if (isConfirmed) {
        console.log("📊 Exportando para Excel...");
        exportarParaExcel(
          [linhaExcel],
          `resposta_${candidatoNome.replace(/\s+/g, "_")}.csv`
        );
      } else if (isDenied) {
        console.log("📄 Exportando para PDF...");
        exportarRespostaPDFIndividual(
          candidatoNome,
          testeDados,
          tokenData,
          dataResposta,
          tempoGasto
        );
      }
    } catch (error) {
      console.error("❌ Erro ao exportar:", error);
      window.showToast?.(`Erro: ${error.message}`, "error");
    }
  };
  /**
   * ✅ Exporta uma resposta individual para PDF
   */

  function exportarRespostaPDFIndividual(
    candidatoNome,
    testeDados,
    tokenData,
    dataResposta,
    tempoGasto
  ) {
    console.log("📄 Exportando resposta individual para PDF...");

    if (typeof jspdf === "undefined" || typeof jspdf.jsPDF === "undefined") {
      console.log("⚠️ Carregando jsPDF...");

      const scriptJsPDF = document.createElement("script");
      scriptJsPDF.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

      const scriptAutoTable = document.createElement("script");
      scriptAutoTable.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js";

      scriptJsPDF.onload = () => {
        scriptAutoTable.onload = () => {
          setTimeout(() => {
            gerarPDFRespostasIndividualCorrigido(
              candidatoNome,
              testeDados,
              tokenData,
              dataResposta,
              tempoGasto
            );
          }, 500);
        };
        document.head.appendChild(scriptAutoTable);
      };

      document.head.appendChild(scriptJsPDF);
    } else {
      gerarPDFRespostasIndividualCorrigido(
        candidatoNome,
        testeDados,
        tokenData,
        dataResposta,
        tempoGasto
      );
    }
  }

  function gerarPDFRespostasIndividualCorrigido(
    candidatoNome,
    testeDados,
    tokenData,
    dataResposta,
    tempoGasto
  ) {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let yPosition = 15; // ✅ CABEÇALHO

      doc.setFontSize(18);
      doc.setTextColor(102, 126, 234);
      doc.text("EuPsico", 105, yPosition, { align: "center" });
      yPosition += 8;

      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      doc.text("Grupo de atendimento multidisciplinar", 105, yPosition, {
        align: "center",
      });
      yPosition += 8;

      doc.setFontSize(12);
      doc.setTextColor(51, 51, 51);
      doc.text("RESPOSTAS DO TESTE", 105, yPosition, { align: "center" });
      yPosition += 10; // Linha separadora

      doc.setDrawColor(102, 126, 234);
      doc.setLineWidth(0.5);
      doc.line(14, yPosition - 2, 196, yPosition - 2);
      yPosition += 5; // ✅ INFORMAÇÕES DO CANDIDATO

      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);

      doc.text(`Candidato(a): ${candidatoNome}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Teste: ${testeDados.titulo || "Teste"}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Data da resposta: ${dataResposta}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Tempo gasto: ${tempoGasto}`, 14, yPosition);
      yPosition += 10; // ✅ PERGUNTAS E RESPOSTAS

      doc.setFontSize(11);
      doc.setTextColor(102, 126, 234);
      doc.text("Respostas Fornecidas:", 14, yPosition);
      yPosition += 8;

      doc.setFontSize(9);
      doc.setTextColor(51, 51, 51);

      if (testeDados.perguntas && testeDados.perguntas.length > 0) {
        testeDados.perguntas.forEach((pergunta, index) => {
          const resposta = tokenData.respostas[`resposta-${index}`] || "-"; // ✅ PERGUNTA

          doc.setFont(undefined, "bold");
          const perguntaText = `P${index + 1}: ${pergunta.enunciado}`;
          const perguntaWrapped = doc.splitTextToSize(perguntaText, 180);

          perguntaWrapped.forEach((line) => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 15;
            }
            doc.text(line, 14, yPosition);
            yPosition += 5;
          }); // ✅ RESPOSTA

          doc.setFont(undefined, "normal");
          doc.setFillColor(240, 240, 240);
          const respostaWrapped = doc.splitTextToSize(
            `Resposta: ${resposta}`,
            180
          );

          respostaWrapped.forEach((line) => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 15;
            }
            doc.text(line, 14, yPosition);
            yPosition += 5;
          });

          yPosition += 3;
        });
      }

      yPosition += 5; // ✅ RODAPÉ

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150); // Linha separadora

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(14, 280, 196, 280);

        doc.text(
          "Avenida Inocêncio Seráfico, 141 - Centro de Carapicuíba - SP, 06320-290",
          105,
          285,
          { align: "center" }
        );
        doc.text("WhatsApp: 11 99794-9071", 105, 289, { align: "center" });
        doc.text(
          `Página ${i} de ${pageCount} | Relatório gerado automaticamente © 2025`,
          105,
          293,
          { align: "center" }
        );
      } // ✅ SALVA O PDF

      doc.save(`resposta_${candidatoNome.replace(/\s+/g, "_")}.pdf`);
      window.showToast?.("✅ PDF exportado com sucesso!", "success");

      console.log("✅ PDF gerado com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao gerar PDF:", error);
      window.showToast?.("❌ Erro ao exportar PDF", "error");
    }
  } // ============================================ // INICIALIZAÇÃO // ============================================

  try {
    const data = await fetchRHDashboardData();

    if (metricAtivos) metricAtivos.textContent = data.ativos;
    if (metricVagas) metricVagas.textContent = data.vagas;
    if (metricOnboarding) metricOnboarding.textContent = data.onboarding;
    if (metricComunicados) metricComunicados.textContent = data.comunicados;

    if (funcoesChartCtx) {
      new Chart(funcoesChartCtx, {
        type: "doughnut",
        data: {
          labels: data.funcoesData.labels,
          datasets: [
            {
              label: "Total",
              data: data.funcoesData.data,
              backgroundColor: [
                "#4e73df",
                "#1cc88a",
                "#36b9cc",
                "#f6c23e",
                "#6f42c1",
                "#20c997",
              ],
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                padding: 20,
              },
            },
            title: {
              display: false,
            },
          },
        },
      });
    }

    if (rhProfissaoChartCtx) {
      new Chart(rhProfissaoChartCtx, {
        type: "bar",
        data: {
          labels: data.profissaoData.labels,
          datasets: [
            {
              label: "Profissionais Ativos",
              data: data.profissaoData.data,
              backgroundColor: "#1d70b7",
              borderColor: "#04396d",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y",
          scales: {
            x: {
              beginAtZero: true,
              precision: 0,
            },
          },
          plugins: {
            legend: {
              display: false,
            },
          },
        },
      });
    }

    if (desligamentoChartCtx) {
      new Chart(desligamentoChartCtx, {
        type: "bar",
        data: {
          labels: data.desligamentoData.labels,
          datasets: [
            {
              label: "Desligamentos",
              data: data.desligamentoData.data,
              backgroundColor: "#e74a3b",
              borderColor: "#e74a3b",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              precision: 0,
            },
          },
          plugins: {
            legend: {
              display: false,
            },
          },
        },
      });
    }

    console.log("✅ Dashboard RH carregado com sucesso");
  } catch (error) {
    console.error("Erro ao carregar dados do Dashboard RH:", error);
    window.showToast?.("Erro ao carregar dashboard", "error");
  }
}
