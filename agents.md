# Agents Guide

## Project

Static Moscow weather page served by nginx in Docker.

## Important Files

- `index.html` - the full frontend page.
- `nginx.conf` - nginx virtual host config for serving the page.
- `Dockerfile` - builds the production image from `nginx:1.27-alpine`.
- `.dockerignore` - keeps the Docker build context small.

## Common Commands

Build the Docker image:

```powershell
docker --context desktop-linux build -t shmatdmi/moscow-weather:latest .
```

Run it locally:

```powershell
docker --context desktop-linux run --rm -p 8080:80 shmatdmi/moscow-weather:latest
```

Push to Docker Hub:

```powershell
docker --context desktop-linux push shmatdmi/moscow-weather:latest
```

## Change Notes

- Keep the app self-contained unless a build tool is intentionally added.
- Prefer editing `index.html` directly for UI/content changes.
- After changes, rebuild the image before pushing.
- Do not change the Docker Hub image name unless the deployment target changes.
