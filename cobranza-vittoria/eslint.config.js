// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

const reglasTypeScript = defineConfig([
  eslint.configs.recommended,
  tseslint.configs.recommended,
  angular.configs.tsRecommended,
]);
const reglasPlantillas = defineConfig([
  angular.configs.templateRecommended,
  angular.configs.templateAccessibility,
]);

/**
 * La deuda de src/app sigue visible hasta migrar cada concepto. Fuera de esa
 * carpeta se mantienen los errores de los mismos conjuntos recomendados.
 * @param {ReturnType<typeof defineConfig>} configuraciones
 * @returns {import('eslint').Linter.RulesRecord}
 */
function comoAdvertencias(configuraciones) {
  /** @type {import('eslint').Linter.RulesRecord} */
  const reglas = {};

  for (const configuracion of configuraciones) {
    for (const [nombre, regla] of Object.entries(configuracion.rules ?? {})) {
      if (regla === undefined) continue;

      const opciones = Array.isArray(regla) ? regla : [regla];
      const nivel = opciones[0] === 'off' || opciones[0] === 0 ? 'off' : 'warn';
      reglas[nombre] = [nivel, ...opciones.slice(1)];
    }
  }

  return reglas;
}

module.exports = defineConfig([
  { ignores: ['dist/**', 'coverage/**', '.angular/**'] },
  {
    files: ['src/**/*.ts'],
    extends: reglasTypeScript,
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', style: 'kebab-case' }],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: reglasPlantillas,
  },
  {
    files: ['src/app/**/*.ts'],
    rules: comoAdvertencias(reglasTypeScript),
  },
  {
    files: ['src/app/**/*.html'],
    rules: comoAdvertencias(reglasPlantillas),
  },
]);
