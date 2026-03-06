
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const accessKeyId = "453a6e48294058bb766317b31c742af8";
const secretAccessKey = "c4bc610a94cd5c1c18db535a1610f83df61a93836feea811999a6c4fa171ac7b";
const endpoint = "https://1e8f9eaa8024f1354556923930ad0acb.r2.cloudflarestorage.com";
const bucketName = "golf-profiles-bucket";
const publicUrl = "https://pub-23c281cf1ae04def9102341cf7d87837.r2.dev";

const s3 = new S3Client({
    region: "auto",
    endpoint: endpoint,
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
    },
});

async function uploadFile(remoteUrl, fileName) {
    try {
        console.log(`📡 Descargando ${fileName} de ${remoteUrl}...`);
        const response = await axios.get(remoteUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        console.log(`📤 Subiendo ${fileName} a R2...`);
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: buffer,
            ContentType: response.headers['content-type'] || 'image/jpeg'
        });

        await s3.send(command);
        console.log(`✅ ${fileName} subida con éxito.`);
        return `${publicUrl}/${fileName}`;
    } catch (err) {
        console.error(`❌ Error con ${fileName}:`, err.message);
        return null;
    }
}

async function migratePhotos() {
    console.log("🚀 Iniciando migración de fotos a Cloudflare R2...");
    const serverBase = "https://reinaldomoon.top/GolfTeam/";

    // Lista de fotos a migrar basada en el backup de ayer
    const photos = [
        "profiles/txell.jpg",
        "profiles/ona.jpg",
        "profiles/valentina.jpg",
        "profiles/maria_1770065115.jpg",
        "profiles/sofia.jpg",
        "profiles/david.jpg",
        "profiles/jordi_1771452180.jpg",
        "profiles/jordi_1771451695.jpg",
        "profiles/adriana_1771193668.jpg",
        "profiles/nicole_1771876926.jpg",
        "profiles/nicole_1770126902.jpg",
        "profiles/nicole.jpg",
        "profile.jpg"
    ];

    for (const photoPath of photos) {
        const fullUrl = `${serverBase}${photoPath}`;
        const fileName = path.basename(photoPath);
        await uploadFile(fullUrl, fileName);
    }

    console.log("🎉 Migración de fotos finalizada.");
}

migratePhotos();
