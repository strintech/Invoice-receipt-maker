import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function Dashboard() {
  const [stats, setStats] = useState({
    invoices: 0,
    receipts: 0,
    templates: 0,
    clients: 0
  })
  const [recentInvoices, setRecentInvoices] = useState([])
  const [recentReceipts, setRecentReceipts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invoicesRes, receiptsRes, templatesRes, clientsRes] = await Promise.all([
          fetch('/api/invoices'),
          fetch('/api/receipts'),
          fetch('/api/templates'),
          fetch('/api/clients')
        ])

        const invoices = await invoicesRes.json()
        const receipts = await receiptsRes.json()
        const templates = await templatesRes.json()
        const clients = await clientsRes.json()

        setStats({
          invoices: invoices.length,
          receipts: receipts.length,
          templates: templates.length,
          clients: clients.length
        })

        setRecentInvoices(invoices.slice(0, 5))
        setRecentReceipts(receipts.slice(0, 5))
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount, currency = 'EUR') => {
    return `${parseFloat(amount).toFixed(2)} ${currency}`
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Loading...
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/invoices/new" className="btn btn-primary">New Invoice</Link>
          <Link to="/receipts/new" className="btn btn-secondary">New Receipt</Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-label">Total Invoices</div>
          <div className="stat-value">{stats.invoices}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Total Receipts</div>
          <div className="stat-value">{stats.receipts}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Templates</div>
          <div className="stat-value">{stats.templates}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Clients</div>
          <div className="stat-value">{stats.clients}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Invoices</h2>
            <Link to="/invoices" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          {recentInvoices.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td>
                      <Link to={`/invoices/${invoice.id}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td>{invoice.client_name || '-'}</td>
                    <td>{formatDate(invoice.date)}</td>
                    <td>{formatCurrency(invoice.total, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>No invoices yet</p>
              <Link to="/invoices/new" className="btn btn-primary btn-sm" style={{ marginTop: '10px' }}>
                Create First Invoice
              </Link>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Receipts</h2>
            <Link to="/receipts" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          {recentReceipts.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {recentReceipts.map(receipt => (
                  <tr key={receipt.id}>
                    <td>
                      <Link to={`/receipts/${receipt.id}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                        {receipt.receipt_number}
                      </Link>
                    </td>
                    <td>{receipt.client_name || '-'}</td>
                    <td>{formatDate(receipt.date)}</td>
                    <td>{formatCurrency(receipt.total, receipt.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>No receipts yet</p>
              <Link to="/receipts/new" className="btn btn-primary btn-sm" style={{ marginTop: '10px' }}>
                Create First Receipt
              </Link>
            </div>
          )}
        </div>
      </div>

      {stats.templates === 0 && (
        <div className="card" style={{ marginTop: '20px', background: '#FEF3C7', borderLeft: '4px solid #F59E0B' }}>
          <h3 style={{ marginBottom: '10px' }}>Get Started</h3>
          <p style={{ marginBottom: '15px' }}>
            Create a template with your company information to quickly generate invoices and receipts.
          </p>
          <Link to="/templates/new" className="btn btn-primary">Create Template</Link>
        </div>
      )}
    </div>
  )
}

export default Dashboard
