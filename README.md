# IPP Sistema — Deploy Guide

## ✅ Base de datos — YA CONFIGURADA

Supabase URL: `https://gcwadtxoqkbwtqxjdtlf.supabase.co`

### Usuarios de prueba creados:
| Email | Password | Rol |
|-------|----------|-----|
| cima@podemos.mx | Podemos2026! | CIMA |
| ce1@podemos.mx | Podemos2026! | CE |
| direccion@podemos.mx | Podemos2026! | Dirección |

---

## 🚀 Deploy en GitHub Pages — 3 pasos (5 minutos)

### Paso 1: Crear repositorio
1. Ve a **https://github.com/new**
2. Nombre: `ipp-sistema`
3. Visibilidad: **Private**
4. Click **Create repository**

### Paso 2: Subir archivos
1. En el repo → **Add file → Upload files**
2. Arrastra TODOS los archivos de esta carpeta
3. Commit message: `IPP Sistema v1.0`
4. Click **Commit changes**

### Paso 3: Activar GitHub Pages
1. **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / folder: **/ (root)**
4. Click **Save**
5. Espera 1-2 minutos

### Tu URL final:
`https://TU_USUARIO.github.io/ipp-sistema/`

---

## Archivos del proyecto

| Archivo | Función |
|---------|---------|
| `index.html` | Login — redirige por rol automáticamente |
| `cima.html` | Vista CIMA — gestión operativa completa |
| `ce.html` | Vista CE — checklist + evaluación grupal |
| `dashboard.html` | Vista Dirección — dashboard ejecutivo |
| `ipp-core.js` | Motor scoring + Supabase config con credenciales |
| `ipp-styles.css` | Sistema de diseño compartido |

---

## Flujo de prueba rápida

1. Login con `cima@podemos.mx` → crear un prospecto → llenar campos ⚡ → ver score en tiempo real
2. Aplicar post-buró → crear grupo → asignar a `ce1@podemos.mx`
3. Login con `ce1@podemos.mx` → evaluar integrantes → calificación grupal
4. Login con `direccion@podemos.mx` → ver dashboard con datos reales
