import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, finalize, of, switchMap, takeUntil, tap } from 'rxjs';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';
import { Proveedor, ProveedorUpsert } from '../../catalogos/proveedores/contratos-proveedores';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { mensajeOrden } from '../mensaje-orden';

export interface ProveedorOrdenCreado {
  idProveedor: number;
  proveedores: Proveedor[];
}

@Component({
  selector: 'nuevo-proveedor-orden',
  imports: [ReactiveFormsModule, DialogoModal],
  templateUrl: './nuevo-proveedor-orden.html',
  styleUrl: '../presentacion-ordenes.css',
})
export class NuevoProveedorOrden {
  readonly cerrar = output<void>();
  readonly guardado = output<ProveedorOrdenCreado>();

  private readonly catalogo = inject(CatalogoProveedores);
  private readonly destroyRef = inject(DestroyRef);
  private readonly consultasRuc = new Subject<string>();

  protected readonly formulario = new FormGroup({
    razonSocial: new FormControl('', { nonNullable: true }),
    ruc: new FormControl('', { nonNullable: true }),
    contacto: new FormControl('', { nonNullable: true }),
    telefono: new FormControl('', { nonNullable: true }),
    correo: new FormControl('', { nonNullable: true }),
    direccion: new FormControl('', { nonNullable: true }),
    activo: new FormControl(true, { nonNullable: true }),
  });
  protected readonly guardando = signal(false);
  protected readonly buscandoRuc = signal(false);
  protected readonly idCreado = signal<number | null>(null);
  protected readonly mensaje = signal('');

  constructor() {
    this.consultasRuc
      .pipe(
        switchMap((ruc) =>
          this.catalogo.consultaRuc(ruc).pipe(
            takeUntil(this.formulario.controls.ruc.valueChanges),
            tap((respuesta) => {
              if (this.formulario.controls.ruc.value.trim() !== ruc) return;

              if (!respuesta.numero_documento) {
                this.mensaje.set('No se encontraron datos para el RUC ingresado.');
                return;
              }

              this.formulario.patchValue({
                razonSocial: respuesta.razon_social || '',
                direccion: respuesta.direccion === '-' ? '' : respuesta.direccion,
                activo: respuesta.estado === 'ACTIVO',
              });

              this.mensaje.set('Datos recuperados de SUNAT correctamente.');
            }),
            catchError(() => {
              this.mensaje.set('Error al consultar el RUC. Verifique el número ingresado.');
              return EMPTY;
            }),
            finalize(() => this.buscandoRuc.set(false)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected buscarRuc(): void {
    const ruc = this.formulario.controls.ruc.value.trim();

    if (ruc.length !== 11 || this.buscandoRuc() || this.guardando() || this.idCreado()) return;

    this.buscandoRuc.set(true);
    this.consultasRuc.next(ruc);
  }

  protected solicitarCierre(): void {
    if (this.guardando()) return;

    this.cerrar.emit();
  }

  protected guardar(): void {
    if (this.guardando() || this.buscandoRuc()) return;

    const datos = this.formulario.getRawValue();

    if (!datos.razonSocial.trim()) {
      this.mensaje.set('Ingresa la razón social del proveedor.');
      return;
    }

    const dto: ProveedorUpsert = {
      ...datos,
      idProveedor: null,
      banco: '',
      cuentaCorriente: '',
      cci: '',
      cuentaDetraccion: '',
      descripcionServicio: '',
      observacion: '',
      trabajamosConProveedor: 'SI',
    };
    const idCreado = this.idCreado();
    const operacion = idCreado
      ? of({ idProveedor: idCreado })
      : this.catalogo.guardarProveedor(dto);

    this.guardando.set(true);
    this.formulario.disable();
    this.mensaje.set('');

    operacion
      .pipe(
        tap((respuesta) => this.idCreado.set(respuesta.idProveedor)),
        switchMap((respuesta) =>
          this.catalogo
            .proveedores(true)
            .pipe(
              tap((proveedores) =>
                this.guardado.emit({ idProveedor: respuesta.idProveedor, proveedores }),
              ),
            ),
        ),
        finalize(() => {
          this.guardando.set(false);

          if (!this.idCreado()) this.formulario.enable();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (error) =>
          this.mensaje.set(
            this.idCreado()
              ? 'Proveedor creado. No se pudo actualizar el catálogo. Reintenta para recuperarlo sin volver a crearlo.'
              : mensajeOrden(error, 'No se pudo crear el proveedor.'),
          ),
      });
  }
}
