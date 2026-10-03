/**
 * Worker entry: the polyfills must run before pdf.js's worker code, which
 * esbuild bundles into this same file (no remote code, no importScripts).
 */
import './polyfills';
import 'pdfjs-dist/build/pdf.worker.mjs';
