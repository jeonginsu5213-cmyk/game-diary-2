require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('../game-diary-bot/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const snap = await db.collection('sessions').get();
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.screenshots) {
      data.screenshots.forEach(shot => {
        if (!shot.gameTitle || shot.gameTitle === 'null') {
            console.log(`FB Uncat shot: ${shot.url}, gameTitle: ${shot.gameTitle}`);
        }
      });
    }
  });
}
run();
