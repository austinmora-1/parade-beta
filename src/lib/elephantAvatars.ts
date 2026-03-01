import elephant1 from '@/assets/elephant-avatars/elephant-1.png';
import elephant2 from '@/assets/elephant-avatars/elephant-2.png';
import elephant3 from '@/assets/elephant-avatars/elephant-3.png';
import elephant4 from '@/assets/elephant-avatars/elephant-4.png';
import elephant5 from '@/assets/elephant-avatars/elephant-5.png';

const elephantAvatars = [elephant1, elephant2, elephant3, elephant4, elephant5];

/**
 * Returns a deterministic elephant avatar based on a string (e.g. friend name).
 * Used as the default avatar when a user hasn't set a profile picture.
 */
export function getElephantAvatar(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return elephantAvatars[Math.abs(hash) % elephantAvatars.length];
}
