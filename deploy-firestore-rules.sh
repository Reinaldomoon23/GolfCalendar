#!/bin/bash

# Script para hacer deploy de Firestore Rules
# Ejecutar desde Terminal con: bash deploy-firestore-rules.sh

echo "🔥 Deploy de Reglas de Firestore"
echo "================================="
echo ""
echo "Proyecto: golfscorings-e4338"
echo "Usuario: misterpotatolightyear@gmail.com"
echo ""

# Verificar que Firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI no está instalado."
    echo "Instalando..."
    npm install -g firebase-tools
fi

echo "✅ Firebase CLI instalado"
echo ""

# Login a Firebase
echo "🔐 Iniciando sesión en Firebase..."
echo "Se abrirá tu navegador para autenticarte con misterpotatolightyear@gmail.com"
echo ""

firebase login

echo ""
echo "📋 Mostrando reglas que se van a deployar..."
echo "============================================"
head -30 firestore.rules
echo "... (mostrando primeras 30 líneas)"
echo ""

# Confirmar deploy
read -p "¿Quieres deployar estas reglas? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deployando reglas a Firebase..."
    firebase deploy --only firestore:rules --project golfscorings-e4338

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ ¡Reglas deployadas exitosamente!"
        echo ""
        echo "📊 Próximos pasos:"
        echo "1. Ve a Firebase Console y verifica las reglas"
        echo "2. Login como David (david@golfteam.app)"
        echo "3. Cambia a perfil de María"
        echo "4. Verifica que aparecen sus torneos y resultados"
        echo ""
    else
        echo ""
        echo "❌ Error al deployar reglas"
        echo "Verifica que tienes permisos en el proyecto golfscorings-e4338"
    fi
else
    echo "❌ Deploy cancelado"
fi
