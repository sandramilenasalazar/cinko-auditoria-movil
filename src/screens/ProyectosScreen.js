import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Image,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { useAuthStore } from '../store/authStore';
import { getProyectos } from '../api/proyectos';

const LOGO = require('../../img/Logo5ingblanco2.png');

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

function ProyectoCard({ proyecto, onPress }) {
  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <Text style={styles.nombreProyecto} numberOfLines={2}>
            {proyecto.nombre || proyecto.nombre_proyecto || '(Sin nombre)'}
          </Text>
          <Chip compact style={styles.chipEnProceso} textStyle={styles.chipText}>
            EN PROCESO
          </Chip>
        </View>

        {proyecto.no_contrato && (
          <Text style={styles.contrato}>Contrato: {proyecto.no_contrato}</Text>
        )}

        <Divider style={styles.divider} />

        <View style={styles.fechasRow}>
          {proyecto.fecha_inicio && (
            <InfoItem icon="▶" label="Inicio" value={formatFecha(proyecto.fecha_inicio)} />
          )}
          {proyecto.fecha_fin_pactado && (
            <InfoItem icon="◀" label="Fin pactado" value={formatFecha(proyecto.fecha_fin_pactado)} />
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

function InfoItem({ label, value }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProyectosScreen({ navigation }) {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const logout = useAuthStore((s) => s.logout);

  const cargarProyectos = useCallback(async () => {
    setError('');
    try {
      const data = await getProyectos();
      const lista = Array.isArray(data)
        ? data
        : (data?.proyectos ?? data?.data ?? data?.items ?? []);
      const enProceso = lista.filter(
        (p) => p.estado === 'EN_PROCESO' || p.aud_estado === 'EN_PROCESO'
      );
      setProyectos(enProceso);
    } catch (e) {
      if (e.message === 'SESSION_EXPIRED') {
        await logout();
      } else {
        setError(e.message || 'Error al cargar proyectos');
      }
    }
  }, [logout]);

  useEffect(() => {
    cargarProyectos().finally(() => setLoading(false));
  }, [cargarProyectos]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarProyectos();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* AppBar manual con logo blanco */}
      <View style={styles.appbar}>
        <Image source={LOGO} style={styles.appbarLogo} resizeMode="contain" />
        <Text style={styles.appbarTitle}>Proyectos en proceso</Text>
        <Text style={styles.refreshBtn} onPress={onRefresh}>↻</Text>
        <Text style={styles.logoutBtn} onPress={logout}>Salir</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Cargando proyectos...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : proyectos.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No hay proyectos en proceso</Text>
        </View>
      ) : (
        <FlatList
          data={proyectos}
          keyExtractor={(item) => String(item.id_proyecto ?? item.id)}
          renderItem={({ item }) => (
            <ProyectoCard
              proyecto={item}
              onPress={() => navigation.navigate('ProyectoDetalle', { proyecto: item })}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  appbar: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  appbarLogo: {
    width: 32,
    height: 32,
  },
  appbarTitle: {
    flex: 1,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  refreshBtn: {
    color: COLORS.white,
    fontSize: 22,
    marginRight: 12,
  },
  logoutBtn: {
    color: COLORS.gold,
    fontWeight: '600',
    fontSize: 14,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    borderRadius: 12,
    elevation: 2,
    backgroundColor: COLORS.white,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  nombreProyecto: {
    flex: 1,
    fontWeight: '700',
    fontSize: 14,
    color: COLORS.navy,
  },
  chipEnProceso: { backgroundColor: '#FFF3E0' },
  chipText: { color: '#E65100', fontSize: 10, fontWeight: '700' },
  contrato: { color: COLORS.gray, fontSize: 12, marginBottom: 4 },
  divider: { marginVertical: 8, backgroundColor: COLORS.border },
  fechasRow: { flexDirection: 'row', gap: 16 },
  infoItem: {},
  infoLabel: { color: COLORS.gray, fontSize: 11 },
  infoValue: { color: COLORS.navy, fontSize: 13, fontWeight: '600' },
  loadingText: { marginTop: 12, color: COLORS.gray },
  errorText: { color: '#C62828', textAlign: 'center' },
  emptyText: { color: COLORS.gray, textAlign: 'center' },
});
