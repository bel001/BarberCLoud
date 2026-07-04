FROM nginxinc/nginx-unprivileged:alpine

COPY index.html admin.html barbero.html callback.html cliente.html login.html register.html reservar.html secretaria.html /usr/share/nginx/html/
COPY assets/css/ /usr/share/nginx/html/assets/css/
COPY assets/js/ /usr/share/nginx/html/assets/js/

USER 101

EXPOSE 8080
