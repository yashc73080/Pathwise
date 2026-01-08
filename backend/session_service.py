"""
Session Service for managing chat sessions with Firestore.
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime


class SessionService(ABC):
    """Abstract base class for session management."""
    
    @abstractmethod
    def create_session(self, user_id: str, session_id: str, metadata: Dict = None) -> str:
        """Create a new session. Returns session_id."""
        pass
    
    @abstractmethod
    def get_session(self, user_id: str, session_id: str) -> Optional[Dict]:
        """Get session metadata."""
        pass
    
    @abstractmethod
    def list_sessions(self, user_id: str) -> List[Dict]:
        """List all sessions for a user."""
        pass
    
    @abstractmethod
    def add_message(self, user_id: str, session_id: str, role: str, content: str):
        """Add a message to a session."""
        pass
    
    @abstractmethod
    def get_messages(self, user_id: str, session_id: str) -> List[Dict]:
        """Get all messages from a session."""
        pass
    
    @abstractmethod
    def update_session(self, user_id: str, session_id: str, metadata: Dict):
        """Update session metadata."""
        pass


class InMemorySessionService(SessionService):
    """In-memory session storage (for development/testing)."""
    
    def __init__(self):
        self._sessions: Dict[str, Dict] = {}  # {user_id: {session_id: {messages: [], metadata: {}}}}
    
    def _get_user_sessions(self, user_id: str) -> Dict:
        if user_id not in self._sessions:
            self._sessions[user_id] = {}
        return self._sessions[user_id]
    
    def create_session(self, user_id: str, session_id: str, metadata: Dict = None) -> str:
        user_sessions = self._get_user_sessions(user_id)
        user_sessions[session_id] = {
            'messages': [],
            'metadata': metadata or {},
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        return session_id
    
    def get_session(self, user_id: str, session_id: str) -> Optional[Dict]:
        user_sessions = self._get_user_sessions(user_id)
        return user_sessions.get(session_id)
    
    def list_sessions(self, user_id: str) -> List[Dict]:
        user_sessions = self._get_user_sessions(user_id)
        sessions = []
        for sid, data in user_sessions.items():
            messages = data.get('messages', [])
            last_message = messages[-1]['content'] if messages else ''
            sessions.append({
                'id': sid,
                'lastMessage': last_message[:100] if last_message else '',
                'timestamp': data.get('updated_at'),
                'locations': data.get('metadata', {}).get('locations')
            })
        # Sort by updated_at descending
        sessions.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return sessions
    
    def add_message(self, user_id: str, session_id: str, role: str, content: str):
        user_sessions = self._get_user_sessions(user_id)
        if session_id not in user_sessions:
            self.create_session(user_id, session_id)
        
        user_sessions[session_id]['messages'].append({
            'role': role,
            'content': content,
            'timestamp': datetime.now().isoformat()
        })
        user_sessions[session_id]['updated_at'] = datetime.now().isoformat()
    
    def get_messages(self, user_id: str, session_id: str) -> List[Dict]:
        session = self.get_session(user_id, session_id)
        if session:
            return session.get('messages', [])
        return []
    
    def update_session(self, user_id: str, session_id: str, metadata: Dict):
        user_sessions = self._get_user_sessions(user_id)
        if session_id in user_sessions:
            user_sessions[session_id]['metadata'].update(metadata)
            user_sessions[session_id]['updated_at'] = datetime.now().isoformat()


class FirestoreSessionService(SessionService):
    """Firestore-based session storage."""
    
    def __init__(self, db):
        self.db = db
    
    def _get_session_ref(self, user_id: str, session_id: str):
        return self.db.collection('users').document(user_id).collection('chats').document(session_id)
    
    def _get_messages_ref(self, user_id: str, session_id: str):
        return self._get_session_ref(user_id, session_id).collection('messages')
    
    def create_session(self, user_id: str, session_id: str, metadata: Dict = None) -> str:
        from google.cloud.firestore_v1 import SERVER_TIMESTAMP
        
        session_ref = self._get_session_ref(user_id, session_id)
        session_ref.set({
            'createdAt': SERVER_TIMESTAMP,
            'lastUpdated': SERVER_TIMESTAMP,
            **(metadata or {})
        })
        return session_id
    
    def get_session(self, user_id: str, session_id: str) -> Optional[Dict]:
        session_ref = self._get_session_ref(user_id, session_id)
        doc = session_ref.get()
        if doc.exists:
            return {'id': doc.id, **doc.to_dict()}
        return None
    
    def list_sessions(self, user_id: str) -> List[Dict]:
        from google.cloud.firestore_v1 import Query
        
        chats_ref = self.db.collection('users').document(user_id).collection('chats')
        docs = chats_ref.order_by('lastUpdated', direction=Query.DESCENDING).stream()
        
        sessions = []
        for doc in docs:
            data = doc.to_dict()
            sessions.append({
                'id': doc.id,
                'lastMessage': data.get('lastMessage', ''),
                'timestamp': data.get('lastUpdated'),
                'locations': data.get('locations')
            })
        return sessions
    
    def add_message(self, user_id: str, session_id: str, role: str, content: str):
        from google.cloud.firestore_v1 import SERVER_TIMESTAMP
        
        # Ensure session exists
        session_ref = self._get_session_ref(user_id, session_id)
        if not session_ref.get().exists:
            self.create_session(user_id, session_id)
        
        # Add the message
        messages_ref = self._get_messages_ref(user_id, session_id)
        messages_ref.add({
            'role': role,
            'content': content,
            'timestamp': SERVER_TIMESTAMP
        })
        
        # Update session metadata
        session_ref.update({
            'lastMessage': content[:200] if role == 'assistant' else session_ref.get().to_dict().get('lastMessage', ''),
            'lastUpdated': SERVER_TIMESTAMP
        })
    
    def get_messages(self, user_id: str, session_id: str) -> List[Dict]:
        from google.cloud.firestore_v1 import Query
        
        messages_ref = self._get_messages_ref(user_id, session_id)
        docs = messages_ref.order_by('timestamp', direction=Query.ASCENDING).stream()
        
        messages = []
        for doc in docs:
            data = doc.to_dict()
            messages.append({
                'role': data.get('role'),
                'content': data.get('content')
            })
        return messages
    
    def update_session(self, user_id: str, session_id: str, metadata: Dict):
        from google.cloud.firestore_v1 import SERVER_TIMESTAMP
        
        session_ref = self._get_session_ref(user_id, session_id)
        session_ref.set({
            **metadata,
            'lastUpdated': SERVER_TIMESTAMP
        }, merge=True)
