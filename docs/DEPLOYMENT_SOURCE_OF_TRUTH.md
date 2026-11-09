# Fuente oficial y publicaciones

## Fuente oficial

- Carpeta: `C:\Users\miste\Documents\Codex\MyGolfLife`
- Repositorio: `Reinaldomoon23/GolfCalendar`
- Rama de trabajo de este checkout: `codex/mygolflife-baseline`
- Proyecto Vercel: `golf-calendar-v3` (ver `.vercel/project.json`)

No despliegues desde copias antiguas del repositorio. Las ramas pueden contener
cambios funcionales distintos aunque compartan nombre, dominio o historial.
Antes de publicar, comprueba `git status --short --branch`, la rama activa y el
identificador del proyecto Vercel.

## Publicar

Desde la carpeta oficial:

```powershell
npm run deploy:all
```

Este comando compila la PWA, publica en Vercel y sube la aplicación a
`/GolfTeam/` en Hostinger. Confirma que Vercel informa `READY` y que el script
FTP termina correctamente. Si el script avisa de archivos antiguos en la raíz
de Hostinger, revísalos antes de borrarlos manualmente.

`pnpm-lock.yaml` está versionado porque Vercel usa pnpm y requiere que sus
dependencias estén sincronizadas con `package.json`. Tras cambiar dependencias,
actualiza el lockfile y verifica la instalación congelada:

```powershell
pnpm install --lockfile-only
pnpm install --frozen-lockfile
```

## Incidente del 9 de noviembre de 2026

Se publicó una vez desde otra copia local, que apuntaba al mismo proyecto
Vercel pero no contenía las últimas revisiones de `MyGolfLife`. Se corrigió
publicando de nuevo desde la carpeta oficial indicada arriba. La integración
RFEGStats preparada en aquella otra rama no está incluida en esta versión; hay
que adaptarla y revisarla en esta rama antes de publicarla.
