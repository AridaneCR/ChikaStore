import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

// Lector de códigos de barras con la cámara del móvil.
// 1) Usa el lector nativo del navegador (BarcodeDetector: Chrome/Edge en Android, Samsung Internet…).
// 2) Si no existe (iPhone/Safari, Firefox), carga ZXing (se descarga aparte, solo cuando hace falta).
// La cámara solo funciona en páginas HTTPS (Render lo es) o en localhost.
const WANTED = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];
const REPEAT_MS = 2500; // no repetir el mismo código seguido

export default function Scanner({ onDetect, paused = false }) {
  const videoRef = useRef(null);
  const pausedRef = useRef(paused);
  const cbRef = useRef(onDetect);
  const lastRef = useRef({ code: '', at: 0 });
  const [status, setStatus] = useState('starting'); // starting | running | error
  const [error, setError] = useState('');

  pausedRef.current = paused;
  cbRef.current = onDetect;

  useEffect(() => {
    let stream;
    let timer;
    let reader;
    let stopped = false;

    const emit = (raw) => {
      const code = String(raw || '').trim();
      if (!code || pausedRef.current) return;
      const now = Date.now();
      if (code === lastRef.current.code && now - lastRef.current.at < REPEAT_MS) return;
      lastRef.current = { code, at: now };
      if (navigator.vibrate) navigator.vibrate(60);
      cbRef.current(code);
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Este navegador no permite usar la cámara. Prueba con Chrome o Safari actualizados.');
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (stopped) return;
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true'); // necesario en iPhone
      await video.play();
      setStatus('running');

      if ('BarcodeDetector' in window) {
        const supported = (await window.BarcodeDetector.getSupportedFormats?.()) || WANTED;
        const formats = WANTED.filter((f) => supported.includes(f));
        const detector = new window.BarcodeDetector({ formats: formats.length ? formats : undefined });
        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              if (codes.length) emit(codes[0].rawValue);
            }
          } catch { /* fotograma sin código */ }
          timer = setTimeout(tick, 200);
        };
        tick();
        return;
      }

      // Alternativa: ZXing
      let zxing;
      try {
        zxing = await import('@zxing/library');
      } catch {
        throw new Error('No se pudo cargar el lector de códigos. Revisa tu conexión o escribe el número abajo.');
      }
      if (stopped) return;
      reader = new zxing.BrowserMultiFormatReader();
      const onResult = (result) => {
        if (result) emit(result.getText());
      };
      if (typeof reader.decodeFromStream === 'function') {
        reader.decodeFromStream(stream, video, onResult);
      } else {
        stream.getTracks().forEach((t) => t.stop());
        reader.decodeFromVideoDevice(undefined, video, onResult);
      }
    }

    start().catch((err) => {
      if (stopped) return;
      setStatus('error');
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      const noCam = err && err.name === 'NotFoundError';
      setError(
        denied
          ? 'No hay permiso para usar la cámara. Actívalo en los ajustes del navegador para esta web y recarga.'
          : noCam
            ? 'No se ha encontrado ninguna cámara en este dispositivo.'
            : err?.message?.startsWith('No ') || err?.message?.startsWith('Este ')
              ? err.message
              : 'No se pudo abrir la cámara. Puedes escribir el número del código abajo.'
      );
    });

    return () => {
      stopped = true;
      clearTimeout(timer);
      try { reader?.reset(); } catch { /* nada */ }
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="scanner">
      <video ref={videoRef} muted playsInline className="scanner-video" />
      {status === 'running' && (
        <div className="scanner-frame" aria-hidden="true">
          <span className="scanner-line" />
        </div>
      )}
      {status === 'starting' && <div className="scanner-msg"><Icon name="camera" size={28} /> Abriendo la cámara…</div>}
      {status === 'error' && <div className="scanner-msg scanner-error"><Icon name="camera" size={28} /> {error}</div>}
      {paused && status === 'running' && <div className="scanner-busy" />}
    </div>
  );
}
