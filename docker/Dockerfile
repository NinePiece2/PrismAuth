FROM oven/bun:slim AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun ci

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

# Generate Prisma client before build
RUN bun run db:generate

RUN bun run build
# RUN bun prune --omit=dev 

FROM oven/bun:slim AS deploy

WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json

# Create startup script that runs migrations before starting the app
RUN echo '#!/bin/sh\\nset -e\\necho \"🔄 Running database migrations...\"\\nbun prisma migrate deploy --schema ./prisma/schema.prisma\\necho \"✅ Migrations complete\"\\necho \"🚀 Starting application...\"\\nexec bun start' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000
CMD ["/app/start.sh"]