(function() {
    // Configuração do Firebase
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

    // --- LÓGICA DO MODAL (será chamada após o carregamento do conteúdo) ---
    function inicializarModalPipefy() {
        const modal = document.getElementById("pipefyModal");
        const btn = document.getElementById("openPipefyModalBtn");
        const span = document.getElementById("closePipefyModalBtn");

        if (modal && btn && span) {
            btn.onclick = function() { modal.style.display = "block"; }
            span.onclick = function() { modal.style.display = "none"; }
            window.onclick = function(event) { 
                if (event.target == modal) { 
                    modal.style.display = "none"; 
                } 
            }
        }
    }

    // --- NOVA FUNÇÃO PARA CARREGAR O CONTEÚDO DAS SEÇÕES ---
    async function loadSectionContent() {
        const sectionsToLoad = [
            { id: 'gestao', filePath: './portal-voluntario/gestao.html' },
            { id: 'solicitacoes', filePath: './portal-voluntario/solicitacoes.html' }
            // Adicione aqui futuras seções que se tornarão modulares
        ];

        const fetchPromises = sectionsToLoad.map(section =>
            fetch(section.filePath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Não foi possível carregar ${section.filePath}`);
                    }
                    return response.text();
                })
                .then(html => ({ id: section.id, html: html }))
        );

        try {
            const results = await Promise.all(fetchPromises);

            results.forEach(result => {
                const container = document.querySelector(`#${result.id} .section-content`);
                if (container) {
                    container.innerHTML = result.html;
                }
            });

            // SOMENTE DEPOIS de carregar o conteúdo, ativamos o script do modal.
            inicializarModalPipefy();

        } catch (error) {
            console.error("Erro ao carregar conteúdo das seções:", error);
            sectionsToLoad.forEach(section => {
                const container = document.querySelector(`#${section.id} .section-content`);
                if (container) {
                    container.innerHTML = `<p style="color: red;">Não foi possível carregar o conteúdo desta seção.</p>`;
                }
            });
        }
    }

    // Função que verifica o status de autenticação do usuário
    function checkAuth() {
        auth.onAuthStateChanged(user => {
            if (user) {
                console.log("Usuário autenticado, carregando conteúdo do portal...");
                // Chama a nova função para carregar o conteúdo dinâmico
                loadSectionContent();
            } else {
                console.log("Usuário não autenticado, redirecionando para o login.");
                window.location.href = '../index.html';
            }
        });
    }

    // Executa a verificação assim que o script é carregado
    checkAuth();
})();