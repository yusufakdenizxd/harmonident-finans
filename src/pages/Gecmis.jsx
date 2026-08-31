import { useState, useEffect } from 'react'
import { loadAllData, deleteBatch } from '../utils/storage'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Gecmis() {
  const [history, setHistory] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { history: histData } = await loadAllData()
    setHistory(histData.history || [])
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    await deleteBatch(deleteTarget.id)
    setDeleteTarget(null)
    await loadData()
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>İçe Aktarma Geçmişi</h2>
      
      {history.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Henüz içe aktarma yapılmadı</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Dosya Adı</th>
              <th>Satır Sayısı</th>
              <th>Tarih</th>
              <th style={{ width: '80px' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {history.map(item => (
              <tr key={item.id}>
                <td>{item.filename}</td>
                <td>{item.rowCount}</td>
                <td>{formatDate(item.date)}</td>
                <td>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => setDeleteTarget(item)}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: '1rem', color: '#6b7280' }}>
          Toplam: {history.length} içe aktarma
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="İçe Aktarmayı Sil"
          message={`"${deleteTarget.filename}" (${deleteTarget.rowCount} kayıt) silinecek. Bu işlem geri alınamaz. Emin misiniz?`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
