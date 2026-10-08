// Orígenes del frontend permitidos (CLIENT_URL, separados por comas).
// Se ignoran espacios y la "/" final, porque el navegador envía el origen sin barra.
function allowedOrigins() {
  return (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

// Devuelve `candidate` si es un origen permitido; si no, el primero de la lista.
// Sirve para que los enlaces de los correos y el login social vuelvan al mismo dominio
// desde el que entró el cliente (chikakushop.es, www…, onrender.com).
function pickClientOrigin(candidate) {
  const list = allowedOrigins();
  const c = String(candidate || '').trim().replace(/\/+$/, '');
  return list.includes(c) ? c : list[0];
}

module.exports = { allowedOrigins, pickClientOrigin };
