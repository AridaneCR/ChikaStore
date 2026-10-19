import { useState } from 'react';
import { api, qs } from '../../api';
import Icon from '../../components/Icon';
import { Modal, toast } from '../../components/ui';
import { formatCoins, formatEur, orderNo, PAID_WITH, STATUS } from '../../utils/format';

// Exporta a PDF (con «Guardar como PDF» del navegador) los pedidos y los saldos
// de los usuarios de un día, una semana, un mes o un año.

const PERIODS = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes'], ['year', 'Año']];

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const todayStr = () => new Date().toLocaleDateString('en-CA');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dt = (d, withYear = false) => (d
  ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', ...(withYear ? { year: 'numeric' } : {}), hour: '2-digit', minute: '2-digit' }).replace(',', '')
  : '—');
const money = (amount, currency) => (currency === 'EUR' ? formatEur(amount) : `${formatCoins(amount)} CC`);
const signedPair = (inV, outV, currency) => {
  if (!inV && !outV) return '<span class="muted">—</span>';
  const p = [];
  if (inV) p.push(`<span class="pos">+${esc(money(inV, currency))}</span>`);
  if (outV) p.push(`<span class="neg">−${esc(money(outV, currency))}</span>`);
  return p.join('<br>');
};

function reportHtml(r, { includeIdle, logo }) {
  const s = r.summary;
  const mv = s.movements || {};
  const users = includeIdle ? r.users : r.users.filter((u) => u.balanceEurCents || u.balanceCoins || u.eurIn || u.eurOut || u.coinsIn || u.coinsOut || u.orders);
  const title = `ChikakuShop – Informe ${r.key}`;
  const card = (label, value, sub = '') => `<div class="card"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;

  const orderRows = r.orders.map((o) => `
    <tr class="${o.status === 'cancelado' ? 'off' : ''}">
      <td class="nowrap"><b>${esc(orderNo(o.orderNumber))}</b><br><span class="code">${esc(o.code)}</span></td>
      <td class="nowrap">${esc(dt(o.createdAt, r.period === 'year'))}</td>
      <td>${esc(o.customer)}<br><small class="muted">${esc(o.email)}</small></td>
      <td class="items">${o.items.map((i) => `${i.quantity}× ${esc(i.name)}`).join('<br>')}</td>
      <td class="num nowrap"><b>${esc(money(o.total, o.currency))}</b></td>
      <td class="nowrap">${esc(STATUS[o.status]?.label || o.status)}${o.paidWith ? `<br><small class="muted">${esc(PAID_WITH[o.paidWith] || o.paidWith)}</small>` : ''}</td>
    </tr>`).join('');

  const userRows = users.map((u) => `
    <tr class="${u.active ? '' : 'off'}">
      <td>${esc(u.fullName)}${u.role === 'admin' ? ' <small class="tag">admin</small>' : ''}<br><small class="muted">${esc(u.email)}</small></td>
      <td class="num">${u.orders || '<span class="muted">0</span>'}</td>
      <td class="num nowrap">${signedPair(u.eurIn, u.eurOut, 'EUR')}</td>
      <td class="num nowrap">${signedPair(u.coinsIn, u.coinsOut, 'COINS')}</td>
      <td class="num nowrap"><b>${esc(formatEur(u.balanceEurCents))}</b></td>
      <td class="num nowrap cc"><b>${esc(formatCoins(u.balanceCoins))} CC</b></td>
    </tr>`).join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Figtree, 'Segoe UI', Arial, sans-serif; color: #18181b; font-size: 9.5pt; margin: 0; }
  header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #c8102e; padding-bottom: 10px; margin-bottom: 14px; }
  header img { height: 58px; }
  header h1 { font-size: 17pt; margin: 0; letter-spacing: .02em; }
  header h1 span { color: #c8102e; }
  header p { margin: 2px 0 0; color: #555; }
  header .meta { margin-left: auto; text-align: right; color: #666; font-size: 8.5pt; }
  h2 { font-size: 12pt; margin: 18px 0 8px; padding-left: 8px; border-left: 4px solid #c8102e; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 8px 10px; break-inside: avoid; }
  .card span { display: block; color: #666; font-size: 8pt; }
  .card strong { display: block; font-size: 13pt; margin-top: 2px; }
  .card small { color: #777; font-size: 7.5pt; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; } /* el total solo al final, no en cada página */
  th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; color: #555; background: #f3f3f3; padding: 6px; border-bottom: 1px solid #ccc; }
  td { padding: 5px 6px; border-bottom: 1px solid #e6e6e6; vertical-align: top; }
  tr { break-inside: avoid; }
  tfoot td { font-weight: 700; border-top: 2px solid #999; background: #fafafa; }
  .num { text-align: right; }
  .nowrap { white-space: nowrap; }
  .items { font-size: 8.5pt; color: #333; }
  .code { font-family: Consolas, monospace; font-size: 8pt; background: #18181b; color: #fff; border-radius: 3px; padding: 0 4px; }
  .muted { color: #888; }
  .pos { color: #15803d; }
  .neg { color: #b91c1c; }
  .cc { color: #9a6400; }
  .tag { background: #c8102e; color: #fff; border-radius: 3px; padding: 0 3px; font-size: 7pt; }
  tr.off td { color: #999; }
  .empty { color: #888; padding: 12px 0; }
  .note { color: #777; font-size: 8pt; margin-top: 6px; }
  .toolbar { position: sticky; top: 0; background: #fff8f8; border-bottom: 1px solid #f1c4cc; padding: 8px 12px; margin: -8px -8px 12px; display: flex; gap: 10px; align-items: center; font-size: 10pt; }
  .toolbar button { background: #c8102e; color: #fff; border: 0; border-radius: 6px; padding: 7px 14px; font-weight: 700; cursor: pointer; }
  @media screen { body { max-width: 900px; margin: 0 auto; padding: 8px; } }
  @media print { .toolbar { display: none; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">Guardar como PDF</button><span>En el diálogo de impresión elige <b>«Guardar como PDF»</b> como destino.</span></div>
<header>
  ${logo ? `<img src="${logo}" alt="">` : ''}
  <div><h1>CHIKAKU<span>SHOP</span> · Informe</h1><p>${esc(cap(r.label))}</p></div>
  <div class="meta">Generado el ${esc(dt(r.generatedAt, true))}<br>${r.orders.length} pedidos · ${users.length} usuarios</div>
</header>

<h2>Resumen del periodo</h2>
<div class="cards">
  ${card('Pedidos realizados', String(s.orders), `${s.byStatus.cancelado || 0} cancelados`)}
  ${card('Importe pedidos en €', formatEur(s.createdEurCents), 'sin contar cancelados')}
  ${card('Importe pedidos en CC', `${formatCoins(s.createdCoins)} CC`, 'sin contar cancelados')}
  ${card('Pendiente de cobro', formatEur(s.pendingEurCents), `${s.byStatus.sin_pagar || 0} pedidos sin pagar`)}
  ${card('Cobrado en tienda', formatEur(s.cobrado.tienda), 'según fecha de pago')}
  ${card('Cobrado del saldo €', formatEur(s.cobrado.saldo_eur), 'según fecha de pago')}
  ${card('CHIKACOINS canjeadas', `${formatCoins(s.cobrado.coins)} CC`, 'pedidos pagados con CC')}
  ${card('CHIKACOINS regaladas', `${formatCoins(mv.recompensa_COINS || 0)} CC`, 'recompensas por compras')}
  ${card('Saldo € cargado', formatEur(mv.recarga_EUR || 0), 'recargas del admin')}
  ${card('Ajustes de saldo €', formatEur(mv.ajuste_EUR || 0), 'añadido − quitado')}
  ${card('Ajustes de CC', `${formatCoins(mv.ajuste_COINS || 0)} CC`, 'añadido − quitado')}
  ${card('Saldo total de clientes', formatEur(s.totalBalanceEurCents), `${formatCoins(s.totalBalanceCoins)} CC en circulación (hoy)`)}
</div>

<h2>Pedidos (${r.orders.length})</h2>
${r.orders.length ? `<table>
  <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Productos</th><th class="num">Total</th><th>Estado</th></tr></thead>
  <tbody>${orderRows}</tbody>
  <tfoot><tr><td colspan="4">Total (sin cancelados)</td><td class="num nowrap">${esc(formatEur(s.createdEurCents))}<br>${esc(formatCoins(s.createdCoins))} CC</td><td></td></tr></tfoot>
</table>` : '<p class="empty">No hay pedidos en este periodo.</p>'}

<h2>Saldo de los usuarios</h2>
${users.length ? `<table>
  <thead><tr><th>Usuario</th><th class="num">Pedidos</th><th class="num">Mov. € periodo</th><th class="num">Mov. CC periodo</th><th class="num">Saldo € hoy</th><th class="num">CC hoy</th></tr></thead>
  <tbody>${userRows}</tbody>
  <tfoot><tr><td colspan="4">Total</td><td class="num nowrap">${esc(formatEur(users.reduce((a, u) => a + u.balanceEurCents, 0)))}</td><td class="num nowrap">${esc(formatCoins(users.reduce((a, u) => a + u.balanceCoins, 0)))} CC</td></tr></tfoot>
</table>
<p class="note">«Mov. periodo»: lo que entró (+) y salió (−) del saldo de cada usuario en el periodo (recargas, pagos, recompensas, devoluciones y ajustes). «Saldo hoy»: saldo en el momento de generar el informe.${includeIdle ? '' : ' Solo usuarios con saldo, pedidos o movimientos.'}</p>` : '<p class="empty">No hay usuarios con saldo ni movimientos.</p>'}

<script>
  // Espera al logo y abre el diálogo de impresión
  window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });
</script>
</body></html>`;
}

