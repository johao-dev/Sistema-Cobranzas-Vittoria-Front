import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NotificationComponent } from './shared/components/notification/notification.component';
import { TipoCambioComponent } from './shared/components/tipo-cambio/tipo-cambio.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NotificationComponent, TipoCambioComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  sidebarCollapsed = false;
  mobileMenuOpen = false;
  currentUrl = this.router.url;

  constructor() {
    this.router.events.pipe(filter(evt => evt instanceof NavigationEnd)).subscribe((evt: any) => {
      this.currentUrl = evt.urlAfterRedirects || evt.url || this.router.url;
      if (this.isLoginRoute()) {
        this.mobileMenuOpen = false;
      }
    });
  }

  isLoginRoute(): boolean {
    return (this.currentUrl || '').startsWith('/login');
  }

  get profileName(): string {
    return this.auth.session?.displayName || 'Administrador';
  }

  get profileRole(): string {
    return this.auth.session?.nombreRol || 'Perfil local';
  }

  get profileInitials(): string {
    return this.profileName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('') || 'AD';
  }

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  get isPresupuestoRoute(): boolean {
    return (this.currentUrl || '').startsWith('/presupuesto');
  }

  @HostListener('window:resize')
  onResize(): void {
    if (typeof window === 'undefined') return;
    if (window.innerWidth > 980) {
      this.mobileMenuOpen = false;
    } else {
      this.sidebarCollapsed = false;
    }
    this.cdr.detectChanges();
  }

  toggleSidebar(): void {
    if (this.isLoginRoute()) return;
    if (typeof window !== 'undefined' && window.innerWidth <= 980) {
      this.mobileMenuOpen = !this.mobileMenuOpen;
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    }
    this.cdr.detectChanges();
  }

  closeMobileMenu(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 980) {
      this.mobileMenuOpen = false;
      this.cdr.detectChanges();
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
