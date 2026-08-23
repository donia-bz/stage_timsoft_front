import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Notification } from '../../services/api.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit, OnDestroy {
  showMenu: boolean = false;
  showNotifications: boolean = false;
  unreadCount: number = 0;
  notifications: Notification[] = [];
  
  private unreadCountSubscription: Subscription | null = null;
  private newNotificationSubscription: Subscription | null = null;

  constructor(
    public authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.loadNotifications();
      this.subscribeToNotifications();
    }
  }

  ngOnDestroy(): void {
    this.unreadCountSubscription?.unsubscribe();
    this.newNotificationSubscription?.unsubscribe();
  }

  loadNotifications(): void {
    this.notificationService.loadUnreadNotifications();
    this.notificationService.loadNotifications();
    
    this.unreadCountSubscription = this.notificationService.unreadCount$.subscribe(count => {
      this.unreadCount = count;
    });
    
    this.notificationService.notifications$.subscribe(notifications => {
      this.notifications = notifications.slice(0, 10); // Show last 10 notifications
    });
  }

  subscribeToNotifications(): void {
    this.newNotificationSubscription = this.notificationService.newNotification$.subscribe(notification => {
      this.unreadCount = this.notificationService.getUnreadCount();
    });
  }

  toggleMenu(): void {
    this.showMenu = !this.showMenu;
    this.showNotifications = false;
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    this.showMenu = false;
  }

  closeMenu(): void {
    this.showMenu = false;
    this.showNotifications = false;
  }

  markAsRead(notificationId: string): void {
    this.notificationService.markAsRead(notificationId);
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
