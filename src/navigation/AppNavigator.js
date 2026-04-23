import React, { useEffect } from 'react';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

const LOGO = require('../../img/Logo5ing3.png');
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/authStore';
import LoginScreen from '../screens/LoginScreen';
import ProyectosScreen from '../screens/ProyectosScreen';
import ProyectoDetalleScreen from '../screens/ProyectoDetalleScreen';
import EjecutarAuditoriaScreen from '../screens/EjecutarAuditoriaScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <Image source={LOGO} style={styles.splashLogo} resizeMode="contain" />
        <ActivityIndicator size="large" color="#1A3ABF" style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!isAuthenticated ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Proyectos"
              component={ProyectosScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProyectoDetalle"
              component={ProyectoDetalleScreen}
              options={{
                title: 'Detalle del proyecto',
                headerStyle: { backgroundColor: '#1A3ABF' },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: { fontWeight: '700' },
              }}
            />
            <Stack.Screen
              name="EjecutarAuditoria"
              component={EjecutarAuditoriaScreen}
              options={({ route }) => ({
                title: route.params?.proyecto?.nombre ?? 'Ejecutar Auditoría',
                headerStyle: { backgroundColor: '#1A3ABF' },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: { fontWeight: '700' },
              })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: 260,
    height: 130,
  },
});
