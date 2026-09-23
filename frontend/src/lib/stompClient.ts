import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { DrawEvent, ServerMessage, GameStateDto } from '../types/game';

let stompClient: Client | null = null;

export function createStompClient(
  onConnect: () => void,
  onDisconnect: () => void
): Client {
  const client = new Client({
    webSocketFactory: () => new SockJS('/ws'),
    reconnectDelay: 3000,
    onConnect: () => {
      console.log('STOMP connected');
      onConnect();
    },
    onDisconnect: () => {
      console.log('STOMP disconnected');
      onDisconnect();
    },
    onStompError: (frame) => {
      console.error('STOMP error:', frame);
    },
  });

  stompClient = client;
  return client;
}

export function getClient(): Client | null {
  return stompClient;
}

// ── Subscriptions ───────────────────────────────────────────

export function subscribeToGameState(
  client: Client,
  roomCode: string,
  handler: (state: GameStateDto) => void
) {
  return client.subscribe(`/topic/room/${roomCode}/state`, (msg) => {
    handler(JSON.parse(msg.body));
  });
}

export function subscribeToChat(
  client: Client,
  roomCode: string,
  handler: (msg: ServerMessage) => void
) {
  return client.subscribe(`/topic/room/${roomCode}/chat`, (msg) => {
    handler(JSON.parse(msg.body));
  });
}

export function subscribeToDraw(
  client: Client,
  roomCode: string,
  handler: (event: DrawEvent) => void
) {
  return client.subscribe(`/topic/room/${roomCode}/draw`, (msg) => {
    handler(JSON.parse(msg.body));
  });
}

export function subscribeToWordChoices(
  client: Client,
  roomCode: string,
  playerId: string,
  handler: (words: string[]) => void
) {
  return client.subscribe(`/topic/room/${roomCode}/word-choices/${playerId}`, (msg) => {
    handler(JSON.parse(msg.body));
  });
}

// ── Publishers ───────────────────────────────────────────

export function sendStartGame(client: Client, roomCode: string, playerId: string) {
  client.publish({
    destination: `/app/room/${roomCode}/start`,
    body: JSON.stringify({ playerId }),
  });
}

export function sendWordSelection(client: Client, roomCode: string, playerId: string, word: string) {
  client.publish({
    destination: `/app/room/${roomCode}/select-word`,
    body: JSON.stringify({ playerId, selectedWord: word }),
  });
}

export function sendGuess(client: Client, roomCode: string, playerId: string, content: string) {
  client.publish({
    destination: `/app/room/${roomCode}/guess`,
    body: JSON.stringify({ playerId, content }),
  });
}

export function sendDrawEvent(
  client: Client,
  roomCode: string,
  playerId: string,
  event: DrawEvent
) {
  client.publish({
    destination: `/app/room/${roomCode}/draw`,
    body: JSON.stringify({ playerId, event }),
  });
}

export function sendLeave(client: Client, roomCode: string, playerId: string) {
  client.publish({
    destination: `/app/room/${roomCode}/leave`,
    body: JSON.stringify({ playerId }),
  });
}
