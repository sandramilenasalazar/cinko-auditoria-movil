import React, { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { initDatabase } from './src/database/database';
import { getRutasEvidenciasEnCola } from './src/services/offlineStore';
import { limpiarCopiasHuerfanas } from './src/services/evidenciaFiles';

export default function App() {
  useEffect(() => {
    initDatabase();
    // Borra copias de fotos que ya no están en la cola (solo carpeta privada de la app)
    const enCola = getRutasEvidenciasEnCola();
    if (enCola) limpiarCopiasHuerfanas(enCola).catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <AppNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
