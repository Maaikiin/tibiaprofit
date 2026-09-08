let charAtual = "Geral";

// Muda esse valor toda vez que quiser que o modal de novidades apareça de novo pra todo mundo
const VERSAO_ATUAL_PATCH = "2026-09-fix-bloqueio-google";
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
let todasAsPtHunts = [];
let ptHuntsExpandidas = new Set();
let mesesPtHuntsExpandidos = new Set();
let mesesHuntsExpandidos = new Set();
let mesesDropsExpandidos = new Set();
let mesesComprasExpandidos = new Set();
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
    verificarPatchNote();

    const refHunts = database.ref(`users/${usuarioAtualUid}/hunts`);
    const refDrops = database.ref(`users/${usuarioAtualUid}/drops`);
    const refCompras = database.ref(`users/${usuarioAtualUid}/compras`);
    const refPtHunts = database.ref(`users/${usuarioAtualUid}/ptHunts`);

    const snapshotParaLista = (snapshot) => {
        const lista = [];
        snapshot.forEach((childSnapshot) => {
            lista.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        return lista;
    };

    // Carrega os nós de uma vez só primeiro — garante que os cards de total
    // já aparecem certos assim que a página carrega, sem depender de qual
    // deles chega primeiro pelo tempo real.
    Promise.all([refHunts.once('value'), refDrops.once('value'), refCompras.once('value'), refPtHunts.once('value')])
        .then(([snapHunts, snapDrops, snapCompras, snapPtHunts]) => {
            todasAsHunts = snapshotParaLista(snapHunts);
            todosOsDrops = snapshotParaLista(snapDrops);
            todasAsCompras = snapshotParaLista(snapCompras);
            todasAsPtHunts = snapshotParaLista(snapPtHunts);

            atualizarTabelaHunts();
            atualizarTabelaDrops();
            atualizarTabelaCompras();
            atualizarTabelaPtHunts();
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

    refPtHunts.on('value', (snapshot) => {
        todasAsPtHunts = snapshotParaLista(snapshot);
        atualizarTabelaPtHunts();
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
                    const balMatch = linha.match(/Balance:\s*([\d,\-]+)/);
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
                    salvarPtHunt(jogadores, listaTransacoes, totalBalance, media);
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

function salvarPtHunt(jogadores, transacoes, totalBalance, media) {
    const dataAtual = new Date();
    const dataFormatada = dataAtual.toLocaleDateString('pt-BR');
    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const nomeMesAtual = mesesNomes[dataAtual.getMonth()];

    database.ref(`users/${usuarioAtualUid}/ptHunts`).push().set({
        data: dataFormatada,
        mes: nomeMesAtual,
        jogadores: jogadores.map(j => ({ nome: j.nome, balance: parseFloat(j.balance) })),
        transacoes: transacoes.map(t => ({ texto: t.texto, comando: t.comando })),
        totalBalance: parseFloat(totalBalance),
        media: parseFloat(media),
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).catch(erro => {
        console.error('Erro ao salvar histórico da PT hunt:', erro);
    });
}

// ==========================================================================
// LANÇAMENTOS MANUAIS (DROPS E COMPRAS)
// ==========================================================================
const btnLancarDrop = document.getElementById('btnLancarDrop');
if (btnLancarDrop) {
    btnLancarDrop.addEventListener('click', () => {
        const nomeItem = document.getElementById('dropNome').value;
        const valorCampo = document.getElementById('dropValor').value;
        const valorItem = valorCampo === '' ? 0 : parseFloat(valorCampo);

        if (!nomeItem || isNaN(valorItem)) {
            alert('Preencha ao menos o nome do item (o valor pode ficar em branco e ser editado depois).');
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
// ==========================================================================
// ACCORDION MENSAL GENÉRICO (usado nas 3 abas: Hunts, Drops e Compras)
// ==========================================================================
function renderizarAccordionMensal(containerId, itens, expandidosSet, cabecalhos, montarLinha, calcularTotalMes, aoAlternar, textoVazio) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (itens.length === 0) {
        container.innerHTML = `<p style="color:#64748b; padding: 15px 0;">${textoVazio}</p>`;
        return;
    }

    // Agrupa os itens por mês
    const grupos = {};
    itens.forEach(item => {
        const mes = item.mes || 'Sem mês';
        if (!grupos[mes]) grupos[mes] = [];
        grupos[mes].push(item);
    });

    // Ordena os meses pelo lançamento mais recente de cada grupo (mês mais ativo primeiro)
    const mesesOrdenados = Object.keys(grupos).sort((a, b) => {
        const maxA = Math.max(...grupos[a].map(i => i.timestamp || 0));
        const maxB = Math.max(...grupos[b].map(i => i.timestamp || 0));
        return maxB - maxA;
    });

    container.innerHTML = '';

    mesesOrdenados.forEach(mes => {
        const itensDoMes = [...grupos[mes]].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const totalMes = calcularTotalMes(itensDoMes);
        const aberto = expandidosSet.has(mes);

        const grupoDiv = document.createElement('div');
        grupoDiv.style.marginBottom = '10px';
        grupoDiv.style.border = '1px solid #222530';
        grupoDiv.style.borderRadius = '8px';
        grupoDiv.style.overflow = 'hidden';

        const header = document.createElement('div');
        header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:#15181f; cursor:pointer; user-select:none;';
        header.innerHTML = `
            <span style="font-weight:700; color:#fff;">${mes} <span style="color:#64748b; font-weight:400; font-size:0.85rem;">(${itensDoMes.length} ${itensDoMes.length > 1 ? 'itens' : 'item'})</span></span>
            <span style="display:flex; align-items:center; gap:12px;">
                <span style="color: ${totalMes >= 0 ? '#00ff66' : '#ff3333'}; font-weight:700;">${totalMes.toFixed(2)} kk</span>
                <span style="color:#94a3b8; display:inline-block; transform: rotate(${aberto ? '180' : '0'}deg);">▼</span>
            </span>
        `;
        header.addEventListener('click', () => {
            if (expandidosSet.has(mes)) expandidosSet.delete(mes); else expandidosSet.add(mes);
            aoAlternar();
        });

        const corpoGrupo = document.createElement('div');
        corpoGrupo.style.display = aberto ? 'block' : 'none';

        const tabela = document.createElement('table');
        tabela.style.marginTop = '0';
        tabela.innerHTML = `<thead><tr>${cabecalhos.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody></tbody>`;
        const tbody = tabela.querySelector('tbody');
        itensDoMes.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = montarLinha(item);
            tbody.appendChild(tr);
        });

        corpoGrupo.appendChild(tabela);
        grupoDiv.appendChild(header);
        grupoDiv.appendChild(corpoGrupo);
        container.appendChild(grupoDiv);
    });
}

function atualizarTabelaHunts() {
    renderizarAccordionMensal(
        'corpoHunts',
        todasAsHunts,
        mesesHuntsExpandidos,
        ['Data', 'Profit da Hunt', 'Ações'],
        (hunt) => `
            <td>${hunt.data}</td>
            <td style="color: ${hunt.profitReal >= 0 ? '#00ff66' : '#ff3333'}; font-weight: bold;">${parseFloat(hunt.profitReal).toFixed(2)} kk</td>
            <td>
                <button onclick="removerHunt('${hunt.id}')" style="background: #991b1b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Excluir</button>
            </td>
        `,
        (itensDoMes) => itensDoMes.reduce((soma, h) => soma + parseFloat(h.profitReal || 0), 0),
        atualizarTabelaHunts,
        'Nenhuma hunt registrada ainda.'
    );
}

// ==========================================================================
// HISTÓRICO DE PT HUNT (accordion — cada hunt abre/fecha individualmente)
// ==========================================================================
function chaveMesAnoPtHunt(pt) {
    if (pt.data) {
        const partes = pt.data.split('/');
        if (partes.length === 3 && partes[1] && partes[2]) {
            const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const mesIdx = parseInt(partes[1], 10) - 1;
            const nomeMes = mesesNomes[mesIdx] || pt.mes || 'Mês desconhecido';
            return `${nomeMes} de ${partes[2]}`;
        }
    }
    return pt.mes || 'Mês desconhecido';
}

function atualizarTabelaPtHunts() {
    const container = document.getElementById('corpoPtHunts');
    if (!container) return;

    if (todasAsPtHunts.length === 0) {
        container.innerHTML = '<p style="color:#64748b; padding: 15px 0;">Nenhuma Party Hunt registrada ainda.</p>';
        return;
    }

    // Agrupa as PT hunts por mês/ano
    const grupos = {};
    todasAsPtHunts.forEach(pt => {
        const chave = chaveMesAnoPtHunt(pt);
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push(pt);
    });

    // Ordena os grupos pelo lançamento mais recente (mês/ano mais ativo primeiro)
    const gruposOrdenados = Object.keys(grupos).sort((a, b) => {
        const maxA = Math.max(...grupos[a].map(p => p.timestamp || 0));
        const maxB = Math.max(...grupos[b].map(p => p.timestamp || 0));
        return maxB - maxA;
    });

    container.innerHTML = '';

    gruposOrdenados.forEach(chaveMesAno => {
        const ptHuntsDoGrupo = [...grupos[chaveMesAno]].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const mediaTotalGrupo = ptHuntsDoGrupo.reduce((soma, p) => soma + parseFloat(p.media || 0), 0);
        const abertoGrupo = mesesPtHuntsExpandidos.has(chaveMesAno);

        const grupoDiv = document.createElement('div');
        grupoDiv.style.cssText = 'margin-bottom:10px; border:1px solid #222530; border-radius:8px; overflow:hidden;';

        const headerGrupo = document.createElement('div');
        headerGrupo.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:#15181f; cursor:pointer; user-select:none;';
        headerGrupo.innerHTML = `
            <span style="font-weight:700; color:#fff;">${chaveMesAno} <span style="color:#64748b; font-weight:400; font-size:0.85rem;">(${ptHuntsDoGrupo.length} party hunt${ptHuntsDoGrupo.length !== 1 ? 's' : ''})</span></span>
            <span style="display:flex; align-items:center; gap:12px;">
                <span style="color:#00ff66; font-weight:700;">Soma das médias: ${mediaTotalGrupo.toFixed(2)} kk</span>
                <span style="color:#94a3b8; display:inline-block; transform: rotate(${abertoGrupo ? '180' : '0'}deg);">▼</span>
            </span>
        `;
        headerGrupo.addEventListener('click', () => {
            if (mesesPtHuntsExpandidos.has(chaveMesAno)) mesesPtHuntsExpandidos.delete(chaveMesAno); else mesesPtHuntsExpandidos.add(chaveMesAno);
            atualizarTabelaPtHunts();
        });

        const corpoGrupo = document.createElement('div');
        corpoGrupo.style.cssText = `display:${abertoGrupo ? 'block' : 'none'}; padding:10px; background:#0a0b0d;`;

        ptHuntsDoGrupo.forEach(pt => {
            corpoGrupo.appendChild(montarCardPtHunt(pt));
        });

        grupoDiv.appendChild(headerGrupo);
        grupoDiv.appendChild(corpoGrupo);
        container.appendChild(grupoDiv);
    });
}

function montarCardPtHunt(pt) {
    const jogadores = pt.jogadores || [];
    const transacoes = pt.transacoes || [];
    const aberto = ptHuntsExpandidas.has(pt.id);

    const card = document.createElement('div');
    card.style.cssText = 'margin-bottom:10px; border:1px solid #222530; border-radius:8px; overflow:hidden;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:#15181f; cursor:pointer; user-select:none;';
    header.innerHTML = `
        <span style="font-weight:700; color:#fff;">${pt.data || '-'} <span style="color:#64748b; font-weight:400; font-size:0.85rem;">(${jogadores.length} jogador${jogadores.length !== 1 ? 'es' : ''})</span></span>
        <span style="display:flex; align-items:center; gap:12px;">
            <span style="color:#00ff66; font-weight:700;">Média: ${parseFloat(pt.media || 0).toFixed(2)} kk</span>
            <span style="color:#94a3b8; display:inline-block; transform: rotate(${aberto ? '180' : '0'}deg);">▼</span>
        </span>
    `;
    header.addEventListener('click', () => {
        if (ptHuntsExpandidas.has(pt.id)) ptHuntsExpandidas.delete(pt.id); else ptHuntsExpandidas.add(pt.id);
        atualizarTabelaPtHunts();
    });

    const corpo = document.createElement('div');
    corpo.style.display = aberto ? 'block' : 'none';
    corpo.style.padding = '15px';
    corpo.style.background = '#0f1115';

    const tabelaJogadores = document.createElement('table');
    tabelaJogadores.style.marginTop = '0';
    tabelaJogadores.innerHTML = `
        <thead><tr><th>Jogador</th><th>Balance</th></tr></thead>
        <tbody>
            ${jogadores.map(j => `<tr><td>${j.nome}</td><td style="color:${j.balance >= 0 ? '#00ff66' : '#ff3333'}; font-weight:bold;">${parseFloat(j.balance).toFixed(2)} kk</td></tr>`).join('')}
        </tbody>
    `;
    corpo.appendChild(tabelaJogadores);

    if (transacoes.length > 0) {
        const transDiv = document.createElement('div');
        transDiv.style.marginTop = '15px';

        transacoes.forEach(t => {
            const texto = typeof t === 'string' ? t : t.texto;
            const comando = typeof t === 'string' ? extrairComandoDoTexto(t) : t.comando;

            const linha = document.createElement('div');
            linha.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 10px; margin-bottom:6px; background:#15181f; border-radius:4px; color:#cbd5e1; font-size:0.9rem;';
            linha.innerHTML = `<span>${texto}</span>`;

            const btnCopy = document.createElement('button');
            btnCopy.innerText = 'Copy';
            btnCopy.style.cssText = 'cursor:pointer; flex-shrink:0;';
            btnCopy.addEventListener('click', () => navigator.clipboard.writeText(comando || texto));
            linha.appendChild(btnCopy);

            transDiv.appendChild(linha);
        });

        const totalDiv = document.createElement('div');
        totalDiv.style.cssText = 'margin-top: 10px; border-top: 1px solid #334155; padding-top: 10px; color: #e2e8f0; font-size: 0.9rem;';
        totalDiv.innerHTML = `Total profit: <b>${parseFloat(pt.totalBalance || 0).toFixed(2)}kk</b> | Média por player: <b>${parseFloat(pt.media || 0).toFixed(2)}kk</b>`;
        transDiv.appendChild(totalDiv);

        const btnDiscord = document.createElement('button');
        btnDiscord.innerText = 'Copy all to Discord!';
        btnDiscord.style.cssText = 'margin-top: 15px; width: 100%; padding: 10px; cursor:pointer;';
        btnDiscord.addEventListener('click', () => {
            const textoDiscord = transacoes.map(t => typeof t === 'string' ? t : t.texto).join('\n') +
                `\n\nTotal profit: ${parseFloat(pt.totalBalance || 0).toFixed(2)}kk~ which is: ${parseFloat(pt.media || 0).toFixed(2)}kk~ for each player.`;
            navigator.clipboard.writeText(textoDiscord);
            alert('Copiado!');
        });
        transDiv.appendChild(btnDiscord);

        corpo.appendChild(transDiv);
    }

    const acoesDiv = document.createElement('div');
    acoesDiv.style.cssText = 'margin-top:15px; text-align:right;';
    acoesDiv.innerHTML = `<button onclick="removerPtHunt('${pt.id}')" style="background:#991b1b; color:white; border:none; padding:6px 14px; border-radius:4px; cursor:pointer;">Excluir</button>`;
    corpo.appendChild(acoesDiv);

    card.appendChild(header);
    card.appendChild(corpo);
    return card;
}

function extrairComandoDoTexto(texto) {
    const match = texto.match(/Bank:\s*(.+)\)\s*$/);
    return match ? match[1] : texto;
}

function removerPtHunt(ptHuntId) {
    if (confirm("Tem certeza que deseja apagar esta Party Hunt do histórico?")) {
        database.ref(`users/${usuarioAtualUid}/ptHunts/${ptHuntId}`).remove()
            .catch((erro) => {
                alert("Erro ao remover: " + erro.message);
            });
    }
}

function atualizarTabelaDrops() {
    renderizarAccordionMensal(
        'corpoDrops',
        todosOsDrops,
        mesesDropsExpandidos,
        ['Data', 'Item', 'Valor', 'Ações'],
        (drop) => {
            const nomeFormatado = (drop.item || '').trim();
            const nomeExibido = drop.item || '(sem nome)';
            const urlImagem = `https://tibia.fandom.com/wiki/Special:FilePath/${nomeFormatado.replace(/ /g, '_')}.gif`;
            return `
                <td>${drop.data}</td>
                <td>
                    <img src="${urlImagem}" 
                         onerror="this.style.display='none'" 
                         style="width: 32px; height: 32px; vertical-align: middle; margin-right: 8px;">
                    ${nomeExibido}
                </td>
                <td style="color: ${drop.valor ? '#e2b45c' : '#94a3b8'}; font-weight: bold;">
                    ${drop.valor ? '+' + parseFloat(drop.valor).toFixed(2) + ' kk' : 'Aguardando venda'}
                </td>
                <td>
                    <button onclick="editarValorDrop('${drop.id}', ${parseFloat(drop.valor || 0)})" style="background: #2563eb; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Editar Valor</button>
                    <button onclick="removerDrop('${drop.id}')" style="background: #991b1b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Excluir</button>
                </td>
            `;
        },
        (itensDoMes) => itensDoMes.reduce((soma, d) => soma + parseFloat(d.valor || 0), 0),
        atualizarTabelaDrops,
        'Nenhum drop raro registrado ainda.'
    );
}

function editarValorDrop(dropId, valorAtual) {
    const novoValor = prompt('Novo valor de venda (em kk):', valorAtual > 0 ? valorAtual : '');
    if (novoValor === null) return; // cancelou

    const valorConvertido = parseFloat(novoValor.replace(',', '.'));
    if (isNaN(valorConvertido)) {
        alert('Digite um valor numérico válido.');
        return;
    }

    database.ref(`users/${usuarioAtualUid}/drops/${dropId}`).update({
        valor: valorConvertido
    }).catch((erro) => {
        alert('Erro ao atualizar o valor: ' + erro.message);
    });
}

function atualizarTabelaCompras() {
    renderizarAccordionMensal(
        'corpoCompras',
        todasAsCompras,
        mesesComprasExpandidos,
        ['Data', 'Item/Descrição', 'Valor Investido', 'Ações'],
        (compra) => {
            const nomeFormatado = (compra.item || '').trim();
            const nomeExibido = compra.item || '(sem nome)';
            const urlImagem = `https://tibia.fandom.com/wiki/Special:FilePath/${nomeFormatado.replace(/ /g, '_')}.gif`;
            return `
                <td>${compra.data}</td>
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
        },
        (itensDoMes) => -itensDoMes.reduce((soma, c) => soma + parseFloat(c.valor || 0), 0),
        atualizarTabelaCompras,
        'Nenhuma compra registrada ainda.'
    );
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

    let totalProfitMesAtual = 0;
    let totalProfitHuntMesAtual = 0;
    let totalDropsMesAtual = 0;
    let totalComprasMesAtual = 0;

    const resumoMensalEstrutura = {};
    const mesesOrdenados = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const nomeMesAtual = mesesOrdenados[new Date().getMonth()];

    mesesOrdenados.forEach(m => {
        resumoMensalEstrutura[m] = { profitTotal: 0 };
    });

    // 1. Soma Hunts
    todasAsHunts.forEach(hunt => {
        const p = parseFloat(hunt.profitReal || 0);
        totalProfitAnual += p;
        totalProfitHuntAnual += p;
        if (hunt.mes === nomeMesAtual) {
            totalProfitMesAtual += p;
            totalProfitHuntMesAtual += p;
        }
        if (resumoMensalEstrutura[hunt.mes]) {
            resumoMensalEstrutura[hunt.mes].profitTotal += p;
        }
    });

    // 2. Soma Drops
    todosOsDrops.forEach(drop => {
        const v = parseFloat(drop.valor || 0);
        totalDropsAnual += v;
        totalProfitAnual += v;
        if (drop.mes === nomeMesAtual) {
            totalDropsMesAtual += v;
            totalProfitMesAtual += v;
        }
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

        if (compra.mes === nomeMesAtual) {
            totalComprasMesAtual += v;
            totalProfitMesAtual -= v;
        }
        
        // Subtraímos do mês correspondente
        if (resumoMensalEstrutura[compra.mes]) {
            resumoMensalEstrutura[compra.mes].profitTotal -= v;
        }
    });

    // Atualiza os cards do mês atual (topo do dashboard — acompanhamento em tempo real)
    if (document.getElementById('totalProfitMes')) {
        const elProfitMes = document.getElementById('totalProfitMes');
        elProfitMes.innerText = `${totalProfitMesAtual.toFixed(2)} kk`;
        elProfitMes.style.color = totalProfitMesAtual >= 0 ? '#00ff66' : '#ff3333';
    }
    if (document.getElementById('totalProfitHuntMes')) document.getElementById('totalProfitHuntMes').innerText = `${totalProfitHuntMesAtual.toFixed(2)} kk`;
    if (document.getElementById('totalDropsMes')) document.getElementById('totalDropsMes').innerText = `${totalDropsMesAtual.toFixed(2)} kk`;
    if (document.getElementById('totalComprasMes')) document.getElementById('totalComprasMes').innerText = `${totalComprasMesAtual.toFixed(2)} kk`;

    // Atualiza os cards anuais (dentro da aba Resumo Mensal)
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

    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const indiceMes = mesesNomes.indexOf(mes);

    // Descobre o ano a partir de algum lançamento existente naquele mês; se não achar, usa o ano atual
    let anoDetectado = new Date().getFullYear();
    const chaveComData = Object.keys(porDia)[0];
    if (chaveComData) {
        const partesData = chaveComData.split('/');
        if (partesData[2]) anoDetectado = parseInt(partesData[2]);
    }

    // Gera TODOS os dias do mês, com 0 pros dias sem lançamento — mantém a estética do gráfico consistente
    const diasNoMes = indiceMes >= 0 ? new Date(anoDetectado, indiceMes + 1, 0).getDate() : 30;
    const diasOrdenados = [];
    for (let d = 1; d <= diasNoMes; d++) {
        const diaStr = String(d).padStart(2, '0');
        const mesStr = String(indiceMes + 1).padStart(2, '0');
        diasOrdenados.push(`${diaStr}/${mesStr}/${anoDetectado}`);
    }

    const houveLancamento = Object.keys(porDia).length > 0;

    if (titulo) {
        titulo.style.display = 'block';
        titulo.innerText = houveLancamento
            ? `Acompanhamento Diário — ${mes}`
            : `Acompanhamento Diário — ${mes} (sem lançamentos)`;
    }

    if (!houveLancamento) {
        if (container) container.style.display = 'none';
        return;
    }

    const dadosDiarios = diasOrdenados.map(d => porDia[d] || 0);
    const rotulosDias = diasOrdenados.map(d => d.split('/')[0]); // só o número do dia, pro eixo X

    if (container) container.style.display = 'block';
    if (typeof Chart === 'undefined') return;

    if (graficoDiarioInstancia) graficoDiarioInstancia.destroy();

    Chart.register(ChartDataLabels);

    const ctxDiario = canvasDiario.getContext('2d');
    graficoDiarioInstancia = new Chart(ctxDiario, {
        type: 'bar',
        data: {
            labels: rotulosDias,
            datasets: [{
                label: `Profit Líquido Diário — ${mes} (kk)`,
                data: dadosDiarios,
                backgroundColor: dadosDiarios.map(v => v >= 0 ? 'rgba(51, 153, 255, 0.25)' : 'rgba(255, 51, 51, 0.25)'),
                borderColor: dadosDiarios.map(v => v >= 0 ? '#3399ff' : '#ff3333'),
                borderWidth: 2,
                barPercentage: 0.7,
                categoryPercentage: 0.85,
                maxBarThickness: 34
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 40, bottom: 10 } },
            scales: {
                x: {
                    ticks: { autoSkip: false, maxRotation: 0, minRotation: 0 }
                },
                y: {
                    beginAtZero: true,
                    suggestedMin: Math.min(...dadosDiarios, 0),
                    suggestedMax: Math.max(...dadosDiarios, 0) * 1.2
                }
            },
            plugins: {
                datalabels: {
                    display: (context) => context.dataset.data[context.dataIndex] !== 0,
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

// ==========================================================================
// MODAL DE PATCH NOTE (aparece 1x por conta, quando a versão muda)
// ==========================================================================
function verificarPatchNote() {
    database.ref(`users/${usuarioAtualUid}/config/ultimoPatchVisto`).once('value')
        .then((snapshot) => {
            const ultimoVisto = snapshot.val();
            if (ultimoVisto === VERSAO_ATUAL_PATCH) return; // já viu essa versão

            const modal = document.getElementById('modalPatchNote');
            if (modal) modal.style.display = 'flex';
        })
        .catch((erro) => console.error('Erro ao checar patch note:', erro));
}

const btnFecharPatchNote = document.getElementById('btnFecharPatchNote');
if (btnFecharPatchNote) {
    btnFecharPatchNote.addEventListener('click', () => {
        const modal = document.getElementById('modalPatchNote');
        if (modal) modal.style.display = 'none';

        if (usuarioAtualUid) {
            database.ref(`users/${usuarioAtualUid}/config`).update({
                ultimoPatchVisto: VERSAO_ATUAL_PATCH
            });
        }
    });
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