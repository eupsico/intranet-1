// Arquivo: /modulos/rh/js/dashboard.js

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

  // Mapeamento dos elementos do DOM
  const metricAtivos = document.getElementById("rh-metric-ativos");
  const metricVagas = document.getElementById("rh-metric-vagas");
  const metricOnboarding = document.getElementById("rh-metric-onboarding");
  const metricComunicados = document.getElementById("rh-metric-comunicados");
  const funcoesChartCtx = document
    .getElementById("rh-funcoes-chart")
    ?.getContext("2d");
  const desligamentoChartCtx = document
    .getElementById("rh-desligamento-chart")
    ?.getContext("2d");

  // Função de busca de dados simulada.
  // IMPORTANTE: Em produção, você deve implementar aqui as consultas reais ao Firebase Firestore.
  async function fetchRHDashboardData() {
    // Exemplo de como você faria uma consulta real (descomente e adapte):
    /*
    const ativosSnapshot = await db.collection('usuarios').where('status_rh', '==', 'ativo').get();
    const ativosCount = ativosSnapshot.size;
    
    // ... e assim por diante para todas as métricas ...
    */

    // Dados de exemplo (Mock para demonstração da estrutura)
    return {
      ativos: 145,
      vagas: 5,
      onboarding: 12,
      comunicados: 8,
      funcoesData: {
        labels: [
          "Psicólogo Voluntário",
          "Psicólogo Plantonista",
          "Supervisor",
          "Admin/RH",
        ],
        data: [110, 20, 10, 5],
      },
      desligamentoData: {
        labels: [
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
        ],
        data: [2, 1, 0, 3, 1, 0, 1, 2, 0, 0, 1, 0],
      },
    };
  }

  try {
    const data = await fetchRHDashboardData();

    // 1. Popular Métricas nos Cards
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
              backgroundColor: ["#4e73df", "#1cc88a", "#36b9cc", "#f6c23e"], // Cores de exemplo
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

    // 3. Renderizar Gráfico de Desligamentos (Barra)
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
              precision: 0, // Garante números inteiros no eixo Y
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
      "<h2>Erro de Carregamento</h2><p>Não foi possível carregar as métricas do dashboard devido a um erro de conexão ou processamento de dados.</p>";
  }
}
