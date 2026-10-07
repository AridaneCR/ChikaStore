import { useState } from 'react';
import Icon, { Coin } from '../components/Icon';
import { Brand } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../router';

export default function Login({ mode = 'login' }) {
  const { login, register } = useAuth();
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ identifier: '', password: '', fullName: '', dni: '', email: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) {
        await register({ fullName: form.fullName, dni: form.dni, email: form.email, password: form.password });
      } else {
        await login(form.identifier, form.password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <section className="auth-hero">
        <Brand dark sub="" />
        <div className="auth-hero-copy">
          <h1 className="display">Toda partida empieza en la tienda.</h1>
          <p>Reserva cartas, juegos y snacks online, recógelos en tienda y gana 100 CHIKACOINS por cada euro que gastes.</p>
        </div>
        <div className="auth-perks">
          <div className="perk"><Coin size={32} label /><span><strong>1 € = 100 CC</strong><small>por cada compra</small></span></div>
          <div className="perk"><Icon name="store" size={22} className="red" /><span><strong>Recogida en tienda</strong><small>pagas al recoger</small></span></div>
        </div>
        <svg className="auth-sigil" viewBox="0 0 400 400" aria-hidden="true">
          <circle cx="200" cy="200" r="190" />
          <circle cx="200" cy="200" r="150" />
          <path d="M200 10 365 105v190L200 390 35 295V105Z" />
          <path d="M200 50 330 290H70Z" />
        </svg>
      </section>

      <section className="auth-side">
        <div className="auth-card card">
          <h2>{isRegister ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</h2>
          <p className="muted">{isRegister ? 'Regístrate para reservar y ganar CHIKACOINS.' : 'Entra para ver tu saldo y tus pedidos.'}</p>

          <div className="seg seg-full" role="tablist">
            <a href="#/login" role="tab" aria-selected={!isRegister} className={!isRegister ? 'on' : ''}>Iniciar sesión</a>
            <a href="#/registro" role="tab" aria-selected={isRegister} className={isRegister ? 'on' : ''}>Crear cuenta</a>
          </div>

          <form onSubmit={submit} className="form">
            {isRegister ? (
              <>
                <label>Nombre completo<input required value={form.fullName} onChange={set('fullName')} autoComplete="name" placeholder="Nombre y apellidos" /></label>
                <label>DNI / NIE<input value={form.dni} onChange={set('dni')} placeholder="Opcional · 12345678Z" /></label>
                <label>Correo electrónico<input required type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="tu@correo.com" /></label>
              </>
            ) : (
              <label>Correo electrónico o DNI<input required value={form.identifier} onChange={set('identifier')} autoComplete="username" placeholder="tu@correo.com" /></label>
            )}
            <label>
              Contraseña
              <input required type="password" minLength={isRegister ? 8 : undefined} value={form.password} onChange={set('password')} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="••••••••" />
            </label>

            {!isRegister && (
              <button type="button" className="link-btn align-end" onClick={() => setForgot(!forgot)}>¿Olvidaste tu contraseña?</button>
            )}
            {forgot && !isRegister && (
              <div className="notice">Pásate por la tienda o escríbenos y te ayudamos a recuperar el acceso.</div>
            )}

            {error && <div className="alert">{error}</div>}

            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? 'Un momento…' : isRegister ? 'Crear cuenta' : 'Entrar'} <Icon name="arrowRight" size={16} />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
