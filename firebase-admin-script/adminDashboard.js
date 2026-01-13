import { initFirebase } from "./firebaseInit.js";

document.addEventListener("DOMContentLoaded", async () => {
  const { auth, db } = await initFirebase();

  // Admin login
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const email = document.getElementById("adminEmail").value;
      const password = document.getElementById("adminPassword").value;

      try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log("Admin logged in:", userCredential.user.email);
      } catch (err) {
        console.error("Login failed:", err);
        alert("Login failed: " + err.message);
      }
    });
  }

  // Fetch bookings if on manageBookings page
  if (db && document.getElementById("bookingsContainer")) {
    const snapshot = await db.collection("bookings").orderBy("createdAt", "desc").get();
    snapshot.forEach(doc => console.log(doc.data()));
  }
});
