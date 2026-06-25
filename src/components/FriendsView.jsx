import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  Bell,
  CalendarDays,
  Check,
  EyeOff,
  Flag,
  MessageCircle,
  Clock,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import ProfileImage from './ProfileImage';
import { parseDateHelper } from '../utils/dateHelpers';
import { getUserDocId } from '../utils/userProfiles';
import { resolveCanonicalTournamentId } from '../services/tournaments.service';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getCommunityProfileStatus,
  loadFriendSchedule,
  rejectFriendRequest,
  removeFriend,
  saveCommunityProfile,
  searchUsersForFriendship,
  sendFriendRequest,
  subscribeToFriends,
  subscribeToIncomingFriendRequests,
  subscribeToOutgoingFriendRequests,
} from '../services/friends.service';
import {
  blockChatUser,
  deleteChatMessage,
  getOrCreateChat,
  hideChatForUser,
  markChatRead,
  reportChat,
  sendChatMessage,
  subscribeToChatMessages,
  subscribeToChats,
} from '../services/chat.service';
import {
  enablePushNotifications,
  isPushNotificationSupported,
} from '../services/notifications.service';

const tabs = [
  { id: 'friends', label: 'Amigos', icon: Users },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'requests', label: 'Solicitudes', icon: UserPlus },
  { id: 'search', label: 'Buscar', icon: Search },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
];

function getTournamentDateValue(tournament) {
  const { start, end } = parseDateHelper(tournament?.dates || '');
  return (start || end || new Date(8640000000000000)).getTime();
}

function isFutureTournament(tournament) {
  const { end } = parseDateHelper(tournament?.dates || '');
  if (!end) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end >= today;
}

function getAgendaRange(item) {
  const { start } = parseDateHelper(item?.dates || '');
  if (!start) return 'future';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(today.getDate() + 30);

  if (start <= in30) return 'next30';
  return 'future';
}

function getTournamentId(item) {
  return resolveCanonicalTournamentId(item?.tournamentId || item?.id || item?.tournament_id);
}

