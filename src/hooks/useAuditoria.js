import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Keyboard } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import NetInfo from '@react-native-community/netinfo';
import { getAuditoriaItems, upsertResultadoItem, addHallazgo, deleteHallazgo, upsertAcompanante, getAcompanante } from '../api/auditoria';
import { uploadEvidencia, deleteEvidencia, evidenciaServerUrl } from '../api/evidencia';
import { getStoredAccessToken } from '../api/auth';
import { sendErrorLogs } from '../api/errorLog';
import { logError, getPendingLogs, markAsSynced, isNetworkError } from '../services/errorLogger';
import {
  saveResultadoItem,
  saveResultadoItemRef,
  saveHallazgo,
  saveHallazgoRef,
  updateHallazgo,
  saveEvidencia,
  deleteHallazgoOffline,
  deleteEvidenciaOffline,
  saveAcompanante,
  getPendingCount,
  getEvidenciasPendientes,
  marcarEvidenciaFallida,
  marcarEvidenciaIrrecuperable,
  MAX_INTENTOS_EVIDENCIA,
  eliminarHallazgoLocal,
} from '../services/offlineStore';
import { verificarArchivoLocal, guardarCopiaPersistente, borrarCopiaPersistente } from '../services/evidenciaFiles';
import { syncPendingData } from '../services/syncAuditoria';
import { DEFAULT_RESULT, generateUUID, buildUri } from '../screens/auditoria/AuditoriaComponents';

const RETRY_TICK_MS = 60 * 1000;

// Cambia una evidencia dentro de resultsMap (inmutable).
const patchEvidencia = (map, idNivel2, hallazgoUuid, evidenciaUuid, patch) => {
  const item = map.get(idNivel2);
  if (!item) return map;
  const n = new Map(map);
  n.set(idNivel2, {
    ...item,
    hallazgos: item.hallazgos.map((h) =>
      h.uuid === hallazgoUuid
        ? {
            ...h,
            evidencias: patch === null
              ? (h.evidencias ?? []).filter((e) => e.uuid !== evidenciaUuid)
              : (h.evidencias ?? []).map((e) => (e.uuid === evidenciaUuid ? { ...e, ...patch } : e)),
          }
        : h
    ),
  });
  return n;
};

