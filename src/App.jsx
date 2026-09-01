import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import AdminDashboard from './pages/admin/Dashboard'
import Employees from './pages/admin/Employees'
import EmployeeDetail from './pages/admin/EmployeeDetail'
import Templates from './pages/admin/Templates'
import Birthdays from './pages/admin/Birthdays'
import RRHHTeam from './pages/admin/RRHHTeam'
import EmployeeDashboard from './pages/employee/Dashboard'
import MyDocuments from './pages/employee/MyDocuments'
import MyUploads from './pages/employee/MyUploads'

// `roles`: lista de roles permitidos en esta rama de rutas.
// admin y rrhh comparten todo el panel operativo; el panel
// exclusivo del Super Admin (RRHHTeam) se gatea aparte, adentro
// de la propia página, no acá.
function ProtectedRoute({ children, roles }) {
  const { user, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Cuenta desactivada por el Super Admin: fuera, sin excepción.
  if (profile && profile.is_active === false) {
    signOut()
    toast.error('Esta cuenta fue desactivada. Contactá al administrador.')
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(profile?.role)) {
    return <Navigate to={profile?.role === 'employee' ? '/empleado' : '/admin'} replace />
  }
  return children
}

function RootRedirect() {
  const { user, profile, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={profile?.role === 'employee' ? '/empleado' : '/admin'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        toastClassName="!font-sans !text-sm"
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/establecer-clave" element={<SetPassword />} />

        {/* Panel operativo: admin y rrhh */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin', 'rrhh']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="empleados" element={<Employees />} />
          <Route path="empleados/:id" element={<EmployeeDetail />} />
          <Route path="plantillas" element={<Templates />} />
          <Route path="cumpleanos" element={<Birthdays />} />
          <Route path="equipo-rrhh" element={<RRHHTeam />} />
        </Route>

        {/* Empleado */}
        <Route
          path="/empleado"
          element={
            <ProtectedRoute roles={['employee']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<EmployeeDashboard />} />
          <Route path="documentos" element={<MyDocuments />} />
          <Route path="cargar-documentos" element={<MyUploads />} />
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}