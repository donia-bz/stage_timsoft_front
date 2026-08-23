import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ApiService, Notification } from './api.service';
import { AuthService } from './auth.service';
import { WebsocketSyncService } from './websocket-sync.service';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications: Notification[] = [];
  private unreadCount = 0;
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  private newNotificationSubject = new Subject<Notification>();
  private notificationSocket: Socket | null = null;

  notifications$ = this.notificationsSubject.asObservable();
  unreadCount$ = this.unreadCountSubject.asObservable();
  newNotification$ = this.newNotificationSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private websocketService: WebsocketSyncService
  ) {
    this.initializeWebSocketConnection();
  }

  private initializeWebSocketConnection(): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    this.notificationSocket = io(environment.trackingWsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.notificationSocket.on('connect', () => {
      console.log('✅ Connecté au service notifications WebSocket');
      this.notificationSocket?.emit('subscribe-notifications', { userId: user.id, role: this.authService.getRole() });
    });

    this.notificationSocket.on('notification:new', (notification: Notification) => {
      this.handleNewNotification(notification);
    });

    this.notificationSocket.on('notification:read', (notificationId: string) => {
      this.handleNotificationRead(notificationId);
    });

    this.notificationSocket.on('disconnect', () => {
      console.log('❌ Déconnecté du service notifications WebSocket');
    });
  }

  loadNotifications(): void {
    const user = this.authService.getCurrentUser();
    if (!user || !user.id) return;

    this.apiService.getNotifications(user.id, this.authService.getRole() || 'CLIENT').subscribe({
      next: (notifications) => {
        this.notifications = notifications.sort((a, b) => 
          new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
        );
        this.updateUnreadCount();
        this.notificationsSubject.next(this.notifications);
      },
      error: (err) => {
        console.error('Erreur chargement notifications:', err);
      }
    });
  }

  loadUnreadNotifications(): void {
    const user = this.authService.getCurrentUser();
    if (!user || !user.id) return;

    this.apiService.getUnreadNotifications(user.id, this.authService.getRole() || 'CLIENT').subscribe({
      next: (notifications) => {
        this.unreadCount = notifications.length;
        this.unreadCountSubject.next(this.unreadCount);
      },
      error: (err) => {
        console.error('Erreur chargement notifications non lues:', err);
      }
    });
  }

  markAsRead(notificationId: string): void {
    this.apiService.markNotificationAsRead(notificationId).subscribe({
      next: () => {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.read = true;
          this.updateUnreadCount();
          this.notificationsSubject.next([...this.notifications]);
        }
      },
      error: (err) => {
        console.error('Erreur marquer notification lue:', err);
      }
    });
  }

  markAllAsRead(): void {
    const user = this.authService.getCurrentUser();
    if (!user || !user.id) return;

    this.apiService.markAllNotificationsAsRead(user.id, this.authService.getRole() || 'CLIENT').subscribe({
      next: () => {
        this.notifications.forEach(n => n.read = true);
        this.updateUnreadCount();
        this.notificationsSubject.next([...this.notifications]);
      },
      error: (err) => {
        console.error('Erreur marquer toutes notifications lues:', err);
      }
    });
  }

  deleteNotification(notificationId: string): void {
    this.apiService.deleteNotification(notificationId).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.updateUnreadCount();
        this.notificationsSubject.next([...this.notifications]);
      },
      error: (err) => {
        console.error('Erreur supprimer notification:', err);
      }
    });
  }

  private handleNewNotification(notification: Notification): void {
    this.notifications.unshift(notification);
    if (!notification.read) {
      this.unreadCount++;
      this.unreadCountSubject.next(this.unreadCount);
    }
    this.notificationsSubject.next([...this.notifications]);
    this.newNotificationSubject.next(notification);
  }

  private handleNotificationRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.updateUnreadCount();
      this.notificationsSubject.next([...this.notifications]);
    }
  }

  private updateUnreadCount(): void {
    this.unreadCount = this.notifications.filter(n => !n.read).length;
    this.unreadCountSubject.next(this.unreadCount);
  }

  getNotificationsByType(type: string): Notification[] {
    return this.notifications.filter(n => n.type === type);
  }

  getUnreadCount(): number {
    return this.unreadCount;
  }

  getAllNotifications(): Notification[] {
    return [...this.notifications];
  }
}
