import {
  auth, registerUser, loginUser, logoutUser, observeUser,
  resetPassword, uploadCover, createCampaign, getCampaigns
} from "./firebase.js";

const CATEGORIES = ["Santé", "Éducation", "Mariage", "Solidarité", "Famille", "Mosquée", "Projets", "Urgences"];
const $ = id => document.getElementById(id);

let currentUser = null;
let campaigns = [];
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
function cardHTML(c) {
  const goal = Number(c.goal) || 1;
  const collected = Number(c.collected) || 0;
  const pct = Math.min(100, Math.round((collected / goal) * 100));
  const cover = /^https:\/\//.test(c.coverUrl || "")
    ? `<img class="cover" src="${esc(c.coverUrl)}" alt="" loading="lazy">` : "";
  return `
    <div class="campaign-card">
      ${cover}
      <span class="chip-cat">${esc(c.category || "Projets")}</span>
      <h3>${esc(c.title)}</h3>
      <p>${esc(String(c.description || "").slice(0, 140))}</p>
      <p>Organisateur : ${esc(c.ownerName)}</p>
      <p>Collecté : ${fcfa(collected)}</p>
      <p>Objectif : ${fcfa(goal)}</p>
      <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      <p>${pct}% ${c.endDate ? "· " + esc(daysLeft(c.endDate)) : ""}</p>
      <button type="button">Partager ma cagnotte</button>
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

load();
