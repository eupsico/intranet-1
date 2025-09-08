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
    if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
    auth = firebase.auth();
    db = firebase.firestore();
    const cardGridArea = document.getElementById('card-grid-area');
    const viewContentArea = document.getElementById('view-content-area');
    const supervisaoModulesGrid = document.getElementById('supervisao-modules-grid');
    let currentUserData = null; 

    window.showSupervisaoDashboard = function() {
        if (viewContentArea) { viewContentArea.style.display = 'none'; viewContentArea.innerHTML = ''; }
        if (cardGridArea) { cardGridArea.style.display = 'block'; }
    }

    async function loadView(viewName, mode = '') {
        if (!viewContentArea || !cardGridArea) return;
        const fileMap = {
            'formulario_supervisao': { html: './formulario-supervisao.html', js: '../assets/js/formulario-supervisao.js', css: '../assets/css/formulario-supervisao.css' },
            'perfis_supervisores': { html: './view-meu-perfil.html', js: '../assets/js/view-meu-perfil.js', css: '../assets/css/supervisores.css' }
        };
        const files = fileMap[viewName];
        if (!files) { console.error(`View "${viewName}" não encontrada.`); return; }
        
        if (viewName === 'perfis_supervisores') {
            window.PROFILE_VIEW_MODE = 'all'; 
        }

        cardGridArea.style.display = 'none';
        viewContentArea.style.display = 'block';
        viewContentArea.innerHTML = '<div class="loading-spinner"></div>';
        
        const existingScript = document.querySelector(`script[data-view-script]`);
        if (existingScript) existingScript.remove();

        try {
            const htmlResponse = await fetch(files.html);
            if (!htmlResponse.ok) throw new Error(`Erro ao carregar HTML: ${files.html}`);
            viewContentArea.innerHTML = await htmlResponse.text();
            
            // --- ALTERAÇÃO IMPORTANTE AQUI ---
            // Procura pelos dois possíveis IDs de botão "Voltar" e ativa o que encontrar.
            const backButton = document.getElementById('view-back-button') || document.getElementById('form-view-back-button');
            if (backButton) {
                backButton.addEventListener('click', showSupervisaoDashboard);
            }

            if (mode) { window.formSupervisaoMode = mode; }

            if (!document.querySelector(`link[href="${files.css}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet'; link.href = files.css;
                document.head.appendChild(link);
            }
            
            const script = document.createElement('script');
            script.src = files.js; script.dataset.viewScript = viewName;
            document.body.appendChild(script);

        } catch (error) {
            console.error('Erro ao carregar a view:', error);
            viewContentArea.innerHTML = `<h2>Ocorreu um erro.</h2><p>Tente novamente.</p><button onclick="showSupervisaoDashboard()">Voltar</button>`;
        }
    }

    function renderSupervisaoCards() {
        if (!supervisaoModulesGrid) return;
        supervisaoModulesGrid.innerHTML = '';
        // Ícones omitidos para simplicidade, mas a lógica é a mesma
        const supervisaoModules = {
            nova_ficha: { titulo: 'Ficha de Supervisão', descricao: 'Clique aqui para preencher uma nova ficha.', view: 'formulario_supervisao', mode: 'new' },
            visualizar: { titulo: 'Acompanhamentos', descricao: 'Visualize todas as fichas que você preencheu.', view: 'formulario_supervisao', mode: 'list' },
            supervisores: { titulo: 'Supervisores', descricao: 'Visualize os perfis de todos os supervisores.', view: 'perfis_supervisores', mode: '' }
        };
        if (currentUserData) {
            for (const key in supervisaoModules) {
                const module = supervisaoModules[key];
                const card = document.createElement('div');
                card.className = 'module-card';
                card.dataset.view = module.view; card.dataset.mode = module.mode;
                card.innerHTML = `<div class="card-content"><h3>${module.titulo}</h3><p>${module.descricao}</p></div>`;
                supervisaoModulesGrid.appendChild(card);
            }
        }
    }

    supervisaoModulesGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.module-card');
        if (card) { loadView(card.dataset.view, card.dataset.mode); }
    });

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection("usuarios").doc(user.uid).get();
                if (userDoc.exists) {
                    currentUserData = userDoc.data();
                    renderSupervisaoCards();
                }
            } catch(error) { console.error("Erro ao verificar permissões:", error); }
        } else { window.location.href = '../index.html'; }
    });
});