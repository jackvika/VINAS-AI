FROM php:8.3-apache
RUN a2enmod headers \
    && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && printf 'ServerName localhost\nServerTokens Prod\n' > /etc/apache2/conf-enabled/vinas.conf
COPY *.html *.css app.js LICENSE .htaccess /var/www/html/
COPY static /var/www/html/static
COPY skill /var/www/html/skill
COPY api /var/www/html/api
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "sed -i \"s/^Listen .*/Listen ${PORT}/\" /etc/apache2/ports.conf && sed -i \"s/<VirtualHost \\*:[0-9]*>/<VirtualHost *:${PORT}>/\" /etc/apache2/sites-enabled/000-default.conf && exec apache2-foreground"]
