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
    courseName = 'Campo de Golf'
}) => {
    const [activeField, setActiveField] = useState('strokes');
    const [isFirstKey, setIsFirstKey] = useState(true);

    // Reset active field and key state when hole changes
    useEffect(() => {
        setActiveField('strokes');
        setIsFirstKey(true);
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
        else if (scoreDiff === -1) { scoreLabel = 'Birdie (-1)'; scoreColor = '#3b82f6'; } // changed to blue for visibility in dark mode
        else if (scoreDiff === 0) { scoreLabel = 'Par (E)'; scoreColor = '#10b981'; } // Emerald for Par
        else if (scoreDiff === 1) { scoreLabel = 'Bogey (+1)'; scoreColor = '#f97316'; }
        else if (scoreDiff === 2) { scoreLabel = 'Doble Bogey (+2)'; scoreColor = '#ef4444'; } // Red
        else { scoreLabel = `+${scoreDiff}`; scoreColor = '#b91c1c'; } // Dark Red
    } else if (strokes === '-') {
        scoreLabel = 'Raya / NR';
        scoreColor = '#64748b'; // Slate 500
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
            backgroundColor: '#0f172a', // slate-900 absolute dark theme
            display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out',
            color: 'white',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            {/* Header */}
            <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={onClose} style={{ color: '#94a3b8', background: 'transparent', border: 'none', padding: '0.25rem', cursor: 'pointer' }}>
                    <X size={24} />
                </button>
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {courseName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, letterSpacing: '0.05em', color: 'white' }}>HOYO {holeIdx + 1}</h2>
                        <span style={{ margin: 0, color: '#10b981', fontSize: '1.2rem', fontWeight: '900' }}>PAR {par}</span>
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
                backgroundColor: '#1e293b', // slate-800
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
