// Envío de correos con la API de Brevo (por HTTPS: Render gratuito bloquea el SMTP).
// Sin BREVO_API_KEY (en local) el correo se muestra en la consola en vez de enviarse.
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendMail({ to, name, subject, html, text }) {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.log(`✉️  [correo no enviado: falta BREVO_API_KEY] Para: ${to}\n   Asunto: ${subject}\n${text}`);
    return { sent: false };
  }
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: process.env.MAIL_FROM, name: process.env.MAIL_FROM_NAME || 'ChikakuShop' },
      to: [{ email: to, ...(name ? { name } : {}) }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) throw new Error(`Brevo respondió ${res.status}: ${await res.text()}`);
  return { sent: true };
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function resetPasswordEmail({ name, link }) {
  const first = String(name || '').split(' ')[0];
  const text = `Hola${first ? ` ${first}` : ''}:

Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de ChikakuShop.
Abre este enlace para elegir una nueva (caduca en 1 hora):

${link}

Si no lo has pedido tú, ignora este correo: tu contraseña no cambiará.`;

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#c8102e;color:#ffffff;padding:20px 28px;font-size:20px;font-weight:bold;letter-spacing:1px">CHIKAKU<span style="font-weight:normal">SHOP</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 14px;font-size:16px">Hola${first ? ` ${escapeHtml(first)}` : ''}:</p>
<p style="margin:0 0 22px;font-size:15px;line-height:1.5">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Pulsa el botón para elegir una nueva. El enlace caduca en <strong>1 hora</strong>.</p>
<p style="margin:0 0 22px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#c8102e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">Restablecer contraseña</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#52525b">Si el botón no funciona, copia este enlace en el navegador:</p>
<p style="margin:0 0 22px;font-size:12px;word-break:break-all"><a href="${escapeHtml(link)}" style="color:#c8102e">${escapeHtml(link)}</a></p>
<p style="margin:0;font-size:13px;color:#52525b">Si no lo has pedido tú, ignora este correo: tu contraseña no cambiará.</p>
</td></tr></table></td></tr></table></body></html>`;

  return { subject: 'Restablece tu contraseña de ChikakuShop', html, text };
}

module.exports = { sendMail, resetPasswordEmail };
