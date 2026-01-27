# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj files and restore
COPY src/QueueDrop.Domain/*.csproj ./QueueDrop.Domain/
COPY src/QueueDrop.Infrastructure/*.csproj ./QueueDrop.Infrastructure/
COPY src/QueueDrop.Api/*.csproj ./QueueDrop.Api/
RUN dotnet restore QueueDrop.Api/QueueDrop.Api.csproj

# Copy source and build
COPY src/QueueDrop.Domain/ ./QueueDrop.Domain/
COPY src/QueueDrop.Infrastructure/ ./QueueDrop.Infrastructure/
COPY src/QueueDrop.Api/ ./QueueDrop.Api/
RUN dotnet publish QueueDrop.Api/QueueDrop.Api.csproj -c Release -o /app/publish --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

# Railway sets PORT env var
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

ENTRYPOINT ["dotnet", "QueueDrop.Api.dll"]
