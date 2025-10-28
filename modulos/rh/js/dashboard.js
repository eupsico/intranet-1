// Arquivo: /modulos/rh/js/dashboard.js
// Versão: 2.6 (Adição de Gráfico de Distribuição por Profissão)

// Importa funções do Firebase necessárias
import {
  collection,
  query,
  where,
  getDocs,
} from "../../../assets/js/firebase-init.js";

// A função initdashboard é a função de inicialização do módulo, chamada pelo rh-painel.js
export async function initdashboard(user, userData) {
  console.log("📈 Iniciando Dashboard de RH...");

  // A instância do Firestore (db) é definida em window.db pelo rh-painel.js
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
  const desligamentosCollection = collection(db, "desligamentos"); // Coleção adicionada

  // Mapeamento dos elementos do DOM
  const metricAtivos = document.getElementById("rh-metric-ativos");
  const metricVagas = document.getElementById("rh-metric-vagas");
  const metricOnboarding = document.getElementById("rh-metric-onboarding");
  const metricComunicados = document.getElementById("rh-metric-comunicados");
  const funcoesChartCtx = document
    .getElementById("rh-funcoes-chart")
    ?.getContext("2d");
  const rhProfissaoChartCtx = document
    .getElementById("rh-profissao-chart")
    ?.getContext("2d"); // NOVO: Mapeamento do canvas de Profissão
  const desligamentoChartCtx = document
    .getElementById("rh-desligamento-chart")
    ?.getContext("2d");

  // Função de busca de dados reais (substitui o mock)
  async function fetchRHDashboardData() {
    // --- Consultas para KPIs (contagens) ---

    // 1. Profissionais Ativos (inativo == false)
    const ativosQuery = query(
      usuariosCollection,
      where("inativo", "==", false)
    );

    // 2. Vagas em Aberto (aguardando-aprovacao ou em-divulgacao)
    const vagasQuery = query(
      vagasCollection,
      where("status", "in", ["aguardando-aprovacao", "em-divulgacao"])
    );

    // 3. Colaboradores em Onboarding (pendente-docs, em-integracao ou acompanhamento)
    const onboardingQuery = query(
      onboardingCollection,
      where("faseAtual", "in", [
        "pendente-docs",
        "em-integracao",
        "acompanhamento",
      ])
    );

    // 4. Comunicações Recentes (Total de comunicados)
    const comunicadosQuery = query(comunicadosCollection);

    // --- Consultas para Gráficos (Agregação) ---

    // 5. Distribuição de Funções e Profissões: Buscar todos os usuários ativos
    const todosUsuariosQuery = query(
      usuariosCollection,
      where("inativo", "==", false)
    );

    // 6. Desligamentos: Buscar desligamentos do último ano (últimos 12 meses)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const desligamentosQuery = query(
      desligamentosCollection,
      // Filtra por dataEfetiva a partir de um ano atrás (Timestamp do Firebase)
      where("dataEfetiva", ">=", oneYearAgo)
    );

    // Executa todas as consultas em paralelo (melhor performance)
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

    // --- Lógica de Agregação de Dados para os Gráficos ---

    // 1. Distribuição de Funções (Gráfico de Rosca)
    const funcoesMap = {};
    const profissaoMap = {}; // NOVO: Mapa para Profissões

    todosUsuariosSnap.forEach((doc) => {
      const user = doc.data();
      const funcoes = user.funcoes || []; // Array de funções
      const profissao = user.profissao || "Não Informado";

      // CORREÇÃO: Itera sobre TODAS as funções do usuário para a contagem.
      // Isso garante que gestores com múltiplas funções sejam contabilizados.
      funcoes.forEach((role) => {
        // Mapeamento para nomes de exibição amigáveis (incluindo 'gestor')
        const displayRole =
          {
            psicologo_voluntario: "Psicólogo Voluntário",
            psicologo_plantonista: "Psicólogo Plantonista",
            supervisor: "Supervisor",
            admin: "Admin",
            rh: "RH",
            gestor: "Gestor", // Certifica que 'gestor' tem um nome de exibição
          }[role] ||
          role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");

        funcoesMap[displayRole] = (funcoesMap[displayRole] || 0) + 1;
      });

      // Agregação por PROFISSÃO (permanece igual)
      const displayProfissao =
        profissao.charAt(0).toUpperCase() + profissao.slice(1);
      profissaoMap[displayProfissao] =
        (profissaoMap[displayProfissao] || 0) + 1;
    });

    // Dados para o Gráfico de Funções
    const funcoesLabels = Object.keys(funcoesMap);
    const funcoesData = funcoesLabels.map((label) => funcoesMap[label]);

    // Dados para o Gráfico de Profissões
    const profissaoLabels = Object.keys(profissaoMap);
    const profissaoData = profissaoLabels.map((label) => profissaoMap[label]);

    // 2. Métricas de Desligamento (Gráfico de Barras - Últimos 12 meses)
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

    // Inicializa o mapa com os últimos 12 meses
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const yearMonthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
      monthlyDataMap[yearMonthKey] = 0;
      labels.push(
        `${monthNames[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`
      );
    }

    // Processa os dados do Firebase
    desligamentosSnap.forEach((doc) => {
      const desligamento = doc.data();
      let effectiveDate;

      // Converte o Timestamp do Firebase para Date (se for um objeto Timestamp)
      if (
        desligamento.dataEfetiva &&
        typeof desligamento.dataEfetiva.toDate === "function"
      ) {
        effectiveDate = desligamento.dataEfetiva.toDate();
      } else if (desligamento.dataEfetiva instanceof Date) {
        effectiveDate = desligamento.dataEfetiva;
      } else {
        return; // Ignora registros sem data válida
      }

      const yearMonthKey = `${effectiveDate.getFullYear()}-${
        effectiveDate.getMonth() + 1
      }`;

      // Incrementa a contagem se o mês estiver no intervalo dos últimos 12 meses
      if (monthlyDataMap.hasOwnProperty(yearMonthKey)) {
        monthlyDataMap[yearMonthKey]++;
      }
    });

    const desligamentoData = labels.map((label) => {
      const [monthName, yearShort] = label.split("/");
      const monthIndex = monthNames.findIndex((name) => name === monthName);
      // Garante que o ano seja '20YY'
      const year = parseInt(
        yearShort.length === 2 ? `20${yearShort}` : yearShort
      );
      const yearMonthKey = `${year}-${monthIndex + 1}`;
      return monthlyDataMap[yearMonthKey] || 0;
    });

    // ----------------------------------------

    return {
      // Retorna os tamanhos das contagens (KPIs)
      ativos: ativosSnap.size,
      vagas: vagasSnap.size,
      onboarding: onboardingSnap.size,
      comunicados: comunicadosSnap.size,

      // Retorna os dados agregados para os gráficos
      funcoesData: {
        labels: funcoesLabels,
        data: funcoesData,
      },
      profissaoData: {
        // NOVO: Retorna dados de profissão
        labels: profissaoLabels,
        data: profissaoData,
      },
      desligamentoData: {
        labels: labels, // Rótulos dos últimos 12 meses
        data: desligamentoData, // Dados agregados por mês
      },
    };
  }

  try {
    const data = await fetchRHDashboardData();

    // 1. Popular Métricas nos Cards (KPIs)
    if (metricAtivos) metricAtivos.textContent = data.ativos;
    if (metricVagas) metricVagas.textContent = data.vagas;
    if (metricOnboarding) metricOnboarding.textContent = data.onboarding;
    if (metricComunicados) metricComunicados.textContent = data.comunicados;

    // 2. Renderizar Gráfico de Distribuição de Funções (Doughnut)
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
              ], // Cores de exemplo
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

    // 3. Renderizar Gráfico de Distribuição por Profissão (Barra Horizontal)
    if (rhProfissaoChartCtx) {
      new Chart(rhProfissaoChartCtx, {
        type: "bar",
        data: {
          labels: data.profissaoData.labels,
          datasets: [
            {
              label: "Profissionais Ativos",
              data: data.profissaoData.data,
              backgroundColor: "#1d70b7", // Cor Secundária
              borderColor: "#04396d",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "y", // NOVO: Define o eixo Y como índice (barra horizontal)
          scales: {
            x: {
              beginAtZero: true,
              precision: 0, // Garante números inteiros no eixo X
            },
            y: {
              // Não mostrar o título do eixo Y para simplificar
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            title: {
              display: false,
            },
          },
        },
      });
    }

    // 4. Renderizar Gráfico de Desligamentos (Barra)
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
  } catch (error) {
    console.error("Erro ao carregar dados do Dashboard RH:", error);
    // Exibe mensagem de erro na área de conteúdo
    document.getElementById("content-area").innerHTML =
      "<h2>Erro de Carregamento</h2><p>Não foi possível carregar as métricas do dashboard. Verifique as Regras de Segurança do Firebase e o campo **inativo** na coleção **usuarios**.</p>";
  }
}
