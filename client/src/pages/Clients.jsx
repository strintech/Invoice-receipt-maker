import { useState, useEffect } from 'react'
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom'

function ClientList() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients')
      const data = await res.json()
      setClients(data)
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this client?')) return

    try {
      await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      fetchClients()
    } catch (error) {
      console.error('Error deleting client:', error)
    }
  }

  const filteredClients = clients.filter(client =>
    client.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (client.email && client.email.toLowerCase().includes(search.toLowerCase())) ||
    (client.tax_id && client.tax_id.includes(search))
  )

  if (loading) {
    return <div className="loading"><div className="spinner"></div>Loading...</div>
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Clients</h1>
        <Link to="/clients/new" className="btn btn-primary">New Client</Link>
      </div>

      {clients.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {filteredClients.length > 0 ? (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Company Name</th>
                <th>City</th>
                <th>Tax ID</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr key={client.id}>
                  <td>
                    <Link to={`/clients/${client.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {client.company_name}
                    </Link>
                  </td>
                  <td>{client.city || '-'}</td>
                  <td>{client.tax_id || '-'}</td>
                  <td>{client.email || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(client.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <h3>No Clients Yet</h3>
            <p>Add your first client to quickly select them when creating invoices and receipts.</p>
            <Link to="/clients/new" className="btn btn-primary" style={{ marginTop: '15px' }}>
              Add First Client
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [formData, setFormData] = useState({
    company_name: '',
    address: '',
    city: '',
    country: '',
    tax_id: '',
    email: '',
    phone: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEditing) {
      fetchClient()
    }
  }, [id])

  const fetchClient = async () => {
    try {
      const res = await fetch(`/api/clients/${id}`)
      const data = await res.json()
      setFormData(data)
    } catch (error) {
      console.error('Error fetching client:', error)
      setError('Failed to load client')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const url = isEditing ? `/api/clients/${id}` : '/api/clients'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save client')
      }

      navigate('/clients')
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEditing ? 'Edit Client' : 'New Client'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <div className="form-group">
            <label className="form-label">Company Name *</label>
            <input
              type="text"
              name="company_name"
              className="form-input"
              value={formData.company_name}
              onChange={handleChange}
              required
              placeholder="Client's legal company name"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                type="text"
                name="address"
                className="form-input"
                value={formData.address}
                onChange={handleChange}
                placeholder="Street address"
              />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input
                type="text"
                name="city"
                className="form-input"
                value={formData.city}
                onChange={handleChange}
                placeholder="City, Postal Code"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                type="text"
                name="country"
                className="form-input"
                value={formData.country}
                onChange={handleChange}
                placeholder="Country"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tax ID (UID/JIB)</label>
              <input
                type="text"
                name="tax_id"
                className="form-input"
                value={formData.tax_id}
                onChange={handleChange}
                placeholder="Tax identification number"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                name="email"
                className="form-input"
                value={formData.email}
                onChange={handleChange}
                placeholder="client@example.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="text"
                name="phone"
                className="form-input"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 234 567 890"
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/clients')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (isEditing ? 'Update Client' : 'Create Client')}
          </button>
        </div>
      </form>
    </div>
  )
}

function Clients() {
  return (
    <Routes>
      <Route index element={<ClientList />} />
      <Route path="new" element={<ClientForm />} />
      <Route path=":id" element={<ClientForm />} />
    </Routes>
  )
}

export default Clients
