import { useAuth } from './useAuth'

const base = import.meta.env.VITE_API_URL || ''

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
  const { getAuthHeaders } = useAuth()
  const authHeaders = getAuthHeaders()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...init?.headers as Record<string, string>,
  }

  // Only add auth headers if they exist
  if (authHeaders.Authorization) {
    headers.Authorization = authHeaders.Authorization
  }

  const res = await fetch(base + path, {
    ...init,
    headers,
  })
  
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export function useApi() {
  const get = async <T>(path: string): Promise<T> => {
    return api<T>(path)
  }

  const post = async <T>(path: string, data?: any): Promise<T> => {
    return api<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  const put = async <T>(path: string, data?: any): Promise<T> => {
    return api<T>(path, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  const del = async <T>(path: string): Promise<T> => {
    return api<T>(path, {
      method: 'DELETE',
    })
  }

  return { get, post, put, delete: del, fetchStoryById, analyzeStory }
}

export async function fetchStoryById(storyId: number) {
  return api(`/api/stories/${storyId}`)
}

export async function analyzeStory(storyId: number) {
  return api(`/api/stories/${storyId}/analyze`, { method: 'POST' })
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
