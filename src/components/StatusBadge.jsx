import { Clock, CheckCircle2, Eye } from 'lucide-react'

const config = {
  pending: {
    label: 'Pendiente',
    classes: 'bg-amber-100 text-amber-800 border-amber-200',
    Icon: Clock,
  },
  completed: {
    label: 'Completado',
    classes: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Icon: CheckCircle2,
  },
  revision: {
    label: 'En revisión',
    classes: 'bg-blue-100 text-blue-800 border-blue-200',
    Icon: Eye,
  },
}

export default function StatusBadge({ status }) {
  const { label, classes, Icon } = config[status] ?? config.pending
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wide font-sans ${classes}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}