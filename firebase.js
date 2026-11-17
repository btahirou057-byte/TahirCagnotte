import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, setDoc,
  query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBB_3ovdYBTv9DKtcipMCKzy9jwrPlCXYE",
  authDomain: "tahirou-cagnotte.firebaseapp.com",
  projectId: "tahirou-cagnotte",
  storageBucket: "tahirou-cagnotte.firebasestorage.app",
  messagingSenderId: "268567867511",
  appId: "1:268567867511:web:c4717dc41d88d76f5cd672"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

async function registerUser(name, email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName: name });
  try {
    await setDoc(doc(db, "users", result.user.uid), {
      name, email, role: "user", createdAt: serverTimestamp()
    });
  } catch (e) { console.error(e); }
  return result.user;
}

async function loginUser(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

async function logoutUser() { await signOut(auth); }

function observeUser(callback) { return onAuthStateChanged(auth, callback); }

async function resetPassword(email) { await sendPasswordResetEmail(auth, email); }

async function uploadCover(file) {
  if (!auth.currentUser) throw new Error("Non connecté");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r = ref(storage, `covers/${auth.currentUser.uid}/${Date.now()}-${safe}`);
  await uploadBytes(r, file, { contentType: file.type });
  return await getDownloadURL(r);
}

async function createCampaign(data) {
  if (!auth.currentUser) throw new Error("Vous devez être connecté.");
  return await addDoc(collection(db, "campaigns"), {
    title: data.title,
    description: data.description,
    goal: Number(data.goal),
    category: data.category,
    endDate: data.endDate,
    coverUrl: data.coverUrl || "",
    collected: 0,
    contributors: 0,
    ownerId: auth.currentUser.uid,
    ownerName: auth.currentUser.displayName || "",
    currency: "XOF",
    status: "active",
    createdAt: serverTimestamp()
  });
}

async function getCampaigns() {
  const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"), limit(100));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export {
  app, auth, db, storage,
  registerUser, loginUser, logoutUser, observeUser, resetPassword,
  uploadCover, createCampaign, getCampaigns
};
