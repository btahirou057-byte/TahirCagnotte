document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button, a');
  if (!btn || !/partager/i.test(btn.textContent)) return;
  e.preventDefault();
  e.stopImmediatePropagation();

  let titre = 'TahirCagnotte';
  let el = btn.parentElement;
  while (el && el !== document.body) {
    const h = el.querySelector('h1,h2,h3,h4');
    if (h) { titre = h.textContent.trim(); break; }
    el = el.parentElement;
  }

  const url = 'https://btahirou057-byte.github.io/TahirCagnotte/';
  const text = 'Aide-moi avec la cagnotte « ' + titre + ' » sur TahirCagnotte';

  try {
    const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
    if (cap) { await cap.share({ title: titre, text: text, url: url, dialogTitle: 'Partager' }); return; }
    if (navigator.share) { await navigator.share({ title: titre, text: text, url: url }); return; }
    await navigator.clipboard.writeText(text + ' ' + url);
    alert('Lien copié !');
  } catch (err) {
    if (!err || err.name !== 'AbortError') prompt('Copie ce lien :', url);
  }
}, true);
