const API = window.electronAPI

export function generateId() {
  return crypto.randomUUID()
}

function migrateTransactionsAndHistory(transactionsData, historyData) {
  const transactions = (transactionsData.transactions || []).map(t => ({
    ...t,
    id: t.id || generateId()
  }))

  const history = [...(historyData.history || [])]
  const needsLink = history.some(h => !h.transactionIds?.length)

  if (needsLink && history.length > 0) {
    const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date))
    let offset = 0

    for (const entry of sorted) {
      if (!entry.id) entry.id = generateId()
      if (!entry.transactionIds?.length) {
        const count = entry.rowCount || 0
        const batch = transactions.slice(offset, offset + count)
        entry.transactionIds = batch.map(t => t.id)
        batch.forEach(t => { t.batchId = entry.id })
        offset += count
      }
    }

    historyData.history = history
  }

  history.forEach(entry => {
    if (!entry.id) entry.id = generateId()
    ;(entry.transactionIds || []).forEach(id => {
      const t = transactions.find(tr => tr.id === id)
      if (t && !t.batchId) t.batchId = entry.id
    })
  })

  transactionsData.transactions = transactions
  return { transactionsData, historyData, migrated: needsLink }
}

export async function loadTransactions() {
  try {
    console.log('[Storage] Loading transactions...')
    const data = await API.readFile('transactions.json')
    console.log('[Storage] Loaded transactions:', data)
    if (data) {
      return data
    }
    return { transactions: [], banks: [] }
  } catch (error) {
    console.error('[Storage] Error loading transactions:', error)
    return { transactions: [], banks: [] }
  }
}

export async function saveTransactions(data) {
  try {
    console.log('[Storage] Saving transactions:', data)
    await API.writeFile('transactions.json', data)
    console.log('[Storage] Transactions saved')
  } catch (error) {
    console.error('[Storage] Error saving transactions:', error)
  }
}

export async function loadHistory() {
  try {
    const data = await API.readFile('history.json')
    if (data) {
      return data
    }
    return { history: [] }
  } catch (error) {
    console.error('[Storage] Error loading history:', error)
    return { history: [] }
  }
}

export async function saveHistory(data) {
  try {
    await API.writeFile('history.json', data)
  } catch (error) {
    console.error('[Storage] Error saving history:', error)
  }
}

export async function selectExcelFile() {
  try {
    console.log('[Storage] Calling selectFile...')
    const result = await API.selectFile()
    console.log('[Storage] selectFile result:', result)
    return result
  } catch (error) {
    console.error('[Storage] Error selecting file:', error)
    return null
  }
}

export function parseDate(value) {
  if (!value) return null
  
  if (value instanceof Date) {
    return value.toISOString()
  }
  
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000)
    return date.toISOString()
  }
  
  const str = String(value).trim()
  
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})(?:\s|T|[\sT](\d{2}):(\d{2}):?(\d{2})?)?$/,
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):?(\d{2})?)?$/,
    /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}):?(\d{2})?)?$/,
    /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):?(\d{2})?)?$/,
  ]
  
  for (const format of formats) {
    const match = str.match(format)
    if (match) {
      let date
      if (format === formats[0]) {
        date = new Date(match[1], match[2] - 1, match[3], match[4] || 0, match[5] || 0, match[6] || 0)
      } else {
        const day = parseInt(match[1])
        const month = parseInt(match[2]) - 1
        const year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3])
        date = new Date(year, month, day, match[4] || 0, match[5] || 0, match[6] || 0)
      }
      if (!isNaN(date.getTime())) {
        return date.toISOString()
      }
    }
  }
  
  const date = new Date(str)
  if (!isNaN(date.getTime())) {
    return date.toISOString()
  }
  
  return null
}

export function parseNumber(value) {
  if (typeof value === 'number') return value
  if (!value) return 0
  
  const str = String(value).trim()
    .replace(/\./g, '')
    .replace(',', '.')
  
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

export function toDatetimeLocal(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function loadAllData() {
  const transactionsData = await loadTransactions()
  const historyData = await loadHistory()
  const { transactionsData: migratedTx, historyData: migratedHist, migrated } = migrateTransactionsAndHistory(transactionsData, historyData)

  if (migrated) {
    await saveTransactions(migratedTx)
    await saveHistory(migratedHist)
  }

  return { transactions: migratedTx, history: migratedHist }
}

export async function deleteBatch(batchId) {
  const { transactions: txData, history: histData } = await loadAllData()
  const entry = histData.history.find(h => h.id === batchId)
  if (!entry) return

  const idsToRemove = new Set(entry.transactionIds || [])
  const remaining = txData.transactions.filter(t => !idsToRemove.has(t.id))

  await saveTransactions({ ...txData, transactions: remaining })
  await saveHistory({
    history: histData.history.filter(h => h.id !== batchId)
  })
}

export async function deleteTransaction(transactionId) {
  const { transactions: txData, history: histData } = await loadAllData()
  const transaction = txData.transactions.find(t => t.id === transactionId)
  if (!transaction) return

  const remaining = txData.transactions.filter(t => t.id !== transactionId)

  let history = histData.history
  if (transaction.batchId) {
    history = history.map(h => {
      if (h.id !== transaction.batchId) return h
      const transactionIds = (h.transactionIds || []).filter(id => id !== transactionId)
      return { ...h, transactionIds, rowCount: transactionIds.length }
    }).filter(h => h.rowCount > 0)
  }

  await saveTransactions({ ...txData, transactions: remaining })
  await saveHistory({ history })
}

export async function updateTransaction(updated) {
  const { transactions: txData } = await loadAllData()
  const transactions = txData.transactions.map(t =>
    t.id === updated.id ? updated : t
  )
  await saveTransactions({ ...txData, transactions })
}