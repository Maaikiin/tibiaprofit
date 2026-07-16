# Tibia Profit

Um rastreador de profit para jogadores de **Tibia** — registre suas hunts (solo ou em party), drops raros e gastos, e acompanhe tudo em gráficos mensais e diários. Feito com HTML, CSS e JavaScript puro, usando **Firebase** (Auth + Realtime Database) e a **TibiaData API**.

> Tibia and all products related to Tibia are copyrighted by CipSoft GmbH. The official website of Tibia is [tibia.com](https://tibia.com/). Este é um projeto de fã, sem vínculo oficial com a CipSoft.

---

## ✨ Funcionalidades

### 🔐 Conta
- Cadastro e login com e-mail/senha (Firebase Authentication)
- Telas de login e registro com visual inspirado no Tibia (usando o [Fan Kit](https://www.tibia.com/fansites/) oficial da CipSoft)

### 🧮 Calculadora de Hunts
- Cole o log do **Session Analyser** do Tibia e o site detecta sozinho se é uma **hunt solo** ou uma **party hunt**
- **Hunt solo**: calcula e salva o profit automaticamente
- **Party hunt**: calcula a divisão justa do profit entre os jogadores, mostra quem paga quanto pra quem (formato pronto pra usar no `transfer` do jogo) e permite copiar tudo para o Discord
- **Profit Individual**: campo manual pra quem não quiser colar o log completo

### 💎 Drops Raros e 💸 Compras/Gastos
- Lançamento manual de itens raros encontrados (com busca automática de imagem do item)
- Lançamento de gastos (boosts, suprimentos, imbuements etc.)

### 📊 Resumo Mensal
- Cards de totais: Profit Hunt, Profit Líquido Anual, Total de Drops e Total de Compras
- Gráfico de profit mês a mês
- **Clique em qualquer mês** (na tabela ou no gráfico) pra ver o acompanhamento **dia a dia** daquele mês

### 🐉 Informações ao vivo (TibiaData API)
- Dados do personagem cadastrado: level, vocação, mundo, HP/Mana/Cap estimados e faixa de Shared XP
- **Criatura Boostada** e **Boss Boostado** do dia, direto na barra superior

### 🎨 Visual
- Interface no estilo Tibia, usando artes e texturas do [Fan Kit oficial](https://www.tibia.com/fansites/) da CipSoft (fundo, moldura do cabeçalho etc.)
- Pergaminho medieval na tela de login/registro

---

## 🛠️ Tecnologias

- HTML, CSS e JavaScript puro (sem frameworks/build step)
- [Firebase Authentication](https://firebase.google.com/docs/auth) — login e cadastro
- [Firebase Realtime Database](https://firebase.google.com/docs/database) — armazenamento de hunts, drops e compras
- [TibiaData API](https://docs.tibiadata.com/) — dados de personagem, criatura e boss boostados
- [Chart.js](https://www.chartjs.org/) + [chartjs-plugin-datalabels](https://chartjs-plugin-datalabels.netlify.app/) — gráficos

---

## 📂 Estrutura do projeto

```
├── index.html          # Tela de login
├── register.html        # Tela de cadastro
├── dashboard.html        # Painel principal (após login)
├── auth.js               # Configuração do Firebase + lógica de login/registro
├── script.js             # Toda a lógica do dashboard (hunts, drops, compras, gráficos, API)
├── style.css              # Estilos de todo o site
└── fankit-assets/         # Imagens do Fan Kit oficial do Tibia (fundo, texturas)
```

---

## ⚙️ Configuração

Este projeto usa o Firebase como backend. Pra rodar o seu próprio:

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
2. Ative **Authentication** (método de E-mail/Senha) e o **Realtime Database**
3. Copie as credenciais do seu projeto e cole no objeto `firebaseConfig` no início do `auth.js` e do `script.js`
4. Abra o `index.html` num servidor local (ex: extensão Live Server do VS Code) — não funciona abrindo o arquivo direto (`file://`) por causa das regras de CORS do Firebase

---

## 📌 Observações

- Não utilize a mesma senha da sua conta oficial do Tibia ao criar uma conta aqui.
- Sempre que a CipSoft lançar um novo Fan Kit, as imagens em `fankit-assets/` podem ser substituídas (mesmo nome de arquivo) pra atualizar o visual.

---

## 📩 Contato

Criado por **Maicon**.
Dúvidas, sugestões ou críticas: `admintibiaprofit@gmail.com` ou me procure in-game.
