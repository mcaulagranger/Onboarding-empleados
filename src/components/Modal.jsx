import { Fragment } from 'react'
import {
  Dialog, DialogPanel, DialogTitle,
  Transition, TransitionChild,
} from '@headlessui/react'
import { X } from 'lucide-react'

/**
 * Modal accesible basado en Headless UI: trae focus-trap, cierre con Esc,
 * click en el fondo y bloqueo de scroll "gratis". Misma API que antes
 * (title, onClose, children, size) para no tocar quienes lo usan.
 */
export default function Modal({ title, onClose, children, size = 'md' }) {
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-3xl' }

  return (
    <Transition appear show as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Fondo */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-ink/60" aria-hidden="true" />
        </TransitionChild>

        {/* Panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className={`relative bg-natural rounded-xl shadow-xl w-full ${widths[size]} max-h-[90vh] flex flex-col`}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <DialogTitle className="font-semibold text-ink text-lg">{title}</DialogTitle>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">{children}</div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}