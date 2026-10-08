import { useEffect, useRef, useState } from 'react';
import { api, API_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../router';

// El servidor dice qué proveedores están activos (según sus variables de entorno)
let providersPromise;
const loadProviders = () => {
  providersPromise ||= api('/auth/providers').catch(() => ({ google: null, discord: false }));
  return providersPromise;
};

let gsiPromise;
const loadGoogleScript = () => {
  gsiPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => { gsiPromise = null; reject(new Error('No se pudo cargar Google')); };
    document.head.appendChild(s);
  });
  return gsiPromise;
};

function GoogleButton({ clientId, onError }) {
  const { loginWithGoogle } = useAuth();
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    loadGoogleScript()
      .then((google) => {
        if (!alive || !ref.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            try {
              await loginWithGoogle(credential);
              navigate('/');
            } catch (err) {
              onError(err.message);
            }
          },
        });
        google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          locale: 'es',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, ref.current.offsetWidth || 340)),
        });
      })
      .catch(() => alive && onError('No se pudo cargar el botón de Google'));
    return () => { alive = false; };
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} className="gsi-slot" />;
}

export default function SocialLogin({ onError }) {
  const [providers, setProviders] = useState(null);

  useEffect(() => { loadProviders().then(setProviders); }, []);

  if (!providers || (!providers.google && !providers.discord)) return null;

  const discordHref = `${API_URL}/auth/discord?from=${encodeURIComponent(window.location.origin)}`;

  return (
    <div className="social">
      <div className="auth-divider"><span>o continúa con</span></div>
      {providers.google && <GoogleButton clientId={providers.google} onError={onError} />}
      {providers.discord && (
        <a className="btn btn-discord btn-block" href={discordHref}>
          Continuar con Discord
        </a>
      )}
    </div>
  );
}