// El logo va incrustado en el informe (así sale siempre en el PDF, aunque la pestaña nueva no pueda cargarlo)
let logoPromise;
const loadLogo = () => {
  logoPromise ||= fetch('/chikaku-logo-640.webp')
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('sin logo'))))
    .then((blob) => new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve('');
      fr.readAsDataURL(blob);
    }))
    .catch(() => '');
  return logoPromise;
};

export default function ReportPdf({ onClose }) {
  const [period, setPeriod] = useState('month');
  const [date, setDate] = useState(todayStr());
  const [includeIdle, setIncludeIdle] = useState(false);
  const [busy, setBusy] = useState(false);
  const year = Number(date.slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  const generate = async () => {
    // La ventana se abre ya (dentro del clic) para que el navegador no la bloquee
    const win = window.open('', '_blank');
    if (!win) {
      toast('El navegador ha bloqueado la ventana. Permite las ventanas emergentes para esta web.', 'bad');
      return;
    }
    win.document.write('<p style="font-family:sans-serif;padding:24px">Generando el informe…</p>');
    setBusy(true);
    try {
      const [report, logo] = await Promise.all([api(`/admin/report${qs({ period, date })}`), loadLogo()]);
      win.document.open();
      win.document.write(reportHtml(report, { includeIdle, logo }));
      win.document.close();
      onClose();
    } catch (err) {
      win.close();
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Exportar informe a PDF" subtitle="Pedidos y saldo de los usuarios del periodo que elijas." onClose={onClose}>
      <div className="form">
        <div className="seg seg-full" role="tablist" aria-label="Periodo">
          {PERIODS.map(([k, v]) => (
            <button key={k} type="button" role="tab" aria-selected={period === k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{v}</button>
          ))}
        </div>

        {period === 'day' && <label>Día<input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} /></label>}
        {period === 'week' && (
          <label>Cualquier día de la semana
            <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} />
            <small className="muted">La semana va de lunes a domingo.</small>
          </label>
        )}
        {period === 'month' && (
          <label>Mes
            <input type="month" value={date.slice(0, 7)} max={todayStr().slice(0, 7)} onChange={(e) => setDate(e.target.value ? `${e.target.value}-01` : todayStr())} />
          </label>
        )}
        {period === 'year' && (
          <label>Año
            <select value={year} onChange={(e) => setDate(`${e.target.value}-01-01`)}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        )}

        <label className="check"><input type="checkbox" checked={includeIdle} onChange={(e) => setIncludeIdle(e.target.checked)} /> Incluir usuarios sin saldo, pedidos ni movimientos</label>

        <p className="muted small">Se abrirá el informe en otra pestaña. En el diálogo de impresión elige <strong>«Guardar como PDF»</strong>.</p>

        <div className="form-actions">
          <button type="button" className="btn btn-light" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
            <Icon name="printer" size={16} /> {busy ? 'Generando…' : 'Generar PDF'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
