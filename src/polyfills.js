/**
 * Polyfills globales. Se importa como PRIMERA línea de main.jsx para
 * garantizar que estén disponibles antes de que cualquier otra parte de
 * la app (incluidos los chunks que se cargan después, como PdfFormFiller)
 * los necesite.
 *
 * ── Promise.withResolvers ──
 * Es un método muy nuevo del lenguaje (ECMAScript 2024): recién está
 * disponible desde Safari 17.4 (marzo 2024), Chrome 119 y Firefox 121.
 * Muchos celulares —iPhones que no actualizaron, Androids con WebView
 * viejo— no lo tienen todavía.
 *
 * `pdfjs-dist` (la librería que usamos para abrir y renderizar los PDF
 * al completar documentos) lo llama internamente en decenas de lugares
 * SIN ningún control de compatibilidad. En un navegador que no lo tiene,
 * `Promise.withResolvers` es `undefined`, y al llamarlo como función
 * explota con "undefined is not a function" — pasa en el celular y no
 * en la compu porque el Chrome de escritorio suele estar actualizado.
 *
 * Este polyfill es la implementación de referencia del spec (la misma
 * que usan librerías como core-js), así que es 100% equivalente al
 * método nativo cuando este no existe.
 */
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

/**
 * ── ReadableStream: iteración asíncrona (Symbol.asyncIterator) ──
 * CONFIRMADO como la causa real del error en mobile ("undefined is not
 * a function (near '...n of e...')" al completar documentos).
 *
 * `pdfjs-dist` usa internamente `for await (const chunk of stream)`
 * sobre un ReadableStream dentro de `getTextContent()`. El navegador
 * puede tener la clase `ReadableStream` pero sin el método de iteración
 * asíncrona (`Symbol.asyncIterator`) implementado — son dos cosas que
 * llegaron a los navegadores en momentos distintos. Sin este método,
 * `for await...of` sobre el stream explota exactamente con ese error.
 *
 * Lo reproduje de punta a punta: mismo PDF real, mismo build de
 * pdfjs-dist que corre en producción, mismo motor JavaScriptCore
 * (el de Safari/iOS) — y este polyfill lo resuelve.
 *
 * Es el shim estándar (spec-compliant) para esto: delega en
 * `getReader()`, que sí es un método más viejo y ampliamente soportado.
 */
if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
  ReadableStream.prototype[Symbol.asyncIterator] = function () {
    const reader = this.getReader()
    return {
      next: () => reader.read(),
      return: (value) => {
        reader.releaseLock()
        return Promise.resolve({ value, done: true })
      },
      [Symbol.asyncIterator]() {
        return this
      },
    }
  }
}