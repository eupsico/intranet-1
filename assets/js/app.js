// --- CONFIGURAÇÃO DO FIREBASE ---
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
    const appContainer = document.getElementById('app');
    let inactivityTimer;

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            alert("Você foi desconectado por inatividade.");
            auth.signOut();
        }, 20 * 60 * 1000); 
    }

    function setupInactivityListeners() {
        window.addEventListener('mousemove', resetInactivityTimer);
        window.addEventListener('mousedown', resetInactivityTimer);
        window.addEventListener('keypress', resetInactivityTimer);
        window.addEventListener('scroll', resetInactivityTimer);
        window.addEventListener('touchstart', resetInactivityTimer);
        resetInactivityTimer();
    }

    function handleAuth() {
        appContainer.innerHTML = `<p style="text-align:center; margin-top: 50px;">Verificando autenticação...</p>`;
        auth.onAuthStateChanged(async (user) => {
            try {
                if (user) {
                    const userDoc = await db.collection("usuarios").doc(user.uid).get();
                    if (userDoc.exists && userDoc.data().funcoes?.length > 0) {
                        const userData = userDoc.data();
                        renderDashboard(user, userData);
                        setupInactivityListeners();
                    } else {
                        renderAccessDenied();
                        auth.signOut();
                    }
                } else {
                    renderLogin();
                }
            } catch (error) {
                console.error("Erro durante a verificação de autenticação:", error);
                renderLogin(`Ocorreu um erro ao verificar suas permissões: ${error.message}`);
                auth.signOut();
            }
        });
    }

    function renderLogin(message = "Por favor, faça login para continuar.") {
        appContainer.innerHTML = `
            <div id="login-view" class="content-box">
                <img src="./assets/img/logo-eupsico.png" alt="Logo EuPsico" style="max-width: 100px;">
                <h2>Intranet EuPsico</h2>
                <p>${message}</p>
                <button id="login-button">Login com Google</button>
            </div>
        `;
        document.getElementById('login-button').addEventListener('click', () => {
            appContainer.innerHTML = `<p style="text-align:center; margin-top: 50px;">Aguarde...</p>`;
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).catch(error => console.error(error));
        });
    }

    function renderAccessDenied() {
        appContainer.innerHTML = `
            <div class="content-box" style="max-width: 800px; margin: 50px auto; text-align: center;">
                <h2>Acesso Negado</h2>
                <p>Você está autenticado, mas seu usuário não tem permissões definidas. Contate o administrador.</p>
                <button id="denied-logout">Sair</button>
            </div>
        `;
        document.getElementById('denied-logout').addEventListener('click', () => auth.signOut());
    }

    function renderDashboard(user, userData) {
        appContainer.innerHTML = `
            <header class="main-header">
                <h1>Intranet EuPsico</h1>
                <div class="user-profile">
                    <img id="user-photo" src="${user.photoURL || 'https://i.ibb.co/61Ym24n/default-user.png'}" alt="Foto">
                    <span id="user-email">${user.email}</span>
                    <button id="logout-button">Sair</button>
                </div>
            </header>
            <h2 class="modules-title">Módulos da Intranet</h2>
            <div id="nav-links" class="modules-grid"></div>
        `;
        document.getElementById('logout-button').addEventListener('click', () => auth.signOut());
        renderModuleCards(userData);
    }

    function renderModuleCards(userData) {
        const navLinks = document.getElementById('nav-links');
        if (!navLinks) return;
        navLinks.innerHTML = '';
        
        const icons = {
            intranet: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 12c0-5.25-4.25-9.5-9.5-9.5S2.5 6.75 2.5 12s4.25 9.5 9.5 9.5s9.5-4.25 9.5-9.5Z"/><path d="M12 2.5v19"/><path d="M2.5 12h19"/></svg>`,
            administrativo: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
            captacao: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`,
            financeiro: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
            grupos: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
            marketing: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`,
            plantao: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
            rh: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
            servico_social: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            supervisao: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
        };

        const areas = {
            intranet: { 
                titulo: 'Intranet Geral', 
                descricao: 'Avisos, notícias e informações para todos.', 
               // url: '#', roles: ['todos'], icon: icons.intranet },
               url: '#', roles: ['admin'], icon: icons.intranet },
            administrativo: { titulo: 'Intranet Administrativo', descricao: 'Processos, documentos e organização.', url: './pages/administrativo-painel.html', roles: ['admin', 'gestor', 'assistente'], icon: icons.administrativo },
            captacao: { titulo: 'Intranet Captação', descricao: 'Ferramentas e informações para captação.', url: '#', roles: ['admin', 'captacao'], icon: icons.captacao },
            financeiro: { titulo: 'Intranet Financeiro', descricao: 'Painel de controle financeiro e relatórios.', url: './pages/painel.html', roles: ['admin', 'financeiro'], icon: icons.financeiro },
            grupos: { titulo: 'Intranet Grupos', descricao: 'Informações e materiais para grupos.', url: '#', roles: ['admin', 'grupos'], icon: icons.grupos },
            marketing: { titulo: 'Intranet Marketing', descricao: 'Materiais de marketing e campanhas.', url: '#', roles: ['admin', 'marketing'], icon: icons.marketing },
            plantao: { titulo: 'Intranet Plantão', descricao: 'Escalas, contatos e procedimentos.', url: '#', roles: ['admin', 'plantao'], icon: icons.plantao },
            rh: { titulo: 'Recursos Humanos', descricao: 'Informações sobre vagas e comunicados.', url: '#', roles: ['admin', 'rh'], icon: icons.rh },
            servico_social: { titulo: 'Intranet Serviço Social', descricao: 'Documentos e orientações do S.S.', url: '#', roles: ['admin', 'servico_social'], icon: icons.servico_social },
            supervisores: { titulo: 'Painel do Supervisor', descricao: 'Acesse seu perfil e acompanhamentos.', url: './pages/supervisores-painel.html', roles: ['admin', 'supervisor'], icon: icons.rh },
            supervisao: { 
                titulo: 'Intranet Supervisão', 
                descricao: 'Preencha e visualize suas fichas de acompanhamento.', 
                url: './pages/supervisao-painel.html', 
                roles: ['admin', 'atendimento','supervisor'],
                professions: ['Psicólogo', 'Psicopedagoga', 'Musicoterapeuta']
            },
        };

        const userFuncoes = (userData.funcoes || []).map(f => f.toLowerCase());
        const userProfissao = userData.profissao || '';

        let cardsParaMostrar = [];

        for (const key in areas) {
            const area = areas[key];
            const rolesLowerCase = (area.roles || []).map(r => r.toLowerCase());

            let temPermissao = false;
            
            if (userFuncoes.includes('admin')) {
                temPermissao = true;
            } else if (rolesLowerCase.includes('todos')) {
                temPermissao = true;
            } else if (rolesLowerCase.some(role => userFuncoes.includes(role))) {
                temPermissao = true;
            } else if (area.professions && area.professions.includes(userProfissao)) {
                temPermissao = true;
            }

            if (temPermissao) {
                cardsParaMostrar.push(area);
            }
        }

        cardsParaMostrar.sort((a, b) => a.titulo.localeCompare(b.titulo));
        
        cardsParaMostrar.forEach(config => {
            const card = document.createElement('a');
            card.href = config.url;
            card.className = 'module-card';
            card.innerHTML = `
                <div class="card-icon">${config.icon || icons.intranet}</div>
                <div class="card-content">
                    <h3>${config.titulo}</h3>
                    <p>${config.descricao}</p>
                </div>
            `;
            navLinks.appendChild(card);
        });
    }

    handleAuth();
});
