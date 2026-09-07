// El worker de pdf.js no publica tipos: se importa solo por su efecto
// secundario (quedar registrado como worker ya cargado, para poder procesar en
// el hilo principal cuando el navegador bloquea los workers de módulo).
declare module 'pdfjs-dist/build/pdf.worker.min.mjs';
