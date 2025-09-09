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

    // Função que verifica o status de autenticação do usuário
    function checkAuth() {
        auth.onAuthStateChanged(user => {
            if (user) {
                // Usuário está logado.
                // A página pode carregar normalmente.
                console.log("Usuário autenticado, acesso permitido ao Portal do Voluntário.");
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