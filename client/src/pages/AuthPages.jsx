import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Icon from '../components/Icon';
import { Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../router';
import { AuthLayout } from './Login';

// #/recuperar → pide el correo y envía el enlace
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/auth/forgot', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Recupera tu contraseña</h2>
      {sent ? (
        <>
          <div className="notice" role="status">
            <Icon name="check" size={18} className="red" />
            <span>Si hay una cuenta con <strong>{email}</strong>, te hemos enviado un enlace para crear una contraseña nueva. Caduca en 1 hora; mira también en spam.</span>
          </div>
          <a href="#/login" className="btn btn-light btn-block">Volver a iniciar sesión</a>
        </>
      ) : (
        <>
          <p className="muted">Te enviaremos un enlace a tu correo. También sirve para crear una contraseña si entraste con Google o Discord.</p>
          <form onSubmit={submit} className="form">
            <label>Correo electrónico<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="tu@correo.com" /></label>
            {error && <div className="alert">{error}</div>}
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar enlace'} <Icon name="arrowRight" size={16} />
            </button>
            <a href="#/login" className="link-btn">Volver a iniciar sesión</a>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

// #/restablecer?token=… → elige la contraseña nueva y entra
export function ResetPassword({ query }) {
  const { resetPassword } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const token = query.token;

  // Quita el token de la barra de direcciones
  useEffect(() => {
    if (token) window.history.replaceState(null, '', `${window.location.pathname}#/restablecer`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tokenRef = useRef(token);

  const submit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) return setError('Las contraseñas no coinciden');
    setError('');
    setBusy(true);
    try {
      await resetPassword(tokenRef.current, pw);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
    return undefined;
  };

  if (!tokenRef.current) {
    return (
      <AuthLayout>
        <h2>Enlace no válido</h2>
        <p className="muted">Abre el enlace completo del correo o pide uno nuevo.</p>
        <a href="#/recuperar" className="btn btn-primary btn-block">Pedir otro enlace</a>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2>Nueva contraseña</h2>
      <p className="muted">Al cambiarla se cerrará la sesión en los demás dispositivos.</p>
      <form onSubmit={submit} className="form">
        <label>Contraseña nueva<input required type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="Mínimo 8 caracteres" /></label>
        <label>Repite la contraseña<input required type="password" minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" placeholder="••••••••" /></label>
        {error && (
          <div className="alert">
            {error} {/caducado|válido/.test(error) && <a href="#/recuperar">Pedir otro enlace</a>}
          </div>
        )}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar y entrar'} <Icon name="arrowRight" size={16} />
        </button>
      </form>
    </AuthLayout>
  );
}

// #/social?code=… → vuelta de Discord: cambia el código por la sesión
export function SocialCallback({ query }) {
  const { exchangeSocialCode } = useAuth();
  const [error, setError] = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return; // StrictMode monta dos veces: el código es de un solo uso
    done.current = true;
    const { code } = query;
    window.history.replaceState(null, '', `${window.location.pathname}#/social`);
    if (!code) {
      setError('No se pudo completar el inicio de sesión.');
      return;
    }
    exchangeSocialCode(code).then(() => navigate('/')).catch((err) => setError(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthLayout>
      {error ? (
        <>
          <h2>No se pudo entrar</h2>
          <div className="alert">{error}</div>
          <a href="#/login" className="btn btn-primary btn-block">Volver a iniciar sesión</a>
        </>
      ) : (
        <>
          <h2>Entrando…</h2>
          <Spinner />
        </>
      )}
    </AuthLayout>
  );
}
