// ==========================================================================
// Coleta diária de XP — roda sozinha todo dia, mesmo com o site fechado.
// Grava no mesmo formato que o dashboard: users/{uid}/xpSnapshots/{aaaa-mm-dd}
// Requer o plano Blaze do Firebase (o consumo deste projeto cabe na cota grátis).
// ==========================================================================
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

const PAUSA_MS = 600; // respeita o rate limit da TibiaData

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// O "dia do Tibia" começa no server save (10:00, horário da Alemanha)
function chaveDiaTibia(data = new Date()) {
    const deslocada = new Date(data.getTime() - 10 * 3600 * 1000);
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(deslocada);
}
const chaveParaData = (c) => { const [a, m, d] = c.split('-'); return `${d}/${m}/${a}`; };

async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return res.json();
}

// Mesma busca binária usada no site (página = 50 personagens, máx. 20 páginas)
async function buscarNasHighscores(nome, level, getPagina, hint) {
    const alvo = nome.trim().toLowerCase();
    const cache = {};
    let requisicoes = 0;
    const pegar = async (p) => {
        if (p < 1 || p > 20) return null;
        if (!(p in cache)) { cache[p] = await getPagina(p); requisicoes++; }
        return cache[p];
    };
    const procurar = (lista, p) => {
        if (!lista) return null;
        const e = lista.find((x) => String(x.name).trim().toLowerCase() === alvo);
        return e ? { xp: e.value, level: e.level, rank: e.rank, pagina: p } : null;
    };

    if (hint) {
        for (const p of [hint, hint - 1, hint + 1]) {
            const r = procurar(await pegar(p), p);
            if (r) return r;
        }
    }

    let lo = 1, hi = 20;
    while (lo <= hi && requisicoes < 10) {
        const p = Math.floor((lo + hi) / 2);
        const lista = await pegar(p);
        if (!lista || lista.length === 0) { hi = p - 1; continue; }
        const r = procurar(lista, p);
        if (r) return r;
        const primeiro = lista[0].level;
        const ultimo = lista[lista.length - 1].level;
        if (level > primeiro) hi = p - 1;
        else if (level < ultimo) lo = p + 1;
        else {
            for (const v of [p - 1, p + 1]) {
                const r2 = procurar(await pegar(v), v);
                if (r2) return r2;
            }
            return null;
        }
    }
    return null;
}

async function listarUids() {
    const uids = [];
    let token;
    do {
        const lote = await admin.auth().listUsers(1000, token);
        lote.users.forEach((u) => uids.push(u.uid));
        token = lote.pageToken;
    } while (token);
    return uids;
}

exports.coletarXpDiario = onSchedule(
    { schedule: '30 12 * * *', timeZone: 'Europe/Berlin', timeoutSeconds: 540, memory: '256MiB' },
    async () => {
        const db = admin.database();
        const chaveDia = chaveDiaTibia();
        const paginasPorMundo = {}; // cache de páginas dentro desta execução
        let coletados = 0, foraDoTop = 0, erros = 0;

        for (const uid of await listarUids()) {
            try {
                const nome = (await db.ref(`users/${uid}/config/nomeChar`).once('value')).val();
                if (!nome) continue;

                const dadosChar = await getJson(`https://api.tibiadata.com/v4/character/${encodeURIComponent(nome)}`);
                const c = dadosChar.character && dadosChar.character.character;
                if (!c || !c.world) continue;
                await dormir(PAUSA_MS);

                // palpite: página onde o char estava na última coleta
                const ult = (await db.ref(`users/${uid}/xpSnapshots`).orderByKey().limitToLast(1).once('value')).val();
                const hint = ult ? Object.values(ult)[0].pagina : 0;

                const getPagina = async (p) => {
                    const k = `${c.world}:${p}`;
                    if (!paginasPorMundo[k]) {
                        await dormir(PAUSA_MS);
                        const j = await getJson(`https://api.tibiadata.com/v4/highscores/${encodeURIComponent(c.world)}/experience/all/${p}`);
                        paginasPorMundo[k] = (j.highscores && j.highscores.highscore_list) || [];
                    }
                    return paginasPorMundo[k];
                };

                const r = await buscarNasHighscores(nome, parseInt(c.level, 10), getPagina, hint);
                if (!r) { foraDoTop++; continue; }

                await db.ref(`users/${uid}/xpSnapshots/${chaveDia}`).set({
                    nome, world: c.world,
                    xp: r.xp, level: r.level, rank: r.rank, pagina: r.pagina,
                    data: chaveParaData(chaveDia),
                    timestamp: admin.database.ServerValue.TIMESTAMP
                });
                coletados++;
            } catch (e) {
                erros++;
                console.error(`Falha ao coletar XP do usuário ${uid}:`, e.message);
            }
        }
        console.log(`Coleta de XP concluída: ${coletados} gravados, ${foraDoTop} fora do top 1000, ${erros} erros.`);
    }
);
