FROM nginxinc/nginx-unprivileged:alpine

COPY *.html /usr/share/nginx/html/
COPY assets/css/ /usr/share/nginx/html/assets/css/
COPY assets/js/ /usr/share/nginx/html/assets/js/
COPY assets/img/ /usr/share/nginx/html/assets/img/

USER 101

EXPOSE 8080
