import {
  auth, db, registerUser, loginUser, logoutUser, observeUser,
  resetPassword, uploadCover, createCampaign, getCampaigns, getCampaign
} from "./firebase.js";
import {
  collection, query, where, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const BASE_URL = "https://btahirou057-byte.github.io/TahirCagnotte/";
const CATEGORIES = ["Santé", "Éducation", "Mariage", "Solidarité", "Famille", "Mosquée", "Projets", "Urgences"];
const $ = id => document.getElementById(id);

let currentUser = null;
let campaigns = [];
let currentCampaign = null;
let filterCat = "";
let searchText = "";
let onlyMine = false;
let authMode = "login";

/* ---------- OUTILS ---------- */
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const fcfa = n => Number(n || 0).toLocaleString("fr-FR") + " FCFA";

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function daysLeft(endDate) {
  if (!endDate) return "";
  const d = Math.ceil((new Date(endDate + "T23:59:59") - Date.now()) / 86400000);
  return d < 0 ? "Terminée" : d + " j restants";
}

function getById(id) {
  return campaigns.find(x => x.id === id) ||
    (currentCampaign && currentCampaign.id === id ? currentCampaign : null);
}

/* ---------- THEME ---------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  $("themeBtn").textContent = t === "dark" ? "☀️" : "🌙";
}
applyTheme(
  localStorage.getItem("tahirTheme") ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
);
$("themeBtn").addEventListener("click", () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("tahirTheme", t);
  applyTheme(t);
});

/* ---------- FENETRES ---------- */
const openModal = id => $(id).classList.remove("hidden");
const closeModal = id => $(id).classList.add("hidden");

document.addEventListener("click", e => {
  const c = e.target.closest("[data-close]");
  if (c) closeModal(c.dataset.close);
  if (e.target.classList.contains("modal")) e.target.classList.add("hidden");
  if (e.target.closest("#logoutBtn")) doLogout();

  const o = e.target.closest("[data-open]");
  if (o) return openDetail(o.dataset.open);
  const s = e.target.closest("[data-share]");
  if (s) return openShare(s.dataset.share);
  if (e.target.closest("[data-contribute]")) {
    return toast("Le paiement sera bientôt disponible. Aucun don n'est enregistré pour l'instant.");
  }
  const cp = e.target.closest("[data-copy]");
  if (cp) return copyLink(cp.dataset.copy);
  const nt = e.target.closest("[data-native]");
  if (nt) return nativeShareClick(nt.dataset.native);
});

/* ---------- COMPTE ---------- */
function setAuthMode(mode) {
  authMode = mode;
  const labels = {
    login: ["Connexion", "Se connecter"],
    register: ["Créer un compte", "S'inscrire"],
    reset: ["Mot de passe oublié", "Envoyer le lien"]
  }[mode];
  $("authTitle").textContent = labels[0];
  $("authSubmit").textContent = labels[1];
  $("nameRow").classList.toggle("hidden", mode !== "register");
  $("passRow").classList.toggle("hidden", mode === "reset");
  $("toRegister").classList.toggle("hidden", mode === "register");
  $("toLogin").classList.toggle("hidden", mode === "login");
  $("toReset").classList.toggle("hidden", mode !== "login");
}

function openAuth(mode = "login") {
  setAuthMode(mode);
  openModal("authModal");
}

$("toRegister").addEventListener("click", () => setAuthMode("register"));
$("toLogin").addEventListener("click", () => setAuthMode("login"));
$("toReset").addEventListener("click", () => setAuthMode("reset"));

function authError(err) {
  const map = {
    "auth/invalid-email": "Email invalide.",
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
    "auth/user-not-found": "Aucun compte avec cet email.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/email-already-in-use": "Cet email est déjà utilisé.",
    "auth/weak-password": "Mot de passe trop court (6 caractères minimum).",
    "auth/network-request-failed": "Pas de connexion internet.",
    "auth/too-many-requests": "Trop d'essais. Réessayez plus tard.",
    "auth/operation-not-allowed": "Connexion email non activée dans Firebase."
  };
  return map[err && err.code] || "Une erreur est survenue. Réessayez.";
}

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("authName").value.trim();
  const email = $("authEmail").value.trim();
  const pass = $("authPass").value;
  const btn = $("authSubmit");

  if (!email) return toast("Entrez votre email.");
  if (authMode === "register" && !name) return toast("Entrez votre nom.");
  if (authMode !== "reset" && pass.length < 6) return toast("Mot de passe : 6 caractères minimum.");

  btn.disabled = true;
  try {
    if (authMode === "register") {
      await registerUser(name, email, pass);
      currentUser = auth.currentUser;
      updateAccount();
      toast("Compte créé. Bienvenue !");
    } else if (authMode === "login") {
      await loginUser(email, pass);
      toast("Connexion réussie !");
    } else {
      await resetPassword(email);
      toast("Lien de réinitialisation envoyé par email.");
      setAuthMode("login");
      btn.disabled = false;
      return;
    }
    $("authForm").reset();
    closeModal("authModal");
  } catch (err) {
    console.error(err);
    toast(authError(err));
  }
  btn.disabled = false;
});

