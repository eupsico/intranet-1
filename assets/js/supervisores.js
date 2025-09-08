const firebaseConfig = {
    apiKey: "AIzaSyDJqPJjDDIGo7uRewh3pw1SQZOpMgQJs5M",
    authDomain: "eupsico-agendamentos-d2048.firebaseapp.com",
    databaseURL: "https://eupsico-agendamentos-d2048-default-rtdb.firebaseio.com",
    projectId: "eupsico-agendamentos-d2048",
    storageBucket: "eupsico-agendamentos-d2048.firebasestorage.app",
    messagingSenderId: "1041518416343",
    appId: "1:1041518416343:web:0a11c03c205b802ed7bb92"
};
let auth;
let db;

document.addEventListener('DOMContentLoaded', function() {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    auth = firebase.auth();
    db = firebase.firestore();
    
    const viewContentArea = document.getElementById('view-content-area');
    const dashboardContent = document.getElementById('supervisor-dashboard-content');
    const supervisorCardsGrid = document.getElementById('supervisor-cards-grid');

    if (!viewContentArea || !dashboardContent || !supervisorCardsGrid) {
        console.error("Erro crítico: Um ou mais elementos essenciais do HTML não foram encontrados.");
        return;
    }

    window.showSupervisorDashboard = function() {
        viewContentArea.style.display = 'none';
        viewContentArea.innerHTML = '';
        dashboardContent.style.display = 'block';
    };

    window.loadFormularioView = async function(docId) {
        dashboardContent.style.display = 'none';
        viewContentArea.style.display = 'block';
        viewContentArea.innerHTML = '<div class="loading-spinner"></div>';

        try {
            const response = await fetch('./formulario-supervisao.html');
            if (!response.ok) throw new Error('Falha ao carregar o HTML do formulário');
            viewContentArea.innerHTML = await response.text();
            
            document.getElementById('form-view-back-button').addEventListener('click', () => loadView('meus_supervisionados'));

            if (!document.querySelector(`link[data-view-style="formulario-supervisao"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = '../assets/css/formulario-supervisao.css';
                link.dataset.viewStyle = 'formulario-supervisao';
                document.head.appendChild(link);
            }
            
            window.formSupervisaoInitialDocId = docId;

            const script = document.createElement('script');
            script.src = '../assets/js/formulario-supervisao.js';
            script.dataset.viewScript = 'formulario-supervisao';
            document.body.appendChild(script);

        } catch (error) {
            console.error("Erro ao carregar view do formulário:", error);
            viewContentArea.innerHTML = `<h2>Erro ao carregar.</h2><button onclick="showSupervisorDashboard()">Voltar</button>`;
        }
    };

    async function loadView(viewName) {
        dashboardContent.style.display = 'none';
        viewContentArea.style.display = 'block';
        viewContentArea.innerHTML = '<div class="loading-spinner"></div>';

        // --- MUDANÇA 1: Adicionado o mapeamento para a nova tela de agendamentos ---
        const fileMap = {
            'meu_perfil': { html: './view-meu-perfil.html', js: '../assets/js/view-meu-perfil.js' },
            'meus_supervisionados': { html: './view-meus-supervisionados.html', js: '../assets/js/view-meus-supervisionados.js' },
            'meus_agendamentos': { html: './view-meus-agendamentos.html', js: '../assets/js/view-meus-agendamentos.js' }
        };
        const files = fileMap[viewName];

        try {
            const response = await fetch(files.html);
            viewContentArea.innerHTML = await response.text();

            const backButton = document.getElementById('view-back-button');
            if (backButton) {
                backButton.addEventListener('click', window.showSupervisorDashboard);
            }

            const existingScript = document.querySelector(`script[data-view-script="${viewName}"]`);
            if (existingScript) existingScript.remove();

            const script = document.createElement('script');
            script.src = files.js;
            script.dataset.viewScript = viewName;
            document.body.appendChild(script);
        } catch (error) {
            console.error("Erro ao carregar view:", error);
            viewContentArea.innerHTML = `<h2>Erro ao carregar.</h2><button onclick="showSupervisorDashboard()">Voltar</button>`;
        }
    }

    function renderSupervisorCards() {
        supervisorCardsGrid.innerHTML = '';
        // --- MUDANÇA 2: Adicionado o novo módulo "Meus Agendamentos" ---
        const modules = {
            meu_perfil: {
                titulo: 'Meu Perfil e Edição', 
                descricao: 'Visualize e edite suas informações de perfil.' 
            },
            meus_supervisionados: { 
                titulo: 'Meus Supervisionados', 
                descricao: 'Visualize os acompanhamentos que você supervisiona.' 
            },
            meus_agendamentos: { titulo: 'Meus Agendamentos', descricao: 'Visualize os profissionais que agendaram supervisão com você.' }
        };
        for (const key in modules) {
            const module = modules[key];
            const card = document.createElement('div');
            card.className = 'module-card';
            card.dataset.view = key;
            card.innerHTML = `<div class="card-content"><h3>${module.titulo}</h3><p>${module.descricao}</p></div>`;
            supervisorCardsGrid.appendChild(card);
        }
    }

    supervisorCardsGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.module-card');
        if (card) {
            loadView(card.dataset.view);
        }
    });

    auth.onAuthStateChanged(async user => {
        if (user) {
            try {
                const userDoc = await db.collection('usuarios').doc(user.uid).get();
                if (userDoc.exists) {
                    const funcoes = userDoc.data().funcoes || [];
                    if (funcoes.includes('supervisor') || funcoes.includes('admin')) {
                        renderSupervisorCards();
                    } else {
                        dashboardContent.innerHTML = '<h2>Acesso Negado</h2>';
                    }
                } else {
                    dashboardContent.innerHTML = '<h2>Usuário não encontrado.</h2>';
                }
            } catch (error) {
                console.error("Erro ao buscar usuário:", error);
                dashboardContent.innerHTML = '<h2>Ocorreu um erro ao verificar suas permissões.</h2>';
            }
        } else {
            window.location.href = '../index.html';
        }
    });
});