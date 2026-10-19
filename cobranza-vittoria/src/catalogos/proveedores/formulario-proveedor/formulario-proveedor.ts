import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Subject, switchMap, catchError, EMPTY } from 'rxjs';
import { Proveedor, ProveedorUpsert } from '../contratos-proveedores';
import { CatalogoProveedores } from '../catalogo-proveedores';
import { mensajeCatalogo } from '../../mensaje-catalogo';

@Component({
  selector: 'formulario-proveedor',
  imports: [ReactiveFormsModule],
  templateUrl: './formulario-proveedor.html',
  styleUrl: './formulario-proveedor.css',
})
export class FormularioProveedor {
  readonly valor = input<Proveedor | null>(null);
  readonly guardando = input(false);
  readonly bloqueado = input(false);
  readonly guardar = output<ProveedorUpsert>();
  private readonly fb: FormBuilder = inject(FormBuilder);
  private readonly api: CatalogoProveedores = inject(CatalogoProveedores);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly consultas: Subject<string> = new Subject<string>();
  private idProveedor: number | null = null;
  protected readonly consultando = signal(false);
  protected readonly mensaje = signal('');
  protected readonly form = this.fb.nonNullable.group({
    razonSocial: ['', Validators.required],
    ruc: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    contacto: [''],
    telefono: [''],
    correo: ['', Validators.email],
    direccion: [''],
    banco: [''],
    cuentaCorriente: [''],
    cci: [''],
    cuentaDetraccion: [''],
    descripcionServicio: [''],
    observacion: [''],
    trabajamosConProveedor: ['SI'],
    activo: [true],
  });

  constructor() {
    effect(() => {
      const valor: Proveedor | null = this.valor();
      this.idProveedor = valor?.idProveedor ?? null;
      this.form.reset({
        razonSocial: valor?.razonSocial ?? '',
        ruc: valor?.ruc ?? '',
        contacto: valor?.contacto ?? '',
        telefono: valor?.telefono ?? '',
        correo: valor?.correo ?? '',
        direccion: valor?.direccion ?? '',
        banco: valor?.banco ?? '',
        cuentaCorriente: valor?.cuentaCorriente ?? '',
        cci: valor?.cci ?? '',
        cuentaDetraccion: valor?.cuentaDetraccion ?? '',
        descripcionServicio: valor?.descripcionServicio ?? '',
        observacion: valor?.observacion ?? '',
        trabajamosConProveedor: valor?.trabajamosConProveedor ?? 'SI',
        activo: valor?.activo ?? true,
      });
      this.mensaje.set('');
    });
    this.consultas
      .pipe(
        switchMap((ruc: string) => {
          this.consultando.set(true);
          return this.api.consultaRuc(ruc).pipe(
            finalize(() => this.consultando.set(false)),
            catchError((error: unknown) => {
              this.mensaje.set(mensajeCatalogo(error, 'No se pudo consultar el RUC.'));
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((datos) => {
        // Una respuesta de otro RUC nunca debe sobrescribir el formulario actual.
        if (datos.numero_documento !== this.form.controls.ruc.value.trim()) return;
        this.form.patchValue({
          razonSocial: datos.razon_social,
          direccion: datos.direccion === '-' ? '' : datos.direccion,
          activo: datos.estado === 'ACTIVO',
        });
        this.mensaje.set('Datos recuperados de SUNAT correctamente.');
      });
  }

  protected buscarRuc(): void {
    if (this.bloqueado() || this.guardando() || this.form.controls.ruc.invalid) return;
    this.consultas.next(this.form.controls.ruc.value.trim());
  }

  protected limpiar(): void {
    this.idProveedor = null;
    this.form.reset();
    this.mensaje.set('');
  }

  protected enviar(): void {
    if (this.guardando() || this.bloqueado() || this.consultando()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.controls.razonSocial.value.trim()) {
      this.mensaje.set('Revisa la razón social, el RUC de 11 dígitos y el correo.');
      return;
    }
    const datos = this.form.getRawValue();
    this.guardar.emit({
      ...datos,
      idProveedor: this.idProveedor,
      razonSocial: datos.razonSocial.trim(),
      ruc: datos.ruc.trim(),
    });
  }
}