function updateAccount() {
  const section = $("accountSection");
  if (currentUser) {
    section.innerHTML = `
      <h2>Bienvenue ${esc(currentUser.displayName || currentUser.email)} !</h2>
      <p>Votre espace TahirCagnotte est prêt.</p>
      <button id="logoutBtn" type="button">Déconnexion</button>
    `;
    $("loginBtn").textContent = "Mon compte";
  } else {
    section.innerHTML = `
      <h2>Bienvenue sur TahirCagnotte</h2>
      <p>Connectez-vous pour gérer vos cagnottes.</p>
    `;
    $("loginBtn").textContent = "Connexion";
  }
}

async function doLogout() {
  try {
    await logoutUser();
    onlyMine = false;
    render();
    toast("Vous êtes déconnecté.");
  } catch (err) {
    toast("Déconnexion impossible.");
  }
}

$("loginBtn").addEventListener("click", () => {
  if (currentUser) $("accountSection").scrollIntoView({ behavior: "smooth" });
  else openAuth("login");
});

/* ---------- CREATION ---------- */
$("cCat").innerHTML = CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
$("cDate").min = tomorrow;

$("createBtn").addEventListener("click", () => {
  if (!currentUser) {
    toast("Connectez-vous d'abord !");
    openAuth("login");
    return;
  }
  openModal("createModal");
});

$("createForm").addEventListener("submit", async e => {
  e.preventDefault();
  const title = $("cTitle").value.trim();
  const description = $("cDesc").value.trim();
  const goal = Number($("cGoal").value);
  const category = $("cCat").value;
  const endDate = $("cDate").value;
  const file = $("cPhoto").files[0];

  if (title.length < 3) return toast("Titre trop court.");
  if (description.length < 10) return toast("Description trop courte.");
  if (!Number.isFinite(goal) || goal <= 0 || goal > 1000000000) return toast("Objectif invalide.");
  if (!endDate || endDate < tomorrow) return toast("Choisissez une date de fin à venir.");

  const btn = $("createSubmit");
  btn.disabled = true;
  btn.textContent = "Publication...";

  try {
    let coverUrl = "";
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast("Photo trop lourde (5 Mo max). Publiée sans photo.");
      } else {
        try {
          coverUrl = await uploadCover(file);
        } catch (err) {
          console.error(err);
          toast("Photo non envoyée. Publiée sans photo.");
        }
      }
    }
    await createCampaign({ title, description, goal, category, endDate, coverUrl });
    $("createForm").reset();
    closeModal("createModal");
    toast("Votre cagnotte est publiée !");
    await load();
  } catch (err) {
    console.error(err);
    toast("Publication impossible. Vérifiez votre connexion.");
  }
  btn.disabled = false;
  btn.textContent = "Publier la cagnotte";
});

/* ---------- AFFICHAGE ---------- */
function coverImg(c, cls) {
  return /^https:\/\//.test(c.coverUrl || "")
    ? `<img class="${cls}" src="${esc(c.coverUrl)}" alt="" loading="lazy">` : "";
}

function cardHTML(c) {
  const goal = Number(c.goal) || 1;
  const collected = Number(c.collected) || 0;
  const pct = Math.min(100, Math.round((collected / goal) * 100));
  return `
    <div class="campaign-card">
      ${coverImg(c, "cover")}
      <span class="chip-cat">${esc(c.category || "Projets")}</span>
      <h3>${esc(c.title)}</h3>
      <p>${esc(String(c.description || "").slice(0, 140))}</p>
      <p>Organisateur : ${esc(c.ownerName)}</p>
      <p>Collecté : ${fcfa(collected)}</p>
      <p>Objectif : ${fcfa(goal)}</p>
      <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      <p>${pct}% ${c.endDate ? "· " + esc(daysLeft(c.endDate)) : ""}</p>
      <div class="btn-row">
        <button type="button" data-open="${esc(c.id)}">Voir</button>
        <button type="button" class="btn-light" data-share="${esc(c.id)}">Partager</button>
      </div>
    </div>`;
}

