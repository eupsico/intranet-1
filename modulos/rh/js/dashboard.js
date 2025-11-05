// Arquivo: /modulos/rh/js/dashboard.js
// Versão: 3.4.0 (Corrigido: candidaturasCache → candidatosCache + Gráfico funcionando)

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
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
  // FUNÇÕES DE EXPORTAÇÃO
  // ============================================

  function exportarParaExcel(dados, nomeArquivo = "relatorio.xlsx") {
    console.log("📊 Exportando para Excel...", dados);

    if (!dados || dados.length === 0) {
      window.showToast?.("Nenhum dado para exportar", "warning");
      return;
    }

    // ✅ USAR CSV EM VEZ DE HTML (mais compatível)
    let csv = [];

    // Cabeçalhos
    const headers = Object.keys(dados[0]);
    csv.push(headers.map((h) => `"${h}"`).join(","));

    // Dados
    dados.forEach((linha) => {
      const row = headers.map((h) => {
        let valor = linha[h] || "";
        // Escapa aspas e quebras de linha
        valor = String(valor).replace(/"/g, '""');
        return `"${valor}"`;
      });
      csv.push(row.join(","));
    });

    const csvContent = csv.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", nomeArquivo.replace(".xlsx", ".csv"));
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.showToast?.(`✅ Arquivo ${nomeArquivo} baixado!`, "success");
  }

  function exportarParaPDF(elementId, nomeArquivo = "relatorio.pdf") {
    console.log("📄 Exportando para PDF...", elementId);

    const element = document.getElementById(elementId);
    if (!element) {
      console.error("❌ Elemento não encontrado:", elementId);
      window.showToast?.("❌ Elemento não encontrado para exportar", "error");
      return;
    }

    // Verifica se há dados na tabela
    const tabela = element.querySelector("table");
    if (tabela && tabela.querySelectorAll("tbody tr").length === 0) {
      window.showToast?.("⚠️ Nenhum dado para exportar", "warning");
      return;
    }

    if (typeof html2pdf === "undefined") {
      console.log("⚠️ Carregando biblioteca html2pdf...");
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = () => {
        setTimeout(() => {
          exportarTabelaPDF(element, nomeArquivo);
        }, 500);
      };
      script.onerror = () => {
        console.error("❌ Erro ao carregar html2pdf");
        window.showToast?.("Erro ao carregar biblioteca PDF", "error");
      };
      document.head.appendChild(script);
    } else {
      exportarTabelaPDF(element, nomeArquivo);
    }
  }

  function exportarTabelaPDF(element, nomeArquivo) {
    console.log("📄 Gerando PDF com html2pdf...");

    try {
      // ✅ CRIA CONTEÚDO HTML PURO (sem tentar carregar imagem)
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
      font-family: Arial, sans-serif;
      width: 100%;
      padding: 20px;
      background: white;
      color: #333;
    `;

      // ✅ CABEÇALHO SEM IMAGEM
      const cabecalho = document.createElement("div");
      cabecalho.style.cssText = `
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #667eea;
      padding-bottom: 20px;
    `;

      const tituloRelatorio = nomeArquivo
        .replace(".pdf", "")
        .replace(/_/g, " ")
        .toUpperCase();

      cabecalho.innerHTML = `
      <h2 style="margin: 0 0 5px 0; color: #667eea; font-size: 20px; font-weight: bold;">
        EuPsico
      </h2>
      <p style="margin: 0 0 15px 0; color: #666; font-size: 12px; font-weight: normal;">
        Grupo de atendimento multidisciplinar
      </p>
      <h3 style="margin: 10px 0; color: #333; font-size: 16px; font-weight: bold;">
        ${tituloRelatorio}
      </h3>
      <p style="margin: 5px 0; color: #999; font-size: 11px;">
        Data: ${new Date().toLocaleDateString(
          "pt-BR"
        )} | Hora: ${new Date().toLocaleTimeString("pt-BR")}
      </p>
    `;

      wrapper.appendChild(cabecalho);

      // ✅ CONTEÚDO AJUSTADO
      const conteudo = document.createElement("div");
      conteudo.style.cssText = `
      width: 100%;
      overflow: visible;
    `;

      // ✅ CLONE E COPIA TODO O CONTEÚDO
      const elementClone = element.cloneNode(true);

      // Remove elementos desnecessários
      elementClone
        .querySelectorAll("button, input, select, .form-control, .btn")
        .forEach((el) => {
          el.style.display = "none";
        });

      // ✅ FORMATA TABELAS
      elementClone.querySelectorAll("table").forEach((table) => {
        table.style.cssText = `
        width: 100% !important;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 10px;
        table-layout: fixed;
      `;

        table.querySelectorAll("thead").forEach((thead) => {
          thead.style.backgroundColor = "#667eea";
          thead.style.color = "white";
        });

        table.querySelectorAll("th").forEach((th) => {
          th.style.cssText = `
          background-color: #667eea !important;
          color: white !important;
          padding: 8px !important;
          text-align: left;
          border: 1px solid #667eea;
          font-weight: bold;
          word-wrap: break-word;
        `;
        });

        table.querySelectorAll("td").forEach((td) => {
          td.style.cssText = `
          padding: 6px !important;
          border: 1px solid #ddd;
          word-wrap: break-word;
          word-break: break-word;
          overflow-wrap: break-word;
        `;
        });

        table.querySelectorAll("tbody tr:nth-child(even)").forEach((tr) => {
          tr.style.backgroundColor = "#f9f9f9";
        });

        table.querySelectorAll("tbody tr:nth-child(odd)").forEach((tr) => {
          tr.style.backgroundColor = "#ffffff";
        });
      });

      conteudo.appendChild(elementClone);
      wrapper.appendChild(conteudo);

      // ✅ RODAPÉ
      const rodape = document.createElement("div");
      rodape.style.cssText = `
      text-align: center;
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #999;
    `;
      rodape.innerHTML = `
      <p style="margin: 0;">Relatório gerado automaticamente pelo sistema EuPsico</p>
      <p style="margin: 5px 0 0 0;">Todos os direitos reservados &copy; 2025</p>
    `;
      wrapper.appendChild(rodape);

      // ✅ OPÇÕES DO HTML2PDF
      const opt = {
        margin: [15, 10, 15, 10],
        filename: nomeArquivo,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          backgroundColor: "#ffffff",
          logging: false,
          useCORS: true,
          allowTaint: true,
          willReadFrequently: true,
        },
        jsPDF: {
          orientation: "landscape",
          unit: "mm",
          format: "a4",
        },
      };

      console.log("✅ Iniciando geração do PDF...");

      // ✅ GERA O PDF
      html2pdf()
        .set(opt)
        .from(wrapper)
        .save()
        .then(() => {
          console.log("✅ PDF gerado com sucesso!");
          window.showToast?.(`✅ Arquivo ${nomeArquivo} baixado!`, "success");
        })
        .catch((error) => {
          console.error("❌ Erro ao gerar PDF:", error);
          window.showToast?.("❌ Erro ao gerar PDF. Tente novamente.", "error");
        });
    } catch (error) {
      console.error("❌ Erro crítico ao gerar PDF:", error);
      window.showToast?.("❌ Erro ao gerar PDF. Tente novamente.", "error");
    }
  }

  window.exportarInscricoesExcel = function () {
    const tabelaBody = document.getElementById("rel-tbody-inscricoes");
    const dados = [];

    tabelaBody.querySelectorAll("tr").forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      if (cells.length > 0) {
        dados.push({
          Vaga: cells[0].textContent.trim(),
          "Total de Inscritos": cells[1].textContent.trim().replace(/\D/g, ""),
          "Em Triagem": cells[2].textContent.trim().replace(/\D/g, ""),
          Aprovados: cells[3].textContent.trim().replace(/\D/g, ""),
          Rejeitados: cells[4].textContent.trim().replace(/\D/g, ""),
          Contratados: cells[5].textContent.trim().replace(/\D/g, ""),
        });
      }
    });

    exportarParaExcel(dados, "inscrições_por_vaga.xlsx");
  };

  window.exportarInscricoesPDF = function () {
    exportarParaPDF("rel-tabela-inscricoes", "inscrições_por_vaga.pdf");
  };

  window.exportarCandidatosExcel = function () {
    const tabelaBody = document.getElementById("rel-tbody-candidatos");
    const dados = [];

    tabelaBody.querySelectorAll("tr").forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      if (cells.length >= 7) {
        dados.push({
          Nome: cells[0].textContent.trim(),
          Email: cells[1].textContent.trim(),
          Telefone: cells[2].textContent.trim(),
          Vaga: cells[3].textContent.trim(),
          Status: cells[4].textContent.trim(),
          Teste: cells[5].textContent.trim(),
        });
      }
    });

    exportarParaExcel(dados, "candidatos.xlsx");
  };

  window.exportarCandidatosPDF = function () {
    exportarParaPDF("rel-tabela-candidatos", "candidatos.pdf");
  };

  window.exportarRespostasExcel = function () {
    const tabelaBody = document.getElementById("rel-tbody-respostas");
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

    exportarParaExcel(dados, "respostas_testes.xlsx");
  };

  window.exportarRespostasPDF = function () {
    exportarParaPDF("rel-tabela-respostas", "respostas_testes.pdf");
  };

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

        // ✅ CARREGA AUTOMATICAMENTE AO ABRIR ABA DE RELATÓRIOS
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

      // ✅ BUSCA DIRETAMENTE COM collection() E getDocs()
      const candidatosRef = collection(db, "candidaturas");
      const tokensRef = collection(db, "tokens_acesso");
      const vagasRef = collection(db, "vagas");
      const estudosRef = collection(db, "estudos_de_caso");

      const [candidatosSnap, tokensSnap, vagasSnap, estudosSnap] =
        await Promise.all([
          getDocs(candidatosRef),
          getDocs(tokensRef),
          getDocs(vagasRef),
          getDocs(estudosRef),
        ]);

      // ✅ PROCESSA CANDIDATOS
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

      console.log(`📊 ✅ Candidatos total: ${candidatosCache.length}`);
      console.log(`📊 ✅ Tokens: ${tokensCache.length}`);
      console.log(`📊 ✅ Vagas: ${vagasCache.length}`);
      console.log(`📊 ✅ Estudos: ${estudosCache.length}`);

      const totalInscritos = candidatosCache.length;
      const testesRespondidos = tokensCache.filter((t) => t.usado).length;
      const testesPendentes = tokensCache.filter((t) => !t.usado).length;
      const taxaResposta =
        totalInscritos > 0
          ? Math.round((testesRespondidos / totalInscritos) * 100)
          : 0;

      if (relTotalInscricoes) relTotalInscricoes.textContent = totalInscritos;
      if (relTestesRespondidos)
        relTestesRespondidos.textContent = testesRespondidos;
      if (relTestesPendentes) relTestesPendentes.textContent = testesPendentes;
      if (relTaxaResposta) relTaxaResposta.textContent = `${taxaResposta}%`;

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
  // FUNÇÃO: Popular Filtros
  // ============================================

  async function popularFiltros() {
    console.log("🔹 Populando filtros...");

    if (relFiltroVaga) {
      relFiltroVaga.innerHTML = '<option value="">Todas as vagas</option>';
      vagasCache.forEach((vaga) => {
        const option = document.createElement("option");
        option.value = vaga.id;
        const nomeDaVaga =
          vaga.titulo ||
          vaga.tituloVaga ||
          vaga.nome ||
          `Vaga ${vaga.id.substring(0, 8)}`;
        option.textContent = nomeDaVaga;
        relFiltroVaga.appendChild(option);
      });
    }

    if (relFiltroTeste) {
      relFiltroTeste.innerHTML = '<option value="">Todos os testes</option>';
      estudosCache.forEach((teste) => {
        const option = document.createElement("option");
        option.value = teste.id;
        option.textContent =
          teste.titulo || teste.nome || `Teste ${teste.id.substring(0, 8)}`;
        relFiltroTeste.appendChild(option);
      });
    }
  }

  // ============================================
  // FUNÇÃO: Criar Gráfico de Inscrições
  // ============================================

  async function criarGraficoInscricoes() {
    const ctx = document.getElementById("rel-chart-inscricoes");
    if (!ctx) {
      console.error("❌ Canvas rel-chart-inscricoes não encontrado");
      return;
    }

    // ✅ VERIFICA SE O CHART ESTÁ DISPONÍVEL
    if (typeof Chart === "undefined") {
      console.error("❌ Chart.js não foi importado!");
      return;
    }

    const inscricoesPorVaga = {};

    // ✅ CORRIGIDO: candidatosCache em vez de candidaturasCache
    candidatosCache.forEach((cand) => {
      const vagaId = cand.vaga_id || "Sem vaga";
      inscricoesPorVaga[vagaId] = (inscricoesPorVaga[vagaId] || 0) + 1;
    });

    const vagasNomes = Object.keys(inscricoesPorVaga).map((vagaId) => {
      const vaga = vagasCache.find((v) => v.id === vagaId);
      return vaga?.titulo || vaga?.nome || vagaId.substring(0, 8);
    });

    const dados = Object.values(inscricoesPorVaga);

    console.log("📊 Criando gráfico com dados:", vagasNomes, dados);

    // ✅ DESTROI O GRÁFICO ANTERIOR SE EXISTIR
    if (window.graficoInscricoes) {
      window.graficoInscricoes.destroy();
    }

    // ✅ CRIA NOVO GRÁFICO
    window.graficoInscricoes = new Chart(ctx, {
      type: "bar",
      data: {
        labels: vagasNomes,
        datasets: [
          {
            label: "Total de Inscrições",
            data: dados,
            backgroundColor: "#667eea",
            borderColor: "#5568d3",
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
            ticks: {
              stepSize: 1,
            },
          },
        },
        plugins: {
          legend: {
            display: true,
          },
        },
      },
    });
  }

  // ============================================
  // FUNÇÃO: Renderizar Inscrições por Vaga
  // ============================================

  async function renderizarInscricoesPorVaga() {
    console.log("🔹 Renderizando inscrições por vaga...");

    const tabelaBody = document.getElementById("rel-tbody-inscricoes");
    if (!tabelaBody) {
      console.error("❌ Elemento rel-tbody-inscricoes não encontrado");
      return;
    }

    tabelaBody.innerHTML = "";

    const inscricoesPorVaga = {};

    candidatosCache.forEach((cand) => {
      const vagaId = cand.vaga_id || "Sem vaga";

      if (!inscricoesPorVaga[vagaId]) {
        inscricoesPorVaga[vagaId] = {
          total: 0,
          triagem: 0,
          aprovados: 0,
          rejeitados: 0,
          contratados: 0,
        };
      }

      inscricoesPorVaga[vagaId].total++;

      const status = cand.status_recrutamento || "Candidatura Recebida";

      if (
        status.includes("Triagem") ||
        status === "Candidatura Recebida" ||
        status.includes("recebida")
      ) {
        inscricoesPorVaga[vagaId].triagem++;
      } else if (
        status.includes("Aprovada") ||
        status.includes("Entrevista Pendente")
      ) {
        inscricoesPorVaga[vagaId].aprovados++;
      } else if (status.includes("Rejeitado") || status.includes("rejeicao")) {
        inscricoesPorVaga[vagaId].rejeitados++;
      } else if (status.includes("Contratado")) {
        inscricoesPorVaga[vagaId].contratados++;
      }
    });

    Object.entries(inscricoesPorVaga).forEach(([vagaId, dados]) => {
      const vaga = vagasCache.find((v) => v.id === vagaId);
      const vagaNome =
        vaga?.titulo ||
        vaga?.tituloVaga ||
        vaga?.nome ||
        `Vaga ${vagaId.substring(0, 8)}`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${vagaNome}</strong></td>
        <td class="text-center"><span class="badge bg-primary">${dados.total}</span></td>
        <td class="text-center"><span class="badge bg-info">${dados.triagem}</span></td>
        <td class="text-center"><span class="badge bg-success">${dados.aprovados}</span></td>
        <td class="text-center"><span class="badge bg-danger">${dados.rejeitados}</span></td>
        <td class="text-center"><span class="badge bg-warning text-dark">${dados.contratados}</span></td>
      `;
      tabelaBody.appendChild(tr);
    });

    if (Object.keys(inscricoesPorVaga).length === 0) {
      tabelaBody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">Nenhuma inscrição encontrada</td></tr>';
    }

    // ✅ CRIA O GRÁFICO APÓS RENDERIZAR A TABELA
    await criarGraficoInscricoes();
  }

  // ============================================
  // FUNÇÃO: Renderizar Lista de Candidatos
  // ============================================

  async function renderizarListaCandidatos() {
    console.log("🔹 Renderizando lista de candidatos...");

    const tabelaBody = document.getElementById("rel-tbody-candidatos");
    if (!tabelaBody) return;

    atualizarTabelaCandidatos(candidatosCache, tabelaBody);
  }

  function atualizarTabelaCandidatos(candidatos, tabelaBody) {
    console.log(`🔹 Atualizando tabela com ${candidatos.length} candidatos`);

    tabelaBody.innerHTML = "";

    if (candidatos.length === 0) {
      tabelaBody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">Nenhum candidato encontrado</td></tr>';
      return;
    }

    candidatos.forEach((cand) => {
      const vaga = vagasCache.find((v) => v.id === cand.vaga_id);
      const vagaNome = vaga?.titulo || vaga?.tituloVaga || "-";

      const testeEnviado = tokensCache.some((t) => t.candidatoId === cand.id);
      const testeRespondido = tokensCache.some(
        (t) => t.candidatoId === cand.id && t.usado
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
        <td><strong>${cand.nome_completo || "-"}</strong></td>
        <td>${cand.email_candidato || "-"}</td>
        <td>${cand.telefone_contato || "-"}</td>
        <td>${vagaNome}</td>
        <td><span class="badge bg-info">${
          cand.status_recrutamento || "Pendente"
        }</span></td>
        <td>${statusTeste}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-primary" onclick="alert('Ver detalhes de: ${
            cand.nome_completo
          }')">
            <i class="fas fa-eye"></i>
          </button>
        </td>
      `;
      tabelaBody.appendChild(tr);
    });
  }

  function filtrarCandidatos(e) {
    const termo = e.target.value.toLowerCase();
    const candidatosFiltrados = candidatosCache.filter((c) =>
      (c.nome_completo || "").toLowerCase().includes(termo)
    );

    const tabelaBody = document.getElementById("rel-tbody-candidatos");
    atualizarTabelaCandidatos(candidatosFiltrados, tabelaBody);
  }

  // ============================================
  // FUNÇÃO: Renderizar Respostas aos Testes
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

      const candidatoNome = candidato?.nome_completo || "-";
      const testeNome = teste?.titulo || teste?.nome || "-";

      const dataResposta = token.respondidoEm
        ? new Date(
            token.respondidoEm.toDate?.() || token.respondidoEm
          ).toLocaleDateString("pt-BR")
        : "-";

      const tempoSegundos = token.tempoRespostaSegundos || 0;
      const tempoMinutos = Math.floor(tempoSegundos / 60);
      const tempoFormatado =
        tempoMinutos > 0 ? `${tempoMinutos}min` : `${tempoSegundos}s`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${candidatoNome}</strong></td>
        <td>${testeNome}</td>
        <td>${dataResposta}</td>
        <td class="text-center"><span class="badge bg-info">${tempoFormatado}</span></td>
        <td><span class="badge bg-success">✅ Respondido</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-primary" onclick="alert('Ver respostas de: ${candidatoNome}')">
            <i class="fas fa-eye"></i>
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
  // FUNÇÃO ORIGINAL: Busca de dados do Dashboard
  // ============================================

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

    const funcoesLabels = Object.keys(funcoesMap);
    const funcoesData = funcoesLabels.map((label) => funcoesMap[label]);

    const profissaoLabels = Object.keys(profissaoMap);
    const profissaoData = profissaoLabels.map((label) => profissaoMap[label]);

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
  }

  // ============================================
  // INICIALIZAÇÃO
  // ============================================

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
