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

    // --- INÍCIO DA ALTERAÇÃO: Funcionalidade do Modal de Reavaliação ---
    function inicializarModalPipefy() {
        const modal = document.getElementById("pipefyModal");
        const btn = document.getElementById("openPipefyModalBtn");
        const span = document.getElementById("closePipefyModalBtn");

        // Se os elementos do modal existirem na página, ativa os botões
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
    // --- FIM DA ALTERAÇÃO ---

    // Função que verifica o status de autenticação do usuário
    function checkAuth() {
        auth.onAuthStateChanged(user => {
            if (user) {
                // Usuário está logado.
                console.log("Usuário autenticado, acesso permitido ao Portal do Voluntário.");

                // --- INÍCIO DA ALTERAÇÃO: Chama a função para ativar o modal ---
                inicializarModalPipefy();
                // --- FIM DA ALTERAÇÃO ---

            } else {
                // Usuário não está logado, redireciona para a página de login.
                console.log("Usuário não autenticado, redirecionando para o login.");
                window.location.href = '../index.html';
            }
        });
    }

    // Executa a verificação assim que o script é carregado
    checkAuth();
})();