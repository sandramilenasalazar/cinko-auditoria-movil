import { useEffect, useState } from 'react';
import { getDatabase } from '../database/database';
import { getTiposHallazgo } from '../api/tiposHallazgo';
import { logError, isNetworkError } from './errorLogger';

// Catálogo de tipos de hallazgo. El "codigo" es fijo y es lo que viaja en la API;
// "nombre", "icono" y "color" pueden cambiar en la web y se usan solo para mostrar.

const CACHE_KEY = 'tipos_hallazgo';

// Respaldo si el servidor no tiene el catálogo (404) y no hay nada guardado.
export const TIPOS_RESPALDO = [
  { codigo: 'MANTENIMIENTO', nombre: 'Mantenimiento', icono: '🔧', color: '#e65100',
    orden_informe: 1, permite_predefinidos: true, permite_libre: true, activo: true },
  { codigo: 'NORMA', nombre: 'Norma', icono: '📜', color: '#1565c0',
    orden_informe: 2, permite_predefinidos: true, permite_libre: true, activo: true },
];

const COLOR_DESCONOCIDO = '#888888';
const HEX = /^#[0-9a-f]{6}$/i;

const normalizar = (lista) =>
  (Array.isArray(lista) ? lista : [])
    .filter((t) => t && typeof t.codigo === 'string' && t.codigo.trim())
    .map((t) => ({
      codigo: t.codigo,
      nombre: t.nombre || t.codigo,
      icono: typeof t.icono === 'string' ? t.icono : '',
      color: HEX.test(t.color ?? '') ? t.color : COLOR_DESCONOCIDO,
      orden_informe: Number.isFinite(t.orden_informe) ? t.orden_informe : 999,
      permite_predefinidos: t.permite_predefinidos !== false,
      permite_libre: t.permite_libre !== false,
      activo: t.activo !== false,
    }))
    .sort((a, b) => a.orden_informe - b.orden_informe);

// ── Estado en memoria + suscriptores ─────────────────────────────────────────
let catalogo = null; // null = aún no leído de la caché
const listeners = new Set();

function leerCache() {
  try {
    const row = getDatabase().getFirstSync(`SELECT valor FROM app_cache WHERE clave = ?`, [CACHE_KEY]);
    const lista = row ? normalizar(JSON.parse(row.valor)) : [];
    return lista.length > 0 ? lista : null;
  } catch (_) {
    return null;
  }
}

function escribirCache(lista) {
  try {
    getDatabase().runSync(
      `INSERT OR REPLACE INTO app_cache (clave, valor, updated_at) VALUES (?, ?, ?)`,
      [CACHE_KEY, JSON.stringify(lista), new Date().toISOString()]
    );
  } catch (_) {}
}

/** Catálogo vigente: el guardado del servidor o, si no hay, el de respaldo. */
export function getTipos() {
  if (catalogo == null) catalogo = leerCache() ?? TIPOS_RESPALDO;
  return catalogo;
}

/** Guarda un catálogo recibido (de /tipos-hallazgo o del paquete) y avisa a las pantallas. */
export function guardarTipos(lista) {
  const n = normalizar(lista);
  if (n.length === 0) return false;
  catalogo = n;
  escribirCache(n);
  listeners.forEach((fn) => fn(n));
  return true;
}

/**
 * Descarga el catálogo. Si el servidor responde 404 (no tiene el endpoint) se usa el
 * de respaldo; si falla la red, se conserva el guardado.
 */
export async function refrescarTipos() {
  try {
    const resp = await getTiposHallazgo();
    return guardarTipos(resp?.tipos);
  } catch (e) {
    if (e?.status === 404) {
      catalogo = TIPOS_RESPALDO;
      listeners.forEach((fn) => fn(catalogo));
      return false;
    }
    if (!isNetworkError(e) && e?.message !== 'Aborted') logError('tiposHallazgo', 'refrescarTipos', e, true);
    return false;
  }
}

// ── Consultas ────────────────────────────────────────────────────────────────

/**
 * Datos para mostrar un tipo por su código. Si el código no está en el catálogo
 * local, se muestra tal cual, en gris.
 */
export function tipoInfo(codigo, tipos = getTipos()) {
  const t = tipos.find((x) => x.codigo === codigo);
  if (t) return { ...t, conocido: true };
  return { codigo, nombre: codigo, icono: '', color: COLOR_DESCONOCIDO, activo: true, permite_libre: false, conocido: false };
}

/** Texto de la etiqueta: "🔧 Mantenimiento" (sin ícono si viene vacío). */
export const tipoTexto = (codigo, tipos) => {
  const t = tipoInfo(codigo, tipos);
  return t.icono ? `${t.icono} ${t.nombre}` : t.nombre;
};

/**
 * Opciones del selector de un hallazgo LIBRE: activos que permiten libre, en el orden
 * del catálogo. Si el hallazgo ya tiene un tipo inactivo, se incluye (marcado) para
 * que siga seleccionado y no se cambie sin querer.
 */
export function opcionesTipoLibre(tipoActual, tipos = getTipos()) {
  const opciones = tipos.filter((t) => t.activo && t.permite_libre).map((t) => ({ ...t, inactivo: false }));
  if (tipoActual && !opciones.some((t) => t.codigo === tipoActual)) {
    const t = tipoInfo(tipoActual, tipos);
    opciones.push({ ...t, inactivo: true });
  }
  return opciones;
}

/** ¿Se puede guardar un libre con este tipo? (cualquier código no vacío ya elegido). */
export const tipoLibreValido = (codigo) => typeof codigo === 'string' && codigo.trim().length > 0;

/** Hook: catálogo vigente, se actualiza cuando llega uno nuevo. */
export function useTiposHallazgo() {
  const [tipos, setTipos] = useState(getTipos);
  useEffect(() => {
    listeners.add(setTipos);
    setTipos(getTipos());
    return () => listeners.delete(setTipos);
  }, []);
  return tipos;
}
