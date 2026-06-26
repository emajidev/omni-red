# --- ETAPA 1: Compilación ---
FROM node:20-alpine AS build

# Instalar pnpm globalmente
RUN npm install -g pnpm

WORKDIR /app

# Copiar manifiestos de dependencias
COPY package.json pnpm-lock.yaml* ./

# SOLUCIÓN: Forzar a pnpm a instalar absolutamente todo (incluyendo devDependencies)
# agregando la bandera --prod=false
RUN pnpm install --frozen-lockfile --ignore-workspace --prod=false

# Copiar el resto del código fuente
COPY . .

# Compilar la aplicación para producción
RUN pnpm run build --configuration=production


# --- ETAPA 2: Servidor de producción con Node ---
FROM node:20-alpine

WORKDIR /app

# Instalar 'serve' globalmente para servir archivos estáticos
RUN npm install -g serve

# Copiar únicamente los archivos compilados desde la etapa anterior
# (Asegúrate de que esta ruta coincida con el output real de tu dist/)
COPY --from=build /app/dist/omni-red-frontend/browser ./public

# Exponer el puerto estándar que Railway leerá de forma automática
EXPOSE 4200

# Ejecutar 'serve' apuntando a la carpeta 'public'
CMD ["serve", "-s", "public", "-l", "4200"]