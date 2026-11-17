import { initializeApp } from
"https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from
"https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from
"https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

// CONFIGURATION TAHIRCAGNOTTE

const firebaseConfig = {
  apiKey: "AIzaSyBB_3ovdYBTv9DKtcipMCKzy9jwrPlCXYE",
  authDomain: "tahirou-cagnotte.firebaseapp.com",
  projectId: "tahirou-cagnotte",
  storageBucket: "tahirou-cagnotte.firebasestorage.app",
  messagingSenderId: "268567867511",
  appId: "1:268567867511:web:c4717dc41d88d76f5cd672"
};

// INITIALISATION

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

// INSCRIPTION
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

// SURVEILLER LA CONNEXION
function observeUser(callback) {
  return onAuthStateChanged(auth, callback);
}

// CREER UNE CAGNOTTE
async function createCampaign(data) {
  if (!auth.currentUser) {
    throw new Error("Vous devez être connecté.");
  }

  return await addDoc(collection(db, "campaigns"), {
    title: data.title,
    description: data.description,
    goal: Number(data.goal),
    collected: 0,
    ownerId: auth.currentUser.uid,
    ownerName: auth.currentUser.displayName || "",
    currency: "XOF",
    status: "active",
    createdAt: serverTimestamp()
  });
}

// AFFICHER LES CAGNOTTES
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

// EXPORTER
export {
  app,
  auth,
  db,
  registerUser,
  loginUser,
  logoutUser,
  observeUser,
  createCampaign,
  getCampaigns
};
