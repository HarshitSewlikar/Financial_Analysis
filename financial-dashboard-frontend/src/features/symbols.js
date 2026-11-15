export const COMPANIES = [
  { symbol: 'IBM', name: 'International Business Machines' },
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
]

export const companyName = (symbol) =>
  COMPANIES.find((company) => company.symbol === symbol)?.name || symbol

export const companySearch = (text) => {
  const query = String(text || '').trim().toLowerCase()
  if (!query) return { symbol: '', search: '' }
  const matches = COMPANIES.filter(
    (company) => company.symbol.toLowerCase() === query || company.name.toLowerCase().includes(query),
  )
  if (matches.length === 1) return { symbol: matches[0].symbol, search: '' }
  return { symbol: '', search: String(text).trim() }
}
