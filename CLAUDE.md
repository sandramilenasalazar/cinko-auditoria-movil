# Cinko Auditoria Móvil — Documentación del Proyecto

## ¿Qué es este proyecto?

Aplicación móvil Android para auditores de proyectos de ingeniería civil. Permite ejecutar auditorías en campo, registrar hallazgos con evidencia fotográfica y sincronizar en tiempo real con el servidor.

---

## Repositorio Git

- **URL:** https://github.com/sandramilenasalazar/cinko-auditoria-movil
- **Rama principal:** `master`
- **Estrategia de releases:** tags semánticos (`v1.0.0`, `v1.1.0`, etc.)
- **No hay rama de desarrollo separada** — todo va a `master`

### Convención de versiones
| Tipo de cambio | Ejemplo |
|---|---|
| Corrección de errores | `v1.0.1` |
| Nueva funcionalidad | `v1.1.0` |
| Cambio estructural grande | `v2.0.0` |

---

## Arquitectura del sistema

```
Celular Android
  └── APK (React Native + Expo)
        ├── SQLite local (datos en tiempo real)
        └── API REST ──► PythonAnywhere (backend)
                          └── Base de datos del servidor
```

### Frontend (esta app)
- **Framework:** React Native 0.81 + Expo SDK 54
- **Lenguaje:** JavaScript
- **Navegación:** React Navigation (Stack)
- **UI:** React Native Paper
- **Estado global:** Zustand
- **BD local:** expo-sqlite (SQLite)
- **Autenticación:** JWT con refresh tokens (expo-secure-store)

### Backend
- **Servidor:** PythonAnywhere
- **URL producción:** `https://cinkoingenieria.pythonanywhere.com/api/v1`
- **URL desarrollo:** `http://192.168.50.4:5000/api/v1` (servidor local en red)

---

## Ambientes

### Desarrollo local
```bash
cd auditoria-movil
npx expo start
```
- Escanear QR con **Expo Go** (App Store) en iPhone, o con la cámara
- El celular y el PC deben estar en el **mismo WiFi**
- El backend local debe estar corriendo en `192.168.50.4:5000`
- La variable `__DEV__` es `true` → apunta automáticamente al servidor local

### Producción
- La variable `__DEV__` es `false` → apunta a PythonAnywhere
- El APK se construye automáticamente vía **GitHub Actions** al hacer push de un tag
- Se distribuye como descarga desde **GitHub Releases**

**URL de descarga para usuarios:**
```
https://github.com/sandramilenasalazar/cinko-auditoria-movil/releases/latest/download/cinko-auditoria-movil.apk
```

---

## Flujo de despliegue (release)

1. Hacer los cambios y commitearlos a `master`
2. Actualizar `version` y `versionCode` en `app.json`
3. Crear y subir el tag:
```bash
git add .
git commit -m "descripción del cambio"
git tag v1.x.x
git push origin master
git push origin v1.x.x
```
4. GitHub Actions construye el APK automáticamente (~10 min)
5. La release queda disponible en GitHub con el APK adjunto

Ver detalles completos en `DESPLIEGUE.md`.

---

## Cuentas y servicios

| Servicio | Cuenta | Propósito |
|---|---|---|
| GitHub | sandramilenasalazar | Repositorio y releases |
| Expo | sandramilenasalazar | Project ID del build |
| PythonAnywhere | cinkoingenieria | Backend en producción |

**Expo Project ID:** `39f8128c-1a32-42ba-87c1-0ee2b452035f`

---

## Secrets de GitHub Actions

Estos secrets deben estar configurados en el repositorio (**Settings → Secrets → Actions**):

| Secret | Descripción |
|---|---|
| `EXPO_TOKEN` | Token de acceso de la cuenta Expo |
| `KEYSTORE_BASE64` | Keystore de firma Android codificado en base64 |
| `KEYSTORE_PASSWORD` | Contraseña del keystore |
| `KEY_ALIAS` | `cinko-auditoria` |
| `KEY_PASSWORD` | Contraseña de la clave (igual a KEYSTORE_PASSWORD) |

### ⚠️ Keystore — Información crítica
- Archivo físico: `cinko-auditoria.keystore` (guardado en `C:\Users\smsb0\`)
- **Nunca subir este archivo al repositorio** (está en `.gitignore`)
- **Si se pierde**, todos los usuarios deberán desinstalar la app para instalar la nueva versión
- Formato: PKCS12 con flag `-J-Dkeystore.pkcs12.legacy` (compatibilidad con Android build tools)
- Generado con: `keytool` de PyCharm JBR (Java 17)

---

## Estructura del proyecto

```
auditoria-movil/
├── src/
│   ├── api/
│   │   ├── config.js        ← URL del servidor (dev vs prod automático)
│   │   ├── client.js        ← Cliente HTTP con manejo de tokens
│   │   ├── auth.js          ← Login, refresh token
│   │   ├── proyectos.js     ← Endpoints de proyectos
│   │   ├── auditoria.js     ← Endpoints de auditoría
│   │   └── evidencia.js     ← Subida/eliminación de archivos
│   ├── database/
│   │   ├── database.js      ← Inicialización SQLite
│   │   └── schema.sql       ← Esquema de la BD local
│   ├── navigation/
│   │   └── AppNavigator.js  ← Rutas de la app
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── ProyectosScreen.js
│   │   ├── ProyectoDetalleScreen.js
│   │   └── EjecutarAuditoriaScreen.js  ← Pantalla principal
│   └── store/
│       └── authStore.js     ← Estado global de autenticación (Zustand)
├── .github/workflows/
│   └── release.yml          ← Pipeline de CI/CD
├── assets/                  ← Íconos y splash screen
├── img/                     ← Logos de la empresa
├── app.json                 ← Configuración Expo
├── eas.json                 ← Configuración EAS (no se usa en CI actual)
├── DESPLIEGUE.md            ← Guía detallada de despliegue
└── CLAUDE.md                ← Este archivo
```

---

## Consideraciones para nuevo desarrollador

### Setup inicial
```bash
git clone https://github.com/sandramilenasalazar/cinko-auditoria-movil.git
cd cinko-auditoria-movil
npm install
npx expo start
```

### Lo que debes saber antes de tocar código
1. **La app es online-first** — cada cambio del auditor se guarda directamente en el servidor en tiempo real. El SQLite local existe pero los screens principales leen y escriben por API.
2. **`__DEV__`** controla automáticamente la URL del servidor — no cambies `config.js` manualmente.
3. **No existe rama de staging** — los cambios van directo a `master` y se despliegan con un tag.
4. **El keystore es crítico** — solicitar el archivo `cinko-auditoria.keystore` y su contraseña al administrador del proyecto antes de hacer cualquier release.
5. **Los secrets de GitHub** deben estar configurados para que el CI funcione — solicitar acceso al repositorio con permisos de admin.
6. **`newArchEnabled: false`** en `app.json` — la nueva arquitectura de React Native está desactivada intencionalmente por compatibilidad con las dependencias actuales.

### Comandos útiles
```bash
npx expo start          # Iniciar servidor de desarrollo
npx expo start --clear  # Limpiar caché y reiniciar
npm install             # Instalar dependencias tras un pull
```

### Para publicar una nueva versión
Ver `DESPLIEGUE.md` — sección "Publicar una nueva versión".
