import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { loadTransactions, saveTransactions, loadHistory, saveHistory, selectExcelFile, parseDate, parseNumber, generateId } from '../utils/storage'

export default function Ekle() {
  const [excelData, setExcelData] = useState(null)
  const [columns, setColumns] = useState([])
  const [columnIndices, setColumnIndices] = useState({})
  const [headerRowIndex, setHeaderRowIndex] = useState(-1)
  const [mapping, setMapping] = useState({ datetime: '', value: '', description: '', bank: '' })
  const [newBank, setNewBank] = useState('')
  const [banks, setBanks] = useState([])
  const [selectedBank, setSelectedBank] = useState('')
  const [manualEntry, setManualEntry] = useState({ datetime: '', value: '', description: '', bank: '' })
  const [message, setMessage] = useState('')
  const [editingBank, setEditingBank] = useState(null)
  const [editBankName, setEditBankName] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const data = await loadTransactions()
    setBanks(data.banks || [])
  }

  async function handleSelectFile() {
    try {
      console.log('Selecting file...')
      const result = await selectExcelFile()
      console.log('File selected:', result)
      
      if (!result) {
        console.log('No file selected')
        return
      }

      const workbook = XLSX.read(result.data, { type: 'buffer' })
      console.log('Workbook read:', workbook.SheetNames)
      
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })
      console.log('JSON data length:', jsonData.length)
      
      if (jsonData.length > 0) {
        let headerRowIndex = -1
        let headers = []
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i]
          const hasContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
          if (hasContent) {
            const potentialHeaders = []
            row.forEach((h, idx) => {
              if (h !== null && h !== undefined && String(h).trim() !== '') {
                potentialHeaders.push({ index: idx, name: String(h).trim() })
              }
            })
            if (potentialHeaders.length >= 3) {
              headerRowIndex = i
              headers = potentialHeaders.map(h => h.name)
              console.log('Found header row at index:', headerRowIndex, 'Headers:', headers)
              break
            }
          }
        }

        if (headerRowIndex === -1) {
          console.log('No header row found')
          setMessage('Header satırı bulunamadı')
          return
        }

        const indexMap = {}
        jsonData[headerRowIndex].forEach((h, idx) => {
          if (h !== null && h !== undefined && String(h).trim() !== '') {
            indexMap[String(h).trim()] = idx
          }
        })
        setColumnIndices(indexMap)
        setHeaderRowIndex(headerRowIndex)

        const dataRows = jsonData.slice(headerRowIndex + 1).filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''))
        console.log('Data rows:', dataRows.length)
        
        setColumns(headers)
        setExcelData(dataRows)
        setMessage(`Dosya yüklendi: ${result.filename} (${dataRows.length} satır)`)
      }
    } catch (error) {
      console.error('Error selecting file:', error)
      setMessage('Hata: ' + error.message)
    }
  }

  async function handleImport() {
    console.log('handleImport called')
    console.log('excelData:', excelData)
    console.log('mapping:', mapping)
    console.log('columnIndices:', columnIndices)
    
    if (!excelData || !mapping.datetime || !mapping.value || !mapping.description) {
      setMessage('Lütfen tarih, tutar ve açıklama alanlarını eşleştirin')
      return
    }

    const batchId = generateId()
    const transactions = excelData.map(row => {
      console.log('Processing row:', row)
      const datetimeIdx = columnIndices[mapping.datetime]
      const valueIdx = columnIndices[mapping.value]
      const descIdx = columnIndices[mapping.description]
      
      return {
        id: generateId(),
        batchId,
        datetime: parseDate(row[datetimeIdx]) || new Date().toISOString(),
        value: parseNumber(row[valueIdx]),
        description: String(row[descIdx] || '').trim(),
        bank: selectedBank
      }
    }).filter(t => t.description)

    console.log('Parsed transactions:', transactions.length)
    console.log('Sample transaction:', transactions[0])

    const data = await loadTransactions()
    const updatedTransactions = [...data.transactions, ...transactions]
    const uniqueBanks = [...new Set([...data.banks, ...transactions.map(t => t.bank).filter(b => b)])]
    
    await saveTransactions({ transactions: updatedTransactions, banks: uniqueBanks })
    setBanks(uniqueBanks)

    const history = await loadHistory()
    history.history = history.history || []
    history.history.unshift({
      id: batchId,
      filename: 'Excel Import',
      rowCount: transactions.length,
      date: new Date().toISOString(),
      transactionIds: transactions.map(t => t.id)
    })
    await saveHistory(history)

    setMessage(`${transactions.length} kayıt içe aktarıldı`)
    setExcelData(null)
    setMapping({ datetime: '', value: '', description: '', bank: '' })
  }

  async function handleAddBank() {
    if (!newBank.trim()) return
    
    const data = await loadTransactions()
    if (!data.banks.includes(newBank.trim())) {
      const updatedBanks = [...data.banks, newBank.trim()]
      await saveTransactions({ ...data, banks: updatedBanks })
      setBanks(updatedBanks)
    }
    setNewBank('')
  }

  async function handleRenameBank(oldName, newName) {
    if (!newName.trim() || oldName === newName.trim()) {
      setEditingBank(null)
      return
    }
    const data = await loadTransactions()
    const updatedBanks = data.banks.map(b => b === oldName ? newName.trim() : b)
    await saveTransactions({ ...data, banks: updatedBanks })
    setBanks(updatedBanks)
    setEditingBank(null)
    setEditBankName('')
  }

  async function handleManualAdd() {
    if (!manualEntry.datetime || !manualEntry.value || !manualEntry.description) {
      setMessage('Lütfen tarih, tutar ve açıklama alanlarını doldurun')
      return
    }

    const data = await loadTransactions()
    const bank = manualEntry.bank || selectedBank
    
    const batchId = generateId()
    const newTransaction = {
      id: generateId(),
      batchId,
      datetime: new Date(manualEntry.datetime).toISOString(),
      value: parseNumber(manualEntry.value),
      description: manualEntry.description.trim(),
      bank: bank
    }

    const updatedTransactions = [...data.transactions, newTransaction]
    const updatedBanks = data.banks.includes(bank) 
      ? data.banks 
      : [...data.banks, bank]

    await saveTransactions({ transactions: updatedTransactions, banks: updatedBanks })
    setBanks(updatedBanks)

    const history = await loadHistory()
    history.history = history.history || []
    history.history.unshift({
      id: batchId,
      filename: 'Manuel Ek',
      rowCount: 1,
      date: new Date().toISOString(),
      transactionIds: [newTransaction.id]
    })
    await saveHistory(history)

    setMessage('Kayıt eklendi')
    setManualEntry({ datetime: '', value: '', description: '', bank: '' })
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Excel İçe Aktar</h2>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <button onClick={handleSelectFile}>Dosya Seç</button>
          <span style={{ color: '#6b7280' }}>.xls veya .xlsx dosyaları</span>
        </div>

        {excelData && (
          <>
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f9fafb', borderRadius: '6px' }}>
              <p style={{ marginBottom: '0.5rem', fontWeight: '500' }}>Sütun Eşleştirme:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Tarih *</label>
                  <select 
                    value={mapping.datetime}
                    onChange={(e) => setMapping({ ...mapping, datetime: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Seçin</option>
                    {columns.map((col, i) => (
                      <option key={i} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Tutar *</label>
                  <select 
                    value={mapping.value}
                    onChange={(e) => setMapping({ ...mapping, value: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Seçin</option>
                    {columns.map((col, i) => (
                      <option key={i} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Açıklama *</label>
                  <select 
                    value={mapping.description}
                    onChange={(e) => setMapping({ ...mapping, description: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Seçin</option>
                    {columns.map((col, i) => (
                      <option key={i} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, maxWidth: '300px' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Varsayılan Banka:</label>
                  <select 
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Seçin</option>
                    {banks.map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Yeni Banka:</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text"
                      placeholder="Banka adı"
                      value={newBank}
                      onChange={(e) => setNewBank(e.target.value)}
                      style={{ width: '150px' }}
                    />
                    <button 
                      type="button"
                      onClick={async () => {
                        if (!newBank.trim()) return
                        const data = await loadTransactions()
                        if (!data.banks.includes(newBank.trim())) {
                          const updatedBanks = [...data.banks, newBank.trim()]
                          await saveTransactions({ ...data, banks: updatedBanks })
                          setBanks(updatedBanks)
                          setSelectedBank(newBank.trim())
                        }
                        setNewBank('')
                      }}
                    >
                      Ekle
                    </button>
                  </div>
                </div>
              </div>

            <button onClick={handleImport}>İçe Aktar</button>
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Manuel Kayıt Ekle</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Tarih *</label>
            <input 
              type="datetime-local"
              value={manualEntry.datetime}
              onChange={(e) => setManualEntry({ ...manualEntry, datetime: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Tutar *</label>
            <input 
              type="number"
              step="0.01"
              value={manualEntry.value}
              onChange={(e) => setManualEntry({ ...manualEntry, value: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Açıklama *</label>
            <input 
              type="text"
              value={manualEntry.description}
              onChange={(e) => setManualEntry({ ...manualEntry, description: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Banka</label>
            <select 
              value={manualEntry.bank || selectedBank}
              onChange={(e) => setManualEntry({ ...manualEntry, bank: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="">Seçin</option>
              {banks.map(bank => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>
        </div>

        <button onClick={handleManualAdd}>Kayıt Ekle</button>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Banka Yönetimi</h2>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input 
            type="text"
            placeholder="Yeni banka adı..."
            value={newBank}
            onChange={(e) => setNewBank(e.target.value)}
            style={{ flex: 1, maxWidth: '300px' }}
          />
          <button onClick={handleAddBank}>Banka Ekle</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {banks.map((bank, index) => (
            <span 
              key={bank + index} 
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.75rem', 
                background: '#e5e7eb', 
                borderRadius: '9999px',
                fontSize: '0.875rem'
              }}
            >
              {editingBank === bank ? (
                <>
                  <input 
                    type="text"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    style={{ width: '120px', padding: '2px 6px', fontSize: '0.875rem' }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameBank(bank, editBankName)
                      if (e.key === 'Escape') setEditingBank(null)
                    }}
                  />
                  <button 
                    onClick={() => handleRenameBank(bank, editBankName)}
                    style={{ padding: '2px 8px', fontSize: '0.75rem', lineHeight: '1.2' }}
                  >
                    Kaydet
                  </button>
                  <button 
                    onClick={() => setEditingBank(null)}
                    className="btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.75rem', lineHeight: '1.2' }}
                  >
                    İptal
                  </button>
                </>
              ) : (
                <>
                  {bank}
                  <button 
                    onClick={() => { setEditingBank(bank); setEditBankName(bank) }}
                    style={{ 
                      padding: '0 2px', 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer', 
                      fontSize: '0.7rem',
                      color: '#6b7280',
                      lineHeight: '1',
                      opacity: '0.6'
                    }}
                    title="Banka adını düzenle"
                  >
                    ✎
                  </button>
                </>
              )}
            </span>
          ))}
          {banks.length === 0 && <span style={{ color: '#6b7280' }}>Henüz banka eklenmedi</span>}
        </div>
      </div>

      {message && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '0.75rem', 
          background: message.includes('hata') ? '#fee2e2' : '#d1fae5',
          color: message.includes('hata') ? '#dc2626' : '#059669',
          borderRadius: '6px'
        }}>
          {message}
        </div>
      )}
    </div>
  )
}