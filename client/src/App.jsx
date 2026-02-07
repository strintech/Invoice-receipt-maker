import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Invoices from './pages/Invoices'
import Receipts from './pages/Receipts'
import Templates from './pages/Templates'
import Clients from './pages/Clients'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="invoices/*" element={<Invoices />} />
        <Route path="receipts/*" element={<Receipts />} />
        <Route path="templates/*" element={<Templates />} />
        <Route path="clients/*" element={<Clients />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
