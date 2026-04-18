import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Save, Delete } from 'lucide-react';

const MobileScorecardEditor = ({
    card,
    holeIdx,
    onUpdate,
    onClose,
    onNext,
    onPrev,
    onSave,
    config, // { track_putts, track_girs }
    par,
    courseName = 'Campo de Golf',
    onJumpToHole,
    allScorecards = {}, // all rounds scorecards for cumulative score
    targetScore = null  // new prop for Objective relative to par
}) => {
    const [activeField, setActiveField] = useState('strokes');

    // Calculate cumulative tournament score
    let cumulativeScore = 0;
    let cumulativePar = 0;
    let totalHolesPlayed = 0;

    Object.keys(allScorecards).forEach(rIdx => {
        const sc = allScorecards[rIdx];
        if (!sc || !sc.strokes || !sc.pars) return;
        for (let i = 0; i < 18; i++) {
            const strokeStr = String(sc.strokes[i] || '');
            if (strokeStr !== '' && strokeStr !== '-') {
                const s = parseInt(strokeStr);
                if (!isNaN(s) && s > 0) {
                    cumulativeScore += s;
                    const p = parseInt(sc.pars[i]);
                    cumulativePar += (!isNaN(p) && p > 0 ? p : 4);
                    totalHolesPlayed++;
                }
            }
        }
    });

    const isCumulativeValid = totalHolesPlayed > 0;
    const cumulativeDiff = cumulativeScore - cumulativePar;
    const cumulativeDiffStr = cumulativeDiff > 0 ? `+${cumulativeDiff}` : cumulativeDiff < 0 ? `${cumulativeDiff}` : 'E';
    const cumulativeDiffColor = cumulativeDiff > 0 ? '#ef4444' : cumulativeDiff < 0 ? '#10b981' : '#f8fafc';

    // Target diff logic
    let targetDiffRender = null;
    if (targetScore !== null && targetScore !== undefined) {
        const tDiff = cumulativeDiff - targetScore;
        const tDiffStr = tDiff > 0 ? `+${tDiff}` : tDiff < 0 ? `${tDiff}` : 'E';
        const tDiffColor = tDiff > 0 ? '#ef4444' : tDiff < 0 ? '#10b981' : '#94a3b8';
        targetDiffRender = (
            <span style={{ marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Obj {targetScore > 0 ? `+${targetScore}` : targetScore}: </span>
                <span style={{ color: tDiffColor, fontSize: '0.85rem' }}>{tDiffStr}</span>
            </span>
        );
    }
    const [isFirstKey, setIsFirstKey] = useState(true);
    const [showHoleSelector, setShowHoleSelector] = useState(false);

    // Reset active field and key state when hole changes
    useEffect(() => {
        setActiveField('strokes');
        setIsFirstKey(true);
        setShowHoleSelector(false);
    }, [holeIdx]);

    // Reset key state if user explicitly switches fields (like from strokes to putts)
    useEffect(() => {
        setIsFirstKey(true);
    }, [activeField]);

    if (!card) return null;

    const strokes = (card.strokes || [])[holeIdx] || '';
    const putts = (card.putts || [])[holeIdx] || '';
    const gir = (card.girs || [])[holeIdx] || '';

    const getNum = (val) => (val === '' || val === '-') ? 0 : parseInt(val);

    const handleNumpad = (num) => {
        const currentStr = String(activeField === 'strokes' ? strokes : putts);
        let val;

        if (isFirstKey || currentStr === '-') {
            val = num.toString();
            setIsFirstKey(false);
        } else {
            if (currentStr === '' || currentStr === '0') {
                val = num.toString();
            } else {
                val = currentStr + num.toString();
                if (val !== '-' && parseInt(val) > 99) val = currentStr;
            }
        }

        const finalVal = val === '-' ? '-' : parseInt(val);
        onUpdate(holeIdx, activeField, finalVal);
    };

    const handleDelete = () => {
        const currentStr = String(activeField === 'strokes' ? strokes : putts);
        if (currentStr.length <= 1 || currentStr === '-') {
            onUpdate(holeIdx, activeField, '');
        } else {
            onUpdate(holeIdx, activeField, parseInt(currentStr.slice(0, -1)));
        }
    };

    const handleGir = (val) => {
        onUpdate(holeIdx, 'girs', val === gir ? '' : val);
    };

    const scoreDiff = getNum(strokes) - par;
    let scoreLabel = 'Añadir Score';
    let scoreColor = '#94a3b8'; // Slate 400

    if (strokes !== '' && strokes !== '-') {
        const s = getNum(strokes);
        if (s === 1) { scoreLabel = 'HOYO EN UNO 🎯'; scoreColor = '#f59e0b'; }
        else if (scoreDiff <= -3) { scoreLabel = 'Albatros (-3)'; scoreColor = '#ec4899'; }
        else if (scoreDiff === -2) { scoreLabel = 'Eagle (-2)'; scoreColor = '#d946ef'; }
        else if (scoreDiff === -1) { scoreLabel = 'Birdie (-1)'; scoreColor = '#3b82f6'; }
        else if (scoreDiff === 0) { scoreLabel = 'Par (E)'; scoreColor = '#10b981'; }
        else if (scoreDiff === 1) { scoreLabel = 'Bogey (+1)'; scoreColor = '#f97316'; }
        else if (scoreDiff === 2) { scoreLabel = 'Doble Bogey (+2)'; scoreColor = '#ef4444'; }
        else { scoreLabel = `+${scoreDiff}`; scoreColor = '#b91c1c'; }
    } else if (strokes === '-') {
        scoreLabel = 'Raya / NR';
        scoreColor = '#64748b';
    }

    const valStr = activeField === 'strokes' ? String(strokes || '-') :
        activeField === 'putts' ? String(putts !== '' ? putts : '-') :
            String(gir || '-');
    const isMultiDigit = valStr.length > 1 && valStr !== '-';

    const renderNumpad = () => {
        if (activeField === 'girs') {
            return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', flex: 1 }}>
                    {['G', '+1', '+2', '+'].map((val) => {
                        const isActive = gir === val;
                        return (
                            <button
                                key={val}
                                onClick={() => handleGir(val)}
                                style={{
                                    padding: '1rem', borderRadius: '16px', fontWeight: '800', fontSize: '1.5rem',
                                    border: 'none', backgroundColor: isActive ? '#10b981' : '#334155',
                                    color: isActive ? 'white' : '#e2e8f0', transition: 'all 0.15s ease',
                                    boxShadow: isActive ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                {val}
                            </button>
                        );
                    })}
                </div>
            );
        }

        const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, '-', 0, 'del'];
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {keys.map((k, i) => {
                    if (k === 'del') {
                        return (
                            <button key={i} onClick={handleDelete}
                                style={{
                                    padding: '0.8rem', borderRadius: '16px', backgroundColor: '#334155',
                                    color: '#cbd5e1', border: 'none', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}>
                                <Delete size={26} />
                            </button>
                        );
                    }
                    return (
                        <button key={i} onClick={() => handleNumpad(k)}
                            style={{
                                padding: '0.8rem', borderRadius: '16px', backgroundColor: '#334155',
                                color: 'white', fontSize: '1.75rem', fontWeight: '700', border: 'none',
                                fontFamily: 'system-ui, -apple-system, sans-serif', cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)', transition: 'background-color 0.1s'
                            }}>
                            {k}
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: '#0f172a',
            display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out',
            color: 'white',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* Hole Selector Overlay */}
            {showHoleSelector && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 10000,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '2rem', animation: 'fadeIn 0.2s ease',
                    backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: '800', color: '#94a3b8' }}>SELECCIONAR HOYO</h3>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.6rem',
                        maxWidth: '400px', width: '100%'
                    }}>
                        {Array.from({ length: 18 }).map((_, i) => {
                            const isCurrent = i === holeIdx;
                            const hStrokes = (card.strokes || [])[i];
                            const hasScore = hStrokes !== '' && hStrokes !== undefined && hStrokes !== null;

                            return (
                                <button
                                    key={i}
                                    onClick={() => {
                                        if (onJumpToHole) onJumpToHole(i);
                                        setShowHoleSelector(false);
                                    }}
                                    style={{
                                        aspectRatio: '1', borderRadius: '12px', border: 'none',
                                        backgroundColor: isCurrent ? '#3b82f6' : (hasScore ? '#1e293b' : '#334155'),
                                        color: isCurrent ? 'white' : (hasScore ? '#e2e8f0' : '#94a3b8'),
                                        fontWeight: '800', fontSize: '1.1rem', cursor: 'pointer',
                                        position: 'relative',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    {i + 1}
                                    {hasScore && !isCurrent && (
                                        <div style={{
                                            position: 'absolute', bottom: '2px', width: '4px', height: '4px',
                                            borderRadius: '50%', backgroundColor: '#3b82f6'
                                        }} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => setShowHoleSelector(false)}
                        style={{
                            marginTop: '2.5rem', padding: '0.75rem 2rem', borderRadius: '12px',
                            backgroundColor: '#334155', color: 'white', border: 'none',
                            fontWeight: '700', cursor: 'pointer'
                        }}
                    >
                        CANCELAR
                    </button>
                </div>
            )}

            {/* Header */}
            <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={onClose} style={{ color: '#94a3b8', background: 'transparent', border: 'none', padding: '0.25rem', cursor: 'pointer' }}>
                    <X size={24} />
                </button>
                <div
                    onClick={() => setShowHoleSelector(true)}
                    style={{
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        cursor: 'pointer',
                        background: 'rgba(59, 130, 246, 0.1)',
                        padding: '0.4rem 1.2rem',
                        borderRadius: '16px',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        minWidth: '160px',
                        position: 'relative'
                    }}
                >
                    <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1px' }}>
                        Toca para cambiar hoyo
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: '900', margin: 0, letterSpacing: '0.02em', color: 'white' }}>HOYO {holeIdx + 1}</h2>
                        <span style={{ margin: 0, color: '#10b981', fontSize: '1.4rem', fontWeight: '900' }}>PAR {par}</span>
                    </div>

                    {isCumulativeValid && (
                        <div style={{ marginTop: '4px', fontSize: '1rem', fontWeight: 'bold' }}>
                            <span style={{ color: '#94a3b8' }}>Torneo: </span>
                            <span style={{ color: cumulativeDiffColor }}>{cumulativeDiffStr}</span>
                            {targetDiffRender}
                        </div>
                    )}

                    <div style={{ marginTop: '4px', fontSize: '0.65rem', color: '#64748b', fontWeight: '600', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {courseName}
                    </div>
                </div>
                <div style={{ width: '24px' }} />
            </div>

            {/* Field Selector / Mini Dashboard */}
            <div style={{ padding: '0 1.5rem', display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button
                    onClick={() => setActiveField('strokes')}
                    style={{
                        flex: 1, padding: '0.5rem', borderRadius: '16px', border: 'none',
                        backgroundColor: activeField === 'strokes' ? '#3b82f6' : '#1e293b',
                        color: activeField === 'strokes' ? 'white' : '#94a3b8', fontWeight: '700',
                        cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                >
                    <span style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>GOLPES</span><br />
                    <span style={{ fontSize: '1.25rem', color: activeField === 'strokes' ? 'white' : '#e2e8f0' }}>{strokes || '-'}</span>
                </button>
                {config.track_putts && (
                    <button
                        onClick={() => setActiveField('putts')}
                        style={{
                            flex: 1, padding: '0.5rem', borderRadius: '16px', border: 'none',
                            backgroundColor: activeField === 'putts' ? '#8b5cf6' : '#1e293b',
                            color: activeField === 'putts' ? 'white' : '#94a3b8', fontWeight: '700',
                            cursor: 'pointer', transition: 'all 0.2s ease'
                        }}
                    >
                        <span style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>PUTTS</span><br />
                        <span style={{ fontSize: '1.25rem', color: activeField === 'putts' ? 'white' : '#e2e8f0' }}>{putts !== '' ? putts : '-'}</span>
                    </button>
                )}
                {config.track_girs && (
                    <button
                        onClick={() => setActiveField('girs')}
                        style={{
                            flex: 1, padding: '0.5rem', borderRadius: '16px', border: 'none',
                            backgroundColor: activeField === 'girs' ? '#10b981' : '#1e293b',
                            color: activeField === 'girs' ? 'white' : '#94a3b8', fontWeight: '700',
                            cursor: 'pointer', transition: 'all 0.2s ease'
                        }}
                    >
                        <span style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>GIR</span><br />
                        <span style={{ fontSize: '1.25rem', color: activeField === 'girs' ? 'white' : '#e2e8f0' }}>{gir || '-'}</span>
                    </button>
                )}
            </div>
            {/* Main Value Display */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
                <div style={{
                    fontSize: activeField === 'girs' ? '5rem' : (isMultiDigit ? '5rem' : '6rem'),
                    fontWeight: '900', lineHeight: 1,
                    textShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    color: 'white',
                    fontVariantNumeric: 'tabular-nums'
                }}>
                    {activeField === 'strokes' ? (strokes || '-') :
                        activeField === 'putts' ? (putts !== '' ? putts : '-') :
                            (gir || '-')}
                </div>
                {activeField === 'strokes' && (
                    <div style={{
                        marginTop: '0.5rem', padding: '0.4rem 1rem', borderRadius: '999px',
                        backgroundColor: `${scoreColor}20`, color: scoreColor,
                        fontWeight: '800', fontSize: '0.9rem', letterSpacing: '0.02em',
                        border: `1px solid ${scoreColor}40`
                    }}>
                        {scoreLabel.toUpperCase()}
                    </div>
                )}
            </div>

            {/* Keyboard Grid & Navigation inside premium dock container */}
            <div style={{
                backgroundColor: '#1e293b',
                padding: '1rem',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                display: 'flex', flexDirection: 'column', gap: '0.75rem',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.5)'
            }}>
                {renderNumpad()}

                {/* Bottom Navigation */}
                <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}>
                    <button
                        onClick={onPrev}
                        disabled={holeIdx === 0}
                        style={{
                            flex: 1, padding: '0.75rem', borderRadius: '16px', fontWeight: '800', fontSize: '0.9rem',
                            backgroundColor: '#0f172a', color: holeIdx === 0 ? '#334155' : 'white',
                            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
                            cursor: holeIdx === 0 ? 'default' : 'pointer'
                        }}
                    >
                        <ChevronLeft size={18} />
                        ANT
                    </button>

                    {onSave && (
                        <button
                            onClick={onSave}
                            style={{
                                padding: '0.75rem 1.25rem', borderRadius: '16px', fontWeight: '800',
                                backgroundColor: '#f59e0b', color: 'white', border: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)', cursor: 'pointer'
                            }}
                        >
                            <Save size={18} />
                        </button>
                    )}

                    <button
                        onClick={holeIdx === 17 ? onClose : onNext}
                        style={{
                            flex: 2, padding: '0.75rem', borderRadius: '16px', fontWeight: '800', fontSize: '0.95rem',
                            backgroundColor: holeIdx === 17 ? '#0f172a' : '#10b981', color: 'white',
                            border: holeIdx === 17 ? '2px solid #cbd5e1' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
                            boxShadow: holeIdx === 17 ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)', cursor: 'pointer'
                        }}
                    >
                        {holeIdx === 17 ? 'FINALIZAR' : 'SIGUIENTE'}
                        {holeIdx !== 17 && <ChevronRight size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileScorecardEditor;
