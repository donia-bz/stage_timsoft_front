import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebsocketSyncService {
  private livreursSocket: Socket | null = null;
  private vehiclesSocket: Socket | null = null;
  private trackingSocket: Socket | null = null;

  constructor() {
    this.initializeConnections();
  }

  private initializeConnections(): void {
    console.log('🔌 Initialisation des connexions WebSocket...');
    console.log('🔌 Livreurs URL:', environment.livreursWsUrl);
    console.log('🔌 Véhicules URL:', environment.vehiclesWsUrl);
    console.log('🔌 Tracking URL:', environment.trackingWsUrl);

    // Connexion au service livreurs
    this.livreursSocket = io(environment.livreursWsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.livreursSocket.on('connect', () => {
      console.log('✅ Connecté au service livreurs WebSocket');
      this.livreursSocket?.emit('subscribe-livreurs');
      this.livreursSocket?.emit('subscribe-admin-updates');
    });

    this.livreursSocket.on('disconnect', () => {
      console.log('❌ Déconnecté du service livreurs WebSocket');
    });

    // Connexion au service véhicules
    this.vehiclesSocket = io(environment.vehiclesWsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.vehiclesSocket.on('connect', () => {
      console.log('✅ Connecté au service véhicules WebSocket');
      this.vehiclesSocket?.emit('subscribe-vehicules');
      this.vehiclesSocket?.emit('subscribe-admin-updates');
    });

    this.vehiclesSocket.on('disconnect', () => {
      console.log('❌ Déconnecté du service véhicules WebSocket');
    });

    // Connexion au service tracking (déjà existant)
    this.trackingSocket = io(environment.trackingWsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.trackingSocket.on('connect', () => {
      console.log('✅ Connecté au service tracking WebSocket');
      this.trackingSocket?.emit('subscribe-positions');
      this.trackingSocket?.emit('subscribe-admin-notifications');
    });

    this.trackingSocket.on('disconnect', () => {
      console.log('❌ Déconnecté du service tracking WebSocket');
    });
  }

  // ========== LIVREURS EVENTS ==========
  onLivreurUpdate(callback: (data: any) => void): void {
    this.livreursSocket?.on('livreur-updated', callback);
  }

  onInitialLivreurs(callback: (livreurs: any[]) => void): void {
    this.livreursSocket?.on('initial-livreurs', callback);
  }

  subscribeToLivreur(livreurId: string): void {
    this.livreursSocket?.emit('subscribe-livreur', livreurId);
  }

  // ========== VÉHICULES EVENTS ==========
  onVehiculeUpdate(callback: (data: any) => void): void {
    this.vehiclesSocket?.on('vehicule-updated', callback);
  }

  onInitialVehicules(callback: (vehicules: any[]) => void): void {
    this.vehiclesSocket?.on('initial-vehicules', callback);
  }

  subscribeToVehicule(vehiculeId: string): void {
    this.vehiclesSocket?.emit('subscribe-vehicule', vehiculeId);
  }

  subscribeToLivreurVehicules(livreurId: string): void {
    this.vehiclesSocket?.emit('subscribe-livreur-vehicules', livreurId);
  }

  // ========== TRACKING EVENTS ==========
  onPositionUpdate(callback: (data: any) => void): void {
    this.trackingSocket?.on('position-updated', callback);
  }

  onInitialPositions(callback: (positions: any[]) => void): void {
    this.trackingSocket?.on('initial-positions', callback);
  }

  onManifestUpdate(callback: (data: any) => void): void {
    this.trackingSocket?.on('manifest-status-update', callback);
  }

  onManifestCreated(callback: (data: any) => void): void {
    this.trackingSocket?.on('manifest-created', callback);
  }

  // ========== UTILS ==========
  disconnectAll(): void {
    this.livreursSocket?.disconnect();
    this.vehiclesSocket?.disconnect();
    this.trackingSocket?.disconnect();
  }

  isConnected(): boolean {
    return !!(this.livreursSocket?.connected && 
             this.vehiclesSocket?.connected && 
             this.trackingSocket?.connected);
  }
}