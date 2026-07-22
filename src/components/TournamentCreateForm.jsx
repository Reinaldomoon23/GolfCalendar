import { Save, X } from 'lucide-react';

export default function TournamentCreateForm({
    tournament,
    allCourses,
    onChange,
    onClose,
    onSubmit,
}) {
    const updateField = (field, value) => {
        onChange((current) => ({ ...current, [field]: value }));
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000,
            paddingTop: '5rem', overflowY: 'auto'
        }}>
            <div className="card fade-in" style={{ width: '90%', maxWidth: '500px', padding: '2rem', maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem' }}>Nuevo Torneo</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                        type="text" placeholder="Nombre del Torneo"
                        value={tournament.name}
                        onChange={event => updateField('name', event.target.value)}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                    />
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: '#666' }}>Fecha Inicio</label>
                            <input
                                type="date"
                                value={tournament.startDate}
                                onChange={event => updateField('startDate', event.target.value)}
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '18px' }}>
                            <input
                                type="checkbox"
                                id="isMultiDay"
                                checked={tournament.isMultiDay}
                                onChange={event => updateField('isMultiDay', event.target.checked)}
                            />
                            <label htmlFor="isMultiDay" style={{ fontSize: '0.9rem' }}>Multidía</label>
                        </div>
                    </div>

                    {tournament.isMultiDay && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', color: '#666' }}>Duración (días)</label>
                            <input
                                type="number"
                                min="2"
                                value={tournament.duration}
                                onChange={event => updateField('duration', event.target.value)}
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc', width: '100%' }}
                            />
                        </div>
                    )}
                    <input
                        list="spanish-courses"
                        type="text" placeholder="Campo de Golf"
                        value={tournament.course}
                        onChange={event => updateField('course', event.target.value)}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                    />
                    <datalist id="spanish-courses">
                        {allCourses.map((course, index) => (
                            <option key={index} value={course} />
                        ))}
                    </datalist>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                                type="checkbox"
                                id="isGrandPrix"
                                checked={tournament.grand_prix}
                                onChange={event => updateField('grand_prix', event.target.checked)}
                            />
                            <label htmlFor="isGrandPrix" style={{ fontSize: '0.9rem' }}>Grand Prix</label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                                type="checkbox"
                                id="isValedera"
                                checked={tournament.valedera}
                                onChange={event => updateField('valedera', event.target.checked)}
                            />
                            <label htmlFor="isValedera" style={{ fontSize: '0.9rem' }}>Valedera</label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <input
                                type="checkbox"
                                id="isSACE"
                                checked={tournament.sace}
                                onChange={event => updateField('sace', event.target.checked)}
                            />
                            <label htmlFor="isSACE" style={{ fontSize: '0.9rem' }}>SACE</label>
                        </div>
                    </div>

                    <div style={{
                        padding: '12px',
                        background: 'rgba(37, 99, 235, 0.05)',
                        borderRadius: '8px',
                        border: '1px dashed rgba(37, 99, 235, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <input
                            type="checkbox"
                            id="publishToCommunity"
                            checked={tournament.publishToCommunity}
                            onChange={event => updateField('publishToCommunity', event.target.checked)}
                        />
                        <div>
                            <label htmlFor="publishToCommunity" style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#2563eb', display: 'block' }}>
                                🌍 Publicar en la comunidad
                            </label>
                            <span style={{ fontSize: '0.75rem', color: '#666' }}>
                                Permite que otros usuarios vean y añadan este torneo a su calendario.
                            </span>
                        </div>
                    </div>

                    <select
                        value={tournament.organizer}
                        onChange={event => updateField('organizer', event.target.value)}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                    >
                        <option value="CLUB">CLUB</option>
                        <option value="RFEG">RFEG</option>
                        <option value="FCG">FCG</option>
                        <option value="CAMIRAL">CAMIRAL</option>
                        <option value="LEGACY">LEGACY</option>
                        <option value="JUNIOR BABY CUP">JUNIOR BABY CUP</option>
                        <option value="Circuito Amateur">Circuito Amateur</option>
                    </select>

                    <button className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '1rem' }} onClick={onSubmit}>
                        <Save size={18} style={{ marginRight: '8px' }} /> Guardar Torneo
                    </button>
                </div>
            </div>
        </div>
    );
}
