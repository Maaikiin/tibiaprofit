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
    carregarBoostados();

    const refHunts = database.ref(`users/${usuarioAtualUid}/hunts`);
    const refDrops = database.ref(`users/${usuarioAtualUid}/drops`);
    const refCompras = database.ref(`users/${usuarioAtualUid}/compras`);

    const snapshotParaLista = (snapshot) => {
        const lista = [];
        snapshot.forEach((childSnapshot) => {
            lista.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        return lista;
    };

    // Carrega os 3 nós de uma vez só primeiro — garante que os cards de total
    // já aparecem certos assim que a página carrega, sem depender de qual
    // dos três chega primeiro pelo tempo real.
    Promise.all([refHunts.once('value'), refDrops.once('value'), refCompras.once('value')])
        .then(([snapHunts, snapDrops, snapCompras]) => {
            todasAsHunts = snapshotParaLista(snapHunts);
            todosOsDrops = snapshotParaLista(snapDrops);
            todasAsCompras = snapshotParaLista(snapCompras);

            atualizarTabelaHunts();
            atualizarTabelaDrops();
            atualizarTabelaCompras();
            atualizarResumoMensalETotais();
        })
        .catch((erro) => {
            console.error('Erro ao carregar dados iniciais:', erro);
        });

    // A partir daqui, mantém tudo atualizado em tempo real
    refHunts.on('value', (snapshot) => {
        todasAsHunts = snapshotParaLista(snapshot);
        atualizarTabelaHunts();
        atualizarResumoMensalETotais();
    });

    refDrops.on('value', (snapshot) => {
        todosOsDrops = snapshotParaLista(snapshot);
        atualizarTabelaDrops();
        atualizarResumoMensalETotais();
    });

    refCompras.on('value', (snapshot) => {
        todasAsCompras = snapshotParaLista(snapshot);
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
        const inputProfitIndividual = document.getElementById('profitIndividual');
        const profitIndividualValor = inputProfitIndividual ? inputProfitIndividual.value.trim() : '';
        const resultadoDiv = document.getElementById('resultadoDivisaoPt');

        if (resultadoDiv) resultadoDiv.innerHTML = '';

        // ==================== PROFIT INDIVIDUAL (MANUAL) ====================
        // Usado por quem não salva/cola o log completo da Hunt em PT.
        if (profitIndividualValor !== '') {
            const profitManual = parseFloat(profitIndividualValor.replace(',', '.'));

            if (isNaN(profitManual)) {
                alert('Digite um valor numérico válido no campo Profit Individual.');
                return;
            }

            salvarHunt(profitManual, 0, profitManual, () => {
                document.getElementById('logInput').value = '';
                inputProfitIndividual.value = '';
                alert('Profit individual salvo com sucesso!');
            });
            return;
        }

        if (!textoLog.trim()) {
            alert('Cole um log do Session Analyser ou preencha o Profit Individual.');
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

        const linhasLog = textoLog.split('\n');

        // Detecção automática: log de Party Hunt tem "Loot Type:" e mais de uma linha "Balance:"
        // (uma geral da sessão + uma por jogador). Log solo tem apenas uma.
        const ocorrenciasBalance = linhasLog.filter(l => /Balance:/i.test(l)).length;
        const ehPartyHunt = /Loot Type:/i.test(textoLog) || ocorrenciasBalance > 1;

        if (!ehPartyHunt) {
            // ==================== HUNT SOLO ====================
            let valorBalance = 0;
            linhasLog.forEach(linha => {
                const matchBalance = linha.match(/^\s*Balance:\s*([0-9.,\s\u00A0-]+)/i);
                if (matchBalance) valorBalance = limparNumeroTibia(matchBalance[1]);
            });

            const balanceOriginal = valorBalance / 1000000;

            salvarHunt(balanceOriginal, 0, balanceOriginal, () => {
                document.getElementById('logInput').value = '';
                alert('Hunt solo processada e salva com sucesso!');
            });

        } else {
            // ==================== PARTY HUNT ====================
            let jogadores = [];
            let totalBalance = 0;
            let playerAtual = null;

            linhasLog.forEach(linha => {
                if (linha.trim() && !linha.startsWith('\t') && !linha.startsWith(' ') && !["Session", "Loot", "Supplies", "Balance"].some(p => linha.includes(p))) {
                    playerAtual = linha.trim().replace(/\s*\([^)]*\)\s*$/, '');
                }
                if (playerAtual && linha.includes("Balance:")) {
                    const balMatch = linha.match(/Balance:\s*([\d,]+)/);
                    if (balMatch) {
                        const valor = limparNumeroTibia(balMatch[1]) / 1000000;
                        jogadores.push({ nome: playerAtual, balance: valor });
                        totalBalance += valor;
                        playerAtual = null;
                    }
                }
            });

            if (jogadores.length === 0) {
                alert("Não consegui identificar os jogadores dessa Party Hunt.");
                return;
            }

            if (!resultadoDiv) return;

            const media = totalBalance / jogadores.length;

            let pagadores = jogadores.filter(j => j.balance > media).map(j => ({...j, dif: j.balance - media}));
            let recebedores = jogadores.filter(j => j.balance < media).map(j => ({...j, dif: media - j.balance}));

            let listaTransacoes = [];
            pagadores.forEach(p => {
                recebedores.forEach(r => {
                    if (p.dif > 0.001 && r.dif > 0.001) {
                        let valor = Math.min(p.dif, r.dif);
                        const comando = `transfer ${Math.floor(valor*1000000)} to ${r.nome}`;
                        listaTransacoes.push({
                            texto: `${p.nome} to pay ${valor.toFixed(2)}kk to ${r.nome} (Bank: ${comando})`,
                            comando: comando
                        });
                        p.dif -= valor; r.dif -= valor;
                    }
                });
            });

            let html = `<div style="padding: 15px; background: #1e293b; border-radius: 8px; color: #e2e8f0; font-family: sans-serif;">`;
            listaTransacoes.forEach(t => {
                html += `<div style="margin-bottom: 8px; background: #15181f; padding: 10px; border-radius: 4px; display: flex; justify-content: space-between;">
                            <span>${t.texto}</span>
                            <button onclick="navigator.clipboard.writeText('${t.comando}')" style="cursor:pointer;">Copy</button>
                         </div>`;
            });

            html += `<div style="margin-top: 15px; border-top: 1px solid #334155; padding-top: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>Total profit: <b>${totalBalance.toFixed(2)}kk</b> | Média por player: <b>${media.toFixed(2)}kk</b></span>
                            <button id="btnEnviarPt" style="cursor:pointer; padding: 2px 10px;">Send</button>
                        </div>
                     </div>
                     <button id="btnCopyDiscord" style="margin-top: 15px; width: 100%; padding: 10px; cursor:pointer;">Copy all to Discord!</button>
                     </div>`;

            resultadoDiv.innerHTML = html;

            document.getElementById('btnEnviarPt').addEventListener('click', () => {
                salvarHunt(media, 0, media, () => {
                    document.getElementById('logInput').value = '';
                    resultadoDiv.innerHTML = '';
                    alert('Party Hunt processada e salva com sucesso!');
                });
            });

            document.getElementById('btnCopyDiscord').addEventListener('click', () => {
                const textoDiscord = listaTransacoes.map(t => t.texto).join('\n') + `\n\nTotal profit: ${totalBalance.toFixed(2)}kk~ which is: ${media.toFixed(2)}kk~ for each player.`;
                navigator.clipboard.writeText(textoDiscord);
                alert("Copiado!");
            });

            const btnClear = document.createElement('button');
            btnClear.innerText = "Clear";
            btnClear.style.marginTop = "10px";
            btnClear.style.width = "100%";
            btnClear.style.padding = "10px";
            btnClear.style.cursor = "pointer";
            btnClear.style.backgroundColor = "#991b1b";
            btnClear.style.color = "white";
            btnClear.style.border = "none";
            btnClear.style.borderRadius = "4px";

            btnClear.addEventListener('click', () => {
                document.getElementById('logInput').value = "";
                resultadoDiv.innerHTML = "";
            });

            resultadoDiv.appendChild(btnClear);
        }
    });
}

// ==========================================================================
// SALVAR HUNT NO BANCO (usado tanto para Solo quanto para Party Hunt)
// ==========================================================================
function salvarHunt(balanceOriginal, custoBoostKk, profitReal, callback) {
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
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        if (callback) callback();
    }).catch(erro => {
        alert('Erro ao salvar no banco: ' + erro.message);
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
        const nomeFormatado = (drop.item || '').trim();
        const nomeExibido = drop.item || '(sem nome)';
        
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
                ${nomeExibido}
            </td>
            <td style="color: #e2b45c; font-weight: bold;">+${parseFloat(drop.valor || 0).toFixed(2)} kk</td>
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
        const nomeFormatado = (compra.item || '').trim();
        const nomeExibido = compra.item || '(sem nome)';
        const urlImagem = `https://tibia.fandom.com/wiki/Special:FilePath/${nomeFormatado.replace(/ /g, '_')}.gif`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${compra.data}</td>
            <td>${compra.mes || '-'}</td>
            <td>
                <img src="${urlImagem}" 
                     onerror="this.style.display='none'" 
                     style="width: 32px; height: 32px; vertical-align: middle; margin-right: 8px;">
                ${nomeExibido}
            </td>
            <td style="color: #ef4444; font-weight: bold;">-${parseFloat(compra.valor || 0).toFixed(2)} kk</td>
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
let graficoDiarioInstancia = null;

function atualizarResumoMensalETotais() {
    let totalProfitAnual = 0;
    let totalProfitHuntAnual = 0;
    let totalDropsAnual = 0;
    let totalComprasAnual = 0;

    const resumoMensalEstrutura = {};
    const mesesOrdenados = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    mesesOrdenados.forEach(m => {
        resumoMensalEstrutura[m] = { profitTotal: 0 };
    });

    // 1. Soma Hunts
    todasAsHunts.forEach(hunt => {
        const p = parseFloat(hunt.profitReal || 0);
        totalProfitAnual += p;
        totalProfitHuntAnual += p;
        if (resumoMensalEstrutura[hunt.mes]) {
            resumoMensalEstrutura[hunt.mes].profitTotal += p;
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
    if (document.getElementById('totalProfitHunt')) document.getElementById('totalProfitHunt').innerText = `${totalProfitHuntAnual.toFixed(2)} kk`;
    if (document.getElementById('totalProfit')) document.getElementById('totalProfit').innerText = `${totalProfitAnual.toFixed(2)} kk`;
    if (document.getElementById('totalDropsValue')) document.getElementById('totalDropsValue').innerText = `${totalDropsAnual.toFixed(2)} kk`;
    if (document.getElementById('totalComprasValue')) document.getElementById('totalComprasValue').innerText = `${totalComprasAnual.toFixed(2)} kk`;

    const corpoResumo = document.getElementById('corpoResumo');
    if (!corpoResumo) return;
    corpoResumo.innerHTML = '';

    mesesOrdenados.forEach(mes => {
        const dadosDoMes = resumoMensalEstrutura[mes];
        if (dadosDoMes.profitTotal !== 0) {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.title = 'Clique para ver o acompanhamento diário deste mês';
            tr.innerHTML = `
                <td style="color: #d1a140; font-weight: bold;">${mes}</td>
                <td style="color: ${dadosDoMes.profitTotal >= 0 ? '#00ff66' : '#ff3333'}">${dadosDoMes.profitTotal.toFixed(2)} kk</td>
            `;
            tr.addEventListener('click', () => mostrarGraficoDiario(mes));
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

    mesesRotulos.forEach(m => {
        dadosLucro.push(dadosAgrupados[m].profitTotal);
    });

    const canvasProfit = document.getElementById('chartProfit');

    if (typeof Chart === 'undefined' || !canvasProfit) return;
    if (canvasProfit.clientWidth === 0) return;

    if (graficoProfitInstancia) graficoProfitInstancia.destroy();

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
            onClick: (evento, elementos) => {
                if (elementos.length > 0) {
                    const mesClicado = mesesRotulos[elementos[0].index];
                    mostrarGraficoDiario(mesClicado);
                }
            },
            onHover: (evento, elementos) => {
                evento.native.target.style.cursor = elementos.length > 0 ? 'pointer' : 'default';
            },
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
}

// ==========================================================================
// ACOMPANHAMENTO DIÁRIO (ao clicar num mês na tabela ou no gráfico mensal)
// ==========================================================================
function mostrarGraficoDiario(mes) {
    const titulo = document.getElementById('tituloGraficoDiario');
    const container = document.getElementById('containerGraficoDiario');
    const canvasDiario = document.getElementById('chartDiario');

    if (!canvasDiario) return;

    // Junta Hunts + Drops - Compras daquele mês, agrupado por dia (campo "data": dd/mm/aaaa)
    const porDia = {};
    const somarNoDia = (dataStr, valor) => {
        if (!dataStr) return;
        porDia[dataStr] = (porDia[dataStr] || 0) + valor;
    };

    todasAsHunts.filter(h => h.mes === mes).forEach(h => somarNoDia(h.data, parseFloat(h.profitReal || 0)));
    todosOsDrops.filter(d => d.mes === mes).forEach(d => somarNoDia(d.data, parseFloat(d.valor || 0)));
    todasAsCompras.filter(c => c.mes === mes).forEach(c => somarNoDia(c.data, -parseFloat(c.valor || 0)));

    const diasOrdenados = Object.keys(porDia).sort((a, b) => {
        const [da, ma, ya] = a.split('/').map(Number);
        const [db, mb, yb] = b.split('/').map(Number);
        return new Date(ya || 0, (ma || 1) - 1, da || 1) - new Date(yb || 0, (mb || 1) - 1, db || 1);
    });

    if (titulo) {
        titulo.style.display = 'block';
        titulo.innerText = diasOrdenados.length > 0
            ? `Acompanhamento Diário — ${mes}`
            : `Acompanhamento Diário — ${mes} (sem lançamentos)`;
    }

    if (diasOrdenados.length === 0) {
        if (container) container.style.display = 'none';
        return;
    }

    const dadosDiarios = diasOrdenados.map(d => porDia[d]);

    if (container) container.style.display = 'block';
    if (typeof Chart === 'undefined') return;

    if (graficoDiarioInstancia) graficoDiarioInstancia.destroy();

    Chart.register(ChartDataLabels);

    const ctxDiario = canvasDiario.getContext('2d');
    graficoDiarioInstancia = new Chart(ctxDiario, {
        type: 'bar',
        data: {
            labels: diasOrdenados,
            datasets: [{
                label: `Profit Líquido Diário — ${mes} (kk)`,
                data: dadosDiarios,
                backgroundColor: dadosDiarios.map(v => v >= 0 ? 'rgba(51, 153, 255, 0.25)' : 'rgba(255, 51, 51, 0.25)'),
                borderColor: dadosDiarios.map(v => v >= 0 ? '#3399ff' : '#ff3333'),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 40, bottom: 10 } },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMin: Math.min(...dadosDiarios, 0),
                    suggestedMax: Math.max(...dadosDiarios, 0) * 1.2
                }
            },
            plugins: {
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'top',
                    offset: 5,
                    color: (context) => context.dataset.data[context.dataIndex] >= 0 ? '#3399ff' : '#ff3333',
                    fontWeight: 'bold',
                    formatter: (value) => value !== 0 ? value.toFixed(2) + ' kk' : ''
                }
            }
        }
    });

    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

// ==========================================================================
// CRIATURA E BOSS BOOSTADOS DO DIA (API TibiaData)
// ==========================================================================
async function carregarBoostados() {
    const imgCriatura = document.getElementById('imgCriaturaBoostada');
    const imgBoss = document.getElementById('imgBossBoostado');

    if (imgCriatura) {
        try {
            const res = await fetch('https://api.tibiadata.com/v4/creatures');
            const data = await res.json();
            const boostada = data.creatures && data.creatures.boosted;
            if (boostada && boostada.image_url) {
                imgCriatura.src = boostada.image_url;
                imgCriatura.title = boostada.name || '';
                imgCriatura.style.visibility = 'visible';
            }
        } catch (e) {
            console.error('Erro ao carregar criatura boostada:', e);
        }
    }

    if (imgBoss) {
        try {
            const res = await fetch('https://api.tibiadata.com/v4/boostablebosses');
            const data = await res.json();
            const bossBoostado = data.boostable_bosses && data.boostable_bosses.boosted;
            if (bossBoostado && bossBoostado.image_url) {
                imgBoss.src = bossBoostado.image_url;
                imgBoss.title = bossBoostado.name || '';
                imgBoss.style.visibility = 'visible';
            }
        } catch (e) {
            console.error('Erro ao carregar boss boostado:', e);
        }
    }
}

async function carregarInfoChar() {
    // AVISO: Dispara se após 3 segundos ainda estiver "Carregando..."
    const alertaCadastro = setTimeout(() => {
        const nomeDisplay = document.getElementById('displayNomeChar');
        if (nomeDisplay && nomeDisplay.innerText === "Carregando...") {
            alert("Olá! Parece que você ainda não cadastrou seu personagem. Clique na engrenagem no canto superior direito para cadastrar.");
        }
    }, 3000);

    database.ref(`users/${usuarioAtualUid}/config`).on('value', async (snapshot) => {
        const config = snapshot.val();
        
        // Se achou um char, cancela o alerta de cadastro
        if (config && config.nomeChar) {
            clearTimeout(alertaCadastro);
        }

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

                // Aplicar a imagem
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