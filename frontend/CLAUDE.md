# Reglas del frontend

Este proyecto mantiene los 3 lenguajes del frontend estrictamente separados: **HTML**, **CSS** y **JS** no se mezclan entre sí.

- HTML (`frontend/*.html`): solo estructura y marcado. Nada de `style="..."` inline ni bloques `<style>` embebidos.
- CSS (`frontend/assets/css/`): toda la presentación vive acá, referenciada desde el HTML con `<link rel="stylesheet">`.
- JS (`frontend/assets/js/`): todo el comportamiento vive acá, referenciado desde el HTML con `<script src="...">`. Nada de `<script>` inline ni atributos `onclick="..."` (u otros `on*`) en el HTML.

Al editar o crear páginas del frontend, mover cualquier estilo o script inline a su archivo correspondiente en `assets/css` o `assets/js` en vez de dejarlo embebido en el HTML.
