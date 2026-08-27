/**
 * ProfileContext - Profile Management
 *
 * Provides:
 * - Photo upload and versioning
 * - Profile editing (name, email, federation ID)
 * - Profile modal state
 * - Profile recovery and hard reset
 * - Real-time profile synchronization
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthContext } from './AuthContext';
import { getUserDocId, getUserProfileRef, fetchUserProfileByUsername } from '../utils/userProfiles';
import { invalidateProfilePhotoCache, uploadProfilePhoto, updateUserProfile, recoverLegacyProfile } from '../services/profile.service';
import { writeSavedUser } from '../utils/cache';
import { IS_MULTI } from '../config/app';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const { user, setUser, setLinkedUsers } = useAuthContext();
  const activeUserDocId = getUserDocId(user);

  // ── Photo state ──────────────────────────────────────────────────────────
  const [photoVersion, setPhotoVersion] = useState(Date.now());
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // ── Profile modal state ──────────────────────────────────────────────────
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editFederationId, setEditFederationId] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const notify = (message, type = 'info') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3600);
  };

  const askConfirm = (dialog) => new Promise((resolve) => {
    setConfirmDialog({ ...dialog, resolve });
  });

  // ── Photo upload handler ─────────────────────────────────────────────────
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const newPhotoUrl = await uploadProfilePhoto(file, user);
      const updatedUser = { ...user, photo_url: newPhotoUrl };
      setUser(updatedUser);
      writeSavedUser(updatedUser);
      setPhotoVersion(Date.now());
      notify('Foto actualizada en Cloudflare R2.', 'success');
    } catch (err) {
      console.error('R2 Upload error:', err);
      notify(`Error al subir a Cloudflare R2: ${err.message || 'Error desconocido'}`, 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // ── Profile modal handlers ───────────────────────────────────────────────
  const openProfileModal = () => {
    setEditFullName(user.full_name || '');
    setEditFederationId(user.federation_id || '');
    setEditEmail(user.email || '');
    setIsProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  const handleUpdateProfile = async (e) => {
    if (e) e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const updatedUser = await updateUserProfile(user, {
        fullName: editFullName,
        federationId: editFederationId,
        email: editEmail,
      });
      setUser(updatedUser);
      if (IS_MULTI) writeSavedUser(updatedUser);
      setIsProfileModalOpen(false);
      notify('Perfil actualizado correctamente.', 'success');
    } catch (err) {
      console.error(err);
      notify('Error al actualizar perfil.', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleRecoverProfile = async () => {
    if (!user?.username) return;
    setIsUpdatingProfile(true);
    try {
      const updated = await recoverLegacyProfile(user);
      setUser(updated);
      writeSavedUser(updated);
      setPhotoVersion(Date.now());
      setEditFullName(updated.full_name);
      setEditFederationId(updated.federation_id || '');
      notify('Perfil restaurado correctamente desde la base de datos.', 'success');
    } catch (e) {
      console.error(e);
      notify(e.message || 'Error al recuperar datos.', 'error');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleHardReset = async () => {
    const shouldReset = await askConfirm({
      title: 'Limpiar cache del movil',
      message: 'Esto cerrara la sesion y limpiara toda la cache del movil. Tendras que volver a entrar.',
      confirmText: 'Limpiar cache',
      cancelText: 'Cancelar',
    });
    if (!shouldReset) return;
    localStorage.clear();
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) reg.unregister();
      });
    }
    window.location.href = window.location.origin + import.meta.env.BASE_URL;
  };

  // ── Real-time profile sync (photo, name, linked users) ───────────────────
  useEffect(() => {
    if (!user?.username || !activeUserDocId) return;

    const unsubProfile = onSnapshot(getUserProfileRef(db, user), (snapshot) => {
      if (!snapshot.exists()) return;

      const freshData = snapshot.data();
      const managedUsernames = Array.isArray(freshData.managed_users) ? freshData.managed_users : [];
      const incomingPhoto = freshData.photo_url;
      const incomingPhotoUpdatedAt = freshData.photo_updated_at || '';
      const incomingName = freshData.full_name;
      const currentManaged = JSON.stringify(user.managed_users || []);
      const incomingManaged = JSON.stringify(managedUsernames);

      setUser((prev) => {
        if (!prev || prev.username !== user.username) return prev;
        const photoToUse = incomingPhoto && String(incomingPhoto).trim() !== '' ? incomingPhoto : '';
        const photoChanged = prev.photo_url !== photoToUse
          || String(prev.photo_updated_at || '') !== String(incomingPhotoUpdatedAt);
        if (
          photoChanged ||
          prev.full_name !== incomingName ||
          currentManaged !== incomingManaged
        ) {
          const updated = { ...prev, ...freshData, photo_url: photoToUse, manager_id: prev.manager_id };
          writeSavedUser(updated);
          if (photoChanged) {
            void invalidateProfilePhotoCache(photoToUse, incomingPhotoUpdatedAt)
              .finally(() => setPhotoVersion(Date.now()));
          }
          return updated;
        }
        return prev;
      });

      if (managedUsernames.length > 0) {
        const fetchLinked = async () => {
          try {
            const profiles = [{ ...freshData, username: user.username, docId: activeUserDocId }];
            for (const childId of managedUsernames) {
              const childProfile = await fetchUserProfileByUsername(db, childId);
              if (childProfile) profiles.push(childProfile);
            }
            const unique = profiles.filter((v, i, a) => a.findIndex((t) => t.username === v.username) === i);
            setLinkedUsers(unique);
          } catch (e) {
            console.error('[profile] Error fetching linked profiles:', e);
          }
        };
        void fetchLinked();
      } else if (freshData.role !== 'manager' && !user.manager_id) {
        setLinkedUsers([]);
      }
    });

    return () => unsubProfile();
  }, [activeUserDocId, user?.username]);

  const value = {
    // Photo
    photoVersion,
    isUploadingPhoto,
    handlePhotoUpload,

    // Profile modal
    isProfileModalOpen,
    openProfileModal,
    closeProfileModal,
    editFullName,
    setEditFullName,
    editFederationId,
    setEditFederationId,
    editEmail,
    setEditEmail,
    isUpdatingProfile,
    handleUpdateProfile,
    handleRecoverProfile,
    handleHardReset,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
      {feedback && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '22px',
            transform: 'translateX(-50%)',
            zIndex: 10020,
            maxWidth: 'min(520px, calc(100vw - 32px))',
            padding: '12px 16px',
            borderRadius: '999px',
            color: feedback.type === 'error' ? '#7f1d1d' : '#064e3b',
            background: feedback.type === 'error' ? '#fee2e2' : '#dcfce7',
            border: feedback.type === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0',
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
            fontWeight: '800',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}
        >
          {feedback.message}
        </div>
      )}
      {confirmDialog && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10010,
            background: 'rgba(15, 23, 42, 0.48)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => {
            confirmDialog.resolve(false);
            setConfirmDialog(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, 100%)',
              background: 'white',
              borderRadius: '18px',
              padding: '22px',
              boxShadow: '0 24px 70px rgba(15, 23, 42, 0.32)',
              border: '1px solid #e2e8f0'
            }}
          >
            <h3 style={{ margin: '0 0 10px', color: '#0f172a', fontSize: '1.15rem' }}>{confirmDialog.title}</h3>
            <p style={{ margin: '0 0 20px', color: '#64748b', lineHeight: 1.5, fontWeight: '600' }}>{confirmDialog.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.resolve(false);
                  setConfirmDialog(null);
                }}
                style={{ padding: '10px 16px', borderRadius: '999px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontWeight: '900', cursor: 'pointer' }}
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.resolve(true);
                  setConfirmDialog(null);
                }}
                style={{ padding: '10px 16px', borderRadius: '999px', border: 'none', background: '#dc2626', color: 'white', fontWeight: '900', cursor: 'pointer' }}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}
