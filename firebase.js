// firebase.js
import admin from "firebase-admin";

// Parse service account from env (Render needs JSON stringified in env variable)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export { db, admin };