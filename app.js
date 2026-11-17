
/* =================================
   TAHIRCAGNOTTE - APPLICATION
================================= */

const campaigns = [];

let currentUser = null;

// ELEMENTS
const loginBtn = document.getElementById("loginBtn");
const createBtn = document.getElementById("createBtn");
const campaignList = document.getElementById("campaignList");

// CONNEXION / INSCRIPTION
loginBtn.addEventListener("click", () => {
  const action = prompt(
    "1 = Créer un compte\n2 = Se connecter"
  );

  if (action === "1") {
    register();
  } else if (action === "2") {
    login();
  }
});

// CREER UN COMPTE
function register() {
  const name = prompt("Votre nom :");
  const email = prompt("Votre email :");
  const password = prompt("Votre mot de passe :");

  if (!name || !email || !password) {
    alert("Veuillez remplir tous les champs.");
    return;
  }

  const user = {
    name,
    email,
    password
  };

  localStorage.setItem(
    "tahirUser",
    JSON.stringify(user)
  );

  currentUser = user;

  updateAccount();

  alert("Compte de démonstration créé !");
}

// SE CONNECTER
function login() {
  const email = prompt("Votre email :");
  const password = prompt("Votre mot de passe :");

  const savedUser = JSON.parse(
    localStorage.getItem("tahirUser")
  );

  if (
    savedUser &&
    savedUser.email === email &&
    savedUser.password === password
  ) {
    currentUser = savedUser;
    updateAccount();
    alert("Connexion réussie !");
  } else {
    alert("Email ou mot de passe incorrect.");
  }
}

// AFFICHER LE COMPTE
function updateAccount() {
  const section = document.getElementById(
    "accountSection"
  );

  if (currentUser) {
    section.innerHTML = `
      <h2>Bienvenue ${currentUser.name} !</h2>
      <p>Votre espace TahirCagnotte est prêt.</p>
      <button onclick="logout()">Déconnexion</button>
    `;

    loginBtn.textContent = "Mon compte";
  }
}

// DECONNEXION
function logout() {
  currentUser = null;
  loginBtn.textContent = "Connexion";

  document.getElementById(
    "accountSection"
  ).innerHTML = `
    <h2>Bienvenue sur TahirCagnotte</h2>
    <p>Connectez-vous pour gérer vos cagnottes.</p>
  `;
}

// CREER UNE CAGNOTTE
createBtn.addEventListener("click", () => {
  if (!currentUser) {
    alert("Connectez-vous d'abord !");
    return;
  }

  const title = prompt("Titre de votre cagnotte :");
  const description = prompt("Description :");
  const goal = Number(prompt("Objectif en FCFA :"));

  if (
    !title ||
    !description ||
    !Number.isFinite(goal) ||
    goal <= 0
  ) {
    alert("Informations invalides.");
    return;
  }

  const campaign = {
    id: Date.now().toString(),
    title,
    description,
    goal,
    collected: 0,
    owner: currentUser.name
  };

  campaigns.push(campaign);

  displayCampaigns();

  alert("Votre cagnotte a été créée !");
});

// AFFICHER LES CAGNOTTES
function displayCampaigns() {
  campaignList.innerHTML = "";

  campaigns.forEach(campaign => {
    const percentage = Math.min(
      100,
      (campaign.collected / campaign.goal) * 100
    );

    const card = document.createElement("div");

    card.className = "campaign-card";

    card.innerHTML = `
      <h3>${escapeHTML(campaign.title)}</h3>
      <p>${escapeHTML(campaign.description)}</p>
      <p>Organisateur : ${escapeHTML(campaign.owner)}</p>
      <p>Collecté : ${campaign.collected} FCFA</p>
      <p>Objectif : ${campaign.goal} FCFA</p>

      <div class="progress">
        <div class="progress-bar"
          style="width:${percentage}%"></div>
      </div>

      <button onclick="shareCampaign('${campaign.id}')">
        Partager ma cagnotte
      </button>
    `;

    campaignList.appendChild(card);
  });
}

// SECURISER LES TEXTES AFFICHES
function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

// PARTAGER UNE CAGNOTTE
function shareCampaign(id) {
  const campaign = campaigns.find(
    item => item.id === id
  );

  if (!campaign) return;

  const message =
    "Découvrez ma cagnotte : " +
    campaign.title +
    " - Objectif : " +
    campaign.goal +
    " FCFA.";

  if (navigator.share) {
    navigator.share({
      title: "TahirCagnotte",
      text: message,
      url: window.location.href
    }).catch(() => {});
  } else {
    const whatsapp =
      "https://wa.me/?text=" +
      encodeURIComponent(message);

    window.open(whatsapp, "_blank");
  }
}

// RESTAURER LE COMPTE DE DEMONSTRATION
const savedUser = localStorage.getItem("tahirUser");

if (savedUser) {
  try {
    currentUser = JSON.parse(savedUser);
    updateAccount();
  } catch {
    localStorage.removeItem("tahirUser");
  }
}

  
