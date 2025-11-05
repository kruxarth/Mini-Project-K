FROM php:8.2-fpm

# System deps
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    curl \
 && docker-php-ext-install pdo pdo_mysql zip gd mbstring xml \
 && rm -rf /var/lib/apt/lists/*

# Composer
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /var/www/html

# Expose PHP-FPM port
EXPOSE 9000

CMD ["php-fpm"]
