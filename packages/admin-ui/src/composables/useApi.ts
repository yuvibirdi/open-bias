const base = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export interface Article {
  id: number
  title: string
  link: string
  summary?: string
  published: string
  bias: number
  sourceName?: string
}

export interface Source {
  id: number
  name: string
  rss: string
  bias: number
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base + path, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function getArticles(params?: { limit?: number; bias?: number }): Promise<{ articles: Article[] }> {
  const query = new URLSearchParams()
  if (params?.limit) query.set('limit', params.limit.toString())
  if (params?.bias) query.set('bias', params.bias.toString())
  
  return api(`/articles?${query}`)
}

export async function getSources(): Promise<{ sources: Source[] }> {
  return api('/sources')
}