function fill(id, list, emptyMsg) {
  $(id).innerHTML = list.length
    ? list.map(cardHTML).join("")
    : `<p class="empty">${emptyMsg}</p>`;
}

function pctOf(c) {
  return (Number(c.collected) || 0) / (Number(c.goal) || 1);
}

function render() {
  const q = searchText.trim().toLowerCase();
  const active = campaigns.filter(c => c.status === "active");
  const filtering = Boolean(q || filterCat || onlyMine);

  let list = active;
  if (filterCat) list = list.filter(c => c.category === filterCat);
  if (onlyMine) list = list.filter(c => currentUser && c.ownerId === currentUser.uid);
  if (q) {
    list = list.filter(c =>
      [c.title, c.description, c.ownerName].join(" ").toLowerCase().includes(q)
    );
  }

  $("homeSections").classList.toggle("hidden", filtering);
  $("listTitle").textContent = onlyMine ? "Mes cagnottes"
    : filtering ? "Résultats" : "Découvrir les cagnottes";

  if (!filtering) {
    fill("listPopular", [...active].sort((a, b) => (b.collected || 0) - (a.collected || 0)).slice(0, 4),
      "Aucune cagnotte pour le moment.");
    fill("listRecent", active.slice(0, 4), "Aucune cagnotte pour le moment.");
    fill("listNear",
      active.filter(c => pctOf(c) >= 0.5 && pctOf(c) < 1)
        .sort((a, b) => pctOf(b) - pctOf(a)).slice(0, 4),
      "Aucune cagnotte proche de son objectif.");
  }

  $("campaignList").innerHTML = list.length
    ? list.map(cardHTML).join("")
    : `<p class="empty">${onlyMine ? "Vous n'avez pas encore de cagnotte." : "Aucune cagnotte trouvée."}</p>`;
}

/* ---------- PAGE D'UNE CAGNOTTE ---------- */
async function openDetail(id) {
  let c = campaigns.find(x => x.id === id);
  if (!c) {
    try { c = await getCampaign(id); } catch (err) { console.error(err); }
  }
  if (!c) return toast("Cagnotte introuvable.");
  currentCampaign = c;

  const goal = Number(c.goal) || 1;
  const collected = Number(c.collected) || 0;
  const pct = Math.min(100, Math.round((collected / goal) * 100));

  $("detailBox").innerHTML = `
    ${coverImg(c, "detail-cover")}
    <span class="chip-cat">${esc(c.category || "Projets")}</span>
    <h2>${esc(c.title)}</h2>
    <p>Organisateur : ${esc(c.ownerName)}</p>
    <p style="margin:10px 0">${esc(c.description)}</p>
    <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
    <div class="detail-stats">
      <div class="stat"><b>${fcfa(collected)}</b><span>collectés</span></div>
      <div class="stat"><b>${fcfa(goal)}</b><span>objectif</span></div>
      <div class="stat"><b>${Number(c.contributors) || 0}</b><span>contributeurs</span></div>
    </div>
    <p>${pct}% ${c.endDate ? "· " + esc(daysLeft(c.endDate)) : ""}</p>
    <button class="btn-primary" type="button" data-contribute="1" style="margin-top:12px">💚 Contribuer</button>
    <button class="btn-secondary" type="button" data-share="${esc(c.id)}">Partager</button>
    <h3>Dernières contributions</h3>
    <ul class="contrib-list" id="contribList"><li>Chargement...</li></ul>
    <button class="btn-link" type="button" data-close="detailModal">Fermer</button>
  `;
  openModal("detailModal");
  loadContributions(c.id);
}

