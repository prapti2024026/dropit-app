// Keeps open tabs on the latest version of DropIt.
// A tab that was opened before a deploy keeps running the old code (for example a Receive page
// that does not know about direct transfers). Every minute, and whenever the tab comes back into
// view, we compare the app's script name with the one on the server; if it changed, the page
// reloads as soon as no transfer is running in it.
let busy = 0;
let updateReady = false;

const currentScript = () =>
  document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute("src") || null;

const reloadIfIdle = () => {
  if (updateReady && busy === 0) window.location.reload();
};

// Pages call this while a transfer is running, so an update never interrupts it
export const markBusy = (isBusy) => {
  busy = Math.max(0, busy + (isBusy ? 1 : -1));
  if (!isBusy) setTimeout(reloadIfIdle, 1500);
};

const check = async () => {
  const mine = currentScript();
  if (!mine || updateReady) return reloadIfIdle();
  try {
    const html = await fetch(`/index.html?check=${Date.now()}`, { cache: "no-store" }).then((r) => r.text());
    const latest = html.match(/\/assets\/index-[^"']+\.js/)?.[0];
    if (latest && latest !== mine) {
      updateReady = true;
      reloadIfIdle();
    }
  } catch {
    // offline: try again later
  }
};

export const watchForUpdates = () => {
  setInterval(check, 60 * 1000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
};
