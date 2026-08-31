import { useState, useEffect, useMemo } from 'react'
import { loadAllData, deleteTransaction, updateTransaction } from '../utils/storage'
import ConfirmDialog from '../components/ConfirmDialog'
import EditTransactionDialog from '../components/EditTransactionDialog'

export default function AnaSayfa() {
  const emptyFilters = { datetime: '', value: '', description: '', bank: '' }
  const [transactions, setTransactions] = useState([])
  const [banks, setBanks] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: 'datetime', direction: 'desc' })
  const [filters, setFilters] = useState(emptyFilters)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { transactions: txData } = await loadAllData()
    setTransactions(txData.transactions || [])
    setBanks(txData.banks || [])
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    await deleteTransaction(deleteTarget.id)
    setDeleteTarget(null)
    await loadData()
  }

  async function handleSaveEdit(updated) {
    await updateTransaction(updated)
    setEditTarget(null)
    await loadData()
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const filteredAndSorted = useMemo(() => {
    let result = [...transactions]

    if (selectedMonth && selectedYear) {
      result = result.filter(t => {
        const date = new Date(t.datetime)
        return date.getMonth() === parseInt(selectedMonth) && date.getFullYear() === parseInt(selectedYear)
      })
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(item => 
          String(item[key]).toLowerCase().includes(value.toLowerCase())
        )
      }
    })

    result.sort((a, b) => {
      let aVal = a[sortConfig.key]
      let bVal = b[sortConfig.key]

      if (sortConfig.key === 'datetime') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      } else if (sortConfig.key === 'value') {
        aVal = Number(aVal)
        bVal = Number(bVal)
      } else {
        aVal = String(aVal).toLowerCase()
        bVal = String(bVal).toLowerCase()
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [transactions, sortConfig, filters, selectedMonth, selectedYear])

  const totalSum = useMemo(() => {
    return filteredAndSorted.reduce((sum, t) => sum + Number(t.value), 0)
  }, [filteredAndSorted])

  function handleSort(key) {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  function handleFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function clearFilters() {
    setSelectedMonth('')
    setSelectedYear('')
    setFilters(emptyFilters)
  }

  const hasActiveFilters = selectedMonth || selectedYear || Object.values(filters).some(Boolean)

  function formatDate(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatValue(val) {
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(val)
  }

  const columns = [
    { key: 'datetime', label: 'Tarih' },
    { key: 'value', label: 'Tutar' },
    { key: 'description', label: 'Açıklama' },
    { key: 'bank', label: 'Banka' }
  ]

  const months = [
    { value: '0', label: 'Ocak' },
    { value: '1', label: 'Şubat' },
    { value: '2', label: 'Mart' },
    { value: '3', label: 'Nisan' },
    { value: '4', label: 'Mayıs' },
    { value: '5', label: 'Haziran' },
    { value: '6', label: 'Temmuz' },
    { value: '7', label: 'Ağustos' },
    { value: '8', label: 'Eylül' },
    { value: '9', label: 'Ekim' },
    { value: '10', label: 'Kasım' },
    { value: '11', label: 'Aralık' }
  ]

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>İşlemler</h2>
      
      <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
        <span style={{ fontWeight: '500' }}>Toplam: </span>
        <span style={{ fontWeight: '700', fontSize: '1.25rem', color: totalSum >= 0 ? '#059669' : '#dc2626' }}>
          {formatValue(totalSum)} TL
        </span>
      </div>
      
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{ width: '150px' }}
        >
          <option value="">Ay seçin</option>
          {months.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          style={{ width: '120px' }}
        >
          <option value="">Yıl seçin</option>
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Tarih filtrele..."
          value={filters.datetime}
          onChange={(e) => handleFilter('datetime', e.target.value)}
          style={{ flex: 1 }}
        />
        <input
          type="text"
          placeholder="Tutar filtrele..."
          value={filters.value}
          onChange={(e) => handleFilter('value', e.target.value)}
          style={{ flex: 1 }}
        />
        <input
          type="text"
          placeholder="Açıklama filtrele..."
          value={filters.description}
          onChange={(e) => handleFilter('description', e.target.value)}
          style={{ flex: 1 }}
        />
        <input
          type="text"
          placeholder="Banka filtrele..."
          value={filters.bank}
          onChange={(e) => handleFilter('bank', e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          style={{ background: '#6b7280', whiteSpace: 'nowrap' }}
        >
          Filtreleri Temizle
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th 
                  key={col.key} 
                  onClick={() => handleSort(col.key)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  {col.label}
                  {sortConfig.key === col.key && (
                    <span style={{ marginLeft: '0.5rem' }}>
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
              <th style={{ width: '140px' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>
                  Veri bulunmuyor
                </td>
              </tr>
            ) : (
              filteredAndSorted.map(t => (
                <tr key={t.id}>
                  <td>{formatDate(t.datetime)}</td>
                  <td style={{ fontWeight: '500', color: t.value >= 0 ? '#059669' : '#dc2626' }}>
                    {formatValue(t.value)} TL
                  </td>
                  <td>{t.description}</td>
                  <td>{t.bank}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-sm" onClick={() => setEditTarget(t)}>
                        Düzenle
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => setDeleteTarget(t)}>
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', color: '#6b7280' }}>
        Toplam: {filteredAndSorted.length} kayıt
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Kaydı Sil"
          message={`Bu kaydı silmek istediğinize emin misiniz?\n"${deleteTarget.description?.slice(0, 80)}${deleteTarget.description?.length > 80 ? '...' : ''}"`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {editTarget && (
        <EditTransactionDialog
          transaction={editTarget}
          banks={banks}
          onSave={handleSaveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}
