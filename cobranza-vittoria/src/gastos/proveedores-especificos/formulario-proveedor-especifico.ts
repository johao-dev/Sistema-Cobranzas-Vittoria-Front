import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, map, of, switchMap } from 'rxjs';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';
import { CategoriaGastoReferencia } from '../categorias/contratos-categorias-gasto';
import { EdicionProveedorEspecifico } from './datos-proveedor-especifico';

function vacio(): EdicionProveedorEspecifico {
  return {
    idCategoriaGasto: null,
    razonSocial: '',
    ruc: '',
    contacto: '',
    telefono: '',
    correo: '',
    activo: true,
  };
}

@Component({
  selector: 'formulario-proveedor-especifico',
  imports: [FormsModule],
  templateUrl: './formulario-proveedor-especifico.html',
  styleUrl: '../mantenimientos-gastos.css',
})
export class FormularioProveedorEspecifico {
  private readonly proveedores = inject(CatalogoProveedores);
  private readonly destroyRef = inject(DestroyRef);
  private readonly consultasRuc = new Subject<string>();

  readonly valor = input<EdicionProveedorEspecifico | null>(null);
  readonly categorias = input<CategoriaGastoReferencia[] | null>(null);
  readonly guardando = input(false);

  readonly guardar = output<EdicionProveedorEspecifico>();
  readonly limpiado = output<void>();

  protected readonly form = signal<EdicionProveedorEspecifico>(vacio());
  protected readonly error = signal('');
  protected readonly mensajeRuc = signal('');
  protected readonly buscandoRuc = signal(false);

  constructor() {
    effect(() => {
      const valor = this.valor();
      this.form.set(valor ? { ...valor } : vacio());
      this.error.set('');
    });
    this.consultasRuc
      .pipe(
        switchMap((ruc) => {
          this.buscandoRuc.set(true);
          this.mensajeRuc.set('');
          return this.proveedores.consultaRuc(ruc).pipe(
            map((datos) => ({ datos, ruc })),
            catchError(() => {
              this.mensajeRuc.set('Error al consultar el RUC. Verifique el número ingresado.');
              return of(null);
            }),
            finalize(() => this.buscandoRuc.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        if (!resultado || this.form().ruc.trim() !== resultado.ruc || this.guardando()) return;
        if (!resultado.datos.numero_documento) {
          this.mensajeRuc.set('No se encontraron datos para el RUC ingresado.');
          return;
        }
        this.form.update((form) => ({
          ...form,
          razonSocial: resultado.datos.razon_social,
          activo: resultado.datos.estado === 'ACTIVO',
        }));
        this.mensajeRuc.set('Datos recuperados de SUNAT correctamente.');
      });
  }

  protected buscarRuc(): void {
    const ruc = this.form().ruc.trim();
    if (!/^\d{11}$/.test(ruc) || this.guardando()) return;
    this.consultasRuc.next(ruc);
  }

  protected limpiar(): void {
    if (this.guardando()) return;

    this.form.set(vacio());
    this.error.set('');
    this.mensajeRuc.set('');
    this.limpiado.emit();
  }

  protected enviar(): void {
    if (this.guardando()) return;

    const datos = this.form();
    if (this.categorias() !== null && !datos.idCategoriaGasto) {
      this.error.set('Selecciona la categoría del proveedor de gasto.');
      return;
    }
    if (!datos.razonSocial.trim()) {
      this.error.set('Ingresa la razón social del proveedor.');
      return;
    }
    this.error.set('');
    this.guardar.emit({
      ...datos,
      razonSocial: datos.razonSocial.trim(),
      ruc: datos.ruc.trim(),
      contacto: datos.contacto.trim(),
      telefono: datos.telefono.trim(),
      correo: datos.correo.trim(),
    });
  }
}
