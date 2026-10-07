import { useState } from 'react';
import { api } from '../../api';
import Icon from '../../components/Icon';
import { Modal, Spinner, toast } from '../../components/ui';
import { formatCoins, formatEur } from '../../utils/format';
import { downloadBlob, readSpreadsheet, writeXlsx } from '../../utils/spreadsheet';

// Columnas de la plantilla (las mismas que se exportan, para poder editar y volver a importar)
export const IMPORT_HEADERS = ['Nombre *', 'Descripción', 'Categoría', 'Precio € *', 'Precio CC', 'Stock', 'Código de barras', 'Etiquetas', 'URL imagen', 'Visible'];
const WIDTHS = [36, 24, 18, 12, 12, 10, 18, 22, 40, 10];

const ACTION = {
  create: { label: 'Nuevo', tone: 'ok' },
  update: { label: 'Actualizar', tone: 'info' },
  error: { label: 'Error', tone: 'bad' },
  skip: { label: 'Ignorada', tone: 'muted' },
};

/** Exporta los productos a .xlsx con las columnas de importación. */
export function exportProducts(products) {
  const rows = products.map((p) => [
    p.name,
    p.description || '',
    p.category,
    p.priceEurCents / 100,
    p.priceCoins,
    p.stock ?? '',
    p.barcode || '',
    (p.tags || []).join(', '),
    p.imageUrl || '',
    p.active ? 'sí' : 'no',
  ]);
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(writeXlsx({ headers: IMPORT_HEADERS, rows, widths: WIDTHS }), `productos-chikakushop-${date}.xlsx`);
}

export default function ImportProducts({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [onlyProblems, setOnlyProblems] = useState(false);

  const choose = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);
    setError('');
    setBusy(true);
    try {
      const sheet = await readSpreadsheet(f);
      if (!sheet.rows.length) throw new Error('El archivo no tiene productos debajo de las cabeceras');
      setRows(sheet.rows);
      setPreview(await api('/admin/products/import', { method: 'POST', body: { rows: sheet.rows, dryRun: true } }));
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo');
      setRows(null);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await api('/admin/products/import', { method: 'POST', body: { rows, dryRun: false } });
      setResult(res);
      toast(`Importación terminada: ${res.summary.create} nuevos, ${res.summary.update} actualizados`);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const data = result || preview;
  const toSave = preview ? preview.summary.create + preview.summary.update : 0;
  const shown = data ? data.results.filter((r) => !onlyProblems || r.action === 'error' || r.warnings.length) : [];

  return (
    <Modal title="Importar productos desde Excel" subtitle="Crea o actualiza muchos productos de una vez." onClose={onClose} wide>
      {!data && (
        <div className="import-start">
          <ol className="import-steps">
            <li>
              Descarga la <a href="/plantilla-productos.xlsx" download>plantilla de Excel</a> o exporta tus productos actuales para editarlos.
            </li>
            <li>Rellena una fila por producto. Solo son obligatorios el <strong>nombre</strong> y el <strong>precio en €</strong>.</li>
            <li>Sube el archivo: verás una vista previa antes de guardar nada.</li>
          </ol>
          <label className="dropzone dropzone-lg">
            <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={choose} disabled={busy} />
            {busy ? <Spinner /> : (
              <span><Icon name="upload" size={20} /> Elegir archivo .xlsx o .csv</span>
            )}
          </label>
          <p className="hint">
            Si una fila tiene un <strong>código de barras</strong> que ya existe, o el mismo <strong>nombre</strong> que un producto de la tienda, se actualiza ese producto. Si no, se crea uno nuevo.
          </p>
        </div>
      )}

      {error && <div className="alert">{error}</div>}

      {data && (
        <>
          <div className="import-file">
            <Icon name="box" size={18} /> <strong>{file?.name}</strong>
            <span className="muted">· {data.results.length} filas</span>
            {!result && (
              <label className="link-btn">
                Cambiar archivo
                <input type="file" accept=".xlsx,.csv" onChange={choose} hidden />
              </label>
            )}
          </div>

          <div className="import-summary">
            <span className="badge badge-ok">{data.summary.create} {result ? 'creados' : 'nuevos'}</span>
            <span className="badge badge-info">{data.summary.update} {result ? 'actualizados' : 'a actualizar'}</span>
            {data.summary.error > 0 && <span className="badge badge-bad">{data.summary.error} con errores</span>}
            {data.summary.skip > 0 && <span className="badge badge-muted">{data.summary.skip} ignoradas</span>}
            <label className="check-inline-sm"><input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Ver solo filas con avisos</label>
          </div>

          <div className="table-wrap import-table">
            <table className="table">
              <thead>
                <tr><th className="num">Fila</th><th>Producto</th><th>Acción</th><th className="num">€</th><th className="num">CC</th><th>Código</th><th>Avisos</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.row} className={r.action === 'error' ? 'row-error' : ''}>
                    <td className="num muted">{r.row}</td>
                    <td><strong>{r.name || '—'}</strong>{r.category && <small className="sub">{r.category}</small>}</td>
                    <td><span className={`badge badge-${ACTION[r.action].tone}`}>{ACTION[r.action].label}</span></td>
                    <td className="num">{r.priceEurCents !== undefined ? formatEur(r.priceEurCents) : '—'}</td>
                    <td className="num cc">{r.priceCoins !== undefined ? formatCoins(r.priceCoins) : '—'}</td>
                    <td className="mono muted">{r.barcode || '—'}</td>
                    <td className="import-notes">
                      {r.errors.map((m) => <div key={m} className="neg">{m}</div>)}
                      {r.warnings.map((m) => <div key={m} className="muted">{m}</div>)}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={7} className="muted center">No hay filas con avisos.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="modal-actions">
            {result ? (
              <button className="btn btn-primary" onClick={onClose}>Hecho</button>
            ) : (
              <>
                <button className="btn btn-light" onClick={onClose}>Cancelar</button>
                <button className="btn btn-primary" disabled={busy || toSave === 0} onClick={confirm}>
                  {busy ? 'Importando…' : `Importar ${toSave} producto${toSave === 1 ? '' : 's'}`}
                </button>
                {preview.summary.error > 0 && <span className="hint">Las filas con errores no se importan. Corrígelas en el Excel y vuelve a subirlo cuando quieras.</span>}
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
