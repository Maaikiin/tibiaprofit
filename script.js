let charAtual = "Geral";
// ==========================================================================
// CONFIGURAÇÃO DO FIREBASE
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
const database = firebase.database();

let usuarioAtualUid = null;
let todasAsHunts = [];
let todosOsDrops = [];
let todasAsCompras = [];

// ==========================================================================
// CONTROLE DE ACESSO E SESSÃO
// ==========================================================================
auth.onAuthStateChanged((user) => {
    if (user) {
        usuarioAtualUid = user.uid;
        carregarDadosDoUsuario();
    } else {
        window.location.href = "index.html";
    }
});

const btnSair = document.getElementById('btnSair');
if (btnSair) {
    btnSair.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = "index.html";
        });
    });
}

const btnResetarDados = document.getElementById('btnResetarDados');
if (btnResetarDados) {
    btnResetarDados.addEventListener('click', () => {
        if (!usuarioAtualUid) {
            alert('Usuário não identificado.');
            return;
        }

        const confirmarExclusao = confirm("ATENÇÃO:\n\nIsso apagará permanentemente todas as suas Hunts, Drops e Compras do banco de dados!\n\nTem certeza absoluta que deseja resetar suas informações?");
        
        if (confirmarExclusao) {
            database.ref(`users/${usuarioAtualUid}`).remove()
                .then(() => {
                    alert('Todos os seus dados foram resetados com sucesso!');
                })
                .catch((erro) => {
                    alert('Erro ao resetar os dados: ' + erro.message);
                });
        }
    });
}

// ==========================================================================
// SISTEMA DE ABAS (NAVEGAÇÃO)
// ==========================================================================
const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const targetTab = tab.getAttribute('data-tab');
        const targetContent = document.getElementById(`tab-${targetTab}`);
        if (targetContent) {
            targetContent.classList.add('active');
        }

        if (targetTab === 'resumo') {
            atualizarResumoMensalETotais();
        }
    });
});

