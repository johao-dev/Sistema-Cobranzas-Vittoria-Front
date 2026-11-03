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

module.exports = defineConfig([
  { ignores: ['dist/**', 'coverage/**', '.angular/**'] },
  {
    files: ['src/**/*.ts'],
    extends: reglasTypeScript,
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: [], style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: [], style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['src/**/*.html'],
    extends: reglasPlantillas,
  },
]);
