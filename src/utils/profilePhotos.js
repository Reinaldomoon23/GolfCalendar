const R2_PUBLIC_URL = 'https://pub-23c281cf1ae04def9102341cf7d87837.r2.dev';

const CANONICAL_PROFILE_PHOTO_FILES = {
  nicole: 'nicole_1770126902.jpg',
  ona: 'ona.jpg',
  txell: 'txell.jpg',
};

function normalizeProfileIdentity(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getKnownProfilePhotoUrl(profile = {}) {
  const username = normalizeProfileIdentity(profile.username || profile.id).replace(/\s+/g, '');
  let fileName = CANONICAL_PROFILE_PHOTO_FILES[username];

  if (!fileName) {
    const displayName = normalizeProfileIdentity(
      profile.displayName || profile.fullName || profile.full_name || profile.name
    );
    if (displayName.includes('nicole')) fileName = CANONICAL_PROFILE_PHOTO_FILES.nicole;
    else if (displayName.includes('ona martinez')) fileName = CANONICAL_PROFILE_PHOTO_FILES.ona;
    else if (displayName.includes('txell')) fileName = CANONICAL_PROFILE_PHOTO_FILES.txell;
  }

  return fileName ? `${R2_PUBLIC_URL}/${encodeURIComponent(fileName)}` : '';
}

export { R2_PUBLIC_URL };
