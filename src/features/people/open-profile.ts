import { router } from 'expo-router';

/**
 * Opens someone's profile over the tabs. Yours is the Profile tab instead,
 * which has your edit form and settings.
 */
export function openProfile(userId: string, myId: string | undefined) {
  if (userId === myId) router.navigate('/profile');
  else router.push({ pathname: '/users/[id]', params: { id: userId } });
}
