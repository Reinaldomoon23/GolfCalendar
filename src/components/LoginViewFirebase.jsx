import { useState } from 'react';
import { User, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { auth, db } from '../firebase';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
import {
    ensureUserProfileDocument,
    fetchUserProfileByUid
} from '../utils/userProfiles';

export default function LoginViewFirebase({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [isRegister, setIsRegister] = useState(false);
    const [fullName, setFullName] = useState('');
    const [federationId, setFederationId] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Generar email a partir del username
            const email = `${username.toLowerCase()}@golfteam.app`;

            if (isRegister) {
                // REGISTRO: Crear usuario en Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Actualizar displayName
                await updateProfile(user, {
                    displayName: fullName
                });

                const normalizedUsername = username.toLowerCase();

                // Guardar datos adicionales en Firestore con ownership canonico por uid
                await ensureUserProfileDocument(db, {
                    uid: user.uid,
                    username: normalizedUsername,
                    email: email,
                    full_name: fullName,
                    federation_id: federationId || '',
                    photo_url: '',
                    handicap_url: '',
                    role: 'player',
                    managed_users: [],
                    created_at: new Date()
                }, normalizedUsername);

                // Cargar perfil y hacer login
                const userData = {
                    uid: user.uid,
                    username: normalizedUsername,
                    docId: user.uid,
                    full_name: fullName,
                    federation_id: federationId,
                    email: email
                };

                onLogin(userData);

            } else {
                // LOGIN: Autenticar con Firebase
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                const profile = await fetchUserProfileByUid(db, user.uid, user.email);
                const normalizedProfile = await ensureUserProfileDocument(db, {
                    ...profile,
                    uid: user.uid,
                    username: profile?.username || username.toLowerCase(),
                    email: profile?.email || user.email || email
                }, username.toLowerCase());

                if (!normalizedProfile) {
                    throw new Error('Perfil de usuario no encontrado');
                }

                const userData = {
                    uid: user.uid,
                    ...normalizedProfile
                };

                onLogin(userData);
            }

        } catch (err) {
            console.error('Error de autenticación:', err);

            // Mensajes de error amigables
            let errorMessage = 'Error en la operación';

            if (err.code === 'auth/email-already-in-use') {
                errorMessage = 'Este usuario ya existe';
            } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                errorMessage = 'Usuario o contraseña incorrectos';
            } else if (err.code === 'auth/user-not-found') {
                errorMessage = 'Usuario no encontrado';
            } else if (err.code === 'auth/weak-password') {
                errorMessage = 'La contraseña debe tener al menos 6 caracteres';
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = 'Usuario inválido';
            } else if (err.message) {
                errorMessage = err.message;
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            padding: '1rem'
        }}>
            <div className="card fade-in" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'var(--color-primary-dark)',
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem',
                        color: 'white'
                    }}>
                        {isRegister ? <User size={32} /> : <Lock size={32} />}
                    </div>
                    <h2>{isRegister ? 'Crear Cuenta' : 'Bienvenido'}</h2>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                        {isRegister ? 'Regístrate para gestionar tus torneos' : 'Inicia sesión para continuar'}
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'var(--color-conflict-bg)',
                        color: 'var(--color-conflict)',
                        padding: '1rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {isRegister && (
                        <>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Nombre Completo</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--color-text-muted)' }} />
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Ej: Juan Pérez"
                                        style={{
                                            width: '100%',
                                            padding: '12px 12px 12px 42px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid #ccc',
                                            fontSize: '1rem',
                                            boxSizing: 'border-box'
                                        }}
                                        required={isRegister}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Nº Licencia (Federado)</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--color-text-muted)' }} />
                                    <input
                                        type="text"
                                        value={federationId}
                                        onChange={(e) => setFederationId(e.target.value)}
                                        placeholder="Ej: AD06996143"
                                        style={{
                                            width: '100%',
                                            padding: '12px 12px 12px 42px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid #ccc',
                                            fontSize: '1rem',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Usuario</label>
                        <div style={{ position: 'relative' }}>
                            <User size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--color-text-muted)' }} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Nombre de usuario"
                                style={{
                                    width: '100%',
                                    padding: '12px 12px 12px 42px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid #ccc',
                                    fontSize: '1rem',
                                    boxSizing: 'border-box'
                                }}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--color-text-muted)' }} />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    padding: '12px 42px 12px 42px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid #ccc',
                                    fontSize: '1rem',
                                    boxSizing: 'border-box'
                                }}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '12px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--color-text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 0
                                }}
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ marginTop: '1rem', width: '100%' }}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <span>{isRegister ? 'Registrarse' : 'Ingresar'}</span>
                                <ArrowRight size={20} />
                            </div>
                        )}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <button
                        onClick={() => { setIsRegister(!isRegister); setError(''); }}
                        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}
                    >
                        {isRegister ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate'}
                    </button>
                </div>
            </div>
        </div>
    );
}
