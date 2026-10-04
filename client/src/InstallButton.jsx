import { useEffect, useState } from 'react';

// Event romba seekirama vandhaalum miss aagaama pidikka module level la kekkurom
let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  window.dispatchEvent(new Event('pwa-ready'));
});

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function InstallButton({ className = '' }) {
  const [ready, setReady] = useState(!!deferred);
  const [installed, setInstalled] = useState(isStandalone());
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    const onReady = () => setReady(true);
    const onInstalled = () => { setInstalled(true); setReady(false); deferred = null; };
    window.addEventListener('pwa-ready', onReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('pwa-ready', onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!ready && !isIos)) return null;

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      setReady(false);
    } else {
      setShowIos(true);
    }
  };

  return (
    <>
      <button
        onClick={install}
        className={className}
        style={{ background: '#0b2545', color: '#fff', border: 0, borderRadius: 999, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}
      >
        ⬇ Install App
      </button>
      {showIos && (
        <p style={{ marginTop: 8, fontSize: 14 }}>
          iPhone la: Safari la <b>Share</b> button → <b>Add to Home Screen</b> click pannunga.
        </p>
      )}
    </>
  );
}