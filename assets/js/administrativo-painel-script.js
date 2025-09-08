// ATENÇÃO: Este é um novo arquivo de script, exclusivo para o painel administrativo.

// Use a mesma configuração do Firebase do seu outro painel
const firebaseConfig = {
        apiKey: "AIzaSyDJqPJjDDIGo7uRewh3pw1SQZOpMgQJs5M",
        authDomain: "eupsico-agendamentos-d2048.firebaseapp.com",
        databaseURL: "https://eupsico-agendamentos-d2048-default-rtdb.firebaseio.com",
        projectId: "eupsico-agendamentos-d2048",
        storageBucket: "eupsico-agendamentos-d2048.firebasestorage.app",
        messagingSenderId: "1041518416343",
        appId: "1:1041518416343:web:0a11c03c205b802ed7bb92"

};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
document.addEventListener('DOMContentLoaded', function() {
    const cardGridArea = document.getElementById('card-grid-area');
    const viewContentArea = document.getElementById('view-content-area');
    const adminModulesGrid = document.getElementById('admin-modules-grid');
    let currentUserRoles = [];
    const icons = {
        grade: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`
    };
    window.showAdminDashboard = function() {
        viewContentArea.style.display = 'none';
        viewContentArea.innerHTML = '';
        cardGridArea.style.display = 'block';
    }
    async function loadView(viewName) {
        if (!viewContentArea) return;
        cardGridArea.style.display = 'none';
        viewContentArea.style.display = 'block';
        viewContentArea.innerHTML = '<h2>Carregando...</h2>';
        const existingScript = document.querySelector('script[data-view-script]');
        if (existingScript) {
            existingScript.remove();
        }
        const filesToLoad = {};
        if (viewName === 'grade_atendimento') {
            filesToLoad.html = './grade-atendimento.html';
            filesToLoad.css = '../assets/css/grade-atendimento.css';
            filesToLoad.js = '../assets/js/grade-atendimento.js';
        }
        try {
            const htmlResponse = await fetch(filesToLoad.html);
            if (!htmlResponse.ok) throw new Error(`Erro ao carregar HTML: ${htmlResponse.statusText}`);
            viewContentArea.innerHTML = await htmlResponse.text();
            if (!document.querySelector(`link[data-view-style="${viewName}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = filesToLoad.css;
                link.dataset.viewStyle = viewName;
                document.head.appendChild(link);
            }
            const script = document.createElement('script');
            script.src = filesToLoad.js;
            script.dataset.viewScript = viewName;
            document.body.appendChild(script);
        } catch (error) {
            console.error('Erro ao carregar a view:', error);
            viewContentArea.innerHTML = '<h2>Erro ao carregar a página. Tente novamente. <button onclick="showAdminDashboard()">Voltar</button></h2>';
        }
    }
    function renderAdminCards() {
        if (!adminModulesGrid) return;
        adminModulesGrid.innerHTML = '';
        const adminModules = {
            grade_atendimento: {
                titulo: 'Grade de Atendimento',
                descricao: 'Visualize e edite os horários dos profissionais.',
                roles: ['admin', 'gestor', 'assistente'],
                icon: icons.grade
            }
        };
        for (const key in adminModules) {
            const module = adminModules[key];
            const hasPermission = module.roles.some(role => currentUserRoles.includes(role));
            if (hasPermission) {
                const card = document.createElement('div');
                card.className = 'module-card';
                card.dataset.view = key;
                card.innerHTML = `<div class="card-icon">${module.icon}</div><div class="card-content"><h3>${module.titulo}</h3><p>${module.descricao}</p></div>`;
                adminModulesGrid.appendChild(card);
            }
        }
    }
    adminModulesGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.module-card');
        if (card) {
            const view = card.dataset.view;
            loadView(view);
        }
    });
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection("usuarios").doc(user.uid).get();
                if (userDoc.exists) {
                    currentUserRoles = userDoc.data().funcoes || [];
                    renderAdminCards();
                } else {
                    adminModulesGrid.innerHTML = '<h2>Usuário não encontrado.</h2>';
                }
            } catch(error) {
                 adminModulesGrid.innerHTML = '<h2>Erro ao verificar permissões.</h2>';
            }
        } else {
            window.location.href = '../index.html';
        }
    });
});