function StatusMessage({ message }) {
  if (!message?.text) return null;

  const palette = message.type === 'error'
    ? { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' }
    : { bg: '#ecfdf5', border: '#bbf7d0', color: '#166534' };

  return (
    <div style={{
      padding: '0.85rem 1rem',
      borderRadius: '8px',
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      color: palette.color,
      fontWeight: 700,
      fontSize: '0.9rem',
      marginBottom: '1rem',
    }}>
      {message.text}
    </div>
  );
}

function FriendCard({ friend, onRemove, onOpenChat, unread }) {
  return (
    <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
      <ProfileImage
        photoPath={friend.photo_url}
        displayName={friend.full_name || friend.username}
        username={friend.username}
        style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 900, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {friend.full_name || friend.username}
        </div>
        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>@{friend.username}</div>
      </div>
      <button
        type="button"
        onClick={() => onOpenChat(friend)}
        title="Abrir chat"
        style={{
          border: '1px solid #bfdbfe',
          background: unread ? '#eff6ff' : '#fff',
          color: '#2563eb',
          borderRadius: '8px',
          padding: '0.55rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <MessageCircle size={18} />
        {unread && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            width: '0.7rem',
            height: '0.7rem',
            borderRadius: '999px',
            background: '#ef4444',
            border: '2px solid #fff',
          }} />
        )}
      </button>
      <button
        type="button"
        onClick={() => onRemove(friend)}
        title="Eliminar amistad"
        style={{
          border: '1px solid #fee2e2',
          background: '#fff',
          color: '#dc2626',
          borderRadius: '8px',
          padding: '0.55rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

function formatMessageTime(value) {
  const date = value?.toDate?.();
  if (!date) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function ChatPanel({
  user,
  friends,
  chats,
  selectedChat,
  selectedFriend,
  messages,
  draft,
  sending,
  compact,
  onSelectChat,
  onStartChat,
  onBackToList,
  onDraftChange,
  onHideChat,
  onReportChat,
  onBlockChat,
  onDeleteMessage,
  onSend,
}) {
  const hasFriends = friends.length > 0;
  const showList = !compact || !selectedFriend;
  const showConversation = !compact || selectedFriend;
  const chatBlocked = selectedChat?.is_blocked;

  return (
    <div style={{
      display: compact ? 'block' : 'grid',
      gridTemplateColumns: compact ? '1fr' : 'minmax(260px, 0.8fr) minmax(320px, 1.2fr)',
      gap: '1rem',
      alignItems: 'start',
    }}>
      {showList && (
      <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 900, color: '#0f172a' }}>Conversaciones</div>
        {!hasFriends ? (
          <div style={{ color: '#64748b', lineHeight: 1.45 }}>Añade un contacto para empezar un chat.</div>
        ) : chats.length === 0 ? (
          <div style={{ color: '#64748b', lineHeight: 1.45 }}>Elige un contacto para iniciar la conversación.</div>
        ) : (
          chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => onSelectChat(chat)}
              style={{
                border: selectedChat?.id === chat.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                background: selectedChat?.id === chat.id ? '#eff6ff' : '#fff',
                borderRadius: '8px',
                padding: '0.75rem',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'grid',
                gap: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontWeight: 900, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chat.friend?.full_name || chat.friend?.username || 'Contacto'}
                </span>
                {chat.unread && (
                  <span style={{
                    width: '0.65rem',
                    height: '0.65rem',
                    borderRadius: '999px',
                    background: '#ef4444',
                    flexShrink: 0,
                  }} />
                )}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {chat.last_message?.text || 'Sin mensajes todavía'}
              </div>
            </button>
          ))
        )}

        {hasFriends && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
            <div style={{ fontWeight: 900, color: '#334155', fontSize: '0.9rem' }}>Nuevo chat</div>
            {friends.map((friend) => (
              <button
                key={friend.uid}
                type="button"
                onClick={() => onStartChat(friend)}
                style={{
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  borderRadius: '8px',
                  padding: '0.6rem 0.75rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 800,
                  color: '#0f172a',
                }}
              >
                {friend.full_name || friend.username}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {showConversation && (
      <div className="card" style={{ padding: 0, minHeight: '520px', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden' }}>
        {selectedFriend ? (
          <>
            <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {compact && (
                <button
                  type="button"
                  onClick={onBackToList}
                  title="Volver a conversaciones"
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#334155',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <ProfileImage
                photoPath={selectedFriend.photo_url}
                displayName={selectedFriend.full_name || selectedFriend.username}
                username={selectedFriend.username}
                style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedFriend.full_name || selectedFriend.username}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>@{selectedFriend.username}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => onHideChat(selectedChat)}
                  title="Ocultar conversación"
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#475569',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <EyeOff size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => onReportChat(selectedChat)}
                  title="Reportar conversación"
                  style={{
                    border: '1px solid #fed7aa',
                    background: '#fff7ed',
                    color: '#c2410c',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <Flag size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => onBlockChat(selectedChat)}
                  title="Bloquear chat"
                  disabled={selectedChat?.blocked_by_me}
                  style={{
                    border: '1px solid #fecaca',
                    background: selectedChat?.blocked_by_me ? '#f1f5f9' : '#fef2f2',
                    color: selectedChat?.blocked_by_me ? '#94a3b8' : '#dc2626',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    cursor: selectedChat?.blocked_by_me ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <Ban size={17} />
                </button>
              </div>
            </div>

            <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem', alignContent: 'start', overflowY: 'auto', background: '#f8fafc' }}>
              {chatBlocked && (
                <div style={{
                  padding: '0.75rem 0.9rem',
                  borderRadius: '8px',
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#991b1b',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                }}>
                  {selectedChat?.blocked_by_me ? 'Has bloqueado esta conversación.' : 'La otra jugadora ha bloqueado esta conversación.'}
                </div>
              )}
              {messages.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem 1rem' }}>Todavía no hay mensajes.</div>
              ) : (
                messages.map((msg) => {
                  const mine = msg.sender_uid === getUserDocId(user);
                  const deleted = Boolean(msg.deleted);
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '78%',
                        padding: '0.7rem 0.85rem',
                        borderRadius: mine ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                        background: deleted ? '#f1f5f9' : (mine ? '#2563eb' : '#fff'),
                        color: deleted ? '#64748b' : (mine ? '#fff' : '#0f172a'),
                        border: deleted ? '1px dashed #cbd5e1' : (mine ? '1px solid #2563eb' : '1px solid #e2e8f0'),
                        boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
                      }}>
                        <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.4, fontStyle: deleted ? 'italic' : 'normal' }}>
                          {deleted ? 'Mensaje eliminado' : msg.text}
                        </div>
                        <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', opacity: 0.72, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          <span>{formatMessageTime(msg.created_at)}</span>
                          {mine && !deleted && (
                            <button
                              type="button"
                              onClick={() => onDeleteMessage(msg)}
                              title="Borrar mensaje"
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'inherit',
                                cursor: 'pointer',
                                padding: '0.1rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                opacity: 0.85,
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={onSend} style={{ padding: '0.85rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.6rem' }}>
              <input
                type="text"
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder="Escribe un mensaje"
                maxLength={1000}
                disabled={chatBlocked}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim() || chatBlocked}>
                <Send size={16} />
                Enviar
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', padding: '2rem', color: '#64748b', textAlign: 'center' }}>
            Selecciona una conversación o empieza un chat con un contacto.
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
      <div style={{ fontWeight: 900, color: '#334155', marginBottom: '0.35rem' }}>{title}</div>
      <div>{text}</div>
    </div>
  );
}

function CommunityProfileGate({ user, onCompleted }) {
  const status = getCommunityProfileStatus(user);
  const [form, setForm] = useState({
    first_name: status.firstName,
    last_name_1: status.lastName1,
    last_name_2: status.lastName2,
    federation_id: status.federationId,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const updatedProfile = await saveCommunityProfile(user, form);
      onCompleted(updatedProfile);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo guardar el perfil.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '760px', margin: '0 auto' }}>
      <div className="card" style={{ padding: '1.25rem' }}>
        <h1 style={{ margin: '0 0 0.35rem', color: '#0f172a', fontSize: '1.55rem' }}>
          Completa tu perfil de comunidad
        </h1>
        <p style={{ margin: '0 0 1rem', color: '#64748b', lineHeight: 1.5 }}>
          Para que otras jugadoras puedan encontrarte sin confusiones necesitamos nombre, dos apellidos y licencia federativa.
        </p>

        <StatusMessage message={message} />

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
            <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 800 }}>
              Nombre
              <input
                type="text"
                value={form.first_name}
                onChange={(event) => updateField('first_name', event.target.value)}
                placeholder="Ej: Nicole"
                required
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 800 }}>
              Primer apellido
              <input
                type="text"
                value={form.last_name_1}
                onChange={(event) => updateField('last_name_1', event.target.value)}
                placeholder="Ej: Likhomanova"
                required
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 800 }}>
              Segundo apellido
              <input
                type="text"
                value={form.last_name_2}
                onChange={(event) => updateField('last_name_2', event.target.value)}
                placeholder="Ej: Garcia"
                required
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 800 }}>
            Licencia federativa
            <input
              type="text"
              value={form.federation_id}
              onChange={(event) => updateField('federation_id', event.target.value)}
              placeholder="Ej: CB123456"
              required
              minLength={4}
              style={{ textTransform: 'uppercase' }}
            />
          </label>

          <div style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#475569',
            fontSize: '0.9rem',
            lineHeight: 1.45,
          }}>
            Estos datos se usan para búsqueda dentro de Comunidad y para evitar duplicados. El usuario de acceso no cambia.
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ justifyContent: 'center' }}>
            {saving ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function FriendsView({ user, activeCalendarTournaments = [], subscribedIds = [] }) {
  const [localUser, setLocalUser] = useState(user);
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState(null);
  const [agenda, setAgenda] = useState([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaFriendFilter, setAgendaFriendFilter] = useState('all');
  const [agendaRangeFilter, setAgendaRangeFilter] = useState('all');
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [pushStatus, setPushStatus] = useState('checking');
  const [isCompactChat, setIsCompactChat] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 720 : false
  ));
  const communityProfileStatus = getCommunityProfileStatus(localUser);

  useEffect(() => {
    setLocalUser(user);
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    isPushNotificationSupported()
      .then((supported) => {
        if (cancelled) return;
        if (!supported) {
          setPushStatus('unsupported');
          return;
        }
        setPushStatus(Notification.permission === 'granted' ? 'enabled' : 'available');
      })
      .catch(() => {
        if (!cancelled) setPushStatus('unsupported');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      setIsCompactChat(window.innerWidth < 720);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!communityProfileStatus.isComplete) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      return undefined;
    }

    const unsubFriends = subscribeToFriends(localUser, setFriends);
    const unsubIncoming = subscribeToIncomingFriendRequests(localUser, setIncomingRequests);
    const unsubOutgoing = subscribeToOutgoingFriendRequests(localUser, setOutgoingRequests);
    const unsubChats = subscribeToChats(localUser, setChats);

    return () => {
      unsubFriends();
      unsubIncoming();
      unsubOutgoing();
      unsubChats();
    };
  }, [localUser?.uid, localUser?.docId, localUser?.username, communityProfileStatus.isComplete]);

  useEffect(() => {
    if (!selectedChat?.id || !communityProfileStatus.isComplete) {
      setChatMessages([]);
      return undefined;
    }

    markChatRead(localUser, selectedChat.id).catch((error) => {
      console.warn('[chat] Could not mark chat as read:', error);
    });

    const unsubscribe = subscribeToChatMessages(selectedChat.id, localUser, setChatMessages);
    return () => unsubscribe();
  }, [selectedChat?.id, localUser?.uid, localUser?.docId, communityProfileStatus.isComplete]);

  useEffect(() => {
    if (!selectedChat?.id) return;
    const refreshed = chats.find((chat) => chat.id === selectedChat.id);
    if (refreshed) {
      setSelectedChat(refreshed);
      setSelectedFriend(refreshed.friend);
      if (refreshed.unread) {
        markChatRead(localUser, refreshed.id).catch((error) => {
          console.warn('[chat] Could not mark refreshed chat as read:', error);
        });
      }
    }
  }, [chats, selectedChat?.id, localUser?.uid, localUser?.docId]);

  useEffect(() => {
    let cancelled = false;

    async function loadAgenda() {
      if (activeTab !== 'agenda' || friends.length === 0) {
        setAgenda([]);
        return;
      }

      setAgendaLoading(true);
      try {
        const scheduleGroups = await Promise.all(friends.map(loadFriendSchedule));
        if (cancelled) return;

        const rows = scheduleGroups
          .flat()
          .filter(isFutureTournament)
          .sort((a, b) => getTournamentDateValue(a) - getTournamentDateValue(b));

        setAgenda(rows);
      } catch (error) {
        console.error('[friends] Could not load friend agenda:', error);
        if (!cancelled) {
          setMessage({ type: 'error', text: 'No se pudo cargar la agenda de amigos.' });
        }
      } finally {
        if (!cancelled) setAgendaLoading(false);
      }
    }

    loadAgenda();
    return () => {
      cancelled = true;
    };
  }, [activeTab, friends]);

  const outgoingByUid = useMemo(() => {
    const map = new Set();
    outgoingRequests.forEach((request) => map.add(request.to_uid));
    return map;
  }, [outgoingRequests]);

  const friendUids = useMemo(() => new Set(friends.map((friend) => friend.uid)), [friends]);
  const unreadChatCount = useMemo(() => chats.filter((chat) => chat.unread).length, [chats]);
  const unreadByFriendUid = useMemo(() => {
    const map = new Map();
    chats.forEach((chat) => {
      if (chat.friend_uid && chat.unread) map.set(chat.friend_uid, true);
    });
    return map;
  }, [chats]);
  const myTournamentIds = useMemo(() => {
    const ids = new Set((subscribedIds || []).map((id) => String(resolveCanonicalTournamentId(id))));
    (activeCalendarTournaments || []).forEach((tournament) => {
      const id = resolveCanonicalTournamentId(tournament?.id);
      if (id) ids.add(String(id));
    });
    return ids;
  }, [activeCalendarTournaments, subscribedIds]);

  const filteredAgenda = useMemo(() => (
    agenda.filter((item) => {
      if (agendaFriendFilter !== 'all' && item.friend_uid !== agendaFriendFilter) return false;
      if (agendaRangeFilter === 'next30' && getAgendaRange(item) !== 'next30') return false;
      if (agendaRangeFilter === 'mutual' && !myTournamentIds.has(String(getTournamentId(item)))) return false;
      return true;
    })
  ), [agenda, agendaFriendFilter, agendaRangeFilter, myTournamentIds]);

  const handleSearch = async (event) => {
    event.preventDefault();
    setMessage(null);
    setSearchResults([]);
    setIsSearching(true);

    try {
      const results = await searchUsersForFriendship(localUser, search);
      setSearchResults(results);
      if (results.length === 0) {
        setMessage({ type: 'error', text: 'No se ha encontrado ninguna jugadora con ese nombre o usuario.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo buscar la jugadora.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (targetProfile) => {
    if (!targetProfile) return;
    setIsWorking(true);
    setMessage(null);

    try {
      await sendFriendRequest(localUser, targetProfile);
      setMessage({ type: 'success', text: `Solicitud enviada a @${targetProfile.username}.` });
      setSearchResults((previousResults) => previousResults.filter((result) => result.uid !== targetProfile.uid));
      setSearch('');
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo enviar la solicitud.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleAccept = async (request) => {
    setIsWorking(true);
    setMessage(null);
    try {
      await acceptFriendRequest(localUser, request);
      setMessage({ type: 'success', text: `Ahora tienes a @${request.from_user?.username} en Amigos.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo aceptar la solicitud.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleReject = async (request) => {
    setIsWorking(true);
    setMessage(null);
    try {
      await rejectFriendRequest(localUser, request);
      setMessage({ type: 'success', text: 'Solicitud rechazada.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo rechazar la solicitud.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleCancelOutgoingRequest = async (request) => {
    setIsWorking(true);
    setMessage(null);
    try {
      await cancelFriendRequest(localUser, request);
      setMessage({ type: 'success', text: 'Solicitud cancelada.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo cancelar la solicitud.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleRemoveFriend = async (friend) => {
    setIsWorking(true);
    setMessage(null);
    try {
      await removeFriend(localUser, friend);
      setMessage({ type: 'success', text: `@${friend.username} ya no está en tu lista de amigos.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo eliminar la amistad.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleOpenChat = async (friend, initialDraft = '') => {
    if (!friend) return;
    setIsWorking(true);
    setMessage(null);
    try {
      const chatId = await getOrCreateChat(localUser, friend);
      const existingChat = chats.find((chat) => chat.id === chatId);
      const nextChat = existingChat || {
        id: chatId,
        friend_uid: friend.uid,
        friend,
        members: [getUserDocId(localUser), friend.uid].filter(Boolean).sort(),
        unread: false,
      };
      setSelectedChat(nextChat);
      setSelectedFriend(friend);
      if (initialDraft) setChatDraft(initialDraft);
      setActiveTab('chat');
      await markChatRead(localUser, chatId).catch(() => {});
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo abrir el chat.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setSelectedFriend(chat.friend);
    setActiveTab('chat');
    await markChatRead(localUser, chat.id).catch((error) => {
      console.warn('[chat] Could not mark selected chat as read:', error);
    });
  };

  const handleBackToChatList = () => {
    setSelectedChat(null);
    setSelectedFriend(null);
    setChatMessages([]);
    setChatDraft('');
  };

  const handleHideChat = async (chat) => {
    if (!chat?.id) return;
    setIsWorking(true);
    setMessage(null);
    try {
      await hideChatForUser(localUser, chat.id);
      handleBackToChatList();
      setMessage({ type: 'success', text: 'Conversación ocultada.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo ocultar la conversación.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleReportChat = async (chat) => {
    if (!chat?.id) return;
    setIsWorking(true);
    setMessage(null);
    try {
      await reportChat(localUser, chat);
      setMessage({ type: 'success', text: 'Conversación reportada para revisión.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo reportar la conversación.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleBlockChat = async (chat) => {
    if (!chat?.id || chat.blocked_by_me) return;
    setIsWorking(true);
    setMessage(null);
    try {
      await blockChatUser(localUser, chat);
      setSelectedChat((previous) => previous ? { ...previous, blocked_by_me: true, is_blocked: true } : previous);
      setMessage({ type: 'success', text: 'Chat bloqueado.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo bloquear el chat.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleDeleteMessage = async (messageToDelete) => {
    if (!selectedChat?.id || !messageToDelete?.id) return;
    setIsWorking(true);
    setMessage(null);
    try {
      await deleteChatMessage(localUser, selectedChat, messageToDelete);
      setMessage({ type: 'success', text: 'Mensaje borrado.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo borrar el mensaje.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleSendChat = async (event) => {
    event.preventDefault();
    if (!selectedFriend || !chatDraft.trim()) return;

    setIsSendingChat(true);
    setMessage(null);
    try {
      await sendChatMessage(localUser, selectedFriend, chatDraft);
      setChatDraft('');
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo enviar el mensaje.' });
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleEnablePushNotifications = async () => {
    setIsWorking(true);
    setMessage(null);
    try {
      await enablePushNotifications(localUser);
      setPushStatus('enabled');
      setMessage({ type: 'success', text: 'Notificaciones activadas para este dispositivo.' });
    } catch (error) {
      if (error.message?.includes('denegado')) setPushStatus('denied');
      setMessage({ type: 'error', text: error.message || 'No se pudieron activar las notificaciones.' });
    } finally {
      setIsWorking(false);
    }
  };

  const renderSearchResultAction = (targetProfile) => {
    if (!targetProfile) return null;
    if (friendUids.has(targetProfile.uid)) {
      return <span style={{ color: '#16a34a', fontWeight: 800 }}>Ya está en Amigos</span>;
    }
    if (outgoingByUid.has(targetProfile.uid)) {
      return <span style={{ color: '#64748b', fontWeight: 800 }}>Solicitud enviada</span>;
    }

    return (
      <button type="button" className="btn btn-primary" onClick={() => handleSendRequest(targetProfile)} disabled={isWorking}>
        <Send size={16} />
        Enviar solicitud
      </button>
    );
  };

  if (!communityProfileStatus.isComplete) {
    return (
      <CommunityProfileGate
        user={localUser}
        onCompleted={(updatedProfile) => {
          setLocalUser(updatedProfile);
          setMessage({ type: 'success', text: 'Perfil de comunidad completado.' });
        }}
      />
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '980px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.9rem' }}>Comunidad</h1>
        <p style={{ margin: '0.35rem 0 0', color: '#64748b' }}>
          Añade amigos y consulta su agenda futura cuando la amistad esté aceptada.
        </p>
      </div>

      {pushStatus !== 'enabled' && pushStatus !== 'unsupported' && (
        <div className="card" style={{
          marginBottom: '1rem',
          padding: '0.9rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.8rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#334155', fontWeight: 800 }}>
            <Bell size={18} color="#2563eb" />
            <span>Activa avisos de mensajes en este dispositivo.</span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleEnablePushNotifications}
            disabled={isWorking}
          >
            <Bell size={16} />
            Activar
          </button>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`btn ${isActive ? 'btn-primary' : 'card'}`}
              style={{ justifyContent: 'center' }}
            >
              <Icon size={18} />
              {tab.label}
              {tab.id === 'requests' && incomingRequests.length > 0 && (
                <span style={{
                  minWidth: '1.35rem',
                  height: '1.35rem',
                  borderRadius: '999px',
                  background: isActive ? '#fff' : '#2563eb',
                  color: isActive ? '#2563eb' : '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 900,
                }}>
                  {incomingRequests.length}
                </span>
              )}
              {tab.id === 'chat' && unreadChatCount > 0 && (
                <span style={{
                  minWidth: '1.35rem',
                  height: '1.35rem',
                  borderRadius: '999px',
                  background: isActive ? '#fff' : '#ef4444',
                  color: isActive ? '#ef4444' : '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 900,
                }}>
                  {unreadChatCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <StatusMessage message={message} />

      {activeTab === 'friends' && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {friends.length === 0 ? (
            <EmptyState title="Todavía no tienes amigos" text="Busca una jugadora por su usuario y envía una solicitud." />
          ) : (
            friends.map((friend) => (
              <FriendCard
                key={friend.uid}
                friend={friend}
                onRemove={handleRemoveFriend}
                onOpenChat={handleOpenChat}
                unread={unreadByFriendUid.get(friend.uid)}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'chat' && (
        <ChatPanel
          user={localUser}
          friends={friends}
          chats={chats}
          selectedChat={selectedChat}
          selectedFriend={selectedFriend}
          messages={chatMessages}
          draft={chatDraft}
          sending={isSendingChat}
          compact={isCompactChat}
          onSelectChat={handleSelectChat}
          onStartChat={handleOpenChat}
          onBackToList={handleBackToChatList}
          onDraftChange={setChatDraft}
          onHideChat={handleHideChat}
          onReportChat={handleReportChat}
          onBlockChat={handleBlockChat}
          onDeleteMessage={handleDeleteMessage}
          onSend={handleSendChat}
        />
      )}

      {activeTab === 'requests' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <section>
            <h2 style={{ fontSize: '1rem', color: '#334155', margin: '0 0 0.75rem' }}>Recibidas</h2>
            {incomingRequests.length === 0 ? (
              <EmptyState title="Sin solicitudes pendientes" text="Cuando alguien quiera añadirte, aparecerá aquí." />
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {incomingRequests.map((request) => (
                  <div key={request.id} className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <ProfileImage
                      photoPath={request.from_user?.photo_url}
                      displayName={request.from_user?.full_name || request.from_user?.username}
                      username={request.from_user?.username}
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ fontWeight: 900 }}>{request.from_user?.full_name || request.from_user?.username}</div>
                      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>@{request.from_user?.username}</div>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={() => handleAccept(request)} disabled={isWorking}>
                      <Check size={16} />
                      Aceptar
                    </button>
                    <button type="button" className="btn card" onClick={() => handleReject(request)} disabled={isWorking}>
                      <X size={16} />
                      Rechazar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 style={{ fontSize: '1rem', color: '#334155', margin: '0 0 0.75rem' }}>Enviadas</h2>
            {outgoingRequests.length === 0 ? (
              <EmptyState title="No tienes solicitudes enviadas" text="Las solicitudes pendientes que envíes aparecerán aquí." />
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {outgoingRequests.map((request) => (
                  <div key={request.id} className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <Clock size={20} color="#64748b" />
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ fontWeight: 900 }}>{request.to_user?.full_name || request.to_user?.username}</div>
                      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Pendiente de aceptación</div>
                    </div>
                    <button type="button" className="btn card" onClick={() => handleCancelOutgoingRequest(request)} disabled={isWorking}>
                      <X size={16} />
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'search' && (
        <div className="card" style={{ padding: '1rem' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label style={{ display: 'block', fontWeight: 800, marginBottom: '0.4rem' }}>Nombre, apellidos o usuario</label>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ej: Nicole Likhomanova, Ona Martinez, iona"
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={isSearching} style={{ alignSelf: 'end' }}>
              <Search size={16} />
              {isSearching ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'grid', gap: '0.75rem' }}>
              {searchResults.map((searchResult) => (
                <div key={searchResult.uid} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                  <ProfileImage
                    photoPath={searchResult.photo_url}
                    displayName={searchResult.full_name || searchResult.username}
                    username={searchResult.username}
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ fontWeight: 900 }}>{searchResult.full_name || searchResult.username}</div>
                    <div style={{ color: '#64748b' }}>@{searchResult.username}</div>
                  </div>
                  {renderSearchResultAction(searchResult)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'agenda' && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {friends.length > 0 && (
            <div className="card" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 800, flex: '1 1 220px' }}>
                Amigo
                <select value={agendaFriendFilter} onChange={(event) => setAgendaFriendFilter(event.target.value)}>
                  <option value="all">Todos</option>
                  {friends.map((friend) => (
                    <option key={friend.uid} value={friend.uid}>
                      {friend.full_name || friend.username}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 800, flex: '1 1 220px' }}>
                Vista
                <select value={agendaRangeFilter} onChange={(event) => setAgendaRangeFilter(event.target.value)}>
                  <option value="all">Todos los futuros</option>
                  <option value="next30">Próximos 30 días</option>
                  <option value="mutual">También estoy apuntada</option>
                </select>
              </label>
            </div>
          )}

          {agendaLoading ? (
            <EmptyState title="Cargando agenda" text="Consultando torneos futuros de tus amigos." />
          ) : filteredAgenda.length === 0 ? (
            <EmptyState title="Sin torneos futuros visibles" text="Cuando una amistad aceptada esté apuntada a un torneo futuro, aparecerá aquí." />
          ) : (
            filteredAgenda.map((item) => {
              const tournamentId = getTournamentId(item);
              const isMutual = myTournamentIds.has(String(tournamentId));
              const isShared = Boolean(tournamentId && String(tournamentId).includes('_'));
              const agendaFriend = friends.find((friend) => friend.uid === item.friend_uid) || {
                uid: item.friend_uid,
                username: item.friend_username,
                full_name: item.friend_name,
              };

              return (
                <div key={`${item.friend_uid}-${item.id}`} className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 900, color: '#0f172a' }}>{item.name || item.tournament_name || 'Torneo'}</div>
                      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        {item.course || 'Campo pendiente'} · {item.dates || 'Fecha pendiente'}
                      </div>
                    </div>
                    <div style={{ color: '#2563eb', fontWeight: 900 }}>@{item.friend_username}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '999px',
                      background: '#ecfdf5',
                      color: '#166534',
                      fontWeight: 900,
                      fontSize: '0.8rem',
                    }}>
                      Apuntada
                    </span>
                    {isMutual && (
                      <span style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '999px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontWeight: 900,
                        fontSize: '0.8rem',
                      }}>
                        También estás apuntada
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {tournamentId && (
                      <Link to={`/event/${tournamentId}`} style={{ textDecoration: 'none' }}>
                        <button type="button" className="btn card">
                          Ver torneo
                        </button>
                      </Link>
                    )}
                    {isShared && (
                      <Link to={`/leaderboard/${tournamentId}`} style={{ textDecoration: 'none' }}>
                        <button type="button" className="btn btn-primary">
                          Clasificación
                        </button>
                      </Link>
                    )}
                    {tournamentId && item.friend_username && (
                      <Link to={`/live/${item.friend_username}/${tournamentId}`} style={{ textDecoration: 'none' }}>
                        <button type="button" className="btn card">
                          Live
                        </button>
                      </Link>
                    )}
                    {agendaFriend?.uid && (
                      <button
                        type="button"
                        className="btn card"
                        onClick={() => handleOpenChat(
                          agendaFriend,
                          `Sobre ${item.name || item.tournament_name || 'este torneo'}: `
                        )}
                        disabled={isWorking}
                      >
                        <MessageCircle size={16} />
                        Chat
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
