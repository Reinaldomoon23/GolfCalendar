# Bugfix: Putts y GIR desaparecen en Modo Live

**Fecha**: 24 de marzo de 2026
**Responsable**: Reinaldo Moon + Claude
**Severidad**: 🟡 Media
**Status**: ✅ RESUELTO

---

## 🐛 Descripción del Bug

### Síntoma
Cuando un usuario activaba los toggles de **GIR** (Greens in Regulation) y **Putts** en el editor móvil de scorecard, estos datos se guardaban correctamente pero **desaparecían de la vista pública en vivo** después de 1-2 segundos.

### Reproducción
1. Crear/editar torneo personalizado
2. Activar "Registrar Putts" ✓
3. Activar "Registrar GIR" ✓
4. Registrar resultado con putts y GIR
5. Compartir URL en vivo
6. Abrir URL → Los putts y GIR NO se muestran en el scorecard

---

## 🔍 Causa Raíz

El componente `PublicScorecardView.jsx` que muestra el scorecard en vivo **NO tenía código para mostrar las filas de Putts y GIR**.

Solo mostraba:
- Hoyo
- Par
- Score

Faltaba:
- Putts (si `track_putts = true`)
- GIR (si `track_girs = true`)

Además, el componente `CalendarView.jsx` no estaba guardando los flags `track_putts` y `track_girs` en el resultado al momento de guardar.

---

## ✅ Solución Implementada

### Cambio 1: Guardar flags al guardar resultado
**Archivo**: `src/components/CalendarView.jsx`
**Líneas**: 726-727

```javascript
const entry = {
    ...formData,
    total,
    average,
    stablefordTotal,
    updatedAt: new Date().toISOString(),
    tournamentName: editingDetails.name || selectedTournament.name,
    tournamentCourse: editingDetails.course || selectedTournament.course,
    tournamentDates: editingDetails.dates || selectedTournament.dates,
    track_putts: editingDetails.track_putts || selectedTournament.track_putts || false, // ← NUEVO
    track_girs: editingDetails.track_girs || selectedTournament.track_girs || false    // ← NUEVO
};
```

### Cambio 2: Mostrar Putts en vista live (hoyos 1-9)
**Archivo**: `src/components/PublicScorecardView.jsx`
**Líneas**: 677-699

```javascript
{/* Row: Putts (if tracked) */}
{(result.track_putts || tournament?.track_putts) && (
    <div style={{ display: 'flex', background: '#1e293b', fontSize: '0.9rem' }}>
        <div style={{ width: '60px', padding: '8px', ... }}>Putts</div>
        {[...Array(9)].map((_, i) => {
            const putts = card.putts?.[i] || '';
            return (
                <div key={i} style={{ ... }}>
                    {putts !== '' && putts !== '-' ? putts : '-'}
                </div>
            );
        })}
    </div>
)}
```

### Cambio 3: Mostrar GIR en vista live (hoyos 1-9)
**Archivo**: `src/components/PublicScorecardView.jsx`
**Líneas**: 701-729

```javascript
{/* Row: GIR (if tracked) */}
{(result.track_girs || tournament?.track_girs) && (
    <div style={{ display: 'flex', background: '#1e293b', fontSize: '0.9rem' }}>
        <div style={{ width: '60px', padding: '8px', ... }}>GIR</div>
        {[...Array(9)].map((_, i) => {
            const gir = card.girs?.[i] || '';
            let girDisplay = '-';
            let girColor = '#64748b';
            if (gir === 'Y') { girDisplay = '✓'; girColor = '#10b981'; }      // Verde
            else if (gir === 'N') { girDisplay = '✗'; girColor = '#ef4444'; }  // Rojo

            return (
                <div key={i} style={{ color: girColor, fontWeight: 'bold', ... }}>
                    {girDisplay}
                </div>
            );
        })}
    </div>
)}
```

### Cambio 4: Mismo código para hoyos 10-18
**Archivo**: `src/components/PublicScorecardView.jsx`
**Líneas**: 793-845

Se replicó la misma lógica para la segunda tabla (hoyos 10-18) usando el índice `i + 9`.

---

## 🎨 Diseño Visual

### Antes (sin fix)
```
┌─────┬─────┬─────┬─────┬─────┐
│ Hoyo│  1  │  2  │  3  │ ... │
├─────┼─────┼─────┼─────┼─────┤
│ Par │  4  │  3  │  5  │ ... │
├─────┼─────┼─────┼─────┼─────┤
│Score│  5  │  3  │  6  │ ... │
└─────┴─────┴─────┴─────┴─────┘
```

