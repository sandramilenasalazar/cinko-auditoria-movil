# Cinko Auditoria Móvil

![Platform](https://img.shields.io/badge/platform-Android-green)
![Version](https://img.shields.io/github/v/release/sandramilenasalazar/cinko-auditoria-movil)
![Build](https://img.shields.io/github/actions/workflow/status/sandramilenasalazar/cinko-auditoria-movil/release.yml)

Aplicación móvil Android para auditores de proyectos de ingeniería civil. Permite ejecutar auditorías en campo, registrar hallazgos con evidencia fotográfica y sincronizar en tiempo real con el servidor.

---

## Descargar la app

[![Descargar APK](https://img.shields.io/badge/Descargar-APK-blue?style=for-the-badge&logo=android)](https://github.com/sandramilenasalazar/cinko-auditoria-movil/releases/latest/download/cinko-auditoria-movil.apk)

> Compatible únicamente con **Android**. iOS no está disponible aún.

---

## Arquitectura

```
Celular Android
  └── APK (React Native + Expo)
        └── API REST ──► PythonAnywhere (backend)
                          └── Base de datos del servidor
```

| Capa | Tecnología |
|---|---|
| App móvil | React Native 0.81 + Expo SDK 54 |
| UI | React Native Paper |
| Estado global | Zustand |
| Base de datos local | SQLite (expo-sqlite) |
| Autenticación | JWT + expo-secure-store |
| Backend | PythonAnywhere |
| CI/CD | GitHub Actions |

---

## Ambientes

| Variable | Desarrollo | Producción |
|---|---|---|
| Servidor API | `http://192.168.50.4:5000/api/v1` | `https://cinkoingenieria.pythonanywhere.com/api/v1` |
| Build | `npx expo start` | GitHub Actions (tag) |
| Distribución | Expo Go | GitHub Releases |

La URL del servidor se selecciona automáticamente según el ambiente mediante la variable `__DEV__` de React Native.

---

## Setup para desarrollo

### Requisitos
- Node.js 20+
- Expo Go instalado en el celular ([App Store](https://apps.apple.com/app/expo-go/id982107779) / [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent))
- El celular y el PC en el **mismo WiFi**
- Backend local corriendo en `192.168.50.4:5000`

### Instalación

```bash
git clone https://github.com/sandramilenasalazar/cinko-auditoria-movil.git
cd cinko-auditoria-movil
npm install
npx expo start
```

Escanea el QR que aparece en la terminal con la cámara del celular (iPhone) o con Expo Go (Android).

---

## Despliegue a producción

```bash
# 1. Actualizar version y versionCode en app.json
# 2. Commitear cambios
git add .
git commit -m "descripción del cambio"

# 3. Crear y subir el tag
git tag v1.x.x
git push origin master
git push origin v1.x.x
```

GitHub Actions construye el APK automáticamente (~10 min) y lo publica en GitHub Releases.

Ver guía completa en [DESPLIEGUE.md](DESPLIEGUE.md).

---

## Secrets requeridos en GitHub Actions

| Secret | Descripción |
|---|---|
| `EXPO_TOKEN` | Token de la cuenta Expo |
| `KEYSTORE_BASE64` | Keystore de firma Android en base64 |
| `KEYSTORE_PASSWORD` | Contraseña del keystore |
| `KEY_ALIAS` | Alias de la clave (`cinko-auditoria`) |
| `KEY_PASSWORD` | Contraseña de la clave |

> ⚠️ El archivo `cinko-auditoria.keystore` debe custodiarse de forma segura. Si se pierde, los usuarios deberán desinstalar la app para poder actualizar.

---

## Estructura del proyecto

```
├── src/
│   ├── api/            # Comunicación con el backend
│   ├── database/       # SQLite local
│   ├── navigation/     # Rutas de la app
│   ├── screens/        # Pantallas
│   └── store/          # Estado global (Zustand)
├── .github/workflows/  # CI/CD
├── assets/             # Íconos y splash
├── app.json            # Configuración Expo
├── DESPLIEGUE.md       # Guía de despliegue
└── CLAUDE.md           # Documentación técnica detallada
```

---

## Cuentas y servicios

| Servicio | Cuenta |
|---|---|
| GitHub | sandramilenasalazar |
| Expo | sandramilenasalazar |
| PythonAnywhere | cinkoingenieria |
