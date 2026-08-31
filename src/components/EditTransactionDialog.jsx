import { useState } from 'react'
import { toDatetimeLocal, parseNumber } from '../utils/storage'

export default function EditTransactionDialog({ transaction, banks, onSave, onClose }) {
  const [form, setForm] = useState({
    datetimeLocal: toDatetimeLocal(transaction.datetime),
    valueStr: String(transaction.value),
    description: transaction.description,
    bank: transaction.bank || ''
  })

  function handleSave() {
    if (!form.description.trim()) return

    onSave({
      ...transaction,
      datetime: new Date(form.datetimeLocal).toISOString(),
      value: parseNumber(form.valueStr),
      description: form.description.trim(),
      bank: form.bank
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Kaydı Düzenle</h3>

        <div className="form-group">
          <label>Tarih</label>
          <input
            type="datetime-local"
            value={form.datetimeLocal}
            onChange={e => setForm({ ...form, datetimeLocal: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Tutar</label>
          <input
            type="text"
            value={form.valueStr}
            onChange={e => setForm({ ...form, valueStr: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Açıklama</label>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Banka</label>
          <select
            value={form.bank}
            onChange={e => setForm({ ...form, bank: e.target.value })}
          >
            <option value="">Seçin</option>
            {banks.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>İptal</button>
          <button onClick={handleSave}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}
