FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY serene-hills.png /usr/share/nginx/html/serene-hills.png

EXPOSE 80