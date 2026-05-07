import React, { useState, memo } from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  TextInput,
  IconButton,
} from 'react-native-paper';
import { API_BASE_URL } from '../../api/config';

export const COLORS = {
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

export const DEFAULT_RESULT = {
  uuid: null,
  conforme: null,
  observaciones: '',
  estado: 'SIN_AUDITAR',
  hallazgos: [],
};

export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export const buildUri = (uri) =>
  uri && uri.startsWith('/') ? `${API_BASE_URL.replace('/api/v1', '')}${uri}` : uri;

// Devuelve true solo para URIs que React Native puede renderizar sin crashear
export const isValidUri = (uri) =>
  typeof uri === 'string' && uri.length > 0 && /^(https?|file):\/\//i.test(uri);

// ─── ConformeToggle ──────────────────────────────────────────────────────────
export function ConformeToggle({ value, onChange, disabled }) {
  return (
    <View style={styles.conformeRow}>
      <TouchableOpacity
        style={[styles.conformeBtn, value === 'SI' && styles.conformeSI]}
        onPress={() => onChange(value === 'SI' ? null : 'SI')}
        disabled={disabled}
      >
        <Text style={[styles.conformeText, value === 'SI' && styles.conformeTextActive]}>SI</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.conformeBtn, value === 'NO' && styles.conformeNO]}
        onPress={() => onChange(value === 'NO' ? null : 'NO')}
        disabled={disabled}
      >
        <Text style={[styles.conformeText, value === 'NO' && styles.conformeTextActive]}>NO</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── EvidenciaItem ────────────────────────────────────────────────────────────
export function EvidenciaItem({ evidencia, onDelete, authToken }) {
  const builtUri = evidencia.tipo === 'IMAGEN' ? buildUri(evidencia.uri) : null;
  const validUri = isValidUri(builtUri) ? builtUri : null;
  const source = validUri
    ? { uri: validUri, ...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}) }
    : null;

  return (
    <View style={styles.evidenciaItem}>
      {evidencia.tipo === 'IMAGEN' && source ? (
        <Image source={source} style={styles.evidenciaThumb} />
      ) : evidencia.tipo === 'IMAGEN' ? (
        <View style={[styles.evidenciaThumb, { backgroundColor: COLORS.border }]} />
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
export function HallazgoItem({ hallazgo, onDelete, onAddEvidencia, onDeleteEvidencia, authToken }) {
  const texto = hallazgo.id_hallazgo_def
    ? hallazgo.hallazgo_libre
      ? `${hallazgo.descripcion}: ${hallazgo.hallazgo_libre}`
      : hallazgo.descripcion
    : hallazgo.hallazgo_libre;

  return (
    <View style={styles.hallazgoCard}>
      <View style={styles.hallazgoRow}>
        <Text style={styles.hallazgoText} numberOfLines={3}>{texto}</Text>
        <IconButton icon="close" size={16} iconColor={COLORS.no} style={styles.hallazgoDelete} onPress={onDelete} />
      </View>

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
export const Nivel2Item = memo(function Nivel2Item({
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

// ─── AuditoriaProgressBar ────────────────────────────────────────────────────
export function AuditoriaProgressBar({ porcentaje, auditados, total }) {
  const complete = porcentaje >= 100;
  const fillColor = complete ? COLORS.si : COLORS.primary;
  return (
    <View style={styles.pbContainer}>
      <View style={styles.pbHeader}>
        <Text style={styles.pbLabel}>Avance de auditoría</Text>
        <Text style={[styles.pbPct, complete && styles.pbPctComplete]}>
          {porcentaje}%
        </Text>
      </View>
      <View style={styles.pbTrack}>
        <View style={[styles.pbFill, { width: `${Math.min(porcentaje, 100)}%`, backgroundColor: fillColor }]} />
      </View>
      <Text style={styles.pbCounter}>{auditados} de {total} ítems auditados</Text>
    </View>
  );
}

// ─── SyncBar ─────────────────────────────────────────────────────────────────
export function SyncBar({ status, isOnline, pendingCount }) {
  if (!isOnline) {
    const msg = pendingCount > 0
      ? `Sin conexión — ${pendingCount} cambio${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}`
      : 'Sin conexión';
    return (
      <View style={[styles.syncBar, styles.syncBarOffline]}>
        <Text style={styles.syncBarText}>{msg}</Text>
      </View>
    );
  }
  if (pendingCount > 0 && status === 'idle') {
    return (
      <View style={[styles.syncBar, styles.syncBarSaving]}>
        <ActivityIndicator size={12} color="#fff" style={styles.syncBarSpinner} />
        <Text style={styles.syncBarText}>Sincronizando...</Text>
      </View>
    );
  }
  if (status === 'idle') return null;
  return (
    <View style={[styles.syncBar, status === 'saved' && styles.syncBarSaved]}>
      {status === 'saving' && (
        <ActivityIndicator size={12} color="#fff" style={styles.syncBarSpinner} />
      )}
      <Text style={styles.syncBarText}>
        {status === 'saving' ? 'Guardando...' : 'Guardado ✓'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // ConformeToggle
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

  // EvidenciaItem
  evidenciaItem: { position: 'relative' },
  evidenciaThumb: { width: 64, height: 64, borderRadius: 6, backgroundColor: COLORS.border },
  evidenciaDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8EEF9',
    borderRadius: 6,
    maxWidth: 140,
    paddingRight: 8,
  },
  evidenciaDocIcon: { margin: 0, padding: 0 },
  evidenciaDocNombre: { flex: 1, fontSize: 11, color: COLORS.navy },
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

  // HallazgoItem
  hallazgoCard: {
    backgroundColor: '#FFFDE7',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
  },
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
  evidenciasWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  adjuntarRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingBottom: 8 },
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

  // Nivel2Item
  itemCard: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    elevation: 1,
  },
  itemCardNoConforme: { backgroundColor: '#FFEBEE' },
  itemCardConforme: { backgroundColor: '#E8F5E9' },
  itemCardConHallazgos: { backgroundColor: '#FFFDE7' },
  itemDesc: { fontWeight: '600', fontSize: 14, color: COLORS.navy, marginBottom: 10, lineHeight: 20 },
  conformeSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  fieldLabel: {
    fontSize: 11,
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 4,
  },
  savingSpinner: { marginLeft: 4 },
  obsInput: { backgroundColor: COLORS.white, marginBottom: 10 },
  obsContent: { fontSize: 13 },
  hallazgosSection: { marginBottom: 8, marginTop: 4 },
  sinHallazgos: { fontSize: 12, color: COLORS.gray, fontStyle: 'italic', marginTop: 4, marginBottom: 4 },
  addHallazgoBtn: { borderColor: COLORS.primary, borderRadius: 8, alignSelf: 'flex-start' },
  addHallazgoBtnContent: { paddingVertical: 0 },

  // SyncBar
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 5,
    gap: 6,
  },
  syncBarSaved: { backgroundColor: '#2E7D32' },
  syncBarSaving: { backgroundColor: COLORS.primary },
  syncBarOffline: { backgroundColor: '#B71C1C' },
  syncBarSpinner: { marginRight: 2 },
  syncBarText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // AuditoriaProgressBar
  pbContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pbLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  pbPct: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  pbPctComplete: { color: COLORS.si },
  pbTrack: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  pbFill: { height: '100%', borderRadius: 3 },
  pbCounter: { fontSize: 11, color: COLORS.gray, textAlign: 'right' },
});
