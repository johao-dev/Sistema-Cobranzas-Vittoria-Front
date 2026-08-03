# CobranzaVittoria

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.0.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Desarrollo con Docker

En la raiz del repositorio se agregaron `Dockerfile`, `compose.yml` y `.dockerignore` para levantar el frontend sin instalar Node.js ni dependencias en el host.

### Levantar el proyecto

Desde la raiz del repositorio:

```bash
docker compose up -d app
```

La aplicacion quedara disponible en `http://localhost:4200`.

Si cambias `Dockerfile` o `compose.yml`, reconstruye con:

```bash
docker compose up -d --build app
```

### Entrar al contenedor

```bash
docker compose exec app bash
```

Dentro del contenedor puedes ejecutar comandos como:

```bash
npm run build
npm test -- --watch=false
```

### Ejecutar tests en un contenedor efimero

```bash
docker compose --profile test run --rm test
```

### Notas

- El codigo fuente se monta como volumen, asi que los cambios en el host disparan recarga en caliente.
- `node_modules` se guarda en un volumen Docker para no contaminar el host.
- El frontend sigue usando `http://localhost:5000` como API en desarrollo, asi que tu backend debe exponer ese puerto en la maquina host.
- Si una prueba anterior dejo `cobranza-vittoria/node_modules` como `root` en el host, puedes corregirlo con `sudo chown -R $USER:$USER cobranza-vittoria/node_modules` o eliminar esa carpeta si no la usas fuera de Docker.
