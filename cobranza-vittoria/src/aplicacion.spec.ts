import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { SesionUsuario } from './core/sesion/sesion-usuario';
import { Aplicacion } from './aplicacion';

@Component({ selector: 'ruta-prueba', template: '<p>Ruta de prueba</p>' })
class RutaPrueba {}

describe('Aplicacion', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Aplicacion],
      providers: [
        provideRouter([
          { path: 'login', component: RutaPrueba },
          { path: 'dashboard', component: RutaPrueba },
        ]),
        provideHttpClient(),
      ],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  function raiz(fixture: { nativeElement: unknown }): HTMLElement {
    if (!(fixture.nativeElement instanceof HTMLElement)) throw new Error('Falta el contenedor');
    return fixture.nativeElement;
  }

  function boton(elemento: HTMLElement, selector: string): HTMLButtonElement {
    const control = elemento.querySelector(selector);
    if (!(control instanceof HTMLButtonElement)) throw new Error(`Falta ${selector}`);
    return control;
  }

  it('actualiza navegación y cierra el menú al entrar en login sin detección manual', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(700);
    const fixture = TestBed.createComponent(Aplicacion);
    await fixture.whenStable();
    const elemento = raiz(fixture);
    boton(elemento, '.menu-toggle').click();
    await fixture.whenStable();
    expect(elemento.querySelector('.app-shell--mobile-open')).not.toBeNull();

    await TestBed.inject(Router).navigateByUrl('/login?returnUrl=%2Fdashboard');
    await fixture.whenStable();
    expect(elemento.querySelector('.sidebar')).toBeNull();
    expect(elemento.querySelector('.topbar')).toBeNull();
    expect(elemento.querySelector('aviso-notificacion')).not.toBeNull();

    await TestBed.inject(Router).navigateByUrl('/dashboard');
    await fixture.whenStable();
    expect(elemento.querySelector('.sidebar')).not.toBeNull();
    expect(elemento.querySelector('.app-shell--mobile-open')).toBeNull();
  });

  it('abre el menú móvil, contiene sus controles al cerrarlo y restaura el foco con Escape', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(700);
    const fixture = TestBed.createComponent(Aplicacion);
    await fixture.whenStable();
    const elemento = raiz(fixture);
    const apertura = boton(elemento, '.menu-toggle');
    expect(elemento.querySelector('.sidebar')?.hasAttribute('inert')).toBe(true);
    expect(boton(elemento, '.sidebar-backdrop').tabIndex).toBe(-1);

    apertura.click();
    await fixture.whenStable();
    expect(apertura.getAttribute('aria-expanded')).toBe('true');
    expect(elemento.querySelector('.sidebar')?.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(elemento.querySelector('.sidebar__nav button'));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(apertura.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(apertura);
    expect(elemento.querySelector('.sidebar')?.hasAttribute('inert')).toBe(true);
  });

  it('conserva la contracción de escritorio y restablece el estado al cambiar de ancho', async () => {
    const ancho = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1200);
    const fixture = TestBed.createComponent(Aplicacion);
    await fixture.whenStable();
    const elemento = raiz(fixture);
    boton(elemento, '.sidebar-toggle').click();
    await fixture.whenStable();
    expect(elemento.querySelector('.app-shell--sidebar-collapsed')).not.toBeNull();

    ancho.mockReturnValue(700);
    window.dispatchEvent(new Event('resize'));
    await fixture.whenStable();
    expect(elemento.querySelector('.app-shell--sidebar-collapsed')).toBeNull();
    boton(elemento, '.menu-toggle').click();
    await fixture.whenStable();

    ancho.mockReturnValue(1200);
    window.dispatchEvent(new Event('resize'));
    await fixture.whenStable();
    expect(elemento.querySelector('.app-shell--mobile-open')).toBeNull();
    expect(elemento.querySelector('.sidebar')?.hasAttribute('inert')).toBe(false);
  });

  it('conserva las reglas de acceso del menú', async () => {
    const permitir = vi.spyOn(TestBed.inject(SesionUsuario), 'canAccess').mockReturnValue(false);
    const fixture = TestBed.createComponent(Aplicacion);
    await fixture.whenStable();
    const elemento = raiz(fixture);
    expect(elemento.textContent).not.toContain('Control de Acceso');

    permitir.mockReturnValue(true);
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    const control = Array.from(elemento.querySelectorAll('button')).find((control) =>
      control.textContent?.includes('Control de Acceso'),
    );
    expect(control).toBeDefined();
    control?.click();
    await fixture.whenStable();
    expect(elemento.querySelector('a[href="/control-accesos/usuarios"]')).not.toBeNull();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(Aplicacion);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(Aplicacion);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.topbar__title')?.textContent).toContain('Vittoria');
  });
  it('ubica los catálogos junto a las operaciones conservando todas sus rutas', async () => {
    const fixture = TestBed.createComponent(Aplicacion);
    fixture.detectChanges();
    const abrir = (titulo: string): void => {
      const botones: NodeListOf<HTMLButtonElement> =
        fixture.nativeElement.querySelectorAll('button');
      const boton = Array.from(botones).find((boton) => boton.textContent?.includes(titulo));
      if (!boton) throw new Error(`Falta el menú ${titulo}`);
      boton.click();
      fixture.detectChanges();
    };
    abrir('Operaciones');
    abrir('Gestión de obra');
    abrir('Gastos del proyecto');
    abrir('Inventario');
    await fixture.whenStable();
    const elemento: unknown = fixture.nativeElement;
    if (!(elemento instanceof HTMLElement)) throw new Error('No se creó la navegación.');
    expect(elemento.textContent).not.toContain('Mantenimiento');
    for (const ruta of [
      '/proyectos',
      '/especialidades',
      '/proveedores',
      '/materiales',
      '/unidades-medida',
      '/categorias-gasto',
      '/proveedores-gasto',
      '/proveedores-terreno',
    ]) {
      expect(elemento.querySelector(`a[href="${ruta}"]`)).not.toBeNull();
    }
    const inventario: Element | null =
      elemento.querySelector('a[href="/materiales"]')?.closest('.nav-section') ?? null;
    expect(inventario?.textContent).toContain('Inventario');
    const gastos: Element | null =
      elemento.querySelector('a[href="/categorias-gasto"]')?.closest('.nav-subsection') ?? null;
    expect(gastos?.textContent).toContain('Gastos del proyecto');
  });
  it('permite cerrar el menú móvil con un control nativo accesible', async () => {
    const fixture = TestBed.createComponent(Aplicacion);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(700);
    try {
      fixture.detectChanges();
      const apertura: HTMLButtonElement = fixture.nativeElement.querySelector('.menu-toggle');
      apertura.click();
      await fixture.whenStable();
      const raiz: unknown = fixture.nativeElement;
      if (!(raiz instanceof HTMLElement)) throw new Error('Falta el contenedor');
      const cierre = raiz.querySelector('.sidebar-backdrop');
      expect(cierre).toBeInstanceOf(HTMLButtonElement);
      if (!(cierre instanceof HTMLButtonElement)) throw new Error('Falta el botón de cierre');
      expect(cierre.getAttribute('aria-label')).toBe('Cerrar menú de navegación');
      cierre.click();
      await fixture.whenStable();
      expect(raiz.querySelector('.app-shell--mobile-open')).toBeNull();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
