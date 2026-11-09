import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function fail(message) {
  console.error(`[publish guard] ${message}`);
  process.exitCode = 1;
}

function countNulEntries(value) {
  return value.split('\0').filter(Boolean).length;
}

function assertIndexHealthy(root) {
  const indexFromGit = git(['rev-parse', '--git-path', 'index'], { cwd: root }).trim();
  const indexPath = path.isAbsolute(indexFromGit) ? indexFromGit : path.resolve(root, indexFromGit);
  const lockPath = `${indexPath}.lock`;
  if (!existsSync(indexPath)) {
    throw new Error(`Falta el índice de Git (${indexPath}). No publiques ni ejecutes «git add -A»; consulta docs/GIT_PUBLISH_SAFETY.md.`);
  }
  if (existsSync(lockPath)) {
    throw new Error(`Existe ${lockPath}; espera a que termine Git y revisa el bloqueo antes de publicar.`);
  }

  const headFiles = git(['ls-tree', '-r', '--name-only', 'HEAD'], { cwd: root }).trim().split(/\r?\n/).filter(Boolean);
  const indexedFiles = git(['ls-files'], { cwd: root }).trim().split(/\r?\n/).filter(Boolean);
  if (headFiles.length > 0 && indexedFiles.length === 0) {
    throw new Error('El índice no contiene archivos, pero HEAD sí. Publicación bloqueada para evitar borrar el proyecto.');
  }

  return { headFileCount: headFiles.length, indexPath };
}

function assertDeletionCountIsSafe(deletedCount, trackedCount, context) {
  const threshold = Math.max(50, Math.ceil(trackedCount * 0.1));
  if (deletedCount < threshold || process.env.PUBLISH_ALLOW_MASS_DELETIONS === '1') return;
  throw new Error(`${context}: ${deletedCount} archivos eliminados de ${trackedCount}. Publicación bloqueada; revisa el diff. Solo permite una eliminación masiva intencional con PUBLISH_ALLOW_MASS_DELETIONS=1 en esa ejecución.`);
}

function checkPendingIndexChanges(root, trackedCount) {
  const deleted = countNulEntries(git(['diff', '--cached', '--name-only', '--diff-filter=D', '-z'], { cwd: root }));
  assertDeletionCountIsSafe(deleted, trackedCount, 'El índice preparado contiene una eliminación masiva');
}

async function checkOutgoingPushes(root) {
  const input = await new Promise((resolve, reject) => {
    let value = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { value += chunk; });
    process.stdin.on('end', () => resolve(value));
    process.stdin.on('error', reject);
  });
  const refs = String(input).trim().split(/\r?\n/).filter(Boolean);
  for (const line of refs) {
    const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);
    if (!localSha || !remoteSha || /^0+$/.test(localSha) || /^0+$/.test(remoteSha) || localSha === remoteSha) continue;
    const trackedCount = countNulEntries(git(['ls-tree', '-r', '--name-only', remoteSha, '-z'], { cwd: root }));
    const deleted = countNulEntries(git(['diff', '--name-only', '--diff-filter=D', '-z', remoteSha, localSha], { cwd: root }));
    assertDeletionCountIsSafe(deleted, trackedCount, `El push ${localRef} → ${remoteRef} incluye un borrado masivo`);
  }
}

try {
  const root = git(['rev-parse', '--show-toplevel'], { cwd: process.cwd() }).trim();
  const { headFileCount } = assertIndexHealthy(root);
  if (process.argv.includes('--pre-push')) await checkOutgoingPushes(root);
  else checkPendingIndexChanges(root, headFileCount);
  if (!process.exitCode) console.log('[publish guard] Índice Git y cambios de publicación revisados.');
} catch (error) {
  fail(error.message || 'No se pudo comprobar el estado Git.');
}
