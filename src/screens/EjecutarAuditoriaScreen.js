import React from 'react';
import { View, SectionList, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import { useAuditoria } from '../hooks/useAuditoria';
import { SyncBar, Nivel2Item, COLORS, DEFAULT_RESULT } from './auditoria/AuditoriaComponents';
import { HallazgoModal } from './auditoria/HallazgoModal';

export default function EjecutarAuditoriaScreen({ route }) {
  const { audProyecto } = route.params;
  const {
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
  } = useAuditoria(audProyecto.id);

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
      <SyncBar status={syncStatus} isOnline={isOnline} pendingCount={pendingCount} />

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

      <HallazgoModal
        visible={modalVisible}
        onDismiss={closeModal}
        item={modalItem}
        mode={modalMode}
        onModeChange={setModalMode}
        selectedHallazgoDef={selectedHallazgoDef}
        onSelectHallazgoDef={setSelectedHallazgoDef}
        freeText={freeText}
        onFreeTextChange={setFreeText}
        resultsMap={resultsMap}
        onConfirm={handleConfirmHallazgo}
        kbHeight={kbHeight}
      />

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
  snackbar: { backgroundColor: COLORS.navy },
});
