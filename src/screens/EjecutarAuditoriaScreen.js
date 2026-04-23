import React, { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  SectionList,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Keyboard,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Divider,
  ActivityIndicator,
  Chip,
  Portal,
  Modal,
  TextInput,
  Snackbar,
  TouchableRipple,
  IconButton,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  getAuditoriaItems,
  upsertResultadoItem,
  addHallazgo,
  deleteHallazgo,
} from '../api/auditoria';
import { uploadEvidencia, deleteEvidencia } from '../api/evidencia';
import { getStoredAccessToken } from '../api/auth';
import { API_BASE_URL } from '../api/config';

const buildUri = (uri) =>
  uri && uri.startsWith('/') ? `${API_BASE_URL.replace('/api/v1', '')}${uri}` : uri;

const COLORS = {
  primary: '#1A3ABF',
  gold: '#F5A623',
  navy: '#1A2B5C',
  bg: '#F0F4FF',
  white: '#FFFFFF',
  gray: '#888',
  border: '#E0E7FF',
  si: '#2E7D32',
  no: '#C62828',
};

const DEFAULT_RESULT = {
  uuid: null,
  conforme: null,
  observaciones: '',
  estado: 'SIN_AUDITAR',
  hallazgos: [],
};

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

// ─── ConformeToggle ──────────────────────────────────────────────────────────
function ConformeToggle({ value, onChange, disabled }) {
  return (
    <View style={styles.conformeRow}>
      <TouchableOpacity
        style={[styles.conformeBtn, value === 'SI' && styles.conformeSI]}
        onPress={() => onChange(value === 'SI' ? null : 'SI')}
        disabled={disabled}
      >
        <Text style={[styles.conformeText, value === 'SI' && styles.conformeTextActive]}>
          SI
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.conformeBtn, value === 'NO' && styles.conformeNO]}
        onPress={() => onChange(value === 'NO' ? null : 'NO')}
        disabled={disabled}
      >
        <Text style={[styles.conformeText, value === 'NO' && styles.conformeTextActive]}>
          NO
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── EvidenciaItem ────────────────────────────────────────────────────────────
function EvidenciaItem({ evidencia, onDelete, authToken }) {
  const source = evidencia.tipo === 'IMAGEN'
    ? {
        uri: buildUri(evidencia.uri),
        ...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}),
      }
    : null;

  return (
    <View style={styles.evidenciaItem}>
      {evidencia.tipo === 'IMAGEN' ? (
        <Image source={source} style={styles.evidenciaThumb} />
      ) : (
        <View style={styles.evidenciaDoc}>
          <IconButton icon="file-document-outline" size={20} iconColor={COLORS.primary} style={styles.evidenciaDocIcon} />
          <Text style={styles.evidenciaDocNombre} numberOfLines={1}>{evidencia.nombre}</Text>
        </View>
      )}
      <TouchableOpacity style={styles.evidenciaDeleteBtn} onPress={onDelete}>
        <Text style={styles.evidenciaDeleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── HallazgoItem ─────────────────────────────────────────────────────────────
function HallazgoItem({ hallazgo, onDelete, onAddEvidencia, onDeleteEvidencia, authToken }) {
  const texto = hallazgo.id_hallazgo_def
    ? hallazgo.hallazgo_libre
      ? `${hallazgo.descripcion}: ${hallazgo.hallazgo_libre}`
      : hallazgo.descripcion
    : hallazgo.hallazgo_libre;

  return (
    <View style={styles.hallazgoCard}>
      {/* Descripción + botón eliminar */}
      <View style={styles.hallazgoRow}>
        <Text style={styles.hallazgoText} numberOfLines={3}>{texto}</Text>
        <IconButton icon="close" size={16} iconColor={COLORS.no} style={styles.hallazgoDelete} onPress={onDelete} />
      </View>

      {/* Evidencias adjuntas */}
      {hallazgo.evidencias?.length > 0 && (
        <View style={styles.evidenciasWrap}>
          {hallazgo.evidencias.map((ev) => (
            <EvidenciaItem
              key={ev.uuid}
              evidencia={ev}
              authToken={authToken}
              onDelete={() => onDeleteEvidencia(ev.uuid)}
            />
          ))}
        </View>
      )}

      {/* Botones adjuntar */}
      <View style={styles.adjuntarRow}>
        <TouchableOpacity style={styles.adjuntarBtn} onPress={() => onAddEvidencia('camera')}>
          <IconButton icon="camera" size={18} iconColor={COLORS.primary} style={styles.adjuntarIcon} />
          <Text style={styles.adjuntarText}>Cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adjuntarBtn} onPress={() => onAddEvidencia('gallery')}>
          <IconButton icon="image-outline" size={18} iconColor={COLORS.primary} style={styles.adjuntarIcon} />
          <Text style={styles.adjuntarText}>Galería</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adjuntarBtn} onPress={() => onAddEvidencia('document')}>
          <IconButton icon="paperclip" size={18} iconColor={COLORS.primary} style={styles.adjuntarIcon} />
          <Text style={styles.adjuntarText}>Documento</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Nivel2Item ──────────────────────────────────────────────────────────────
const Nivel2Item = memo(function Nivel2Item({
  item,
  result,
  saving,
  onConformeChange,
  onObsBlur,
  onAddHallazgo,
  onDeleteHallazgo,
  onAddEvidencia,
  authToken,
  onDeleteEvidencia,
}) {
  const [localObs, setLocalObs] = useState(result.observaciones || '');

  return (
    <Card style={[
      styles.itemCard,
      result.conforme === 'NO' && styles.itemCardNoConforme,
      result.conforme === 'SI' && styles.itemCardConforme,
      result.conforme !== 'NO' && result.conforme !== 'SI' && result.hallazgos.length > 0 && styles.itemCardConHallazgos,
    ]}>
      <Card.Content>
        <Text style={styles.itemDesc}>{item.descripcion}</Text>

        <View style={styles.conformeSection}>
          <Text style={styles.fieldLabel}>Conforme</Text>
          <ConformeToggle value={result.conforme} onChange={onConformeChange} disabled={saving} />
          {saving && <ActivityIndicator size={14} color={COLORS.primary} style={styles.savingSpinner} />}
        </View>

        <TextInput
          label="Observaciones"
          value={localObs}
          onChangeText={setLocalObs}
          onBlur={() => onObsBlur(localObs)}
          mode="outlined"
          multiline
          numberOfLines={2}
          outlineColor={COLORS.border}
          activeOutlineColor={COLORS.primary}
          style={styles.obsInput}
          contentStyle={styles.obsContent}
        />

        <View style={styles.hallazgosSection}>
          <Text style={styles.fieldLabel}>Hallazgos</Text>
          {result.hallazgos.length === 0 ? (
            <Text style={styles.sinHallazgos}>Sin hallazgos registrados</Text>
          ) : (
            result.hallazgos.map((h) => (
              <HallazgoItem
                key={h.uuid}
                hallazgo={h}
                authToken={authToken}
                onDelete={() => onDeleteHallazgo(h.uuid)}
                onAddEvidencia={(tipo) => onAddEvidencia(h.uuid, tipo)}
                onDeleteEvidencia={(evUuid) => onDeleteEvidencia(h.uuid, evUuid)}
              />
            ))
          )}
        </View>

        <Button
          mode="outlined"
          onPress={onAddHallazgo}
          icon="plus"
          compact
          textColor={COLORS.primary}
          style={styles.addHallazgoBtn}
          contentStyle={styles.addHallazgoBtnContent}
        >
          Agregar hallazgo
        </Button>
      </Card.Content>
    </Card>
  );
});

// ─── EjecutarAuditoriaScreen ─────────────────────────────────────────────────
export default function EjecutarAuditoriaScreen({ route }) {
  const { audProyecto } = route.params;
  const idAud = audProyecto.id;

  const [sections, setSections] = useState([]);
  const [resultsMap, setResultsMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(new Set());
  const [snackbar, setSnackbar] = useState('');
  const [authToken, setAuthToken] = useState(null);

  const [kbHeight, setKbHeight] = useState(0);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [modalMode, setModalMode] = useState('predefinido'); // 'predefinido' | 'libre'
  const [selectedHallazgoDef, setSelectedHallazgoDef] = useState(null);
  const [freeText, setFreeText] = useState('');

  // ── Carga token y datos
  useEffect(() => {
    getStoredAccessToken().then((t) => setAuthToken(t));
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    getAuditoriaItems(idAud)
      .then((data) => {
        const nivel1 = Array.isArray(data) ? data : (data?.nivel1 ?? []);
        const secs = nivel1
          .sort((a, b) => (a.orden_ejecucion ?? 0) - (b.orden_ejecucion ?? 0))
          .map((n1) => ({
            id: n1.id,
            title: n1.descripcion,
            data: (n1.nivel2 ?? []).sort(
              (a, b) => (a.orden_ejecucion ?? 0) - (b.orden_ejecucion ?? 0)
            ),
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
                evidencias: (h.evidencias ?? []).map((ev) => ({
                  ...ev,
                  uri: buildUri(ev.uri),
                })),
              })),
            });
          });
        });
        setResultsMap(map);
      })
      .catch(() => setSnackbar('Error al cargar los ítems de auditoría'))
      .finally(() => setLoading(false));
  }, [idAud]);

  // ── Helpers de estado
  const addSaving = (id) => setSaving((p) => new Set([...p, id]));
  const removeSaving = (id) => setSaving((p) => { const s = new Set(p); s.delete(id); return s; });

  // ── Cambio de conforme (guarda inmediatamente)
  const handleConformeChange = useCallback(async (idNivel2, value) => {
    setResultsMap((prev) => {
      const next = new Map(prev);
      const item = next.get(idNivel2) ?? DEFAULT_RESULT;
      next.set(idNivel2, {
        ...item,
        conforme: value,
        estado: value ? 'AUDITADO' : 'SIN_AUDITAR',
      });
      return next;
    });

    setResultsMap((prev) => {
      const item = prev.get(idNivel2) ?? DEFAULT_RESULT;
      const uuid = item.uuid ?? generateUUID();

      const body = {
        uuid,
        id_aud_proyecto: idAud,
        id_nivel2: idNivel2,
        conforme: value,
        observaciones: item.observaciones,
        estado: value ? 'AUDITADO' : 'SIN_AUDITAR',
      };

      addSaving(idNivel2);
      upsertResultadoItem(idAud, uuid, body)
        .then(() => {
          setResultsMap((p) => {
            const n = new Map(p);
            n.set(idNivel2, { ...n.get(idNivel2), uuid });
            return n;
          });
        })
        .catch(() => setSnackbar('Error al guardar'))
        .finally(() => removeSaving(idNivel2));

      // Ensure uuid is stored locally even before response
      if (!item.uuid) {
        const n = new Map(prev);
        n.set(idNivel2, { ...n.get(idNivel2), uuid });
        return n;
      }
      return prev;
    });
  }, [idAud]);

  // ── Blur de observaciones (guarda al perder foco)
  const handleObsBlur = useCallback(async (idNivel2, observaciones) => {
    const item = resultsMap.get(idNivel2) ?? DEFAULT_RESULT;
    if (!item.uuid && !observaciones.trim()) return;

    const uuid = item.uuid ?? generateUUID();

    setResultsMap((prev) => {
      const n = new Map(prev);
      n.set(idNivel2, { ...prev.get(idNivel2) ?? DEFAULT_RESULT, uuid, observaciones });
      return n;
    });

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
    } finally {
      removeSaving(idNivel2);
    }
  }, [resultsMap, idAud]);

  // ── Modal: abrir / cerrar
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

  // ── Confirmar hallazgo (unifica predefinido y libre)
  const handleConfirmHallazgo = useCallback(() => {
    if (!modalItem) return;
    const idNivel2 = modalItem.id;
    const esPredefinido = modalMode === 'predefinido';

    if (esPredefinido && !selectedHallazgoDef) return;
    if (!esPredefinido && !freeText.trim()) return;

    const idHallazgoDef = esPredefinido ? selectedHallazgoDef.id : null;
    const hallazgoLibre = freeText.trim() || null;
    const descripcion = esPredefinido ? selectedHallazgoDef.descripcion : freeText.trim();

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
      console.log('[ensureItem] item.uuid:', item.uuid, '| itemUuid:', itemUuid);
      console.log('[ensureItem] body:', JSON.stringify(ensureItemBody));
      console.log('[addHallazgo] body:', JSON.stringify(body));

      const ensureItem = item.uuid
        ? Promise.resolve()
        : upsertResultadoItem(idAud, itemUuid, ensureItemBody);

      ensureItem
        .then(() => {
          console.log('[addHallazgo] calling url:', `/auditoria/${idAud}/items/${itemUuid}/hallazgos`);
          return addHallazgo(idAud, itemUuid, body);
        })
        .catch((err) => {
          console.error('[addHallazgo] error:', err?.message ?? err);
          setSnackbar('Error al agregar hallazgo');
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

  // ── Agregar evidencia a un hallazgo
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

    // Optimistic update
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

    try {
      const resp = await uploadEvidencia(idAud, hallazgoUuid, evidenciaUuid, uri, tipoEv, nombre);
      // Reemplaza la URI local por la del servidor
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
    } catch {
      setSnackbar('Error al subir evidencia');
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
      const n = new Map(prev);
      const item = n.get(idNivel2);
      if (!item) return prev;
      const originalHallazgos = item.hallazgos;
      n.set(idNivel2, {
        ...item,
        hallazgos: item.hallazgos.map((h) =>
          h.uuid === hallazgoUuid
            ? { ...h, evidencias: (h.evidencias ?? []).filter((e) => e.uuid !== evidenciaUuid) }
            : h
        ),
      });
      deleteEvidencia(idAud, hallazgoUuid, evidenciaUuid).catch(() => {
        setSnackbar('Error al eliminar evidencia');
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

      const originalHallazgos = item.hallazgos;
      deleteHallazgo(idAud, item.uuid, hallazgoUuid).catch(() => {
        setSnackbar('Error al eliminar hallazgo');
        setResultsMap((p) => {
          const n = new Map(p);
          n.set(idNivel2, { ...n.get(idNivel2), hallazgos: originalHallazgos });
          return n;
        });
      });

      const n = new Map(prev);
      n.set(idNivel2, {
        ...item,
        hallazgos: item.hallazgos.filter((h) => h.uuid !== hallazgoUuid),
      });
      return n;
    });
  }, [idAud]);

  // ── Hallazgos_def del item del modal
  const modalHallazgosDef = modalItem
    ? (sections
        .flatMap((s) => s.data)
        .find((i) => i.id === modalItem.id)?.hallazgos_def ?? [])
    : [];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando ítems...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Nivel2Item
            item={item}
            result={resultsMap.get(item.id) ?? DEFAULT_RESULT}
            saving={saving.has(item.id)}
            onConformeChange={(v) => handleConformeChange(item.id, v)}
            onObsBlur={(obs) => handleObsBlur(item.id, obs)}
            onAddHallazgo={() => openModal(item)}
            onDeleteHallazgo={(uuid) => handleDeleteHallazgo(item.id, uuid)}
            onAddEvidencia={(hallazgoUuid, tipo) => handleAddEvidencia(item.id, hallazgoUuid, tipo)}
            onDeleteEvidencia={(hallazgoUuid, evUuid) => handleDeleteEvidencia(item.id, hallazgoUuid, evUuid)}
            authToken={authToken}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No hay ítems configurados para esta auditoría</Text>
          </View>
        }
      />

      {/* Modal agregar hallazgo */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={closeModal}
          contentContainerStyle={[
            styles.modal,
            kbHeight > 0 && { marginBottom: kbHeight + 12, marginTop: 16 },
          ]}
        >
          {/* Header fijo */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Agregar hallazgo</Text>
            {modalItem && (
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                {modalItem.descripcion}
              </Text>
            )}
            {modalHallazgosDef.length > 0 && (
              <View style={styles.modeTabs}>
                <TouchableOpacity
                  style={[styles.modeTab, modalMode === 'predefinido' && styles.modeTabActive]}
                  onPress={() => { setModalMode('predefinido'); setSelectedHallazgoDef(null); setFreeText(''); }}
                >
                  <Text style={[styles.modeTabText, modalMode === 'predefinido' && styles.modeTabTextActive]}>
                    Predefinido
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeTab, modalMode === 'libre' && styles.modeTabActive]}
                  onPress={() => { setModalMode('libre'); setSelectedHallazgoDef(null); setFreeText(''); }}
                >
                  <Text style={[styles.modeTabText, modalMode === 'libre' && styles.modeTabTextActive]}>
                    Libre
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <Divider style={styles.modalDivider} />
          </View>

          {/* Contenido scrollable */}
          <ScrollView
            style={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Modo: Predefinido */}
            {modalMode === 'predefinido' && (
              <>
                {modalHallazgosDef.length === 0 ? (
                  <Text style={styles.sinHallazgosDef}>No hay hallazgos predefinidos para este ítem</Text>
                ) : (
                  modalHallazgosDef.map((hd) => {
                    const yaAgregado = (resultsMap.get(modalItem?.id)?.hallazgos ?? [])
                      .some((h) => h.id_hallazgo_def === hd.id);
                    const seleccionado = selectedHallazgoDef?.id === hd.id;
                    return (
                      <TouchableRipple
                        key={hd.id}
                        onPress={() => !yaAgregado && setSelectedHallazgoDef(seleccionado ? null : hd)}
                        style={[
                          styles.hallazgoDefRow,
                          seleccionado && styles.hallazgoDefRowSelected,
                          yaAgregado && styles.hallazgoDefRowDisabled,
                        ]}
                      >
                        <View style={styles.hallazgoDefContent}>
                          <Chip compact style={styles.tipoChip} textStyle={styles.tipoChipText}>
                            {hd.tipo}
                          </Chip>
                          <Text style={[styles.hallazgoDefText, yaAgregado && styles.hallazgoDefTextDisabled]}>
                            {hd.descripcion}
                          </Text>
                          {yaAgregado
                            ? <Text style={styles.yaAgregadoText}>✓</Text>
                            : seleccionado && <Text style={styles.seleccionadoText}>●</Text>
                          }
                        </View>
                      </TouchableRipple>
                    );
                  })
                )}
                <Divider style={styles.modalDivider} />
                <Text style={styles.modalSectionLabel}>Descripción libre (opcional)</Text>
                <TextInput
                  value={freeText}
                  onChangeText={setFreeText}
                  mode="outlined"
                  multiline
                  numberOfLines={6}
                  placeholder="Agrega contexto o detalle adicional..."
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.primary}
                  style={styles.freeTextInput}
                />
              </>
            )}

            {/* Modo: Libre */}
            {modalMode === 'libre' && (
              <>
                <Text style={styles.modalSectionLabel}>Describe el hallazgo</Text>
                <TextInput
                  value={freeText}
                  onChangeText={setFreeText}
                  mode="outlined"
                  multiline
                  numberOfLines={6}
                  placeholder="Escribe el hallazgo..."
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.primary}
                  style={styles.freeTextInput}
                />
              </>
            )}
          </ScrollView>

          {/* Botones fijos abajo */}
          <Divider style={styles.modalDivider} />
          <View style={styles.modalActions}>
            <Button onPress={closeModal} textColor={COLORS.gray}>
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirmHallazgo}
              disabled={modalMode === 'predefinido' ? !selectedHallazgoDef : !freeText.trim()}
              buttonColor={COLORS.primary}
            >
              Agregar
            </Button>
          </View>
        </Modal>
      </Portal>

      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar('')}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbar}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { paddingBottom: 40 },
  loadingText: { marginTop: 12, color: COLORS.gray },
  emptyText: { color: COLORS.gray, textAlign: 'center' },

  // Sección nivel1
  sectionHeader: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Item nivel2
  itemCard: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    elevation: 1,
  },
  itemCardNoConforme: { backgroundColor: '#FFEBEE' },   // rojo pastel
  itemCardConforme: { backgroundColor: '#E8F5E9' },      // verde pastel
  itemCardConHallazgos: { backgroundColor: '#FFFDE7' },  // amarillo pastel
  itemDesc: {
    fontWeight: '600',
    fontSize: 14,
    color: COLORS.navy,
    marginBottom: 10,
    lineHeight: 20,
  },

  // Conforme
  conformeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 11,
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 4,
  },
  conformeRow: { flexDirection: 'row', gap: 8 },
  conformeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  conformeSI: { backgroundColor: COLORS.si, borderColor: COLORS.si },
  conformeNO: { backgroundColor: COLORS.no, borderColor: COLORS.no },
  conformeText: { fontWeight: '700', fontSize: 13, color: COLORS.gray },
  conformeTextActive: { color: COLORS.white },
  savingSpinner: { marginLeft: 4 },

  // Observaciones
  obsInput: { backgroundColor: COLORS.white, marginBottom: 10 },
  obsContent: { fontSize: 13 },

  // Hallazgos lista
  hallazgosSection: { marginBottom: 8, marginTop: 4 },
  sinHallazgos: { fontSize: 12, color: COLORS.gray, fontStyle: 'italic', marginTop: 4, marginBottom: 4 },
  hallazgoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 6,
    marginBottom: 4,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  hallazgoText: { flex: 1, fontSize: 12, color: COLORS.navy },
  hallazgoDelete: { margin: 0, padding: 0 },

  // HallazgoCard
  hallazgoCard: {
    backgroundColor: '#FFFDE7',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
  },

  // Evidencias
  evidenciasWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  evidenciaItem: {
    position: 'relative',
  },
  evidenciaThumb: {
    width: 64,
    height: 64,
    borderRadius: 6,
    backgroundColor: COLORS.border,
  },
  evidenciaDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8EEF9',
    borderRadius: 6,
    maxWidth: 140,
    paddingRight: 8,
  },
  evidenciaDocIcon: { margin: 0, padding: 0 },
  evidenciaDocNombre: {
    flex: 1,
    fontSize: 11,
    color: COLORS.navy,
  },
  evidenciaDeleteBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.no,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenciaDeleteText: { color: COLORS.white, fontSize: 9, fontWeight: '700' },

  // Botones adjuntar
  adjuntarRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  adjuntarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 6,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  adjuntarIcon: { margin: 0, padding: 0, width: 28, height: 28 },
  adjuntarText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },

  // Botón agregar hallazgo
  addHallazgoBtn: {
    borderColor: COLORS.primary,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  addHallazgoBtnContent: { paddingVertical: 0 },

  // Modal
  modal: {
    backgroundColor: COLORS.white,
    marginHorizontal: 8,
    marginVertical: 8,
    borderRadius: 16,
    maxHeight: '97%',
    overflow: 'hidden',
    flexShrink: 1,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 0,
  },
  modalScroll: {
    paddingHorizontal: 20,
    flexGrow: 0,
    flexShrink: 1,
  },
  modalTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: COLORS.navy,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 10,
  },
  modalDivider: { marginVertical: 8, backgroundColor: COLORS.border },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  hallazgoDefRow: { paddingVertical: 8, paddingHorizontal: 4, borderRadius: 6 },
  hallazgoDefRowDisabled: { opacity: 0.5 },
  hallazgoDefContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipoChip: { backgroundColor: '#E3F2FD' },
  tipoChipText: { fontSize: 10, color: COLORS.primary },
  hallazgoDefText: { flex: 1, fontSize: 13, color: COLORS.navy },
  hallazgoDefTextDisabled: { color: COLORS.gray },
  yaAgregadoText: { color: COLORS.si, fontWeight: '700', fontSize: 14 },
  freeTextInput: { backgroundColor: COLORS.white, marginBottom: 12, minHeight: 130 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 4,
  },

  // Tabs de modo en modal
  modeTabs: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  modeTabActive: { backgroundColor: COLORS.primary },
  modeTabText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  modeTabTextActive: { color: COLORS.white },
  sinHallazgosDef: { color: COLORS.gray, fontStyle: 'italic', fontSize: 13, marginVertical: 8 },
  hallazgoDefRowSelected: { backgroundColor: '#E8EEF9', borderRadius: 6 },
  seleccionadoText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },

  // Snackbar
  snackbar: { backgroundColor: COLORS.navy },
});
