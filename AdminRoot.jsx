import { useState } from 'react';
import { isUnlocked, getCurrentEventId, clearCurrentEventId } from '../lib/storage';
import Lock from './Lock';
import EventPicker from './EventPicker';
import AdminApp from './admin/AdminApp';

export default function AdminRoot({ onSwitchRole }) {
  const [unlocked, setUnlockedState] = useState(isUnlocked());
  const [eventId, setEventId] = useState(getCurrentEventId());

  if (!unlocked) {
    return <Lock onUnlock={() => setUnlockedState(true)} onSwitchRole={onSwitchRole} />;
  }
  if (!eventId) {
    return <EventPicker onOpenEvent={id => setEventId(id)} onSwitchRole={onSwitchRole} />;
  }
  return (
    <AdminApp
      eventId={eventId}
      onSwitchEvent={() => { clearCurrentEventId(); setEventId(null); }}
      onSwitchRole={onSwitchRole}
    />
  );
}
