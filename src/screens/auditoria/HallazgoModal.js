import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Text,
  Button,
  Divider,
  Modal,
  Portal,
  TextInput,
  TouchableRipple,
  Chip,
} from 'react-native-paper';
import { COLORS } from './AuditoriaComponents';

export function HallazgoModal({
  visible,
  onDismiss,
  item,
  mode,
  onModeChange,
  selectedHallazgoDef,
  onSelectHallazgoDef,
  freeText,
  onFreeTextChange,
  resultsMap,
  onConfirm,
  kbHeight,
}) {
  const hallazgosDef = item?.hallazgos_def ?? [];
  const hallazgosAgregados = resultsMap?.get(item?.id)?.hallazgos ?? [];

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modal,
          kbHeight > 0 && { marginBottom: kbHeight + 12, marginTop: 16 },
        ]}
      >
        {/* Header fijo */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Agregar hallazgo</Text>
          {item && (
            <Text style={styles.modalSubtitle} numberOfLines={2}>
              {item.descripcion}
            </Text>
          )}
          {hallazgosDef.length > 0 && (
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, mode === 'predefinido' && styles.modeTabActive]}
                onPress={() => { onModeChange('predefinido'); onSelectHallazgoDef(null); onFreeTextChange(''); }}
              >
                <Text style={[styles.modeTabText, mode === 'predefinido' && styles.modeTabTextActive]}>
                  Predefinido
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, mode === 'libre' && styles.modeTabActive]}
                onPress={() => { onModeChange('libre'); onSelectHallazgoDef(null); onFreeTextChange(''); }}
              >
                <Text style={[styles.modeTabText, mode === 'libre' && styles.modeTabTextActive]}>
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
          {mode === 'predefinido' && (
            <>
              {hallazgosDef.length === 0 ? (
                <Text style={styles.sinHallazgosDef}>No hay hallazgos predefinidos para este ítem</Text>
              ) : (
                hallazgosDef.map((hd) => {
                  const yaAgregado = hallazgosAgregados.some((h) => h.id_hallazgo_def === hd.id);
                  const seleccionado = selectedHallazgoDef?.id === hd.id;
                  return (
                    <TouchableRipple
                      key={hd.id}
                      onPress={() => !yaAgregado && onSelectHallazgoDef(seleccionado ? null : hd)}
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
                onChangeText={onFreeTextChange}
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

          {mode === 'libre' && (
            <>
              <Text style={styles.modalSectionLabel}>Describe el hallazgo</Text>
              <TextInput
                value={freeText}
                onChangeText={onFreeTextChange}
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
          <Button onPress={onDismiss} textColor={COLORS.gray}>
            Cancelar
          </Button>
          <Button
            mode="contained"
            onPress={onConfirm}
            disabled={mode === 'predefinido' ? !selectedHallazgoDef : !freeText.trim()}
            buttonColor={COLORS.primary}
          >
            Agregar
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: COLORS.white,
    marginHorizontal: 8,
    marginVertical: 8,
    borderRadius: 16,
    maxHeight: '97%',
    overflow: 'hidden',
    flexShrink: 1,
  },
  modalHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 0 },
  modalScroll: { paddingHorizontal: 20, flexGrow: 0, flexShrink: 1 },
  modalTitle: { fontWeight: '700', fontSize: 16, color: COLORS.navy, marginBottom: 4 },
  modalSubtitle: { fontSize: 12, color: COLORS.gray, marginBottom: 10 },
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
  hallazgoDefRowSelected: { backgroundColor: '#E8EEF9', borderRadius: 6 },
  hallazgoDefContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipoChip: { backgroundColor: '#E3F2FD' },
  tipoChipText: { fontSize: 10, color: COLORS.primary },
  hallazgoDefText: { flex: 1, fontSize: 13, color: COLORS.navy },
  hallazgoDefTextDisabled: { color: COLORS.gray },
  yaAgregadoText: { color: COLORS.si, fontWeight: '700', fontSize: 14 },
  seleccionadoText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  freeTextInput: { backgroundColor: COLORS.white, marginBottom: 12, minHeight: 130 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 4,
  },
  modeTabs: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  modeTab: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: COLORS.white },
  modeTabActive: { backgroundColor: COLORS.primary },
  modeTabText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  modeTabTextActive: { color: COLORS.white },
  sinHallazgosDef: { color: COLORS.gray, fontStyle: 'italic', fontSize: 13, marginVertical: 8 },
});
