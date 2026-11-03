import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AvisoNotificacion } from './shared/notificaciones/aviso-notificacion/aviso-notificacion';
import { SesionUsuario } from './core/sesion/sesion-usuario';
import { ACCESS_RULES } from './reglas-acceso';
import { AccessRule } from './core/sesion/contratos-sesion';

@Component({
  selector: 'vittoria-aplicacion',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AvisoNotificacion],
  templateUrl: './aplicacion.html',
  styleUrl: './aplicacion.css',
  host: { '(window:resize)': 'onResize()', '(window:keydown.escape)': 'closeMobileMenu()' },
})
export class Aplicacion {
  private readonly router = inject(Router);
  private readonly auth = inject(SesionUsuario);
  private readonly injector = inject(Injector);
  private readonly menuPrincipal = viewChild<ElementRef<HTMLElement>>('menuPrincipal');
  private readonly botonMenu = viewChild<ElementRef<HTMLButtonElement>>('botonMenu');

  protected readonly accessRules = ACCESS_RULES;

  protected readonly sidebarCollapsed = signal(false);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly pantallaMovil = signal(
    typeof window !== 'undefined' && window.innerWidth <= 980,
  );
  private readonly currentUrl = signal(this.router.url);
  private readonly openMenus = signal<Record<string, boolean>>({
    general: true,
    operaciones: false,
    gestionObra: false,
    gastosProyecto: false,
    inventario: false,
    controlPresupuestario: false,
    controlAccesos: false,
  });

  protected readonly isLoginRoute = computed(() => this.currentUrl().startsWith('/login'));
  protected readonly profileName = computed(
    () => this.auth.session?.usuarioLogin || this.auth.session?.correo || 'Usuario',
  );
  protected readonly profileRole = computed(() => this.auth.session?.roles.join(', ') || 'Sin rol');
  protected readonly profileInitials = computed(
    () =>
      this.profileName()
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'AD',
  );
  protected readonly isAuthenticated = computed(() => this.auth.isAuthenticated());

  constructor() {
    this.router.events
      .pipe(
        filter((evt): evt is NavigationEnd => evt instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((evt) => {
        this.currentUrl.set(evt.urlAfterRedirects || evt.url || this.router.url);
        if (this.isLoginRoute()) {
          this.mobileMenuOpen.set(false);
        }
      });
  }

  protected canAccess(rule?: AccessRule): boolean {
    return this.auth.canAccess(rule);
  }

  protected onResize(): void {
    if (typeof window === 'undefined') return;

    this.pantallaMovil.set(window.innerWidth <= 980);
    if (window.innerWidth > 980) {
      this.mobileMenuOpen.set(false);
    } else {
      this.sidebarCollapsed.set(false);
    }
  }

  protected toggleSidebar(): void {
    if (this.isLoginRoute()) return;

    if (typeof window !== 'undefined' && window.innerWidth <= 980) {
      this.mobileMenuOpen.update((abierto) => !abierto);
      if (this.mobileMenuOpen()) {
        afterNextRender(
          () => {
            if (this.mobileMenuOpen()) {
              this.menuPrincipal()
                ?.nativeElement.querySelector<HTMLElement>('.sidebar__nav button, .sidebar__nav a')
                ?.focus();
            }
          },
          { injector: this.injector },
        );
      } else {
        this.botonMenu()?.nativeElement.focus();
      }
    } else {
      this.sidebarCollapsed.update((contraido) => !contraido);
    }
  }

  protected toggleMenu(key: string): void {
    if (this.sidebarCollapsed()) return;

    this.openMenus.update((menus) => ({ ...menus, [key]: !menus[key] }));
  }

  protected isMenuOpen(key: string): boolean {
    return !!this.openMenus()[key] && !this.sidebarCollapsed();
  }

  protected closeMobileMenu(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 980) {
      const estabaAbierto = this.mobileMenuOpen();
      this.mobileMenuOpen.set(false);
      if (estabaAbierto) this.botonMenu()?.nativeElement.focus();
    }
  }

  protected logout(): void {
    this.auth.logout();
  }
}
