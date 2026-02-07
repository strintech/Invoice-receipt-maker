import { useState, useEffect } from 'react'

function LineItems({ items = [], onChange, showVat = false, currency = 'EUR' }) {
  const [lineItems, setLineItems] = useState(items.length > 0 ? items : [
    { description: '', unit_price: '', quantity: 1, vat_rate: 0 }
  ])

  useEffect(() => {
    if (items.length > 0) {
      setLineItems(items)
    }
  }, [items])

  const updateItem = (index, field, value) => {
    const updated = lineItems.map((item, i) => {
      if (i === index) {
        const newItem = { ...item, [field]: value }
        // Calculate total
        const qty = parseFloat(newItem.quantity) || 0
        const price = parseFloat(newItem.unit_price) || 0
        newItem.total = qty * price
        return newItem
      }
      return item
    })
    setLineItems(updated)
    onChange(updated)
  }

  const addItem = () => {
    const updated = [...lineItems, { description: '', unit_price: '', quantity: 1, vat_rate: 0 }]
    setLineItems(updated)
    onChange(updated)
  }

  const removeItem = (index) => {
    if (lineItems.length === 1) return
    const updated = lineItems.filter((_, i) => i !== index)
    setLineItems(updated)
    onChange(updated)
  }

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0
      const price = parseFloat(item.unit_price) || 0
      return sum + (qty * price)
    }, 0)
  }

  return (
    <div className="line-items">
      <table className="line-items-table">
        <thead>
          <tr>
            <th style={{ width: '40%' }}>Description</th>
            <th style={{ width: '15%' }}>Unit Price</th>
            <th style={{ width: '10%' }}>Qty</th>
            {showVat && <th style={{ width: '10%' }}>VAT %</th>}
            <th style={{ width: '15%' }}>Total</th>
            <th style={{ width: '10%' }}></th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => (
            <tr key={index}>
              <td>
                <input
                  type="text"
                  className="form-input"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  placeholder="Service or product description"
                />
              </td>
              <td>
                <input
                  type="number"
                  className="form-input"
                  value={item.unit_price}
                  onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </td>
              <td>
                <input
                  type="number"
                  className="form-input"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  placeholder="1"
                  step="0.01"
                  min="0"
                />
              </td>
              {showVat && (
                <td>
                  <input
                    type="number"
                    className="form-input"
                    value={item.vat_rate}
                    onChange={(e) => updateItem(index, 'vat_rate', e.target.value)}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </td>
              )}
              <td>
                <span style={{ fontWeight: 500 }}>
                  {((parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0)).toFixed(2)} {currency}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeItem(index)}
                  disabled={lineItems.length === 1}
                  title="Remove item"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={showVat ? 4 : 3} style={{ textAlign: 'right', fontWeight: 600 }}>
              Total:
            </td>
            <td style={{ fontWeight: 700, fontSize: '1.1em' }}>
              {calculateTotal().toFixed(2)} {currency}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <button type="button" className="btn btn-secondary btn-sm add-line-item" onClick={addItem}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="16" height="16">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Line Item
      </button>
    </div>
  )
}

export default LineItems
