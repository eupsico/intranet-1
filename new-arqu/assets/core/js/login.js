document.addEventListener('DOMContentLoaded', () => {
    // Verifique se o Firebase foi inicializado
    if (!firebase || !firebase.app) {
        console.error("Firebase não foi inicializado. Verifique a ordem dos scripts e o firebase-config.js");
        return;
    }

    const auth = firebase.auth();
    const loginView = document.getElementById('login-view');

    // Função que renderiza o botão de login na tela
    function renderLoginButton() {
        loginView.innerHTML = `
            <div class="login-card">
                <img src="./assets/core/img/logo-eupsico.png" alt="Logo EuPsico" class="login-logo">
                <h2 class="login-title">Intranet EuPsico</h2>
                <p class="login-message">Por favor, faça login para continuar.</p>
                <button id="login-button" class="login-button">
                    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><g fill="#000" fill-rule="evenodd"><path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.54C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.63 5.05 6.66 3.48 9 3.48z" fill="#EA4335"></path><path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.23 1.11-.82 2.07-1.86 2.73l2.54 2.54c1.46-1.35 2.44-3.21 2.44-5.41z" fill="#4285F4"></path><path d="M3.88 10.73A5.47 5.47 0 0 1 3.58 9c0-.62.11-1.22.3-1.73L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.31z" fill="#FBBC05"></path><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.54-2.54c-.81.54-1.86.85-3.42.85-2.34 0-4.37-1.57-5.09-3.71L.96 13.04C2.44 15.98 5.48 18 9 18z" fill="#34A853"></path><path fill="none" d="M0 0h18v18H0z"></path></g></svg>
                    <span>Login com Google</span>
                </button>
            </div>
        `;

        // Adiciona o evento de clique ao botão
        document.getElementById('login-button').addEventListener('click', () => {
            loginView.innerHTML = `<p>Aguarde...</p>`;
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider).catch(error => {
                console.error("Erro durante o login:", error);
                loginView.innerHTML = `<p class="login-message">Ocorreu um erro ao tentar fazer login. Tente novamente.</p>`;
            });
        });
    }

    // O principal controlador de autenticação
    auth.onAuthStateChanged(user => {
        if (user) {
            // Se o usuário JÁ ESTÁ LOGADO, redireciona para o dashboard
            console.log("Usuário já logado. Redirecionando para o dashboard...");
            window.location.href = './dashboard.html';
        } else {
            // Se o usuário NÃO ESTÁ LOGADO, mostra o botão de login
            console.log("Nenhum usuário logado. Exibindo tela de login.");
            renderLoginButton();
        }
    });
});