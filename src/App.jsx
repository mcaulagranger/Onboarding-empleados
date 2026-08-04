import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import AdminDashboard from './pages/employee/Dashboard'
import Employees from './pages/admin/Employees'
import EmployeeDetail from './pages/admin/EmployeeDetail'
import Templates from './pages/admin/Templates'
import EmployeeDashboard from './pages/employee/Dashboard'
import MyDocuments from './pages/employee/MyDocuments'

function ProtectedRoute({ children, role }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (role && profile?.role !== role) {
    return <Navigate to={profile?.role === 'admin' ? '/admin' : '/empleado'} replace />
  }
  return children
}

function RootRedirect() {
  const { user, profile, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={profile?.role === 'admin' ? '/admin' : '/empleado'} replace />
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

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="empleados" element={<Employees />} />
          <Route path="empleados/:id" element={<EmployeeDetail />} />
          <Route path="plantillas" element={<Templates />} />
        </Route>

        {/* Empleado */}
        <Route
          path="/empleado"
          element={
            <ProtectedRoute role="employee">
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<EmployeeDashboard />} />
          <Route path="documentos" element={<MyDocuments />} />
        </Route>

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
