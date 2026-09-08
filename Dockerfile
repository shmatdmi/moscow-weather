FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY weather.html /usr/share/nginx/html/weather.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY weather-api.js /usr/share/nginx/html/weather-api.js
COPY app.js /usr/share/nginx/html/app.js
COPY detail.js /usr/share/nginx/html/detail.js
COPY late-summer-landscape.png /usr/share/nginx/html/late-summer-landscape.png

EXPOSE 80