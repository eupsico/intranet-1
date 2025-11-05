// Arquivo: /modulos/rh/js/dashboard.js
// Versão: 3.1.0 (Com Exportação PDF/Excel)

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

  // Definição das referências de coleção
  const usuariosCollection = collection(db, "usuarios");
  const vagasCollection = collection(db, "vagas");
  const onboardingCollection = collection(db, "onboarding");
  const comunicadosCollection = collection(db, "comunicados");
  const desligamentosCollection = collection(db, "desligamentos");
  const candidatosCollection = collection(db, "candidatos");
  const tokensAcessoCollection = collection(db, "tokens_acesso");
  const estudosDeCasoCollection = collection(db, "estudos_de_caso");

  // Mapeamento dos elementos do DOM - DASHBOARD
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

  // ✅ NOVOS: Elementos do DOM - RELATÓRIOS
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

  // Estado global dos relatórios
  let candidatosCache = [];
  let tokensCache = [];
  let vagasCache = [];
  let estudosCache = [];

  // ============================================
  // ✅ FUNÇÕES DE EXPORTAÇÃO
  // ============================================

  // Função auxiliar: Converter data para string
  function formatarData(data) {
    if (!data) return "-";
    const d = data.toDate ? data.toDate() : new Date(data);
    return d.toLocaleDateString("pt-BR");
  }

  // ✅ EXPORTAR PARA EXCEL
  function exportarParaExcel(dados, nomeArquivo = "relatorio.xlsx") {
    console.log("📊 Exportando para Excel...");

    // Cria um workbook (usando uma biblioteca simples)
    let html = '<table border="1"><tr>';

    // Cabeçalhos
    if (dados.length > 0) {
      Object.keys(dados[0]).forEach((chave) => {
        html += `<th>${chave}</th>`;
      });
      html += "</tr>";

      // Dados
      dados.forEach((linha) => {
        html += "<tr>";
        Object.values(linha).forEach((valor) => {
          html += `<td>${valor}</td>`;
        });
        html += "</tr>";
      });
    }

    html += "</table>";

    // Cria blob e download
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    window.showToast?.(
      `✅ Arquivo ${nomeArquivo} baixado com sucesso!`,
      "success"
    );
  }

  // ✅ EXPORTAR PARA PDF (usando html2pdf se disponível)
  function exportarParaPDF(tabela, nomeArquivo = "relatorio.pdf") {
    console.log("📄 Exportando para PDF...");

    // Verifica se html2pdf está disponível
    if (typeof html2pdf === "undefined") {
      window.showToast?.(
        "⚠️ Biblioteca html2pdf não carregada. Instalando...",
        "warning"
      );

      // Carrega dinamicamente
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = () => {
        exportarTabelaPDF(tabela, nomeArquivo);
      };
      document.head.appendChild(script);
    } else {
      exportarTabelaPDF(tabela, nomeArquivo);
    }
  }

  function exportarTabelaPDF(tabela, nomeArquivo) {
    const element = document.getElementById(tabela);
    if (!element) {
      window.showToast?.("❌ Elemento não encontrado para exportar", "error");
      return;
    }

    const opt = {
      margin: 10,
      filename: nomeArquivo,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: "landscape", unit: "mm", format: "a4" },
    };

    html2pdf().set(opt).from(element).save();
    window.showToast?.(
      `✅ Arquivo ${nomeArquivo} gerado com sucesso!`,
      "success"
    );
  }

  // Expõe as funções globalmente
  window.exportarParaExcel = exportarParaExcel;
  window.exportarParaPDF = exportarParaPDF;

  // ============================================
  // FUNÇÃO: Listeners de Abas
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
  // ✅ FUNÇÃO: Popular Filtros (CORRIGIDA)
  // ============================================

  async function popularFiltros() {
    console.log("🔹 Populando filtros...");

    // Filtro de vagas - ✅ AGORA MOSTRA O TÍTULO CORRETO
    if (relFiltroVaga) {
      relFiltroVaga.innerHTML = '<option value="">Todas as vagas</option>';
      vagasCache.forEach((vaga) => {
        const option = document.createElement("option");
        option.value = vaga.id;
        // ✅ PRIORIZA 'titulo', depois 'tituloVaga', depois ID
        const nomeDaVaga =
          vaga.titulo ||
          vaga.tituloVaga ||
          vaga.nome ||
          `Vaga ${vaga.id.substring(0, 8)}`;
        option.textContent = nomeDaVaga;
        relFiltroVaga.appendChild(option);
        console.log(`✅ Vaga adicionada: ${nomeDaVaga}`);
      });
    }

    // Filtro de testes
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
  // FUNÇÃO: Renderizar Inscrições por Vaga
  // ============================================

  async function renderizarInscricoesPorVaga() {
    console.log("🔹 Renderizando inscrições por vaga...");

    const tabelaBody = document.getElementById("rel-tbody-inscricoes");
    if (!tabelaBody) return;

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

      const status = cand.status_recrutamento || "";
      if (status.includes("Triagem") || status === "Candidatura Recebida") {
        inscricoesPorVaga[vagaId].triagem++;
      } else if (status.includes("Aprovada")) {
        inscricoesPorVaga[vagaId].aprovados++;
      } else if (status.includes("Rejeitado")) {
        inscricoesPorVaga[vagaId].rejeitados++;
      } else if (status.includes("Contratado")) {
        inscricoesPorVaga[vagaId].contratados++;
      }
    });

    Object.entries(inscricoesPorVaga).forEach(([vagaId, dados]) => {
      const vaga = vagasCache.find((v) => v.id === vagaId);
      // ✅ CORRIGIDA: Busca o título correto
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
    tabelaBody.innerHTML = "";

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
          cand.status_recrutamento || "-"
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

    if (candidatos.length === 0) {
      tabelaBody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">Nenhum candidato encontrado</td></tr>';
    }
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
  }
}
