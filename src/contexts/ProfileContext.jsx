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
import { uploadProfilePhoto, updateUserProfile, recoverLegacyProfile, selfHealPhoto } from '../services/profile.service';
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
      alert('¡Foto actualizada en Cloudflare R2!');
    } catch (err) {
      console.error('R2 Upload error:', err);
      alert(`Error al subir a Cloudflare R2: ${err.message || 'Error desconocido'}`);
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
      alert('Perfil actualizado correctamente');
    } catch (err) {
      console.error(err);
      alert('Error al actualizar perfil');
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
      alert('✅ Perfil restaurado correctamente desde la base de datos.');
    } catch (e) {
      console.error(e);
      alert(e.message || 'Error al recuperar datos.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleHardReset = () => {
    if (
      !window.confirm(
        '¿Estás seguro? Esto cerrará la sesión y limpiará TODA la caché del móvil. Tendrás que volver a entrar.'
      )
    )
      return;
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
      const incomingName = freshData.full_name;
      const currentManaged = JSON.stringify(user.managed_users || []);
      const incomingManaged = JSON.stringify(managedUsernames);

      setUser((prev) => {
        if (!prev || prev.username !== user.username) return prev;
        const photoToUse = incomingPhoto && String(incomingPhoto).trim() !== '' ? incomingPhoto : prev.photo_url;
        void selfHealPhoto(prev, incomingPhoto);
        if (
          prev.photo_url !== photoToUse ||
          prev.full_name !== incomingName ||
          currentManaged !== incomingManaged
        ) {
          const updated = { ...prev, ...freshData, photo_url: photoToUse, manager_id: prev.manager_id };
          writeSavedUser(updated);
          setPhotoVersion(Date.now());
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

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}
