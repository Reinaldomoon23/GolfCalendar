import { useContext } from 'react';
import { UserDataContext } from './user-data-context';

export function useUserData() {
  const context = useContext(UserDataContext);
  if (!context) {
    throw new Error('useUserData must be used within UserDataProvider');
  }
  return context;
}
