import {
  auth, observeUser, getUserDoc, saveProfile, resetPassword,
  reportCampaign, getReports, removeReport, getAllUsers,
  getCampaigns, setCampaignStatus, removeCampaign, logoutUser
} from "./firebase.js";

const $ = id => document.getElementById(id);

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const fcfa = n => Number(n || 0).toLocaleString("fr-FR") + " FCFA";
const openModal = id => $(id).classList.remove("hidden");
const closeModal = id => $(id).classList.add("hidden");

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

let me = null;
let meDoc = null;

observeUser(async user => {
  me = user;
  meDoc = null;
  if (user) {
    try { meDoc = await getUserDoc(user.uid); } catch (e) { console.error(e); }
  }
});

/* ---------- OUVRIR LE PROFIL ---------- */
document.addEventListener("click", e => {
  if (!me) return;
  if (e.target.closest("#profileBtn") || e.target.closest("#loginBtn")) {
    e.preventDefault();
    e.stopImmediatePropagation();
    openProfile();
  }
}, true);

document.addEventListener("click", e => {
  if (e.target.closest("#profileBox [data-open], #adminBox [data-open]")) {
    closeModal("profileModal");
    closeModal("adminModal");
  }
});

function resizeImage(file, size = 200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const s = Math.min(img.width, img.height);
      canvas.getContext("2d").drawImage(
        img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image")); };
    img.src = url;
  });
}

async function openProfile() {
  if (!me) return;
  try { meDoc = await getUserDoc(me.uid); } catch (e) { console.error(e); }

  const name = me.displayName || (meDoc && meDoc.name) || "";
  const photo = meDoc && meDoc.photo;
  const isAdmin = Boolean(meDoc && meDoc.role === "admin");

  let mine = [];
  try {
    mine = (await getCampaigns()).filter(c => c.ownerId === me.uid);
  } catch (e) { console.error(e); }

  const avatar = /^data:image\/(jpeg|png);base64,/.test(photo || "")
    ? `<img class="avatar" src="${esc(photo)}" alt="Photo de profil">`
    : `<div class="avatar avatar-ph">👤</div>`;

  const mineHTML = mine.length
    ? mine.map(c => `
        <li>
          <span class="txt">${esc(c.title)}
            <span class="badge ${c.status === "active" ? "ok" : "off"}">${c.status === "active" ? "Active" : "Suspendue"}</span>
          </span>
          <div class="mini-actions"><button type="button" data-open="${esc(c.id)}">Voir</button></div>
        </li>`).join("")
    : `<li>Vous n'avez pas encore de cagnotte.</li>`;

  $("profileBox").innerHTML = `
    ${avatar}
    <h2 style="text-align:center">${esc(name)}</h2>
    <p class="profile-email">${esc(me.email)}</p>

    <label for="pName">Nom</label>
    <input id="pName" type="text" maxlength="60" value="${esc(name)}">
    <label for="pPhoto">Photo de profil</label>
    <input id="pPhoto" type="file" accept="image/*">
    <button class="btn-primary" type="button" id="pSave">Enregistrer</button>

    <h3>Mes cagnottes</h3>
    <ul class="mini-list">${mineHTML}</ul>

    <h3>Historique des contributions</h3>
    <p class="empty">Aucune contribution pour le moment. Elles apparaîtront ici quand le paiement sera branché.</p>

    <button class="btn-secondary" type="button" id="pReset">Réinitialiser mon mot de passe</button>
    ${isAdmin ? `<button class="btn-secondary" type="button" id="pAdmin">🛠 Tableau de bord admin</button>` : ""}
    <button class="btn-danger" type="button" id="pLogout">Déconnexion</button>
    <button class="btn-link" type="button" data-close="profileModal">Fermer</button>
  `;
  openModal("profileModal");

  $("pSave").onclick = async () => {
    const newName = $("pName").value.trim();
    const file = $("pPhoto").files[0];
    if (newName.length < 2) return toast("Nom trop court.");
    $("pSave").disabled = true;
    try {
      const data = { name: newName };
      if (file) data.photo = await resizeImage(file);
      await saveProfile(data);
      toast("Profil enregistré !");
      await openProfile();
    } catch (err) {
      console.error(err);
      toast("Enregistrement impossible.");
      $("pSave").disabled = false;
    }
  };

  $("pReset").onclick = async () => {
    try {
      await resetPassword(me.email);
      toast("Lien envoyé par email.");
    } catch (err) {
      console.error(err);
      toast("Envoi impossible.");
    }
  };

  $("pLogout").onclick = async () => {
    try {
      await logoutUser();
      closeModal("profileModal");
      toast("Vous êtes déconnecté.");
    } catch (err) {
      toast("Déconnexion impossible.");
    }
  };

  if (isAdmin) $("pAdmin").onclick = openAdmin;
}

