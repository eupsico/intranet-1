// assets/js/painel-script.js (Versão Final e Completa)

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

(function() {
    const auth = firebase.auth();
    const db = firebase.firestore();
    window.auth = auth;
    window.db = db;
    
    window.showToast = function(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.4s ease';
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    };

    const contentArea = document.getElementById('content-area');
    const navButtons = document.querySelectorAll('.nav-button');
    const logoutButton = document.getElementById('logout-button');
    const toggleButton = document.getElementById('sidebar-toggle-btn');
    const mainContainer = document.getElementById('app-view');

    if (toggleButton && mainContainer) {
        toggleButton.addEventListener('click', () => {
            mainContainer.classList.toggle('sidebar-collapsed');
        });
    }

    function gerenciarPermissoesMenu(funcoesUsuario = []) {
        navButtons.forEach(button => {
            const rolesNecessarias = button.dataset.roles ? button.dataset.roles.split(',') : [];
            // Se um botão não tiver data-roles, ele é visível para todos os logados.
            // Senão, verifica se o usuário tem pelo menos uma das funções necessárias.
            const temPermissao = rolesNecessarias.length === 0 || rolesNecessarias.some(role => funcoesUsuario.includes(role.trim()));
            
            if (button.parentElement) { // Garante que o elemento pai (li) existe
               button.parentElement.style.display = temPermissao ? 'block' : 'none';
            }
        });
    }

    const initializePage = () => {
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = '../index.html';
                return;
            }
            try {
                const userDoc = await db.collection('usuarios').doc(user.uid).get();
                if (userDoc.exists) {
                    const funcoes = userDoc.data().funcoes || [];
                    gerenciarPermissoesMenu(funcoes);

                    // Lógica de Deep Linking
                    const hash = window.location.hash.substring(1);
                    const requestedButton = document.querySelector(`.nav-button[data-view="${hash}"]`);
                    
                    if (hash && requestedButton && requestedButton.parentElement.style.display !== 'none') {
                        loadView(hash);
                    } else {
                        loadView('dashboard');
                    }
                } else {
                    document.body.innerHTML = '<h2>Acesso Negado</h2><p>Seu usuário não foi encontrado no sistema.</p>';
                }
            } catch (error) {
                console.error("Erro ao buscar permissões do usuário:", error);
                document.body.innerHTML = '<h2>Ocorreu um erro ao carregar o painel.</h2>';
            }
        });
    };

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const viewName = e.currentTarget.dataset.view;
            // Apenas atualiza o hash. O listener 'hashchange' fará o resto.
            window.location.hash = viewName;
        });
    });
    
    // Ouve por mudanças no hash da URL para carregar a view correta
    window.addEventListener('hashchange', () => {
        const viewName = window.location.hash.substring(1) || 'dashboard';
        loadView(viewName);
    });

    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = '../index.html';
        });
    });

    async function loadView(viewName) {
        // Marca o botão de navegação ativo
        navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });
        
        // Remove scripts e CSS antigos
        const oldScript = document.getElementById('dynamic-view-script');
        if (oldScript) oldScript.remove();
        const oldStyle = document.getElementById('dynamic-view-style');
        if (oldStyle) oldStyle.remove();
        
        try {
            contentArea.innerHTML = '<div class="loading-spinner"></div>';
            
            const response = await fetch(`../pages/${viewName}.html`);
            if (!response.ok) {
                throw new Error(`Arquivo não encontrado: ${viewName}.html`);
            }
            contentArea.innerHTML = await response.text();

            const newStyle = document.createElement('link');
            newStyle.id = 'dynamic-view-style';
            newStyle.rel = 'stylesheet';
            newStyle.href = `../assets/css/${viewName}.css`;
            document.head.appendChild(newStyle);

            const newScript = document.createElement('script');
            newScript.id = 'dynamic-view-script';
            newScript.src = `../assets/js/${viewName}.js`;
            document.body.appendChild(newScript);

        } catch (error) {
            console.error(`Erro ao carregar a view ${viewName}:`, error);
            if(error.message.includes('não encontrado')) {
                 contentArea.innerHTML = `<div class="view-container"><h2>Módulo em Desenvolvimento</h2><p>O conteúdo para a seção '${viewName}' ainda não foi criado.</p></div>`;
            } else {
                 contentArea.innerHTML = `<h2>Erro ao carregar este módulo.</h2><p>${error.message}.</p>`;
            }
        }
    }
    
    initializePage();
})();
