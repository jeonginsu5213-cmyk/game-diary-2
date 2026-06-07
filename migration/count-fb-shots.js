require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('../game-diary-bot/serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function count() {
  const snap = await db.collection('sessions').get();
  let total = 0;
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.screenshots) {
      total += data.screenshots.length;
    }
  });
  console.log('Total screenshots in Firebase:', total);
}
count();
