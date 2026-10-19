import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.topbar__title')?.textContent).toContain('Vittoria');
  });
  it('ubica los catálogos junto a las operaciones conservando todas sus rutas', async () => {
    const fixture = TestBed.createComponent(App);
    const app: App = fixture.componentInstance;
    app.openMenus['operaciones'] = true;
    app.openMenus['gestionObra'] = true;
    app.openMenus['gastosProyecto'] = true;
    app.openMenus['inventario'] = true;
    fixture.detectChanges();
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
});
