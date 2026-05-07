import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, Button, Divider, Modal, Portal, TextInput } from 'react-native-paper';
import SignatureCanvas from 'react-native-signature-canvas';
import { COLORS, isValidUri } from './AuditoriaComponents';

export function FirmaModal({ visible, onDismiss, onConfirm, initialNombre, initialFirmaUrl }) {
  const sigRef = useRef(null);
  const [nombre, setNombre] = useState('');
  const [hasFirma, setHasFirma] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Reiniciar estado cada vez que el modal se abre
  useEffect(() => {
    if (visible) {
      setNombre(initialNombre ?? '');
      setHasFirma(false);
      setGuardando(false);
    }
  }, [visible]);

  const handleEnd = () => setHasFirma(true);

  const handleClear = () => {
    sigRef.current?.clearSignature();
    setHasFirma(false);
  };

  const handleGuardar = () => {
    if (!nombre.trim() || !hasFirma || guardando) return;
    setGuardando(true);
    sigRef.current?.readSignature();
  };

  const handleOK = (sig) => {
    const base64 = sig.replace(/^data:image\/[a-z]+;base64,/, '');
    onConfirm(nombre.trim(), base64);
    setGuardando(false);
  };

  const handleDismiss = () => {
    sigRef.current?.clearSignature();
    onDismiss();
  };

  // Solo URIs absolutas válidas (https:// o file://) — nunca paths relativos
  const firmaUrl = isValidUri(initialFirmaUrl) ? initialFirmaUrl : null;

  const canSave = nombre.trim().length > 0 && hasFirma;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={styles.modal}
      >
        {/* Encabezado */}
        <View style={styles.header}>
          <Text style={styles.title}>Acompañante de auditoría</Text>
          <Text style={styles.subtitle}>Nombre y firma de quien acompañó por parte del cliente</Text>
        </View>

        <Divider style={styles.divider} />

        {/* Cuerpo con scroll desactivado — layout fijo */}
        <View style={styles.body}>
          <TextInput
            label="Nombre del acompañante"
            value={nombre}
            onChangeText={setNombre}
            mode="outlined"
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
            style={styles.input}
          />

          {/* Firma anterior (solo si existe y es URL válida) */}
          {firmaUrl && (
            <View style={styles.firmaActualWrap}>
              <Text style={styles.firmaActualLabel}>Firma registrada — dibuja para reemplazar</Text>
              <Image
                source={{ uri: firmaUrl }}
                style={styles.firmaActualImg}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Etiqueta del canvas */}
          <Text style={[styles.canvasLabel, hasFirma && styles.canvasLabelOK]}>
            {hasFirma ? 'Firma capturada ✓' : 'Firma con el dedo en el recuadro'}
          </Text>

          {/* Canvas de firma — toma todo el espacio disponible */}
          <View style={[styles.canvasWrap, hasFirma && styles.canvasWrapOK]}>
            <SignatureCanvas
              ref={sigRef}
              onOK={handleOK}
              onEnd={handleEnd}
              descriptionText=""
              clearText=""
              confirmText=""
              scrollable={false}
              webStyle={webStyle}
              style={styles.sigCanvas}
            />
          </View>

          <Button
            mode="text"
            onPress={handleClear}
            textColor={COLORS.gray}
            compact
            style={styles.clearBtn}
          >
            Limpiar firma
          </Button>
        </View>

        {/* Botones — siempre al fondo, fuera del cuerpo */}
        <Divider style={styles.divider} />
        <View style={styles.actions}>
          <Button onPress={handleDismiss} textColor={COLORS.gray}>
            Cancelar
          </Button>
          <Button
            mode="contained"
            onPress={handleGuardar}
            disabled={!canSave || guardando}
            loading={guardando}
            buttonColor={COLORS.primary}
          >
            Guardar
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const webStyle = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: transparent;
    width: 100%; height: 100%; overflow: hidden;
  }
  .m-signature-pad {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    margin: 0; border: none; box-shadow: none; background: transparent;
  }
  .m-signature-pad--body {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: none;
  }
  .m-signature-pad--footer { display: none; }
  canvas { width: 100% !important; height: 100% !important; background: #F8F9FF; }
`;

const styles = StyleSheet.create({
  modal: {
    backgroundColor: COLORS.white,
    marginHorizontal: 12,
    marginVertical: 32,
    borderRadius: 16,
    overflow: 'hidden',
    // Sin maxHeight — deja que el layout interno defina la altura
  },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontWeight: '700', fontSize: 16, color: COLORS.navy, marginBottom: 4 },
  subtitle: { fontSize: 12, color: COLORS.gray },
  divider: { backgroundColor: COLORS.border },
  body: { paddingHorizontal: 20, paddingTop: 12 },
  input: { backgroundColor: COLORS.white, marginBottom: 12 },
  canvasLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  canvasLabelOK: { color: COLORS.si },
  canvasWrap: {
    height: 240,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    backgroundColor: '#F8F9FF',
  },
  canvasWrapOK: { borderColor: COLORS.si },
  sigCanvas: { flex: 1 },
  clearBtn: { alignSelf: 'flex-end', marginTop: 2, marginBottom: 8 },
  firmaActualWrap: {
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  firmaActualLabel: { fontSize: 11, color: COLORS.gray, marginBottom: 6, fontWeight: '600' },
  firmaActualImg: { width: '100%', height: 70, borderRadius: 6 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
});
