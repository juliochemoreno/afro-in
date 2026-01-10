# Plan de Migración: afroin-legaci → afro-in

## 📊 Resumen de Diferencias

| Aspecto | Legacy (Pages) | Nuevo (Worker) |
|---------|----------------|----------------|
| Runtime | Cloudflare Pages | Cloudflare Worker |
| Astro | 5.16.5 | 5.10.1 |
| Adapter | Ninguno (static) | @astrojs/cloudflare |
| React | ✅ v19 | ❌ No instalado |
| Tailwind | ✅ v4 | ❌ No instalado |
| D1 Database | ✅ Configurado | ❌ No configurado |
| Integrations | React | MDX, Sitemap |

---

## 📋 Fases de Migración

### Fase 1: Preparación del Entorno 🔧
- [ ] Instalar dependencias faltantes en afro-in
  - [ ] @astrojs/react
  - [ ] react, react-dom
  - [ ] @tailwindcss/vite, tailwindcss
  - [ ] Radix UI components
  - [ ] lucide-astro, lucide-react
  - [ ] class-variance-authority, clsx, tailwind-merge
  - [ ] tom-select (para formularios)
- [ ] Configurar Tailwind CSS v4 con Vite plugin
- [ ] Configurar React integration en astro.config.mjs
- [ ] Configurar D1 Database en wrangler.json

### Fase 2: Migración de Estilos 🎨
- [ ] Copiar estilos globales (global.css → styles/)
- [ ] Copiar estilos del carrito (cart.css → styles/)
- [ ] Adaptar variables CSS si es necesario

### Fase 3: Migración de Assets 📦
- [ ] Copiar directorio de imágenes (src/assets/img → src/assets/img)
- [ ] Copiar fuentes si hay personalizadas
- [ ] Actualizar rutas de importación

### Fase 4: Migración de Componentes ⚙️
- [ ] Copiar Layout principal
- [ ] Migrar componentes principales:
  - [ ] Header.astro
  - [ ] Footer.astro
  - [ ] Hero.astro
  - [ ] About.astro
  - [ ] Documentary.astro
  - [ ] Gallery.astro
  - [ ] Store.astro
  - [ ] Events.astro
  - [ ] Registration.astro
  - [ ] Allies.astro
  - [ ] Community.astro
  - [ ] Contact.astro
  - [ ] CartWidget.astro
- [ ] Migrar componentes UI (ui/)
- [ ] Actualizar importaciones de assets

### Fase 5: Migración de Páginas 📄
- [ ] Actualizar index.astro
- [ ] Migrar artistas.astro
- [ ] Migrar gracias.astro
- [ ] Migrar programacion/ (directorio)
- [ ] Migrar comunidad/ (directorio)
- [ ] Migrar tienda/ (directorio)

### Fase 6: Migración de Contenido 📝
- [ ] Copiar colección tour2026
- [ ] Actualizar content.config.ts con schemas
- [ ] Migrar data/ (si aplica)
- [ ] Migrar docs/ (si aplica)

### Fase 7: Migración de API Functions 🔌
- [ ] Crear rutas API en src/pages/api/
  - [ ] confirmar.ts → src/pages/api/confirmar.ts
  - [ ] contador.ts → src/pages/api/contador.ts  
  - [ ] donante.ts → src/pages/api/donante.ts
- [ ] Adaptar para usar Astro API routes con Cloudflare adapter
- [ ] Configurar D1 bindings correctamente

### Fase 8: Configuración Final ⚡
- [ ] Actualizar astro.config.mjs (site, prefetch, etc)
- [ ] Configurar Client Router para transiciones
- [ ] Verificar wrangler.json con todos los bindings
- [ ] Actualizar env.d.ts con tipos de Cloudflare

### Fase 9: Testing y Validación ✅
- [ ] Ejecutar build
- [ ] Probar en desarrollo local
- [ ] Verificar todas las rutas
- [ ] Probar formularios y APIs
- [ ] Verificar responsive design
- [ ] Probar transiciones de página

---

## 🔄 Orden de Ejecución Sugerido

1. **Primero**: Fase 1 (dependencias y configuración base)
2. **Segundo**: Fase 2 + 3 (estilos y assets)
3. **Tercero**: Fase 4 (componentes - empezando por Layout)
4. **Cuarto**: Fase 5 + 6 (páginas y contenido)
5. **Quinto**: Fase 7 (APIs)
6. **Sexto**: Fase 8 + 9 (configuración final y testing)

---

## 📝 Notas Importantes

### Diferencias clave Pages vs Worker:
1. **API Routes**: En Pages usas `functions/api/*.ts`, en Workers usas `src/pages/api/*.ts`
2. **Bindings**: En Worker, accedes via `Astro.locals.runtime.env`
3. **Build Output**: El adapter de Cloudflare genera `_worker.js`

### Consideraciones de compatibilidad:
- El proyecto legacy usa `output: 'static'` - el nuevo usará el default del adapter (server/hybrid)
- Las View Transitions (ClientRouter) funcionan igual
- Tailwind v4 con Vite plugin requiere configuración diferente

---

## ⏱️ Estimación de Tiempo

| Fase | Tiempo Estimado |
|------|-----------------|
| Fase 1 | 15-20 min |
| Fase 2 | 5-10 min |
| Fase 3 | 5 min |
| Fase 4 | 30-45 min |
| Fase 5 | 15-20 min |
| Fase 6 | 10-15 min |
| Fase 7 | 20-30 min |
| Fase 8-9 | 15-20 min |
| **Total** | **2-3 horas** |

---

## ¿Empezamos?

Una vez que confirmes, comenzaré con la **Fase 1**: instalación de dependencias y configuración del entorno.
