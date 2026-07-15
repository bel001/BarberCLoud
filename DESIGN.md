# BarberCloud Design System

## 1. Atmosphere & Identity

BarberCloud combina una barbería contemporánea con una herramienta operativa sobria. La firma visual es el contraste entre superficies azul noche, acentos cálidos de barbería y un color de rol que orienta al usuario sin cambiar la estructura de la aplicación.

## 2. Color

### Palette

| Role | Token | Value | Usage |
|---|---|---|---|
| Background | `--bg` | `#07101b` | Fondo principal |
| Background/deep | `--bg-deep` | `#040a12` | Profundidad y bandas |
| Surface | `--surface` | `rgba(15, 27, 42, .86)` | Tarjetas y navegación |
| Surface/solid | `--surface-solid` | `#0f1b2a` | Diálogos y superficies opacas |
| Surface/secondary | `--surface-2` | `#14243a` | Estados y controles |
| Surface/tertiary | `--surface-3` | `#1a2c45` | Elementos internos |
| Text/primary | `--text` | `#f7f9fc` | Títulos y contenido principal |
| Text/secondary | `--text-soft` | `#d9e2ec` | Contenido secundario |
| Text/muted | `--muted` | `#91a2b6` | Ayudas y metadatos |
| Accent/default | `--accent` | `#f2b35b` | Acciones y foco |
| Accent/strong | `--accent-strong` | `#ffca76` | Hover y contraste |
| Status/success | `--success` | `#53d39a` | Confirmaciones |
| Status/warning | `--warning` | `#f7b955` | Advertencias |
| Status/error | `--danger` | `#ff6d7f` | Errores y acciones destructivas |
| Border/default | `--line` | `rgba(172, 193, 219, .13)` | Separación de superficies |
| Border/strong | `--line-strong` | `rgba(172, 193, 219, .24)` | Controles y foco |

Los roles usan azul para cliente, dorado para barbero, cian para secretaría y violeta para administración. El color de rol se reserva para navegación, foco, métricas y acciones; nunca reemplaza los estados semánticos.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| Display | `clamp(2.8rem, 6.4vw, 5.65rem)` | 900 | .98 | Portada pública |
| Page title | `clamp(2rem, 4vw, 3.3rem)` | 700 | 1.08 | Cabeceras destacadas |
| H2 | `clamp(1.8rem, 3.4vw, 2.75rem)` | 860 | 1.08 | Secciones |
| H3 | `1.08rem` | 790 | normal | Tarjetas y paneles |
| Lead | `clamp(1rem, 1.7vw, 1.15rem)` | 400 | 1.75 | Introducciones |
| Body | `1rem` | 400 | normal | Contenido base |
| Body/small | `.875rem` | 400 | 1.5 | Información secundaria |
| Caption | `.75rem` | 700 | 1.4 | Etiquetas y tablas |

### Font Stack

- Principal: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Display editorial: `Georgia, "Times New Roman", serif` solo para portadas, cabeceras destacadas y diálogos.

El tamaño no escala directamente con el ancho de viewport; se usan límites de `clamp()` y saltos responsive.

## 4. Spacing & Layout

### Base Unit

El ritmo base es de 4 px. Los valores existentes se agrupan en 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 y 96 px.

### Grid

- Contenedor máximo: 1220 px.
- Margen de escritorio: 18 px mínimo por lado.
- Margen móvil: 12 px por lado.
- Dashboard: barra lateral de 252 px y contenido `minmax(0, 1fr)`.
- Breakpoints operativos: 1180, 1080, 980, 820, 760, 560 y 520 px.
- Todo descendiente de un grid debe aceptar reducción mediante `min-width: 0`.
- Las tablas se muestran como tabla en escritorio y como filas apiladas bajo 820 px.

## 5. Components

### Navigation

- **Structure**: marca, enlaces principales, acciones de sesión y barra contextual por rol.
- **States**: default, hover, active, focus y menú móvil abierto.
- **Accessibility**: botón móvil con `aria-expanded`; foco visible; enlace activo identificable por color y marcador.
- **Responsive**: navegación principal desplegable y barra de rol en cuadrícula bajo 820 px, sin opciones recortadas.

### Button

- **Variants**: primary, outline, danger, success y small.
- **States**: default, hover, active, focus, disabled y loading.
- **Motion**: 180 ms sobre `transform`, fondo, borde y sombra.

### Card

- **Structure**: superficie con borde, fondo tonal y contenido sobre una capa decorativa.
- **Variants**: regular, metric, form, service y premium header.
- **States**: default y hover; formularios incluyen validación nativa y loading.
- **Responsive**: nunca puede ampliar el ancho de su track; la decoración se recorta dentro de la superficie.

### Form Control

- **Structure**: etiqueta, input/select/textarea y ayuda opcional.
- **States**: default, hover, focus, invalid y disabled.
- **Accessibility**: asociación mediante `label`, foco visible y controles táctiles de al menos 42 px.

### Data Table

- **Structure**: cabecera, filas y celdas con `data-label` generado desde la cabecera.
- **States**: fila default y hover; acciones conservan sus estados de botón.
- **Responsive**: bajo 820 px la cabecera se oculta visualmente y cada fila se presenta como bloque etiquetado.

### Dialog

- **Structure**: encabezado, icono, cuerpo, formulario opcional y acciones.
- **States**: open, cancel, confirm, invalid y backdrop click.
- **Accessibility**: `dialog`, nombre accesible, foco inicial y cierre con Escape.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---|---|---|
| Micro | 160-180 ms | ease | Hover, press y foco |
| Standard | 200-300 ms | ease / cubic-bezier(.2,.8,.2,1) | Diálogos y mensajes |
| Emphasis | 400-550 ms | cubic-bezier(.2,.8,.2,1) | Imágenes públicas |

Las animaciones se limitan a `transform`, `opacity`, color y sombra. `prefers-reduced-motion` desactiva movimiento no esencial.

## 7. Depth & Surface

La estrategia es mixta: cambios tonales, borde translúcido y sombras moderadas. Las superficies operativas usan `--shadow-sm`; diálogos y elementos flotantes usan `--shadow`. El desenfoque solo se aplica a elementos elevados como navegación, tarjetas y diálogos.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Objetivo WCAG 2.2 AA.
- Contraste mínimo de 4.5:1 para texto normal y 3:1 para texto grande.
- Foco visible en todos los elementos interactivos.
- Operación completa con teclado y respeto por `prefers-reduced-motion`.
- Ningún contenido funcional puede depender exclusivamente del color.
- No se permite desbordamiento horizontal del documento entre 320 y 1280 px.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| Hojas visuales heredadas paralelas | `app.css`, `landing.css`, `barbero-panel.css` | Tres páginas antiguas aún usan una superficie separada; consolidarlas no forma parte del endurecimiento actual. | Frontend / al migrar esas páginas a `styles.css` |
| Valores decorativos directos | `styles.css` | Sombras, fotografías y capas heredadas preceden este documento. | Frontend / al editar cada componente afectado |