/* ---------- SIGNALER UNE CAGNOTTE ---------- */
new MutationObserver(() => {
  const box = $("detailBox");
  if (box.querySelector("#reportBtn")) return;
  const share = box.querySelector("[data-share]");
  if (!share) return;
  const btn = document.createElement("button");
  btn.id = "reportBtn";
  btn.type = "button";
  btn.className = "btn-report";
  btn.textContent = "🚩 Signaler cette cagnotte";
  btn.dataset.report = share.dataset.share;
  box.appendChild(btn);
}).observe($("detailBox"), { childList: true });

document.addEventListener("click", async e => {
  const r = e.target.closest("[data-report]");
  if (!r) return;
  if (!me) return toast("Connectez-vous pour signaler.");
  const reason = prompt("Pourquoi signalez-vous cette cagnotte ? (300 caractères max)");
  if (!reason || reason.trim().length < 5) return;
  try {
    await reportCampaign(r.dataset.report, reason.trim().slice(0, 300));
    toast("Merci, signalement envoyé.");
  } catch (err) {
    console.error(err);
    toast("Envoi impossible.");
  }
});

/* ---------- TABLEAU DE BORD ADMIN ---------- */
async function openAdmin() {
  if (!meDoc || meDoc.role !== "admin") return;
  closeModal("profileModal");
  $("adminBox").innerHTML = "<h2>🛠 Tableau de bord</h2><p>Chargement...</p>";
  openModal("adminModal");

  try {
    const [users, camps, reports] = await Promise.all([
      getAllUsers(), getCampaigns(), getReports()
    ]);
    const total = camps.reduce((s, c) => s + (Number(c.collected) || 0), 0);

    const reportsHTML = reports.length
      ? reports.map(r => {
          const c = camps.find(x => x.id === r.campaignId);
          return `
            <li>
              <span class="txt"><b>${esc(c ? c.title : "Cagnotte supprimée")}</b><br>${esc(r.reason)}</span>
              <div class="mini-actions">
                ${c ? `<button type="button" data-open="${esc(c.id)}">Voir</button>` : ""}
                <button type="button" data-act="rmreport" data-id="${esc(r.id)}">Ignorer</button>
              </div>
            </li>`;
        }).join("")
      : "<li>Aucun signalement.</li>";

    const campsHTML = camps.length
      ? camps.map(c => `
          <li>
            <span class="txt">${esc(c.title)}<br>
              <span class="badge ${c.status === "active" ? "ok" : "off"}">${c.status === "active" ? "Active" : "Suspendue"}</span>
              ${fcfa(c.collected)}
            </span>
            <div class="mini-actions">
              <button type="button" data-act="toggle" data-id="${esc(c.id)}" data-to="${c.status === "active" ? "suspended" : "active"}">${c.status === "active" ? "Suspendre" : "Activer"}</button>
              <button type="button" class="danger" data-act="del" data-id="${esc(c.id)}">Supprimer</button>
            </div>
          </li>`).join("")
      : "<li>Aucune cagnotte.</li>";

    const usersHTML = users.length
      ? users.map(u => `
          <li>
            <span class="txt">${esc(u.name || "Sans nom")}<br>${esc(u.email || "")}</span>
            <span class="badge ${u.role === "admin" ? "ok" : "off"}">${esc(u.role || "user")}</span>
          </li>`).join("")
      : "<li>Aucun utilisateur.</li>";

    $("adminBox").innerHTML = `
      <h2>🛠 Tableau de bord</h2>
      <div class="admin-stats">
        <div class="stat"><b>${users.length}</b><span>utilisateurs</span></div>
        <div class="stat"><b>${camps.length}</b><span>cagnottes</span></div>
        <div class="stat"><b>${fcfa(total)}</b><span>total collecté (confirmé)</span></div>
        <div class="stat"><b>0</b><span>transactions (paiement à venir)</span></div>
      </div>
      <h3>🚩 Signalements (${reports.length})</h3>
      <ul class="mini-list">${reportsHTML}</ul>
      <h3>Cagnottes</h3>
      <ul class="mini-list">${campsHTML}</ul>
      <h3>Utilisateurs</h3>
      <ul class="mini-list">${usersHTML}</ul>
      <button class="btn-link" type="button" data-close="adminModal">Fermer</button>
    `;
  } catch (err) {
    console.error(err);
    $("adminBox").innerHTML = `
      <h2>🛠 Tableau de bord</h2>
      <p>Chargement impossible. Vérifiez que votre compte est administrateur.</p>
      <button class="btn-link" type="button" data-close="adminModal">Fermer</button>`;
  }
}

$("adminBox").addEventListener("click", async e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const id = b.dataset.id;
  try {
    if (b.dataset.act === "toggle") {
      await setCampaignStatus(id, b.dataset.to);
    } else if (b.dataset.act === "del") {
      if (!confirm("Supprimer cette cagnotte définitivement ?")) return;
      await removeCampaign(id);
    } else if (b.dataset.act === "rmreport") {
      await removeReport(id);
    }
    toast("Fait.");
    openAdmin();
  } catch (err) {
    console.error(err);
    toast("Action refusée.");
  }
});
