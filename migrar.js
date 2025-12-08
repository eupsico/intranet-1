const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id, // garante que o Project ID seja usado
});

const db = admin.firestore();

async function migrarColecao() {
  const snapshot = await db.collection("agendamentos_voluntarios").get();
  const batch = db.batch();

  snapshot.forEach((doc) => {
    const novoRef = db.collection("eventos").doc(doc.id);
    batch.set(novoRef, doc.data());
  });

  await batch.commit();
  console.log("✅ Migração concluída!");
}

migrarColecao().catch((err) => console.error("❌ Erro na migração:", err));
