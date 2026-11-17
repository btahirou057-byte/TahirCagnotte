
/* =================================
   TAHIRCAGNOTTE - FIREBASE
================================= */

import { initializeApp } from
"https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from
"https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from
"https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// CONFIGURATION FIREBASE
// Remplace les valeurs par celles de ton projet Firebase.

const firebaseConfig = {
  apiKey: "TON_API_KEY",
  authDomain: "TON_PROJECT_ID.firebaseapp.com",
  projectId: "TON_PROJECT_ID",
  storageBucket: "TON_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "TON_MESSAGING_SENDER_ID",
  appId: "TON_APP_ID"
};

// INITIALISATION
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

// CREER UN COMPTE
async function registerUser(name, email, password) {
  const result = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  await updateProfile(result.user, {
    displayName: name
  });

  return result.user;
}

// CONNEXION
async function loginUser(email, password) {
  const result = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  return result.user;
}

// DECONNEXION
async function logoutUser() {
  await signOut(auth);
}

// SUIVRE LA CONNEXION
function observeUser(callback) {
  return onAuthStateChanged(auth, callback);
}

// CREER UNE CAGNOTTE
async function createCampaign(data) {
  if (!auth.currentUser) {
    throw new Error("Connexion obligatoire.");
  }

  return await addDoc(
    collection(db, "campaigns"),
    {
      title: data.title,
      description: data.description,
      goal: Number(data.goal),
      collected: 0,
      ownerId: auth.currentUser.uid,
      ownerName: auth.currentUser.displayName || "",
      currency: "XOF",
      status: "active",
      createdAt: serverTimestamp()
    }
  );
}

// RECUPERER LES CAGNOTTES
async function getCampaigns() {
  const campaignsQuery = query(
    collection(db, "campaigns"),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(campaignsQuery);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

// EXPORTER LES FONCTIONS
export {
  auth,
  db,
  registerUser,
  loginUser,
  logoutUser,
  observeUser,
  createCampaign,
  getCampaigns
};
