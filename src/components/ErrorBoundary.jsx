import { Component } from 'react'
import { AlertTriangle, Copy, RefreshCw } from 'lucide-react'
import { armarDiagnostico, copiarTexto } from '../lib/diagnostics'

/**
 * Sin esto, si algo revienta durante el render (no en un try/catch async,
 * sino en el render de React), React desmonta TODO el árbol y queda una
 * pantalla en blanco — sin ningún rastro visible del error para quien lo
 * sufre (típicamente en un celular, sin devtools a mano).
 *
 * Con este boundary, en vez de pantalla en blanco se ve el error técnico
 * completo (mensaje + stack) y un botón para copiarlo y mandarlo tal cual,
 * sin depender de que alguien tenga acceso a la consola del navegador.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, copiado: false }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Guardamos el stack de componentes también, es útil para ubicar
    // en qué pantalla/componente pasó.
    this.setState({ componentStack: info?.componentStack })
    console.error('[ErrorBoundary]', error, info)
  }

  handleCopiar = async () => {
    const { error, componentStack } = this.state
    const texto = armarDiagnostico(error, {
      'Componente (React stack)': componentStack?.trim().split('\n')[1]?.trim() ?? '—',
    }) + (componentStack ? `\n\nReact component stack:\n${componentStack}` : '')
    const ok = await copiarTexto(texto)
    this.setState({ copiado: ok })
    setTimeout(() => this.setState({ copiado: false }), 2000)
  }

  render() {
    const { error, copiado } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-natural px-6 py-10">
        <div className="w-full max-w-lg card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-ink">Algo salió mal</p>
              <p className="text-xs text-slate-500">La app encontró un error inesperado.</p>
            </div>
          </div>

          <details open className="bg-slate-50 rounded-lg p-3 text-xs">
            <summary className="cursor-pointer font-medium text-slate-600 select-none">
              Detalle técnico
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words text-slate-600 max-h-56 overflow-y-auto">
{error?.name}: {error?.message}
{'\n'}
{error?.stack}
            </pre>
          </details>

          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={this.handleCopiar} className="btn-secondary flex-1 justify-center">
              <Copy className="w-4 h-4" />
              {copiado ? 'Copiado ✓' : 'Copiar diagnóstico'}
            </button>
            <button onClick={() => window.location.reload()} className="btn-primary flex-1 justify-center">
              <RefreshCw className="w-4 h-4" />
              Recargar
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center">
            Copiá el diagnóstico y enviaselo a soporte para que puedan revisarlo.
          </p>
        </div>
      </div>
    )
  }
}
