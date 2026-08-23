import { useMemo, useState } from 'react';
import { getKnownProfilePhotoUrl, R2_PUBLIC_URL } from '../utils/profilePhotos';

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, '');

function getAvatarUrl(displayName) {
  const safeName = encodeURIComponent(displayName || 'Golf');
  return `https://ui-avatars.com/api/?name=${safeName}&background=0D8ABC&color=fff&size=256`;
}

function appendVersion(url, version) {
  // R2 uploads use a unique filename, so query-string cache busting only
  // creates duplicate requests without improving freshness.
  if (!version || !url || url.startsWith('blob:') || url.includes('.r2.dev/')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${version}`;
}

function extractFileName(photoPath) {
  const value = String(photoPath || '').trim();
  if (!value) return '';

  if (value.startsWith('http')) {
    try {
      const parsed = new URL(value);
      const pathname = parsed.pathname.split('/').filter(Boolean);
      return pathname[pathname.length - 1] || '';
    } catch {
      return value.split('/').pop() || '';
    }
  }

  return value.split('/').pop() || value;
}

function toLegacyUrl(photoPath, version) {
  const value = String(photoPath || '').trim();
  if (!value) return null;

  if (value.startsWith('http')) {
    if (value.includes('reinaldomoon.top/GolfTeam/profiles/')) {
      return appendVersion(value, version);
    }
    return appendVersion(value, version);
  }

  const normalizedPath = value.replace(/^\/+/, '');
  return appendVersion(`${BASE_URL}/${normalizedPath}`, version);
}

function toCloudflareUrl(fileName, version) {
  if (!fileName) return null;
  return appendVersion(`${R2_PUBLIC_URL}/${encodeURIComponent(fileName)}`, version);
}

function getCandidateSources(photoPath, version) {
  const value = String(photoPath || '').trim();
  if (!value) return [];

  const fileName = extractFileName(value);
  const candidates = [];

  // Firestore is the source of truth: try its exact absolute URL first.
  if (value.startsWith('http')) {
    candidates.push(appendVersion(value, version));
  }

  // R2 remains a fallback for legacy/relative paths and migrated photos.
  if (fileName) {
    candidates.push(toCloudflareUrl(fileName, version));
  }

  const legacyUrl = toLegacyUrl(value, version);
  if (legacyUrl) {
    candidates.push(legacyUrl);
  }

  return candidates.filter((candidate, index, array) => (
    Boolean(candidate) && array.indexOf(candidate) === index
  ));
}

export default function ProfileImage({
  photoPath,
  username,
  displayName,
  alt,
  version,
  style,
  className,
  title,
}) {
  const avatarUrl = getAvatarUrl(displayName);
  const knownPhotoUrl = getKnownProfilePhotoUrl({ username, displayName });
  const stateKey = `${String(photoPath || '')}::${String(knownPhotoUrl)}::${String(version || '')}`;
  const candidates = useMemo(() => {
    const storedSources = getCandidateSources(photoPath, version);
    const knownSources = getCandidateSources(knownPhotoUrl, version);
    const storedIsR2 = String(photoPath || '').includes('.r2.dev/');
    const orderedSources = storedIsR2
      ? [...storedSources, ...knownSources]
      : [...knownSources, ...storedSources];
    const uniqueSources = orderedSources.filter((source, index, array) => (
      Boolean(source) && array.indexOf(source) === index
    ));
    return [...uniqueSources, avatarUrl];
  }, [avatarUrl, knownPhotoUrl, photoPath, version]);
  const [candidateIndexes, setCandidateIndexes] = useState({});
  const candidateIndex = candidateIndexes[stateKey] || 0;

  const src = candidates[Math.min(candidateIndex, candidates.length - 1)] || avatarUrl;

  return (
    <img
      src={src}
      alt={alt || displayName || 'Perfil'}
      className={className}
      title={title}
      style={style}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.onerror = null;
        setCandidateIndexes((previousIndexes) => {
          const nextIndex = Math.min((previousIndexes[stateKey] || 0) + 1, candidates.length - 1);
          if (nextIndex === (previousIndexes[stateKey] || 0)) {
            return previousIndexes;
          }
          return {
            ...previousIndexes,
            [stateKey]: nextIndex,
          };
        });
      }}
    />
  );
}
