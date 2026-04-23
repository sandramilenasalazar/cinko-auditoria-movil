import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { useAuthStore } from '../store/authStore';

const LOGO = require('../../img/Logo5ing3.png');

const COLORS = {
  primary: '#1A3ABF',
  gold: '#F5A623',
  navy: '#1A2B5C',
  bg: '#F0F4FF',
  white: '#FFFFFF',
  gray: '#888',
};

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setError(e.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.logoZone}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.appLabel}>Sistema de Auditoría</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Iniciar sesión</Text>

        <TextInput
          label="Usuario"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          mode="outlined"
          outlineColor="#D0D8F0"
          activeOutlineColor={COLORS.primary}
          left={<TextInput.Icon icon="account" color={COLORS.primary} />}
        />

        <TextInput
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={styles.input}
          mode="outlined"
          outlineColor="#D0D8F0"
          activeOutlineColor={COLORS.primary}
          left={<TextInput.Icon icon="lock" color={COLORS.primary} />}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              color={COLORS.gray}
              onPress={() => setShowPassword(!showPassword)}
            />
          }
        />

        <HelperText type="error" visible={!!error} style={styles.errorText}>
          {error}
        </HelperText>

        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
          buttonColor={COLORS.primary}
          labelStyle={styles.buttonLabel}
        >
          Ingresar
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    padding: 24,
  },
  logoZone: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 220,
    height: 110,
  },
  appLabel: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.navy,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    elevation: 4,
    shadowColor: '#1A3ABF',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
    backgroundColor: COLORS.white,
  },
  errorText: {
    marginBottom: 4,
  },
  button: {
    marginTop: 8,
    borderRadius: 10,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
