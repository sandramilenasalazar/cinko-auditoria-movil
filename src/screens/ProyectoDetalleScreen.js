import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Chip, Divider, ActivityIndicator, Button } from 'react-native-paper';
import { getAudProyecto } from '../api/proyectos';

const COLORS = {
  primary: '#1A3ABF',
  gold: '#F5A623',
  navy: '#1A2B5C',
  bg: '#F0F4FF',
  white: '#FFFFFF',
  gray: '#888',
  border: '#E0E7FF',
};

const formatFecha = (fecha) => {
  if (!fecha) return '—';
  return fecha.split('T')[0];
};

const formatMoneda = (valor) => {
  if (valor == null) return '—';
  return `$ ${Number(valor).toLocaleString('es-CO')}`;
};

function Seccion({ titulo, children }) {
  return (
    <Card style={styles.seccion}>
      <Card.Content>
        <Text style={styles.seccionTitulo}>{titulo}</Text>
        <Divider style={styles.divider} />
        {children}
      </Card.Content>
    </Card>
  );
}

function Campo({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>{label}</Text>
      <Text style={styles.campoValue}>{value}</Text>
    </View>
  );
}

export default function ProyectoDetalleScreen({ route, navigation }) {
  const { proyecto } = route.params;
  const [audProyecto, setAudProyecto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAudProyecto(proyecto.id_proyecto ?? proyecto.id)
      .then(setAudProyecto)
      .catch(() => setAudProyecto(null))
      .finally(() => setLoading(false));
  }, [proyecto]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Text style={styles.nombre} numberOfLines={3}>
          {proyecto.nombre || proyecto.nombre_proyecto || '(Sin nombre)'}
        </Text>
        <Chip style={styles.chipEnProceso} textStyle={styles.chipText}>
          EN PROCESO
        </Chip>
      </View>

      {/* Datos generales */}
      <Seccion titulo="Datos generales">
        <Campo label="Contrato" value={proyecto.no_contrato} />
        <Campo label="Objeto" value={proyecto.objeto} />
        <Campo label="Valor inicial" value={formatMoneda(proyecto.valor_inicial)} />
        <Campo
          label="Días interventoría"
          value={
            proyecto.dias_interventoria_pactados != null
              ? String(proyecto.dias_interventoria_pactados)
              : null
          }
        />
      </Seccion>

      {/* Fechas */}
      <Seccion titulo="Fechas">
        <Campo label="Inicio" value={formatFecha(proyecto.fecha_inicio)} />
        <Campo label="Fin pactado" value={formatFecha(proyecto.fecha_fin_pactado)} />
        <Campo label="Fin real" value={formatFecha(proyecto.fecha_fin_real)} />
      </Seccion>

      {/* Características técnicas */}
      {proyecto.caracteristicas_tecnicas && (
        <Seccion titulo="Características técnicas">
          <Text style={styles.textoLargo}>{proyecto.caracteristicas_tecnicas}</Text>
        </Seccion>
      )}

      {/* Recomendaciones pendientes */}
      {proyecto.recomendaciones_pendientes && (
        <Seccion titulo="Recomendaciones pendientes">
          <Text style={styles.textoLargo}>{proyecto.recomendaciones_pendientes}</Text>
        </Seccion>
      )}

      {/* Auditoría */}
      <Seccion titulo="Auditoría">
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 8 }} />
        ) : audProyecto ? (
          <>
            <Campo label="ID auditoría" value={String(audProyecto.id)} />
            <Campo label="Versión" value={audProyecto.id_aud_version ? String(audProyecto.id_aud_version) : null} />
            <Campo label="Estado" value={audProyecto.estado} />
            <Campo label="Creado" value={formatFecha(audProyecto.created_at)} />
          </>
        ) : (
          <Text style={styles.sinDatos}>Sin información de auditoría</Text>
        )}

        {audProyecto && (
          <Button
            mode="contained"
            icon="clipboard-check-outline"
            buttonColor={COLORS.primary}
            style={styles.ejecutarBtn}
            onPress={() => navigation.navigate('EjecutarAuditoria', { audProyecto, proyecto })}
          >
            Ejecutar Auditoría
          </Button>
        )}
      </Seccion>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 40 },
  header: {
    backgroundColor: COLORS.primary,
    padding: 20,
    paddingTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  nombre: {
    flex: 1,
    fontWeight: '700',
    fontSize: 16,
    color: COLORS.white,
    lineHeight: 22,
  },
  chipEnProceso: { backgroundColor: '#FFF3E0' },
  chipText: { color: '#E65100', fontSize: 10, fontWeight: '700' },
  seccion: {
    borderRadius: 12,
    elevation: 2,
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 12,
  },
  seccionTitulo: {
    fontWeight: '700',
    fontSize: 13,
    color: COLORS.primary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: { marginBottom: 10, backgroundColor: COLORS.border },
  campo: { marginBottom: 10 },
  campoLabel: { color: COLORS.gray, fontSize: 11, marginBottom: 2 },
  campoValue: { color: COLORS.navy, fontSize: 14, fontWeight: '500' },
  textoLargo: { color: '#333', lineHeight: 20, fontSize: 14 },
  sinDatos: { color: '#999', fontStyle: 'italic', fontSize: 13 },
  ejecutarBtn: { marginTop: 14, borderRadius: 8 },
});
