import { useEffect, useState, useCallback, useRef } from 'react';
import { Keyboard } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import NetInfo from '@react-native-community/netinfo';
import { getAuditoriaItems, upsertResultadoItem, addHallazgo, deleteHallazgo } from '../api/auditoria';
import { uploadEvidencia, deleteEvidencia } from '../api/evidencia';
import { getStoredAccessToken } from '../api/auth';
import { sendErrorLogs } from '../api/errorLog';
import { logError, getPendingLogs, markAsSynced, isNetworkError } from '../services/errorLogger';
import {
  saveResultadoItem,
  saveResultadoItemRef,
  saveHallazgo,
  saveHallazgoRef,
  saveEvidencia,
  deleteHallazgoOffline,
  deleteEvidenciaOffline,
  getPendingCount,
} from '../services/offlineStore';
import { syncPendingData } from '../services/syncAuditoria';
import { DEFAULT_RESULT, generateUUID, buildUri } from '../screens/auditoria/AuditoriaComponents';

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

        const map = new Map();
        nivel1.forEach((n1) => {
          (n1.nivel2 ?? []).forEach((n2) => {
            map.set(n2.id, {
              uuid: n2.resultado_item?.uuid ?? null,
              conforme: n2.resultado_item?.conforme ?? null,
              observaciones: n2.resultado_item?.observaciones ?? '',
              estado: n2.resultado_item?.estado ?? 'SIN_AUDITAR',
              hallazgos: (n2.hallazgos ?? []).map((h) => ({
                ...h,
                evidencias: (h.evidencias ?? []).map((ev) => ({ ...ev, uri: buildUri(ev.uri) })),
              })),
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
      const remaining = await syncPendingData(idAud);
      setPendingCount(remaining);
    } catch (_) {}
  }, [idAud]);

  useEffect(() => {
    if (!prevIsOnlineRef.current && isOnline) {
      syncAll();
    }
    prevIsOnlineRef.current = isOnline;
  }, [isOnline, syncAll]);

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
    const item = resultsMap.get(idNivel2) ?? DEFAULT_RESULT;
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
  }, [resultsMap, idAud]);

  // ── Modal
  const openModal = useCallback((item) => {
    const hasDef = (item.hallazgos_def ?? []).length > 0;
    setModalItem(item);
    setModalMode(hasDef ? 'predefinido' : 'libre');
    setSelectedHallazgoDef(null);
    setFreeText('');
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setModalItem(null);
    setSelectedHallazgoDef(null);
    setFreeText('');
  }, []);

  // ── Confirmar hallazgo
  const handleConfirmHallazgo = useCallback(() => {
    if (!modalItem) return;
    const idNivel2 = modalItem.id;
    const esPredefinido = modalMode === 'predefinido';

    if (esPredefinido && !selectedHallazgoDef) return;
    if (!esPredefinido && !freeText.trim()) return;

    const idHallazgoDef = esPredefinido ? selectedHallazgoDef.id : null;
    const hallazgoLibre = freeText.trim() || null;
    const descripcion = esPredefinido ? selectedHallazgoDef.descripcion : freeText.trim();

    if (!isOnlineRef.current) {
      const item = resultsMapRef.current.get(idNivel2) ?? DEFAULT_RESULT;

      if (esPredefinido && item.hallazgos.some((h) => h.id_hallazgo_def === idHallazgoDef)) {
        setSnackbar('Este hallazgo ya fue agregado');
        return;
      }

      const itemUuid = item.uuid ?? generateUUID();
      const hallazgoUuid = generateUUID();
      const newHallazgo = { uuid: hallazgoUuid, id_hallazgo_def: idHallazgoDef, hallazgo_libre: hallazgoLibre, descripcion, evidencias: [] };

      saveResultadoItemRef(itemUuid, idAud, idNivel2, item.conforme, item.observaciones, item.estado);
      saveHallazgo(hallazgoUuid, itemUuid, idHallazgoDef, hallazgoLibre);
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
      const newHallazgo = { uuid: hallazgoUuid, id_hallazgo_def: idHallazgoDef, hallazgo_libre: hallazgoLibre, descripcion, evidencias: [] };
      const body = { uuid: hallazgoUuid, id_hallazgo_def: idHallazgoDef, hallazgo_libre: hallazgoLibre };

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
        .then(() => addHallazgo(idAud, itemUuid, body))
        .catch((err) => {
          setSnackbar('Error al agregar hallazgo');
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
  }, [modalItem, modalMode, selectedHallazgoDef, freeText, idAud, closeModal]);

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
    const uri = asset.uri;
    const nombre = asset.fileName ?? asset.name ?? uri.split('/').pop();
    const tipoEv = tipo === 'document' ? 'DOCUMENTO' : 'IMAGEN';
    const evidenciaUuid = generateUUID();
    const nuevaEvidencia = { uuid: evidenciaUuid, tipo: tipoEv, uri, nombre };

    setResultsMap((prev) => {
      const n = new Map(prev);
      const item = n.get(idNivel2);
      if (!item) return prev;
      n.set(idNivel2, {
        ...item,
        hallazgos: item.hallazgos.map((h) =>
          h.uuid === hallazgoUuid
            ? { ...h, evidencias: [...(h.evidencias ?? []), nuevaEvidencia] }
            : h
        ),
      });
      return n;
    });

    if (!isOnlineRef.current) {
      const item = resultsMapRef.current.get(idNivel2);
      if (item?.uuid) {
        saveResultadoItemRef(item.uuid, idAud, idNivel2, item.conforme, item.observaciones, item.estado);
        saveHallazgoRef(hallazgoUuid, item.uuid);
        saveEvidencia(evidenciaUuid, hallazgoUuid, tipoEv, uri, nombre);
        setPendingCount((c) => c + 1);
      }
      return;
    }

    try {
      const resp = await uploadEvidencia(idAud, hallazgoUuid, evidenciaUuid, uri, tipoEv, nombre);
      if (resp?.uri) {
        const serverUri = buildUri(resp.uri);
        setResultsMap((prev) => {
          const n = new Map(prev);
          const it = n.get(idNivel2);
          if (!it) return prev;
          n.set(idNivel2, {
            ...it,
            hallazgos: it.hallazgos.map((h) =>
              h.uuid === hallazgoUuid
                ? { ...h, evidencias: h.evidencias.map((e) => e.uuid === evidenciaUuid ? { ...e, uri: serverUri } : e) }
                : h
            ),
          });
          return n;
        });
      }
    } catch (e) {
      setSnackbar('Error al subir evidencia');
      if (!isNetworkError(e)) logError('EjecutarAuditoria', 'handleAddEvidencia', e, isOnlineRef.current);
      setResultsMap((prev) => {
        const n = new Map(prev);
        const item = n.get(idNivel2);
        if (!item) return prev;
        n.set(idNivel2, {
          ...item,
          hallazgos: item.hallazgos.map((h) =>
            h.uuid === hallazgoUuid
              ? { ...h, evidencias: (h.evidencias ?? []).filter((e) => e.uuid !== evidenciaUuid) }
              : h
          ),
        });
        return n;
      });
    }
  }, [idAud]);

  // ── Eliminar evidencia
  const handleDeleteEvidencia = useCallback(async (idNivel2, hallazgoUuid, evidenciaUuid) => {
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

  return {
    sections,
    resultsMap,
    loading,
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
    selectedHallazgoDef,
    setSelectedHallazgoDef,
    freeText,
    setFreeText,
    handleConformeChange,
    handleObsBlur,
    openModal,
    closeModal,
    handleConfirmHallazgo,
    handleAddEvidencia,
    handleDeleteEvidencia,
    handleDeleteHallazgo,
  };
}
