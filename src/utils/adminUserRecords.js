function isBlank(value) {
  return value == null
    || value === ''
    || (Array.isArray(value) && value.length === 0);
}

function getRecordScore(user) {
  let score = 0;
  if (user.uid && user.id === user.uid) score += 100;
  if (!isBlank(user.role)) score += 10;
  if (!isBlank(user.email)) score += 5;
  if (!isBlank(user.photo_url)) score += 3;
  if (!isBlank(user.federation_id)) score += 2;
  if (!isBlank(user.updated_at) || !isBlank(user.created_at)) score += 1;
  return score;
}

function mergeMissingFields(base, fallback) {
  const merged = { ...base };
  Object.entries(fallback).forEach(([key, value]) => {
    if (key === 'id') return;
    if (key === 'relatedDocIds') return;
    if (key === 'hasLegacyDuplicate') return;
    if (isBlank(merged[key]) && !isBlank(value)) {
      merged[key] = value;
    }
  });
  return merged;
}

export function dedupeAdminUsers(rawUsers) {
  const groupedUsers = new Map();

  rawUsers.forEach((user) => {
    const key = user.uid || user.username || user.id;
    if (!key) return;

    const current = groupedUsers.get(key) || [];
    current.push(user);
    groupedUsers.set(key, current);
  });

  return Array.from(groupedUsers.values()).map((candidates) => {
    const rankedCandidates = [...candidates].sort((a, b) => (
      getRecordScore(b) - getRecordScore(a)
    ));

    const canonicalUser = rankedCandidates.slice(1).reduce(
      (acc, candidate) => mergeMissingFields(acc, candidate),
      rankedCandidates[0]
    );

    return {
      ...canonicalUser,
      relatedDocIds: candidates.map((candidate) => candidate.id),
      hasLegacyDuplicate: candidates.length > 1,
    };
  });
}
