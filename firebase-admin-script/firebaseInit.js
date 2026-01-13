let auth;
let db;

export async function initFirebase() {
  if (firebase.apps.length > 0) return { auth, db }; // already initialized

  try {
    const res = await fetch("/api/firebaseConfig");
    const firebaseConfig = await res.json();

    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();

    console.log("🔥 Firebase initialized securely!");
    return { auth, db };
  } catch (err) {
    console.error("Failed to initialize Firebase:", err);
    throw err;
  }
}
