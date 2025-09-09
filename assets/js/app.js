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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', function() {
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    let inactivityTimer;

    // --- LÓGICA DE INATIVIDADE (sem alterações) ---
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

    // --- LÓGICA DE AUTENTICAÇÃO PRINCIPAL ---
    function handleAuth() {
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

    // --- FUNÇÕES DE RENDERIZAÇÃO ---

    function renderLogin(message = "Por favor, faça login para continuar.") {
        dashboardView.style.display = 'none';
        loginView.style.display = 'block';
        
        // --- MUDANÇA 1: Estilo do Login ---
        // O HTML agora usa a classe 'content-box' para criar o visual de card.
        loginView.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: #f4f7f9;">
                <div class="content-box" style="width: 100%; max-width: 450px; text-align: center; padding: 40px;">
                    <img src="./assets/img/logo-eupsico.png" alt="Logo EuPsico" style="max-width: 120px; margin-bottom: 20px;">
                    <h2>Intranet EuPsico</h2>
                    <p style="color: #555; margin-bottom: 30px;">${message}</p>
                    <button id="login-button" class="action-button" style="width: 100%;">Login com Google</button>
                </div>
            </div>
        `;
        document.getElementById('login-button').addEventListener('click', () => {
            loginView.innerHTML = `<p style="text-align:center; margin-top: 50px;">Aguarde...</p>`;
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).catch(error => console.error(error));
        });
    }

    function renderAccessDenied() {
        dashboardView.style.display = 'none';
        loginView.style.display = 'block';
        loginView.innerHTML = `
            <div class="content-box" style="max-width: 800px; margin: 50px auto; text-align: center;">
                <h2>Acesso Negado</h2>
                <p>Você está autenticado, mas seu usuário não tem permissões definidas. Contate o administrador.</p>
                <button id="denied-logout">Sair</button>
            </div>
        `;
        document.getElementById('denied-logout').addEventListener('click', () => auth.signOut());
    }

    function renderDashboard(user, userData) {
        loginView.style.display = 'none';
        dashboardView.style.display = 'block';
        
        const welcomeTitle = document.getElementById('welcome-title');
        const userPhoto = document.getElementById('user-photo-header');
        const userEmail = document.getElementById('user-email-header');
        const logoutButton = document.getElementById('logout-button-dashboard');

        if (welcomeTitle) {
            const firstName = userData.nome ? userData.nome.split(' ')[0] : '';
            welcomeTitle.textContent = `Bem-vindo(a), ${firstName}!`;
        }
        if (userPhoto) { userPhoto.src = user.photoURL || 'https://i.ibb.co/61Ym24n/default-user.png'; }
        if (userEmail) { userEmail.textContent = user.email; }
        if (logoutButton) { logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut();
        });}

        renderModuleCards(userData);
    }

    function renderModuleCards(userData) {
        const navLinks = document.getElementById('nav-links');
        if (!navLinks) return;
        navLinks.innerHTML = '';
        
        const icons = { /* ... (ícones inalterados) ... */ };

        // --- MUDANÇA 2 e 3: Textos dos módulos atualizados e novo card adicionado ---
        const areas = {
            portal_voluntario: { 
                titulo: 'Portal do Voluntário', 
                descricao: 'Avisos, notícias e informações importantes para todos os voluntários.', 
                url: '#announcements-section', // Link para a seção na mesma página
                roles: ['todos'], // Garante que todos vejam
                icon: icons.intranet 
            },
            administrativo: { 
                titulo: 'Administrativo', 
                descricao: 'Somente os voluntários do administrativo tem acesso para acessar os Processos, documentos e a organização da equipe.', 
                url: './pages/administrativo-painel.html', 
                roles: ['admin', 'gestor', 'assistente'], 
                icon: icons.administrativo 
            },
            captacao: { 
                titulo: 'Captação', 
                descricao: 'Somente os voluntários da captação tem acesso para acessar as ferramentas e informações para captação.', 
                url: '#', 
                roles: ['admin', 'captacao'], 
                icon: icons.captacao 
            },
            financeiro: { 
                titulo: 'Financeiro', 
                descricao: 'Somente os voluntários do financeiro tem acesso ao painel de controle financeiro e relatórios.', 
                url: './pages/painel.html', 
                roles: ['admin', 'financeiro'], 
                icon: icons.financeiro 
            },
            grupos: { 
                titulo: 'Grupos', 
                descricao: 'Somente os voluntários de grupos tem acesso às informações e materiais para grupos.', 
                url: '#', 
                roles: ['admin', 'grupos'], 
                icon: icons.grupos 
            },
            marketing: { 
                titulo: 'Marketing', 
                descricao: 'Somente os voluntários do marketing tem acesso aos materiais de marketing e campanhas.', 
                url: '#', 
                roles: ['admin', 'marketing'], 
                icon: icons.marketing 
            },
            plantao: { 
                titulo: 'Plantão', 
                descricao: 'Somente os voluntários do plantão tem acesso às escalas, contatos e procedimentos.', 
                url: '#', 
                roles: ['admin', 'plantao'], 
                icon: icons.plantao 
            },
            rh: { 
                titulo: 'Recursos Humanos', 
                descricao: 'Somente os voluntários do RH tem acesso às informações sobre vagas e comunicados.', 
                url: '#', 
                roles: ['admin', 'rh'], 
                icon: icons.rh 
            },
            servico_social: { 
                titulo: 'Serviço Social', 
                descricao: 'Somente os voluntários do Serviço Social tem acesso aos documentos e orientações.', 
                url: '#', 
                roles: ['admin', 'servico_social'], 
                icon: icons.servico_social 
            },
            supervisores: { 
                titulo: 'Painel do Supervisor', 
                descricao: 'Acesse seu perfil, agendamentos e fichas de acompanhamentos.', 
                url: './pages/supervisores-painel.html', 
                roles: ['admin', 'supervisor'], 
                icon: icons.rh 
            },
            supervisao: { 
                titulo: 'Intranet Supervisão', 
                descricao: 'Acesse perfis de supervisores ou preencha e visualize suas fichas de acompanhamento.', 
                url: './pages/supervisao-painel.html', 
                roles: ['admin', 'atendimento','supervisor', 'psicologo', 'psicopedagoga', 'musicoterapeuta']
            },
        };

        const userFuncoes = (userData.funcoes || []).map(f => f.toLowerCase());
        let cardsParaMostrar = [];

        for (const key in areas) {
            const area = areas[key];
            const rolesLowerCase = (area.roles || []).map(r => r.toLowerCase());
            let temPermissao = false;
            
            if (userFuncoes.includes('admin') || rolesLowerCase.includes('todos')) {
                temPermissao = true;
            } else if (rolesLowerCase.some(role => userFuncoes.includes(role))) {
                temPermissao = true;
            }

            if (temPermissao) {
                cardsParaMostrar.push(area);
            }
        }
        
        // Ordena para garantir que o "Portal do Voluntário" venha primeiro se existir
        cardsParaMostrar.sort((a, b) => {
            if (a.titulo === 'Portal do Voluntário') return -1;
            if (b.titulo === 'Portal do Voluntário') return 1;
            return a.titulo.localeCompare(b.titulo);
        });
        
        cardsParaMostrar.forEach(config => {
            const card = document.createElement('a');
            card.href = config.url;
            card.className = 'module-card';
            card.innerHTML = `
                <div class="card-icon">
                    ${config.icon}
                    <h3>${config.titulo}</h3>
                </div>
                <div class="card-content">
                    <p>${config.descricao}</p>
                </div>
            `;
            navLinks.appendChild(card);
        });
    }

    handleAuth();
});