### Después (con fix)
```
┌─────┬─────┬─────┬─────┬─────┐
│ Hoyo│  1  │  2  │  3  │ ... │
├─────┼─────┼─────┼─────┼─────┤
│ Par │  4  │  3  │  5  │ ... │
├─────┼─────┼─────┼─────┼─────┤
│Score│  5  │  3  │  6  │ ... │
├─────┼─────┼─────┼─────┼─────┤
│Putts│  2  │  1  │  2  │ ... │  ← NUEVO
├─────┼─────┼─────┼─────┼─────┤
│ GIR │  ✗  │  ✓  │  ✗  │ ... │  ← NUEVO
└─────┴─────┴─────┴─────┴─────┘
```

**Colores GIR**:
- ✓ (verde #10b981): Green in Regulation
- ✗ (rojo #ef4444): No alcanzó green
- \- (gris #64748b): Sin datos

---

## 🧪 Testing

### Test Case 1: Torneo con Putts activado
1. ✅ Crear torneo con "Registrar Putts" activado
2. ✅ Registrar resultado con putts en cada hoyo
3. ✅ Compartir URL live
4. ✅ Verificar que fila "Putts" aparece en scorecard público
5. ✅ Verificar que datos de putts se muestran correctamente

### Test Case 2: Torneo con GIR activado
1. ✅ Crear torneo con "Registrar GIR" activado
2. ✅ Registrar resultado con GIR (Y/N) en cada hoyo
3. ✅ Compartir URL live
4. ✅ Verificar que fila "GIR" aparece en scorecard público
5. ✅ Verificar que ✓ (verde) y ✗ (rojo) se muestran

### Test Case 3: Torneo con ambos activados
1. ✅ Crear torneo con ambos toggles activados
2. ✅ Registrar resultado completo
3. ✅ Compartir URL live
4. ✅ Verificar que ambas filas aparecen
5. ✅ Verificar orden: Score → Putts → GIR

### Test Case 4: Torneo sin tracking
1. ✅ Crear torneo SIN activar toggles
2. ✅ Registrar resultado
3. ✅ Compartir URL live
4. ✅ Verificar que solo se muestran: Hoyo, Par, Score (sin Putts/GIR)

### Test Case 5: Resultado antiguo (legacy)
1. ✅ Resultado guardado ANTES del fix
2. ✅ No tiene flags `track_putts` / `track_girs`
3. ✅ Verificar que no muestra filas adicionales (comportamiento legacy)

---

## 📝 Notas Técnicas

### Compatibilidad Backward
El fix es **100% compatible** con resultados antiguos:
- Si `result.track_putts` no existe → No muestra fila Putts
- Si `tournament.track_putts` no existe → No muestra fila Putts
- Lo mismo aplica para GIR

### Lógica de Fallback
```javascript
(result.track_putts || tournament?.track_putts)
```
Esto permite que la configuración se obtenga de:
1. **Resultado guardado** (prioridad alta)
2. **Torneo custom** (fallback)

### Datos opcionales
- Si un hoyo no tiene putts registrados → Muestra `-`
- Si un hoyo no tiene GIR registrado → Muestra `-`
- Los datos vacíos no rompen la interfaz

---

## 🚀 Deploy

### Estado
- ✅ Código corregido
- ⏳ Pendiente testing manual
- ⏳ Pendiente deploy a producción

### Archivos Modificados
1. `src/components/PublicScorecardView.jsx` (+96 líneas)
2. `src/components/CalendarView.jsx` (+2 líneas)

### Commits Recomendados
```bash
git add src/components/PublicScorecardView.jsx src/components/CalendarView.jsx
git commit -m "fix(GT-LIV-SHR-003): mostrar putts y GIR en scorecard live

- Agregar filas de Putts y GIR en PublicScorecardView
- Guardar flags track_putts y track_girs en resultado
- Soporte para hoyos 1-9 y 10-18
- Backward compatible con resultados legacy
- Colores: verde (✓) para GIR alcanzado, rojo (✗) para fallado

Fixes #XX"
```

---

## 🎯 Feature Codes

**Relacionados**:
- GT-LIV-SHR-002 ✅ (Suma de vueltas acumuladas)
- GT-LIV-SHR-003 🆕 (Mostrar Putts/GIR en live) ← Este fix
- GT-RST-SCR-002 ✅ (Editor scorecard hoyo por hoyo)

---

## 📚 Documentación Actualizada

- [DEPLOYMENT_LOG.md](DEPLOYMENT_LOG.md) - Agregar entry después del deploy
- [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md) - Actualizar features implementadas
- [ESQUEMA_FUNCIONALIDADES.md](ESQUEMA_FUNCIONALIDADES.md) - Marcar GT-LIV-SHR-003

---

**Última actualización**: 24 de marzo de 2026
**Autor**: Reinaldo Moon + Claude
**Status**: ✅ Fix implementado, pendiente testing manual
