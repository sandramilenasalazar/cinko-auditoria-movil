import * as FileSystem from 'expo-file-system/legacy';

// Carpeta persistente para fotos pendientes de subir. La caché del sistema
// (donde la cámara deja las fotos) puede vaciarse antes de sincronizar.
const PENDIENTES_DIR = `${FileSystem.documentDirectory}evidencias_pendientes/`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const extOf = (s) => {
  const m = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(s ?? '');
  return m ? m[1].toLowerCase() : '';
};

const base64ToBytes = (b64) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = (b64 ?? '').replace(/=+$/, '');
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const c of clean) {
    const v = chars.indexOf(c);
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
};

// Revisa que la imagen termine con el marcador de fin de su formato.
// Una foto cortada a mitad (escritura sin terminar) no lo tiene.
// Devuelve true si está completa o si no se puede comprobar.
const imagenCompleta = async (uri, size) => {
  const ext = extOf(uri);
  const tail = ext === 'png' ? 8 : ext === 'jpg' || ext === 'jpeg' ? 2 : 0;
  if (!tail || size < tail) return true;
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: size - tail,
      length: tail,
    });
    const b = base64ToBytes(b64);
    if (tail === 2) return b[0] === 0xff && b[1] === 0xd9; // JPEG EOI
    // PNG: últimos 8 bytes = "IEND" + CRC fijo AE 42 60 82
    return b[0] === 0x49 && b[1] === 0x45 && b[2] === 0x4e && b[3] === 0x44;
  } catch (_) {
    return true;
  }
};

/**
 * Verifica que el archivo local exista, pese más de 0 bytes y esté completo.
 * Si al principio está vacío o incompleto espera un poco (la cámara o la
 * compresión pueden no haber terminado de escribir) y vuelve a revisar.
 * @param {string} uri
 * @param {{ tipo?: string, tamanoEsperado?: number, reintentos?: number }} opts
 * @returns {Promise<{ ok: boolean, size?: number, motivo?: string }>}
 */
export async function verificarArchivoLocal(uri, { tipo = 'IMAGEN', tamanoEsperado, reintentos = 3 } = {}) {
  if (!uri) return { ok: false, motivo: 'La foto no tiene archivo local.' };

  let ultimoMotivo = '';
  for (let i = 0; i <= reintentos; i++) {
    if (i > 0) await sleep(400 * i);
    let info;
    try {
      info = await FileSystem.getInfoAsync(uri, { size: true });
    } catch (_) {
      info = null;
    }
    if (!info?.exists) {
      ultimoMotivo = 'El archivo de la foto ya no existe en el celular.';
      continue;
    }
    const size = info.size ?? 0;
    if (size <= 0) {
      ultimoMotivo = 'El archivo de la foto está vacío (0 bytes).';
      continue;
    }
    if (tamanoEsperado && size < tamanoEsperado) {
      ultimoMotivo = 'El archivo de la foto todavía se está guardando.';
      continue;
    }
    if (tipo === 'IMAGEN' && !(await imagenCompleta(uri, size))) {
      ultimoMotivo = 'La foto quedó incompleta.';
      continue;
    }
    return { ok: true, size };
  }
  return { ok: false, motivo: ultimoMotivo };
}

/**
 * Copia el archivo a la carpeta persistente de pendientes y devuelve la nueva URI.
 * Si la copia falla, devuelve la URI original.
 */
export async function guardarCopiaPersistente(uri, evidenciaUuid) {
  try {
    if (uri.startsWith(PENDIENTES_DIR)) return uri;
    await FileSystem.makeDirectoryAsync(PENDIENTES_DIR, { intermediates: true }).catch(() => {});
    const ext = extOf(uri);
    const destino = `${PENDIENTES_DIR}${evidenciaUuid}${ext ? `.${ext}` : ''}`;
    await FileSystem.copyAsync({ from: uri, to: destino });
    return destino;
  } catch (_) {
    return uri;
  }
}

/**
 * Borra de la carpeta privada de pendientes las copias que ya no están en la
 * cola local (p. ej. se eliminó el hallazgo antes de que la foto subiera).
 * Solo actúa dentro de PENDIENTES_DIR: nunca toca la galería ni otros archivos.
 * Las fotos que siguen en la cola (incluidas las marcadas con error) se conservan.
 * @param {Set<string>} rutasEnCola  file_local_path de las evidencias en la cola local
 * @returns {Promise<number>} cantidad de archivos borrados
 */
export async function limpiarCopiasHuerfanas(rutasEnCola) {
  let borrados = 0;
  try {
    const info = await FileSystem.getInfoAsync(PENDIENTES_DIR);
    if (!info.exists) return 0;
    const nombres = await FileSystem.readDirectoryAsync(PENDIENTES_DIR);
    for (const nombre of nombres) {
      const ruta = `${PENDIENTES_DIR}${nombre}`;
      if (rutasEnCola.has(ruta)) continue;
      try {
        await FileSystem.deleteAsync(ruta, { idempotent: true });
        borrados++;
      } catch (_) {}
    }
  } catch (_) {}
  return borrados;
}

/** Borra la copia persistente cuando la evidencia ya está en el servidor. */
export async function borrarCopiaPersistente(uri) {
  if (!uri || !uri.startsWith(PENDIENTES_DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (_) {}
}
