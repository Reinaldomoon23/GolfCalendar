# Seguridad Git antes de publicar RoundTracker

## Qué ocurrió

El checkout vive en `G:\Mi unidad`, una ubicación sincronizada. El 9 de noviembre
de 2026 faltaba `.git/index`, mientras que `.git/index.lock` seguía presente.
Git interpretó el índice ausente como una eliminación preparada de todos los
1.457 archivos del commit `3188bb1`. El archivo `index.lock` tenía el índice
completo, coincidía con `HEAD` y no había ningún proceso Git activo; se restauró
moviendo ese archivo a `.git/index`. No se sobrescribió ningún archivo fuente.

El estado observado es compatible con una interrupción o conflicto durante la
sincronización del intercambio atómico del índice. No se pudo identificar qué
proceso concreto lo causó.

## Protección instalada

- `.vercelignore` excluye los archivos `.env*` del paquete de despliegue.
- `npm run deploy` y `npm run deploy:all` revisan el índice antes de desplegar.
- `scripts/check-git-publish-state.mjs` bloquea el despliegue si falta el índice,
  existe un `index.lock`, el índice está vacío frente a un `HEAD` con archivos,
  o hay una eliminación preparada de más de 50 archivos / 10% del repositorio.
- `.githooks/pre-push` aplica el mismo límite a los commits que se van a subir.
- El hook está activado en este checkout mediante `core.hooksPath=.githooks`.
- Para activar el hook en una copia nueva: `npm run git-safety:install`.

Una eliminación masiva deliberada requiere revisión expresa. Solo entonces se
puede autorizar una ejecución concreta con `PUBLISH_ALLOW_MASS_DELETIONS=1`.

## Procedimiento si vuelve a fallar

1. No ejecutes `git add -A`, `git reset --hard` ni publiques.
2. Comprueba si hay procesos `git` activos y si existen `.git/index` y
   `.git/index.lock`.
3. Si no hay un proceso activo, valida el lock antes de recuperarlo:

   ```powershell
   $env:GIT_INDEX_FILE = (Resolve-Path .git\index.lock).Path
   git ls-files | Measure-Object
   git diff --cached --stat
   Remove-Item Env:GIT_INDEX_FILE
   ```

4. Solo si el índice alternativo es válido y coincide con `HEAD`, restaura el
   archivo al nombre `.git/index`. Si difiere o no se puede leer, conserva ambos
   archivos y trabaja desde un clon limpio, copiando los cambios del usuario.
5. Ejecuta `git status --short --branch` y revisa `git diff --cached --stat`
   antes de preparar o subir cualquier cambio.

## Prevención a largo plazo

Mantén el checkout Git en una carpeta local que no sincronice `.git` (por
ejemplo, bajo `C:\Users\miste\source`) y usa Google Drive para documentos o
copias, no para sincronizar la base de datos Git. Evita abrir el mismo checkout
desde dos equipos o procesos simultáneamente.
