# Guía de Despliegue — Cinko Auditoria Movil

## ¿Cómo funciona?

Cada vez que se publica una nueva versión (tag), GitHub Actions construye automáticamente el APK usando **EAS Build** (servicio de Expo) y lo adjunta a una **GitHub Release** descargable.

```
git tag v1.x.x  →  GitHub Actions  →  EAS Build (APK)  →  GitHub Release
```

---

## Configuración inicial (ya realizada)

### Archivos creados/modificados

| Archivo | Qué hace |
|---|---|
| `app.json` | Nombre, slug, package Android (`com.auditoria.movil`), projectId de Expo |
| `eas.json` | Perfiles de build: `preview` (APK) y `production` (AAB) |
| `.github/workflows/release.yml` | Workflow que se dispara con cada tag `v*.*.*` |

### Servicios configurados

- **Expo:** cuenta `sandramilenasalazar`, proyecto `cinko-auditoria-movil` con ID `39f8128c-1a32-42ba-87c1-0ee2b452035f`
- **GitHub:** repositorio `https://github.com/sandramilenasalazar/cinko-auditoria-movil`
- **Secret en GitHub:** `EXPO_TOKEN` (Settings → Secrets → Actions)

---

## Setup desde cero (si se debe recrear el repositorio)

### 1. Instalar herramientas
```bash
npm install --global eas-cli
```

### 2. Dentro de la carpeta `auditoria-movil/`, vincular con Expo
```bash
eas login
eas init --id 39f8128c-1a32-42ba-87c1-0ee2b452035f
```

### 3. Conectar con GitHub y subir el código
```bash
git remote add origin https://github.com/sandramilenasalazar/cinko-auditoria-movil.git
git add .
git commit -m "Setup inicial"
git push -u origin master
```

### 4. Agregar el EXPO_TOKEN en GitHub
1. Ir a [expo.dev](https://expo.dev) → avatar → **Account Settings** → **Access Tokens** → **Create Token**
2. Ir al repo en GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Nombre: `EXPO_TOKEN`
   - Valor: el token copiado de Expo

---

## Publicar una nueva versión

### 1. Asegurarse de que los cambios estén commiteados
```bash
git add .
git commit -m "Descripción de los cambios"
git push origin master
```

### 2. Actualizar la versión en `app.json`
Antes de publicar, incrementar `version` y `versionCode`:
```json
"version": "1.1.0",
"android": {
  "versionCode": 2
}
```
> `version` es lo que ve el usuario (ej: 1.0.0, 1.1.0). `versionCode` debe ser siempre un número entero mayor al anterior.

### 3. Crear y subir el tag
```bash
git add app.json
git commit -m "Version 1.1.0"
git tag v1.1.0
git push origin master
git push origin v1.1.0
```

### 4. Verificar el build
Ir a: `https://github.com/sandramilenasalazar/cinko-auditoria-movil/actions`

El workflow tarda entre **10 y 20 minutos**. Al finalizar, la release queda disponible automáticamente.

---

## URLs para compartir con usuarios

| Propósito | URL |
|---|---|
| Página de releases (el usuario elige versión) | `https://github.com/sandramilenasalazar/cinko-auditoria-movil/releases/latest` |
| Descarga directa del APK más reciente | `https://github.com/sandramilenasalazar/cinko-auditoria-movil/releases/latest/download/cinko-auditoria-movil.apk` |

> La URL de descarga directa siempre apunta a la versión más nueva sin necesidad de cambiarla.

---

## Instrucciones de instalación para el usuario final (Android)

1. Abrir el enlace de descarga directa desde el celular
2. Ir a **Ajustes → Seguridad** (o **Ajustes → Aplicaciones → Instalar apps desconocidas**)
3. Habilitar la instalación desde el navegador o administrador de archivos
4. Abrir el archivo `.apk` descargado y pulsar **Instalar**

---

## Convención de versiones

Usar **versionado semántico**: `vMAYOR.MENOR.PARCHE`

| Tipo de cambio | Ejemplo |
|---|---|
| Corrección de errores | `v1.0.1` |
| Nueva funcionalidad | `v1.1.0` |
| Cambio grande o restructura | `v2.0.0` |