export function useAuditoria(idAud) {
  const [sections, setSections] = useState([]);
  const [resultsMap, setResultsMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(new Set());
  const [snackbar, setSnackbar] = useState('');
  const [authToken, setAuthToken] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [kbHeight, setKbHeight] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [modalMode, setModalMode] = useState('predefinido');
  const [selectedHallazgoDef, setSelectedHallazgoDef] = useState(null);
  const [freeText, setFreeText] = useState('');
  const [tipoLibre, setTipoLibre] = useState(null);
  const [editingHallazgo, setEditingHallazgo] = useState(null);
  const [acompanante, setAcompanante] = useState(null);
  const [firmaModalVisible, setFirmaModalVisible] = useState(false);

  const savedTimerRef = useRef(null);
  const prevIsOnlineRef = useRef(false);
  const wasSavingRef = useRef(false);
  const isOnlineRef = useRef(true);
  const resultsMapRef = useRef(new Map());

  useEffect(() => {
    resultsMapRef.current = resultsMap;
  }, [resultsMap]);

  useEffect(() => {
    getStoredAccessToken().then((t) => setAuthToken(t));
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    setPendingCount(getPendingCount(idAud));
  }, [idAud]);

  useEffect(() => {
    getAuditoriaItems(idAud)
      .then((data) => {
        const nivel1 = Array.isArray(data) ? data : (data?.nivel1 ?? []);
        const secs = nivel1
          .sort((a, b) => (a.orden_ejecucion ?? 0) - (b.orden_ejecucion ?? 0))
          .map((n1) => ({
            id: n1.id,
            title: n1.descripcion,
            data: (n1.nivel2 ?? []).sort((a, b) => (a.orden_ejecucion ?? 0) - (b.orden_ejecucion ?? 0)),
          }));
        setSections(secs);

        // Fotos que aún no llegan al servidor: se muestran como pendientes
        const pendientesPorHallazgo = new Map();
        getEvidenciasPendientes(idAud).forEach((ev) => {
          const lista = pendientesPorHallazgo.get(ev.id_resultado_hallazgo_uuid) ?? [];
          lista.push({
            uuid: ev.uuid,
            tipo: ev.tipo,
            uri: ev.file_local_path,
            nombre: ev.descripcion,
            pendiente: true,
            error: (ev.intentos ?? 0) >= MAX_INTENTOS_EVIDENCIA ? ev.ultimo_error : null,
          });
          pendientesPorHallazgo.set(ev.id_resultado_hallazgo_uuid, lista);
        });

        const map = new Map();
        nivel1.forEach((n1) => {
          (n1.nivel2 ?? []).forEach((n2) => {
            map.set(n2.id, {
              uuid: n2.resultado_item?.uuid ?? null,
              conforme: n2.resultado_item?.conforme ?? null,
              observaciones: n2.resultado_item?.observaciones ?? '',
              estado: n2.resultado_item?.estado ?? 'SIN_AUDITAR',
              hallazgos: (n2.hallazgos ?? []).map((h) => {
                const def = (n2.hallazgos_def ?? []).find((hd) => hd.id === h.id_hallazgo_def);
                const delServidor = (h.evidencias ?? []).map((ev) => ({ ...ev, uri: buildUri(ev.url ?? ev.uri) }));
                const yaEnServidor = new Set(delServidor.map((ev) => ev.uuid));
                const pendientes = (pendientesPorHallazgo.get(h.uuid) ?? []).filter((ev) => !yaEnServidor.has(ev.uuid));
                return {
                  ...h,
                  // tipo_libre siempre se toma del servidor: si la web lo cambió, aquí se ve el nuevo
                  tipo_libre: h.id_hallazgo_def ? null : (h.tipo_libre ?? null),
                  tipo: h.tipo ?? def?.tipo ?? null,
                  suma_hallazgo: h.suma_hallazgo ?? def?.suma_hallazgo ?? true,
                  evidencias: [...delServidor, ...pendientes],
                };
              }),
            });
          });
        });
        setResultsMap(map);
      })
      .catch((e) => {
        setSnackbar('Error al cargar los ítems de auditoría');
        if (!isNetworkError(e)) logError('EjecutarAuditoria', 'loadAuditoriaItems', e, isOnlineRef.current);
      })
      .finally(() => setLoading(false));

    getAcompanante(idAud)
      .then((data) => setAcompanante(data))
      .catch(() => {});
  }, [idAud]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? true;
      isOnlineRef.current = online;
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, []);

  const syncAll = useCallback(async () => {
    try {
      const pending = await getPendingLogs();
      if (pending.length > 0) {
        await sendErrorLogs(pending);
        await markAsSynced(pending.map((l) => l.uuid));
      }
    } catch (_) {}
    try {
      const { pendientes, evidenciasFallidas, hallazgosEliminados } = await syncPendingData(idAud);
      setPendingCount(pendientes);

      if (hallazgosEliminados.length > 0) {
        const eliminados = new Set(hallazgosEliminados);
        setResultsMap((prev) => {
          const n = new Map(prev);
          n.forEach((item, idNivel2) => {
            if (item.hallazgos.some((h) => eliminados.has(h.uuid))) {
              n.set(idNivel2, { ...item, hallazgos: item.hallazgos.filter((h) => !eliminados.has(h.uuid)) });
            }
          });
          return n;
        });
        setSnackbar(
          hallazgosEliminados.length === 1
            ? 'Un hallazgo fue eliminado desde la web y se quitó de la app'
            : `${hallazgosEliminados.length} hallazgos fueron eliminados desde la web y se quitaron de la app`
        );
      }

      // Refleja en pantalla las fotos que se subieron o que fallaron.
      const fallidas = new Map(evidenciasFallidas.map((f) => [f.uuid, f]));
      const pendientesLocales = new Set(getEvidenciasPendientes(idAud).map((ev) => ev.uuid));
      setResultsMap((prev) => {
        let changed = false;
        const n = new Map(prev);
        n.forEach((item, idNivel2) => {
          if (!item.hallazgos.some((h) => (h.evidencias ?? []).some((e) => e.pendiente))) return;
          const hallazgos = item.hallazgos.map((h) => {
            if (!(h.evidencias ?? []).some((e) => e.pendiente)) return h;
            changed = true;
            return {
              ...h,
              evidencias: h.evidencias.map((e) => {
                if (!e.pendiente) return e;
                if (!pendientesLocales.has(e.uuid)) {
                  // Ya está en el servidor (o fue descartada por 404)
                  return { ...e, pendiente: false, error: null, uri: buildUri(evidenciaServerUrl(null, e.uuid)) };
                }
                const f = fallidas.get(e.uuid);
                return f?.definitivo ? { ...e, error: f.mensaje } : e;
              }),
            };
          });
          n.set(idNivel2, { ...item, hallazgos });
        });
        return changed ? n : prev;
      });

      getStoredAccessToken().then((t) => { if (t) setAuthToken(t); }).catch(() => {});

      const definitivas = evidenciasFallidas.filter((f) => f.definitivo);
      if (definitivas.length > 0) {
        setSnackbar(
          definitivas.length === 1
            ? `Una foto no se pudo subir: ${definitivas[0].mensaje}`
            : `${definitivas.length} fotos no se pudieron subir: ${definitivas[0].mensaje}`
        );
      }
    } catch (_) {}
  }, [idAud]);

  useEffect(() => {
    if (!prevIsOnlineRef.current && isOnline) {
      syncAll();
    }
    prevIsOnlineRef.current = isOnline;
  }, [isOnline, syncAll]);

  // Reintento periódico mientras haya pendientes. La espera creciente por foto
  // la controla syncPendingData (proximo_intento), así que esto no hace bucle.
  useEffect(() => {
    if (!isOnline || pendingCount === 0) return undefined;
    const id = setInterval(syncAll, RETRY_TICK_MS);
    return () => clearInterval(id);
  }, [isOnline, pendingCount, syncAll]);

  useEffect(() => {
    if (saving.size > 0) {
      wasSavingRef.current = true;
      setSyncStatus('saving');
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    } else if (wasSavingRef.current) {
      wasSavingRef.current = false;
      setSyncStatus('saved');
      savedTimerRef.current = setTimeout(() => setSyncStatus('idle'), 2000);
    }
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, [saving]);

  const avance = useMemo(() => {
    const allItems = sections.flatMap((s) => s.data);
    const total = allItems.length;
    if (total === 0) return { porcentaje: 0, auditados: 0, total: 0 };
    const auditados = allItems.filter((item) => resultsMap.get(item.id)?.estado === 'AUDITADO').length;
    const porcentaje = Math.round((auditados / total) * 1000) / 10;
    return { porcentaje, auditados, total };
  }, [sections, resultsMap]);

  const addSaving = (id) => setSaving((p) => new Set([...p, id]));
  const removeSaving = (id) => setSaving((p) => { const s = new Set(p); s.delete(id); return s; });

  // ── Cambio de conforme
  const handleConformeChange = useCallback(async (idNivel2, value) => {
    setResultsMap((prev) => {
      const next = new Map(prev);
      const item = next.get(idNivel2) ?? DEFAULT_RESULT;
      next.set(idNivel2, { ...item, conforme: value, estado: value ? 'AUDITADO' : 'SIN_AUDITAR' });
      return next;
    });

    setResultsMap((prev) => {
      const item = prev.get(idNivel2) ?? DEFAULT_RESULT;
      const uuid = item.uuid ?? generateUUID();
      const newEstado = value ? 'AUDITADO' : 'SIN_AUDITAR';

      if (!isOnlineRef.current) {
        saveResultadoItem(uuid, idAud, idNivel2, value, item.observaciones, newEstado);
        setPendingCount((c) => c + 1);
        if (!item.uuid) {
          const n = new Map(prev);
          n.set(idNivel2, { ...n.get(idNivel2), uuid });
          return n;
        }
        return prev;
      }

      const body = { uuid, id_aud_proyecto: idAud, id_nivel2: idNivel2, conforme: value, observaciones: item.observaciones, estado: newEstado };
      addSaving(idNivel2);
      upsertResultadoItem(idAud, uuid, body)
        .then(() => {
          setResultsMap((p) => {
            const n = new Map(p);
            n.set(idNivel2, { ...n.get(idNivel2), uuid });
            return n;
          });
        })
        .catch((e) => {
          setSnackbar('Error al guardar');
          if (!isNetworkError(e)) logError('EjecutarAuditoria', 'handleConformeChange', e, isOnlineRef.current);
        })
        .finally(() => removeSaving(idNivel2));

      if (!item.uuid) {
        const n = new Map(prev);
        n.set(idNivel2, { ...n.get(idNivel2), uuid });
        return n;
      }
      return prev;
    });
  }, [idAud]);

  // ── Blur de observaciones
  const handleObsBlur = useCallback(async (idNivel2, observaciones) => {
    const item = resultsMapRef.current.get(idNivel2) ?? DEFAULT_RESULT;
    if (!item.uuid && !observaciones.trim()) return;

    const uuid = item.uuid ?? generateUUID();

    setResultsMap((prev) => {
      const n = new Map(prev);
      n.set(idNivel2, { ...prev.get(idNivel2) ?? DEFAULT_RESULT, uuid, observaciones });
      return n;
    });

    if (!isOnlineRef.current) {
      saveResultadoItem(uuid, idAud, idNivel2, item.conforme, observaciones, item.estado);
      setPendingCount((c) => c + 1);
      return;
    }

    addSaving(idNivel2);
    try {
      await upsertResultadoItem(idAud, uuid, {
        uuid,
        id_aud_proyecto: idAud,
        id_nivel2: idNivel2,
        conforme: item.conforme,
        observaciones,
        estado: item.estado,
      });
    } catch (e) {
      setSnackbar('Error al guardar observaciones');
      if (!isNetworkError(e)) logError('EjecutarAuditoria', 'handleObsBlur', e, isOnlineRef.current);
    } finally {
      removeSaving(idNivel2);
    }
  }, [idAud]);

  // ── Modal
  const openModal = useCallback((item) => {
    const hasDef = (item.hallazgos_def ?? []).length > 0;
    setModalItem(item);
    setModalMode(hasDef ? 'predefinido' : 'libre');
    setSelectedHallazgoDef(null);
    setFreeText('');
    setTipoLibre(null);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setModalItem(null);
    setSelectedHallazgoDef(null);
    setFreeText('');
    setTipoLibre(null);
    setEditingHallazgo(null);
  }, []);

  const openEditModal = useCallback((item, hallazgo) => {
    setEditingHallazgo({ uuid: hallazgo.uuid, idNivel2: item.id });
    setModalItem(item);
    setModalMode(hallazgo.id_hallazgo_def ? 'predefinido' : 'libre');
    setSelectedHallazgoDef(
      hallazgo.id_hallazgo_def
        ? (item.hallazgos_def ?? []).find((hd) => hd.id === hallazgo.id_hallazgo_def) ?? null
        : null
    );
    setFreeText(hallazgo.hallazgo_libre ?? '');
    setTipoLibre(hallazgo.tipo_libre ?? null);
    setModalVisible(true);
  }, []);

  const handleModalModeChange = useCallback((mode) => {
    setModalMode(mode);
    setTipoLibre(null);
  }, []);

  // ── Confirmar hallazgo
  const handleConfirmHallazgo = useCallback(() => {
    if (!modalItem) return;
    const idNivel2 = modalItem.id;
    const esPredefinido = modalMode === 'predefinido';

    if (esPredefinido && !selectedHallazgoDef) return;
    if (!esPredefinido && !freeText.trim()) return;
    if (!esPredefinido && !['MANTENIMIENTO', 'NORMA'].includes(tipoLibre)) {
      setSnackbar('Elige el tipo del hallazgo: Mantenimiento o Norma');
      return;
    }

    const idHallazgoDef = esPredefinido ? selectedHallazgoDef.id : null;
    const hallazgoLibre = freeText.trim() || null;
    const tipoLibreVal = esPredefinido ? null : tipoLibre;
    const descripcion = esPredefinido ? selectedHallazgoDef.descripcion : freeText.trim();

    if (editingHallazgo) {
      const { uuid: hallazgoUuid } = editingHallazgo;
      setResultsMap((prev) => {
        const n = new Map(prev);
        const item = n.get(idNivel2);
        if (!item) return prev;
        n.set(idNivel2, {
          ...item,
          hallazgos: item.hallazgos.map((h) =>
            h.uuid === hallazgoUuid
              ? { ...h, hallazgo_libre: hallazgoLibre, tipo_libre: tipoLibreVal, tipo: esPredefinido ? (selectedHallazgoDef?.tipo ?? h.tipo) : h.tipo, suma_hallazgo: esPredefinido ? (selectedHallazgoDef?.suma_hallazgo ?? h.suma_hallazgo ?? true) : true, descripcion }
              : h
          ),
        });
        return n;
      });
      if (!isOnlineRef.current) {
        updateHallazgo(hallazgoUuid, hallazgoLibre, tipoLibreVal);
        setPendingCount((c) => c + 1);
      } else {
        const itemUuid = resultsMapRef.current.get(idNivel2)?.uuid;
        if (itemUuid) {
          const editBody = {
            uuid: hallazgoUuid,
            id_hallazgo_def: idHallazgoDef,
            hallazgo_libre: hallazgoLibre,
            tipo_libre: tipoLibreVal,
          };
          if (__DEV__) console.log('[addHallazgo editar]', JSON.stringify(editBody));
          addHallazgo(idAud, itemUuid, editBody).catch(async (e) => {
            if (e?.status === 404) {
              // Eliminado desde la web: se quita de la pantalla y de la copia local
              const archivos = eliminarHallazgoLocal(hallazgoUuid);
              for (const a of archivos) await borrarCopiaPersistente(a);
              setResultsMap((p) => {
                const n = new Map(p);
                const it = n.get(idNivel2);
                if (it) n.set(idNivel2, { ...it, hallazgos: it.hallazgos.filter((h) => h.uuid !== hallazgoUuid) });
                return n;
              });
              setPendingCount(getPendingCount(idAud));
              setSnackbar('Este hallazgo fue eliminado desde la web');
              return;
            }
            setSnackbar(`Error al editar hallazgo: ${e?.message ?? ''}`);
            if (!isNetworkError(e)) logError('EjecutarAuditoria', 'handleEditHallazgo', e, isOnlineRef.current);
          });
        }
      }
      closeModal();
      return;
    }

    if (!isOnlineRef.current) {
      const item = resultsMapRef.current.get(idNivel2) ?? DEFAULT_RESULT;

      if (esPredefinido && item.hallazgos.some((h) => h.id_hallazgo_def === idHallazgoDef)) {
        setSnackbar('Este hallazgo ya fue agregado');
        return;
      }

      const itemUuid = item.uuid ?? generateUUID();
      const hallazgoUuid = generateUUID();
      const newHallazgo = { uuid: hallazgoUuid, id_hallazgo_def: idHallazgoDef, hallazgo_libre: hallazgoLibre, tipo_libre: tipoLibreVal, tipo: esPredefinido ? selectedHallazgoDef.tipo : null, suma_hallazgo: esPredefinido ? (selectedHallazgoDef.suma_hallazgo ?? true) : true, descripcion, evidencias: [] };

      saveResultadoItemRef(itemUuid, idAud, idNivel2, item.conforme, item.observaciones, item.estado);
      saveHallazgo(hallazgoUuid, itemUuid, idHallazgoDef, hallazgoLibre, tipoLibreVal);
      setPendingCount((c) => c + 1);

      setResultsMap((prev) => {
        const currentItem = prev.get(idNivel2) ?? DEFAULT_RESULT;
        const n = new Map(prev);
        n.set(idNivel2, { ...currentItem, uuid: itemUuid, hallazgos: [...currentItem.hallazgos, newHallazgo] });
        return n;
      });

      closeModal();
      return;
    }

    setResultsMap((prev) => {
      const item = prev.get(idNivel2) ?? DEFAULT_RESULT;

      if (esPredefinido && item.hallazgos.some((h) => h.id_hallazgo_def === idHallazgoDef)) {
        setSnackbar('Este hallazgo ya fue agregado');
        return prev;
      }

      const itemUuid = item.uuid ?? generateUUID();
      const hallazgoUuid = generateUUID();
      const newHallazgo = { uuid: hallazgoUuid, id_hallazgo_def: idHallazgoDef, hallazgo_libre: hallazgoLibre, tipo_libre: tipoLibreVal, tipo: esPredefinido ? selectedHallazgoDef.tipo : null, suma_hallazgo: esPredefinido ? (selectedHallazgoDef.suma_hallazgo ?? true) : true, descripcion, evidencias: [] };
      const body = { uuid: hallazgoUuid, id_hallazgo_def: idHallazgoDef, hallazgo_libre: hallazgoLibre, tipo_libre: tipoLibreVal };

      const ensureItemBody = {
        uuid: itemUuid,
        id_aud_proyecto: idAud,
        id_nivel2: idNivel2,
        observaciones: item.observaciones || '',
        estado: item.estado || 'SIN_AUDITAR',
        ...(item.conforme != null && { conforme: item.conforme }),
      };

      const ensureItem = item.uuid
        ? Promise.resolve()
        : upsertResultadoItem(idAud, itemUuid, ensureItemBody);

      ensureItem
        .then(() => {
          if (__DEV__) console.log('[addHallazgo crear]', JSON.stringify(body));
          return addHallazgo(idAud, itemUuid, body);
        })
        .catch((err) => {
          setSnackbar(`Error al agregar hallazgo: ${err?.message ?? ''}`);
          if (!isNetworkError(err)) logError('EjecutarAuditoria', 'handleConfirmHallazgo', err, isOnlineRef.current);
          setResultsMap((p) => {
            const n = new Map(p);
            const cur = n.get(idNivel2);
            n.set(idNivel2, { ...cur, hallazgos: cur.hallazgos.filter((h) => h.uuid !== hallazgoUuid) });
            return n;
          });
        });

      const n = new Map(prev);
      n.set(idNivel2, { ...item, uuid: itemUuid, hallazgos: [...item.hallazgos, newHallazgo] });
      return n;
    });
    closeModal();
  }, [modalItem, modalMode, selectedHallazgoDef, freeText, tipoLibre, editingHallazgo, idAud, closeModal]);

  // ── Agregar evidencia
  const handleAddEvidencia = useCallback(async (idNivel2, hallazgoUuid, tipo) => {
    let result;

    if (tipo === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setSnackbar('Permiso de cámara denegado'); return; }
      result = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    } else if (tipo === 'gallery') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setSnackbar('Permiso de galería denegado'); return; }
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    } else {
      result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    }

    if (result.canceled) return;

    const asset = result.assets ? result.assets[0] : result;
    const tipoEv = tipo === 'document' ? 'DOCUMENTO' : 'IMAGEN';
    const evidenciaUuid = generateUUID();
    const nombre = asset.fileName ?? asset.name ?? asset.uri.split('/').pop();

    // 1. El archivo debe existir, pesar > 0 y estar completo antes de usarlo.
    const check = await verificarArchivoLocal(asset.uri, {
      tipo: tipoEv,
      tamanoEsperado: asset.fileSize ?? asset.size,
    });
    if (!check.ok) {
      setSnackbar(`${check.motivo} Vuelve a tomarla o elegirla.`);
      logError('EjecutarAuditoria', 'handleAddEvidencia', new Error(`archivo inválido: ${check.motivo}`), isOnlineRef.current);
      return;
    }

    // 2. Copia en almacenamiento persistente: si la subida falla, se reintenta desde aquí.
    const uri = await guardarCopiaPersistente(asset.uri, evidenciaUuid);

    // Deja la foto en la cola local para que el sync la suba después.
    const encolar = (errorMsg) => {
      const item = resultsMapRef.current.get(idNivel2);
      if (!item?.uuid) return false;
      saveResultadoItemRef(item.uuid, idAud, idNivel2, item.conforme, item.observaciones, item.estado);
      saveHallazgoRef(hallazgoUuid, item.uuid);
      saveEvidencia(evidenciaUuid, hallazgoUuid, tipoEv, uri, nombre);
      if (errorMsg) marcarEvidenciaFallida(evidenciaUuid, errorMsg);
      setPendingCount(getPendingCount(idAud));
      return true;
    };

    setResultsMap((prev) => {
      const n = new Map(prev);
      const item = n.get(idNivel2);
      if (!item) return prev;
      n.set(idNivel2, {
        ...item,
        hallazgos: item.hallazgos.map((h) =>
          h.uuid === hallazgoUuid
            ? { ...h, evidencias: [...(h.evidencias ?? []), { uuid: evidenciaUuid, tipo: tipoEv, uri, nombre, pendiente: true }] }
            : h
        ),
      });
      return n;
    });

    if (!isOnlineRef.current) {
      if (!encolar(null)) {
        setSnackbar('No se pudo guardar la foto sin conexión');
        setResultsMap((prev) => patchEvidencia(prev, idNivel2, hallazgoUuid, evidenciaUuid, null));
      }
      return;
    }

    try {
      const resp = await uploadEvidencia(idAud, hallazgoUuid, evidenciaUuid, uri, tipoEv, nombre);
      // 409 (ya existía) también es éxito. La URL la da el servidor; no se arma aquí.
      const serverUri = buildUri(evidenciaServerUrl(resp, evidenciaUuid));
      setResultsMap((prev) =>
        patchEvidencia(prev, idNivel2, hallazgoUuid, evidenciaUuid, { uri: serverUri, pendiente: false, error: null })
      );
      await borrarCopiaPersistente(uri);
    } catch (e) {
      if (e?.kind === 'not_found') {
        setSnackbar('El hallazgo ya no existe en el servidor; la foto no se guardó');
        setResultsMap((prev) => patchEvidencia(prev, idNivel2, hallazgoUuid, evidenciaUuid, null));
        await borrarCopiaPersistente(uri);
        logError('EjecutarAuditoria', 'handleAddEvidencia', e, isOnlineRef.current);
        return;
      }
      if (e?.kind === 'forbidden') {
        // 403: no se puede subir a este hallazgo; se muestra el error sin reintentar
        if (encolar(null)) {
          marcarEvidenciaIrrecuperable(evidenciaUuid, e.message);
          setResultsMap((prev) => patchEvidencia(prev, idNivel2, hallazgoUuid, evidenciaUuid, { error: e.message }));
        } else {
          setResultsMap((prev) => patchEvidencia(prev, idNivel2, hallazgoUuid, evidenciaUuid, null));
        }
        setSnackbar(`No se pudo subir la foto: ${e.message}`);
        logError('EjecutarAuditoria', 'handleAddEvidencia', e, isOnlineRef.current);
        return;
      }
      // 400 / red / 401 sin renovar / 5xx → queda pendiente y se reintenta luego
      if (encolar(e?.message)) {
        setSnackbar(`Foto pendiente, se reintentará: ${e?.message ?? 'error al subir'}`);
      } else {
        setSnackbar(`Error al subir evidencia: ${e?.message ?? ''}`);
        setResultsMap((prev) => patchEvidencia(prev, idNivel2, hallazgoUuid, evidenciaUuid, null));
      }
      if (e?.kind !== 'network') logError('EjecutarAuditoria', 'handleAddEvidencia', e, isOnlineRef.current);
    }
  }, [idAud]);

  // ── Eliminar evidencia
  const handleDeleteEvidencia = useCallback(async (idNivel2, hallazgoUuid, evidenciaUuid) => {
    const ev = resultsMapRef.current.get(idNivel2)?.hallazgos
      .find((h) => h.uuid === hallazgoUuid)?.evidencias?.find((e) => e.uuid === evidenciaUuid);
    if (ev?.pendiente) {
      // Nunca llegó al servidor: se borra solo de la cola local.
      const item = resultsMapRef.current.get(idNivel2);
      deleteEvidenciaOffline(evidenciaUuid, hallazgoUuid, item?.uuid, idAud, idNivel2);
      await borrarCopiaPersistente(ev.uri);
      setPendingCount(getPendingCount(idAud));
      setResultsMap((prev) => patchEvidencia(prev, idNivel2, hallazgoUuid, evidenciaUuid, null));
      return;
    }

    setResultsMap((prev) => {
      const item = prev.get(idNivel2);
      if (!item) return prev;

      if (!isOnlineRef.current) {
        deleteEvidenciaOffline(evidenciaUuid, hallazgoUuid, item.uuid, idAud, idNivel2);
        setPendingCount((c) => c + 1);
        const n = new Map(prev);
        n.set(idNivel2, {
          ...item,
          hallazgos: item.hallazgos.map((h) =>
            h.uuid === hallazgoUuid
              ? { ...h, evidencias: (h.evidencias ?? []).filter((e) => e.uuid !== evidenciaUuid) }
              : h
          ),
        });
        return n;
      }

      const originalHallazgos = item.hallazgos;
      const n = new Map(prev);
      n.set(idNivel2, {
        ...item,
        hallazgos: item.hallazgos.map((h) =>
          h.uuid === hallazgoUuid
            ? { ...h, evidencias: (h.evidencias ?? []).filter((e) => e.uuid !== evidenciaUuid) }
            : h
        ),
      });
      deleteEvidencia(idAud, hallazgoUuid, evidenciaUuid).catch((e) => {
        setSnackbar('Error al eliminar evidencia');
        if (!isNetworkError(e)) logError('EjecutarAuditoria', 'handleDeleteEvidencia', e, isOnlineRef.current);
        setResultsMap((p) => { const m = new Map(p); m.set(idNivel2, { ...m.get(idNivel2), hallazgos: originalHallazgos }); return m; });
      });
      return n;
    });
  }, [idAud]);

  // ── Eliminar hallazgo
  const handleDeleteHallazgo = useCallback(async (idNivel2, hallazgoUuid) => {
    setResultsMap((prev) => {
      const item = prev.get(idNivel2);
      if (!item) return prev;

      if (!isOnlineRef.current) {
        deleteHallazgoOffline(hallazgoUuid, item.uuid, idAud, idNivel2);
        setPendingCount((c) => c + 1);
        const n = new Map(prev);
        n.set(idNivel2, { ...item, hallazgos: item.hallazgos.filter((h) => h.uuid !== hallazgoUuid) });
        return n;
      }

      const originalHallazgos = item.hallazgos;
      deleteHallazgo(idAud, item.uuid, hallazgoUuid).catch((e) => {
        setSnackbar('Error al eliminar hallazgo');
        if (!isNetworkError(e)) logError('EjecutarAuditoria', 'handleDeleteHallazgo', e, isOnlineRef.current);
        setResultsMap((p) => {
          const n = new Map(p);
          n.set(idNivel2, { ...n.get(idNivel2), hallazgos: originalHallazgos });
          return n;
        });
      });

      const n = new Map(prev);
      n.set(idNivel2, { ...item, hallazgos: item.hallazgos.filter((h) => h.uuid !== hallazgoUuid) });
      return n;
    });
  }, [idAud]);

  // ── Guardar acompañante
  const handleGuardarAcompanante = useCallback(async (nombre, firmaBase64) => {
    setFirmaModalVisible(false);

    if (!isOnlineRef.current) {
      saveAcompanante(idAud, nombre, firmaBase64);
      setPendingCount((c) => c + 1);
      setAcompanante((prev) => ({ ...prev, nombre_acompanante: nombre, firma_url: null }));
      setSnackbar('Firma guardada — se sincronizará al reconectar');
      return;
    }

    try {
      const resp = await upsertAcompanante(idAud, {
        nombre_acompanante: nombre,
        firma_acompanante: firmaBase64,
      });
      // Cache-buster: el servidor sobreescribe el mismo archivo, por lo que
      // la URL no cambia. Agregamos ?t=... para que React Native descargue
      // la imagen nueva en lugar de mostrar la versión cacheada.
      const firmaUrlFresh = resp?.firma_url
        ? `${resp.firma_url}?t=${Date.now()}`
        : null;
      setAcompanante({ ...resp, firma_url: firmaUrlFresh });
      setSnackbar('Acompañante registrado ✓');
    } catch (e) {
      setSnackbar('Error al guardar la firma');
      if (!isNetworkError(e)) logError('EjecutarAuditoria', 'handleGuardarAcompanante', e, isOnlineRef.current);
    }
  }, [idAud]);

  return {
    sections,
    resultsMap,
    loading,
    avance,
    authToken,
    saving,
    snackbar,
    setSnackbar,
    syncStatus,
    isOnline,
    pendingCount,
    kbHeight,
    modalVisible,
    modalItem,
    modalMode,
    setModalMode,
    handleModalModeChange,
    editingHallazgo,
    openEditModal,
    selectedHallazgoDef,
    setSelectedHallazgoDef,
    freeText,
    setFreeText,
    tipoLibre,
    setTipoLibre,
    handleConformeChange,
    handleObsBlur,
    openModal,
    closeModal,
    handleConfirmHallazgo,
    handleAddEvidencia,
    handleDeleteEvidencia,
    handleDeleteHallazgo,
    acompanante,
    firmaModalVisible,
    setFirmaModalVisible,
    handleGuardarAcompanante,
  };
}
