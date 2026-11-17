window.nativeShare = async function (title, text, url) {
  try {
    const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
    if (cap) {
      await cap.share({ title: title, text: text, url: url, dialogTitle: "Partager" });
      return true;
    }
    if (navigator.share) {
      await navigator.share({ title: title, text: text, url: url });
      return true;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return true;
  }
  return false;
};
