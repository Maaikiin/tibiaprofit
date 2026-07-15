const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Configura o Firebase com a Secret que criamos
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tibia-profit-1d4db-default-rtdb.firebaseio.com/" // Adicione o link do seu realtime database aqui
});

async function rodar() {
  const db = admin.database();
  const usersSnapshot = await db.ref('users').once('value');
  const users = usersSnapshot.val();

  for (const uid in users) {
    const nomeChar = users[uid].config?.nomeChar;
    if (!nomeChar) continue;

    const res = await fetch(`https://api.tibiadata.com/v4/character/${nomeChar}`);
    const data = await res.json();
    const xp = data.character?.character?.experience;

    if (xp) {
      const dataHoje = new Date().toISOString().split('T')[0];
      await db.ref(`users/${uid}/historico_xp/${dataHoje}`).set(xp);
      console.log(`XP de ${nomeChar} atualizada: ${xp}`);
    }
  }
}

rodar();