async function loadContributions(id) {
  const ul = $("contribList");
  if (!ul) return;
  try {
    const snap = await getDocs(query(
      collection(db, "campaigns", id, "contributions"),
      where("status", "==", "confirmed"),
      limit(10)
    ));
    const items = snap.docs.map(d => d.data())
      .sort((a, b) => ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0));
    ul.innerHTML = items.length
      ? items.map(i => `<li><span>${esc(i.name || "Anonyme")}</span><b>${fcfa(i.amount)}</b></li>`).join("")
      : "<li>Aucune contribution pour le moment.</li>";
  } catch (err) {
    console.error(err);
    ul.innerHTML = "<li>Impossible de charger les contributions.</li>";
  }
}

/* ---------- PARTAGE + QR CODE ---------- */
function shareData(c) {
  return {
    url: BASE_URL + "?c=" + encodeURIComponent(c.id),
    text: "Aide-moi avec la cagnotte « " + c.title + " » sur TahirCagnotte"
  };
}

function openShare(id) {
  const c = getById(id);
  if (!c) return;
  const { url, text } = shareData(c);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  const both = encodeURIComponent(text + " " + url);

  $("shareBox").innerHTML = `
    <h2>Partager la cagnotte</h2>
    <p>${esc(c.title)}</p>
    <div class="share-grid">
      <a href="https://wa.me/?text=${both}" target="_blank" rel="noopener">WhatsApp</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a>
      <a href="https://t.me/share/url?url=${u}&text=${t}" target="_blank" rel="noopener">Telegram</a>
      <a href="fb-messenger://share/?link=${u}">Messenger</a>
      <a href="sms:?body=${both}">SMS</a>
      <button type="button" data-copy="${esc(c.id)}">TikTok (copier le lien)</button>
      <button type="button" data-native="${esc(c.id)}">Autres applications</button>
      <button type="button" data-copy="${esc(c.id)}">Copier le lien</button>
    </div>
    <div class="qr-box">
      <img alt="QR code" width="220" height="220"
        src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${u}">
      <p>QR code de la cagnotte</p>
    </div>
    <button class="btn-link" type="button" data-close="shareModal">Fermer</button>
  `;
  openModal("shareModal");
}

async function copyLink(id) {
  const c = getById(id);
  if (!c) return;
  const { url } = shareData(c);
  try {
    await navigator.clipboard.writeText(url);
    toast("Lien copié !");
  } catch (err) {
    prompt("Copiez ce lien :", url);
  }
}

async function nativeShareClick(id) {
  const c = getById(id);
  if (!c) return;
  const { url, text } = shareData(c);
  const ok = window.nativeShare ? await window.nativeShare("TahirCagnotte", text, url) : false;
  if (!ok) copyLink(id);
}

/* ---------- CATEGORIES + RECHERCHE ---------- */
function renderCategories() {
  $("categories").innerHTML = ["", ...CATEGORIES].map(c =>
    `<button type="button" class="cat-chip ${c === filterCat ? "active" : ""}" data-cat="${c}">${c || "Toutes"}</button>`
  ).join("");
}

$("categories").addEventListener("click", e => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  filterCat = b.dataset.cat;
  onlyMine = false;
  renderCategories();
  render();
});

$("searchInput").addEventListener("input", e => {
  searchText = e.target.value;
  onlyMine = false;
  render();
});

/* ---------- NAVIGATION ---------- */
$("homeBtn").addEventListener("click", () => {
  filterCat = ""; searchText = ""; onlyMine = false;
  $("searchInput").value = "";
  renderCategories();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("exploreBtn").addEventListener("click", () => {
  onlyMine = false;
  render();
  $("searchInput").scrollIntoView({ behavior: "smooth", block: "center" });
  $("searchInput").focus();
});

$("myCampaignsBtn").addEventListener("click", () => {
  if (!currentUser) {
    toast("Connectez-vous pour voir vos cagnottes.");
    openAuth("login");
    return;
  }
  onlyMine = true;
  render();
  $("campaignsSection").scrollIntoView({ behavior: "smooth" });
});

$("profileBtn").addEventListener("click", () => {
  if (!currentUser) openAuth("login");
  else $("accountSection").scrollIntoView({ behavior: "smooth" });
});

/* ---------- CHARGEMENT ---------- */
async function load() {
  try {
    campaigns = await getCampaigns();
  } catch (err) {
    console.error(err);
    toast("Impossible de charger les cagnottes.");
  }
  render();
}

renderCategories();

observeUser(user => {
  currentUser = user;
  updateAccount();
  render();
});

load().then(() => {
  const id = new URLSearchParams(location.search).get("c");
  if (id) openDetail(id);
});
