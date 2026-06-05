import React from 'react';
import { View, SectionList, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import { useAuditoria } from '../hooks/useAuditoria';
import { SyncBar, Nivel2Item, AuditoriaProgressBar, COLORS, DEFAULT_RESULT, isValidUri } from './auditoria/AuditoriaComponents';
import { HallazgoModal } from './auditoria/HallazgoModal';
import { FirmaModal } from './auditoria/FirmaModal';

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
    avance,
    acompanante,
    firmaModalVisible,
    setFirmaModalVisible,
    handleGuardarAcompanante,
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
      <AuditoriaProgressBar porcentaje={avance.porcentaje} auditados={avance.auditados} total={avance.total} />

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
            onEditHallazgo={(hallazgo) => openEditModal(item, hallazgo)}
            onAddEvidencia={(hallazgoUuid, tipo) => handleAddEvidencia(item.id, hallazgoUuid, tipo)}
            onDeleteEvidencia={(hallazgoUuid, evUuid) => handleDeleteEvidencia(item.id, hallazgoUuid, evUuid)}
            authToken={authToken}
          />
        )}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <View style={styles.acompananteCard}>
            <Text style={styles.acompananteTitle}>Acompañante de auditoría</Text>
            {acompanante?.nombre_acompanante ? (
              <>
                <Text style={styles.acompananteNombre}>✓ {acompanante.nombre_acompanante}</Text>
                {isValidUri(acompanante.firma_url) && (
                  <Image
                    source={{ uri: acompanante.firma_url }}
                    style={styles.acompananteFirma}
                    resizeMode="contain"
                  />
                )}
                <TouchableOpacity onPress={() => setFirmaModalVisible(true)}>
                  <Text style={styles.acompananteEditar}>Editar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.acompananteDesc}>
                  Registra el nombre y firma de quien acompañó la auditoría por parte del cliente.
                </Text>
                <TouchableOpacity style={styles.acompananteBtn} onPress={() => setFirmaModalVisible(true)}>
                  <Text style={styles.acompananteBtnText}>Registrar acompañante</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No hay ítems configurados para esta auditoría</Text>
          </View>
        }
      />

      <FirmaModal
        visible={firmaModalVisible}
        onDismiss={() => setFirmaModalVisible(false)}
        onConfirm={handleGuardarAcompanante}
        initialNombre={acompanante?.nombre_acompanante ?? ''}
        initialFirmaUrl={acompanante?.firma_url ?? null}
      />

      <HallazgoModal
        visible={modalVisible}
        onDismiss={closeModal}
        item={modalItem}
        mode={modalMode}
        onModeChange={handleModalModeChange}
        selectedHallazgoDef={selectedHallazgoDef}
        onSelectHallazgoDef={setSelectedHallazgoDef}
        freeText={freeText}
        onFreeTextChange={setFreeText}
        tipoLibre={tipoLibre}
        onTipoLibreChange={setTipoLibre}
        isEditing={!!editingHallazgo}
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

  // Tarjeta acompañante
  acompananteCard: {
    margin: 12,
    marginTop: 4,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  acompananteTitle: { fontWeight: '700', fontSize: 14, color: COLORS.navy, marginBottom: 8 },
  acompananteDesc: { fontSize: 13, color: COLORS.gray, marginBottom: 12, lineHeight: 18 },
  acompananteBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acompananteBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  acompananteNombre: { fontSize: 14, color: COLORS.si, fontWeight: '600', marginBottom: 8 },
  acompananteFirma: { width: '100%', height: 70, borderRadius: 6, marginBottom: 8, backgroundColor: '#F8F9FF' },
  acompananteEditar: { fontSize: 13, color: COLORS.primary, fontWeight: '600', textAlign: 'right' },
});
