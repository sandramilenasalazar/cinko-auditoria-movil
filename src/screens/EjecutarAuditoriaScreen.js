import React, { useCallback, useMemo, useState } from 'react';
import { View, SectionList, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text, ActivityIndicator, Snackbar, Button } from 'react-native-paper';
import { useAuditoria } from '../hooks/useAuditoria';
import { SyncBar, Nivel2Item, GrupoHeader, AuditoriaProgressBar, COLORS, DEFAULT_RESULT, isValidUri } from './auditoria/AuditoriaComponents';
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
    resumenGrupos,
    acompanante,
    firmaModalVisible,
    setFirmaModalVisible,
    handleGuardarAcompanante,
  } = useAuditoria(audProyecto.id);

  // ── Grupos colapsables: todos empiezan cerrados; cada uno se abre por su cuenta
  const [abiertos, setAbiertos] = useState(() => new Set());
  const toggleGrupo = useCallback((id) => {
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);
  const todosAbiertos = sections.length > 0 && sections.every((s) => abiertos.has(s.id));
  const toggleTodos = useCallback(() => {
    setAbiertos(todosAbiertos ? new Set() : new Set(sections.map((s) => s.id)));
  }, [todosAbiertos, sections]);
  // Un grupo cerrado pasa sus ítems vacíos: se ve el título pero no se dibuja ningún ítem
  const seccionesVisibles = useMemo(
    () => sections.map((s) => (abiertos.has(s.id) ? s : { ...s, data: [] })),
    [sections, abiertos]
  );
  const renderSectionHeader = useCallback(({ section }) => {
    const r = resumenGrupos.get(section.id) ?? { auditados: 0, total: 0, conHallazgos: false };
    return (
      <GrupoHeader
        id={section.id}
        titulo={section.title}
        abierto={abiertos.has(section.id)}
        auditados={r.auditados}
        total={r.total}
        conHallazgos={r.conHallazgos}
        onToggle={toggleGrupo}
      />
    );
  }, [resumenGrupos, abiertos, toggleGrupo]);

  // renderItem y handlers estables: cada ítem solo se vuelve a dibujar si cambió su resultado
  const renderItem = useCallback(({ item }) => (
    <Nivel2Item
      item={item}
      result={resultsMap.get(item.id) ?? DEFAULT_RESULT}
      saving={saving.has(item.id)}
      onConformeChange={handleConformeChange}
      onObsBlur={handleObsBlur}
      onAddHallazgo={openModal}
      onDeleteHallazgo={handleDeleteHallazgo}
      onEditHallazgo={openEditModal}
      onAddEvidencia={handleAddEvidencia}
      onDeleteEvidencia={handleDeleteEvidencia}
      authToken={authToken}
    />
  ), [resultsMap, saving, authToken, handleConformeChange, handleObsBlur, openModal,
      handleDeleteHallazgo, openEditModal, handleAddEvidencia, handleDeleteEvidencia]);

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
      {sections.length > 0 && (
        <View style={styles.toolbar}>
          <Button
            compact
            mode="text"
            icon={todosAbiertos ? 'unfold-less-horizontal' : 'unfold-more-horizontal'}
            textColor={COLORS.primary}
            onPress={toggleTodos}
          >
            {todosAbiertos ? 'Colapsar todo' : 'Expandir todo'}
          </Button>
        </View>
      )}

      <SectionList
        sections={seccionesVisibles}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        // No reducir windowSize / maxToRenderPerBatch / initialNumToRender: los ítems tienen
        // alturas muy distintas y con una ventana pequeña la lista estima mal las posiciones
        // y la pantalla "brinca" de la mitad hacia abajo (bug de la v1.4.1).
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
  toolbar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLORS.white },
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
