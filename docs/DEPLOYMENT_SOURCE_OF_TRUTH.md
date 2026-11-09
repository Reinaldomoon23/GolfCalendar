# Fuente oficial y publicaciones

## Fuente oficial

- Carpeta: `C:\Users\miste\Documents\Codex\MyGolfLife`
- Única carpeta activa. `G:\Mi unidad\00ReinaldoCodes\Players Calendar` se
  conserva solo como archivo para consultas o recuperación puntual de material.
- Repositorio: `Reinaldomoon23/GolfCalendar`
- Rama de trabajo de este checkout: `codex/mygolflife-baseline`
- Proyecto Vercel: `golf-calendar-v3` (ver `.vercel/project.json`)
- Rama automática de producción en Vercel, verificada el 9 de noviembre de 2026:
  `codex/mygolflife-baseline`.

No despliegues desde copias antiguas del repositorio. Las ramas pueden contener
cambios funcionales distintos aunque compartan nombre, dominio o historial.
Antes de publicar, comprueba `git status --short --branch`, la rama activa y el
identificador del proyecto Vercel.

La copia de Google Drive no debe tratarse como sincronizada ni actual. Si hace
falta recuperar un archivo histórico, cópialo de forma selectiva tras revisar su
contenido; nunca hagas una sincronización destructiva del proyecto completo.

## Protección de carpeta y archivos

Antes de cualquier escritura, borrado o movimiento, ejecuta
`git rev-parse --show-toplevel` y compara la ruta normalizada (barras `/` o `\`,
sin distinguir mayúsculas) con `C:\Users\miste\Documents\Codex\MyGolfLife`.
Si apunta a otra carpeta o hay duda sobre la ubicación, detente antes de actuar.
No borres ni limpies archivos de otra copia para “sincronizarla”.

La rama automática de producción ya coincide con la rama activa de `MyGolfLife`.
Vercel fue actualizado desde Settings → Environments → Production → Branch
Tracking y la API confirmó el valor. Publica desde esta carpeta con el comando
indicado.

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

Las reglas de Firestore de esta app se despliegan explícitamente al proyecto de
producción `golfscorings-e4338` (la carpeta no lleva `.firebaserc`):

```powershell
npx firebase-tools deploy --only firestore:rules --project golfscorings-e4338
```

Antes de desplegarlas, revisa `git rev-parse --show-toplevel` y confirma el
proyecto objetivo. No omitas `--project` ni sustituyas el identificador por uno
de los otros proyectos Firebase de la cuenta.

## Incidente del 9 de noviembre de 2026

Se publicó una vez desde otra copia local, que apuntaba al mismo proyecto
Vercel pero no contenía las últimas revisiones de `MyGolfLife`. Se corrigió
publicando de nuevo desde la carpeta oficial indicada arriba y configurando
esta rama como rama de producción. La integración RFEGStats preparada en aquella
otra rama aún debe adaptarse y revisarse en esta rama antes de publicarla.
