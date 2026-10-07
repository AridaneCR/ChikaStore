import { barcodeSvg } from '../utils/barcode';

// Dibuja un EAN-13/EAN-8/UPC-A. Si el código no es de ese tipo, muestra solo el texto.
export default function Barcode({ value, height = 50, className = '' }) {
  if (!value) return null;
  const svg = barcodeSvg(value, { height });
  if (!svg) return <span className={`barcode-text ${className}`}>{value}</span>;
  // eslint-disable-next-line react/no-danger
  return <span className={`barcode ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
