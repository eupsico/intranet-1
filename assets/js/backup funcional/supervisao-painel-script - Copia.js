// assets/js/supervisao-painel-script.js (Versão 1)
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

    const cardGridArea = document.getElementById('card-grid-area');
    const viewContentArea = document.getElementById('view-content-area');
    const supervisaoModulesGrid = document.getElementById('supervisao-modules-grid');
    let currentUserData = null; 

    window.showSupervisaoDashboard = function() {
        if (viewContentArea) {
            viewContentArea.style.display = 'none';
            viewContentArea.innerHTML = '';
        }
        if (cardGridArea) {
            cardGridArea.style.display = 'block';
        }
    }

    async function loadView(viewName, mode = '') {
        if (!viewContentArea || !cardGridArea) return;

        const fileMap = {
            'formulario_supervisao': {
                html: './formulario-supervisao.html',
                js: '../assets/js/formulario-supervisao.js',
                css: '../assets/css/formulario-supervisao.css'
            },
            'perfis_supervisores': { 
                html: './view-meu-perfil.html',
                js: '../assets/js/view-meu-perfil.js',
                css: '../assets/css/supervisores.css'
            }
        };

        const files = fileMap[viewName];
        if (!files) {
            console.error(`View "${viewName}" não encontrada no fileMap.`);
            return;
        }
        
        // --- INÍCIO DA ALTERAÇÃO ---
        // Se a view for a de perfis, definimos um modo especial para mostrar todos.
        if (viewName === 'perfis_supervisores') {
            window.PROFILE_VIEW_MODE = 'all'; 
        }
        // --- FIM DA ALTERAÇÃO ---

        cardGridArea.style.display = 'none';
        viewContentArea.style.display = 'block';
        viewContentArea.innerHTML = '<div class="loading-spinner"></div>';
        
        const existingScript = document.querySelector(`script[data-view-script]`);
        if (existingScript) existingScript.remove();

        try {
            const htmlResponse = await fetch(files.html);
            if (!htmlResponse.ok) throw new Error(`Erro ao carregar HTML: ${files.html}`);
            viewContentArea.innerHTML = await htmlResponse.text();
            
            const backButton = document.getElementById('view-back-button');
            if (backButton) {
                backButton.addEventListener('click', showSupervisaoDashboard);
            }

            if (mode) {
                window.formSupervisaoMode = mode;
            }

            if (!document.querySelector(`link[href="${files.css}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = files.css;
                document.head.appendChild(link);
            }
            
            const script = document.createElement('script');
            script.src = files.js;
            script.dataset.viewScript = viewName;
            document.body.appendChild(script);

        } catch (error) {
            console.error('Erro ao carregar a view:', error);
            viewContentArea.innerHTML = `<h2>Ocorreu um erro.</h2><p>Tente novamente mais tarde.</p><button onclick="showSupervisaoDashboard()">Voltar</button>`;
        }
    }

    function renderSupervisaoCards() {
        if (!supervisaoModulesGrid) return;
        supervisaoModulesGrid.innerHTML = '';

        const supervisaoModules = {
            nova_ficha: {
                titulo: 'Ficha de Supervisão',
                descricao: 'Clique aqui para preencher uma nova ficha.',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
                view: 'formulario_supervisao',
                mode: 'new'
            },
            visualizar: {
                titulo: 'Acompanhamentos',
                descricao: 'Visualize todas as fichas que você preencheu ou supervisionou.',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
                view: 'formulario_supervisao',
                mode: 'list'
            },
            supervisores: {
                titulo: 'Supervisores',
                descricao: 'Visualize os perfis de todos os supervisores.',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
                view: 'perfis_supervisores',
                mode: ''
            }
        };

        if (currentUserData) {
            for (const key in supervisaoModules) {
                const module = supervisaoModules[key];
                const card = document.createElement('div');
                card.className = 'module-card';
                card.dataset.view = module.view;
                card.dataset.mode = module.mode;
                card.innerHTML = `<div class="card-icon">${module.icon}</div><div class="card-content"><h3>${module.titulo}</h3><p>${module.descricao}</p></div>`;
                supervisaoModulesGrid.appendChild(card);
            }
        } else {
             supervisaoModulesGrid.innerHTML = '<h2>Não foi possível verificar suas permissões.</h2>';
        }
    }

    supervisaoModulesGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.module-card');
        if (card) {
            loadView(card.dataset.view, card.dataset.mode);
        }
    });

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection("usuarios").doc(user.uid).get();
                if (userDoc.exists) {
                    currentUserData = userDoc.data();
                    renderSupervisaoCards();
                } else {
                    supervisaoModulesGrid.innerHTML = '<h2>Usuário não encontrado no banco de dados.</h2>';
                }
            } catch(error) {
                console.error("Erro ao buscar dados do usuário:", error);
                supervisaoModulesGrid.innerHTML = '<h2>Erro ao verificar permissões. Tente recarregar a página.</h2>';
            }
        } else {
            window.location.href = '../index.html';
        }
    });
});
