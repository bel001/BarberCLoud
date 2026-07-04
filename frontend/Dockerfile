FROM nginxinc/nginx-unprivileged:alpine

COPY --chown=101:101 index.html admin.html barbero.html callback.html cliente.html login.html register.html reservar.html secretaria.html /usr/share/nginx/html/
COPY --chown=101:101 assets/css/ /usr/share/nginx/html/assets/css/
COPY --chown=101:101 assets/js/ /usr/share/nginx/html/assets/js/

USER 101

EXPOSE 8080
