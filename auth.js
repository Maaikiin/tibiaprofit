// ==========================================================================
// CONFIGURAÇÃO DO FIREBASE (Insira as chaves idênticas do seu projeto aqui)
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyC8cyPoQ460-oq4L0LR2fRH_5qZPMhf_y4",
  authDomain: "tibia-profit-1d4db.firebaseapp.com",
  databaseURL: "https://tibia-profit-1d4db-default-rtdb.firebaseio.com",
  projectId: "tibia-profit-1d4db",
  storageBucket: "tibia-profit-1d4db.firebasestorage.app",
  messagingSenderId: "607161063509",
  appId: "1:607161063509:web:0316825be228e14fc8dcdc",
  measurementId: "G-BL860XY57Y"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

// Captura dos Elementos da Tela de Login
const loginForm = document.getElementById('loginForm');
const loginErro = document.getElementById('loginErro');

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (loginErro) loginErro.style.display = 'none';

        // Tenta fazer o login no Firebase
        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Login com sucesso -> Redireciona diretamente para o painel
                window.location.href = "dashboard.html";
            })
            .catch((error) => {
                console.error(error);
                if (loginErro) {
                    loginErro.innerText = "Erro ao entrar: Verifique a Account e Password.";
                    loginErro.style.display = 'block';
                }
            });
    });
}

// Formulário de Registro (usado em register.html)
const registerForm = document.getElementById('registerForm');
const registerErro = document.getElementById('registerErro');

if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const passwordConfirm = document.getElementById('regPasswordConfirm').value;

        if (registerErro) registerErro.style.display = 'none';

        if (password !== passwordConfirm) {
            if (registerErro) {
                registerErro.innerText = "As senhas não coincidem.";
                registerErro.style.display = 'block';
            }
            return;
        }

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                window.location.href = "dashboard.html";
            })
            .catch((error) => {
                console.error(error);
                if (registerErro) {
                    registerErro.innerText = "Erro ao registrar: " + error.message;
                    registerErro.style.display = 'block';
                }
            });
    });
}