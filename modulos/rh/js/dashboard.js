// Arquivo: /modulos/rh/js/dashboard.js
// Versão: 3.6.0 (PDF + Rodapé + Excel UTF-8 com BOM + Dados Completos)

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
  const tokensAcessoCollection = collection(db, "tokens_acesso");
  const estudosDeCasoCollection = collection(db, "estudos_de_caso");

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

      let yPosition = 15;

      // ✅ CABEÇALHO
      doc.setFontSize(18);
      doc.setTextColor(102, 126, 234);
      doc.text("EuPsico", 148, yPosition, { align: "center" });
      yPosition += 8;

      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      doc.text("Grupo de atendimento multidisciplinar", 148, yPosition, {
        align: "center",
      });
      yPosition += 8;

      doc.setFontSize(12);
      doc.setTextColor(51, 51, 51);
      doc.text("RELATÓRIO DE RECRUTAMENTO", 148, yPosition, {
        align: "center",
      });
      yPosition += 8;

      const dataHora = new Date().toLocaleDateString("pt-BR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      doc.setFontSize(8);
      doc.setTextColor(119, 119, 119);
      doc.text(`Data: ${dataHora}`, 148, yPosition, { align: "center" });
      yPosition += 10;

      // Linha separadora
      doc.setDrawColor(102, 126, 234);
      doc.setLineWidth(0.5);
      doc.line(14, yPosition - 2, 283, yPosition - 2);

      // ✅ EXTRAI DADOS DA TABELA
      const headers = [];
      const rows = [];

      tabela.querySelectorAll("thead th").forEach((th) => {
        headers.push(th.textContent.trim());
      });

      tabela.querySelectorAll("tbody tr").forEach((tr) => {
        const row = [];
        tr.querySelectorAll("td").forEach((td) => {
          row.push(td.textContent.trim());
        });
        rows.push(row);
      });

      // ✅ GERA TABELA COM autoTable
      doc.autoTable({
        head: [headers],
        body: rows,
        startY: yPosition + 2,
        theme: "grid",
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: "linebreak",
          halign: "left",
          valign: "middle",
        },
        headStyles: {
          fillColor: [102, 126, 234],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        margin: { top: 10, left: 14, right: 14 },
      });

      // ✅ RODAPÉ
      const pageCount = doc.internal.getNumberOfPages();

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(14, 195, 283, 195);

        doc.text(
          "Avenida Inocêncio Seráfico, 141 - Centro de Carapicuíba - SP, 06320-290",
          148,
          200,
          { align: "center" }
        );
        doc.text("WhatsApp: 11 99794-9071", 148, 204, { align: "center" });
        doc.text(
          `Página ${i} de ${pageCount} | Relatório gerado automaticamente © 2025`,
          148,
          208,
          { align: "center" }
        );
      }

      // ✅ DOWNLOAD
      doc.save(nomeArquivo);

      console.log("✅ PDF gerado com sucesso!");
      window.showToast?.(`✅ Arquivo ${nomeArquivo} baixado!`, "success");
    } catch (error) {
      console.error("❌ Erro ao gerar PDF:", error);
      window.showToast?.("❌ Erro ao exportar PDF", "error");
    }
  }

  // ============================================
  // FUNÇÕES AUXILIARES - CARREGAR DADOS
  // ============================================

  async function carregarDadosDashboard() {
    console.log("🔹 Carregando dados do Dashboard...");

    try {
      // Carrega dados
      const [
        usuariosSnapshot,
        vagasSnapshot,
        onboardingSnapshot,
        comunicadosSnapshot,
        desligamentosSnapshot,
      ] = await Promise.all([
        getDocs(usuariosCollection),
        getDocs(vagasCollection),
        getDocs(onboardingCollection),
        getDocs(comunicadosCollection),
        getDocs(desligamentosCollection),
      ]);

      const usuarios = usuariosSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const vagas = vagasSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const onboarding = onboardingSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const comunicados = comunicadosSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const desligamentos = desligamentosSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      console.log("✅ Dados do Dashboard carregados:", {
        usuarios: usuarios.length,
        vagas: vagas.length,
        onboarding: onboarding.length,
        comunicados: comunicados.length,
        desligamentos: desligamentos.length,
      });

      // Atualiza métricas
      if (metricAtivos) metricAtivos.textContent = usuarios.length;
      if (metricVagas) metricVagas.textContent = vagas.length;
      if (metricOnboarding) metricOnboarding.textContent = onboarding.length;
      if (metricComunicados) metricComunicados.textContent = comunicados.length;

      // Renderiza gráficos
      renderizarGraficoFuncoes(usuarios);
      renderizarGraficoProfissoes(usuarios);
      renderizarGraficoDesligamentos(desligamentos);

      console.log("✅ Dashboard renderizado com sucesso");
    } catch (error) {
      console.error("❌ Erro ao carregar dados do Dashboard:", error);
      window.showToast?.(
        "Erro ao carregar dados do dashboard. Tente novamente.",
        "error"
      );
    }
  }

  // ============================================
  // GRÁFICOS - CHART.JS
  // ============================================

  function renderizarGraficoFuncoes(usuarios) {
    if (!funcoesChartCtx) return;

    const funcoes = usuarios.reduce((acc, u) => {
      const funcao = u.funcao || "Não definido";
      acc[funcao] = (acc[funcao] || 0) + 1;
      return acc;
    }, {});

    new Chart(funcoesChartCtx, {
      type: "doughnut",
      data: {
        labels: Object.keys(funcoes),
        datasets: [
          {
            data: Object.values(funcoes),
            backgroundColor: [
              "#667eea",
              "#764ba2",
              "#f093fb",
              "#4facfe",
              "#43e97b",
              "#fa709a",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });
  }

  function renderizarGraficoProfissoes(usuarios) {
    if (!rhProfissaoChartCtx) return;

    const profissoes = usuarios.reduce((acc, u) => {
      const prof = u.profissao || "Não definido";
      acc[prof] = (acc[prof] || 0) + 1;
      return acc;
    }, {});

    new Chart(rhProfissaoChartCtx, {
      type: "bar",
      data: {
        labels: Object.keys(profissoes),
        datasets: [
          {
            label: "Profissões",
            data: Object.values(profissoes),
            backgroundColor: "#667eea",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    });
  }

  function renderizarGraficoDesligamentos(desligamentos) {
    if (!desligamentoChartCtx) return;

    const meses = desligamentos.reduce((acc, d) => {
      const data = d.data_desligamento?.toDate
        ? d.data_desligamento.toDate()
        : new Date(d.data_desligamento);
      const mes = data.toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
      });
      acc[mes] = (acc[mes] || 0) + 1;
      return acc;
    }, {});

    new Chart(desligamentoChartCtx, {
      type: "line",
      data: {
        labels: Object.keys(meses),
        datasets: [
          {
            label: "Desligamentos",
            data: Object.values(meses),
            borderColor: "#f093fb",
            backgroundColor: "rgba(240, 147, 251, 0.1)",
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    });
  }

  // ============================================
  // RELATÓRIOS - CARREGAR DADOS
  // ============================================

  async function carregarRelatorios() {
    console.log("📊 Carregando relatórios de recrutamento...");

    try {
      const [candidatosSnap, tokensSnap, vagasSnap, estudosSnap] =
        await Promise.all([
          getDocs(candidatosCollection),
          getDocs(tokensAcessoCollection),
          getDocs(vagasCollection),
          getDocs(estudosDeCasoCollection),
        ]);

      candidatosCache = candidatosSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      tokensCache = tokensSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      vagasCache = vagasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      estudosCache = estudosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      console.log("✅ Relatórios carregados:", {
        candidatos: candidatosCache.length,
        tokens: tokensCache.length,
        vagas: vagasCache.length,
        estudos: estudosCache.length,
      });

      // Atualiza métricas
      atualizarMetricasRelatorios();

      // Preenche filtros
      preencherFiltros();

      // Renderiza abas
      renderizarAbaAtiva();

      console.log("✅ Relatórios renderizados");
    } catch (error) {
      console.error("❌ Erro ao carregar relatórios:", error);
      window.showToast?.("Erro ao carregar relatórios", "error");
    }
  }

  function atualizarMetricasRelatorios() {
    const totalInscricoes = candidatosCache.length;
    const testesRespondidos = tokensCache.filter((t) => t.usado).length;
    const testesPendentes = tokensCache.filter((t) => !t.usado).length;
    const taxaResposta =
      tokensCache.length > 0
        ? ((testesRespondidos / tokensCache.length) * 100).toFixed(1)
        : "0.0";

    if (relTotalInscricoes)
      relTotalInscricoes.textContent = totalInscricoes.toString();
    if (relTestesRespondidos)
      relTestesRespondidos.textContent = testesRespondidos.toString();
    if (relTestesPendentes)
      relTestesPendentes.textContent = testesPendentes.toString();
    if (relTaxaResposta) relTaxaResposta.textContent = `${taxaResposta}%`;
  }

  function preencherFiltros() {
    // Filtro de Vagas
    if (relFiltroVaga) {
      relFiltroVaga.innerHTML = '<option value="">Todas as vagas</option>';
      vagasCache.forEach((vaga) => {
        const option = document.createElement("option");
        option.value = vaga.id;
        option.textContent = vaga.titulo || vaga.nome || "Vaga sem título";
        relFiltroVaga.appendChild(option);
      });
    }

    // Filtro de Testes
    if (relFiltroTeste) {
      relFiltroTeste.innerHTML = '<option value="">Todos os testes</option>';
      estudosCache.forEach((estudo) => {
        const option = document.createElement("option");
        option.value = estudo.id;
        option.textContent = estudo.titulo || estudo.nome || "Teste sem título";
        relFiltroTeste.appendChild(option);
      });
    }
  }
  // ============================================
  // RELATÓRIOS - ABAS E NAVEGAÇÃO
  // ============================================

  function renderizarAbaAtiva() {
    const abaAtiva =
      document.querySelector(".rh-relatorios-nav .nav-link.active")
        ?.textContent || "Inscrições";

    console.log(`📊 Renderizando aba ativa: ${abaAtiva}`);

    if (abaAtiva.includes("Inscrições")) {
      renderizarInscricoes();
    } else if (abaAtiva.includes("Candidatos")) {
      renderizarCandidatos();
    } else if (abaAtiva.includes("Respostas")) {
      renderizarRespostasAosTestes();
    }
  }

  // ============================================
  // ABA: INSCRIÇÕES
  // ============================================

  function renderizarInscricoes() {
    console.log("📝 Renderizando inscrições...");

    const tbody = document.getElementById("rel-tbody-inscricoes");
    if (!tbody) return;

    tbody.innerHTML = "";

    let inscricoesFiltradas = [...candidatosCache];

    // Aplica filtros
    const vagaId = relFiltroVaga?.value || "";
    const status = relFiltroStatus?.value || "";
    const busca = relBuscaCandidato?.value?.toLowerCase() || "";

    if (vagaId) {
      inscricoesFiltradas = inscricoesFiltradas.filter(
        (c) => c.vagaId === vagaId
      );
    }

    if (status) {
      inscricoesFiltradas = inscricoesFiltradas.filter(
        (c) => c.status === status
      );
    }

    if (busca) {
      inscricoesFiltradas = inscricoesFiltradas.filter((c) =>
        c.nome_completo?.toLowerCase().includes(busca)
      );
    }

    // Renderiza linhas
    inscricoesFiltradas.forEach((candidato) => {
      const vaga = vagasCache.find((v) => v.id === candidato.vagaId);
      const vagaNome = vaga?.titulo || vaga?.nome || "-";

      const dataInscricao = candidato.data_inscricao
        ? new Date(
            candidato.data_inscricao.toDate?.() || candidato.data_inscricao
          ).toLocaleDateString("pt-BR")
        : "-";

      const statusBadge = {
        pendente: "bg-warning",
        aprovado: "bg-success",
        reprovado: "bg-danger",
        em_analise: "bg-info",
      }[candidato.status || "pendente"];

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${candidato.nome_completo || "-"}</strong></td>
        <td>${candidato.email || "-"}</td>
        <td>${vagaNome}</td>
        <td>${dataInscricao}</td>
        <td><span class="badge ${statusBadge}">${
        candidato.status || "Pendente"
      }</span></td>
      `;
      tbody.appendChild(tr);
    });

    if (inscricoesFiltradas.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-center text-muted">Nenhuma inscrição encontrada</td></tr>';
    }
  }

  // ============================================
  // ABA: CANDIDATOS
  // ============================================

  function renderizarCandidatos() {
    console.log("👥 Renderizando candidatos...");

    const tbody = document.getElementById("rel-tbody-candidatos");
    if (!tbody) return;

    tbody.innerHTML = "";

    let candidatosFiltrados = [...candidatosCache];

    // Aplica filtros
    const vagaId = relFiltroVaga?.value || "";
    const status = relFiltroStatus?.value || "";
    const busca = relBuscaCandidato?.value?.toLowerCase() || "";

    if (vagaId) {
      candidatosFiltrados = candidatosFiltrados.filter(
        (c) => c.vagaId === vagaId
      );
    }

    if (status) {
      candidatosFiltrados = candidatosFiltrados.filter(
        (c) => c.status === status
      );
    }

    if (busca) {
      candidatosFiltrados = candidatosFiltrados.filter((c) =>
        c.nome_completo?.toLowerCase().includes(busca)
      );
    }

    // Renderiza linhas
    candidatosFiltrados.forEach((candidato) => {
      const vaga = vagasCache.find((v) => v.id === candidato.vagaId);
      const vagaNome = vaga?.titulo || vaga?.nome || "-";

      const telefone = candidato.telefone || "-";
      const experiencia = candidato.experiencia || "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${candidato.nome_completo || "-"}</strong></td>
        <td>${candidato.email || "-"}</td>
        <td>${telefone}</td>
        <td>${vagaNome}</td>
        <td>${experiencia}</td>
      `;
      tbody.appendChild(tr);
    });

    if (candidatosFiltrados.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-center text-muted">Nenhum candidato encontrado</td></tr>';
    }
  }

  // ============================================
  // ABA: RESPOSTAS AOS TESTES (CORRIGIDA)
  // ============================================

  async function renderizarRespostasAosTestes() {
    console.log("🔹 Renderizando respostas aos testes...");

    const tabelaBody = document.getElementById("rel-tbody-respostas");
    if (!tabelaBody) return;

    tabelaBody.innerHTML = "";

    tokensCache.forEach((token) => {
      if (!token.usado) return;

      const candidato = candidatosCache.find((c) => c.id === token.candidatoId);
      const teste = estudosCache.find((t) => t.id === token.testeId);

      const candidatoNome =
        candidato?.nome_completo || token.nomeCandidato || "-";
      const testeNome = teste?.titulo || teste?.nome || "-";

      const dataResposta = token.respondidoEm
        ? new Date(
            token.respondidoEm.toDate?.() || token.respondidoEm
          ).toLocaleDateString("pt-BR", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      const tempoSegundos = token.tempoRespostaSegundos || 0;
      const tempoMinutos = Math.floor(tempoSegundos / 60);
      const tempoFormatado =
        tempoMinutos > 0
          ? `${tempoMinutos}min ${tempoSegundos % 60}s`
          : `${tempoSegundos}s`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td><strong>${candidatoNome}</strong></td>
      <td>${testeNome}</td>
      <td>${dataResposta}</td>
      <td class="text-center"><span class="badge bg-info">${tempoFormatado}</span></td>
      <td><span class="badge bg-success">✅ Respondido</span></td>
      <td class="text-center">
        <button 
          class="btn btn-sm btn-primary" 
          title="Ver Respostas"
          onclick="window.abrirModalVerRespostas('${
            token.id
          }', '${candidatoNome.replace(/'/g, "\\'")}')">
          <i class="fas fa-eye me-1"></i> Ver Respostas
        </button>
      </td>
    `;
      tabelaBody.appendChild(tr);
    });

    if (tokensCache.filter((t) => t.usado).length === 0) {
      tabelaBody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">Nenhuma resposta encontrada</td></tr>';
    }
  }

  // ============================================
  // MODAL: VER RESPOSTAS DO TESTE (CORRIGIDA - BOOTSTRAP)
  // ============================================

  window.abrirModalVerRespostas = async function (tokenId, candidatoNome) {
    console.log(`🔹 Abrindo respostas do teste: ${tokenId}`);

    try {
      if (!db) {
        console.error("❌ ERRO: Firestore não inicializado!");
        window.showToast?.("Erro: Firestore não está pronto", "error");
        return;
      }

      // ✅ Busca o token
      const tokenDocRef = doc(db, "tokens_acesso", tokenId);
      const tokenSnap = await getDoc(tokenDocRef);

      if (!tokenSnap.exists()) {
        window.showToast?.("Token não encontrado", "error");
        return;
      }

      const tokenData = tokenSnap.data();
      console.log("✅ Token encontrado");

      // ✅ VALIDAÇÃO: respostas pode ser null/undefined
      const respostas = tokenData.respostas || {};

      if (Object.keys(respostas).length === 0) {
        window.showToast?.(
          "Nenhuma resposta encontrada para este teste",
          "warning"
        );
        return;
      }

      // ✅ Busca o teste
      const testeRef = doc(db, "estudos_de_caso", tokenData.testeId);
      const testeSnap = await getDoc(testeRef);
      const testeDados = testeSnap.exists() ? testeSnap.data() : {};

      console.log("✅ Teste carregado");

      // ✅ Formata informações
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
        : "-";

      // ✅ Cria HTML das perguntas
      let perguntasHTML = "";

      // ✅ VALIDAÇÃO: perguntas pode não existir
      if (
        testeDados.perguntas &&
        Array.isArray(testeDados.perguntas) &&
        testeDados.perguntas.length > 0
      ) {
        testeDados.perguntas.forEach((pergunta, index) => {
          const resposta = respostas[`resposta-${index}`] || "-";
          perguntasHTML += `
          <div class="alert alert-info">
            <p class="mb-2"><strong>Pergunta ${index + 1}:</strong> ${
            pergunta.enunciado || "Sem enunciado"
          }</p>
            <p class="mb-0"><strong>Resposta:</strong> ${resposta}</p>
          </div>
        `;
        });
      } else {
        perguntasHTML =
          '<p class="text-muted text-center">Nenhuma pergunta encontrada.</p>';
      }

      // ✅ ESCAPE CORRETO usando Bootstrap Modal
      const modalHTML = `
      <div class="modal fade" id="modal-ver-respostas" tabindex="-1">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title"><i class="fas fa-eye me-2"></i>Respostas do Teste</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="card mb-3">
                <div class="card-body">
                  <p><strong>📋 Candidato:</strong> ${candidatoNome}</p>
                  <p><strong>📝 Teste:</strong> ${
                    testeDados.titulo || "Teste"
                  }</p>
                  <p><strong>⏱️ Tempo gasto:</strong> ${tempoGasto}</p>
                  <p class="mb-0"><strong>📅 Data da resposta:</strong> ${dataResposta}</p>
                </div>
              </div>
              <h6 class="text-primary"><strong>Respostas Fornecidas:</strong></h6>
              ${perguntasHTML}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
              <button type="button" class="btn btn-primary" onclick="window.exportarRespostaIndividual('${tokenId}', '${candidatoNome.replace(
        /'/g,
        "\\'"
      )}')">
                <i class="fas fa-download me-1"></i> Exportar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

      // ✅ Remove modal anterior se existir
      const modalAntigo = document.getElementById("modal-ver-respostas");
      if (modalAntigo) {
        const bsModal = bootstrap.Modal.getInstance(modalAntigo);
        if (bsModal) bsModal.dispose();
        modalAntigo.remove();
      }

      // ✅ Adiciona modal ao DOM
      document.body.insertAdjacentHTML("beforeend", modalHTML);

      // ✅ Abre o modal com Bootstrap
      const modalElement = document.getElementById("modal-ver-respostas");
      const modal = new bootstrap.Modal(modalElement);
      modal.show();

      console.log("✅ Modal de respostas aberto");
    } catch (error) {
      console.error("❌ Erro ao abrir respostas:", error);
      window.showToast?.(`Erro: ${error.message}`, "error");
    }
  };
  // ============================================
  // EXPORTAR RESPOSTA INDIVIDUAL (CORRIGIDA)
  // ============================================

  window.exportarRespostaIndividual = async function (
    tokenDocId,
    candidatoNome
  ) {
    console.log(`🔹 Exportando resposta individual: ${tokenDocId}`);

    try {
      if (!db) {
        console.error("❌ ERRO: Firestore não inicializado!");
        return;
      }

      // ✅ Busca o token
      const tokenDocRef = doc(db, "tokens_acesso", tokenDocId);
      const tokenSnap = await getDoc(tokenDocRef);

      if (!tokenSnap.exists()) {
        window.showToast?.("Token não encontrado", "error");
        return;
      }

      const tokenData = tokenSnap.data();
      console.log("✅ Token encontrado para exportação");

      // ✅ Busca o teste
      const testeRef = doc(db, "estudos_de_caso", tokenData.testeId);
      const testeSnap = await getDoc(testeRef);
      const testeDados = testeSnap.exists() ? testeSnap.data() : {};

      console.log("✅ Teste encontrado para exportação");

      // ✅ Formata data e tempo
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
        : "-";

      // ✅ Cria objeto para Excel com TODAS as respostas
      const linhaExcel = {
        Candidato: candidatoNome,
        Teste: testeDados.titulo || "Teste",
        "Data da Resposta": dataResposta,
        "Tempo Gasto": tempoGasto,
        Status: "Respondido",
      };

      // ✅ VALIDAÇÃO: respostas pode ser null
      const respostas = tokenData.respostas || {};

      // ✅ Adiciona CADA RESPOSTA como coluna
      if (
        testeDados.perguntas &&
        Array.isArray(testeDados.perguntas) &&
        testeDados.perguntas.length > 0
      ) {
        testeDados.perguntas.forEach((pergunta, index) => {
          const resposta = respostas[`resposta-${index}`] || "-";
          linhaExcel[
            `P${index + 1}: ${pergunta.enunciado || "Sem enunciado"}`
          ] = resposta;
        });
      }

      console.log("📊 Dados completos para exportação:", linhaExcel);

      // ✅ Pergunta qual formato (usando confirm nativo do browser)
      const confirmar = confirm(
        "Exportar para:\n\n✅ OK = Excel (CSV)\n❌ Cancelar = PDF"
      );

      if (confirmar) {
        console.log("📊 Exportando para Excel...");
        // ✅ CORREÇÃO: Passa ARRAY de objetos
        exportarParaExcel(
          [linhaExcel],
          `resposta_${candidatoNome.replace(/\s+/g, "_")}.csv`
        );
        window.showToast?.("✅ Excel exportado com sucesso!", "success");
      } else {
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

  // ============================================
  // EXPORTAR PDF INDIVIDUAL (CORRIGIDA)
  // ============================================

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

      scriptJsPDF.onload = () => {
        setTimeout(() => {
          gerarPDFRespostasIndividualFinal(
            candidatoNome,
            testeDados,
            tokenData,
            dataResposta,
            tempoGasto
          );
        }, 500);
      };

      document.head.appendChild(scriptJsPDF);
    } else {
      gerarPDFRespostasIndividualFinal(
        candidatoNome,
        testeDados,
        tokenData,
        dataResposta,
        tempoGasto
      );
    }
  }

  function gerarPDFRespostasIndividualFinal(
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

      let yPosition = 15;

      // ✅ CABEÇALHO
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
      yPosition += 10;

      // Linha separadora
      doc.setDrawColor(102, 126, 234);
      doc.setLineWidth(0.5);
      doc.line(14, yPosition - 2, 196, yPosition - 2);
      yPosition += 5;

      // ✅ INFORMAÇÕES DO CANDIDATO
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);

      doc.text(`Candidato(a): ${candidatoNome}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Teste: ${testeDados.titulo || "Teste"}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Data da resposta: ${dataResposta}`, 14, yPosition);
      yPosition += 6;

      doc.text(`Tempo gasto: ${tempoGasto}`, 14, yPosition);
      yPosition += 10;

      // ✅ PERGUNTAS E RESPOSTAS
      doc.setFontSize(11);
      doc.setTextColor(102, 126, 234);
      doc.text("Respostas Fornecidas:", 14, yPosition);
      yPosition += 8;

      doc.setFontSize(9);
      doc.setTextColor(51, 51, 51);

      // ✅ VALIDAÇÃO: respostas pode ser null
      const respostas = tokenData.respostas || {};

      if (
        testeDados.perguntas &&
        Array.isArray(testeDados.perguntas) &&
        testeDados.perguntas.length > 0
      ) {
        testeDados.perguntas.forEach((pergunta, index) => {
          const resposta = respostas[`resposta-${index}`] || "-";

          // ✅ PERGUNTA
          doc.setFont(undefined, "bold");
          const perguntaText = `P${index + 1}: ${
            pergunta.enunciado || "Sem enunciado"
          }`;
          const perguntaWrapped = doc.splitTextToSize(perguntaText, 180);

          perguntaWrapped.forEach((line) => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 15;
            }
            doc.text(line, 14, yPosition);
            yPosition += 5;
          });

          // ✅ RESPOSTA
          doc.setFont(undefined, "normal");
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

      // ✅ RODAPÉ
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);

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
      }

      // ✅ SALVA O PDF
      doc.save(`resposta_${candidatoNome.replace(/\s+/g, "_")}.pdf`);
      window.showToast?.("✅ PDF exportado com sucesso!", "success");

      console.log("✅ PDF gerado com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao gerar PDF:", error);
      window.showToast?.("❌ Erro ao exportar PDF", "error");
    }
  }

  // ============================================
  // FILTROS E LISTENERS
  // ============================================

  function configurarFiltros() {
    console.log("🔧 Configurando filtros...");

    // Listener: Filtro de Vaga
    relFiltroVaga?.addEventListener("change", () => {
      renderizarAbaAtiva();
    });

    // Listener: Filtro de Status
    relFiltroStatus?.addEventListener("change", () => {
      renderizarAbaAtiva();
    });

    // Listener: Busca de Candidato
    relBuscaCandidato?.addEventListener("input", () => {
      renderizarAbaAtiva();
    });

    // Listener: Filtro de Teste
    relFiltroTeste?.addEventListener("change", () => {
      renderizarAbaAtiva();
    });

    // Listener: Botão Atualizar
    btnAtualizarRelatorios?.addEventListener("click", () => {
      carregarRelatorios();
    });

    // Listeners: Abas de Navegação
    document.querySelectorAll(".rh-relatorios-nav .nav-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".rh-relatorios-nav .nav-link")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        renderizarAbaAtiva();
      });
    });

    console.log("✅ Filtros configurados");
  }
  // ============================================
  // BOTÕES DE EXPORTAÇÃO
  // ============================================

  function configurarBotoesExportacao() {
    console.log("🔧 Configurando botões de exportação...");

    // Exportar Inscrições (Excel)
    document
      .getElementById("btn-exportar-inscricoes-excel")
      ?.addEventListener("click", () => {
        const dados = candidatosCache.map((c) => {
          const vaga = vagasCache.find((v) => v.id === c.vagaId);
          return {
            Nome: c.nome_completo || "-",
            Email: c.email || "-",
            Vaga: vaga?.titulo || vaga?.nome || "-",
            "Data Inscrição": c.data_inscricao
              ? new Date(
                  c.data_inscricao.toDate?.() || c.data_inscricao
                ).toLocaleDateString("pt-BR")
              : "-",
            Status: c.status || "Pendente",
          };
        });
        exportarParaExcel(dados, "inscricoes.csv");
      });

    // Exportar Inscrições (PDF)
    document
      .getElementById("btn-exportar-inscricoes-pdf")
      ?.addEventListener("click", () => {
        exportarParaPDF("rel-tabela-inscricoes", "inscricoes.pdf");
      });

    // Exportar Candidatos (Excel)
    document
      .getElementById("btn-exportar-candidatos-excel")
      ?.addEventListener("click", () => {
        const dados = candidatosCache.map((c) => {
          const vaga = vagasCache.find((v) => v.id === c.vagaId);
          return {
            Nome: c.nome_completo || "-",
            Email: c.email || "-",
            Telefone: c.telefone || "-",
            Vaga: vaga?.titulo || vaga?.nome || "-",
            Experiência: c.experiencia || "-",
          };
        });
        exportarParaExcel(dados, "candidatos.csv");
      });

    // Exportar Candidatos (PDF)
    document
      .getElementById("btn-exportar-candidatos-pdf")
      ?.addEventListener("click", () => {
        exportarParaPDF("rel-tabela-candidatos", "candidatos.pdf");
      });

    // Exportar Respostas (Excel)
    document
      .getElementById("btn-exportar-respostas-excel")
      ?.addEventListener("click", () => {
        const dados = tokensCache
          .filter((t) => t.usado)
          .map((token) => {
            const candidato = candidatosCache.find(
              (c) => c.id === token.candidatoId
            );
            const teste = estudosCache.find((t) => t.id === token.testeId);

            return {
              Candidato: candidato?.nome_completo || token.nomeCandidato || "-",
              Teste: teste?.titulo || teste?.nome || "-",
              "Data Resposta": token.respondidoEm
                ? new Date(
                    token.respondidoEm.toDate?.() || token.respondidoEm
                  ).toLocaleDateString("pt-BR")
                : "-",
              "Tempo Gasto": token.tempoRespostaSegundos
                ? `${Math.floor(token.tempoRespostaSegundos / 60)}min ${
                    token.tempoRespostaSegundos % 60
                  }s`
                : "-",
              Status: "Respondido",
            };
          });
        exportarParaExcel(dados, "respostas_testes.csv");
      });

    // Exportar Respostas (PDF)
    document
      .getElementById("btn-exportar-respostas-pdf")
      ?.addEventListener("click", () => {
        exportarParaPDF("rel-tabela-respostas", "respostas_testes.pdf");
      });

    console.log("✅ Botões de exportação configurados");
  }

  // ============================================
  // INICIALIZAÇÃO DO DASHBOARD
  // ============================================

  async function inicializarDashboard() {
    console.log("🚀 Inicializando Dashboard de RH...");

    try {
      // Carrega dados do dashboard
      await carregarDadosDashboard();

      // Carrega relatórios
      await carregarRelatorios();

      // Configura filtros
      configurarFiltros();

      // Configura botões de exportação
      configurarBotoesExportacao();

      console.log("✅ Dashboard de RH inicializado com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao inicializar Dashboard:", error);
      window.showToast?.(
        "Erro ao inicializar Dashboard. Tente novamente.",
        "error"
      );
    }
  }

  // ============================================
  // EXECUTA INICIALIZAÇÃO
  // ============================================

  inicializarDashboard();
}
