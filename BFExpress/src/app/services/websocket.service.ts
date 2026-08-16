import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: Socket | null = null;
  private reclamationUpdates = new Subject<any>();

  constructor() {}

  connect(clientId: string): void {
    if (this.socket) {
      return;
    }

    console.log('🔌 Connexion WebSocket pour client:', clientId);

    this.socket = io('http://localhost:8086', {
      query: { clientId },
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connecté');
    });

    this.socket.on('reclamation_update', (data: any) => {
      console.log('📩 Mise à jour réclamation reçue:', data);
      this.reclamationUpdates.next(data);
    });

    this.socket.on('new_response', (data: any) => {
      console.log('💬 Nouvelle réponse reçue:', data);
      this.reclamationUpdates.next({ type: 'NEW_RESPONSE', ...data });
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 WebSocket déconnecté');
    });

    this.socket.on('error', (err: any) => {
      console.error('❌ Erreur WebSocket:', err);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getReclamationUpdates() {
    return this.reclamationUpdates.asObservable();
  }
}
