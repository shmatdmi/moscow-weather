FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY late-summer-landscape.png /usr/share/nginx/html/late-summer-landscape.png

EXPOSE 80