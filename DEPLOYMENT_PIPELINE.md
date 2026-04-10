# 🚀 Arquitectura de Despliegue Actual (Vercel + Firebase)

**Última actualización**: Abril 2026

Este documento detalla cómo funciona la infraestructura de despliegue moderna de **Players Calendar**, habiendo abandonado el antiguo sistema de subidas FTP y migraciones manuales en favor de un ecosistema enteramente Serverless y Server-Side autoescalable.

Todos los LLMs y desarrolladores deben referirse a este documento para entender dónde viven los componentes del código y cómo publicarlos.

## 🏗️ La Arquitectura Cloud

### 1. 🖥️ Frontend y Serverless Backend (Vercel)
Vercel es el corazón del alojamiento, sirviendo tanto la App React (SPA) como el backend Node.

* **El Gatillo (Trigger CI/CD):** Cuando haces `git push origin main`, Vercel (conectado a tu repositorio de GitHub) arranca una "Build" nueva automáticamente.
* **Proceso Frontend:** Ejecuta `npm run build` construyendo Vite, y publica los estáticos a CDN globales.
* **Proceso Backend (Serverless):** La carpeta `/api/` en la raíz del proyecto es tratada mágicamente por Vercel. Cada archivo Javascript aquí dentro (ej. `api/get_handicap.js`) se transforma e instancia como un micro-servidor de Node.js independiente a demanda. No hay que encender ni pagar servidores; la ruta `/api/get_handicap` ejecuta el script, que a su vez scrapea la RFEG usando `pdf-parse`, devuelve JSON y se apaga instantáneamente.
* **Distribución SPA:** El archivo `vercel.json` existe en la raíz únicamente para aplicar la regla de enrutamiento SPA (React Router), forzando a que cualquier URL extraña redirija a `index.html` sin romper la app.

### 2. 🗄️ Base de Datos y Autenticación (Firebase)
Se acabaron los archivos `.json` colgados en el servidor público por FTP y el login en PHP. Todo el estado de la aplicación reside ahora en **Google Firebase**.

* **Authentication**: Los usuarios entran usando cuentas Firebase nativas (correo/contraseña). El esquema *Multi Mode* vincula automáticamente qué niño gestiona cada "manager" (padre).
* **Firestore Database (NoSQL)**: Torneos oficiales, historiales de hándicap recién parcheados en la migración, y las agendas privadas de resultados habitan en colecciones nativas bajo `users/{uid}/`. El Frontend escucha en vivo con `onSnapshot` logrando que los cambios hechos en el móvil aparezcan al segundo en cualquier otra pantalla.

### 3. 📸 Almacenamiento CND Estático (Cloudflare R2)
* Las imágenes de perfil de los usuarios no viven en el código. Son subidas vía API S3 estándar hacia infraestructuras Cloudflare (Bucket R2), dándonos enlaces CDN inmutables que Firebase almacena.

## 🔄 Flujo del Desarrollador (Developer Workflow)

El proceso para ti es drásticamente más fácil y seguro ahora. Ya no necesitas ni preocuparte por FTP, scripts locales tipo `deploy.sh` o el hosting `reinaldomoon.top`.

1. **Editar Código:** Escribes tu nueva mejora de UI o tu arreglo en las Serverless Functions.
2. **Commit y Push:** 
   ```bash
   git add .
   git commit -m "Descripción de tu nueva función"
   git push
   ```
3. **Observar la Magia:** 
   * A los 30 segundos, Vercel compila silenciosamente y lanza la versión pulida al dominio de producción. 
   * Si rompes algo dramático, Vercel te permite hacer "Rollback" con 1 clic a tu versión de hace 2 horas ininterrumpidamente.

## ⚠️ Herencia y Componentes Obsoletos 
Dado el salto generacional a este esquema puramente Cloud:
* La carpeta `public/api/*.php` y todo el stack de lenguaje PHP anterior debe tratarse como sistema pre-invernado/obsoleto, ya que Node/Vercel domina los fetchers RFEG. 
* Los scripts que utilizabas en tus repositorios antiguos basados en subidas FTP, FileZilla o GitHub Actions (robot de FTP), están ínfimamente desaconsejados ahora. **Vercel es el rey**.