// ==========================================================================
// CARREGAMENTO DE DADOS DO BANCO (FIREBASE)
// ==========================================================================
function carregarDadosDoUsuario() {
    if (!usuarioAtualUid) return;

    carregarInfoChar();

    database.ref(`users/${usuarioAtualUid}/hunts`).on('value', (snapshot) => {
        todasAsHunts = [];
        snapshot.forEach((childSnapshot) => {
            todasAsHunts.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        atualizarTabelaHunts();
        atualizarResumoMensalETotais();
    });

    database.ref(`users/${usuarioAtualUid}/drops`).on('value', (snapshot) => {
        todosOsDrops = [];
        snapshot.forEach((childSnapshot) => {
            todosOsDrops.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        atualizarTabelaDrops();
        atualizarResumoMensalETotais();
    });

    database.ref(`users/${usuarioAtualUid}/compras`).on('value', (snapshot) => {
        todasAsCompras = [];
        snapshot.forEach((childSnapshot) => {
            todasAsCompras.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        atualizarTabelaCompras();
        atualizarResumoMensalETotais();
    });
}

// ==========================================================================
// PROCESSAMENTO DO LOG DA CALCULADORA (SESSION ANALYSER)
// ==========================================================================
const btnCalcular = document.getElementById('btnCalcular');
if (btnCalcular) {
    btnCalcular.addEventListener('click', () => {
        const textoLog = document.getElementById('logInput').value;
        if (!textoLog.trim()) {
            alert('Por favor, cole um log do Session Analyser válido.');
            return;
        }

        const limparNumeroTibia = (numStr) => {
            if (!numStr) return 0;
            let limpo = numStr.trim().replace(/[\s\u00A0]/g, '');

            if (limpo.includes(',') && limpo.includes('.')) {
                if (limpo.indexOf('.') < limpo.indexOf(',')) {
                    limpo = limpo.replace(/\./g, '').replace(',', '.');
                } else {
                    limpo = limpo.replace(/,/g, '');
                }
            } else {
                limpo = limpo.replace(/,/g, '');
            }
            return parseFloat(limpo) || 0;
        };

        let valorBalance = 0;
        let valorXp = 0;

        const linhasLog = textoLog.split('\n');
        linhasLog.forEach(linha => {
            const matchXp = linha.match(/^\s*XP\s+Gain:\s*([0-9.,\s\u00A0-]+)/i);
            const matchBalance = linha.match(/^\s*Balance:\s*([0-9.,\s\u00A0-]+)/i);

            if (matchXp) {
                valorXp = limparNumeroTibia(matchXp[1]);
            }
            if (matchBalance) {
                valorBalance = limparNumeroTibia(matchBalance[1]);
            }
        });

        const balanceOriginal = valorBalance / 1000000; 
        const xpGanha = valorXp / 1000000; 

        const seletorBoost = document.getElementById('boosts');
        const quantidadeBoosts = seletorBoost ? parseInt(seletorBoost.value) : 0;
        
        let custoBoostKk = 0;
        if (quantidadeBoosts === 1) custoBoostKk = 0.90;       
        else if (quantidadeBoosts === 2) custoBoostKk = 2.25;  
        else if (quantidadeBoosts === 3) custoBoostKk = 4.95;  
        else if (quantidadeBoosts === 4) custoBoostKk = 10.35; 
        else if (quantidadeBoosts === 5) custoBoostKk = 21.15; 

        const profitReal = balanceOriginal - custoBoostKk;

        const dataAtual = new Date();
        const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
        const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const nomeMesAtual = mesesNomes[dataAtual.getMonth()];

        database.ref(`users/${usuarioAtualUid}/hunts`).push().set({
            data: dataFormatada,
            mes: nomeMesAtual,
            balanceOriginal: parseFloat(balanceOriginal),
            custoBoost: parseFloat(custoBoostKk),
            profitReal: parseFloat(profitReal),
            xpGanha: parseFloat(xpGanha),
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            document.getElementById('logInput').value = '';
            if (seletorBoost) seletorBoost.value = '0';
            alert('Hunt processada e salva com sucesso!');
        }).catch(erro => {
            alert('Erro ao salvar no banco: ' + erro.message);
        });
    });
}

// ==========================================================================
// LANÇAMENTOS MANUAIS (DROPS E COMPRAS)
// ==========================================================================
const btnLancarDrop = document.getElementById('btnLancarDrop');
if (btnLancarDrop) {
    btnLancarDrop.addEventListener('click', () => {
        const nomeItem = document.getElementById('dropNome').value;
        const valorItem = parseFloat(document.getElementById('dropValor').value);

        if (!nomeItem || isNaN(valorItem)) {
            alert('Preencha o nome do item e o valor em KK corretamente.');
            return;
        }

        const dataAtual = new Date();
        const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

        database.ref(`users/${usuarioAtualUid}/drops`).push().set({
            data: dataAtual.toLocaleDateString('pt-BR'),
            mes: mesesNomes[dataAtual.getMonth()],
            item: nomeItem,
            valor: valorItem,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            document.getElementById('dropNome').value = '';
            document.getElementById('dropValor').value = '';
        });
    });
}

const btnLancarCompra = document.getElementById('btnLancarCompra');
if (btnLancarCompra) {
    btnLancarCompra.addEventListener('click', () => {
        const nomeCompra = document.getElementById('compraNome').value;
        const valorCompra = parseFloat(document.getElementById('compraValor').value);

        if (!nomeCompra || isNaN(valorCompra)) {
            alert('Preencha a descrição e o valor investido em KK corretamente.');
            return;
        }

        const dataAtual = new Date();
        const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

        database.ref(`users/${usuarioAtualUid}/compras`).push().set({
            data: dataAtual.toLocaleDateString('pt-BR'),
            mes: mesesNomes[dataAtual.getMonth()],
            item: nomeCompra,
            valor: valorCompra,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            document.getElementById('compraNome').value = '';
            document.getElementById('compraValor').value = '';
        });
    });
}

// ==========================================================================
// RENDERIZAÇÃO DE TABELAS LOCAIS
// ==========================================================================
function atualizarTabelaHunts() {
    const corpo = document.getElementById('corpoHunts');
    if (!corpo) return;
    corpo.innerHTML = '';
    const huntsInvertidas = [...todasAsHunts].reverse();

    huntsInvertidas.forEach(hunt => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${hunt.data}</td>
            <td>${hunt.mes}</td>
            <td style="color: ${hunt.balanceOriginal >= 0 ? '#00ff66' : '#ff3333'}">${parseFloat(hunt.balanceOriginal).toFixed(2)} kk</td>
            <td style="color: #ffaa00;">${parseFloat(hunt.custoBoost).toFixed(2)} kk</td>
            <td style="color: ${hunt.profitReal >= 0 ? '#00ff66' : '#ff3333'}; font-weight: bold;">${parseFloat(hunt.profitReal).toFixed(2)} kk</td>
            <td style="color: #f3b145;">${parseFloat(hunt.xpGanha).toFixed(2)} kk</td>
            <td>
                <button onclick="removerHunt('${hunt.id}')" style="background: #991b1b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Excluir</button>
            </td>
        `;
        corpo.appendChild(tr);
    });
}

function atualizarTabelaDrops() {
    const corpo = document.getElementById('corpoDrops');
    if (!corpo) return;
    
    corpo.innerHTML = '';
    
    [...todosOsDrops].reverse().forEach(drop => {
        // O Fandom prefere o nome com a primeira letra maiúscula e espaços mantidos
        // Exemplo: "Magic Plate Armor"
        const nomeFormatado = drop.item.trim();
        
        // Esta URL busca a imagem diretamente do servidor de arquivos do Fandom
        // Eles usam um sistema de busca interna que redireciona para a imagem
        const urlImagem = `https://tibia.fandom.com/wiki/Special:FilePath/${nomeFormatado.replace(/ /g, '_')}.gif`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${drop.data}</td>
            <td>${drop.mes}</td>
            <td>
                <img src="${urlImagem}" 
                     onerror="this.style.display='none'" 
                     style="width: 32px; height: 32px; vertical-align: middle; margin-right: 8px;">
                ${drop.item}
            </td>
            <td style="color: #e2b45c; font-weight: bold;">+${parseFloat(drop.valor).toFixed(2)} kk</td>
            <td>
                <button onclick="removerDrop('${drop.id}')" style="background: #991b1b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Excluir</button>
            </td>
        `;
        corpo.appendChild(tr);
    });
}

function atualizarTabelaCompras() {
    const corpo = document.getElementById('corpoCompras');
    if (!corpo) return;
    corpo.innerHTML = ''; // Limpa a tabela antes de desenhar
    
    // Processa a lista de compras
    [...todasAsCompras].reverse().forEach(compra => {
        // Formatação do nome para a URL do Fandom
        const nomeFormatado = compra.item.trim();
        const urlImagem = `https://tibia.fandom.com/wiki/Special:FilePath/${nomeFormatado.replace(/ /g, '_')}.gif`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${compra.data}</td>
            <td>${compra.mes || '-'}</td>
            <td>
                <img src="${urlImagem}" 
                     onerror="this.style.display='none'" 
                     style="width: 32px; height: 32px; vertical-align: middle; margin-right: 8px;">
                ${compra.item}
            </td>
            <td style="color: #ef4444; font-weight: bold;">-${parseFloat(compra.valor).toFixed(2)} kk</td>
            <td>
                <button onclick="removerCompra('${compra.id}')" style="background: #991b1b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Excluir</button>
            </td>
        `;
        corpo.appendChild(tr);
    });
}

// ==========================================================================
// CÁLCULO DE TOTAIS E RESUMO MENSAL
// ==========================================================================
let graficoProfitInstancia = null;
let graficoXpInstancia = null;

function atualizarResumoMensalETotais() {
    let totalProfitAnual = 0;
    let totalXpAnual = 0;
    let totalDropsAnual = 0;
    let totalComprasAnual = 0;

    const resumoMensalEstrutura = {};
    const mesesOrdenados = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    mesesOrdenados.forEach(m => {
        resumoMensalEstrutura[m] = { profitTotal: 0, xpTotal: 0 };
    });

    // 1. Soma Hunts
    todasAsHunts.forEach(hunt => {
        const p = parseFloat(hunt.profitReal || 0);
        const x = parseFloat(hunt.xpGanha || 0);
        totalProfitAnual += p;
        totalXpAnual += x;
        if (resumoMensalEstrutura[hunt.mes]) {
            resumoMensalEstrutura[hunt.mes].profitTotal += p;
            resumoMensalEstrutura[hunt.mes].xpTotal += x;
        }
    });

    // 2. Soma Drops
    todosOsDrops.forEach(drop => {
        const v = parseFloat(drop.valor || 0);
        totalDropsAnual += v;
        totalProfitAnual += v;
        if (resumoMensalEstrutura[drop.mes]) {
            resumoMensalEstrutura[drop.mes].profitTotal += v;
        }
    });

    // 3. SUBTRAI COMPRAS (A parte que estava errada)
    todasAsCompras.forEach(compra => {
        const v = parseFloat(compra.valor || 0);
        totalComprasAnual += v;
        
        // Subtraímos do total anual
        totalProfitAnual -= v;
        
        // Subtraímos do mês correspondente
        if (resumoMensalEstrutura[compra.mes]) {
            resumoMensalEstrutura[compra.mes].profitTotal -= v;
        }
    });

    // Atualiza elementos de texto
    if (document.getElementById('totalProfit')) document.getElementById('totalProfit').innerText = `${totalProfitAnual.toFixed(2)} kk`;
    if (document.getElementById('totalXP')) document.getElementById('totalXP').innerText = `${totalXpAnual.toFixed(2)} kk`;
    if (document.getElementById('totalDropsValue')) document.getElementById('totalDropsValue').innerText = `${totalDropsAnual.toFixed(2)} kk`;
    if (document.getElementById('totalComprasValue')) document.getElementById('totalComprasValue').innerText = `${totalComprasAnual.toFixed(2)} kk`;

    const corpoResumo = document.getElementById('corpoResumo');
    if (!corpoResumo) return;
    corpoResumo.innerHTML = '';

    mesesOrdenados.forEach(mes => {
        const dadosDoMes = resumoMensalEstrutura[mes];
        if (dadosDoMes.profitTotal !== 0 || dadosDoMes.xpTotal !== 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color: #d1a140; font-weight: bold;">${mes}</td>
                <td style="color: ${dadosDoMes.profitTotal >= 0 ? '#00ff66' : '#ff3333'}">${dadosDoMes.profitTotal.toFixed(2)} kk</td>
                <td style="color: #f3b145;">${dadosDoMes.xpTotal.toFixed(2)} kk</td>
            `;
            corpoResumo.appendChild(tr);
        }
    });

    const abaResumo = document.getElementById('tab-resumo');
    if (abaResumo && abaResumo.classList.contains('active')) {
        renderizarGraficosDinamicos(resumoMensalEstrutura, mesesOrdenados);
    }
}

function renderizarGraficosDinamicos(dadosAgrupados, mesesRotulos) {
    const dadosLucro = [];
    const dadosExperiencia = [];

    mesesRotulos.forEach(m => {
        dadosLucro.push(dadosAgrupados[m].profitTotal);
        dadosExperiencia.push(dadosAgrupados[m].xpTotal);
    });

    const canvasProfit = document.getElementById('chartProfit');
    const canvasXp = document.getElementById('chartXP');

    if (typeof Chart === 'undefined' || !canvasProfit || !canvasXp) return;
    if (canvasProfit.clientWidth === 0 || canvasXp.clientWidth === 0) return;

    if (graficoProfitInstancia) graficoProfitInstancia.destroy();
    if (graficoXpInstancia) graficoXpInstancia.destroy();

    Chart.register(ChartDataLabels);

    // Gráfico de Profit
    const ctxProfit = canvasProfit.getContext('2d');
    graficoProfitInstancia = new Chart(ctxProfit, {
        type: 'bar',
        data: {
            labels: mesesRotulos,
            datasets: [{
                label: 'Profit Líquido Mensal (kk)',
                data: dadosLucro,
                backgroundColor: dadosLucro.map(v => v >= 0 ? 'rgba(0, 255, 102, 0.25)' : 'rgba(255, 51, 51, 0.25)'),
                borderColor: dadosLucro.map(v => v >= 0 ? '#00ff66' : '#ff3333'),
                borderWidth: 2
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: { padding: { top: 40, bottom: 10 } }, // Espaço superior aumentado
            scales: { 
                y: { 
                    beginAtZero: true,
                    suggestedMin: Math.min(...dadosLucro, 0),
                    suggestedMax: Math.max(...dadosLucro, 0) * 1.2 // Espaço extra no topo[cite: 1]
                } 
            },
            plugins: {
                datalabels: {
                    display: true,
                    anchor: 'end', // Fixado na extremidade[cite: 1]
                    align: 'top',  // Acima da barra[cite: 1]
                    offset: 5,     // Distância da barra[cite: 1]
                    color: (context) => context.dataset.data[context.dataIndex] >= 0 ? '#00ff66' : '#ff3333',
                    fontWeight: 'bold',
                    formatter: (value) => value !== 0 ? value.toFixed(2) + ' kk' : ''
                }
            }
        }
    });

    // Gráfico de XP
    const ctxXp = canvasXp.getContext('2d');
    graficoXpInstancia = new Chart(ctxXp, {
        type: 'line',
        data: {
            labels: mesesRotulos,
            datasets: [{
                label: 'XP Conquistada Mensal (kk)',
                data: dadosExperiencia,
                backgroundColor: 'rgba(243, 177, 69, 0.15)',
                borderColor: '#f3b145',
                borderWidth: 3,
                tension: 0.2,
                fill: true
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: { padding: { top: 40, bottom: 10 } }, // Espaço superior aumentado[cite: 1]
            scales: { 
                y: { 
                    beginAtZero: true,
                    suggestedMax: Math.max(...dadosExperiencia, 1) * 1.2 // Espaço extra no topo[cite: 1]
                } 
            },
            plugins: {
                datalabels: {
                    display: true,
                    anchor: 'end', // Fixado na extremidade[cite: 1]
                    align: 'top',  // Acima do ponto[cite: 1]
                    offset: 5,     // Distância do ponto[cite: 1]
                    color: '#f3b145',
                    fontWeight: 'bold',
                    formatter: (value) => value !== 0 ? value.toFixed(2) + ' kk' : ''
                }
            }
        }
    });
}
// ==========================================================================
// CALCULADORA DE PARTY HUNT (LÓGICA)
// ==========================================================================
const btnCalcularPt = document.getElementById('btnCalcularPt');
if (btnCalcularPt) {
    btnCalcularPt.addEventListener('click', () => {
        const texto = document.getElementById('logInputPt').value;
        const xp = document.getElementById('xpInputPt').value;
        const resultadoDiv = document.getElementById('resultadoDivisaoPt');

        if (!texto) { alert("Cole o log da Party Hunt!"); return; }

        let jogadores = [];
        let totalBalance = 0;

        const linhas = texto.split('\n');
        let playerAtual = null;

        linhas.forEach(linha => {
            if (linha.trim() && !linha.startsWith('\t') && !linha.startsWith(' ') && !["Session", "Loot", "Supplies", "Balance"].some(p => linha.includes(p))) {
                playerAtual = linha.trim();
            }
            if (playerAtual && linha.includes("Balance:")) {
                const balMatch = linha.match(/Balance:\s*([\d,]+)/);
                if (balMatch) {
                    const valor = parseFloat(balMatch[1].replace(/,/g, '')) / 1000000;
                    jogadores.push({ nome: playerAtual, balance: valor });
                    totalBalance += valor;
                    playerAtual = null;
                }
            }
        });

        if (jogadores.length === 0) { alert("Não consegui ler os saldos."); return; }

        const media = totalBalance / jogadores.length;
        let pagadores = jogadores.filter(j => j.balance > media).map(j => ({...j, dif: j.balance - media}));
        let recebedores = jogadores.filter(j => j.balance < media).map(j => ({...j, dif: media - j.balance}));

        let listaTransacoes = [];
        pagadores.forEach(p => {
            recebedores.forEach(r => {
                if (p.dif > 0.001 && r.dif > 0.001) {
                    let valor = Math.min(p.dif, r.dif);
                    listaTransacoes.push(`${p.nome} to pay ${valor.toFixed(2)}kk to ${r.nome} (Bank: transfer ${Math.floor(valor*1000000)} to ${r.nome})`);
                    p.dif -= valor; r.dif -= valor;
                }
            });
        });

        let html = `<div style="color: #e2e8f0; font-family: sans-serif;">`;
        listaTransacoes.forEach(t => {
            html += `<div style="margin-bottom: 8px; background: #1e293b; padding: 10px; border-radius: 4px; display: flex; justify-content: space-between;">
                        <span>${t}</span>
                        <button onclick="navigator.clipboard.writeText('${t}')" style="cursor:pointer;">Copy</button>
                     </div>`;
        });

        let infoXp = xp ? ` | XP: ${xp}kk` : "";
        html += `<div style="margin-top: 15px; border-top: 1px solid #334155; padding-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Total profit: <b>${totalBalance.toFixed(2)}kk</b>${infoXp} | Média por player: <b>${media.toFixed(2)}kk</b></span>
                        <button onclick="enviarParaPlanilha('${xp || 0}kk', '${media.toFixed(2)}kk')" 
                                style="cursor:pointer; padding: 2px 10px;">Send</button>
                    </div>
                 </div>
                 <button id="btnCopyDiscord" style="margin-top: 15px; width: 100%; padding: 10px; cursor:pointer;">Copy all to Discord!</button>
                 </div>`;
        
        resultadoDiv.innerHTML = html;

        document.getElementById('btnCopyDiscord').addEventListener('click', () => {
            const textoDiscord = listaTransacoes.join('\n') + `\n\nTotal profit: ${totalBalance.toFixed(2)}kk${infoXp}~ which is: ${media.toFixed(2)}kk~ for each player.`;
            navigator.clipboard.writeText(textoDiscord);
            alert("Copiado!");
        });
        // ... (o código anterior que te passei)

        // Botão para limpar tudo
        const btnClear = document.createElement('button');
        btnClear.innerText = "Clear";
        btnClear.style.marginTop = "10px";
        btnClear.style.width = "100%";
        btnClear.style.padding = "10px";
        btnClear.style.cursor = "pointer";
        btnClear.style.backgroundColor = "#991b1b"; // Vermelho escuro para indicar apagar
        btnClear.style.color = "white";
        btnClear.style.border = "none";
        btnClear.style.borderRadius = "4px";
        
        btnClear.addEventListener('click', () => {
            document.getElementById('logInputPt').value = "";
            document.getElementById('xpInputPt').value = "";
            resultadoDiv.innerHTML = "";
        });

        resultadoDiv.appendChild(btnClear);
    });
}
    

// Substitua a função atual por esta abaixo:
function enviarParaPlanilha(xp, media) {
    if (!usuarioAtualUid) {
        alert("Usuário não identificado.");
        return;
    }

    const dataAtual = new Date();
    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    // Adiciona como uma entrada na tabela de hunts
    database.ref(`users/${usuarioAtualUid}/hunts`).push().set({
        data: dataAtual.toLocaleDateString('pt-BR'),
        mes: mesesNomes[dataAtual.getMonth()],
        balanceOriginal: parseFloat(media.replace('kk', '')),
        custoBoost: 0, // Custo zero para PT
        profitReal: parseFloat(media.replace('kk', '')),
        xpGanha: parseFloat(xp.replace('kk', '')),
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert("Dados da PT enviados para a tabela com sucesso!");
        // O banco de dados dispara o listener automaticamente e atualiza a tabela
    }).catch(erro => {
        alert("Erro ao enviar: " + erro.message);
    });
}
function removerHunt(huntId) {
    if (confirm("Tem certeza que deseja apagar esta hunt?")) {
        database.ref(`users/${usuarioAtualUid}/hunts/${huntId}`).remove()
            .then(() => {
                alert("Hunt removida com sucesso!");
            })
            .catch((erro) => {
                alert("Erro ao remover: " + erro.message);
            });
    }
}
function removerDrop(dropId) {
    if (confirm("Tem certeza que deseja apagar este drop raro?")) {
        database.ref(`users/${usuarioAtualUid}/drops/${dropId}`).remove()
            .then(() => {
                alert("Drop removido com sucesso!");
            })
            .catch((erro) => {
                alert("Erro ao remover: " + erro.message);
            });
    }
}
function removerCompra(compraId) {
    if (confirm("Tem certeza que deseja apagar este gasto/compra?")) {
        database.ref(`users/${usuarioAtualUid}/compras/${compraId}`).remove()
            .then(() => {
                alert("Gasto removido com sucesso!");
            })
            .catch((erro) => {
                alert("Erro ao remover: " + erro.message);
            });
    }
}
// Lógica para abrir/fechar o menu de configurações
const btnConfig = document.getElementById('btnConfig');
const menuConfig = document.getElementById('menuConfig');

if (btnConfig && menuConfig) {
    btnConfig.addEventListener('click', () => {
        // Se estiver escondido, mostra. Se estiver mostrando, esconde.
        if (menuConfig.style.display === 'none' || menuConfig.style.display === '') {
            menuConfig.style.display = 'flex';
        } else {
            menuConfig.style.display = 'none';
        }
    });
}
async function buscarImagemItem(nomeDoItem) {
    // Formata o nome para o padrão da API (ex: "Falcon Greaves" -> "falcon_greaves")
    const nomeFormatado = nomeDoItem.toLowerCase().replace(/ /g, "_");
    const url = `https://api.tibiadata.com/v4/item/${nomeFormatado}`;

    try {
        const resposta = await fetch(url);
        const dados = await resposta.json();
        return dados.item.image_url; // Retorna o link da imagem
    } catch (erro) {
        console.warn("Imagem não encontrada para:", nomeDoItem);
        return 'https://static.tibia.com/images/items/trash_holder.gif'; // Imagem padrão caso não ache
    }
}
// --- FUNCIONALIDADE DE CHAR (Integrada) ---
const btnCadastrarChar = document.getElementById('btnCadastrarChar');
if (btnCadastrarChar) {
    btnCadastrarChar.addEventListener('click', () => {
        const nome = prompt("Digite o nome do seu Character exatamente como no Tibia:");
        if (nome) {
            database.ref(`users/${usuarioAtualUid}/config`).update({ nomeChar: nome });
            document.getElementById('menuConfig').style.display = 'none';
        }
    });
}

async function carregarInfoChar() {
    database.ref(`users/${usuarioAtualUid}/config`).on('value', async (snapshot) => {
        const config = snapshot.val();
        if (!config || !config.nomeChar) return;

        try {
            const res = await fetch(`https://api.tibiadata.com/v4/character/${config.nomeChar}`);
            const data = await res.json();
            
            if (data.character && data.character.character) {
                const c = data.character.character;
                const lvl = parseInt(c.level);
                const voc = c.vocation;

                // Variáveis Base (Level 8)
                let hp = 185, mana = 50, cap = 470;

                // Cálculos baseados nas suas regras
                if (voc.includes("Knight")) {
                    hp += (lvl - 8) * 15; mana += (lvl - 8) * 5; cap += (lvl - 8) * 25;
                } else if (voc.includes("Paladin")) {
                    hp += (lvl - 8) * 10; mana += (lvl - 8) * 15; cap += (lvl - 8) * 20;
                } else if (voc.includes("Monk")) {
                    hp += (lvl - 8) * 10; mana += (lvl - 8) * 10; cap += (lvl - 8) * 25;
                } else if (voc.includes("Druid") || voc.includes("Sorcerer")) {
                    hp += (lvl - 8) * 5; mana += (lvl - 8) * 30; cap += (lvl - 8) * 10;
                }

                // Cálculo de Shared XP
                const minShared = Math.floor((lvl / 3) * 2);
                const maxShared = Math.floor((lvl / 6) * 9);

                // Lógica da Imagem da Vocação
                const vocImages = {
                    "Knight": "https://www.tibiawiki.com.br/images/archive/4/42/20250307010623%21Avatar_of_Steel.gif",
                    "Paladin": "https://www.tibiawiki.com.br/images/archive/3/3e/20250307010835%21Avatar_of_Light.gif",
                    "Sorcerer": "https://www.tibiawiki.com.br/images/archive/9/9a/20250307010903%21Avatar_of_Storm.gif",
                    "Druid": "https://www.tibiawiki.com.br/images/archive/5/58/20250307010735%21Avatar_of_Nature.gif",
                    "Monk": "https://static.wikia.nocookie.net/tibia/images/c/c6/Avatar_of_Balance_%28Outfit%29.gif/revision/latest?cb=20250225114155&path-prefix=en&format=original"
                };

                let imgUrl = "";
                if (voc.includes("Knight")) imgUrl = vocImages.Knight;
                else if (voc.includes("Paladin")) imgUrl = vocImages.Paladin;
                else if (voc.includes("Sorcerer")) imgUrl = vocImages.Sorcerer;
                else if (voc.includes("Druid")) imgUrl = vocImages.Druid;
                else if (voc.includes("Monk")) imgUrl = vocImages.Monk;

                // Preenchimento dos Elementos
                document.getElementById('displayNomeChar').innerText = config.nomeChar;
                document.getElementById('displayDetalhesChar').innerText = `Lvl: ${lvl} | ${voc} | ${c.world}`;
                document.getElementById('statVida').innerText = hp;
                document.getElementById('statMana').innerText = mana;
                document.getElementById('statCap').innerText = cap;
                document.getElementById('statShared').innerText = `${minShared}-${maxShared}`;

                // Aplicar a imagem (Certifique-se que o elemento com ID 'imgChar' exista no seu HTML)
                const imgElement = document.getElementById('imgChar');
                if (imgElement) {
                    imgElement.style.backgroundImage = `url('${imgUrl}')`;
                    imgElement.style.backgroundSize = "contain";
                    imgElement.style.backgroundRepeat = "no-repeat";
                    imgElement.style.backgroundPosition = "center";
                }
            }
        } catch (e) { console.error("Erro ao carregar char:", e); }
    });
}